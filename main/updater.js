'use strict';

// Prüft, ob es eine neuere Version von HATS Builder selbst gibt, und lädt sie
// auf Wunsch herunter. Die Release-Abfrage läuft über github.js, profitiert
// also von Cache, ETag und einem eventuell hinterlegten Token.

const fs = require('fs');
const path = require('path');
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

async function check(currentVersion, portable) {
  const release = await github.fetchLatestRelease(REPO);
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

// Lädt die Update-Datei nach targetDir und meldet den Fortschritt.
async function download(asset, targetDir, emit) {
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

module.exports = { REPO, check, download, isNewer, parseVersion, pickAsset };
