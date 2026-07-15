'use strict';

/* global api, window */

// ── Globaler Zustand ────────────────────────────────────────────────────────
const state = {
  components: [],
  categories: [],
  entryOrder: [],
  entryHints: {},
  settings: null,
  releases: {},
  building: false,
  copying: false,
  drives: [],
  lang: 'de',
  appVersion: '',
};

const $ = (sel) => document.querySelector(sel);
const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};

// ── Übersetzung ─────────────────────────────────────────────────────────────
function t(key, ...args) {
  const dict = window.I18N[state.lang] || window.I18N.de;
  let s = dict[key] != null ? dict[key] : window.I18N.de[key] != null ? window.I18N.de[key] : key;
  args.forEach((a, i) => {
    s = s.split(`{${i}}`).join(String(a));
  });
  return s;
}

// Wählt aus einem { de, en }-Objekt (oder gibt einen String direkt zurück)
function pick(obj) {
  if (obj == null) return '';
  if (typeof obj === 'string') return obj;
  return obj[state.lang] != null ? obj[state.lang] : obj.de != null ? obj.de : '';
}

function applyI18n() {
  document.documentElement.lang = state.lang;
  document.querySelectorAll('[data-i18n]').forEach((n) => {
    n.textContent = t(n.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-html]').forEach((n) => {
    n.innerHTML = t(n.dataset.i18nHtml);
  });
  document.querySelectorAll('[data-i18n-ph]').forEach((n) => {
    n.placeholder = t(n.dataset.i18nPh);
  });
  document.querySelectorAll('.lang-opt').forEach((b) => {
    b.classList.toggle('active', b.dataset.lang === state.lang);
  });
  if (state.appVersion) {
    $('#app-version').textContent = t('settings.version', state.appVersion);
    const sv = $('#settings-version');
    if (sv) sv.textContent = t('settings.version', state.appVersion);
  }
}

function setLanguage(lang) {
  if ((lang !== 'de' && lang !== 'en') || lang === state.lang) return;
  state.lang = lang;
  state.settings.language = lang;
  saveSettings();
  applyI18n();
  // Alle dynamisch erzeugten Bereiche neu aufbauen
  renderComponents();
  renderReleaseStatus();
  renderHekate();
  renderBuildSummary();
  renderDrives();
}

function toast(message, kind = 'info', ms = 5000) {
  const node = el('div', `toast ${kind}`, message);
  $('#toasts').appendChild(node);
  setTimeout(() => node.remove(), ms);
}

function fmtBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log2(bytes) / 10));
  return `${(bytes / 2 ** (10 * i)).toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}

function fmtDate(iso) {
  if (!iso) return '';
  const locale = state.lang === 'en' ? 'en-GB' : 'de-DE';
  return new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
}

function saveSettings() {
  api.saveSettings(state.settings).catch(() => {});
}

// ── Navigation ──────────────────────────────────────────────────────────────
function initNav() {
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
      btn.classList.add('active');
      $(`#view-${btn.dataset.view}`).classList.add('active');
      if (btn.dataset.view === 'build') refreshDrives();
    });
  });
}

// ── Komponenten-Ansicht ─────────────────────────────────────────────────────
function isSelected(id) {
  const comp = state.components.find((c) => c.id === id);
  return comp.required || state.settings.selected.includes(id);
}

function setSelected(id, on) {
  const set = new Set(state.settings.selected);
  const comp = state.components.find((c) => c.id === id);

  const nameOf = (cid) => (state.components.find((c) => c.id === cid) || {}).name || cid;
  const compOf = (cid) => state.components.find((c) => c.id === cid);

  if (on) {
    // Abhängigkeiten rekursiv mit aktivieren (auch Abhängigkeiten von Abhängigkeiten)
    const addWithDeps = (cid, isRoot) => {
      if (set.has(cid)) return;
      set.add(cid);
      if (!isRoot) toast(t('deps.autoEnabled', nameOf(cid)), 'info', 4000);
      for (const dep of (compOf(cid) || {}).requires || []) addWithDeps(dep, false);
    };
    addWithDeps(id, true);
    // Konflikte nur melden, nicht erzwingen
    for (const other of comp.conflicts || []) {
      if (set.has(other)) toast(t('conflict.warn', comp.name, nameOf(other)), 'info', 6500);
    }
  } else {
    set.delete(id);
    // Kaskadierend alles deaktivieren, dessen Abhängigkeiten nicht mehr erfüllt sind
    let changed = true;
    while (changed) {
      changed = false;
      for (const other of state.components) {
        if (!set.has(other.id)) continue;
        if ((other.requires || []).some((dep) => !set.has(dep))) {
          set.delete(other.id);
          toast(t('deps.autoDisabled', other.name), 'info', 4000);
          changed = true;
        }
      }
    }
  }

  state.settings.selected = [...set];
  saveSettings();
  renderComponents();
  renderBuildSummary();
}

