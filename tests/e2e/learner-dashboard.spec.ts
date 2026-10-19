import { expect, test, type Page } from '@playwright/test';

/**
 * The learner dashboard, anonymously (the default e2e mode): /dashboard is a
 * static page that reads only this browser's records, starts empty, and shows
 * a lesson marked done on the lesson page. The editorial coverage page is gone.
 */

const LESSON = '/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index';

/** The layout marks <html data-shortcuts-ready> once its keyboard shortcuts are live (after hydration). */
async function waitForShell(page: Page) {
  await page.locator('html[data-shortcuts-ready]').waitFor({ state: 'attached' });
}

/** Records every request to /api/* the page makes. */
function trackApiRequests(page: Page): string[] {
  const requests: string[] = [];
  page.on('request', (request) => {
    const { pathname } = new URL(request.url());
    if (pathname.startsWith('/api/')) requests.push(pathname);
  });
  return requests;
}

test.describe('learner dashboard', () => {
  test('/dashboard answers 200 with the empty state and makes no API request', async ({ page }) => {
    const apiRequests = trackApiRequests(page);
    const response = await page.goto('/dashboard');
    expect(response?.status()).toBe(200);
    await waitForShell(page);

    await expect(page.getByRole('heading', { level: 1, name: 'Your learning' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Your learning' }).getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.getByText('Stored only in this browser')).toBeVisible();
    const empty = page.getByRole('region', { name: 'Nothing recorded in this browser yet' });
    await expect(empty).toBeVisible();
    await expect(empty.getByRole('link', { name: 'Find your level' })).toHaveAttribute('href', '/quiz/placement');
    await expect(empty.getByRole('link', { name: 'Begin the Junior route' })).toHaveAttribute('href', '/curriculum#route-junior');
    await expect(page.getByText(/verification lead|Community rank|badges earned/i)).toHaveCount(0);
    expect(apiRequests).toEqual([]);
  });

  test('a lesson marked done shows on the dashboard, with a link back to it', async ({ page }) => {
    await page.goto(LESSON);
    await waitForShell(page);

    const toggle = page.getByTestId('lesson-completion').getByRole('button');
    await expect(toggle).toHaveAccessibleName('Mark this lesson as done');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(toggle).toHaveAccessibleName('Done (saved in this browser)');

    // The mark survives a reload of the lesson.
    await page.reload();
    await waitForShell(page);
    await expect(page.getByTestId('lesson-completion').getByRole('button')).toHaveAttribute('aria-pressed', 'true');

    const apiRequests = trackApiRequests(page);
    await page.goto('/dashboard');
    await waitForShell(page);

    const lessons = page.getByRole('region', { name: 'Lessons' });
    await expect(lessons.getByTestId('dashboard-lesson-totals')).toContainText('1 done and 1 opened');
    const continueCard = page.getByRole('region', { name: 'Continue' });
    const back = continueCard.getByRole('link', { name: /^Back to F1A: The Cost of Bugs/ });
    await expect(back).toHaveAttribute('href', LESSON);
    await expect(page.getByRole('region', { name: 'Your data' }).getByRole('link', { name: 'Back up or reset your data' })).toHaveAttribute(
      'href',
      '/settings#data',
    );
    expect(apiRequests).toEqual([]);

    await back.click();
    await expect(page).toHaveURL(new RegExp(`${LESSON}$`));
  });

  test('/dashboard/coverage no longer exists', async ({ page }) => {
    const response = await page.goto('/dashboard/coverage');
    expect(response?.status()).toBe(404);
  });
});
