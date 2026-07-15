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

// Klickt Komponenten-Toggles im echten UI und prüft, ob Abhängigkeiten
// automatisch aktiviert bzw. Abhängige deaktiviert werden.
async function testDependencies(win) {
  const click = (id) =>
    win.webContents.executeJavaScript(
      `document.querySelector('.comp-card[data-id="${id}"] input[type=checkbox]').click(); true`
    );
  const selection = () =>
    win.webContents.executeJavaScript('JSON.stringify(window.__APP_STATE__.settings.selected)')
      .then((s) => new Set(JSON.parse(s)));
  const isChecked = (id) =>
    win.webContents.executeJavaScript(
      `document.querySelector('.comp-card[data-id="${id}"] input[type=checkbox]').checked`
    );

  const results = [];
  const check = (name, cond) => {
    results.push(cond);
    console.log(`${cond ? 'OK  ' : 'FAIL'}  ${name}`);
  };

  // Ausgangszustand: relevante Komponenten deaktivieren
  for (const id of ['fpslocker', 'saltynx', 'ovlloader', 'sysclkovl', 'sysclk']) {
    if (await isChecked(id)) await click(id);
  }

  // 1) FPSLocker aktivieren → SaltyNX + nx-ovlloader automatisch an
  await click('fpslocker');
  let sel = await selection();
  check('FPSLocker → SaltyNX automatisch aktiv', sel.has('saltynx'));
  check('FPSLocker → nx-ovlloader automatisch aktiv', sel.has('ovlloader'));
  check('FPSLocker selbst aktiv', sel.has('fpslocker'));

  // 2) nx-ovlloader deaktivieren → FPSLocker fliegt mit raus, SaltyNX bleibt
  await click('ovlloader');
  sel = await selection();
  check('ovlloader aus → FPSLocker automatisch deaktiviert', !sel.has('fpslocker'));
  check('ovlloader aus → SaltyNX bleibt aktiv (hängt nicht an ovlloader)', sel.has('saltynx'));

  // 3) sys-clk Overlay aktivieren → sys-clk-Basis + ovlloader automatisch an
  await click('sysclkovl');
  sel = await selection();
  check('sys-clk Overlay → sys-clk (Basis) automatisch aktiv', sel.has('sysclk'));
  check('sys-clk Overlay → nx-ovlloader automatisch aktiv', sel.has('ovlloader'));

  // 4) Toggle-Optik entspricht dem Zustand
  check('Checkbox-Zustand konsistent (saltynx)', await isChecked('saltynx'));

  return results.every(Boolean);
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
