'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { COMPONENTS, CATEGORIES } = require('./components');
const github = require('./github');
const builder = require('./builder');
const sd = require('./sd');
const updater = require('./updater');
const messages = require('./messages');
const { mt } = messages;
const { DEFAULT_HEKATE, ENTRY_ORDER, ENTRY_TEMPLATES, generateIni, normalize } = require('./hekate');

let win = null;
let building = false;
let copying = false;
let downloadingUpdate = false;
let buildAbort = null;
let copyAbort = null;

// ── Einstellungen (persistiert in userData/settings.json) ───────────────────
function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

// Ordner, aus dem das Programm gestartet wurde:
// portable EXE → Ordner der EXE (die Portable-Hülle entpackt nach %TEMP%,
// setzt aber PORTABLE_EXECUTABLE_DIR auf den echten Ort), installierte App →
// Installationsordner, Entwicklungsmodus → Projektordner.
function appBaseDir() {
  if (process.env.PORTABLE_EXECUTABLE_DIR) return process.env.PORTABLE_EXECUTABLE_DIR;
  if (app.isPackaged) return path.dirname(process.execPath);
  return app.getAppPath();
}

// Ohne eigene Wahl landet das Pack auf dem Desktop. Dort findet man es
// zuverlässig wieder, anders als im Ordner der EXE, die auch im
// Download-Verzeichnis liegen kann.
function defaultOutputDir() {
  return path.join(app.getPath('desktop'), 'Switch-SD-Pack');
}

