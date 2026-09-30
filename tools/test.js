'use strict';

// Prüfungen ohne Electron: Datenbestand, Übersetzungen, Bau-Logik.
// Aufruf: npm test
//
// Was hier NICHT geprüft wird, läuft über die Oberfläche in main/devtest.js
// (HATS_SMOKE und die HATS_TEST_*-Schalter). Beides zusammen ergibt die
// Absicherung des Projekts.

const fs = require('fs');
const os = require('os');
const path = require('path');

const WURZEL = path.join(__dirname, '..');
const AdmZip = require(path.join(WURZEL, 'node_modules/adm-zip'));

let fehler = 0;
const ok = (name) => console.log('  \u2713 ' + name);
const nichtOk = (name, extra) => {
  console.log('  \u2717 ' + name + (extra ? '  -> ' + extra : ''));
  fehler += 1;
};
const pruefe = (name, bedingung, extra) => (bedingung ? ok(name) : nichtOk(name, extra));
const abschnitt = (name) => console.log('\n' + name);

// ── Übersetzungen ───────────────────────────────────────────────────────────
abschnitt('Übersetzungen');
const i18nQuelle = fs.readFileSync(path.join(WURZEL, 'renderer/i18n.js'), 'utf8');
const fenster = {};
new Function('window', i18nQuelle)(fenster);
const I18N = fenster.I18N;
const appQuelle = fs.readFileSync(path.join(WURZEL, 'renderer/app.js'), 'utf8');
const htmlQuelle = fs.readFileSync(path.join(WURZEL, 'renderer/index.html'), 'utf8');

const sprachen = Object.keys(I18N);
const schluessel = Object.fromEntries(sprachen.map((s) => [s, Object.keys(I18N[s])]));
pruefe(`alle Sprachen gleich viele Texte (${sprachen.map((s) => `${s}=${schluessel[s].length}`).join(', ')})`,
  sprachen.every((s) => schluessel[s].length === schluessel[sprachen[0]].length));
for (const s of sprachen) {
  for (const k of schluessel[sprachen[0]]) {
    if (!(k in I18N[s])) nichtOk(`fehlt in ${s}: ${k}`);
  }
}
const platzhalter = (text) => [...String(text).matchAll(/\{(\d+)\}/g)].map((m) => m[1]).sort().join(',');
for (const k of schluessel[sprachen[0]]) {
  const erwartet = platzhalter(I18N[sprachen[0]][k]);
  for (const s of sprachen.slice(1)) {
    if (k in I18N[s] && platzhalter(I18N[s][k]) !== erwartet) {
      nichtOk(`Platzhalter ungleich bei ${k}`, `${sprachen[0]}[${erwartet}] ${s}[${platzhalter(I18N[s][k])}]`);
    }
  }
}