function releaseBadge(id) {
  const rel = state.releases[id];
  if (!rel) return el('span', 'badge loading', t('badge.loading'));
  if (!rel.ok) {
    const badge = el('span', 'badge error', rel.rateLimited ? t('badge.rateLimit') : t('badge.unreachable'));
    badge.title = rel.error || '';
    return badge;
  }
  const wrap = el('span');
  const version = el('span', 'badge version', rel.tag + (rel.stale ? t('badge.offline') : ''));
  version.title = rel.name || '';
  wrap.appendChild(version);
  if (rel.publishedAt) wrap.appendChild(el('span', 'badge date', fmtDate(rel.publishedAt)));
  return wrap;
}

function renderComponents() {
  const host = $('#component-sections');
  host.textContent = '';

  for (const cat of state.categories) {
    const comps = state.components.filter((c) => c.category === cat.id);
    if (!comps.length) continue;

    const section = el('div', 'comp-section');
    const head = el('div', 'comp-section-head');
    head.appendChild(el('h2', null, pick(cat.name)));
    head.appendChild(el('span', null, pick(cat.hint)));
    section.appendChild(head);

    const grid = el('div', 'comp-grid');
    for (const comp of comps) {
      const on = isSelected(comp.id);
      const card = el('div', `comp-card${on ? ' enabled' : ' disabled-card'}`);
      card.dataset.id = comp.id;

      const headRow = el('div', 'comp-head');
      const nameWrap = el('div');
      nameWrap.appendChild(el('div', 'comp-name', comp.name));
      const repoLink = el('a', 'comp-repo', comp.repo);
      repoLink.href = '#';
      repoLink.title = `github.com/${comp.repo}`;
      repoLink.addEventListener('click', (e) => {
        e.preventDefault();
        api.openExternal(`https://github.com/${comp.repo}`);
      });
      nameWrap.appendChild(repoLink);
      headRow.appendChild(nameWrap);

      const toggleLabel = el('label', 'toggle');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = on;
      checkbox.disabled = !!comp.required;
      checkbox.addEventListener('change', () => setSelected(comp.id, checkbox.checked));
      toggleLabel.appendChild(checkbox);
      toggleLabel.appendChild(el('span', 'toggle-track'));
      headRow.appendChild(toggleLabel);
      card.appendChild(headRow);

      card.appendChild(el('div', 'comp-desc', pick(comp.description)));

      const foot = el('div', 'comp-foot');
      const left = el('div', 'comp-foot-badges');
      left.appendChild(releaseBadge(comp.id));
      foot.appendChild(left);
      const right = el('div', 'comp-foot-badges');
      if (comp.required) right.appendChild(el('span', 'badge required', t('badge.required')));
      if (comp.tag === 'sigpatch') {
        const b = el('span', 'badge tag', t('tag.sigpatch'));
        b.title = t('tag.sigpatch.title');
        right.appendChild(b);
      }
      if (comp.tag === 'thirdparty') {
        const b = el('span', 'badge tag', t('tag.thirdparty'));
        b.title = t('tag.thirdparty.title');
        right.appendChild(b);
      }
      foot.appendChild(right);
      card.appendChild(foot);

      grid.appendChild(card);
    }
    section.appendChild(grid);
    host.appendChild(section);
  }

  $('#nav-badge-components').textContent = state.components.filter((c) => isSelected(c.id)).length;
}

