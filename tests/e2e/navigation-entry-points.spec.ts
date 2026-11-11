import { expect, test, type Page } from '@playwright/test';

import { EXPERT_INDEX_HREF, PLACEMENT_QUIZ_HREF } from '@/lib/learning-paths';
import {
  CURRICULUM_HREF,
  DASHBOARD_HREF,
  INTERVIEW_PREP_HREF,
  LABS_HREF,
  START_HERE_HREF,
  tierSectionHref,
  tierSectionId,
} from '@/lib/site-links';

/**
 * Lead integration after the navigation foundations
 * (docs/curriculum-quality/reviews/lead-integration.build.md), brought up to
 * the phase 2 navigation (SPEC-phases-2-4.md): the navbar's five top items,
 * the course outline with no repeated site links and tier headings that open
 * their sections of /curriculum, the lesson breadcrumb, the home route
 * cards (NB2 request 3), the lab callout's progress note (labs open without
 * an account and keep progress in this browser) and a single theme toggle on
 * Alt/Option+T (NB3 request 4).
 */

const F1A = '/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index';
const MAILBOXES = '/curriculum/T2_Intermediate/I-SV-5_Synchronization_and_IPC/mailboxes';
const PSS = '/curriculum/T4_Expert/E-PSS-1_Portable_Stimulus_Standard/index';

/** The layout marks <html data-shortcuts-ready> once its keyboard shortcuts are live (after hydration). */
async function waitForShell(page: Page) {
  await page.locator('html[data-shortcuts-ready]').waitFor({ state: 'attached' });
}

const mainNav = (page: Page) => page.getByRole('banner').getByRole('navigation', { name: 'Main' });

