import { expect, test, type Page } from '@playwright/test';

import { getAllLabs } from '@/lib/lab-registry';
import { PRACTICE_PAGES, practiceBreadcrumbs, requirePracticePage, requirePracticePager } from '@/lib/practice-links';
import { PRACTICE_SECTION_ID } from '@/lib/site-links';

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

  for (const practice of practicePages) {
    test(`${practice.href} shows Practice › section › item and the practice pager`, async ({ page }) => {
      const item = requirePracticePage(practice.href);
      const [root, section] = practiceBreadcrumbs(item);
      const pager = requirePracticePager(practice.href);
      await page.goto(practice.href);
      const trail = page.getByRole('navigation', { name: 'Breadcrumb' });
      await expect(trail.getByRole('link', { name: root.label, exact: true })).toHaveAttribute('href', root.href!);
      await expect(trail.getByRole('link', { name: section.label, exact: true })).toHaveAttribute('href', section.href!);
      await expect(trail.locator('[aria-current="page"]')).toHaveText(item.title);
      const nav = page.getByRole('navigation', { name: `More in ${pager.section.label}` });
      await expect(nav.getByRole('link', { name: `Back to Practice: ${pager.section.label}` })).toHaveAttribute(
        'href',
        pager.section.href,
      );
      if (pager.next) await expect(nav.locator('a[rel="next"]')).toHaveAttribute('href', pager.next.href);
      if (pager.prev) await expect(nav.locator('a[rel="prev"]')).toHaveAttribute('href', pager.prev.href);
    });
  }

  test('a lab page shows Practice › Labs › lab and the lab pager', async ({ page }) => {
    const lab = getAllLabs().find((entry) => entry.status === 'available')!;
    const href = `/practice/lab/${lab.id}`;
    const pager = requirePracticePager(href);
    await page.goto(href);
    const trail = page.getByRole('navigation', { name: 'Breadcrumb' });
    await expect(trail.getByRole('link', { name: 'Labs', exact: true })).toHaveAttribute('href', '/practice#labs');
    const nav = page.getByRole('navigation', { name: 'More in Labs' });
    await expect(nav.getByRole('link', { name: 'Back to Practice: Labs' })).toBeVisible({ timeout: 60000 });
    if (pager.next) await expect(nav.locator('a[rel="next"]')).toHaveAttribute('href', pager.next.href);
  });

  test('every section of /practice has its id and clears the sticky header', async ({ page }) => {
    await page.goto('/practice#exercises');
    for (const id of Object.values(PRACTICE_SECTION_ID)) await expect(page.locator(`#${id}`)).toHaveCount(1);
    const heading = page.locator('#exercises');
    await expect(heading).toBeInViewport({ timeout: 60000 });
    const top = await heading.evaluate((element) => element.getBoundingClientRect().top);
    expect(top).toBeGreaterThanOrEqual(64);
  });

  test('the Practice Hub names a lesson for each item and never links a coming-soon lab', async ({ page }) => {
    await page.goto('/practice');
    await expect(page.getByRole('heading', { level: 1, name: 'Practice hub' })).toBeVisible({ timeout: 60000 });
    const labs = page.getByRole('region', { name: 'Labs', exact: true });
    // Every row and tile leads with the teaching lesson's signal tag, linked to that lesson.
    const items = page.locator('[data-practice-row], [data-practice-tile]');
    const total = await items.count();
    expect(total).toBeGreaterThan(0);
    await expect(page.locator('[data-practice-row] a[data-lesson-tag], [data-practice-tile] a[data-lesson-tag]')).toHaveCount(total);
    const lessonHrefs = await page.locator('a[data-lesson-tag]').evaluateAll((links) => links.map((a) => a.getAttribute('href')));
    for (const href of lessonHrefs) expect(href).toMatch(/^\/curriculum\//);
    await expect(labs.locator('a[data-lesson-tag]').first()).toBeVisible();
    // A coming-soon lab row says so and has no link to the lab (its route 404s).
    const comingSoonRows = labs.locator('[data-practice-row]', { hasText: 'Coming soon' });
    for (const row of await comingSoonRows.all()) await expect(row.locator('a[href^="/practice/lab/"]')).toHaveCount(0);
  });

  test('interview prep keeps each answer collapsed until its question is opened', async ({ page }) => {
    await page.goto('/interview-prep');
    await expect(page.getByRole('heading', { level: 1, name: 'Interview prep' })).toBeVisible({ timeout: 60000 });
    await page.locator('[data-bank-row] h3 a').first().click();
    await expect(page).toHaveURL(/\/interview-prep\/[a-z-]+$/);
    const first = page.locator('details[data-question-level]').first();
    await expect(first).not.toHaveAttribute('open', '');
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
    await expect(first.getByRole('heading', { name: 'Model answer' })).toBeVisible();
  });

  test('the hub and interview prep fit a 390 px phone without horizontal scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of ['/practice', '/interview-prep', '/interview-prep/systemverilog']) {
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
