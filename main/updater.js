'use strict';

// Prüft, ob es eine neuere Version von HATS Builder selbst gibt, und lädt sie
// auf Wunsch herunter. Die Release-Abfrage läuft über github.js, profitiert
// also von Cache, ETag und einem eventuell hinterlegten Token.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const github = require('./github');
const { mt } = require('./messages');

// Repo, aus dem die App ihre eigenen Updates bezieht.
const REPO = 'Mitoxe113/HATS-Builder';

// "v1.2.3" oder "1.2.3" wird zu [1, 2, 3]
function parseVersion(value) {
  return String(value || '')
    .replace(/^v/i, '')
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);
}

// Zahlenweiser Vergleich, damit 1.0.10 korrekt neuer ist als 1.0.9
function isNewer(candidate, current) {
  const a = parseVersion(candidate);
  const b = parseVersion(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0;
    const y = b[i] || 0;
    if (x !== y) return x > y;
  }
  return false;
}

// Passende Datei zur laufenden Installation: portable oder Installer.
function pickAsset(assets, portable) {
  const wanted = portable ? /portable\.exe$/i : /setup\.exe$/i;
  return (
    assets.find((a) => wanted.test(a.name)) ||
    assets.find((a) => /\.exe$/i.test(a.name)) ||
    null
  );
}

// force: bei der Prüfung von Hand nicht den Cache nehmen, sondern wirklich
// nachschauen. Sonst behauptet die App bis zu 15 Minuten lang, alles sei aktuell.
async function check(currentVersion, portable, { force = false } = {}) {
  const release = await github.fetchLatestRelease(REPO, { force });
  const latest = String(release.tag || '').replace(/^v/i, '');
  const asset = pickAsset(release.assets || [], portable);
  return {
    available: Boolean(latest) && isNewer(latest, currentVersion),
    latest,
    current: currentVersion,
    url: release.htmlUrl,
    asset: asset ? { name: asset.name, url: asset.url, size: asset.size } : null,
  };
}

// Die geladene Datei ist eine EXE, die der Nutzer danach ausführt. Deshalb wird
// hier abgesichert, dass die Adresse wirklich von GitHub stammt.
const GITHUB_URL = /^https:\/\/([a-z0-9-]+\.)*(github\.com|githubusercontent\.com)\//i;

// Lädt die Update-Datei nach targetDir und meldet den Fortschritt.
async function download(asset, targetDir, emit) {
  if (!asset || !GITHUB_URL.test(String(asset.url || ''))) {
    throw new Error(mt('err.badUpdateUrl'));
  }
  fs.mkdirSync(targetDir, { recursive: true });
  const dest = path.join(targetDir, path.basename(asset.name));
  const tmp = `${dest}.part`;

  const res = await fetch(asset.url, { headers: { 'User-Agent': 'HATS-Builder' } });
  if (!res.ok || !res.body) {
    throw new Error(mt('err.downloadFailed', asset.name, res.status));
  }

  const total = Number(res.headers.get('content-length')) || asset.size || 0;
  const file = fs.createWriteStream(tmp);
  let done = 0;
  let lastEmit = 0;

  try {
    for await (const chunk of res.body) {
      // Backpressure beachten, sonst landet die ganze Datei im RAM
      if (!file.write(chunk)) {
        await new Promise((resolve) => file.once('drain', resolve));
      }
      done += chunk.length;
      const now = Date.now();
      if (now - lastEmit > 150) {
        lastEmit = now;
        emit({ type: 'update-progress', done, total });
      }
    }
    await new Promise((resolve, reject) => file.end((err) => (err ? reject(err) : resolve())));
    fs.rmSync(dest, { force: true });
    fs.renameSync(tmp, dest);
  } catch (err) {
    file.destroy();
    fs.rmSync(tmp, { force: true });
    throw err;
  }

  emit({ type: 'update-progress', done: total || done, total: total || done });
  return dest;
}

// Die portable Fassung setzt diese Variable auf ihre eigene EXE.
function portableExe() {
  return process.env.PORTABLE_EXECUTABLE_FILE || '';
}