test.describe('navbar entry points at 1280 px', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('shows the five top items; Labs sits in the Practice menu, and "Start here" is gone', async ({ page }) => {
    await page.goto('/practice');
    await waitForShell(page);
    const nav = mainNav(page);
    await expect(nav.getByRole('link', { name: 'Curriculum', exact: true })).toHaveAttribute('href', CURRICULUM_HREF);
    await expect(nav.getByRole('link', { name: 'Interview prep', exact: true })).toHaveAttribute('href', INTERVIEW_PREP_HREF);
    await expect(nav.getByRole('link', { name: 'Dashboard', exact: true })).toHaveAttribute('href', DASHBOARD_HREF);
    await expect(nav.getByRole('link', { name: 'Start here', exact: true })).toHaveCount(0);

    const practice = nav.getByRole('button', { name: 'Practice', exact: true });
    await practice.click();
    await expect(practice).toHaveAttribute('aria-expanded', 'true');
    const labs = nav.getByRole('link', { name: 'Labs', exact: true });
    await expect(labs).toHaveAttribute('href', LABS_HREF);
    // A link to part of a page never claims to be the current page.
    await expect(labs).not.toHaveAttribute('aria-current');
  });

  test('"Labs" in the Practice menu lands on the labs section of the Practice hub', async ({ page }) => {
    await page.goto('/curriculum');
    await waitForShell(page);
    await mainNav(page).getByRole('button', { name: 'Practice', exact: true }).click();
    await mainNav(page).getByRole('link', { name: 'Labs', exact: true }).click();
    await expect(page).toHaveURL(/\/practice#labs$/);
    await expect(page.getByRole('heading', { level: 2, name: 'Labs', exact: true })).toBeInViewport();
  });

  test('"Interview prep" opens the interview banks and is marked as the current page', async ({ page }) => {
    await page.goto('/curriculum');
    await waitForShell(page);
    await mainNav(page).getByRole('link', { name: 'Interview prep', exact: true }).click();
    await expect(page).toHaveURL(INTERVIEW_PREP_HREF);
    await expect(page.getByRole('heading', { level: 1, name: 'Interview prep' })).toBeVisible();
    await expect(mainNav(page).getByRole('link', { name: 'Interview prep', exact: true })).toHaveAttribute('aria-current', 'page');
  });

  test('the docked course outline repeats no site links, and its tier headings open their sections of /curriculum', async ({ page }) => {
    await page.goto(MAILBOXES);
    await waitForShell(page);
    const outline = page.getByRole('navigation', { name: 'Course outline' });
    await expect(outline.getByRole('link', { name: 'Mailboxes', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(outline.getByRole('list', { name: 'Quick links' })).toHaveCount(0);
    for (const href of [CURRICULUM_HREF, LABS_HREF, INTERVIEW_PREP_HREF, DASHBOARD_HREF, START_HERE_HREF]) {
      await expect(outline.locator(`a[href="${href}"]`)).toHaveCount(0);
    }

    await outline.getByRole('link', { name: /^Tier 3: Advanced\W/ }).click();
    await expect(page).toHaveURL(new RegExp(`${tierSectionHref('T3_Advanced')}$`));
    const heading = page.locator(`#${tierSectionId('T3_Advanced')}`).getByRole('heading', { level: 3 });
    await expect(heading).toBeInViewport();
    // The sticky 64 px header does not cover the heading.
    expect((await heading.boundingBox())!.y).toBeGreaterThanOrEqual(64);
  });

  test('the lesson breadcrumb links the tier to its section and shows the module code as a signal tag', async ({ page }) => {
    await page.goto(MAILBOXES);
    await waitForShell(page);
    const trail = page.getByRole('navigation', { name: 'Breadcrumb' });
    await expect(trail.getByRole('link', { name: 'Tier 2: Intermediate', exact: true })).toHaveAttribute('href', '/curriculum#t2');
    await expect(trail.locator('[data-signal-tag]')).toHaveText('I-SV-5');
    await expect(trail.locator('a[aria-current="page"]')).toHaveAttribute('href', MAILBOXES);
  });
});

test.describe('navbar entry points on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the menu lists every top item and the header still fits', async ({ page }) => {
    await page.goto('/curriculum');
    await waitForShell(page);
    const header = page.getByRole('banner');
    expect(await header.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await page.getByRole('button', { name: 'Open main menu' }).click();
    const menu = page.getByTestId('mobile-menu');
    for (const name of ['Curriculum', 'Practice hub', 'Labs', 'Interview prep', 'Dashboard']) {
      await expect(menu.getByRole('link', { name, exact: true })).toBeVisible();
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('the outline drawer starts with "Curriculum overview" and shows the current lesson', async ({ page }) => {
    await page.goto('/curriculum/T4_Expert/E-PSS-1_Portable_Stimulus_Standard/index');
    await waitForShell(page);
    await page.getByRole('button', { name: 'Course outline', exact: true }).click();
    const drawer = page.getByRole('dialog', { name: 'Course outline' });
    await expect(drawer.getByRole('link').first()).toHaveText('Curriculum overview');
    await expect(drawer.getByRole('link').first()).toHaveAttribute('href', CURRICULUM_HREF);
    const current = drawer.locator('a[aria-current="page"]');
    await expect(current).toBeFocused();
    await expect(current).toBeInViewport();
  });

  test('the lesson breadcrumb is one back link to the module', async ({ page }) => {
    await page.goto(MAILBOXES);
    await waitForShell(page);
    const trail = page.getByRole('navigation', { name: 'Breadcrumb' });
    await expect(trail.locator('ol')).toBeHidden();
    const back = trail.getByRole('link');
    await expect(back).toHaveCount(1);
    await expect(back).toHaveAttribute('href', '/curriculum/T2_Intermediate/I-SV-5_Synchronization_and_IPC/index');
  });
});

test.describe('home route cards (NB2 request 3)', () => {
  test('send Junior to F1A, Practitioner to the placement quiz and Expert to the expert index', async ({ page }) => {
    await page.goto('/');
    const card = (name: string) => page.getByRole('article', { name, exact: true });
    await expect(card('Start here').getByRole('link', { name: 'Begin the Junior route', exact: true })).toHaveAttribute('href', F1A);
    await expect(card('Working DV engineer').getByRole('link', { name: 'Find your level', exact: true })).toHaveAttribute(
      'href',
      PLACEMENT_QUIZ_HREF,
    );
    await expect(card('Jump in').getByRole('link', { name: 'Expert layers', exact: true })).toHaveAttribute('href', EXPERT_INDEX_HREF);

    await card('Jump in').getByRole('link', { name: 'Expert layers', exact: true }).click();
    await expect(page).toHaveURL(EXPERT_INDEX_HREF);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('fit a 390 px phone without sideways scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.getByRole('article', { name: 'Start here', exact: true })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test('the lesson lab callout says progress is saved in this browser', async ({ page }) => {
  await page.goto(PSS);
  const launch = page.getByRole('link', { name: 'Launch Lab' });
  await expect(launch).toHaveAttribute('href', '/practice/lab/pss-portable-intent');
  await expect(launch).toHaveAccessibleDescription(/saved in this browser/);
  await expect(page.getByTestId('lab-link')).not.toContainText(/sign[ -]in/i);
});

test('Alt/Option+T switches light and dark exactly once per press (NB3 request 4)', async ({ page }) => {
  await page.goto('/practice');
  await waitForShell(page);
  const html = page.locator('html');
  const before = await html.getAttribute('data-theme');
  expect(before).toMatch(/^(light|dark)$/);
  const flipped = before === 'dark' ? 'light' : 'dark';

  await page.keyboard.press('Alt+KeyT');
  await expect(html).toHaveAttribute('data-theme', flipped);
  await page.keyboard.press('Alt+KeyT');
  await expect(html).toHaveAttribute('data-theme', before!);
});
