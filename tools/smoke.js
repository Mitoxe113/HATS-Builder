'use strict';

// Startet die App einmal mit allen Oberflächen-Tests und beendet sie wieder.
// Aufruf: npm run smoke   (optional: npm run smoke -- --shots <ordner>)
//
// Läuft bewusst in einem eigenen Einstellungsordner. Die echte
// %APPDATA%\HATS Builder\settings.json enthält das GitHub-Token des Nutzers
// und darf von einem Testlauf nicht angefasst werden.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const WURZEL = path.join(__dirname, '..');
const argumente = process.argv.slice(2);
const shotIndex = argumente.indexOf('--shots');
const shotDir = shotIndex >= 0 ? argumente[shotIndex + 1] : null;

const datenDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hats-smoke-'));

// Den vorhandenen Release-Zwischenspeicher übernehmen, falls es ihn gibt.
// Ohne Token erlaubt GitHub nur 60 Abfragen pro Stunde, und ein Testlauf
// fragt über 30 Komponenten ab. Der Cache spart das komplett ein.
const echterCache = path.join(
  process.env.APPDATA || os.homedir(),
  'HATS Builder',
  'release-cache.json'
);
try {
  if (fs.existsSync(echterCache)) {
    fs.copyFileSync(echterCache, path.join(datenDir, 'release-cache.json'));
    console.log('Release-Zwischenspeicher übernommen, das spart GitHub-Abfragen.');
  }
} catch {
  /* ohne geht es auch, dann dauert es nur länger */
}

if (shotDir) fs.mkdirSync(shotDir, { recursive: true });

const umgebung = {
  ...process.env,
  HATS_SMOKE: '1',
  HATS_TEST_DEPS: '1',
  HATS_TEST_DNS: '1',
  HATS_TEST_IPC: '1',
  HATS_TEST_BUSY: '1',
};
if (shotDir) umgebung.HATS_SHOT_DIR = path.resolve(shotDir);

// Direkt die Electron-Datei aufrufen statt über npx: Node führt .cmd-Dateien
// seit Version 22 nicht mehr ohne Shell aus, und der direkte Weg spart
// ohnehin einen Zwischenschritt.
let electronPfad;
try {
  electronPfad = require('electron');
} catch {
  console.error('Electron ist nicht installiert. Bitte zuerst "npm install" ausführen.');
  process.exit(1);
}

console.log('Starte die App im Testmodus …\n');
const ergebnis = spawnSync(
  electronPfad,
  ['.', `--user-data-dir=${datenDir}`],
  { cwd: WURZEL, env: umgebung, stdio: 'inherit' }
);

try {
  fs.rmSync(datenDir, { recursive: true, force: true });
} catch {
  /* Windows hält die Dateien manchmal noch kurz fest */
}

if (shotDir) console.log(`\nScreenshots liegen in ${path.resolve(shotDir)}`);
process.exit(ergebnis.status === null ? 1 : ergebnis.status);