// Einfache Anführungszeichen für PowerShell verdoppeln
function psQuote(s) {
  return String(s).replace(/'/g, "''");
}

// Installierte Fassung: Der Installer läuft und ersetzt die App selbst,
// danach startet er sie wieder. Wir müssen nur aus dem Weg gehen.
async function installSetup(datei, app) {
  let fehler = null;
  const kind = spawn(datei, [], { detached: true, stdio: 'ignore' });
  kind.on('error', (e) => {
    fehler = e;
  });
  kind.unref();
  // Kurz abwarten, ob der Start überhaupt geklappt hat
  await new Promise((r) => setTimeout(r, 800));
  if (fehler) throw new Error(mt('err.updateStartFailed'));
  setTimeout(() => app.quit(), 300);
}

// Portable Fassung: Eine laufende EXE kann sich unter Windows nicht selbst
// überschreiben. Deshalb übernimmt ein kleines Skript: Es wartet, bis wir
// beendet sind, tauscht die Datei, startet die neue und räumt sich selbst weg.
function buildPortableScript(datei, ziel, pid, marker) {
  return [
    '$ErrorActionPreference = "SilentlyContinue"',
    // Erste Amtshandlung: melden, dass wir laufen. Erst wenn die App das
    // sieht, beendet sie sich. Sonst stünde der Nutzer ohne App und ohne
    // Update da.
    `Set-Content -LiteralPath '${psQuote(marker)}' -Value 'los' -Force`,
    `try { Wait-Process -Id ${pid} -Timeout 120 } catch {}`,
    'Start-Sleep -Milliseconds 700',
    `$neu = '${psQuote(datei)}'`,
    `$alt = '${psQuote(ziel)}'`,
    // Mehrere Versuche, falls Windows die Datei noch kurz festhält
    'for ($i = 0; $i -lt 40; $i++) {',
    '  try { Copy-Item -LiteralPath $neu -Destination $alt -Force -ErrorAction Stop; break }',
    '  catch { Start-Sleep -Milliseconds 500 }',
    '}',
    'Start-Process -FilePath $alt',
    'Remove-Item -LiteralPath $neu -Force',
    `Remove-Item -LiteralPath '${psQuote(marker)}' -Force`,
    'Remove-Item -LiteralPath $MyInvocation.MyCommand.Path -Force',
    '',
  ].join('\r\n');
}

// Wartet kurz darauf, dass die Datei auftaucht.
function warteAufDatei(datei, msMax) {
  return new Promise((resolve) => {
    const bis = Date.now() + msMax;
    const schauen = () => {
      if (fs.existsSync(datei)) return resolve(true);
      if (Date.now() > bis) return resolve(false);
      setTimeout(schauen, 100);
    };
    schauen();
  });
}

async function installPortable(datei, app) {
  const ziel = portableExe();
  if (!ziel) throw new Error(mt('err.updateNoTarget'));

  const stempel = Date.now();
  const skript = path.join(os.tmpdir(), `hats-update-${stempel}.ps1`);
  const marker = path.join(os.tmpdir(), `hats-update-${stempel}.laeuft`);
  fs.rmSync(marker, { force: true });
  fs.writeFileSync(skript, buildPortableScript(datei, ziel, process.pid, marker), 'utf8');

  spawn(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', skript],
    { detached: true, stdio: 'ignore' }
  ).unref();

  // Erst beenden, wenn der Helfer sich gemeldet hat. Läuft er nicht an, bleibt
  // die App offen und der Nutzer bekommt eine Fehlermeldung statt ins Leere zu
  // greifen.
  if (!(await warteAufDatei(marker, 5000))) {
    fs.rmSync(skript, { force: true });
    throw new Error(mt('err.updateStartFailed'));
  }
  setTimeout(() => app.quit(), 300);
}

// Spielt die geladene Datei ein und startet die App neu.
async function install(datei, app) {
  if (!datei || !fs.existsSync(datei)) throw new Error(mt('err.updateMissing'));
  if (portableExe()) return installPortable(datei, app);
  return installSetup(datei, app);
}

module.exports = {
  REPO,
  check,
  download,
  install,
  buildPortableScript,
  isNewer,
  parseVersion,
  pickAsset,
  portableExe,
};
