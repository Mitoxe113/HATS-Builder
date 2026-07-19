'use strict';

// Registry aller unterstützten Komponenten.
// Jede Komponente kommt AUSSCHLIESSLICH aus dem offiziellen GitHub-Repo des Entwicklers.
//
// Feldübersicht:
//   repo        – GitHub "owner/name"
//   source      – 'release' (Standard, neuestes Release) oder 'branch' (Branch-Archiv)
//   branch      – bei source:'branch' der Branch-Name
//   category    – Zuordnung zu einer CATEGORIES-Gruppe
//   required    – kann nicht abgewählt werden (Basis)
//   defaultOn   – standardmäßig aktiviert
//   requires    – IDs anderer Komponenten, die mit aktiviert werden müssen
//   conflicts   – IDs, die dieselbe Datei ersetzen (nur Warnung, kein Zwang)
//   tag         – optionales Label (z. B. 'sigpatch', 'thirdparty')
//   description – { de, en } zweisprachig
//   assets      – Regeln, welche Release-Dateien wohin kommen:
//       match       – RegExp auf den Asset-Namen
//       action      – 'extract' (ZIP entpacken) oder 'copy' (Datei kopieren)
//       target      – Zielpfad relativ zum SD-Root ('' = Root)
//       stripPrefix – (nur extract) führenden Ordner im ZIP abschneiden

