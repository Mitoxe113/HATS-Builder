'use strict';

// Erzeugt bootloader/hekate_ipl.ini aus den Einstellungen des Config-Tabs.
// Referenz: https://github.com/CTCaer/hekate#hekate_iplini-configuration

const DEFAULT_HEKATE = {
  autoboot: '',       // '' = Boot-Menü anzeigen, sonst SCHLÜSSEL des Eintrags (z. B. 'semistock')
  bootwait: 3,        // Sekunden, die das Boot-Logo angezeigt wird (0-20)
  autohosoff: false,  // Konsole komplett ausschalten statt Sleep, wenn per HOS ausgeschaltet
  autonogc: true,     // Gamecard-Slot automatisch schützen, wenn Firmware zu neu für Fuses
  updater2p: false,   // Hekate erlaubt Updates über bootloader/update.bin
  bootprotect: false, // Boot-Dateien vor Überschreiben schützen
  blockNintendoEmu: true,  // Nintendo-Server blocken auf emuMMC (atmosphere/hosts/emummc.txt)
  blockNintendoSys: false, // Nintendo-Server blocken auf sysMMC (atmosphere/hosts/sysmmc.txt)
  entries: {
    cfw_emu:   { enabled: true,  name: 'CFW (emuMMC)' },
    cfw_sys:   { enabled: false, name: 'CFW (sysMMC)' },
    semistock: { enabled: true,  name: 'Semi-Stock' },
  },
};

// Reihenfolge der Einträge im Boot-Menü
const ENTRY_ORDER = ['cfw_emu', 'cfw_sys', 'semistock'];

const ENTRY_TEMPLATES = {
  cfw_emu: {
    hint: {
      de: 'Startet Atmosphère (CFW) direkt über Hekate, erzwungen auf der emuMMC (SD-Karte). Empfohlen.',
      en: 'Boots Atmosphère (CFW) directly via Hekate, forced on the emuMMC (SD card). Recommended.',
    },
    lines: [
      'fss0=atmosphere/package3',
      'kip1=atmosphere/kips/*',
      'emummcforce=1',
      'icon=bootloader/res/icon_payload.bmp',
    ],
  },
  cfw_sys: {
    hint: {
      de: 'Startet Atmosphère (CFW) direkt über Hekate, erzwungen auf der internen sysMMC.',
      en: 'Boots Atmosphère (CFW) directly via Hekate, forced on the internal sysMMC.',
    },
    lines: [
      'fss0=atmosphere/package3',
      'kip1=atmosphere/kips/*',
      'emummc_force_disable=1',
      'icon=bootloader/res/icon_payload.bmp',
    ],
  },
  // Semi-Stock: originale Firmware, aber über Atmosphères Secmon (exosphère)
  // gestartet (fss0=…/package3). "stock=1" deaktiviert alle CFW-Kips. Weil
  // exosphère statt des Original-secmon läuft, werden KEINE Fuses verbrannt.
  semistock: {
    hint: {
      de: 'OFW + Fuse-Prüfung übersprungen: originale Firmware über Atmosphère gestartet, verbrennt keine Fuses (Downgrade bleibt möglich). Kein CFW/Homebrew.',
      en: 'OFW + fuse check skipped: original firmware booted via Atmosphère, burns no fuses (downgrade stays possible). No CFW/homebrew.',
    },
    lines: [
      'fss0=atmosphere/package3',
      'stock=1',
      'emummc_force_disable=1',
      'icon=bootloader/res/icon_switch.bmp',
    ],
  },
};

// Hekates Boot-Menü rendert nur ASCII zuverlässig – Umlaute & Akzente umschreiben
const TRANSLIT = {
  ä: 'ae', ö: 'oe', ü: 'ue', Ä: 'Ae', Ö: 'Oe', Ü: 'Ue', ß: 'ss',
  à: 'a', á: 'a', â: 'a', è: 'e', é: 'e', ê: 'e', ì: 'i', í: 'i',
  ò: 'o', ó: 'o', ô: 'o', ù: 'u', ú: 'u', û: 'u', ñ: 'n', ç: 'c',
};

function toAscii(text) {
  return text
    .replace(/[äöüÄÖÜßàáâèéêìíòóôùúûñç]/g, (ch) => TRANSLIT[ch] || ch)
    .replace(/[^\x20-\x7e]/g, '');
}

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function normalize(config) {
  const c = { ...DEFAULT_HEKATE, ...(config || {}) };
  const entries = {};
  for (const key of ENTRY_ORDER) {
    const def = DEFAULT_HEKATE.entries[key];
    const given = (config && config.entries && config.entries[key]) || {};
    entries[key] = {
      enabled: typeof given.enabled === 'boolean' ? given.enabled : def.enabled,
      name: toAscii(String(given.name || def.name).replace(/[\[\]\r\n]/g, '')).trim().slice(0, 60) || def.name,
    };
  }
  c.entries = entries;

  const boolOr = (v, def) => (typeof v === 'boolean' ? v : def);
  c.blockNintendoEmu = boolOr(config && config.blockNintendoEmu, DEFAULT_HEKATE.blockNintendoEmu);
  c.blockNintendoSys = boolOr(config && config.blockNintendoSys, DEFAULT_HEKATE.blockNintendoSys);

  c.bootwait = clampInt(c.bootwait, 0, 20, DEFAULT_HEKATE.bootwait);

  // Autoboot wird intern als Eintrags-SCHLÜSSEL gespeichert (nicht als Position),
  // damit das Aktivieren/Deaktivieren anderer Einträge das Ziel nicht verschiebt.
  const enabledKeys = ENTRY_ORDER.filter((k) => entries[k].enabled);
  const raw = config ? config.autoboot : undefined;
  if (typeof raw === 'number') {
    // Migration alter Einstellungen: 1-basierter Index → Schlüssel
    c.autoboot = raw >= 1 && raw <= enabledKeys.length ? enabledKeys[raw - 1] : '';
  } else if (typeof raw === 'string' && enabledKeys.includes(raw)) {
    c.autoboot = raw;
  } else {
    c.autoboot = '';
  }
  return c;
}

function generateIni(config) {
  const c = normalize(config);
  const bool = (v) => (v ? '1' : '0');

  // Schlüssel → 1-basierter Index unter den aktiven Einträgen (Hekate-Format)
  const enabledKeys = ENTRY_ORDER.filter((k) => c.entries[k].enabled);
  const autobootIndex = c.autoboot ? enabledKeys.indexOf(c.autoboot) + 1 : 0;

  const lines = [
    '# Erstellt mit HATS Builder',
    '[config]',
    `autoboot=${autobootIndex}`,
    'autoboot_list=0',
    `bootwait=${c.bootwait}`,
    'backlight=100', // fester Hekate-Standard (Helligkeit nicht mehr einstellbar)
    `autohosoff=${bool(c.autohosoff)}`,
    `autonogc=${bool(c.autonogc)}`,
    `updater2p=${bool(c.updater2p)}`,
    `bootprotect=${bool(c.bootprotect)}`,
    '',
  ];

  for (const key of ENTRY_ORDER) {
    const entry = c.entries[key];
    if (!entry.enabled) continue;
    lines.push(`[${entry.name}]`, ...ENTRY_TEMPLATES[key].lines, '');
  }

  return lines.join('\r\n');
}

module.exports = { DEFAULT_HEKATE, ENTRY_ORDER, ENTRY_TEMPLATES, normalize, generateIni };
