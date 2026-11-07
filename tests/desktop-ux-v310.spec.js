import { test, expect } from '@playwright/test';

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 900, height: 600 },
  { width: 1440, height: 900 },
  { width: 900, height: 600, scale: 130 },
]) {
  test(`all sidebar destinations and system status fit without scrolling at ${viewport.width}x${viewport.height} scale ${viewport.scale || 100}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    if (viewport.scale)
      await page.addInitScript(() => {
        localStorage.setItem('darkdesk-settings', JSON.stringify({ uiScale: 130 }));
        localStorage.setItem('darkdesk-appearance', JSON.stringify({ uiScale: 130 }));
      });
    await page.goto('/');
    await expect(page.locator('.item-card')).toHaveCount(12);
    const geometry = await page.locator('.sidebar').evaluate((el) => {
      const nav = el.querySelector('nav');
      return {
        overflow: getComputedStyle(nav).overflowY,
        scrolls: nav.scrollHeight > nav.clientHeight + 1,
        rects: [
          ...nav.querySelectorAll('button'),
          el.querySelector('.system'),
          el.querySelector('footer'),
        ].map((e) => {
          const r = e.getBoundingClientRect();
          return { top: r.top, bottom: r.bottom, height: r.height };
        }),
      };
    });
    expect(geometry.overflow).toBe('visible');
    expect(geometry.scrolls).toBe(false);
    expect(geometry.rects).toHaveLength(14);
    for (const rect of geometry.rects) {
      expect(rect.top).toBeGreaterThanOrEqual(0);
      expect(rect.bottom).toBeLessThanOrEqual(viewport.height);
      expect(rect.height).toBeGreaterThan(20);
    }
    await page.getByRole('button', { name: 'Yardım & Başlangıç', exact: true }).click();
    await expect(page.locator('.sidebar button[aria-current=page]')).toHaveText(
      'Yardım & Başlangıç',
    );
  });
}

test('focus settings persist, completion enters a break and plays a single audible bell', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.__bellTones = 0;
    window.AudioContext = class {
      state = 'running';
      currentTime = 0;
      destination = {};
      createOscillator() {
        return {
          frequency: {},
          connect() {},
          disconnect() {},
          start() {
            window.__bellTones++;
          },
          stop() {},
        };
      }
      createGain() {
        return {
          gain: {
            setValueAtTime() {},
            linearRampToValueAtTime() {},
            exponentialRampToValueAtTime() {},
          },
          connect() {},
          disconnect() {},
        };
      }
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Masaüstü Widget’ları', exact: true }).click();
  await page
    .locator('.widget-module-card')
    .filter({ has: page.getByRole('heading', { name: 'Odak sayacı', exact: true }) })
    .getByRole('button', { name: 'Önizlemeyi aç' })
    .click();
  const focus = page.locator('.focus-widget');
  await focus.locator('summary').click();
  await focus.getByLabel('Mola süresi (dk)').fill('3');
  await focus.getByLabel('Çalışma döngüsü', { exact: true }).fill('2');
  await focus.getByLabel('Vurgu rengi', { exact: true }).selectOption('mint');
  const volume = focus.getByRole('slider', { name: 'Zil seviyesi', exact: true });
  await volume.fill('35');
  await volume.blur();
  await focus.getByRole('button', { name: 'Zili dene', exact: true }).click();
  expect(await page.evaluate(() => window.__bellTones)).toBe(3);
  await page.evaluate(async () => {
    const { api } = await import('/src/service.js');
    await api.saveWidgets({ focus: { remaining: 1, endsAt: Date.now() + 600 } });
  });
  await expect(focus.getByRole('timer')).toHaveText('03:00');
  await expect(focus).toContainText('Mola · Döngü 1/2');
  expect(await page.evaluate(() => window.__bellTones)).toBe(6);
  await page.reload();
  await page.getByRole('button', { name: 'Masaüstü Widget’ları', exact: true }).click();
  await expect(page.locator('.focus-widget').getByRole('timer')).toHaveText('03:00');
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem('darkdesk-preview-widgets')).focus,
  );
  expect(saved.breakDuration).toBe(3);
  expect(saved.cycles).toBe(2);
  expect(saved.color).toBe('mint');
  expect(saved.volume).toBe(35);
});

test('widget opacity stays editable while the removed blur control is absent', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Masaüstü Widget’ları', exact: true }).click();
  await page
    .locator('.widget-module-card')
    .filter({ has: page.getByRole('heading', { name: 'Hızlı not', exact: true }) })
    .getByRole('button', { name: 'Önizlemeyi aç' })
    .click();
  await expect(page.getByRole('slider', { name: /bulanıklığı/ })).toHaveCount(0);
  const opacity = page.getByRole('slider', { name: 'Hızlı not opaklığı', exact: true });
  await opacity.fill('63');
  await opacity.blur();
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem('darkdesk-preview-widgets')).appearance.note.opacity,
      ),
    )
    .toBe(63);
  expect(
    await page.locator('.desktop-widget').evaluate((el) => getComputedStyle(el).backdropFilter),
  ).toBe('blur(16px)');
});
