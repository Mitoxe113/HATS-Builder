'use strict';

const fs = require('fs');
const path = require('path');
const { mt, getLocale } = require('./messages');

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

// Ein brauchbarer Cache-Eintrag hat einen Zeitstempel und ein Datenobjekt mit
// Asset-Liste. Alles andere führt später zu Abstürzen an Stellen, die mit dem
// Cache nichts zu tun haben (etwa release.assets.find beim Bauen).
function eintragBrauchbar(e) {
  return Boolean(
    e && typeof e === 'object' && Number.isFinite(e.fetchedAt) && e.data && Array.isArray(e.data.assets)
  );
}

function init(userDataDir) {
  cacheFile = path.join(userDataDir, 'release-cache.json');
  cache = {};
  try {
    const gelesen = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    if (gelesen && typeof gelesen === 'object') {
      // Kaputte Einträge einzeln aussortieren statt den ganzen Cache zu
      // verwerfen. Der Rest bleibt nutzbar und spart Anfragen.
      for (const [key, eintrag] of Object.entries(gelesen)) {
        if (eintragBrauchbar(eintrag)) cache[key] = eintrag;
      }
    }
  } catch {
    cache = {};
  }
}

// Merkt sich, ob GitHub das hinterlegte Token abgelehnt hat. Dann wird ohne
// Token weitergearbeitet und die Oberfläche kann darauf hinweisen.
let tokenAbgelehnt = false;

function setToken(value) {
  const neu = String(value || '').trim();
  // Nur bei einem wirklich anderen Token wieder Vertrauen fassen. Sonst würde
  // jedes Speichern der Einstellungen (auch ein verschobener Regler) das längst
  // abgelehnte Token erneut ausprobieren lassen.
  if (neu !== token) tokenAbgelehnt = false;
  token = neu;
}

function wasTokenRejected() {
  return tokenAbgelehnt;
}

function headers(extra = {}, ohneToken = false) {
  const h = { 'User-Agent': 'HATS-Builder', Accept: 'application/vnd.github+json', ...extra };
  if (token && !ohneToken) h.Authorization = `Bearer ${token}`;
  return h;
}

