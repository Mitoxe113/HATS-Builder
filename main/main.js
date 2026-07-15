'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { COMPONENTS, CATEGORIES } = require('./components');
const github = require('./github');
const builder = require('./builder');
const sd = require('./sd');
const messages = require('./messages');
const { mt } = messages;
const { DEFAULT_HEKATE, ENTRY_ORDER, ENTRY_TEMPLATES, generateIni, normalize } = require('./hekate');

let win = null;
let building = false;
let copying = false;

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

function defaultOutputDir() {
  return path.join(appBaseDir(), 'Switch-SD-Pack');
}

function defaultSettings() {
  return {
    selected: COMPONENTS.filter((c) => c.defaultOn).map((c) => c.id),
    hekate: DEFAULT_HEKATE,
    outputDir: defaultOutputDir(),
    outputDirCustom: false, // true, sobald der Nutzer bewusst „Ändern“ gewählt hat
    githubToken: '',
    language: 'de', // 'de' | 'en'
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

// ── Fenster ──────────────────────────────────────────────────────────────────
function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
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
    saveSettings({ outputDir: result.filePaths[0], outputDirCustom: true });
    return result.filePaths[0];
  });

  ipcMain.handle('pack:build', async (_e, { outputDir, selectedIds, hekateConfig }) => {
    if (building) throw new Error(mt('err.buildRunning'));
    building = true;
    try {
      const summary = await builder.buildPack(
        { outputDir, selectedIds, hekateConfig },
        sendProgress
      );
      saveSettings({ outputDir, selected: selectedIds, hekate: hekateConfig });
      return summary;
    } finally {
      building = false;
    }
  });

  ipcMain.handle('pack:info', (_e, dir) => builder.readPackInfo(dir));

  ipcMain.handle('sd:list', () => sd.listDrives());

  ipcMain.handle('sd:copy', async (_e, { packDir, driveLetter }) => {
    if (copying) throw new Error(mt('err.copyRunning'));
    if (!builder.readPackInfo(packDir)) {
      throw new Error(mt('err.noPack'));
    }
    copying = true;
    try {
      return await sd.copyToDrive(packDir, driveLetter, sendProgress);
    } finally {
      copying = false;
    }
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
