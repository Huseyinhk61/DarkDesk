// Package tile assets are rendered from the application's own vector logo.
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { chromium } from '@playwright/test';
const logo = await fs.readFile('public/icon.svg', 'utf8');
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
});
try {
  const page = await browser.newPage();
  await fs.mkdir('build/appx', { recursive: true });
  for (const [name, width, height] of [
    ['StoreLogo', 50, 50],
    ['Square44x44Logo', 44, 44],
    ['Square150x150Logo', 150, 150],
    ['Wide310x150Logo', 310, 150],
  ]) {
    const bytes = await page.evaluate(
      async ({ logo, width, height }) => {
        const image = new Image();
        image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(logo);
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        if (width !== height) {
          context.fillStyle = '#0f1117';
          context.fillRect(0, 0, width, height);
          context.drawImage(image, 22, 25, 100, 100);
          context.fillStyle = '#f9f7ff';
          context.font = '600 29px Arial';
          context.fillText('DarkDesk', 138, 87);
        } else {
          const size = width < 100 ? width : Math.round(width * 0.82);
          context.drawImage(image, (width - size) / 2, (height - size) / 2, size, size);
        }
        return canvas.toDataURL('image/png').split(',')[1];
      },
      { logo, width, height },
    );
    await fs.writeFile(`build/appx/${name}.png`, Buffer.from(bytes, 'base64'));
  }
  console.log('Generated four branded Store package tile assets.');
} finally {
  await browser.close();
}
