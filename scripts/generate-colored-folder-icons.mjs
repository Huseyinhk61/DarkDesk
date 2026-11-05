import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { folderThemes, folderColorIds, folderSvg } from '../shared/folder-appearance.js';
import glyphs from '../shared/minimal-icons.json' with { type: 'json' };

const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
});
try {
  const page = await browser.newPage();
  await page.setContent('<canvas width="256" height="256"></canvas>');
  let count = 0;
  for (const theme of folderThemes)
    for (const color of folderColorIds) {
      const directory = `build/folder-icons/themes/${theme}/${color}`;
      await mkdir(directory, { recursive: true });
      for (const icon of Object.keys(glyphs)) {
        const base64 = await page.evaluate(async (svg) => {
          const image = new Image();
          image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
          await image.decode();
          const canvas = document.querySelector('canvas'),
            context = canvas.getContext('2d');
          context.clearRect(0, 0, 256, 256);
          context.drawImage(image, 0, 0);
          return canvas.toDataURL('image/png').split(',')[1];
        }, folderSvg({ color, theme, icon }));
        const png = Buffer.from(base64, 'base64'),
          header = Buffer.alloc(22);
        header.writeUInt16LE(1, 2);
        header.writeUInt16LE(1, 4);
        header.writeUInt16LE(1, 10);
        header.writeUInt16LE(32, 12);
        header.writeUInt32LE(png.length, 14);
        header.writeUInt32LE(22, 18);
        await writeFile(`${directory}/${icon}.ico`, Buffer.concat([header, png]));
        count++;
      }
    }
  console.log(`Generated ${count} color-aware Windows folder icons.`);
} finally {
  await browser.close();
}