// Zeigt die Zusammenfassungs-Statusleiste anhand von state.releases
function renderReleaseStatus() {
  const status = $('#release-status');
  const all = Object.values(state.releases);
  if (!all.length) {
    status.className = 'release-status';
    return;
  }
  const failed = all.filter((r) => !r.ok).length;
  const stale = all.filter((r) => r.ok && r.stale).length;
  const rateLimitMsg =
    (all.find((r) => !r.ok && r.rateLimited) || {}).error ||
    (all.find((r) => r.ok && r.stale && r.staleRateLimited) || {}).staleReason;
  if (failed) {
    status.className = 'release-status visible warn';
    status.textContent = rateLimitMsg ? t('status.failed', failed, rateLimitMsg) : t('status.failedGeneric', failed);
  } else if (stale) {
    status.className = 'release-status visible warn';
    status.textContent = rateLimitMsg ? t('status.staleRate', rateLimitMsg) : t('status.staleOffline');
  } else {
    status.className = 'release-status visible info';
    const newest = all
      .filter((r) => r.ok && r.publishedAt)
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0];
    status.textContent = newest ? t('status.allCurrent', fmtDate(newest.publishedAt)) : t('status.allCurrentNoDate');
  }
}

async function checkReleases(force) {
  const btn = $('#btn-check-updates');
  const status = $('#release-status');
  btn.disabled = true;
  btn.querySelector('svg').classList.add('spin');
  status.className = 'release-status visible info';
  status.textContent = t('status.checking');

  try {
    state.releases = await api.checkReleases(force);
    renderReleaseStatus();
  } catch (err) {
    status.className = 'release-status visible warn';
    status.textContent = t('status.checkFailed', err.message);
  } finally {
    btn.disabled = false;
    btn.querySelector('svg').classList.remove('spin');
    renderComponents();
    renderBuildSummary();
  }
}

// ── Hekate-Ansicht ──────────────────────────────────────────────────────────
const HEKATE_GENERAL = [
  { key: 'autoboot', type: 'select', nameKey: 'gen.autoboot', descKey: 'gen.autoboot.desc' },
  { key: 'bootwait', type: 'slider', min: 0, max: 20, unit: 's', nameKey: 'gen.bootwait', descKey: 'gen.bootwait.desc' },
  { key: 'backlight', type: 'slider', min: 0, max: 200, unit: '', nameKey: 'gen.backlight', descKey: 'gen.backlight.desc' },
  { key: 'autonogc', type: 'toggle', nameKey: 'gen.autonogc', descKey: 'gen.autonogc.desc' },
  { key: 'autohosoff', type: 'toggle', nameKey: 'gen.autohosoff', descKey: 'gen.autohosoff.desc' },
  { key: 'updater2p', type: 'toggle', nameKey: 'gen.updater2p', descKey: 'gen.updater2p.desc' },
  { key: 'bootprotect', type: 'toggle', nameKey: 'gen.bootprotect', descKey: 'gen.bootprotect.desc' },
];

function hekateConf() {
  return state.settings.hekate;
}

function enabledEntries() {
  return state.entryOrder.filter((k) => hekateConf().entries[k].enabled);
}

function renderBootEntries() {
  const host = $('#boot-entries');
  host.textContent = '';
  for (const key of state.entryOrder) {
    const entry = hekateConf().entries[key];
    const row = el('div', 'boot-entry');

    const toggleLabel = el('label', 'toggle');
    toggleLabel.style.marginLeft = '0';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = entry.enabled;
    checkbox.addEventListener('change', () => {
      // Mindestens ein Boot-Eintrag muss aktiv bleiben (sonst leeres Boot-Menü)
      if (!checkbox.checked) {
        const othersOn = state.entryOrder.some((k) => k !== key && hekateConf().entries[k].enabled);
        if (!othersOn) {
          checkbox.checked = true;
          toast(t('bootentry.minOne'), 'info', 4000);
          return;
        }
      }
      entry.enabled = checkbox.checked;
      // Zeigt Autoboot auf einen jetzt deaktivierten Eintrag → zurück aufs Menü
      const target = hekateConf().autoboot;
      if (target && !(hekateConf().entries[target] || {}).enabled) hekateConf().autoboot = '';
      saveSettings();
      renderHekate();
    });
    toggleLabel.appendChild(checkbox);
    toggleLabel.appendChild(el('span', 'toggle-track'));
    row.appendChild(toggleLabel);

    const body = el('div', 'boot-entry-body');
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = entry.name;
    nameInput.maxLength = 60;
    nameInput.disabled = !entry.enabled;
    nameInput.addEventListener('input', () => {
      entry.name = nameInput.value;
      saveSettings();
      renderAutobootOptions();
      updateIniPreview();
    });
    body.appendChild(nameInput);
    body.appendChild(el('div', 'boot-entry-hint', pick(state.entryHints[key])));
    row.appendChild(body);

    host.appendChild(row);
  }
}

