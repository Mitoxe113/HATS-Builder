'use strict';

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { COMPONENTS } = require('./components');
const github = require('./github');
const { generateIni } = require('./hekate');
const { mt } = require('./messages');

// Marker-Datei: kennzeichnet einen von uns erstellten Pack-Ordner.
// Nur Ordner mit dieser Datei (oder leere Ordner) werden beim Neu-Bauen geleert.
const MARKER = 'hats-pack.json';

let cacheDir = null;

function init(userDataDir) {
  cacheDir = path.join(userDataDir, 'download-cache');
  fs.mkdirSync(cacheDir, { recursive: true });
}

async function downloadAsset(component, release, asset, emit) {
  const dir = path.join(cacheDir, component.id, release.tag.replace(/[^\w.-]/g, '_'));
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, asset.name);

  // Bereits im Cache → nicht erneut laden. Bei bekannter Größe (Releases) muss
  // sie exakt stimmen; bei unbekannter Größe (Branch-Archive, size 0) genügt
  // eine vorhandene, nicht-leere Datei – der Cache-Ordner ist ohnehin nach der
  // Commit-SHA benannt, ändert sich der Branch also, ändert sich der Pfad.
  try {
    const st = fs.statSync(dest);
    if (asset.size ? st.size === asset.size : st.size > 0) {
      emit({ type: 'log', text: `${asset.name} bereits im Cache` });
      return dest;
    }
  } catch {
    /* nicht vorhanden → laden */
  }

  const res = await fetch(asset.url, { headers: { 'User-Agent': 'HATS-Builder' } });
  if (!res.ok || !res.body) {
    throw new Error(mt('err.downloadFailed', asset.name, res.status));
  }

  const total = Number(res.headers.get('content-length')) || asset.size || 0;
  const tmp = `${dest}.part`;
  const file = fs.createWriteStream(tmp);
  let done = 0;
  let lastEmit = 0;

  try {
    for await (const chunk of res.body) {
      // Backpressure beachten: bei vollem Puffer auf 'drain' warten, sonst
      // würde eine große Datei komplett im RAM landen
      if (!file.write(chunk)) {
        await new Promise((resolve) => file.once('drain', resolve));
      }
      done += chunk.length;
      const now = Date.now();
      if (now - lastEmit > 100) {
        lastEmit = now;
        emit({
          type: 'asset-progress',
          component: component.id,
          asset: asset.name,
          done,
          total,
        });
      }
    }
    await new Promise((resolve, reject) =>
      file.end((err) => (err ? reject(err) : resolve()))
    );
    fs.renameSync(tmp, dest);
  } catch (err) {
    file.destroy();
    fs.rmSync(tmp, { force: true });
    throw err;
  }
  return dest;
}

// Verhindert Zip-Slip: der Zielpfad muss innerhalb von base bleiben.
function safeJoin(base, ...parts) {
  const target = path.resolve(base, ...parts);
  const root = path.resolve(base);
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error(mt('err.zipSlip'));
  }
  return target;
}

// Wendet eine Asset-Regel an und liefert die Liste der geschriebenen Dateien
// (relativ zu outputDir) zurück – damit spätere Builds gezielt nur unsere
// Dateien wieder entfernen können.
function applyAsset(rule, filePath, outputDir) {
  const written = [];
  if (rule.action === 'extract') {
    const zip = new AdmZip(filePath);
    for (const entry of zip.getEntries()) {
      if (entry.isDirectory) continue;
      let rel = entry.entryName;
      if (rule.stripPrefix) {
        // Führenden Ordner im ZIP abschneiden (z. B. "SdOut/" oder "<repo>-master/")
        if (!rel.startsWith(rule.stripPrefix)) continue;
        rel = rel.slice(rule.stripPrefix.length);
      }
      if (!rel) continue;
      const outPath = safeJoin(outputDir, rule.target, rel);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, entry.getData());
      written.push(path.relative(outputDir, outPath));
    }
    if (rule.stripPrefix && written.length === 0) {
      throw new Error(mt('err.stripMissing', rule.stripPrefix));
    }
  } else {
    const target = safeJoin(outputDir, rule.target);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(filePath, target);
    written.push(path.relative(outputDir, target));
  }
  return written;
}

// Entfernt (bottom-up) leere Ordner innerhalb von root, aber niemals root selbst.
function pruneEmptyDirs(root) {
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const sub = path.join(dir, entry.name);
      walk(sub);
      try {
        if (fs.readdirSync(sub).length === 0) fs.rmdirSync(sub);
      } catch {
        /* nicht leer / nicht löschbar → stehen lassen */
      }
    }
  };
  walk(root);
}

function preparePackDir(outputDir) {
  if (fs.existsSync(outputDir)) {
    const entries = fs.readdirSync(outputDir);
    if (entries.length > 0) {
      const info = readPackInfo(outputDir);
      if (!info) {
        throw new Error(mt('err.folderNotEmpty', outputDir));
      }
      if (Array.isArray(info.files)) {
        // Nur die von uns zuletzt geschriebenen Dateien entfernen – vom Nutzer
        // hinzugefügte Dateien im selben Ordner bleiben unangetastet.
        for (const rel of info.files) {
          const p = path.join(outputDir, rel);
          try {
            if (fs.statSync(p).isFile()) fs.rmSync(p, { force: true });
          } catch {
            /* bereits weg → egal */
          }
        }
        fs.rmSync(path.join(outputDir, MARKER), { force: true });
        pruneEmptyDirs(outputDir);
      }
      // Alter Marker ohne Dateiliste: nichts löschen, neue Dateien überschreiben.
    }
  }
  fs.mkdirSync(outputDir, { recursive: true });
}

