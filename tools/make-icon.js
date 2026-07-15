'use strict';

// Erzeugt das App-Logo als build/icon.ico (Windows-Icon, mehrere Größen)
// und renderer/icon.png (Fenster-Icon & Sidebar-Logo).
// Aufruf: npx electron tools/make-icon.js

const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SIZES = [256, 128, 64, 48, 32, 16];

// Zeichnet das Logo in der 1024er-Fläche: roter Verlaufs-Squircle mit
// weißem Joy-Con-Paar (passend zum Logo in der App-Sidebar).
const DRAW_FN = `
(sizes) => {
  const draw = (size) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.scale(size / 1024, size / 1024);

    // Hintergrund: Verlaufs-Squircle
    const bg = ctx.createLinearGradient(0, 0, 1024, 1024);
    bg.addColorStop(0, '#e60039');
    bg.addColorStop(1, '#ff5c38');
    ctx.beginPath();
    ctx.roundRect(0, 0, 1024, 1024, 230);
    ctx.fillStyle = bg;
    ctx.fill();

    // Sanftes Licht von oben
    const light = ctx.createLinearGradient(0, 0, 0, 1024);
    light.addColorStop(0, 'rgba(255,255,255,0.16)');
    light.addColorStop(0.55, 'rgba(255,255,255,0)');
    ctx.beginPath();
    ctx.roundRect(0, 0, 1024, 1024, 230);
    ctx.fillStyle = light;
    ctx.fill();

    // Joy-Con-Paar
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(250, 180, 240, 664, 120);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(534, 180, 240, 664, 120);
    ctx.fill();

    // Analog-Sticks (ausgestanzt mit dem Hintergrund-Verlauf)
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(370, 386, 64, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(654, 638, 64, 0, Math.PI * 2);
    ctx.fill();

    return canvas.toDataURL('image/png');
  };
  return Object.fromEntries(sizes.map((s) => [s, draw(s)]));
}
`;

// ICO-Container: Header + Verzeichnis + PNG-Daten (PNG-Einträge sind ab
// Windows Vista für alle Größen zulässig; electron-builder macht es genauso).
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // Typ 1 = ICO
  header.writeUInt16LE(images.length, 4);

  const entries = [];
  const datas = [];
  let offset = 6 + 16 * images.length;
  for (const { size, buf } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // Breite (0 = 256)
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // Höhe
    entry.writeUInt16LE(1, 4); // Farbebenen
    entry.writeUInt16LE(32, 6); // Bits pro Pixel
    entry.writeUInt32LE(buf.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    datas.push(buf);
    offset += buf.length;
  }
  return Buffer.concat([header, ...entries, ...datas]);
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  await win.loadURL('about:blank');
  const dataUrls = await win.webContents.executeJavaScript(`(${DRAW_FN})(${JSON.stringify(SIZES)})`);

  const images = SIZES.map((size) => ({
    size,
    buf: Buffer.from(dataUrls[size].split(',')[1], 'base64'),
  }));

  fs.mkdirSync(path.join(ROOT, 'build'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'build', 'icon.ico'), buildIco(images));
  fs.writeFileSync(path.join(ROOT, 'renderer', 'icon.png'), images[0].buf);

  console.log('ICON OK – build/icon.ico + renderer/icon.png geschrieben');
  app.exit(0);
});