function renderAutobootOptions() {
  const select = $('#autoboot-select');
  if (!select) return;
  select.textContent = '';
  const optMenu = el('option', null, t('autoboot.showMenu'));
  optMenu.value = '';
  select.appendChild(optMenu);
  // Werte sind Eintrags-SCHLÜSSEL (nicht Positionen) – so bleibt die Auswahl
  // stabil, auch wenn andere Einträge de-/aktiviert werden.
  enabledEntries().forEach((key) => {
    const opt = el('option', null, hekateConf().entries[key].name || t('autoboot.unnamed'));
    opt.value = key;
    select.appendChild(opt);
  });
  select.value = hekateConf().autoboot || '';
}

function renderHekateGeneral() {
  const host = $('#hekate-general');
  host.textContent = '';
  for (const setting of HEKATE_GENERAL) {
    const row = el('div', 'setting-row');
    const info = el('div', 'setting-info');
    info.appendChild(el('div', 'setting-name', t(setting.nameKey)));
    info.appendChild(el('div', 'setting-desc', t(setting.descKey)));
    row.appendChild(info);

    if (setting.type === 'select') {
      const select = document.createElement('select');
      select.id = 'autoboot-select';
      select.addEventListener('change', () => {
        hekateConf().autoboot = select.value; // Eintrags-Schlüssel oder '' (Menü)
        saveSettings();
        updateIniPreview();
      });
      row.appendChild(select);
    } else if (setting.type === 'slider') {
      const wrap = el('div', 'slider-wrap');
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = setting.min;
      slider.max = setting.max;
      slider.value = hekateConf()[setting.key];
      const value = el('span', 'slider-value', `${slider.value}${setting.unit}`);
      slider.addEventListener('input', () => {
        hekateConf()[setting.key] = Number(slider.value);
        value.textContent = `${slider.value}${setting.unit}`;
        saveSettings();
        updateIniPreview();
      });
      wrap.appendChild(slider);
      wrap.appendChild(value);
      row.appendChild(wrap);
    } else {
      const toggleLabel = el('label', 'toggle');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = !!hekateConf()[setting.key];
      checkbox.addEventListener('change', () => {
        hekateConf()[setting.key] = checkbox.checked;
        saveSettings();
        updateIniPreview();
      });
      toggleLabel.appendChild(checkbox);
      toggleLabel.appendChild(el('span', 'toggle-track'));
      row.appendChild(toggleLabel);
    }
    host.appendChild(row);
  }
  renderAutobootOptions();
}

let iniPreviewTimer = null;
function updateIniPreview() {
  clearTimeout(iniPreviewTimer);
  iniPreviewTimer = setTimeout(async () => {
    try {
      const ini = await api.previewHekateIni(hekateConf());
      const pre = $('#ini-preview');
      pre.textContent = '';
      for (const line of ini.split(/\r?\n/)) {
        const span = document.createElement('span');
        if (line.startsWith('#')) span.className = 'ini-comment';
        else if (line.startsWith('[')) span.className = 'ini-section';
        else if (line.includes('=')) span.className = 'ini-key';
        span.textContent = line;
        pre.appendChild(span);
        pre.appendChild(document.createTextNode('\n'));
      }
    } catch {
      /* Vorschau ist nicht kritisch */
    }
  }, 120);
}

function renderHekate() {
  renderBootEntries();
  renderHekateGeneral();
  updateIniPreview();
}

