'use strict';

// Lokalisierung der Fehler-/Statusmeldungen aus dem Hauptprozess (die im
// Renderer angezeigt werden). Die aktive Sprache wird von main.js aus den
// Einstellungen gesetzt (setLang) und bei Sprachwechsel aktualisiert.

// Unterstützte Sprachen und die Locale für Datums- und Zeitformate.
// Eine weitere Sprache braucht hier nur einen Eintrag mehr.
const LOCALES = { de: 'de-DE', en: 'en-GB' };
const FALLBACK = 'de';

let lang = FALLBACK;

function setLang(value) {
  lang = LOCALES[value] ? value : FALLBACK;
}

function getLang() {
  return lang;
}

function getLocale() {
  return LOCALES[lang] || LOCALES[FALLBACK];
}

const M = {
  'err.tokenInvalid': {
    de: 'GitHub-Token ungültig. Bitte im Token-Feld prüfen oder leeren.',
    en: 'GitHub token invalid. Please check or clear it in the token field.',
  },
  'err.rateLimit': {
    de: 'GitHub-Rate-Limit erreicht{0}. Tipp: kostenloses GitHub-Token hinterlegen (5.000 statt 60 Abfragen/Stunde).',
    en: 'GitHub rate limit reached{0}. Tip: add a free GitHub token (5,000 instead of 60 requests/hour).',
  },
  'err.resetAt': {
    de: ', Reset um {0} Uhr',
    en: ', resets at {0}',
  },
  'err.rejected403': {
    de: 'GitHub hat die Anfrage abgelehnt (403).',
    en: 'GitHub rejected the request (403).',
  },
  'err.httpStatus': {
    de: 'GitHub antwortete mit Status {0}',
    en: 'GitHub responded with status {0}',
  },
  'err.folderNotEmpty': {
    de: 'Der Ordner "{0}" ist nicht leer und wurde nicht vom HATS Builder erstellt. Bitte einen leeren Ordner wählen, damit keine fremden Dateien gelöscht werden.',
    en: 'The folder "{0}" is not empty and was not created by HATS Builder. Please choose an empty folder so no unrelated files get deleted.',
  },
  'err.zipSlip': {
    de: 'Archiv enthält einen unzulässigen Pfad (Zip-Slip abgewehrt).',
    en: 'Archive contains an invalid path (zip-slip blocked).',
  },
  'err.stripMissing': {
    de: 'ZIP enthält den erwarteten Ordner "{0}" nicht.',
    en: 'ZIP does not contain the expected folder "{0}".',
  },
  'err.noAsset': {
    de: '{0}: Kein passendes Release-Asset gefunden (erwartet: {1}). Eventuell hat sich das Release-Format geändert.',
    en: '{0}: No matching release asset found (expected: {1}). The release format may have changed.',
  },
  'err.downloadFailed': {
    de: 'Download von {0} fehlgeschlagen (HTTP {1})',
    en: 'Download of {0} failed (HTTP {1})',
  },
  'err.invalidDrive': {
    de: 'Ungültiges Laufwerk: {0}',
    en: 'Invalid drive: {0}',
  },
  'err.driveUnavailable': {
    de: 'Laufwerk {0} ist nicht verfügbar.',
    en: 'Drive {0} is not available.',
  },
  'err.buildRunning': {
    de: 'Es läuft bereits ein Build.',
    en: 'A build is already running.',
  },
  'err.copyRunning': {
    de: 'Es läuft bereits ein Kopiervorgang.',
    en: 'A copy is already in progress.',
  },
  'err.updateRunning': {
    de: 'Das Update wird bereits heruntergeladen.',
    en: 'The update is already downloading.',
  },
  'err.noPack': {
    de: 'Im Zielordner liegt kein fertiges Pack. Bitte zuerst das Pack erstellen.',
    en: 'There is no finished pack in the target folder. Please create the pack first.',
  },
};

function mt(key, ...args) {
  const entry = M[key];
  let s = entry ? entry[lang] || entry[FALLBACK] : key;
  args.forEach((a, i) => {
    s = s.split(`{${i}}`).join(String(a));
  });
  return s;
}

module.exports = { setLang, getLang, getLocale, mt };
