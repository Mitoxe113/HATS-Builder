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
  'err.cancelled': {
    de: 'Abgebrochen.',
    en: 'Cancelled.',
  },
  'err.notEnoughSpace': {
    de: 'Auf der Karte ist zu wenig Platz. Gebraucht werden {0}, frei sind {1}.',
    en: 'Not enough space on the card. {0} needed, {1} free.',
  },
  'err.updateMissing': {
    de: 'Die heruntergeladene Datei ist nicht mehr da. Bitte das Update noch einmal laden.',
    en: 'The downloaded file is gone. Please download the update again.',
  },
  'err.updateStartFailed': {
    de: 'Das Update konnte nicht gestartet werden. Die Datei liegt in deinen Downloads, du kannst sie von Hand ausführen.',
    en: 'The update could not be started. The file is in your downloads, you can run it manually.',
  },
  'err.updateNoTarget': {
    de: 'Die laufende EXE konnte nicht gefunden werden, das Update lässt sich so nicht einspielen.',
    en: 'Could not locate the running EXE, so the update cannot be applied this way.',
  },
  'err.updateBusy': {
    de: 'Es läuft gerade ein Vorgang. Bitte erst abwarten, dann neu starten.',
    en: 'Something is still running. Please wait for it to finish, then restart.',
  },
  'err.badUpdateUrl': {
    de: 'Unerwartete Download-Adresse, das Update wurde abgebrochen.',
    en: 'Unexpected download address, the update was cancelled.',
  },
  'err.updateRunning': {
    de: 'Das Update wird bereits heruntergeladen.',
    en: 'The update is already downloading.',
  },
  'err.packIncomplete': {
    de: 'Das Pack im Zielordner ist unvollständig, der letzte Build wurde abgebrochen. Bitte erst neu erstellen.',
    en: 'The pack in the target folder is incomplete, the last build was cancelled. Please rebuild it first.',
  },
  'err.noPack': {
    de: 'Im Zielordner liegt kein fertiges Pack. Bitte zuerst das Pack erstellen.',
    en: 'There is no finished pack in the target folder. Please create the pack first.',
  },

  // Fortschrittsprotokoll beim Bauen. Der Nutzer liest es mit, deshalb gehört
  // es genauso in beide Sprachen wie die Oberfläche.
  'log.checkVersions': {
    de: 'Ich frage die neuesten Versionen ab ({0} Komponenten) …',
    en: 'Checking the latest versions ({0} components) …',
  },
  'log.cached': {
    de: '{0} liegt schon im Zwischenspeicher',
    en: '{0} is already cached',
  },
  'log.prepareDir': {
    de: 'Zielordner wird vorbereitet: {0}',
    en: 'Preparing the target folder: {0}',
  },
  'log.extracting': {
    de: '{0}: {1} wird entpackt',
    en: '{0}: extracting {1}',
  },
  'log.copying': {
    de: '{0}: {1} wird kopiert',
    en: '{0}: copying {1}',
  },
  'log.iniWritten': {
    de: 'bootloader/hekate_ipl.ini geschrieben',
    en: 'bootloader/hekate_ipl.ini written',
  },
  'log.hostsWritten': {
    de: 'atmosphere/hosts/{0} geschrieben, Nintendos Server sind geblockt',
    en: 'atmosphere/hosts/{0} written, Nintendo servers are blocked',
  },
  'step.hekate': {
    de: 'Hekate-Konfiguration',
    en: 'Hekate configuration',
  },
  'dialog.chooseOutput': {
    de: 'Zielordner für das SD-Pack wählen',
    en: 'Choose the target folder for the SD pack',
  },
  'sd.noName': {
    de: 'Ohne Namen',
    en: 'Unnamed',
  },
  'sd.unknownFs': {
    de: 'unbekannt',
    en: 'unknown',
  },
  // Kommentar-Zeile ganz oben in der erzeugten hekate_ipl.ini. Steht auch in
  // der Live-Vorschau, gehört also genauso übersetzt wie der Rest.
  'ini.createdWith': {
    de: 'Erstellt mit HATS Builder',
    en: 'Created with HATS Builder',
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