// ── Erstellen & SD ──────────────────────────────────────────────────────────
function renderBuildSummary() {
  $('#output-dir').textContent = state.settings.outputDir;
  const host = $('#build-summary');
  host.textContent = '';
  for (const comp of state.components) {
    if (!isSelected(comp.id)) continue;
    const rel = state.releases[comp.id];
    const version = rel && rel.ok ? ` ${rel.tag}` : '';
    host.appendChild(el('span', `chip${comp.category === 'core' ? ' core' : ''}`, comp.name + version));
  }
}

function setBuildProgress(percent, label, count) {
  $('#build-progress').hidden = false;
  $('#progress-fill').style.width = `${Math.min(100, percent)}%`;
  if (label != null) $('#progress-step-label').textContent = label;
  if (count !== undefined) $('#progress-step-count').textContent = count;
}

function logLine(text, cls) {
  const log = $('#progress-log');
  const line = el('div', cls, text);
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}

let currentStep = { step: 0, totalSteps: 1 };

function handleProgress(event) {
  if (event.type === 'step') {
    currentStep = event;
    const base = ((event.step - 1) / event.totalSteps) * 100;
    setBuildProgress(base, `${event.name}${event.version ? ` ${event.version}` : ''}`, `${event.step} / ${event.totalSteps}`);
    logLine(`▸ ${event.name}${event.version ? ` ${event.version}` : ''}`);
  } else if (event.type === 'log') {
    logLine(`  ${event.text}`);
  } else if (event.type === 'asset-progress') {
    const withinStep = event.total ? event.done / event.total : 0;
    const base = ((currentStep.step - 1 + withinStep * 0.9) / currentStep.totalSteps) * 100;
    setBuildProgress(base);
    $('#progress-step-label').textContent = `${event.asset} – ${fmtBytes(event.done)}${event.total ? ` / ${fmtBytes(event.total)}` : ''}`;
  } else if (event.type === 'sd-progress') {
    $('#sd-progress').hidden = false;
    $('#sd-progress-fill').style.width = `${(event.doneBytes / Math.max(1, event.totalBytes)) * 100}%`;
    $('#sd-progress-label').textContent = event.current;
    $('#sd-progress-count').textContent = t('sd.files', event.doneFiles, event.totalFiles);
  }
}

async function build() {
  if (state.building) return;
  state.building = true;
  const btn = $('#btn-build');
  btn.disabled = true;
  btn.querySelector('span').textContent = t('build.creating');
  $('#build-result').hidden = true;
  $('#progress-log').textContent = '';
  setBuildProgress(0, t('build.prep'), '');

  try {
    const summary = await api.buildPack({
      outputDir: state.settings.outputDir,
      selectedIds: state.settings.selected,
      hekateConfig: hekateConf(),
    });
    setBuildProgress(100, t('build.done'), '');
    logLine(t('build.logOk'), 'log-ok');

    const result = $('#build-result');
    result.hidden = false;
    result.textContent = '';
    result.appendChild(el('div', null, t('build.resultOk', summary.files, fmtBytes(summary.bytes))));
    result.appendChild(el('div', 'versions', summary.components.map((c) => `${c.name} ${c.version}`).join('  ·  ')));
    toast(t('toast.buildSuccess'), 'success');
    refreshDrives();
  } catch (err) {
    logLine(`✗ ${err.message}`);
    toast(t('toast.buildError', err.message), 'error', 9000);
  } finally {
    state.building = false;
    btn.disabled = false;
    btn.querySelector('span').textContent = t('build.create');
  }
}

async function refreshDrives() {
  try {
    state.drives = await api.listDrives();
  } catch {
    state.drives = [];
  }
  renderDrives();
}

