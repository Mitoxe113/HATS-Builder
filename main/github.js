'use strict';

const fs = require('fs');
const path = require('path');

// Holt das jeweils neueste offizielle Release eines Repos über die GitHub-API.
//
// Rate-Limit-Strategie (ohne Token nur 60 Anfragen/Stunde!):
//   1. Platten-Cache mit TTL – innerhalb der TTL keine Anfrage.
//   2. ETag / If-None-Match – antwortet GitHub mit 304 ("unverändert"),
//      zählt die Anfrage NICHT gegen das Rate-Limit.
//   3. Optionales Personal-Access-Token → 5.000 Anfragen/Stunde.
//   4. Ist die API nicht erreichbar (offline/Rate-Limit), wird auf den
//      Cache zurückgegriffen – egal wie alt er ist (stale + Grund).

const TTL_MS = 15 * 60 * 1000;

let cacheFile = null;
let cache = {};
let token = '';

function init(userDataDir) {
  cacheFile = path.join(userDataDir, 'release-cache.json');
  try {
    cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  } catch {
    cache = {};
  }
}

function setToken(value) {
  token = String(value || '').trim();
}

function headers(extra = {}) {
  const h = { 'User-Agent': 'HATS-Builder', Accept: 'application/vnd.github+json', ...extra };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

let persistTimer = null;
let persistDirty = false;

function writeCache() {
  persistDirty = false;
  if (!cacheFile) return;
  try {
    // Mit dem Platten-Stand mergen, damit parallel geschriebene
    // Einträge (z. B. zweite Instanz) nicht verloren gehen
    let disk = {};
    try {
      disk = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    } catch {
      /* keine/kaputte Datei → ignorieren */
    }
    cache = { ...disk, ...cache };
    fs.writeFileSync(cacheFile, JSON.stringify(cache));
  } catch {
    // Cache ist optional – Fehler hier sind nicht kritisch
  }
}

// Bündelt viele Cache-Updates (z. B. ~28 parallele Abfragen bei "Updates prüfen")
// zu EINEM Schreibvorgang, statt die Datei pro Eintrag komplett neu zu schreiben.
function persist() {
  persistDirty = true;
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    if (persistDirty) writeCache();
  }, 50);
}

// Ausstehenden Schreibvorgang sofort erledigen (z. B. vor dem Beenden).
function flush() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  if (persistDirty) writeCache();
}

function checkStatus(res) {
  if (res.status === 401) {
    throw new Error('GitHub-Token ungültig – bitte im Token-Feld prüfen oder leeren.');
  }
  if (res.status === 403 || res.status === 429) {
    if (res.headers.get('x-ratelimit-remaining') === '0') {
      const reset = Number(res.headers.get('x-ratelimit-reset'));
      const time = reset
        ? new Date(reset * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
        : null;
      throw new Error(
        `GitHub-Rate-Limit erreicht${time ? ` – Reset um ${time} Uhr` : ''}. ` +
          'Tipp: kostenloses GitHub-Token hinterlegen (5.000 statt 60 Abfragen/Stunde).'
      );
    }
    throw new Error('GitHub hat die Anfrage abgelehnt (403).');
  }
  if (!res.ok) {
    throw new Error(`GitHub antwortete mit Status ${res.status}`);
  }
}

function slim(release) {
  return {
    tag: release.tag_name,
    name: release.name || release.tag_name,
    publishedAt: release.published_at,
    htmlUrl: release.html_url,
    body: (release.body || '').slice(0, 4000),
    assets: (release.assets || []).map((a) => ({
      name: a.name,
      size: a.size,
      url: a.browser_download_url,
    })),
  };
}

// Generischer, gecachter Fetch.
// fetcher(etag) liefert { data, etag } – oder null bei 304 (unverändert).
async function cached(key, force, fetcher) {
  const entry = cache[key];
  if (!force && entry && Date.now() - entry.fetchedAt < TTL_MS) {
    return { ...entry.data, stale: false, fromCache: true };
  }
  try {
    const result = await fetcher(entry ? entry.etag : undefined);
    if (result === null && entry) {
      // 304: Release unverändert – TTL auffrischen, Anfrage war "gratis"
      cache[key] = { ...entry, fetchedAt: Date.now() };
      persist();
      return { ...entry.data, stale: false, fromCache: true };
    }
    cache[key] = { fetchedAt: Date.now(), data: result.data, etag: result.etag || undefined };
    persist();
    return { ...result.data, stale: false, fromCache: false };
  } catch (err) {
    if (entry) {
      // Offline oder Rate-Limit: alter Stand ist besser als gar keiner
      return { ...entry.data, stale: true, fromCache: true, staleReason: err.message };
    }
    throw new Error(err.message);
  }
}

function fetchLatestRelease(repo, { force = false } = {}) {
  return cached(repo, force, async (etag) => {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: headers(etag ? { 'If-None-Match': etag } : {}),
    });
    if (res.status === 304) return null;
    checkStatus(res);
    return { data: slim(await res.json()), etag: res.headers.get('etag') };
  });
}

// Kein Release vorhanden → neuestes Branch-Archiv als synthetisches Asset.
function fetchLatestBranch(repo, branch, { force = false } = {}) {
  return cached(`${repo}#${branch}`, force, async (etag) => {
    const res = await fetch(`https://api.github.com/repos/${repo}/commits/${branch}`, {
      headers: headers(etag ? { 'If-None-Match': etag } : {}),
    });
    if (res.status === 304) return null;
    checkStatus(res);
    const commit = await res.json();
    const sha = (commit.sha || '').slice(0, 7);
    const repoName = repo.split('/')[1];
    const date = commit.commit && commit.commit.committer ? commit.commit.committer.date : null;
    return {
      data: {
        tag: sha || branch,
        name: `${branch} @ ${sha}`,
        publishedAt: date,
        htmlUrl: `https://github.com/${repo}/tree/${branch}`,
        body: '',
        assets: [
          {
            name: `${repoName}-${branch}.zip`,
            size: 0,
            url: `https://github.com/${repo}/archive/refs/heads/${branch}.zip`,
          },
        ],
      },
      etag: res.headers.get('etag'),
    };
  });
}

// Einheitlicher Einstieg: wählt anhand von component.source die Quelle.
function fetchLatest(component, opts = {}) {
  if (component.source === 'branch') {
    return fetchLatestBranch(component.repo, component.branch || 'master', opts);
  }
  return fetchLatestRelease(component.repo, opts);
}

module.exports = { init, setToken, flush, fetchLatestRelease, fetchLatestBranch, fetchLatest };
