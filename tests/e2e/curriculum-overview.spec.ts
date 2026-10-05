import { test, expect, type Page } from '@playwright/test';
import { EXPERT_INDEX_HREF, PLACEMENT_QUIZ_HREF } from '@/lib/learning-paths';

/**
 * G30 acceptance for the curriculum overview, the learner routes, the
 * placement quiz and the expert index (docs/curriculum-quality/analysis/G30.md,
 * "curriculum-overview" and "learner-paths").
 */

const F1A = '/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index';
const F3A = '/curriculum/T1_Foundational/F3A_Simulation_Semantics/index';

async function seedVisit(page: Page, moduleId: string, lessonSlug: string) {
  await page.addInitScript(
    ([id, slug]) => {
      window.localStorage.setItem(
        'curriculumProgress',
        JSON.stringify({ [id]: { completedLessons: [], lastVisitedAt: Date.now(), lastVisitedLesson: slug } }),
      );
    },
    [moduleId, lessonSlug],
  );
}

test.describe('curriculum overview routes', () => {
  test('"Begin the Junior route" opens F1A', async ({ page }) => {
    await page.goto('/curriculum');
    await page.getByRole('region', { name: 'Choose your route' }).getByRole('link', { name: 'Begin the Junior route', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${F1A}$`));
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  });

  test('"Find your level" opens the placement quiz', async ({ page }) => {
    await page.goto('/curriculum');
    await page.getByRole('region', { name: 'Choose your route' }).getByRole('link', { name: 'Find your level', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${PLACEMENT_QUIZ_HREF}$`));
    await expect(page.getByRole('heading', { level: 1, name: 'Find your level' })).toBeVisible();
  });

  test('"Expert layers" opens the expert index', async ({ page }) => {
    await page.goto('/curriculum');
    await page.getByRole('region', { name: 'Choose your route' }).getByRole('link', { name: 'Expert layers', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${EXPERT_INDEX_HREF}$`));
    await expect(page.getByRole('heading', { level: 1, name: 'Expert index' })).toBeVisible();
  });

  test('following a route shows its steps and survives a reload', async ({ page }) => {
    await page.goto('/curriculum');
    const follow = page.getByRole('button', { name: 'Follow the Junior route' });
    await follow.click();
    await expect(follow).toHaveAttribute('aria-pressed', 'true');
    const steps = page.getByRole('region', { name: 'The Junior route: 6 steps' });
    await expect(steps).toBeVisible();
    await page.reload();
    await expect(page.getByRole('region', { name: 'The Junior route: 6 steps' })).toBeVisible();
  });

  test('/curriculum#route-practitioner opens the Practitioner route', async ({ page }) => {
    await page.goto('/curriculum#route-practitioner');
    await expect(page.getByRole('region', { name: 'The Practitioner route: 6 steps' })).toBeVisible();
  });
});

test.describe('curriculum overview modules', () => {
  test('/curriculum#t3 opens Tier 3', async ({ page }) => {
    await page.goto('/curriculum#t3');
    const tier3 = page.getByRole('heading', { level: 3, name: 'Tier 3: Advanced' }).getByRole('button');
    await expect(tier3).toHaveAttribute('aria-expanded', 'true');
  });

  test('has no dead filters and no placeholder diagram', async ({ page }) => {
    await page.goto('/curriculum');
    const modules = page.getByRole('region', { name: 'Modules by tier' });
    await expect(modules.getByRole('combobox')).toHaveCount(0);
    await expect(page.getByRole('option', { name: /All Difficulties|All Statuses/ })).toHaveCount(0);
    await expect(modules.getByText(/Placeholder/)).toHaveCount(0);
    await modules.getByRole('button', { name: 'Map' }).click();
    const map = page.getByRole('group', { name: 'Curriculum map' });
    await expect(map.getByRole('link')).toHaveCount(69);
    for (const href of (await map.getByRole('link').evaluateAll((links) => links.map((a) => a.getAttribute('href')))).slice(0, 3)) {
      const response = await page.request.get(href!);
      expect(response.status(), href!).toBeLessThan(400);
    }
  });

  test('search opens every tier with a match', async ({ page }) => {
    await page.goto('/curriculum');
    await page.getByRole('searchbox', { name: 'Search modules and lessons' }).fill('mailbox');
    await expect(page.getByRole('heading', { level: 3, name: 'Tier 2: Intermediate' }).getByRole('button')).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await expect(page.getByRole('heading', { level: 4, name: /^I-SV-5:/ })).toBeVisible();
  });

  test('"Continue" follows the last lesson opened (F2D/ipc -> F3A)', async ({ page }) => {
    await seedVisit(page, 'F2D_Reusable_Code_and_Parallelism', 'ipc');
    await page.goto('/curriculum');
    const resume = page.getByRole('region', { name: 'Pick up where you left off' });
    await expect(resume.getByRole('link', { name: 'Continue with F3A: Simulation Semantics' })).toHaveAttribute('href', F3A);
  });

  test('fits a 390 px screen without horizontal scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/curriculum');
    await page.getByRole('button', { name: 'Follow the Expert route' }).click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

test.describe('placement quiz', () => {
  test('ends with a starting lesson that loads', async ({ page }) => {
    await page.goto(PLACEMENT_QUIZ_HREF);
    await page.getByRole('button', { name: 'Start the quiz' }).click();
    for (let i = 0; i < 10; i += 1) {
      await page.getByRole('radio').first().check();
      await page.getByRole('button', { name: 'Check answer' }).click();
      await page.getByRole('button', { name: i === 9 ? 'See your result' : 'Next question' }).click();
    }
    const start = page.getByRole('link', { name: /^Start at / });
    const href = await start.getAttribute('href');
    expect(href).toMatch(/^\/curriculum\/T\d_[^/]+\/[^/]+\/[a-z0-9-]+$/);
    await start.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  });
});

test.describe('expert index', () => {
  test('lists every tier and links each expert topic to a heading that exists', async ({ page }) => {
    await page.goto(EXPERT_INDEX_HREF);
    for (const tier of ['Tier 1: Foundations', 'Tier 2: Intermediate', 'Tier 3: Advanced', 'Tier 4: Expert']) {
      await expect(page.getByRole('heading', { level: 2, name: tier })).toBeVisible();
    }
    const anchored = await page
      .locator('a[href*="#expert-"], a[href*="#push-further"]')
      .evaluateAll((links) => [...new Set(links.map((a) => a.getAttribute('href')!))]);
    for (const href of anchored.slice(0, 10)) {
      await page.goto(href);
      const id = decodeURIComponent(href.split('#')[1]);
      await expect(page.locator(`[id="${id}"]`), href).toHaveCount(1);
    }
  });
});