// Rendert die Laufwerksliste aus state.drives (ohne neue Abfrage)
function renderDrives() {
  const host = $('#drive-list');
  host.textContent = '';

  if (!state.drives.length) {
    host.appendChild(el('div', 'drive-empty', t('sd.empty')));
    return;
  }

  for (const drive of state.drives) {
    const card = el('div', 'drive-card');

    const head = el('div', 'drive-head');
    head.appendChild(el('div', 'drive-letter', drive.letter));
    const info = el('div');
    info.appendChild(el('div', 'drive-name', drive.label));
    info.appendChild(el('div', 'drive-meta', t('sd.freeOf', fmtBytes(drive.free), fmtBytes(drive.size), drive.fileSystem)));
    head.appendChild(info);
    card.appendChild(head);

    const bar = el('div', 'drive-bar');
    const fill = el('div', 'drive-bar-fill');
    fill.style.width = `${drive.size ? ((drive.size - drive.free) / drive.size) * 100 : 0}%`;
    bar.appendChild(fill);
    card.appendChild(bar);

    if (!drive.fat32) {
      card.appendChild(el('div', 'drive-fs-warn', t('sd.fsWarn', drive.fileSystem)));
    }

    const btn = el('button', 'btn btn-secondary', t('sd.copyTo', drive.letter));
    btn.addEventListener('click', () => copyToDrive(drive, btn));
    card.appendChild(btn);

    host.appendChild(card);
  }
}

async function copyToDrive(drive, btn) {
  if (state.copying) return;
  const info = await api.packInfo(state.settings.outputDir);
  if (!info) {
    toast(t('sd.needPack'), 'error');
    return;
  }
  if (!confirm(t('sd.confirm', drive.letter, drive.label))) return;

  state.copying = true;
  btn.disabled = true;
  $('#sd-progress').hidden = false;

  try {
    const result = await api.copyToDrive({ packDir: state.settings.outputDir, driveLetter: drive.letter });
    $('#sd-progress-label').textContent = t('build.done');
    toast(t('sd.copyDone', result.files, fmtBytes(result.bytes), drive.letter), 'success', 9000);
  } catch (err) {
    toast(t('sd.copyError', err.message), 'error', 9000);
  } finally {
    state.copying = false;
    btn.disabled = false;
  }
}

// ── Einstellungen-Fenster ────────────────────────────────────────────────────
function initSettingsModal() {
  const modal = $('#settings-modal');
  const open = () => {
    modal.hidden = false;
  };
  const close = () => {
    modal.hidden = true;
  };
  $('#btn-settings').addEventListener('click', open);
  $('#btn-settings-close').addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) close();
  });
  document.querySelectorAll('.lang-opt').forEach((b) => {
    b.addEventListener('click', () => setLanguage(b.dataset.lang));
  });
}

// ── Initialisierung ─────────────────────────────────────────────────────────
async function main() {
  const data = await api.init();
  state.components = data.components;
  state.categories = data.categories;
  state.entryOrder = data.entryOrder;
  state.entryHints = data.entryHints;
  state.settings = data.settings;
  state.appVersion = data.version;
  state.lang = data.settings.language === 'en' ? 'en' : 'de';

  applyI18n();
  initNav();
  initSettingsModal();
  renderComponents();
  renderHekate();
  renderBuildSummary();

  api.onProgress(handleProgress);

  $('#btn-check-updates').addEventListener('click', () => checkReleases(true));

  const tokenInput = $('#github-token');
  tokenInput.value = state.settings.githubToken || '';
  $('#btn-save-token').addEventListener('click', async () => {
    state.settings.githubToken = tokenInput.value.trim();
    await api.saveSettings(state.settings);
    toast(state.settings.githubToken ? t('token.saved') : t('token.removed'), 'success');
    checkReleases(true);
  });
  $('#btn-token-help').addEventListener('click', () =>
    api.openExternal('https://github.com/settings/personal-access-tokens/new')
  );
  $('#btn-build').addEventListener('click', build);
  $('#btn-refresh-drives').addEventListener('click', refreshDrives);
  $('#btn-open-output').addEventListener('click', () => api.openPath(state.settings.outputDir));
  $('#btn-choose-output').addEventListener('click', async () => {
    const dir = await api.chooseOutputDir();
    if (dir) {
      state.settings.outputDir = dir;
      state.settings.outputDirCustom = true;
      saveSettings();
      renderBuildSummary();
    }
  });

  // Beim Start automatisch die aktuellen Versionen laden (aus Cache oder GitHub)
  checkReleases(false);

  window.__APP_STATE__ = state; // Debug-/Test-Zugriff
  window.__APP_READY__ = true;
}

main().catch((err) => {
  console.error(err);
  toast(t('init.failed', err.message), 'error', 15000);
});
