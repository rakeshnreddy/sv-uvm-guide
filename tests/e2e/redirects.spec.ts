import { expect, test } from '@playwright/test';

import { PRACTICE_SECTION_HREF, tierSectionHref } from '@/lib/site-links';

/**
 * Index URLs that became sections of another page (SPEC-phases-2-4.md, "URLs")
 * answer with a temporary 307 whose Location carries the section's fragment,
 * and a browser lands on that section. Item URLs below them still render.
 */
const SECTION_REDIRECTS: readonly (readonly [string, string])[] = [
  ['/curriculum/T1_Foundational', tierSectionHref('T1_Foundational')],
  ['/curriculum/t3-advanced', tierSectionHref('T3_Advanced')],
  ['/exercises', PRACTICE_SECTION_HREF.exercises],
  ['/labs', PRACTICE_SECTION_HREF.labs],
  ['/practice/lab', PRACTICE_SECTION_HREF.labs],
  ['/practice/visualizations', PRACTICE_SECTION_HREF.interactiveModels],
  ['/visualizations', PRACTICE_SECTION_HREF.interactiveModels],
];

test.describe('Moved index URLs', () => {
  for (const [from, to] of SECTION_REDIRECTS) {
    test(`${from} answers 307 to ${to}`, async ({ request }) => {
      const response = await request.get(from, { maxRedirects: 0 });
      expect(response.status()).toBe(307);
      const location = new URL(response.headers().location ?? '', 'http://localhost');
      expect(`${location.pathname}${location.hash}`).toBe(to);
    });
  }

  test('a browser lands on the section', async ({ page }) => {
    await page.goto('/practice/lab');
    await expect(page).toHaveURL(/\/practice#labs$/);
    await expect(page.locator('#labs')).toBeAttached();

    await page.goto('/curriculum/T2_Intermediate');
    await expect(page).toHaveURL(/\/curriculum#t2$/);
    await expect(page.locator('#t2')).toBeAttached();
  });

  for (const item of ['/exercises/uvm-phase-sorter', '/practice/visualizations/uvm-phasing', '/visualizations/systemverilog-3d']) {
    test(`${item} still renders`, async ({ request }) => {
      const response = await request.get(item, { maxRedirects: 0 });
      expect(response.status()).toBe(200);
    });
  }
});