// Ein abgelaufenes oder falsch eingefügtes Token darf nicht die ganze App
// lahmlegen. Lehnt GitHub es ab, wird die Anfrage einmal ohne Token wiederholt.
// Für öffentliche Repos genügt das vollkommen.
//
// Danach wird das Token gar nicht mehr mitgeschickt. Täten wir das, kostete
// jede Abfrage zwei Zugriffe (erst die abgelehnte, dann die richtige), und mit
// über 30 Komponenten wäre das Stundenlimit von 60 nach einem einzigen
// Durchlauf aufgebraucht.
async function apiFetch(url, extra) {
  const res = await fetch(url, { headers: headers(extra, tokenAbgelehnt) });
  if (res.status !== 401 || !token || tokenAbgelehnt) return res;
  tokenAbgelehnt = true;
  return fetch(url, { headers: headers(extra, true) });
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
    throw new Error(mt('err.tokenInvalid'));
  }
  if (res.status === 403 || res.status === 429) {
    if (res.headers.get('x-ratelimit-remaining') === '0') {
      const reset = Number(res.headers.get('x-ratelimit-reset'));
      const time = reset
        ? new Date(reset * 1000).toLocaleTimeString(getLocale(), {
            hour: '2-digit',
            minute: '2-digit',
          })
        : null;
      const err = new Error(mt('err.rateLimit', time ? mt('err.resetAt', time) : ''));
      err.rateLimited = true; // sprachunabhängiges Flag für den Renderer
      throw err;
    }
    throw new Error(mt('err.rejected403'));
  }
  if (!res.ok) {
    throw new Error(mt('err.httpStatus', res.status));
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

// Laufende Abfragen je Schlüssel. Beim Start fragen die Komponentenliste und
// der Firmware-Abgleich beide das Atmosphère-Release ab. Ohne diese Tabelle
// wären das zwei Anfragen für dieselbe Auskunft, und bei 60 Anfragen pro
// Stunde zählt jede einzelne.
const laufend = new Map();

// Generischer, gecachter Fetch.
// fetcher(etag) liefert { data, etag } – oder null bei 304 (unverändert).
async function cached(key, force, fetcher) {
  const entry = cache[key];
  if (!force && entry && Date.now() - entry.fetchedAt < TTL_MS) {
    return { ...entry.data, stale: false, fromCache: true };
  }
  // Läuft für denselben Schlüssel schon eine Abfrage, hängen wir uns dran.
  // Die Kopie verhindert, dass zwei Aufrufer dasselbe Objekt teilen.
  const schonUnterwegs = laufend.get(key);
  if (schonUnterwegs) return { ...(await schonUnterwegs) };

  const abfrage = (async () => {
    try {
      const result = await fetcher(entry ? entry.etag : undefined);
      if (result === null) {
        // 304: Release unverändert – TTL auffrischen, Anfrage war "gratis".
        // Ohne Eintrag dürfte das nicht vorkommen (wir hätten kein ETag
        // mitgeschickt), aber verlassen wollen wir uns darauf nicht.
        if (!entry) throw new Error(mt('err.httpStatus', 304));
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
        return {
          ...entry.data,
          stale: true,
          fromCache: true,
          staleReason: err.message,
          staleRateLimited: !!err.rateLimited,
        };
      }
      throw err;
    }
  })();

  laufend.set(key, abfrage);
  try {
    return await abfrage;
  } finally {
    laufend.delete(key);
  }
}

function fetchLatestRelease(repo, { force = false } = {}) {
  return cached(repo, force, async (etag) => {
    const res = await apiFetch(`https://api.github.com/repos/${repo}/releases/latest`, etag ? { 'If-None-Match': etag } : {});
    if (res.status === 304) return null;
    checkStatus(res);
    return { data: slim(await res.json()), etag: res.headers.get('etag') };
  });
}

// Kein Release vorhanden → neuestes Branch-Archiv als synthetisches Asset.
function fetchLatestBranch(repo, branch, { force = false } = {}) {
  return cached(`${repo}#${branch}`, force, async (etag) => {
    const res = await apiFetch(`https://api.github.com/repos/${repo}/commits/${branch}`, etag ? { 'If-None-Match': etag } : {});
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

// Manche Projekte veröffentlichen keine Releases, sondern legen ihre Dateien
// einfach in einen Ordner im Repo. Dieser Ordner verhält sich hier wie eine
// Asset-Liste: Ein Aufruf liefert alles, was drin liegt, und die match-Regeln
// der Komponente picken sich heraus, was sie brauchen. Der Rest bleibt liegen.
function fetchLatestDir(repo, branch, dir, { force = false } = {}) {
  // Pfadteile einzeln kodieren, Schrägstriche bleiben Trenner. Ein Ordner oder
  // eine Datei mit Leerzeichen im Namen ergäbe sonst eine kaputte Adresse und
  // damit einen stillen 404 beim Herunterladen.
  const enc = (p) => String(p).split('/').map(encodeURIComponent).join('/');
  return cached(`${repo}#${branch}:${dir}`, force, async (etag) => {
    const res = await apiFetch(
      `https://api.github.com/repos/${repo}/git/trees/${encodeURIComponent(branch)}:${enc(dir)}`,
      etag ? { 'If-None-Match': etag } : {}
    );
    if (res.status === 304) return null;
    checkStatus(res);
    const baum = await res.json();
    // Die Prüfsumme des Ordners ändert sich, sobald sich irgendeine Datei
    // darin ändert. Damit taugt sie als Versionsangabe.
    const sha = (baum.sha || '').slice(0, 7);
    return {
      data: {
        tag: sha || branch,
        name: `${dir} @ ${sha}`,
        // Ein Ordner hat kein Veröffentlichungsdatum. Lieber keine Angabe
        // als eine erfundene.
        publishedAt: null,
        htmlUrl: `https://github.com/${repo}/tree/${branch}/${dir}`,
        body: '',
        assets: (baum.tree || [])
          .filter((e) => e.type === 'blob')
          .map((e) => ({
            name: e.path,
            size: e.size || 0,
            url: `https://raw.githubusercontent.com/${repo}/${encodeURIComponent(branch)}/${enc(dir)}/${enc(e.path)}`,
          })),
      },
      etag: res.headers.get('etag'),
    };
  });
}

// Einheitlicher Einstieg: wählt anhand von component.source die Quelle.
function fetchLatest(component, opts = {}) {
  if (component.source === 'dir') {
    return fetchLatestDir(component.repo, component.branch || 'main', component.dir, opts);
  }
  if (component.source === 'branch') {
    return fetchLatestBranch(component.repo, component.branch || 'master', opts);
  }
  return fetchLatestRelease(component.repo, opts);
}

module.exports = {
  init,
  setToken,
  wasTokenRejected,
  flush,
  fetchLatestRelease,
  fetchLatestBranch,
  fetchLatestDir,
  fetchLatest,
};