const benutzt = new Set();
for (const m of appQuelle.matchAll(/\bt\(\s*'([^']+)'/g)) benutzt.add(m[1]);
for (const m of htmlQuelle.matchAll(/data-i18n(?:-html|-ph|-aria)?="([^"]+)"/g)) benutzt.add(m[1]);
for (const m of appQuelle.matchAll(/(?:nameKey|descKey|confirmOffKey):\s*'([^']+)'/g)) benutzt.add(m[1]);
for (const m of appQuelle.matchAll(/confirmOffKey:\s*\w+\s*\?\s*'([^']+)'/g)) benutzt.add(m[1]);
for (const k of benutzt) if (!(k in I18N.de)) nichtOk('benutzter Text fehlt: ' + k);
for (const k of schluessel.de) if (!benutzt.has(k)) nichtOk('unbenutzter Text: ' + k);

// ── Meldungen des Hauptprozesses ────────────────────────────────────────────
abschnitt('Meldungen des Hauptprozesses');
const msgQuelle = fs.readFileSync(path.join(WURZEL, 'main/messages.js'), 'utf8');
const msgKeys = [...msgQuelle.matchAll(/^ {2}'([^']+)':\s*\{/gm)].map((m) => m[1]);
const hauptQuelle = ['builder', 'github', 'sd', 'updater', 'main', 'hekate', 'firmware', 'version']
  .map((f) => fs.readFileSync(path.join(WURZEL, 'main', f + '.js'), 'utf8'))
  .join('\n');
const msgBenutzt = new Set();
for (const aufruf of hauptQuelle.matchAll(/\bmt\(([^;\n]*)/g)) {
  for (const q of aufruf[1].matchAll(/'([\w.]+)'/g)) msgBenutzt.add(q[1]);
}
for (const k of msgKeys) if (!msgBenutzt.has(k)) nichtOk('unbenutzte Meldung: ' + k);
const messages = require(path.join(WURZEL, 'main/messages.js'));
for (const k of msgKeys) {
  for (const s of sprachen) {
    messages.setLang(s);
    if (!messages.mt(k) || messages.mt(k) === k) nichtOk(`Meldung ${k} fehlt in ${s}`);
  }
}
messages.setLang('de');
pruefe(`${msgKeys.length} Meldungen in ${sprachen.length} Sprachen`, true);

// ── Komponenten-Registry ────────────────────────────────────────────────────
abschnitt('Komponenten');
const { COMPONENTS, CATEGORIES } = require(path.join(WURZEL, 'main/components.js'));
const ids = COMPONENTS.map((c) => c.id);
pruefe('IDs sind eindeutig', new Set(ids).size === ids.length);
const katIds = CATEGORIES.map((c) => c.id);
for (const c of COMPONENTS) {
  if (!katIds.includes(c.category)) nichtOk(`${c.id}: unbekannte Kategorie ${c.category}`);
  if (!c.description || !c.description.de || !c.description.en) nichtOk(`${c.id}: Beschreibung unvollständig`);
  if (!c.assets || !c.assets.length) nichtOk(`${c.id}: keine Asset-Regeln`);
  for (const a of c.assets || []) {
    if (!(a.match instanceof RegExp)) nichtOk(`${c.id}: match ist kein regulärer Ausdruck`);
    else if (a.match.global) nichtOk(`${c.id}: match hat /g, test() wäre dann zustandsbehaftet`);
    if (!['copy', 'extract'].includes(a.action)) nichtOk(`${c.id}: unbekannte action ${a.action}`);
    if (typeof a.target !== 'string') nichtOk(`${c.id}: target fehlt`);
    else if (a.target.startsWith('/') || a.target.includes('..')) nichtOk(`${c.id}: verdächtiges target ${a.target}`);
    if (a.stripPrefix && a.action !== 'extract') nichtOk(`${c.id}: stripPrefix ohne extract`);
  }
  for (const r of c.requires || []) if (!ids.includes(r)) nichtOk(`${c.id}: requires zeigt auf ${r}`);
  if (c.source === 'branch' && !c.branch) nichtOk(`${c.id}: source branch ohne branch`);
  if (c.source === 'dir' && !c.dir) nichtOk(`${c.id}: source dir ohne dir`);
  if (c.source && !['branch', 'dir'].includes(c.source)) nichtOk(`${c.id}: unbekannte source ${c.source}`);
  if (!/^[\w.-]+\/[\w.-]+$/.test(c.repo)) nichtOk(`${c.id}: Repo-Format ${c.repo}`);
}
// Die Reihenfolge im Array ist die Bau-Reihenfolge: Abhängigkeiten zuerst
COMPONENTS.forEach((c, i) => {
  for (const r of c.requires || []) {
    if (ids.indexOf(r) > i) nichtOk(`Bau-Reihenfolge: ${c.id} braucht ${r}, das später kommt`);
  }
});
// Zwei Komponenten dürfen nicht unbemerkt dieselbe Datei schreiben
const ziele = new Map();
for (const c of COMPONENTS) {
  for (const a of c.assets) {
    if (a.action !== 'copy') continue;
    const z = a.target.toLowerCase();
    if (ziele.has(z) && ziele.get(z) !== c.id) nichtOk(`Ziel doppelt belegt: ${a.target}`, `${ziele.get(z)} + ${c.id}`);
    ziele.set(z, c.id);
  }
}
pruefe(`${COMPONENTS.length} Komponenten, ${ziele.size} eindeutige Kopierziele`, true);

// ── Keine Gedankenstriche in sichtbaren Texten ──────────────────────────────
abschnitt('Schreibweise');
const texte = [];
for (const s of sprachen) for (const [k, v] of Object.entries(I18N[s])) texte.push([`i18n.${s}.${k}`, v]);
for (const c of COMPONENTS) for (const s of ['de', 'en']) texte.push([`comp.${c.id}.${s}`, c.description[s]]);
for (const c of CATEGORIES) for (const f of ['name', 'hint']) for (const s of ['de', 'en']) texte.push([`cat.${c.id}.${f}`, c[f][s]]);
const hekate = require(path.join(WURZEL, 'main/hekate.js'));
for (const [k, v] of Object.entries(hekate.ENTRY_TEMPLATES)) for (const s of ['de', 'en']) texte.push([`hekate.${k}.${s}`, v.hint[s]]);
for (const k of msgKeys) for (const s of sprachen) { messages.setLang(s); texte.push([`msg.${k}.${s}`, messages.mt(k)]); }
messages.setLang('de');
let striche = 0;
for (const [name, text] of texte) {
  if (/[\u2013\u2014]/.test(text)) { nichtOk('Gedankenstrich in ' + name); striche += 1; }
}
if (!striche) ok(`keine Gedankenstriche (${texte.length} Texte geprüft)`);

// ── Brücke zwischen Oberfläche und Hauptprozess ─────────────────────────────
abschnitt('Oberfläche und Hauptprozess');
const preloadQuelle = fs.readFileSync(path.join(WURZEL, 'main/preload.js'), 'utf8');
const mainQuelle = fs.readFileSync(path.join(WURZEL, 'main/main.js'), 'utf8');
const gerufen = new Set([...preloadQuelle.matchAll(/ipcRenderer\.invoke\('([^']+)'/g)].map((m) => m[1]));
const behandelt = new Set([...mainQuelle.matchAll(/ipcMain\.handle\('([^']+)'/g)].map((m) => m[1]));
for (const k of gerufen) if (!behandelt.has(k)) nichtOk('kein Handler für ' + k);
for (const k of behandelt) if (!gerufen.has(k)) nichtOk('kein Zugang in preload für ' + k);
const freigegeben = new Set([...preloadQuelle.matchAll(/^ {2}(\w+):/gm)].map((m) => m[1]));
for (const m of appQuelle.matchAll(/\bapi\.(\w+)\(/g)) if (!freigegeben.has(m[1])) nichtOk('api.' + m[1] + ' fehlt in preload');
const htmlIds = new Set([...htmlQuelle.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
const dynamisch = new Set(['setting-autoboot']);
for (const m of appQuelle.matchAll(/\$\('#([\w-]+)'\)/g)) {
  if (!htmlIds.has(m[1]) && !dynamisch.has(m[1])) nichtOk('app.js sucht #' + m[1] + ', gibt es im HTML nicht');
}
pruefe(`${gerufen.size} Kanäle, alle Element-Verweise vorhanden`, true);

// ── Regeln, die sich sonst leise verlieren ──────────────────────────────────
abschnitt('Festgelegte Regeln');
{
  const stueck = (kanal) => {
    const i = mainQuelle.indexOf(`ipcMain.handle('${kanal}'`);
    return i < 0 ? '' : mainQuelle.slice(i, i + 800);
  };
  pruefe('pack:build lehnt bei laufendem Build ab', /if \(building\)\s*throw/.test(stueck('pack:build')));
  pruefe('pack:build lehnt bei laufendem Kopieren ab', /if \(copying\)\s*throw/.test(stueck('pack:build')));
  pruefe('sd:copy lehnt bei laufendem Kopieren ab', /if \(copying\)\s*throw/.test(stueck('sd:copy')));
  pruefe('sd:copy lehnt bei laufendem Build ab', /if \(building\)\s*throw/.test(stueck('sd:copy')));
  pruefe('cache:clear lehnt bei laufendem Build ab', /if \(building\)\s*throw/.test(stueck('cache:clear')));
  pruefe('Fehler werden durch fehlertext() gereicht',
    !/[^.\w]err\.message/.test(appQuelle.replace('(err && err.message)', '')));
}

// ── Versionsvergleich ───────────────────────────────────────────────────────
abschnitt('Versionsvergleich');
const version = require(path.join(WURZEL, 'main/version.js'));
const updater = require(path.join(WURZEL, 'main/updater.js'));
for (const [a, b, soll] of [
  ['1.0.10', '1.0.9', true], ['1.0.9', '1.0.10', false], ['1.0.13', '1.0.13', false],
  ['v1.1.0', '1.0.99', true], ['23.0.0', '22.5.0', true], ['22.5.0', '23.0.0', false],
  ['10.0.0', '9.2.0', true], ['9.2.0', '10.0.0', false], ['1.0', '1.0.0', false],
]) {
  if (version.isNewer(a, b) !== soll) nichtOk(`isNewer(${a}, ${b}) sollte ${soll} sein`);
}
ok('Zahlenweiser Vergleich, auch 10 gegen 9');
pruefe('updater reicht isNewer weiter', updater.isNewer === version.isNewer);

abschnitt('Selbst-Update');
const exen = [{ name: 'X-Portable.exe' }, { name: 'X-Setup.exe' }];
pruefe('portable bekommt die portable Datei', updater.pickAsset(exen, true).name.includes('Portable'));
pruefe('installiert bekommt den Installer', updater.pickAsset(exen, false).name.includes('Setup'));
pruefe('portable bekommt niemals den Installer untergeschoben',
  updater.pickAsset([{ name: 'X-Setup.exe' }], true) === null);
pruefe('Austausch-Skript prüft, ob das Kopieren geklappt hat',
  /\$kopiert/.test(updater.buildPortableScript('a', 'b', 1, 'c')));

// ── Firmware-Abgleich ───────────────────────────────────────────────────────
abschnitt('Firmware-Abgleich');
const firmware = require(path.join(WURZEL, 'main/firmware.js'));
for (const [text, soll] of [
  ['Basic support was added for 22.5.0.\nSupport was added for 22.0.0.', '22.5.0'],
  ['Support was added for 9.2.0.\nSupport was added for 10.0.0.', '10.0.0'],
  ['SUPPORT WAS ADDED FOR 21.0.0.', '21.0.0'],
  ['nichts davon', null], ['', null], [null, null],
]) {
  if (firmware.parseSupportedHos(text) !== soll) {
    nichtOk(`parseSupportedHos(${JSON.stringify(String(text).slice(0, 30))}) sollte ${soll} sein`,
      String(firmware.parseSupportedHos(text)));
  }
}
ok('höchste unterstützte Firmware wird aus dem Release-Text gelesen');

// ── Hekate-Konfiguration ────────────────────────────────────────────────────
abschnitt('Hekate-Konfiguration');
{
  const keys = hekate.ENTRY_ORDER;
  let schiefe = 0;
  // Jede Kombination aus aktiven Einträgen mal jedes Autoboot-Ziel
  for (let maske = 1; maske < 2 ** keys.length; maske++) {
    const entries = {};
    keys.forEach((k, i) => {
      entries[k] = { enabled: Boolean(maske & (1 << i)), name: hekate.DEFAULT_HEKATE.entries[k].name };
    });
    const aktiv = keys.filter((k) => entries[k].enabled);
    for (const ziel of ['', ...keys]) {
      const ini = hekate.generateIni({ ...hekate.DEFAULT_HEKATE, entries, autoboot: ziel });
      const index = Number((ini.split('\r\n').find((l) => l.startsWith('autoboot=')) || '').split('=')[1]);
      const sektionen = [...ini.matchAll(/^\[(.+)\]$/gm)].map((m) => m[1]).filter((n) => n !== 'config');
      const erwartet = ziel && aktiv.includes(ziel) ? aktiv.indexOf(ziel) + 1 : 0;
      if (index !== erwartet) schiefe += 1;
      else if (index > 0 && sektionen[index - 1] !== hekate.DEFAULT_HEKATE.entries[ziel].name) schiefe += 1;
      if (sektionen.length !== aktiv.length) schiefe += 1;
    }
  }
  pruefe('Autoboot zeigt in jeder Kombination auf den gemeinten Eintrag', schiefe === 0, `${schiefe} Abweichungen`);
  pruefe('Umlaute in Eintragsnamen werden umgeschrieben',
    hekate.normalize({ entries: { cfw_emu: { enabled: true, name: 'Grün über Alles' } } }).entries.cfw_emu.name
      === 'Gruen ueber Alles');
  pruefe('Boot-Wartezeit wird begrenzt',
    hekate.normalize({ bootwait: 999 }).bootwait === 20 && hekate.normalize({ bootwait: -5 }).bootwait === 0);
  pruefe('Autoboot auf einen abgeschalteten Eintrag fällt aufs Menü zurück',
    hekate.normalize({ autoboot: 'cfw_sys' }).autoboot === '');
  pruefe('Vorlage bleibt unverändert', hekate.DEFAULT_HEKATE.autoboot === '');
  pruefe('INI nutzt Zeilenenden nach Windows-Art', hekate.generateIni(hekate.DEFAULT_HEKATE).includes('\r\n'));
}

// ── Bau-Logik ───────────────────────────────────────────────────────────────
abschnitt('Auswahl und Abhängigkeiten');
const builder = require(path.join(WURZEL, 'main/builder.js'));
{
  const aufloesen = (auswahl) => builder.expandSelection(auswahl);
  pruefe('Pflicht-Komponenten sind immer dabei',
    ['atmosphere', 'hekate'].every((id) => aufloesen([]).has(id)));
  for (const kaputt of ['text', 42, {}, null, undefined, [1, null, 'jksv']]) {
    try {
      aufloesen(kaputt);
    } catch (e) {
      nichtOk('beschädigte Auswahl kippt: ' + JSON.stringify(kaputt), e.message);
    }
  }
  ok('beschädigte Auswahl führt nicht zum Absturz');
  // Jede Komponente einzeln: die ganze requires-Kette muss mitkommen
  let fehlend = 0;
  for (const c of COMPONENTS) {
    const menge = aufloesen([c.id]);
    const lauf = (id) => {
      for (const d of (COMPONENTS.find((x) => x.id === id) || {}).requires || []) {
        if (!menge.has(d)) fehlend += 1;
        lauf(d);
      }
    };
    lauf(c.id);
  }
  pruefe('jede Komponente zieht ihre ganze Kette mit', fehlend === 0, `${fehlend} fehlend`);
}

abschnitt('Schutz vor Pfad-Ausbruch');
{
  const basis = path.join(os.tmpdir(), 'hats-test-basis');
  let abgewehrt = 0;
  const boese = ['../evil.txt', '..\\evil.txt', 'a/../../evil', '/abs/evil', 'C:\\Windows\\evil'];
  for (const p of boese) {
    try { builder.safeJoin(basis, p); } catch { abgewehrt += 1; }
  }
  pruefe('safeJoin wehrt Ausbrüche ab', abgewehrt === boese.length, `${abgewehrt} von ${boese.length}`);
  pruefe('normale Pfade bleiben erlaubt', builder.safeJoin(basis, 'switch/app.nro').startsWith(path.resolve(basis)));
}

abschnitt('Zielordner');
{
  const wurzel = fs.mkdtempSync(path.join(os.tmpdir(), 'hats-test-'));
  const neu = (n) => { const d = path.join(wurzel, n); fs.mkdirSync(d, { recursive: true }); return d; };
  const lege = (d, rel) => {
    const p = path.join(d, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, 'x');
  };

  const fremd = neu('fremd');
  lege(fremd, 'Urlaubsfotos.zip');
  let abgelehnt = false;
  try { builder.preparePackDir(fremd); } catch { abgelehnt = true; }
  pruefe('fremder Ordner wird abgelehnt', abgelehnt);
  pruefe('fremde Datei bleibt unangetastet', fs.existsSync(path.join(fremd, 'Urlaubsfotos.zip')));

  const unser = neu('unser');
  lege(unser, 'switch/unser.nro');
  lege(unser, 'Nintendo/save.dat');
  fs.writeFileSync(path.join(unser, builder.MARKER),
    JSON.stringify({ complete: true, files: [path.join('switch', 'unser.nro')] }));
  builder.preparePackDir(unser);
  pruefe('unsere Datei wird entfernt', !fs.existsSync(path.join(unser, 'switch/unser.nro')));
  pruefe('fremde Datei überlebt das Aufräumen', fs.existsSync(path.join(unser, 'Nintendo/save.dat')));

  // Ein beschädigter Marker darf den eigenen Ordner nicht unbrauchbar machen
  for (const inhalt of ['{"complete":true,"files":["switch/a', '', '"text"', '123', '[1,2]', 'null']) {
    const d = neu('marker-' + Math.random().toString(36).slice(2, 8));
    lege(d, 'switch/meins.nro');
    fs.writeFileSync(path.join(d, builder.MARKER), inhalt);
    let kaputt = false;
    try { builder.preparePackDir(d); } catch { kaputt = true; }
    if (kaputt) nichtOk('beschädigter Marker sperrt aus: ' + JSON.stringify(inhalt.slice(0, 20)));
    if (!fs.existsSync(path.join(d, 'switch/meins.nro'))) nichtOk('beschädigter Marker löscht trotzdem');
  }
  ok('beschädigter Marker sperrt den eigenen Ordner nicht aus');

  // Eine manipulierte Dateiliste darf nicht außerhalb löschen
  const opfer = path.join(wurzel, 'NICHT-ANFASSEN.txt');
  fs.writeFileSync(opfer, 'wichtig');
  const boeser = neu('boeser-marker');
  fs.writeFileSync(path.join(boeser, builder.MARKER),
    JSON.stringify({ complete: true, files: ['../NICHT-ANFASSEN.txt', '..\\NICHT-ANFASSEN.txt'] }));
  try { builder.preparePackDir(boeser); } catch { /* egal */ }
  pruefe('Marker kann nichts außerhalb des Ordners löschen', fs.existsSync(opfer));

  fs.rmSync(wurzel, { recursive: true, force: true });
}

abschnitt('Entpacken');
{
  const wurzel = fs.mkdtempSync(path.join(os.tmpdir(), 'hats-zip-'));
  const zip = new AdmZip();
  zip.addFile('SdOut/switch/tool.nro', Buffer.from('a'));
  zip.addFile('SdOut/atmosphere/x.txt', Buffer.from('b'));
  zip.addFile('Liesmich.txt', Buffer.from('c'));
  const pfad = path.join(wurzel, 'paket.zip');
  zip.writeZip(pfad);

  const ziel = path.join(wurzel, 'pack');
  fs.mkdirSync(ziel);
  const geschrieben = [];
  builder.applyAsset({ action: 'extract', target: '', stripPrefix: 'SdOut/' }, pfad, ziel, geschrieben);
  pruefe('stripPrefix schneidet den Wrapper ab', fs.existsSync(path.join(ziel, 'switch/tool.nro')));
  pruefe('was außerhalb des Prefix liegt, bleibt draußen', !fs.existsSync(path.join(ziel, 'Liesmich.txt')));
  pruefe('geschriebene Dateien werden protokolliert', geschrieben.length === 2, String(geschrieben.length));

  let gemeldet = false;
  try {
    builder.applyAsset({ action: 'extract', target: '', stripPrefix: 'GibtsNicht/' }, pfad, path.join(wurzel, 'p2'), []);
  } catch { gemeldet = true; }
  pruefe('fehlender Wrapper wird gemeldet', gemeldet);

  fs.rmSync(wurzel, { recursive: true, force: true });
}

// ── Downloads: Zwischenspeicher und Wiederholung ────────────────────────────
// Diese beiden brauchen await, deshalb stehen sie gekapselt am Ende.
async function downloadPruefungen() {
  abschnitt('Zwischenspeicher der Downloads');
  const wurzel = fs.mkdtempSync(path.join(os.tmpdir(), 'hats-cache-'));
  const echtesFetch = global.fetch;
  try {
    builder.init(wurzel);
    const basis = path.join(wurzel, 'download-cache', 'testkomp');
    const lege = (tag, name, inhalt) => {
      fs.mkdirSync(path.join(basis, tag), { recursive: true });
      fs.writeFileSync(path.join(basis, tag, name), inhalt);
    };
    lege('v1.0.0', 'alt.zip', 'a'.repeat(500));
    lege('v1.1.0', 'auch-alt.zip', 'b'.repeat(500));
    lege('v2.0.0', 'neu.zip', 'c'.repeat(300));
    pruefe('Größe wird zusammengezählt', builder.cacheInfo().bytes === 1300, String(builder.cacheInfo().bytes));

    // Ein Treffer im Zwischenspeicher räumt die anderen Fassungen mit weg
    await builder.downloadAsset(
      { id: 'testkomp' },
      { tag: 'v2.0.0' },
      { name: 'neu.zip', size: 300, url: 'https://example.invalid/neu.zip' },
      () => {},
      null
    );
    const uebrig = fs.readdirSync(basis);
    pruefe('alte Fassungen werden weggeräumt', uebrig.length === 1 && uebrig[0] === 'v2.0.0', uebrig.join(', '));
    pruefe('die aktuelle Fassung bleibt', fs.existsSync(path.join(basis, 'v2.0.0', 'neu.zip')));

    const frei = builder.clearCache();
    pruefe('Leeren meldet den freigegebenen Platz', frei.bytes === 300, String(frei.bytes));
    pruefe('danach ist nichts mehr gespeichert', builder.cacheInfo().bytes === 0);

    abschnitt('Wiederholung bei Netzaussetzern');
    const antwort = (inhalt) => ({
      ok: true,
      status: 200,
      headers: { get: () => String(inhalt.length) },
      body: (async function* () { yield Buffer.from(inhalt); })(),
    });

    let versuche = 0;
    global.fetch = async () => {
      versuche += 1;
      if (versuche < 3) throw new Error('Verbindung abgebrochen');
      return antwort('fertig');
    };
    const ziel = await builder.downloadAsset(
      { id: 'wackelig' },
      { tag: 'v1' },
      { name: 'datei.bin', size: 0, url: 'https://example.invalid/datei.bin' },
      () => {},
      null
    );
    pruefe('nach zwei Aussetzern klappt der dritte Versuch', versuche === 3, `${versuche} Versuche`);
    pruefe('die Datei ist vollständig angekommen', fs.readFileSync(ziel, 'utf8') === 'fertig');

    // Eine klare Absage des Servers wird nicht wiederholt
    versuche = 0;
    global.fetch = async () => {
      versuche += 1;
      return { ok: false, status: 404, headers: { get: () => null }, body: null };
    };
    let gemeldet = false;
    try {
      await builder.downloadAsset(
        { id: 'weg' },
        { tag: 'v1' },
        { name: 'fehlt.bin', size: 0, url: 'https://example.invalid/fehlt.bin' },
        () => {},
        null
      );
    } catch {
      gemeldet = true;
    }
    pruefe('ein 404 wird gemeldet statt wiederholt', gemeldet && versuche === 1, `${versuche} Versuche`);

    // Ein dauerhaft gestörtes Netz gibt nach den Versuchen auf
    versuche = 0;
    global.fetch = async () => {
      versuche += 1;
      throw new Error('kein Netz');
    };
    let aufgegeben = false;
    try {
      await builder.downloadAsset(
        { id: 'offline' },
        { tag: 'v1' },
        { name: 'x.bin', size: 0, url: 'https://example.invalid/x.bin' },
        () => {},
        null
      );
    } catch {
      aufgegeben = true;
    }
    pruefe('nach drei vergeblichen Versuchen wird aufgegeben', aufgegeben && versuche === 3, `${versuche} Versuche`);
    pruefe('keine halbe Datei bleibt liegen',
      !fs.existsSync(path.join(wurzel, 'download-cache', 'offline', 'v1', 'x.bin.part')));
  } finally {
    global.fetch = echtesFetch;
    fs.rmSync(wurzel, { recursive: true, force: true });
  }
}

// ── Ergebnis ────────────────────────────────────────────────────────────────
downloadPruefungen()
  .catch((e) => nichtOk('Download-Prüfungen abgebrochen', e.message))
  .then(() => {
    console.log('');
    if (fehler) {
      console.log(`FEHLGESCHLAGEN: ${fehler} Prüfung(en)`);
      process.exit(1);
    }
    console.log('Alle Prüfungen bestanden.');
  });
