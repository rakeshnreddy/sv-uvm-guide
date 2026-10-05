import { expect, test, type Page } from '@playwright/test';

import { PRACTICE_PAGES, requirePracticePage } from '@/lib/practice-links';

// Every practice page renders its "Learn this in" back link (tests/lib/practice-links.test.ts checks the source).
const practicePages = PRACTICE_PAGES.map((definition) => ({
  href: definition.href,
  title: definition.title,
  teacher: requirePracticePage(definition.href).lessons[0],
}));

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe('Practice linkage', () => {
  test.setTimeout(180000);

  for (const practice of practicePages) {
    test(`${practice.href} links back to ${practice.teacher.code}`, async ({ page }) => {
      await page.goto(practice.href);
      const nav = page.getByRole('navigation', { name: `Lessons for ${practice.title}`, exact: true });
      await expect(nav).toBeVisible({ timeout: 60000 });
      await expect(nav.getByRole('link').first()).toHaveAttribute('href', practice.teacher.href);
      const response = await page.request.get(practice.teacher.href);
      expect(response.status()).toBeLessThan(400);
    });
  }

  test('the Practice Hub names a lesson for each item and never links a coming-soon lab', async ({ page }) => {
    await page.goto('/practice');
    await expect(page.getByRole('heading', { level: 1, name: 'Practice Hub' })).toBeVisible({ timeout: 60000 });
    const comingSoon = page.getByRole('region', { name: 'Coming soon', exact: true });
    await expect(comingSoon.getByRole('heading', { level: 4 }).first()).toBeVisible();
    // Coming-soon titles are text; only their "Planned for" lesson links remain.
    const plannedLinks = await comingSoon.getByRole('link').evaluateAll((links) => links.map((a) => a.getAttribute('href')));
    for (const href of plannedLinks) expect(href).toMatch(/^\/curriculum\//);
    const labs = page.getByRole('region', { name: 'Labs', exact: true });
    await expect(labs.getByText('Learn it in').first()).toBeVisible();
  });

  test('interview prep keeps answers hidden until revealed', async ({ page }) => {
    await page.goto('/interview-prep');
    await expect(page.getByRole('heading', { level: 1, name: 'Interview prep' })).toBeVisible({ timeout: 60000 });
    const reveal = page.getByRole('button', { name: 'Reveal model answer' }).first();
    await expect(reveal).toHaveAttribute('aria-expanded', 'false');
    await reveal.click();
    const hide = page.getByRole('button', { name: 'Hide model answer' }).first();
    await expect(hide).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText('Model answer', { exact: true }).first()).toBeVisible();
  });

  test('the hub and interview prep fit a 390 px phone without horizontal scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of ['/practice', '/interview-prep']) {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 60000 });
      await expectNoHorizontalScroll(page);
    }
  });

  test('the mock lab page is gone (G30-PATH-V16)', async ({ page }) => {
    const response = await page.goto('/practice/lab/mock-lab');
    expect(response?.status()).toBe(404);
  });
});
