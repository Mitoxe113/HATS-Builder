'use strict';

// Entwicklungs- und Test-Hilfen – laufen nur, wenn die Umgebungsvariable
// HATS_SMOKE gesetzt ist. Im normalen Betrieb wird dieses Modul nie geladen.
//
//   HATS_SMOKE=1     → App starten, Renderer-Initialisierung prüfen, beenden
//   HATS_SHOT_DIR=…  → zusätzlich Screenshots aller Ansichten speichern
//   HATS_TEST_DEPS=1 → zusätzlich Abhängigkeits-Automatik der Toggles testen

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

async function takeScreenshots(win, shotDir) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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

function register(win, app) {
  win.webContents.on('console-message', (_e, _level, message) => {
    console.log('[renderer]', message);
  });
  win.webContents.on('did-finish-load', async () => {
    let ok = await waitForReady(win);
    try {
      if (ok && process.env.HATS_SHOT_DIR) await takeScreenshots(win, process.env.HATS_SHOT_DIR);
      if (ok && process.env.HATS_TEST_DEPS) ok = await testDependencies(win);
    } catch (err) {
      console.log('TESTFEHLER:', err.message);
      ok = false;
    }
    console.log(ok ? 'SMOKE OK' : 'SMOKE FAIL');
    app.exit(ok ? 0 : 1);
  });
}

module.exports = { register };
