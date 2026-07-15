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
    description: 'Die Custom Firmware selbst – inklusive Homebrew Loader und Homebrew-Menü.',
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
    description: 'Bootloader mit grafischem Boot-Menü (Nyx), NAND-Backups und emuMMC-Verwaltung.',
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
    description: 'Homebrew-Apps direkt auf der Switch durchsuchen, installieren und aktualisieren.',
    assets: [{ match: /^appstore\.nro$/, action: 'copy', target: 'switch/appstore/appstore.nro' }],
  },
  {
    id: 'jksv',
    name: 'JKSV',
    repo: 'J-D-K/JKSV',
    category: 'apps',
    defaultOn: true,
    description: 'Spielstände sichern und wiederherstellen – das Standard-Tool für Save-Backups.',
    assets: [{ match: /^JKSV\.nro$/, action: 'copy', target: 'switch/JKSV.nro' }],
  },
  {
    id: 'ftpd',
    name: 'ftpd',
    repo: 'mtheall/ftpd',
    category: 'apps',
    description: 'FTP-Server auf der Switch – Dateien kabellos vom PC auf die SD-Karte übertragen.',
    assets: [{ match: /^ftpd\.nro$/, action: 'copy', target: 'switch/ftpd.nro' }],
  },
  {
    id: 'nxshell',
    name: 'NX-Shell',
    repo: 'joel16/NX-Shell',
    category: 'apps',
    description: 'Dateimanager für die Switch – Dateien direkt auf der Konsole verwalten.',
    assets: [{ match: /^NX-Shell\.nro$/, action: 'copy', target: 'switch/NX-Shell.nro' }],
  },
  {
    id: 'edizon',
    name: 'EdiZon',
    repo: 'WerWolv/EdiZon',
    category: 'apps',
    description: 'Spielstand-Editor und Backup-Tool (App). Das passende Overlay ist separat wählbar.',
    assets: [{ match: /^EdiZon\.nro$/, action: 'copy', target: 'switch/EdiZon.nro' }],
  },
  {
    id: 'goldleaf',
    name: 'Goldleaf',
    repo: 'XorTroll/Goldleaf',
    category: 'apps',
    description: 'Titel- und Dateimanager: NSPs installieren, Saves verwalten, USB-Übertragung (Quark).',
    assets: [{ match: /^Goldleaf\.nro$/, action: 'copy', target: 'switch/Goldleaf.nro' }],
  },
  {
    id: 'dbi',
    name: 'DBI (English)',
    repo: 'rashevskyv/DBIPatcher',
    category: 'apps',
    description: 'Titel-/Save-Manager und Installer – englisch gepatchte Version von DBI.',
    assets: [{ match: /^DBI\.nro$/, action: 'copy', target: 'switch/DBI.nro' }],
  },
  {
    id: 'sphaira',
    name: 'Sphaira',
    repo: 'ITotalJustice/sphaira',
    category: 'apps',
    description: 'Moderner Homebrew-Menü-Ersatz mit integriertem App-Store und Dateibrowser.',
    assets: [{ match: /^sphaira\.zip$/, action: 'extract', target: '' }],
  },
  {
    id: 'cyberfoil',
    name: 'CyberFoil',
    repo: 'luketanti/CyberFoil',
    category: 'apps',
    description: 'Homebrew-Titel-Installer von luketanti (wird nach switch/CyberFoil/ installiert).',
    assets: [{ match: /^cyberfoil\.zip$/, action: 'extract', target: '' }],
  },
  {
    id: 'dns90',
    name: 'Switch 90DNS Tester',
    repo: 'meganukebmp/Switch_90DNS_tester',
    category: 'apps',
    description: 'Prüft, ob 90DNS die Verbindung zu Nintendos Servern zuverlässig blockiert.',
    assets: [{ match: /^Switch_90DNS_tester\.nro$/, action: 'copy', target: 'switch/Switch_90DNS_tester.nro' }],
  },

  // ── System-Module ────────────────────────────────────────────────────────
  {
    id: 'ovlloader',
    name: 'nx-ovlloader',
    repo: 'WerWolv/nx-ovlloader',
    category: 'sysmodules',
    description: 'Basis für alle Tesla-Overlays – wird von jedem Overlay benötigt.',
    assets: [{ match: /^nx-ovlloader\.zip$/, action: 'extract', target: '' }],
  },
  {
    id: 'sysclk',
    name: 'sys-clk (Basis)',
    repo: 'retronx-team/sys-clk',
    category: 'sysmodules',
    requires: ['ovlloader'],
    description: 'System-Modul für CPU/GPU/RAM-Übertaktung pro Spiel (offizielle Basis-Version).',
    assets: [{ match: /^sys-clk-.*\.zip$/, action: 'extract', target: '' }],
  },
  {
    id: 'syspatch',
    name: 'sys-patch',
    repo: 'borntohonk/sys-patch',
    category: 'sysmodules',
    tag: 'sigpatch',
    description: 'Patcht Signaturprüfungen zur Laufzeit (Ersatz für statische Sigpatches).',
    assets: [{ match: /^sys-patch-.*\.zip$/, action: 'extract', target: '' }],
  },
  {
    id: 'emuiibo',
    name: 'emuiibo',
    repo: 'XorTroll/emuiibo',
    category: 'sysmodules',
    requires: ['ovlloader'],
    description: 'Amiibo-Emulation – virtuelle Amiibos erstellen und nutzen (inkl. Overlay).',
    assets: [{ match: /^emuiibo\.zip$/, action: 'extract', target: '', stripPrefix: 'SdOut/' }],
  },
  {
    id: 'saltynx',
    name: 'SaltyNX',
    repo: 'masagrator/SaltyNX',
    category: 'sysmodules',
    description: 'Plugin-Loader für Spiele (Basis u. a. für FPSLocker/NX-FPS).',
    assets: [{ match: /^SaltyNX\.zip$/, action: 'extract', target: '' }],
  },
  {
    id: 'missioncontrol',
    name: 'MissionControl',
    repo: 'ndeadly/MissionControl',
    category: 'sysmodules',
    description: 'Controller anderer Konsolen (PS4/PS5, Xbox, Wii U …) per Bluetooth nutzen.',
    assets: [{ match: /^MissionControl-.*\.zip$/, action: 'extract', target: '' }],
  },

  // ── Tesla-Overlays ───────────────────────────────────────────────────────
  {
    id: 'ultrahand',
    name: 'Ultrahand Overlay',
    repo: 'ppkantorski/Ultrahand-Overlay',
    category: 'overlays',
    requires: ['ovlloader'],
    description: 'Overlay-Menü (L + Steuerkreuz runter + rechter Stick drücken) mit vielen Zusatzfunktionen.',
    assets: [{ match: /^sdout\.zip$/, action: 'extract', target: '' }],
  },
  {
    id: 'edizonovl',
    name: 'EdiZon Overlay',
    repo: 'proferabg/EdiZon-Overlay',
    category: 'overlays',
    requires: ['ovlloader'],
    description: 'Aktiv gepflegtes EdiZon-Overlay: Cheats im Spiel ein-/ausschalten.',
    assets: [{ match: /^ovlEdiZon\.ovl$/, action: 'copy', target: 'switch/.overlays/ovlEdiZon.ovl' }],
  },
  {
    id: 'fpslocker',
    name: 'FPSLocker',
    repo: 'masagrator/FPSLocker',
    category: 'overlays',
    requires: ['ovlloader', 'saltynx'],
    description: 'FPS in Spielen begrenzen/entsperren (benötigt SaltyNX).',
    assets: [{ match: /^FPSLocker\.ovl$/, action: 'copy', target: 'switch/.overlays/FPSLocker.ovl' }],
  },
  {
    id: 'quickntp',
    name: 'QuickNTP',
    repo: 'nedex/QuickNTP',
    category: 'overlays',
    requires: ['ovlloader'],
    description: 'Uhrzeit der Switch schnell per NTP synchronisieren (z. B. für 90DNS/Online).',
    assets: [{ match: /^sdout\.zip$/, action: 'extract', target: '' }],
  },
  {
    id: 'statusdeux',
    name: 'Status Monitor Deux',
    repo: 'masagrator/Status-Monitor-Deux',
    category: 'overlays',
    requires: ['ovlloader'],
    description: 'FPS, Temperaturen, Auslastung und Taktraten live im Spiel anzeigen.',
    assets: [{ match: /^Status-Monitor-Deux\.zip$/, action: 'extract', target: '' }],
  },
  {
    id: 'ovlsysmodules',
    name: 'Sysmodules Overlay',
    repo: 'ppkantorski/ovl-sysmodules',
    category: 'overlays',
    requires: ['ovlloader'],
    description: 'System-Module direkt im Overlay ein- und ausschalten.',
    assets: [{ match: /^ovlSysmodules\.ovl$/, action: 'copy', target: 'switch/.overlays/ovlSysmodules.ovl' }],
  },
  {
    id: 'sysclkovl',
    name: 'sys-clk Overlay',
    repo: 'ppkantorski/sys-clk',
    category: 'overlays',
    requires: ['ovlloader', 'sysclk'],
    description: 'Erweitertes Übertaktungs-Overlay (ersetzt das Overlay der sys-clk-Basis).',
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
    description: 'RCM-Payload zum Auslesen der eigenen Konsolen-Schlüssel (über Hekate → Payloads).',
    assets: [{ match: /^Lockpick_RCM\.bin$/, action: 'copy', target: 'bootloader/payloads/Lockpick_RCM.bin' }],
  },
  {
    id: 'hatstools',
    name: 'HATS-Tools',
    repo: 'sthetix/HATS-Tools',
    category: 'tools',
    tag: 'thirdparty',
    description: 'Konfigurations- und Wartungstools von sthetix (Drittanbieter-Pack).',
    assets: [{ match: /^hats-tools-.*\.zip$/, action: 'extract', target: '' }],
  },
  {
    id: 'themepatches',
    name: 'Theme-Patches',
    repo: 'exelix11/theme-patches',
    source: 'branch',
    branch: 'master',
    category: 'tools',
    description: 'Layout-Patches (Quelldateien) von exelix11 für Custom-Themes – landen unter /themes.',
    assets: [
      { match: /\.zip$/, action: 'extract', target: 'themes', stripPrefix: 'theme-patches-master/' },
    ],
  },
];

const CATEGORIES = [
  { id: 'core', name: 'Basis', hint: 'Pflicht – ohne diese beiden läuft nichts' },
  { id: 'apps', name: 'Homebrew-Apps', hint: 'Apps für das Homebrew-Menü' },
  { id: 'sysmodules', name: 'System-Module', hint: 'Laufen im Hintergrund' },
  { id: 'overlays', name: 'Tesla-Overlays', hint: 'Im Spiel aufrufbar – brauchen nx-ovlloader und ein Overlay-Menü' },
  { id: 'tools', name: 'Tools & Extras', hint: 'Payloads und Zusatzwerkzeuge' },
];

module.exports = { COMPONENTS, CATEGORIES };
