'use strict';

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { mt } = require('./messages');

function ps(command) {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', command],
      { windowsHide: true, timeout: 20000 },
      (err, stdout, stderr) => {
        if (err) reject(new Error(stderr || err.message));
        else resolve(stdout);
      }
    );
  });
}

// Listet Wechseldatenträger (SD-Karten, USB-Sticks) auf.
async function listDrives() {
  const out = await ps(
    'Get-CimInstance Win32_LogicalDisk -Filter "DriveType=2" | ' +
      'Select-Object DeviceID,VolumeName,FileSystem,Size,FreeSpace | ConvertTo-Json -Compress'
  );
  const trimmed = out.trim();
  if (!trimmed) return [];
  let parsed = JSON.parse(trimmed);
  if (!Array.isArray(parsed)) parsed = [parsed];
  return parsed
    // Leere Kartenleser-Slots melden sich als Laufwerk mit Größe 0 – ausblenden
    .filter((d) => d.DeviceID && Number(d.Size) > 0)
    .map((d) => ({
      letter: d.DeviceID,
      label: d.VolumeName || mt('sd.noName'),
      fileSystem: d.FileSystem || mt('sd.unknownFs'),
      size: Number(d.Size) || 0,
      free: Number(d.FreeSpace) || 0,
      // Die Switch läuft am zuverlässigsten mit FAT32; exFAT kann bei
      // Abstürzen zu Datenverlust führen.
      fat32: (d.FileSystem || '').toUpperCase() === 'FAT32',
    }));
}

// Dateien, die nur den Pack-Ordner beschreiben und auf der Karte nichts
// verloren haben.
const NICHT_KOPIEREN = new Set(['hats-pack.json']);

function listFiles(dir) {
  const files = [];
  const walk = (d, rel) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (!rel && NICHT_KOPIEREN.has(entry.name)) continue;
      const abs = path.join(d, entry.name);
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(abs, relPath);
      else files.push({ abs, rel: relPath, size: fs.statSync(abs).size });
    }
  };
  walk(dir, '');
  return files;
}

// Dateien, in denen typischerweise eigene Einstellungen des Nutzers stehen.
// Die werden beim Kopieren überschrieben, deshalb vorher darauf hinweisen.
function isUserConfig(rel) {
  const p = rel.replace(/\\/g, '/');
  return (
    p.startsWith('config/') ||
    p.startsWith('atmosphere/config/') ||
    p.startsWith('atmosphere/hosts/') ||
    p === 'bootloader/hekate_ipl.ini'
  );
}

function driveRoot(driveLetter) {
  if (!/^[A-Z]:$/i.test(driveLetter)) {
    throw new Error(mt('err.invalidDrive', driveLetter));
  }
  const root = `${driveLetter}\\`;
  if (!fs.existsSync(root)) {
    throw new Error(mt('err.driveUnavailable', driveLetter));
  }
  return root;
}

// Freien Platz und Clustergröße des Laufwerks ermitteln.
function driveSpace(root) {
  try {
    const st = fs.statfsSync(root);
    return { freeBytes: st.bavail * st.bsize, clusterSize: st.bsize || 0 };
  } catch {
    // Nicht ermittelbar, dann eben ohne Platzprüfung
    return { freeBytes: null, clusterSize: 0 };
  }
}

// Geht den Pack-Ordner einmal durch und sammelt alles, was für Vorschau und
// Kopieren gebraucht wird. Bewusst ein einziger Durchlauf, denn jedes statSync
// geht auf die langsame SD-Karte.
function scanCopy(packDir, root, clusterSize) {
  const files = listFiles(packDir);
  // FAT32 belegt pro Datei mindestens einen ganzen Cluster. Bei vielen kleinen
  // Dateien ist der Verschnitt sonst deutlich unterschätzt.
  const belegt = (size) => (clusterSize > 0 ? Math.ceil(size / clusterSize) * clusterSize : size);

  let totalBytes = 0;
  let neededBytes = 0; // was zusätzlich gebraucht wird, vorhandene Dateien zählen nur anteilig
  const conflicts = [];

  for (const file of files) {
    totalBytes += file.size;
    let existing = -1;
    try {
      existing = fs.statSync(path.join(root, file.rel)).size;
    } catch {
      /* Datei ist neu */
    }
    neededBytes += existing >= 0 ? Math.max(0, belegt(file.size) - belegt(existing)) : belegt(file.size);
    if (existing >= 0 && isUserConfig(file.rel)) conflicts.push(file.rel);
  }

  return { files, totalBytes, neededBytes, conflicts };
}

// Schaut vor dem Kopieren nach: Passt das Pack überhaupt drauf, und welche
// eigenen Konfigurationsdateien würden überschrieben?
function previewCopy(packDir, driveLetter) {
  const root = driveRoot(driveLetter);
  const { freeBytes, clusterSize } = driveSpace(root);
  const scan = scanCopy(packDir, root, clusterSize);
  return {
    totalFiles: scan.files.length,
    totalBytes: scan.totalBytes,
    neededBytes: scan.neededBytes,
    freeBytes,
    // etwas Luft lassen, eine randvolle FAT32-Karte macht keine Freude
    enoughSpace: freeBytes === null || freeBytes >= scan.neededBytes + 8 * 1024 * 1024,
    conflicts: scan.conflicts,
  };
}

// Kopiert den Pack-Ordner auf das Laufwerk (Merge, vorhandene Dateien werden
// überschrieben – so funktioniert auch das Aktualisieren eines bestehenden Setups).
async function copyToDrive(packDir, driveLetter, emit, signal) {
  const root = driveRoot(driveLetter);
  const { freeBytes, clusterSize } = driveSpace(root);
  const scan = scanCopy(packDir, root, clusterSize);

  // Harte Bremse: lieber gar nicht anfangen als mittendrin abbrechen und ein
  // halbes CFW auf der Karte hinterlassen.
  if (freeBytes !== null && freeBytes < scan.neededBytes + 8 * 1024 * 1024) {
    throw new Error(mt('err.notEnoughSpace', fmtMb(scan.neededBytes), fmtMb(freeBytes)));
  }

  const files = scan.files;
  const totalBytes = scan.totalBytes;
  let doneBytes = 0;
  let doneFiles = 0;
  let lastEmit = 0;

  for (const file of files) {
    if (signal && signal.aborted) throw new Error(mt('err.cancelled'));
    const target = path.join(root, file.rel);
    // Kein mkdir auf bereits existierende Ordner: Node wirft auf Laufwerks-Roots
    // (z. B. "F:\") fälschlich EPERM, selbst mit recursive:true
    const targetDir = path.dirname(target);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
    fs.copyFileSync(file.abs, target);
    doneBytes += file.size;
    doneFiles += 1;
    const now = Date.now();
    if (now - lastEmit > 150 || doneFiles === files.length) {
      lastEmit = now;
      emit({
        type: 'sd-progress',
        doneFiles,
        totalFiles: files.length,
        doneBytes,
        totalBytes,
        current: file.rel,
      });
    }
  }

  return { files: doneFiles, bytes: doneBytes };
}

function fmtMb(bytes) {
  return `${Math.round((bytes || 0) / 1048576)} MB`;
}

module.exports = { listDrives, copyToDrive, previewCopy, isUserConfig };