// Das Pack braucht einen eigenen Ordner. Wählt jemand den Desktop, die
// Dokumente oder gleich ein Laufwerk aus, wird darin ein Unterordner angelegt,
// statt zwischen die vorhandenen Dateien zu schreiben.
function packFolder(dir) {
  if (!dir) return defaultOutputDir();
  const ziel = path.resolve(dir);
  const istLaufwerk = /^[a-z]:\\?$/i.test(ziel);
  const sammelordner = ['desktop', 'documents', 'downloads', 'home', 'music', 'pictures', 'videos']
    .map((k) => {
      try {
        return path.resolve(app.getPath(k)).toLowerCase();
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  if (istLaufwerk || sammelordner.includes(ziel.toLowerCase())) {
    return path.join(ziel, 'Switch-SD-Pack');
  }
  return ziel;
}

function defaultSettings() {
  return {
    selected: COMPONENTS.filter((c) => c.defaultOn).map((c) => c.id),
    hekate: DEFAULT_HEKATE,
    outputDir: defaultOutputDir(),
    outputDirCustom: false, // true, sobald der Nutzer bewusst „Ändern“ gewählt hat
    githubToken: '',
    language: 'de', // 'de' | 'en'
    windowBounds: null, // zuletzt genutzte Fenstergröße und -position
  };
}

// Diese Einstellungen setzt „Zurücksetzen“ auf den Auslieferungszustand.
// Token, Sprache und Fenstergröße bleiben bewusst erhalten.
function resettableDefaults() {
  const d = defaultSettings();
  return {
    selected: d.selected,
    hekate: d.hekate,
    outputDir: d.outputDir,
    outputDirCustom: false,
  };
}

function loadSettings() {
  const defaults = defaultSettings();
  let settings;
  try {
    settings = { ...defaults, ...JSON.parse(fs.readFileSync(settingsPath(), 'utf8')) };
  } catch {
    return defaults;
  }
  // Solange kein eigener Ordner gewählt wurde, immer dem aktuellen
  // Programm-Standort folgen (wichtig für die portable EXE beim Verschieben).
  if (!settings.outputDirCustom) settings.outputDir = defaults.outputDir;
  // Auch ein früher gespeicherter Sammelordner bekommt seinen Unterordner
  else settings.outputDir = packFolder(settings.outputDir);
  // Hekate-Config auf das aktuelle Eintrags-Schema bringen (alte Schlüssel wie
  // fusee/stock aus früheren Versionen fallen weg, neue bekommen Defaults).
  settings.hekate = normalize(settings.hekate);
  return settings;
}

function saveSettings(partial) {
  const merged = { ...loadSettings(), ...partial };
  fs.writeFileSync(settingsPath(), JSON.stringify(merged, null, 2));
  return merged;
}

// Gemerkte Fenstergröße nur übernehmen, wenn sie auf einem aktuell
// angeschlossenen Bildschirm liegt. Sonst startet das Fenster im Nichts.
function savedBounds() {
  const b = loadSettings().windowBounds;
  if (!b || !Number.isFinite(b.width) || !Number.isFinite(b.height)) return null;
  if (!Number.isFinite(b.x) || !Number.isFinite(b.y)) return { width: b.width, height: b.height };
  // Eine Überschneidung von einem Pixel reicht nicht. Es muss so viel zu sehen
  // sein, dass man das Fenster an der Titelleiste noch greifen kann.
  const genugSichtbar = screen.getAllDisplays().some((d) => {
    const a = d.workArea;
    const breite = Math.min(b.x + b.width, a.x + a.width) - Math.max(b.x, a.x);
    const hoehe = Math.min(b.y + b.height, a.y + a.height) - Math.max(b.y, a.y);
    return breite >= 200 && hoehe >= 100;
  });
  return genugSichtbar ? b : { width: b.width, height: b.height };
}

// ── Fenster ──────────────────────────────────────────────────────────────────
function createWindow() {
  const bounds = savedBounds();
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    ...(bounds || {}),
    minWidth: 1020,
    minHeight: 700,
    show: false,
    backgroundColor: '#0b0e14',
    title: 'HATS Builder',
    icon: path.join(__dirname, '..', 'renderer', 'icon.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0b0e14', symbolColor: '#8b95a7', height: 42 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  // Fenstergröße für den nächsten Start merken. getNormalBounds liefert die
  // Größe im nicht maximierten Zustand, sonst käme immer der Vollbild-Wert.
  win.on('close', () => {
    try {
      saveSettings({ windowBounds: win.getNormalBounds() });
    } catch {
      /* nicht kritisch */
    }
  });

  // Test-Modi (nur mit HATS_SMOKE-Umgebungsvariable aktiv)
  if (process.env.HATS_SMOKE) {
    if (process.env.HATS_DIAG_FILE) {
      try {
        fs.writeFileSync(
          process.env.HATS_DIAG_FILE,
          JSON.stringify({ baseDir: appBaseDir(), outputDir: defaultOutputDir(), packaged: app.isPackaged })
        );
      } catch {
        /* Diagnose ist optional */
      }
    }
    require('./devtest').register(win, app);
  }
}

// ── IPC ──────────────────────────────────────────────────────────────────────
function sendProgress(event) {
  if (win && !win.isDestroyed()) win.webContents.send('progress', event);
}

function registerIpc() {
  ipcMain.handle('app:init', () => ({
    components: COMPONENTS.map(({ assets, ...c }) => c),
    categories: CATEGORIES,
    entryOrder: ENTRY_ORDER,
    entryHints: Object.fromEntries(
      Object.entries(ENTRY_TEMPLATES).map(([k, v]) => [k, v.hint])
    ),
    settings: loadSettings(),
    version: app.getVersion(),
    // Nur im Testlauf: erlaubt dem Renderer, seinen Zustand nach außen zu geben
    testMode: Boolean(process.env.HATS_SMOKE),
  }));

  ipcMain.handle('settings:save', (_e, partial) => {
    const merged = saveSettings(partial);
    github.setToken(merged.githubToken);
    messages.setLang(merged.language);
    return merged;
  });

  ipcMain.handle('releases:check', async (_e, { force }) => {
    const results = {};
    await Promise.all(
      COMPONENTS.map(async (c) => {
        try {
          const r = await github.fetchLatest(c, { force });
          results[c.id] = { ok: true, ...r };
        } catch (err) {
          results[c.id] = { ok: false, error: err.message, rateLimited: !!err.rateLimited };
        }
      })
    );
    return results;
  });

  ipcMain.handle('hekate:preview', (_e, config) => generateIni(config));

  ipcMain.handle('pack:chooseOutput', async () => {
    const result = await dialog.showOpenDialog(win, {
      title: 'Zielordner für das SD-Pack wählen',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    // Wer den Desktop wählt, meint einen Ordner darauf, nicht den Desktop selbst
    const ziel = packFolder(result.filePaths[0]);
    saveSettings({ outputDir: ziel, outputDirCustom: true });
    return ziel;
  });

  ipcMain.handle('pack:build', async (_e, { outputDir, selectedIds, hekateConfig }) => {
    if (building) throw new Error(mt('err.buildRunning'));
    const ziel = packFolder(outputDir);
    building = true;
    buildAbort = new AbortController();
    try {
      const summary = await builder.buildPack(
        { outputDir: ziel, selectedIds, hekateConfig, signal: buildAbort.signal },
        sendProgress
      );
      saveSettings({ outputDir: ziel, selected: selectedIds, hekate: hekateConfig });
      return summary;
    } finally {
      building = false;
      buildAbort = null;
    }
  });

  ipcMain.handle('pack:cancel', () => {
    if (buildAbort) buildAbort.abort();
  });

  ipcMain.handle('pack:info', (_e, dir) => {
    const info = builder.readPackInfo(dir);
    // Den Hinweistext gibt es nur hier, damit er nicht doppelt gepflegt wird
    if (info && info.complete === false) info.incompleteMessage = mt('err.packIncomplete');
    return info;
  });

  ipcMain.handle('settings:reset', () => {
    const merged = saveSettings(resettableDefaults());
    return merged;
  });

  ipcMain.handle('sd:list', () => sd.listDrives());

  ipcMain.handle('sd:preview', (_e, { packDir, driveLetter }) => {
    try {
      return sd.previewCopy(packDir, driveLetter);
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('sd:copy', async (_e, { packDir, driveLetter }) => {
    if (copying) throw new Error(mt('err.copyRunning'));
    const info = builder.readPackInfo(packDir);
    // Ein abgebrochener Build hinterlässt einen Marker mit complete:false.
    // So ein halbes Pack darf nicht auf die Karte.
    if (!info || info.complete === false) {
      throw new Error(mt(info ? 'err.packIncomplete' : 'err.noPack'));
    }
    copying = true;
    copyAbort = new AbortController();
    try {
      return await sd.copyToDrive(packDir, driveLetter, sendProgress, copyAbort.signal);
    } finally {
      copying = false;
      copyAbort = null;
    }
  });

  ipcMain.handle('sd:cancel', () => {
    if (copyAbort) copyAbort.abort();
  });

  // ── Selbst-Update ─────────────────────────────────────────────────────────
  ipcMain.handle('update:check', async () => {
    try {
      return await updater.check(app.getVersion(), Boolean(process.env.PORTABLE_EXECUTABLE_DIR));
    } catch (err) {
      // Kein Netz, privates Repo ohne Token o. Ä.: leise scheitern, kein Banner
      return { available: false, error: err.message };
    }
  });

  ipcMain.handle('update:download', async (_e, asset) => {
    if (downloadingUpdate) throw new Error(mt('err.updateRunning'));
    downloadingUpdate = true;
    try {
      return await updater.download(asset, app.getPath('downloads'), sendProgress);
    } finally {
      downloadingUpdate = false;
    }
  });

  ipcMain.handle('update:reveal', (_e, file) => {
    if (file && fs.existsSync(file)) shell.showItemInFolder(file);
  });

  // Spielt das geladene Update ein und startet die App neu. Mitten in einem
  // Build oder einer Kopie wird das abgelehnt, sonst bliebe etwas Halbes zurück.
  ipcMain.handle('update:install', async (_e, file) => {
    if (building || copying || downloadingUpdate) throw new Error(mt('err.updateBusy'));
    await updater.install(file, app);
    return true;
  });

  ipcMain.handle('shell:openExternal', (_e, url) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
  });

  ipcMain.handle('shell:openPath', (_e, dir) => {
    if (fs.existsSync(dir)) shell.openPath(dir);
  });
}

app.whenReady().then(() => {
  const startup = loadSettings();
  github.init(app.getPath('userData'));
  github.setToken(startup.githubToken);
  messages.setLang(startup.language);
  builder.init(app.getPath('userData'));
  registerIpc();
  createWindow();
});

app.on('window-all-closed', () => app.quit());
// Ausstehenden (gebündelten) Cache-Schreibvorgang vor dem Beenden sichern
app.on('will-quit', () => {
  try {
    github.flush();
  } catch {
    /* Cache ist optional */
  }
});
