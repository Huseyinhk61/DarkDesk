const { folderSvg } = require('../shared/folder-appearance.js');
const crypto = require('node:crypto');

const cache = new Map();
let queue = Promise.resolve();
const pngMagic = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function pngToIco(png) {
  if (
    !Buffer.isBuffer(png) ||
    png.length < 24 ||
    png.length > 2 * 1024 * 1024 ||
    !png.subarray(0, 8).equals(pngMagic) ||
    png.readUInt32BE(16) !== 256 ||
    png.readUInt32BE(20) !== 256
  )
    throw Error('FOLDER_RENDER_FAILED');
  const header = Buffer.alloc(22);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(22, 18);
  return Buffer.concat([header, png]);
}

async function renderPng(svg) {
  // Only folderSvg's validated colors and bundled paths reach this document.
  // A separate sandbox renders the same vector art as the React preview; it
  // receives neither preload APIs nor paths from the user's filesystem.
  const { app, BrowserWindow } = require('electron');
  if (!app.isReady()) throw Error('FOLDER_RENDER_FAILED');
  const window = new BrowserWindow({
    width: 256,
    height: 256,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      offscreen: true,
      partition: 'darkdesk-folder-artwork',
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());
  const document =
    '<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; style-src \'unsafe-inline\'"><canvas width="256" height="256"></canvas><img hidden src="data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent(svg) +
    '">';
  let timer;
  try {
    const draw = async () => {
      await window.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(document));
      const base64 = await window.webContents.executeJavaScript(`(async () => {
        const image = document.querySelector('img');
        await image.decode();
        const canvas = document.querySelector('canvas');
        canvas.getContext('2d').drawImage(image, 0, 0, 256, 256);
        return canvas.toDataURL('image/png').split(',')[1];
      })()`);
      if (typeof base64 !== 'string' || base64.length > 3 * 1024 * 1024)
        throw Error('FOLDER_RENDER_FAILED');
      return Buffer.from(base64, 'base64');
    };
    return await Promise.race([
      draw(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error('FOLDER_RENDER_FAILED')), 15000);
      }),
    ]);
  } catch {
    throw Error('FOLDER_RENDER_FAILED');
  } finally {
    clearTimeout(timer);
    if (!window.isDestroyed()) window.destroy();
  }
}

function renderFolderIco(category, theme, renderer = renderPng) {
  const svg = folderSvg({ ...category, theme });
  const key = crypto.createHash('sha256').update(svg).digest('hex');
  // Injected renderers do not share the production cache with native rendering.
  if (renderer === renderPng && cache.has(key)) return Promise.resolve(Buffer.from(cache.get(key)));
  const operation = queue.then(async () => {
    if (renderer === renderPng && cache.has(key)) return Buffer.from(cache.get(key));
    const ico = pngToIco(await renderer(svg));
    if (renderer === renderPng) {
      cache.set(key, ico);
      while (cache.size > 64) cache.delete(cache.keys().next().value);
    }
    return Buffer.from(ico);
  });
  queue = operation.catch(() => {});
  return operation;
}

module.exports = { renderFolderIco, pngToIco };
