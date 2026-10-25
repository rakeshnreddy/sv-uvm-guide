import { readFile } from 'node:fs/promises';

import { expect, test, type Page } from '@playwright/test';

/**
 * /settings anonymously (the default e2e mode): a static page whose learning
 * data lives only in this browser. A backup downloads as JSON, the two-step
 * delete clears it, and importing the downloaded file restores it, with no
 * request to /api/* and no page reload needed.
 */

const FILE_LABEL = 'Choose a backup file (JSON, at most 16 MB)';
const PROGRESS = JSON.stringify({
  F1A_The_Cost_of_Bugs: { completedLessons: ['index'], lastVisitedAt: 1_760_000_000_000, lastVisitedLesson: 'index' },
});
const EXERCISE_KEY = 'sv-uvm-guide:exercise:scoreboard-connector';
const EXERCISE = JSON.stringify({ bestScore: 80, attempts: 2 });

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

function readLearnerKeys(page: Page) {
  return page.evaluate((exerciseKey) => {
    return {
      progress: window.localStorage.getItem('curriculumProgress'),
      route: window.localStorage.getItem('svuvm.learningRoute'),
      exercise: window.localStorage.getItem(exerciseKey),
      theme: window.localStorage.getItem('theme'),
    };
  }, EXERCISE_KEY);
}

test.describe('settings: learning data in this browser', () => {
  test('/settings answers 200 with the data section, and requests nothing from /api', async ({ page }) => {
    const apiRequests = trackApiRequests(page);
    const response = await page.goto('/settings');
    expect(response?.status()).toBe(200);
    await waitForShell(page);

    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Your learning' }).getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    const data = page.locator('section#data');
    await expect(data.getByRole('heading', { name: 'Your learning data' })).toBeVisible();
    // The status line; the paragraph above it also says where the data is stored.
    await expect(data.getByRole('status').getByText('Stored only in this browser', { exact: true })).toBeVisible();
    await expect(data.getByText(/Some browsers clear data for sites you haven.t visited recently/)).toBeVisible();
    await expect(data.getByText('No learning data is saved in this browser yet.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Account preferences' })).toHaveCount(0);
    await expect(page.getByRole('main').getByText(/\bsign(ed)? in\b/i)).toHaveCount(0);
    expect(apiRequests).toEqual([]);
  });

  test('theme and data controls fit a 390 px phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/settings');
    await waitForShell(page);

    const appearance = page.getByRole('region', { name: 'Appearance' });
    await expect(appearance.getByRole('combobox', { name: 'Select theme' })).toBeVisible();
    await expect(appearance.getByRole('button', { name: 'Toggle theme' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download a backup (JSON)' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete all learning data in this browser' })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('download a backup, delete everything with the two-step confirm, then import the file to restore it', async ({ page }) => {
    const apiRequests = trackApiRequests(page);
    await page.goto('/settings');
    await waitForShell(page);
    await page.evaluate(
      ({ progress, exerciseKey, exercise }) => {
        window.localStorage.setItem('curriculumProgress', progress);
        window.localStorage.setItem('svuvm.learningRoute', 'practitioner');
        window.localStorage.setItem(exerciseKey, exercise);
        window.localStorage.setItem('theme', 'ocean-dark');
      },
      { progress: PROGRESS, exerciseKey: EXERCISE_KEY, exercise: EXERCISE },
    );
    await page.reload();
    await waitForShell(page);
    const data = page.locator('section#data');

    // Back up.
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      data.getByRole('button', { name: 'Download a backup (JSON)' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^sv-uvm-guide-learning-data-\d{4}-\d{2}-\d{2}\.json$/);
    const backupPath = await download.path();
    const backup = JSON.parse(await readFile(backupPath, 'utf8')) as {
      format: string;
      schemaVersion: number;
      legacy: Record<string, string>;
    };
    expect(backup.format).toBe('sv-uvm-guide/learner-data');
    expect(backup.schemaVersion).toBe(1);
    expect(backup.legacy.curriculumProgress).toBe(PROGRESS);
    expect(backup.legacy['svuvm.learningRoute']).toBe('practitioner');
    expect(backup.legacy[EXERCISE_KEY]).toBe(EXERCISE);
    expect(JSON.stringify(backup)).not.toContain('ocean-dark');
    await expect(data.getByTestId('learner-data-export-status')).toContainText('Backup downloaded as');
    await expect(data.getByText(/^Last backup: /)).toBeVisible();

    // Delete: the first click only asks.
    await data.getByRole('button', { name: 'Delete all learning data in this browser' }).click();
    const confirm = data.getByRole('group', { name: /This can.t be undone/ });
    await expect(confirm).toBeVisible();
    await expect(confirm.getByRole('button', { name: 'Cancel' })).toBeFocused();
    expect((await readLearnerKeys(page)).progress).toBe(PROGRESS);
    await confirm.getByRole('button', { name: 'Yes, delete everything' }).click();
    await expect(data.getByTestId('learner-data-reset-status')).toHaveText(
      'Deleted all learning data in this browser. Your theme choice is kept.',
    );
    expect(await readLearnerKeys(page)).toEqual({ progress: null, route: null, exercise: null, theme: 'ocean-dark' });
    await expect(data.getByText('No learning data is saved in this browser yet.')).toBeVisible();
    await expect(data.getByText('No backup downloaded from this browser yet.')).toBeVisible();

    // Restore from the downloaded file.
    await data.getByLabel(FILE_LABEL).setInputFiles(backupPath);
    const preview = data.getByRole('region', { name: /^Backup from / });
    await expect(preview).toBeVisible();
    await expect(preview.getByRole('listitem').filter({ hasText: 'Lesson progress' })).toContainText('1 lesson marked done');
    await expect(preview.getByRole('listitem').filter({ hasText: 'Chosen route' })).toBeVisible();
    await preview.getByRole('button', { name: 'Replace my data' }).click();
    await expect(data.getByTestId('learner-data-import-status')).toContainText(
      'Replaced the learning data in this browser with the backup.',
    );

    const restored = await readLearnerKeys(page);
    expect(JSON.parse(restored.progress ?? 'null')).toEqual(JSON.parse(PROGRESS));
    expect(restored.route).toBe('practitioner');
    expect(JSON.parse(restored.exercise ?? 'null')).toEqual(JSON.parse(EXERCISE));
    expect(restored.theme).toBe('ocean-dark');
    await expect(data.getByText(/^Last backup: /)).toBeVisible();
    expect(apiRequests).toEqual([]);
  });

  test('a file that is not a backup shows an error and changes nothing', async ({ page }) => {
    await page.goto('/settings');
    await waitForShell(page);
    await page.evaluate((progress) => window.localStorage.setItem('curriculumProgress', progress), PROGRESS);
    const data = page.locator('section#data');

    await data.getByLabel(FILE_LABEL).setInputFiles({
      name: 'notes.json',
      mimeType: 'application/json',
      buffer: Buffer.from('this is not json'),
    });

    await expect(data.getByRole('alert')).toHaveText("This file isn't a backup from this site: it isn't valid JSON.");
    await expect(data.getByRole('button', { name: 'Replace my data' })).toHaveCount(0);
    await expect(data.getByRole('button', { name: 'Merge with my data' })).toHaveCount(0);
    expect((await readLearnerKeys(page)).progress).toBe(PROGRESS);
  });
});
