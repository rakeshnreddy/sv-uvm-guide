import { expect, test, type Page } from '@playwright/test';

import { CURRICULUM_HREF, INTERVIEW_PREP_HREF, LABS_HREF, TIER_LINKS } from '@/lib/site-links';

/**
 * The landing page as it is after the landing rework (DESIGN.md sections 9
 * and 10): the headline, the one primary action for a first-time visitor and
 * for a returning learner, "The path" with one row per tier, the "How you
 * learn here" links, and no sideways scroll on a phone. Replaces the old
 * hero-animation spec, which pinned the previous headline.
 */

const F1A = '/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index';
const MAILBOXES = '/curriculum/T2_Intermediate/I-SV-5_Synchronization_and_IPC/mailboxes';

/** The e2e server compiles a page on its first visit, so navigations get room. */
const NAV_TIMEOUT = 60_000;

/**
 * The landing page is server HTML with small client islands (no keyboard
 * shortcuts layout, so no data-shortcuts-ready): wait for the headline, and let
 * the returning-learner checks wait on the primary action's data-state.
 */
async function openLanding(page: Page) {
  await page.goto('/', { timeout: NAV_TIMEOUT });
  await page.getByRole('heading', { level: 1 }).waitFor({ timeout: NAV_TIMEOUT });
}

/** A lesson visit in this browser, as the lesson pages record it. */
async function seedVisit(page: Page, moduleId: string, lessonSlug: string) {
  await page.addInitScript(
    ([id, slug]) => {
      window.localStorage.setItem(
        'curriculumProgress',
        JSON.stringify({ [id]: { completedLessons: [], lastVisitedAt: Date.now(), lastVisitedLesson: slug } }),
      );
    },
    [moduleId, lessonSlug] as const,
  );
}

const hero = (page: Page) => page.getByTestId('home-hero');

test.describe('landing page at 1440 px', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('leads with the headline, "Start lesson 1" and "Browse the curriculum" on one row', async ({ page }) => {
    await openLanding(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^Learn SystemVerilog and UVM verification, /);

    const primary = hero(page).getByTestId('hero-primary-action');
    await expect(primary).toHaveText('Start lesson 1');
    await expect(primary).toHaveAttribute('href', F1A);
    await expect(primary).toHaveAttribute('data-state', 'start');

    const browse = hero(page).getByRole('link', { name: 'Browse the curriculum', exact: true });
    await expect(browse).toHaveAttribute('href', CURRICULUM_HREF);
    const [a, b] = [await primary.boundingBox(), await browse.boundingBox()];
    expect(Math.abs((a?.y ?? 0) - (b?.y ?? -100))).toBeLessThan(2);
  });

  test('"Start lesson 1" opens lesson 1', async ({ page }) => {
    await openLanding(page);
    await hero(page).getByTestId('hero-primary-action').click();
    await expect(page).toHaveURL(new RegExp(`${F1A}$`), { timeout: NAV_TIMEOUT });
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: NAV_TIMEOUT });
  });

  test('a returning learner continues their lesson, named in full, with both actions still on one row', async ({ page }) => {
    await seedVisit(page, 'I-SV-5_Synchronization_and_IPC', 'mailboxes');
    await openLanding(page);
    const primary = hero(page).getByTestId('hero-primary-action');
    await expect(primary).toHaveAttribute('data-state', 'continue', { timeout: NAV_TIMEOUT });
    await expect(primary).toHaveAttribute('href', MAILBOXES);
    await expect(primary).toHaveAccessibleName(/^Continue I-SV-5: Mailboxes/);
    // A title cut short by the button's width stays whole on hover.
    await expect(primary).toHaveAttribute('title', /^Continue I-SV-5: Mailboxes/);
    await expect(primary).toContainText('Continue:');

    const browse = hero(page).getByTestId('hero-browse-curriculum');
    const [a, b] = [await primary.boundingBox(), await browse.boundingBox()];
    expect(Math.abs((a?.y ?? 0) - (b?.y ?? -100))).toBeLessThan(2);

    // "The path" marks the tier of the lesson to continue.
    await expect(page.getByTestId('path-tier-2')).toContainText('You are here');
    await expect(page.getByTestId('path-tier-1')).not.toContainText('Start here');
  });

  test('"The path" has one row per tier, each opening its section of the curriculum page', async ({ page }) => {
    await openLanding(page);
    const card = page.getByTestId('home-hero-card');
    await expect(card.getByRole('heading', { level: 2, name: 'The path' })).toBeVisible();
    await expect(card.getByRole('listitem')).toHaveCount(TIER_LINKS.length);
    expect(TIER_LINKS).toHaveLength(4);
    for (const [index, tier] of TIER_LINKS.entries()) {
      const row = page.getByTestId(`path-tier-${index + 1}`);
      await expect(row.getByRole('link', { name: tier.label, exact: true })).toHaveAttribute('href', tier.href);
    }
    await expect(page.getByTestId('path-tier-1')).toContainText('Start here');

    const third = TIER_LINKS[2];
    await page.getByTestId('path-tier-3').getByRole('link', { name: third.label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${third.href}$`), { timeout: NAV_TIMEOUT });
    await expect(page.getByRole('heading', { level: 3, name: third.label })).toBeInViewport({ timeout: NAV_TIMEOUT });
  });

  test('"How you learn here" links each step to where it happens', async ({ page }) => {
    await openLanding(page);
    const section = page.locator('#how-you-learn');
    await expect(section.getByRole('heading', { level: 2, name: 'How you learn here' })).toBeVisible();
    await expect(section.getByTestId('step-link-read')).toHaveAttribute('href', F1A);
    await expect(section.getByTestId('step-link-read')).toHaveText('Open lesson 1');
    await expect(section.getByTestId('step-link-stepThrough')).toHaveText('Open the scheduler model');
    await expect(section.getByTestId('step-link-stepThrough')).toHaveAttribute('href', /^\/curriculum\//);
    await expect(section.getByTestId('step-link-build')).toHaveAttribute('href', LABS_HREF);
    await expect(section.getByTestId('step-link-rehearse')).toHaveAttribute('href', INTERVIEW_PREP_HREF);

    await section.getByTestId('step-link-rehearse').click();
    await expect(page).toHaveURL(new RegExp(`${INTERVIEW_PREP_HREF}$`), { timeout: NAV_TIMEOUT });
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: NAV_TIMEOUT });
  });
});

test.describe('landing page without JavaScript', () => {
  test.use({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });

  test('the server HTML already holds the headline, both actions, the path and the steps', async ({ page }) => {
    await page.goto('/', { timeout: NAV_TIMEOUT });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^Learn SystemVerilog and UVM verification, /);
    await expect(hero(page).getByTestId('hero-primary-action')).toHaveText('Start lesson 1');
    await expect(hero(page).getByTestId('hero-browse-curriculum')).toBeVisible();
    await expect(page.getByTestId('home-hero-card').getByRole('listitem')).toHaveCount(TIER_LINKS.length);
    await expect(page.locator('#how-you-learn').getByRole('heading', { level: 2, name: 'How you learn here' })).toBeVisible();
  });
});

test.describe('landing page at 390 px', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const returning of [false, true]) {
    test(`never scrolls sideways (${returning ? 'returning learner' : 'first visit'})`, async ({ page }) => {
      if (returning) await seedVisit(page, 'I-SV-5_Synchronization_and_IPC', 'mailboxes');
      await openLanding(page);
      await expect(hero(page).getByTestId('hero-primary-action')).toHaveAttribute('data-state', returning ? 'continue' : 'start', {
        timeout: NAV_TIMEOUT,
      });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});
