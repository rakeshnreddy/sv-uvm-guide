import { expect, test, type Page } from '@playwright/test';

/*
 * Labs run anonymously, as on the deployed site: the page is prerendered, and
 * steps, edits, structural checks and progress live in this browser. The page
 * must never call the account APIs.
 */

/** Collects the path of every request this page makes to /api/auth or /api/me. */
function trackAccountRequests(page: Page): string[] {
  const paths: string[] = [];
  page.on('request', (request) => {
    const { pathname } = new URL(request.url());
    if (pathname.startsWith('/api/auth') || pathname.startsWith('/api/me')) paths.push(pathname);
  });
  return paths;
}

test.describe('Interactive lab framework (anonymous)', () => {
  test.setTimeout(120000);

  test('runs basics-1 v2 in the browser: a self-attested step, a structural check and a reload', async ({ page }) => {
    const accountRequests = trackAccountRequests(page);

    const response = await page.goto('/practice/lab/basics-1');
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Refactor Repeated Stimulus into a Task');
    await expect(page.locator('.monaco-editor')).toBeVisible({ timeout: 60000 });
    await expect(page.getByText('Your progress is saved in this browser.')).toBeVisible();

    await test.step('Step 1 is self-attested', async () => {
      await expect(page.getByRole('heading', { name: 'Step 1: Run the starter and record the counts' })).toBeVisible();
      // Enabled once the saved progress has been restored.
      await page.getByRole('button', { name: 'Mark step complete & continue' }).click();
      await expect(page.getByText('Step completed. Continue when ready.')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Step 2: Write task automatic drive_sequence' })).toBeVisible();
    });

    await test.step('The graded step checks the starter in the browser and fails', async () => {
      await expect(page.getByText('Structural check in your browser: it does not compile or simulate.')).toBeVisible();
      await page.getByRole('button', { name: 'Check solution' }).click();
      await expect(page.locator('pre[aria-live]')).toContainText('task automatic drive_sequence');
      await expect(page.getByRole('heading', { name: 'Step 2: Write task automatic drive_sequence' })).toBeVisible();
    });

    await test.step('A reload restores the progress saved in this browser', async () => {
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Step 2: Write task automatic drive_sequence' })).toBeVisible({
        timeout: 30000,
      });
      await expect(page.getByRole('button', { name: /^Step 1: Run the starter and record the counts \(completed\)$/ })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Check solution' })).toBeEnabled();
    });

    await test.step('Without the simulator service the lab offers a download to run locally', async () => {
      await expect(page.getByRole('heading', { name: 'Run it on your simulator' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Download workspace (.zip)' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Run workspace' })).toHaveCount(0);
    });

    expect(accountRequests).toEqual([]);
  });

  test('returns 404 for an unregistered lab', async ({ page }) => {
    const response = await page.goto('/practice/lab/this-is-not-a-lab');
    expect(response?.status()).toBe(404);
  });

  test('returns 404 for a coming-soon lab', async ({ page }) => {
    const response = await page.goto('/practice/lab/fifo-1');
    expect(response?.status()).toBe(404);
  });
});
