import { expect, test, type Page } from '@playwright/test';

import { PLACEMENT_QUIZ_HREF } from '@/lib/learning-paths';

/**
 * The placement quiz, anonymously (the default e2e mode): the result is saved
 * in this browser, comes back as "Your last result" after a reload, feeds the
 * dashboard's placement card, and is never sent to /api/me/assessments.
 */

/** The layout marks <html data-shortcuts-ready> once its keyboard shortcuts are live (after hydration). */
async function waitForShell(page: Page) {
  await page.locator('html[data-shortcuts-ready]').waitFor({ state: 'attached' });
}

async function finishQuiz(page: Page) {
  await page.getByRole('button', { name: 'Start the quiz' }).click();
  for (let i = 0; i < 10; i += 1) {
    await page.getByRole('radio').first().check();
    await page.getByRole('button', { name: 'Check answer' }).click();
    await page.getByRole('button', { name: i === 9 ? 'See your result' : 'Next question' }).click();
  }
  await expect(page.getByRole('heading', { level: 2, name: /^Start in Tier \d/ })).toBeFocused();
}

test.describe('placement quiz saved in this browser', () => {
  test('finish the quiz, reload, see the last result, and find it on the dashboard', async ({ page }) => {
    const assessmentPosts: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/me/')) assessmentPosts.push(request.url());
    });

    await page.goto(PLACEMENT_QUIZ_HREF);
    await waitForShell(page);
    await expect(page.getByTestId('placement-last-result')).toHaveCount(0);
    await finishQuiz(page);

    const heading = await page.getByRole('heading', { level: 2, name: /^Start in Tier \d/ }).textContent();
    const tier = /Tier (\d)/.exec(heading ?? '')?.[1];
    expect(tier).toBeTruthy();
    const routeName = (await page.getByRole('link', { name: /^See the .+ route$/ }).textContent())?.replace(/^See the | route$/g, '');
    expect(routeName).toBeTruthy();

    // Following the recommended route is confirmed out loud and remembered.
    await page.getByRole('button', { name: `Follow the ${routeName} route` }).click();
    await expect(page.getByRole('status').filter({ hasText: `You're following the ${routeName} route.` })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Go to dashboard' })).toHaveAttribute('href', '/dashboard');

    await page.reload();
    await waitForShell(page);
    const last = page.getByTestId('placement-last-result');
    await expect(last).toContainText(`Your last result: Tier ${tier} on the ${routeName} route,`);
    await last.getByRole('button', { name: 'See your plan' }).click();
    await expect(page.getByRole('heading', { level: 2, name: heading ?? '' })).toBeFocused();

    await page.goto('/dashboard');
    await waitForShell(page);
    const card = page.getByRole('region', { name: 'Placement' });
    await expect(card).toContainText(`Start in Tier ${tier} on the ${routeName} route`);
    await expect(card.getByRole('link', { name: `See the ${routeName} route` })).toHaveAttribute('href', /^\/curriculum#route-/);
    await expect(page.getByRole('region', { name: 'Continue' })).toContainText(`Next on your ${routeName} route`);

    expect(assessmentPosts).toEqual([]);
  });
});