function dirStats(dir) {
  let files = 0;
  let bytes = 0;
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else {
        files += 1;
        bytes += fs.statSync(p).size;
      }
    }
  };
  walk(dir);
  return { files, bytes };
}

// Löst Abhängigkeiten transitiv auf: Pflicht-Komponenten kommen immer dazu,
// und jede requires-Kette wird vollständig mit eingeschlossen. So kann auch
// eine unvollständige (z. B. alte gespeicherte) Auswahl kein kaputtes Pack
// erzeugen.
function expandSelection(selectedIds) {
  const byId = new Map(COMPONENTS.map((c) => [c.id, c]));
  const set = new Set((selectedIds || []).filter((id) => byId.has(id)));
  for (const c of COMPONENTS) if (c.required) set.add(c.id);
  let grew = true;
  while (grew) {
    grew = false;
    for (const id of [...set]) {
      for (const dep of byId.get(id).requires || []) {
        if (!set.has(dep)) {
          set.add(dep);
          grew = true;
        }
      }
    }
  }
  return set;
}

// Baut das komplette SD-Pack in outputDir.
// emit(event) schickt Fortschritt an den Renderer.
async function buildPack({ outputDir, selectedIds, hekateConfig }, emit) {
  const ids = expandSelection(selectedIds);
  // Registry-Reihenfolge beibehalten – sie bestimmt, wer wen überschreibt
  const selected = COMPONENTS.filter((c) => ids.has(c.id));

  emit({ type: 'log', text: `Prüfe neueste Versionen (${selected.length} Komponenten) …` });
  const releases = {};
  for (const comp of selected) {
    releases[comp.id] = await github.fetchLatest(comp);
  }

  emit({ type: 'log', text: `Bereite Zielordner vor: ${outputDir}` });
  preparePackDir(outputDir);

  const totalSteps = selected.length + 1; // +1 für Konfiguration/Abschluss
  let step = 0;

  const builtComponents = [];
  const writtenFiles = []; // alle von uns geschriebenen Dateien (relativ zu outputDir)
  for (const comp of selected) {
    const release = releases[comp.id];
    step += 1;
    emit({
      type: 'step',
      component: comp.id,
      name: comp.name,
      version: release.tag,
      step,
      totalSteps,
    });

    for (const rule of comp.assets) {
      const asset = release.assets.find((a) => rule.match.test(a.name));
      if (!asset) {
        throw new Error(mt('err.noAsset', comp.name, String(rule.match)));
      }
      const filePath = await downloadAsset(comp, release, asset, emit);
      emit({
        type: 'log',
        text: `${comp.name}: ${rule.action === 'extract' ? 'entpacke' : 'kopiere'} ${asset.name}`,
      });
      for (const rel of applyAsset(rule, filePath, outputDir)) writtenFiles.push(rel);
    }

    for (const pattern of comp.cleanupRoot || []) {
      for (const entry of fs.readdirSync(outputDir)) {
        if (pattern.test(entry)) fs.rmSync(path.join(outputDir, entry), { force: true });
      }
    }

    builtComponents.push({
      id: comp.id,
      name: comp.name,
      version: release.tag,
      stale: !!release.stale,
    });
  }

  // Hekate-Boot-Menü-Konfiguration schreiben
  step += 1;
  emit({ type: 'step', component: null, name: 'Hekate-Konfiguration', version: '', step, totalSteps });
  const bootloaderDir = path.join(outputDir, 'bootloader');
  fs.mkdirSync(bootloaderDir, { recursive: true });
  fs.writeFileSync(path.join(bootloaderDir, 'hekate_ipl.ini'), generateIni(hekateConfig));
  writtenFiles.push(path.join('bootloader', 'hekate_ipl.ini'));
  emit({ type: 'log', text: 'bootloader/hekate_ipl.ini geschrieben' });

  // Hotfix-Ordner, die Homebrew erwartet
  fs.mkdirSync(path.join(outputDir, 'switch'), { recursive: true });

  const stats = dirStats(outputDir);
  const marker = {
    builtWith: 'HATS Builder',
    builtAt: new Date().toISOString(),
    components: builtComponents,
    // Liste aller geschriebenen Dateien – für gezieltes Aufräumen beim Neu-Bauen
    files: [...new Set(writtenFiles)],
  };
  fs.writeFileSync(path.join(outputDir, MARKER), JSON.stringify(marker, null, 2));

  return { outputDir, components: builtComponents, files: stats.files + 1, bytes: stats.bytes };
}

function readPackInfo(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, MARKER), 'utf8'));
  } catch {
    return null;
  }
}

module.exports = {
  init,
  buildPack,
  expandSelection,
  applyAsset,
  preparePackDir,
  safeJoin,
  readPackInfo,
  MARKER,
};
