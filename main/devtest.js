'use strict';

// Entwicklungs- und Test-Hilfen – laufen nur, wenn die Umgebungsvariable
// HATS_SMOKE gesetzt ist. Im normalen Betrieb wird dieses Modul nie geladen.
//
//   HATS_SMOKE=1     → App starten, Renderer-Initialisierung prüfen, beenden
//   HATS_SHOT_DIR=…  → zusätzlich Screenshots aller Ansichten speichern
//   HATS_TEST_DEPS=1 → zusätzlich Abhängigkeits-Automatik der Toggles testen
//   HATS_TEST_DNS=1  → zusätzlich die Rückfrage beim Abschalten der 90DNS-Sperre

const fs = require('fs');
const path = require('path');

async function waitForReady(win) {
  for (let i = 0; i < 40; i++) {
    try {
      if (await win.webContents.executeJavaScript('window.__APP_READY__ === true')) return true;
    } catch {
      /* Renderer noch nicht bereit */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

// Die Versionsabfrage laeuft nach dem Start noch weiter. Fuer Screenshots
// lohnt es sich zu warten, sonst steht auf jeder Karte "Version wird geladen".
async function waitForReleases(win) {
  for (let i = 0; i < 60; i++) {
    try {
      const fertig = await win.webContents.executeJavaScript(
        '(() => { const s = window.__APP_STATE__; return Boolean(s && Object.keys(s.releases).length); })()'
      );
      if (fertig) return true;
    } catch {
      /* Renderer noch nicht so weit */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

async function takeScreenshots(win, shotDir) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  await waitForReleases(win);
  await sleep(600);
  const shot = async (name) => fs.writeFileSync(path.join(shotDir, name), (await win.webContents.capturePage()).toPNG());
  const click = (sel) => win.webContents.executeJavaScript(`document.querySelector('${sel}').click(); true`);

  for (const view of ['components', 'hekate', 'build']) {
    await win.webContents.executeJavaScript(
      `document.querySelector('.nav-item[data-view="${view}"]').click();` +
        `document.querySelector('.main').scrollTop = 0; true`
    );
    await new Promise((r) => setTimeout(r, 700));
    fs.writeFileSync(
      path.join(shotDir, `view-${view}.png`),
      (await win.webContents.capturePage()).toPNG()
    );
    if (view === 'components') {
      const maxScroll = await win.webContents.executeJavaScript(
        'const m = document.querySelector(".main"); m.scrollHeight - m.clientHeight'
      );
      let shot = 2;
      for (const frac of [0.42, 0.72, 1]) {
        await win.webContents.executeJavaScript(
          `document.querySelector('.main').scrollTop = ${Math.round(maxScroll * frac)}; true`
        );
        await new Promise((r) => setTimeout(r, 400));
        fs.writeFileSync(
          path.join(shotDir, `view-components-${shot}.png`),
          (await win.webContents.capturePage()).toPNG()
        );
        shot += 1;
      }
    }
  }

  // Suche und Release-Notizen
  await click('.nav-item[data-view="components"]');
  // In einer Funktion kapseln: im Seiten-Scope würde ein zweites "const s"
  // mit dem ersten kollidieren.
  const setSearch = (value) =>
    win.webContents.executeJavaScript(
      `(() => { const s = document.querySelector('#comp-search'); s.value = ${JSON.stringify(value)};` +
        `s.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`
    );
  await setSearch('overlay');
  await sleep(400);
  await shot('view-components-search.png');
  await setSearch('');
  await sleep(300);
  const hasNotes = await win.webContents.executeJavaScript(
    "(() => { const b = document.querySelector('.badge.version.clickable'); if (b) b.click(); return Boolean(b); })()"
  );
  if (hasNotes) {
    await sleep(400);
    await shot('notes-modal.png');
    await click('#btn-notes-close');
    await sleep(200);
  }

  // Hekate-Ansicht ist lang → zusätzlich ganz unten abbilden (Auto-NoGC, DNS-Block)
  await click('.nav-item[data-view="hekate"]');
  await win.webContents.executeJavaScript('document.querySelector(".main").scrollTop = document.querySelector(".main").scrollHeight; true');
  await sleep(400);
  await shot('view-hekate-bottom.png');

  // Einstellungen-Fenster + englische Ansicht
  await click('.nav-item[data-view="components"]');
  await win.webContents.executeJavaScript('document.querySelector(".main").scrollTop = 0; true');
  await sleep(300);
  await click('#btn-settings');
  await sleep(400);
  await shot('settings-modal.png');
  await click('.lang-opt[data-lang="en"]');
  await sleep(400);
  await shot('settings-modal-en.png');
  await click('#btn-settings-close');
  await sleep(400);
  await shot('view-components-en.png');
  await click('.nav-item[data-view="hekate"]');
  await sleep(400);
  await shot('view-hekate-en.png');
}

// Prüft im echten UI für JEDE Komponente mit Abhängigkeiten, dass ein Klick
// darauf alle (auch transitiven) benötigten Komponenten automatisch mit
// aktiviert – plus die umgekehrte Kaskade beim Deaktivieren.
async function testDependencies(win) {
  const res = await win.webContents.executeJavaScript(`(() => {
    const S = window.__APP_STATE__;
    const byId = new Map(S.components.map((c) => [c.id, c]));
    const cb = (id) => document.querySelector('.comp-card[data-id="' + id + '"] input[type=checkbox]');
    const sel = () => new Set(S.settings.selected);

    // transitive Hülle der requires-Kette
    const transReq = (id) => {
      const out = new Set();
      const walk = (x) => {
        for (const d of (byId.get(x) || {}).requires || []) {
          if (!out.has(d)) { out.add(d); walk(d); }
        }
      };
      walk(id);
      return [...out];
    };

    // Alles außer Pflicht-Komponenten abschalten (mehrere Durchläufe wg. Kaskade)
    const resetBaseline = () => {
      for (let pass = 0; pass < 12; pass++) {
        let any = false;
        for (const c of S.components) {
          const box = cb(c.id);
          if (box && box.checked && !box.disabled) { box.click(); any = true; }
        }
        if (!any) break;
      }
    };

    const out = { forward: [], reverse: [] };

    // Vorwärts: jede Komponente mit Abhängigkeiten anklicken → alle deps müssen an sein
    for (const c of S.components) {
      const needs = transReq(c.id);
      if (!needs.length) continue;
      resetBaseline();
      const box = cb(c.id);
      if (!box) { out.forward.push({ id: c.id, name: c.name, ok: false, missing: ['(kein Toggle)'] }); continue; }
      if (!box.checked) box.click();
      const s = sel();
      const missing = needs.filter((r) => !s.has(r));
      out.forward.push({ id: c.id, name: c.name, needs, ok: missing.length === 0 && s.has(c.id), missing });
    }

    // Rückwärts: eine Abhängigkeit abschalten → Abhängige müssen mit rausfallen
    resetBaseline();
    const fps = cb('fpslocker');
    if (fps && !fps.checked) fps.click(); // zieht saltynx + ovlloader mit
    const before = sel();
    const ovl = cb('ovlloader');
    if (ovl && ovl.checked) ovl.click(); // ovlloader aus → fpslocker muss raus, saltynx bleibt
    const after = sel();
    out.reverse.push({ name: 'ovlloader aus → fpslocker deaktiviert', ok: before.has('fpslocker') && !after.has('fpslocker') });
    out.reverse.push({ name: 'ovlloader aus → saltynx bleibt (haengt nicht an ovlloader)', ok: after.has('saltynx') });

    return out;
  })()`);

  let ok = true;
  console.log('— Vorwärts (Klick aktiviert alle benötigten Komponenten) —');
  for (const r of res.forward) {
    ok = ok && r.ok;
    console.log(`${r.ok ? 'OK  ' : 'FAIL'}  ${r.name} → braucht [${(r.needs || []).join(', ')}]` + (r.ok ? '' : `  FEHLT: [${r.missing.join(', ')}]`));
  }
  console.log('— Rückwärts (Kaskade beim Deaktivieren) —');
  for (const r of res.reverse) {
    ok = ok && r.ok;
    console.log(`${r.ok ? 'OK  ' : 'FAIL'}  ${r.name}`);
  }
  console.log(`— ${res.forward.length} Komponenten mit Abhängigkeiten geprüft —`);
  return ok;
}

// Prueft die Rueckfrage beim Abschalten der Nintendo-Sperre: Ablehnen muss den
// Schalter zurueckdrehen, Bestaetigen muss ihn wirklich abschalten. Die sysMMC
// warnt nur, wenn dort auch CFW startet.
async function testDnsWarning(win) {
  const res = await win.webContents.executeJavaScript(`(() => {
    const S = window.__APP_STATE__;
    const hek = () => S.settings.hekate;
    const zeigeHekate = () => document.querySelector('.nav-item[data-view="hekate"]').click();
    const box = (i) => document.querySelectorAll('#dns-block input[type=checkbox]')[i];
    const out = [];
    const echtesConfirm = window.confirm;
    let gefragt = 0;
    const mitConfirm = (antwort, fn) => {
      gefragt = 0;
      window.confirm = () => { gefragt++; return antwort; };
      try { fn(); } finally { window.confirm = echtesConfirm; }
      return gefragt;
    };

    zeigeHekate();

    // 1. emuMMC abschalten und ablehnen -> bleibt an
    hek().blockNintendoEmu = true;
    document.querySelector('.nav-item[data-view="hekate"]').click();
    const n1 = mitConfirm(false, () => box(0).click());
    out.push({ name: 'emuMMC: Abschalten abgelehnt -> bleibt an', ok: n1 === 1 && hek().blockNintendoEmu === true && box(0).checked === true });

    // 2. emuMMC abschalten und bestaetigen -> geht aus
    const n2 = mitConfirm(true, () => box(0).click());
    out.push({ name: 'emuMMC: Abschalten bestaetigt -> geht aus', ok: n2 === 1 && hek().blockNintendoEmu === false });

    // 3. Wieder einschalten fragt NICHT nach
    const n3 = mitConfirm(false, () => box(0).click());
    out.push({ name: 'emuMMC: Einschalten fragt nicht nach', ok: n3 === 0 && hek().blockNintendoEmu === true });

    // Boot-Eintraege ueber die Oberflaeche schalten. Nur so wird der
    // DNS-Bereich neu aufgebaut, genau wie beim echten Klick des Nutzers.
    const bootBox = (key) => document.querySelectorAll('#boot-entries input[type=checkbox]')[S.entryOrder.indexOf(key)];
    const setzeBoot = (key, an) => { if (bootBox(key).checked !== an) bootBox(key).click(); };
    const setzeSysSperre = (an) => { if (box(1).checked !== an) mitConfirm(true, () => box(1).click()); };

    // 4. sysMMC ohne CFW-auf-sysMMC: keine Warnung
    setzeBoot('cfw_sys', false);
    setzeSysSperre(true);
    const n4 = mitConfirm(false, () => box(1).click());
    out.push({ name: 'sysMMC ohne CFW-Eintrag: keine Rueckfrage', ok: n4 === 0 && hek().blockNintendoSys === false });

    // 5. sysMMC MIT CFW-auf-sysMMC: warnt
    setzeBoot('cfw_sys', true);
    setzeSysSperre(true);
    const n5 = mitConfirm(false, () => box(1).click());
    out.push({ name: 'sysMMC mit CFW-Eintrag: warnt und bleibt an', ok: n5 === 1 && hek().blockNintendoSys === true });
    setzeBoot('cfw_sys', false);

    // 6. Warntexte gibt es in beiden Sprachen
    const fehlt = [];
    for (const l of ['de', 'en']) for (const k of ['dns.emu.warnOff', 'dns.sys.warnOff']) {
      if (!window.I18N[l] || !window.I18N[l][k]) fehlt.push(l + '/' + k);
    }
    out.push({ name: 'Warntexte in beiden Sprachen', ok: fehlt.length === 0, extra: fehlt.join(', ') });

    return out;
  })()`);

  let ok = true;
  console.log('— Warnung beim Abschalten der Nintendo-Sperre —');
  for (const r of res) {
    ok = ok && r.ok;
    console.log(`${r.ok ? 'OK  ' : 'FAIL'}  ${r.name}${r.extra ? '  (' + r.extra + ')' : ''}`);
  }
  return ok;
}

// Fehler aus dem Hauptprozess landen über IPC im Renderer und von dort in
// einem Hinweisfenster. Electron hängt dabei einen technischen Vorspann an.
// Dieser Test hält fest, was der Nutzer am Ende wirklich zu lesen bekommt.
async function testIpcFehlertexte(win) {
  const res = await win.webContents.executeJavaScript(`(async () => {
    const out = [];
    const faelle = [
      ['sd:copy ohne Pack', () => window.api.copyToDrive({ packDir: 'C:\\\\gibtsnicht', driveLetter: 'Z:' })],
      ['pack:build in fremden Ordner', () => window.api.buildPack({ outputDir: 'C:\\\\Windows', selectedIds: [], hekateConfig: {} })],
    ];
    for (const [name, fn] of faelle) {
      try {
        await fn();
        out.push({ name, roh: '(kein Fehler)', sauber: '(kein Fehler)' });
      } catch (e) {
        out.push({ name, roh: String(e && e.message), sauber: window.__FEHLERTEXT__ ? window.__FEHLERTEXT__(e) : null });
      }
    }
    return out;
  })()`);

  let ok = true;
  console.log('— Fehlertexte, wie sie beim Nutzer ankommen —');
  for (const r of res) {
    const sauber = r.sauber != null ? r.sauber : r.roh;
    const technisch = /invoking remote method|^Error:|^TypeError:/i.test(sauber);
    if (technisch) ok = false;
    console.log(`${technisch ? 'FAIL' : 'OK  '}  ${r.name}`);
    console.log(`        roh    : ${r.roh}`);
    console.log(`        angezeigt: ${sauber}`);
  }
  return ok;
}

// Bauen und Kopieren greifen auf denselben Ordner zu und duerfen sich nicht
// ueberschneiden. Der Hauptprozess muss das ablehnen, und die Oberflaeche darf
// keine Knoepfe anbieten, die ins Leere fuehren.
async function testGleichzeitig(win) {
  const res = await win.webContents.executeJavaScript(`(async () => {
    const S = window.__APP_STATE__;
    const out = [];
    const knoepfe = () => [...document.querySelectorAll('#drive-list button')];
    const alleGesperrt = () => knoepfe().length > 0 && knoepfe().every((b) => b.disabled);

    // Laufwerke vortaeuschen, damit es ueberhaupt Knoepfe gibt
    S.drives = [{ letter: 'Z:', label: 'Test', fileSystem: 'FAT32', size: 100, free: 50, fat32: true }];
    window.__render_drives__();
    out.push({ name: 'Knopf da und frei', ok: knoepfe().length === 1 && !knoepfe()[0].disabled });

    // Waehrend "Kopieren" muessen die Knoepfe gesperrt sein
    S.copying = true; window.__render_drives__();
    out.push({ name: 'beim Kopieren gesperrt', ok: alleGesperrt() });
    S.copying = false; window.__render_drives__();
    out.push({ name: 'danach wieder frei', ok: !knoepfe()[0].disabled });

    // Waehrend "Bauen" ebenso
    S.building = true; window.__render_drives__();
    out.push({ name: 'beim Bauen gesperrt', ok: alleGesperrt() });
    S.building = false; window.__render_drives__();
    out.push({ name: 'danach wieder frei', ok: !knoepfe()[0].disabled });
    S.drives = [];
    window.__render_drives__();

    // Die Sperre im Hauptprozess laesst sich von hier aus nicht ehrlich
    // pruefen: Ein Build, der lange genug laeuft, braucht echte Downloads.
    // Dass beide Richtungen abgefragt werden, prueft check.js am Quelltext.

    // Der Renderer darf waehrend eines Vorgangs gar nicht erst loslegen
    S.copying = true;
    const vorher = S.copying;
    await window.__copy_to_drive__({ letter: 'Z:', label: 'Test' });
    out.push({ name: 'Kopieren startet nicht doppelt', ok: S.copying === vorher });
    S.copying = false;

    return out;
  })()`);

  let ok = true;
  console.log('— Bauen und Kopieren schliessen sich aus —');
  for (const r of res) {
    ok = ok && r.ok;
    console.log(`${r.ok ? 'OK  ' : 'FAIL'}  ${r.name}${r.extra ? '  (' + r.extra + ')' : ''}`);
  }
  return ok;
}

function register(win, app) {
  win.webContents.on('console-message', (_e, _level, message) => {
    console.log('[renderer]', message);
  });
  win.webContents.on('did-finish-load', async () => {
    let ok = await waitForReady(win);
    try {
      if (ok && process.env.HATS_SHOT_DIR) await takeScreenshots(win, process.env.HATS_SHOT_DIR);
      if (ok && process.env.HATS_TEST_DEPS) ok = await testDependencies(win);
      if (ok && process.env.HATS_TEST_DNS) ok = await testDnsWarning(win);
      if (ok && process.env.HATS_TEST_IPC) ok = await testIpcFehlertexte(win);
      if (ok && process.env.HATS_TEST_BUSY) ok = await testGleichzeitig(win);
    } catch (err) {
      console.log('TESTFEHLER:', err.message);
      ok = false;
    }
    console.log(ok ? 'SMOKE OK' : 'SMOKE FAIL');
    app.exit(ok ? 0 : 1);
  });
}

module.exports = { register };
