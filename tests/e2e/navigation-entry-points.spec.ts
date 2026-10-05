import { expect, test, type Page } from '@playwright/test';

import { EXPERT_INDEX_HREF, PLACEMENT_QUIZ_HREF } from '@/lib/learning-paths';
import { INTERVIEW_PREP_HREF, LABS_HREF, START_HERE_HREF } from '@/lib/site-links';

/**
 * Lead integration after the navigation foundations
 * (docs/curriculum-quality/reviews/lead-integration.build.md): the navbar and
 * course-outline entry points (G30-SIDE-04/05, G30-PATH-07), the home route
 * cards (NB2 request 3), the lab callout's sign-in note (G30-PRAC-10) and a
 * single theme toggle on Alt/Option+T (NB3 request 4).
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

  test('links Start here, Labs and Interview prep', async ({ page }) => {
    await page.goto('/practice');
    await waitForShell(page);
    const nav = mainNav(page);
    await expect(nav.getByRole('link', { name: 'Start here', exact: true })).toHaveAttribute('href', START_HERE_HREF);
    await expect(nav.getByRole('link', { name: 'Labs', exact: true })).toHaveAttribute('href', LABS_HREF);
    await expect(nav.getByRole('link', { name: 'Interview prep', exact: true })).toHaveAttribute('href', INTERVIEW_PREP_HREF);
    // A link to part of a page never claims to be the current page.
    await expect(nav.getByRole('link', { name: 'Labs', exact: true })).not.toHaveAttribute('aria-current');
  });

  test('"Start here" opens the route chooser on the overview', async ({ page }) => {
    await page.goto('/practice');
    await waitForShell(page);
    await mainNav(page).getByRole('link', { name: 'Start here', exact: true }).click();
    await expect(page).toHaveURL(/\/curriculum#routes$/);
    await expect(page.getByRole('region', { name: 'Choose your route' })).toBeInViewport();
  });

  test('"Labs" lands on the labs section of the Practice Hub', async ({ page }) => {
    await page.goto('/curriculum');
    await waitForShell(page);
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

  test('the course outline lists the same quick links, and a lesson page docks them under the outline', async ({ page }) => {
    await page.goto('/practice');
    await waitForShell(page);
    await page.getByRole('button', { name: 'Course outline', exact: true }).click();
    const quickLinks = page.getByRole('dialog', { name: 'Course outline' }).getByRole('list', { name: 'Quick links' });
    await expect(quickLinks.getByRole('link')).toHaveText(['Start here', 'Curriculum overview', 'Practice hub', 'Labs', 'Interview prep']);
    await page.keyboard.press('Escape');

    await page.goto(MAILBOXES);
    await waitForShell(page);
    const docked = page.getByRole('navigation', { name: 'Course outline' }).getByRole('list', { name: 'Quick links' });
    await expect(docked.getByRole('link', { name: 'Labs', exact: true })).toHaveAttribute('href', LABS_HREF);
  });
});

test.describe('navbar entry points on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the menu lists every entry point and the header still fits', async ({ page }) => {
    await page.goto('/curriculum');
    await waitForShell(page);
    const header = page.getByRole('banner');
    expect(await header.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await page.getByRole('button', { name: 'Open main menu' }).click();
    const menu = page.getByTestId('mobile-menu');
    for (const name of ['Start here', 'Curriculum', 'Practice', 'Labs', 'Interview prep']) {
      await expect(menu.getByRole('link', { name, exact: true })).toBeVisible();
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe('home route cards (NB2 request 3)', () => {
  test('send Junior to F1A, Practitioner to the placement quiz and Expert to the expert index', async ({ page }) => {
    await page.goto('/');
    const card = (name: string) => page.getByRole('article', { name, exact: true });
    await expect(card('Start here').getByRole('link', { name: 'Start here', exact: true })).toHaveAttribute('href', F1A);
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

test('the lesson lab callout says the lab needs sign-in (G30-PRAC-10)', async ({ page }) => {
  await page.goto(PSS);
  const launch = page.getByRole('link', { name: 'Launch Lab' });
  await expect(launch).toHaveAttribute('href', '/practice/lab/pss-portable-intent');
  await expect(launch).toHaveAccessibleDescription(/Sign in required/);
});

test('Alt/Option+T switches light and dark exactly once per press (NB3 request 4)', async ({ page }) => {
  await page.goto('/practice');
  await waitForShell(page);
  const html = page.locator('html');
  const before = await html.getAttribute('data-theme');
  expect(before).toMatch(/-(light|dark)$/);
  const flipped = before!.endsWith('-dark') ? before!.replace(/-dark$/, '-light') : before!.replace(/-light$/, '-dark');

  await page.keyboard.press('Alt+KeyT');
  await expect(html).toHaveAttribute('data-theme', flipped);
  await page.keyboard.press('Alt+KeyT');
  await expect(html).toHaveAttribute('data-theme', before!);
});
