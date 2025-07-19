import { test, expect } from '@playwright/test';

/**
 * Utility to convert a CSS variable containing an HSL value to its final RGB
 * representation using the browser's computed styles.
 */
async function cssVarToRgb(page: any, variable: string) {
  return page.evaluate((v) => {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue(v)
      .trim();
    const el = document.createElement('div');
    el.style.color = `hsl(${value})`;
    document.body.appendChild(el);
    const rgb = getComputedStyle(el).color;
    el.remove();
    return rgb;
  }, variable);
}

test.describe('Theme and Styling Verification', () => {
  test('should apply correct default (dark) theme styles', async ({ page }) => {
    await page.goto('/');
    const body = page.locator('body');
    const expectedBg = await cssVarToRgb(page, '--background');
    await expect(body).toHaveCSS('background-color', expectedBg);
  });

  test('should toggle theme and apply correct styles to InteractiveCode', async ({ page }) => {
    await page.goto('/uvm-concepts/uvm-virtual-sequencer');

    const interactiveCode = page.getByTestId('interactive-code');

    // Check initial (dark) theme
    const darkCardBg = await cssVarToRgb(page, '--card');
    const darkBorder = await cssVarToRgb(page, '--border');
    await expect(interactiveCode).toHaveCSS('background-color', darkCardBg);
    await expect(interactiveCode).toHaveCSS('border-color', darkBorder);

    // Toggle theme
    await page.getByRole('button', { name: 'Toggle theme' }).click();

    // Check light theme
    const lightBodyBg = await cssVarToRgb(page, '--background');
    const lightCardBg = await cssVarToRgb(page, '--card');
    const lightBorder = await cssVarToRgb(page, '--border');
    await expect(page.locator('body')).toHaveCSS('background-color', lightBodyBg);
    await expect(interactiveCode).toHaveCSS('background-color', lightCardBg);
    await expect(interactiveCode).toHaveCSS('border-color', lightBorder);
  });
});