const COMPONENTS = [
  // ── Basis ────────────────────────────────────────────────────────────────
  {
    id: 'atmosphere',
    name: 'Atmosphère',
    repo: 'Atmosphere-NX/Atmosphere',
    category: 'core',
    required: true,
    defaultOn: true,
    description: {
      de: 'Die Custom Firmware selbst – inklusive Homebrew Loader und Homebrew-Menü.',
      en: 'The custom firmware itself – including the Homebrew Loader and Homebrew menu.',
    },
    assets: [
      { match: /^atmosphere-.*\.zip$/, action: 'extract', target: '' },
      { match: /^fusee\.bin$/, action: 'copy', target: 'bootloader/payloads/fusee.bin' },
    ],
  },
  {
    id: 'hekate',
    name: 'Hekate + Nyx',
    repo: 'CTCaer/hekate',
    category: 'core',
    required: true,
    defaultOn: true,
    description: {
      de: 'Bootloader mit grafischem Boot-Menü (Nyx), NAND-Backups und emuMMC-Verwaltung.',
      en: 'Bootloader with a graphical boot menu (Nyx), NAND backups and emuMMC management.',
    },
    assets: [
      { match: /^hekate_ctcaer_[\d.]+_Nyx_[\d.]+\.zip$/, action: 'extract', target: '' },
      { match: /^hekate_ctcaer_[\d.]+\.bin$/, action: 'copy', target: 'payload.bin' },
      { match: /^hekate_ctcaer_[\d.]+\.bin$/, action: 'copy', target: 'bootloader/update.bin' },
    ],
    cleanupRoot: [/^hekate_ctcaer_[\d.]+\.bin$/],
  },

  // ── Homebrew-Apps ────────────────────────────────────────────────────────
  {
    id: 'hbappstore',
    name: 'Homebrew App Store',
    repo: 'fortheusers/hb-appstore',
    category: 'apps',
    defaultOn: true,
    description: {
      de: 'Homebrew-Apps direkt auf der Switch durchsuchen, installieren und aktualisieren.',
      en: 'Browse, install and update homebrew apps directly on the Switch.',
    },
    assets: [{ match: /^appstore\.nro$/, action: 'copy', target: 'switch/appstore/appstore.nro' }],
  },
  {
    id: 'jksv',
    name: 'JKSV',
    repo: 'J-D-K/JKSV',
    category: 'apps',
    defaultOn: true,
    description: {
      de: 'Spielstände sichern und wiederherstellen – das Standard-Tool für Save-Backups.',
      en: 'Back up and restore save data – the standard tool for save backups.',
    },
    assets: [{ match: /^JKSV\.nro$/, action: 'copy', target: 'switch/JKSV.nro' }],
  },
  {
    id: 'ftpd',
    name: 'ftpd',
    repo: 'mtheall/ftpd',
    category: 'apps',
    description: {
      de: 'FTP-Server auf der Switch – Dateien kabellos vom PC auf die SD-Karte übertragen.',
      en: 'FTP server on the Switch – transfer files wirelessly from your PC to the SD card.',
    },
    assets: [{ match: /^ftpd\.nro$/, action: 'copy', target: 'switch/ftpd.nro' }],
  },
  {
    id: 'nxshell',
    name: 'NX-Shell',
    repo: 'joel16/NX-Shell',
    category: 'apps',
    description: {
      de: 'Dateimanager für die Switch – Dateien direkt auf der Konsole verwalten.',
      en: 'File manager for the Switch – manage files directly on the console.',
    },
    assets: [{ match: /^NX-Shell\.nro$/, action: 'copy', target: 'switch/NX-Shell.nro' }],
  },
  {
    id: 'edizon',
    name: 'EdiZon',
    repo: 'WerWolv/EdiZon',
    category: 'apps',
    description: {
      de: 'Spielstand-Editor und Backup-Tool (App). Das passende Overlay ist separat wählbar.',
      en: 'Save editor and backup tool (app). The matching overlay is selectable separately.',
    },
    assets: [{ match: /^EdiZon\.nro$/, action: 'copy', target: 'switch/EdiZon.nro' }],
  },
  {
    id: 'goldleaf',
    name: 'Goldleaf',
    repo: 'XorTroll/Goldleaf',
    category: 'apps',
    description: {
      de: 'Titel- und Dateimanager: NSPs installieren, Saves verwalten, USB-Übertragung (Quark).',
      en: 'Title and file manager: install NSPs, manage saves, USB transfer (Quark).',
    },
    assets: [{ match: /^Goldleaf\.nro$/, action: 'copy', target: 'switch/Goldleaf.nro' }],
  },
  {
    id: 'dbi',
    name: 'DBI (English)',
    repo: 'rashevskyv/DBIPatcher',
    category: 'apps',
    description: {
      de: 'Titel-/Save-Manager und Installer – englisch gepatchte Version von DBI.',
      en: 'Title/save manager and installer – English-patched version of DBI.',
    },
    assets: [{ match: /^DBI\.nro$/, action: 'copy', target: 'switch/DBI.nro' }],
  },
  {
    id: 'sphaira',
    name: 'Sphaira',
    repo: 'ITotalJustice/sphaira',
    category: 'apps',
    description: {
      de: 'Moderner Homebrew-Menü-Ersatz mit integriertem App-Store und Dateibrowser.',
      en: 'Modern homebrew menu replacement with a built-in app store and file browser.',
    },
    assets: [{ match: /^sphaira\.zip$/, action: 'extract', target: '' }],
  },
  {
    id: 'cyberfoil',
    name: 'CyberFoil',
    repo: 'luketanti/CyberFoil',
    category: 'apps',
    description: {
      de: 'Homebrew-Titel-Installer von luketanti (wird nach switch/CyberFoil/ installiert).',
      en: 'Homebrew title installer by luketanti (installed to switch/CyberFoil/).',
    },
    assets: [{ match: /^cyberfoil\.zip$/, action: 'extract', target: '' }],
  },
  {
    id: 'dns90',
    name: 'Switch 90DNS Tester',
    repo: 'meganukebmp/Switch_90DNS_tester',
    category: 'apps',
    description: {
      de: 'Prüft, ob 90DNS die Verbindung zu Nintendos Servern zuverlässig blockiert.',
      en: "Checks whether 90DNS reliably blocks the connection to Nintendo's servers.",
    },
    assets: [{ match: /^Switch_90DNS_tester\.nro$/, action: 'copy', target: 'switch/Switch_90DNS_tester.nro' }],
  },
  {
    id: 'batterydesync',
    name: 'Battery Desync Fix',
    repo: 'CTCaer/battery_desync_fix_nx',
    category: 'apps',
    description: {
      de: 'Behebt eine falsch angezeigte Akkuladung nach Wechseln zwischen CFW/OFW (einmalig ausführen).',
      en: 'Fixes a mismatched battery percentage after switching between CFW/OFW (run once).',
    },
    assets: [{ match: /^battery_desync_fix_v[\d.]+\.nro$/, action: 'copy', target: 'switch/battery_desync_fix.nro' }],
  },
  {
    id: 'themeinjector',
    name: 'NXThemesInstaller',
    repo: 'exelix11/SwitchThemeInjector',
    category: 'apps',
    description: {
      de: 'Installiert Custom-Themes (.nxtheme) auf der Switch. Wird u. a. von Themezer-NX zum Installieren benötigt.',
      en: 'Installs custom themes (.nxtheme) on the Switch. Required e.g. by Themezer-NX to install them.',
    },
    assets: [{ match: /^NXThemesInstaller\.nro$/, action: 'copy', target: 'switch/NXThemesInstaller.nro' }],
  },
  {
    id: 'themezer',
    name: 'Themezer-NX',
    repo: 'suchmememanyskill/themezer-nx',
    category: 'apps',
    requires: ['themeinjector'],
    description: {
      de: 'Themes direkt von themezer.net auf der Switch durchsuchen und laden (Installation über NXThemesInstaller).',
      en: 'Browse and download themes from themezer.net right on the Switch (installs via NXThemesInstaller).',
    },
    assets: [{ match: /^themezer-nx\.nro$/, action: 'copy', target: 'switch/themezer-nx.nro' }],
  },

  // ── System-Module ────────────────────────────────────────────────────────
  {
    id: 'ovlloader',
    name: 'nx-ovlloader',
    repo: 'WerWolv/nx-ovlloader',
    category: 'sysmodules',
    description: {
      de: 'Basis für alle Tesla-Overlays – wird von jedem Overlay benötigt.',
      en: 'Base for all Tesla overlays – required by every overlay.',
    },
    assets: [{ match: /^nx-ovlloader\.zip$/, action: 'extract', target: '' }],
  },
  {
    id: 'sysclk',
    name: 'sys-clk (Basis)',
    repo: 'retronx-team/sys-clk',
    category: 'sysmodules',
    requires: ['ovlloader'],
    description: {
      de: 'System-Modul für CPU/GPU/RAM-Übertaktung pro Spiel (offizielle Basis-Version).',
      en: 'System module for per-game CPU/GPU/RAM overclocking (official base version).',
    },
    assets: [{ match: /^sys-clk-.*\.zip$/, action: 'extract', target: '' }],
  },
  {
    id: 'syspatch',
    name: 'sys-patch',
    repo: 'borntohonk/sys-patch',
    category: 'sysmodules',
    tag: 'sigpatch',
    description: {
      de: 'Patcht Signaturprüfungen zur Laufzeit (Ersatz für statische Sigpatches).',
      en: 'Patches signature checks at runtime (replacement for static sigpatches).',
    },
    assets: [{ match: /^sys-patch-.*\.zip$/, action: 'extract', target: '' }],
  },
  {
    id: 'emuiibo',
    name: 'emuiibo',
    repo: 'XorTroll/emuiibo',
    category: 'sysmodules',
    requires: ['ovlloader'],
    description: {
      de: 'Amiibo-Emulation – virtuelle Amiibos erstellen und nutzen (inkl. Overlay).',
      en: 'Amiibo emulation – create and use virtual amiibos (incl. overlay).',
    },
    assets: [{ match: /^emuiibo\.zip$/, action: 'extract', target: '', stripPrefix: 'SdOut/' }],
  },
  {
    id: 'saltynx',
    name: 'SaltyNX',
    repo: 'masagrator/SaltyNX',
    category: 'sysmodules',
    description: {
      de: 'Plugin-Loader für Spiele (Basis u. a. für FPSLocker/NX-FPS).',
      en: 'Plugin loader for games (base for e.g. FPSLocker/NX-FPS).',
    },
    assets: [{ match: /^SaltyNX\.zip$/, action: 'extract', target: '' }],
  },
  {
    id: 'missioncontrol',
    name: 'MissionControl',
    repo: 'ndeadly/MissionControl',
    category: 'sysmodules',
    description: {
      de: 'Controller anderer Konsolen (PS4/PS5, Xbox, Wii U …) per Bluetooth nutzen.',
      en: 'Use controllers from other consoles (PS4/PS5, Xbox, Wii U …) via Bluetooth.',
    },
    assets: [{ match: /^MissionControl-.*\.zip$/, action: 'extract', target: '' }],
  },

  // ── Tesla-Overlays ───────────────────────────────────────────────────────
  {
    id: 'ultrahand',
    name: 'Ultrahand Overlay',
    repo: 'ppkantorski/Ultrahand-Overlay',
    category: 'overlays',
    requires: ['ovlloader'],
    description: {
      de: 'Overlay-Menü (L + Steuerkreuz runter + rechter Stick drücken) mit vielen Zusatzfunktionen.',
      en: 'Overlay menu (L + D-pad down + press the right stick) with many extra features.',
    },
    assets: [{ match: /^sdout\.zip$/, action: 'extract', target: '' }],
  },
  {
    id: 'edizonovl',
    name: 'EdiZon Overlay',
    repo: 'proferabg/EdiZon-Overlay',
    category: 'overlays',
    requires: ['ovlloader'],
    description: {
      de: 'Aktiv gepflegtes EdiZon-Overlay: Cheats im Spiel ein-/ausschalten.',
      en: 'Actively maintained EdiZon overlay: toggle cheats in-game.',
    },
    assets: [{ match: /^ovlEdiZon\.ovl$/, action: 'copy', target: 'switch/.overlays/ovlEdiZon.ovl' }],
  },
  {
    id: 'fpslocker',
    name: 'FPSLocker',
    repo: 'masagrator/FPSLocker',
    category: 'overlays',
    requires: ['ovlloader', 'saltynx'],
    description: {
      de: 'FPS in Spielen begrenzen/entsperren (benötigt SaltyNX).',
      en: 'Limit/unlock FPS in games (requires SaltyNX).',
    },
    assets: [{ match: /^FPSLocker\.ovl$/, action: 'copy', target: 'switch/.overlays/FPSLocker.ovl' }],
  },
  {
    id: 'quickntp',
    name: 'QuickNTP',
    repo: 'nedex/QuickNTP',
    category: 'overlays',
    requires: ['ovlloader'],
    description: {
      de: 'Uhrzeit der Switch schnell per NTP synchronisieren (z. B. für 90DNS/Online).',
      en: 'Quickly sync the Switch clock via NTP (e.g. for 90DNS/online).',
    },
    assets: [{ match: /^sdout\.zip$/, action: 'extract', target: '' }],
  },
  {
    id: 'statusdeux',
    name: 'Status Monitor Deux',
    repo: 'masagrator/Status-Monitor-Deux',
    category: 'overlays',
    requires: ['ovlloader'],
    description: {
      de: 'FPS, Temperaturen, Auslastung und Taktraten live im Spiel anzeigen.',
      en: 'Show FPS, temperatures, load and clock speeds live in-game.',
    },
    assets: [{ match: /^Status-Monitor-Deux\.zip$/, action: 'extract', target: '' }],
  },
  {
    id: 'ovlsysmodules',
    name: 'Sysmodules Overlay',
    repo: 'ppkantorski/ovl-sysmodules',
    category: 'overlays',
    requires: ['ovlloader'],
    description: {
      de: 'System-Module direkt im Overlay ein- und ausschalten.',
      en: 'Toggle system modules directly from the overlay.',
    },
    assets: [{ match: /^ovlSysmodules\.ovl$/, action: 'copy', target: 'switch/.overlays/ovlSysmodules.ovl' }],
  },
  {
    id: 'sysclkovl',
    name: 'sys-clk Overlay',
    repo: 'ppkantorski/sys-clk',
    category: 'overlays',
    requires: ['ovlloader', 'sysclk'],
    description: {
      de: 'Erweitertes Übertaktungs-Overlay (ersetzt das Overlay der sys-clk-Basis).',
      en: 'Enhanced overclocking overlay (replaces the sys-clk base overlay).',
    },
    // Gleicher Dateiname wie das Overlay aus der sys-clk-Basis, damit es dieses
    // wirklich ERSETZT (sonst lägen zwei sys-clk-Overlays im Tesla-Menü)
    assets: [{ match: /^sys-clk-overlay\.ovl$/, action: 'copy', target: 'switch/.overlays/sys-clk-overlay.ovl' }],
  },

  // ── Tools & Extras ───────────────────────────────────────────────────────
  {
    id: 'lockpick',
    name: 'Lockpick_RCM',
    repo: 'saneki/Lockpick_RCM',
    category: 'tools',
    description: {
      de: 'RCM-Payload zum Auslesen der eigenen Konsolen-Schlüssel (über Hekate → Payloads).',
      en: 'RCM payload to dump your own console keys (via Hekate → Payloads).',
    },
    assets: [{ match: /^Lockpick_RCM\.bin$/, action: 'copy', target: 'bootloader/payloads/Lockpick_RCM.bin' }],
  },
  {
    id: 'hatstools',
    name: 'HATS-Tools',
    repo: 'sthetix/HATS-Tools',
    category: 'tools',
    description: {
      de: 'Konfigurations- und Wartungstools von sthetix (Drittanbieter-Pack).',
      en: 'Configuration and maintenance tools by sthetix (third-party pack).',
    },
    assets: [{ match: /^hats-tools-.*\.zip$/, action: 'extract', target: '' }],
  },
  {
    id: 'themepatches',
    name: 'Theme-Patches',
    repo: 'exelix11/theme-patches',
    source: 'branch',
    branch: 'master',
    category: 'tools',
    description: {
      de: 'Layout-Patches (Quelldateien) von exelix11 für Custom-Themes – landen unter /themes.',
      en: 'Layout patches (source files) by exelix11 for custom themes – placed under /themes.',
    },
    assets: [
      { match: /\.zip$/, action: 'extract', target: 'themes', stripPrefix: 'theme-patches-master/' },
    ],
  },
];

const CATEGORIES = [
  {
    id: 'core',
    name: { de: 'Basis', en: 'Base' },
    hint: { de: 'Pflicht – ohne diese beiden läuft nichts', en: 'Required – nothing works without these two' },
  },
  {
    id: 'apps',
    name: { de: 'Homebrew-Apps', en: 'Homebrew Apps' },
    hint: { de: 'Apps für das Homebrew-Menü', en: 'Apps for the homebrew menu' },
  },
  {
    id: 'sysmodules',
    name: { de: 'System-Module', en: 'System Modules' },
    hint: { de: 'Laufen im Hintergrund', en: 'Run in the background' },
  },
  {
    id: 'overlays',
    name: { de: 'Tesla-Overlays', en: 'Tesla Overlays' },
    hint: {
      de: 'Im Spiel aufrufbar – brauchen nx-ovlloader und ein Overlay-Menü',
      en: 'Accessible in-game – require nx-ovlloader and an overlay menu',
    },
  },
  {
    id: 'tools',
    name: { de: 'Tools & Extras', en: 'Tools & Extras' },
    hint: { de: 'Payloads und Zusatzwerkzeuge', en: 'Payloads and extra tools' },
  },
];

module.exports = { COMPONENTS, CATEGORIES };
