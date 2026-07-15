'use strict';

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

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
      label: d.VolumeName || 'Ohne Namen',
      fileSystem: d.FileSystem || 'unbekannt',
      size: Number(d.Size) || 0,
      free: Number(d.FreeSpace) || 0,
      // Die Switch läuft am zuverlässigsten mit FAT32; exFAT kann bei
      // Abstürzen zu Datenverlust führen.
      fat32: (d.FileSystem || '').toUpperCase() === 'FAT32',
    }));
}

function listFiles(dir) {
  const files = [];
  const walk = (d, rel) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const abs = path.join(d, entry.name);
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(abs, relPath);
      else files.push({ abs, rel: relPath, size: fs.statSync(abs).size });
    }
  };
  walk(dir, '');
  return files;
}

// Kopiert den Pack-Ordner auf das Laufwerk (Merge, vorhandene Dateien werden
// überschrieben – so funktioniert auch das Aktualisieren eines bestehenden Setups).
async function copyToDrive(packDir, driveLetter, emit) {
  if (!/^[A-Z]:$/i.test(driveLetter)) {
    throw new Error(`Ungültiges Laufwerk: ${driveLetter}`);
  }
  const root = `${driveLetter}\\`;
  if (!fs.existsSync(root)) {
    throw new Error(`Laufwerk ${driveLetter} ist nicht verfügbar.`);
  }

  const files = listFiles(packDir);
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  let doneBytes = 0;
  let doneFiles = 0;
  let lastEmit = 0;

  for (const file of files) {
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

module.exports = { listDrives, copyToDrive };
