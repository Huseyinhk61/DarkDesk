import { chromium } from '@playwright/test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as Lucide from 'lucide-react';
import * as Tabler from '@tabler/icons-react';
import minimal from '../shared/minimal-icons.json' with { type: 'json' };
import fs from 'node:fs/promises';
import { iconPacks } from '../shared/appearance.js';
const requested = process.argv.slice(2);
const packs = requested.length ? requested : iconPacks;
if (packs.some((pack) => !iconPacks.includes(pack))) throw Error('Unknown icon pack');
const names = {
  code: ['Code2', 'IconCode'],
  palette: ['Palette', 'IconPalette'],
  gamepad: ['Gamepad2', 'IconDeviceGamepad2'],
  file: ['FileText', 'IconFileText'],
  wrench: ['Wrench', 'IconTool'],
  music: ['Music2', 'IconMusic'],
  folder: ['Folder', 'IconFolder'],
  star: ['Star', 'IconStar'],
  rocket: ['Rocket', 'IconRocket'],
  globe: ['Globe', 'IconWorld'],
  archive: ['Archive', 'IconArchive'],
  heart: ['Heart', 'IconHeart'],
};
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
});
try {
  const page = await browser.newPage({
    viewport: { width: 256, height: 256 },
    deviceScaleFactor: 1,
  });
  for (const pack of packs) {
    await fs.mkdir('build/folder-icons/' + pack, { recursive: true });
    for (const [name, [l, t]] of Object.entries(names)) {
      const color =
        pack === 'rounded'
          ? '#9ee7ff'
          : pack === 'duotone'
            ? '#ffcf98'
            : pack === 'tabler'
              ? '#68e7d5'
              : pack === 'minimal'
                ? '#e8eaf0'
                : '#d0bbff';
      let glyph =
        pack === 'minimal'
          ? `<svg viewBox="0 0 24 24" width="96" height="96" fill="none" stroke="${color}" stroke-width="1.2"><path d="${minimal[name]}"/></svg>`
          : renderToStaticMarkup(
              React.createElement(pack === 'tabler' ? Tabler[t] : Lucide[l], {
                size: 96,
                color,
                strokeWidth: 1.65,
              }),
            );
      if (pack === 'rounded')
        glyph = renderToStaticMarkup(
          React.createElement(Tabler[t], {
            size: 96,
            color,
            strokeWidth: 2.7,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          }),
        );
      if (pack === 'duotone')
        glyph = `<svg viewBox="0 0 24 24" width="96" height="96" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="1" width="22" height="22" rx="7" fill="${color}" fill-opacity=".12" stroke="none"/><path d="${minimal[name]}" fill="${color}" fill-opacity=".18"/></svg>`;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><defs><linearGradient id="f" x2="0.7" y2="1"><stop stop-color="${pack === 'rounded' ? '#226b87' : pack === 'duotone' ? '#a75275' : pack === 'tabler' ? '#1c706d' : pack === 'minimal' ? '#626b7e' : '#8b70cf'}"/><stop offset="1" stop-color="${pack === 'rounded' ? '#193249' : pack === 'duotone' ? '#512b69' : pack === 'tabler' ? '#103a4c' : pack === 'minimal' ? '#303849' : '#453575'}"/></linearGradient></defs><path d="M25 70q0-18 18-18h65l20 21h85q18 0 18 18v116q0 18-18 18H43q-18 0-18-18Z" fill="url(#f)" stroke="${color}" stroke-opacity=".55" stroke-width="3"/><g transform="translate(80 108)">${glyph}</g></svg>`;
      await page.setContent(`<style>body{margin:0;background:transparent}</style>${svg}`);
      const png = await page.screenshot({ omitBackground: true });
      const header = Buffer.alloc(22);
      header.writeUInt16LE(1, 2);
      header.writeUInt16LE(1, 4);
      header.writeUInt16LE(1, 10);
      header.writeUInt16LE(32, 12);
      header.writeUInt32LE(png.length, 14);
      header.writeUInt32LE(22, 18);
      await fs.writeFile(`build/folder-icons/${pack}/${name}.ico`, Buffer.concat([header, png]));
    }
  }
  console.log(`Generated ${packs.length * Object.keys(names).length} native folder icons.`);
} finally {
  await browser.close();
}
