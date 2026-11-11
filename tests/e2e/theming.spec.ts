import { test, expect } from '@playwright/test';

/*
 * Two modes on html[data-theme] (DESIGN.md section 7). next-themes and the
 * ThemeProvider script set the attribute before first paint, and no class is
 * added to <html>, so dark: styles never wait for hydration.
 */
test.describe('Theme and Styling Verification', () => {
  test('follows a dark device on a first visit, with no class on <html>', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'dark' });
    const page = await context.newPage();
    await page.goto('/');
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'dark');
    expect(await html.getAttribute('class')).toBeFalsy();
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe('dark');
    await context.close();
  });

  test('follows a light device on a first visit', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'light' });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await context.close();
  });

  test('applies a stored mode, or an old stored theme name, before any script bundle runs', async ({ browser }) => {
    for (const [stored, mode] of [
      ['light', 'light'],
      ['ocean-dark', 'dark'],
      ['violet-light', 'light'],
    ] as const) {
      const context = await browser.newContext({ colorScheme: mode === 'dark' ? 'light' : 'dark' });
      await context.addInitScript((value) => window.localStorage.setItem('theme', value), stored);
      const page = await context.newPage();
      // Only inline scripts run: the attribute must not depend on hydration.
      await page.route('**/_next/static/chunks/**', (route) => route.abort());
      await page.goto('/curriculum', { waitUntil: 'load' });
      await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
      expect(await page.evaluate(() => window.localStorage.getItem('theme'))).toBe(stored);
      await context.close();
    }
  });

  test('should toggle theme and apply correct styles to InteractiveCode', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'dark' });
    const page = await context.newPage();
    await page.goto('/curriculum/T2_Intermediate/I-UVM-3B_Advanced_Sequencing_and_Layering/virtual-sequences');

    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'dark');

    const button = page.getByRole('banner').getByRole('button', { name: 'Theme' });
    await button.click();
    await page.getByRole('menu', { name: 'Theme' }).getByRole('menuitemradio', { name: 'Light', exact: true }).click();

    await expect(html).toHaveAttribute('data-theme', 'light');
    expect(await page.evaluate(() => window.localStorage.getItem('theme'))).toBe('light');
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(button).toBeFocused();
    await context.close();
  });

  test('offers Light, Dark and System from one menu button, and each choice survives a reload (theme-16)', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'light', viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto('/curriculum');
    const html = page.locator('html');
    const button = page.getByRole('banner').getByRole('button', { name: 'Theme' });
    for (const [name, stored, mode] of [
      ['Dark', 'dark', 'dark'],
      ['Light', 'light', 'light'],
      // A light device: System gives light, and the menu says so.
      ['System (light)', 'system', 'light'],
    ] as const) {
      await button.click();
      const menu = page.getByRole('menu', { name: 'Theme' });
      await expect(menu.getByRole('menuitemradio')).toHaveCount(3);
      await menu.getByRole('menuitemradio', { name, exact: true }).click();
      await expect(html).toHaveAttribute('data-theme', mode);
      expect(await page.evaluate(() => window.localStorage.getItem('theme'))).toBe(stored);
      await page.reload();
      await page.locator('html[data-shortcuts-ready]').waitFor({ state: 'attached' });
      await expect(html).toHaveAttribute('data-theme', mode);
      await button.click();
      await expect(page.getByRole('menuitemradio', { name, exact: true, checked: true })).toBeVisible();
      await page.keyboard.press('Escape');
    }
    await context.close();
  });

  test('walks the theme menu by keyboard', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'dark', viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto('/curriculum');
    await page.locator('html[data-shortcuts-ready]').waitFor({ state: 'attached' });
    const button = page.getByRole('banner').getByRole('button', { name: 'Theme' });
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menuitemradio', { name: /^System/ })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(button).toBeFocused();
    await page.keyboard.press('Space');
    await page.keyboard.press('Home');
    await expect(page.getByRole('menuitemradio', { name: 'Light', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(button).toBeFocused();
    // Alt/Option+T still switches between light and dark.
    await page.keyboard.press('Alt+KeyT');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await context.close();
  });

  test('does not move the header between the server render and hydration (responsive-a11y-10)', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'dark', viewport: { width: 1440, height: 900 } });
    await context.addInitScript(() => window.localStorage.setItem('theme', 'system'));
    const page = await context.newPage();
    const boxes = () =>
      page.evaluate(() =>
        Array.from(document.querySelectorAll('header button, header a')).map((el) => {
          const r = el.getBoundingClientRect();
          return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
        }),
      );
    await page.route('**/_next/static/chunks/**', (route) => route.abort());
    await page.goto('/curriculum', { waitUntil: 'load' });
    const before = await boxes();
    await page.unroute('**/_next/static/chunks/**');
    await page.goto('/curriculum');
    await page.locator('html[data-shortcuts-ready]').waitFor({ state: 'attached' });
    expect(await boxes()).toEqual(before);
    await expect(page.getByRole('banner')).not.toContainText(/loading/i);
    await context.close();
  });

  test('offers the theme control on the landing, privacy and terms pages, in a header that does not move on hydration', async ({ browser }) => {
    for (const [path, width] of [
      ['/', 1440],
      ['/privacy-policy', 390],
      ['/terms-of-service', 1440],
    ] as const) {
      const context = await browser.newContext({ colorScheme: 'dark', viewport: { width, height: 900 } });
      const page = await context.newPage();
      const boxes = () =>
        page.evaluate(() =>
          Array.from(document.querySelectorAll('[data-testid="public-header"] button, [data-testid="public-header"] a')).map((el) => {
            const r = el.getBoundingClientRect();
            return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
          }),
        );
      await page.route('**/_next/static/chunks/**', (route) => route.abort());
      await page.goto(path, { waitUntil: 'load' });
      const before = await boxes();
      await page.unroute('**/_next/static/chunks/**');
      await page.goto(path);
      const header = page.getByTestId('public-header');
      // Below 768 px the theme choices are in the phone menu (hidden controls measure 0 in both renders).
      const phone = width < 768;
      const control = phone
        ? header.getByRole('button', { name: 'Open main menu' })
        : header.getByRole('button', { name: 'Theme', exact: true });
      await expect(control).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      expect(await boxes()).toEqual(before);
      // 64 px tall from 640 px, 56 px on phones, hairline included (border-box).
      expect((await header.boundingBox())!.height).toBeCloseTo(width < 640 ? 56 : 64, 0);

      await control.click();
      if (phone) {
        await page.getByTestId('public-menu').getByRole('radiogroup', { name: 'Theme' }).getByText('Light', { exact: true }).click();
      } else {
        await page.getByRole('menu', { name: 'Theme' }).getByRole('menuitemradio', { name: 'Light', exact: true }).click();
      }
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
      await context.close();
    }
  });

  test('the landing skip link moves focus to the hero H1', async ({ browser }) => {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      await page.goto('/');
      await expect(page.locator('main#main-content')).toHaveCount(1);
      await page.keyboard.press('Tab');
      await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
      await context.close();
    }
  });
});
