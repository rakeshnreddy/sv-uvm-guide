import { expect, test, type Page } from '@playwright/test';

/**
 * Teach it back and the notebook, anonymously (the default e2e mode): an
 * explanation saved on a lesson is stored in this browser, listed on
 * /dashboard/notebook, and still there after a reload. Nothing requests the
 * AI routes while the AI tutor is off.
 */

const LESSON = '/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index';

/** The layout marks <html data-shortcuts-ready> once its keyboard shortcuts are live (after hydration). */
async function waitForShell(page: Page) {
  await page.locator('html[data-shortcuts-ready]').waitFor({ state: 'attached' });
}

test.describe('Teach it back saves to the notebook in this browser', () => {
  test('save on a lesson, find it in the notebook, keep it after a reload', async ({ page }) => {
    const explanation = `A bug found after tape-out costs far more than one caught in simulation (${Date.now()}).`;
    const aiRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/ai/')) aiRequests.push(request.url());
    });

    await page.goto(LESSON);
    await waitForShell(page);
    const practice = page.getByTestId('lesson-practice');
    await expect(practice.getByRole('heading', { name: 'Teach it back' })).toBeVisible();
    await expect(practice.getByText('Define it in one sentence')).toBeVisible();
    await expect(practice.getByRole('button', { name: 'Get AI feedback' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Open AI assistant' })).toHaveCount(0);

    const textbox = practice.getByRole('textbox', { name: 'Your explanation' });
    const save = practice.getByRole('button', { name: 'Save to notebook' });
    await expect(save).toBeDisabled();
    await textbox.fill(explanation);
    await expect(save).toBeEnabled();
    await save.click();

    await expect(practice.getByRole('status').filter({ hasText: 'Saved in this browser' })).toContainText(
      'Saved in this browser · Open notebook',
    );
    // Nothing new to save: aria-disabled, and keyboard focus stays on the button.
    await expect(save).toBeDisabled();
    await expect(save).toHaveAttribute('aria-disabled', 'true');
    await expect(save).toBeFocused();

    // The explanation comes back on the lesson after a reload.
    await page.reload();
    await waitForShell(page);
    await expect(page.getByTestId('lesson-practice').getByRole('textbox', { name: 'Your explanation' })).toHaveValue(explanation);

    await page.goto('/dashboard/notebook');
    await waitForShell(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Notebook' })).toBeVisible();
    const entries = page.getByRole('region', { name: 'Entries' });
    await expect(entries.getByText(explanation)).toBeVisible();
    await expect(entries.getByRole('link', { name: /Cost of Bugs/ })).toHaveAttribute('href', `${LESSON}#teach-it-back`);

    await page.reload();
    await waitForShell(page);
    await expect(page.getByRole('region', { name: 'Entries' }).getByText(explanation)).toBeVisible();
    expect(aiRequests).toEqual([]);
  });

  test('the Open notebook link in the saved status leads to the notebook', async ({ page }) => {
    await page.goto(LESSON);
    await waitForShell(page);
    const practice = page.getByTestId('lesson-practice');
    await practice.getByRole('textbox', { name: 'Your explanation' }).fill('Verification finds bugs while they are cheap to fix.');
    await practice.getByRole('button', { name: 'Save to notebook' }).click();

    await practice.getByRole('link', { name: 'Open notebook' }).click();
    await expect(page).toHaveURL('/dashboard/notebook');
    await expect(page.getByRole('region', { name: 'Entries' }).getByText('Verification finds bugs while they are cheap to fix.')).toBeVisible();
  });

  test('New note stores nothing until you type in it', async ({ page }) => {
    await page.goto('/dashboard/notebook');
    await waitForShell(page);
    const newNote = page.getByRole('button', { name: 'New note' });
    await newNote.click();
    await expect(page.getByRole('textbox', { name: 'Title' })).toBeFocused();
    await newNote.click();
    await newNote.click();

    await page.reload();
    await waitForShell(page);
    await expect(page.getByText("Explanations you save in a lesson's “Teach it back” section appear here.")).toBeVisible();

    await page.getByRole('button', { name: 'New note' }).click();
    await page.getByRole('textbox', { name: 'Title' }).fill('Clocking blocks');
    const entries = page.getByRole('region', { name: 'Entries' });
    await expect(entries.getByRole('button', { name: 'Clocking blocks' })).toBeVisible();
    await expect(page.getByText('Saved in this browser', { exact: true })).toBeVisible();

    await page.reload();
    await waitForShell(page);
    await expect(page.getByRole('region', { name: 'Entries' }).getByRole('listitem')).toHaveCount(1);
  });

  test('the notebook page is reachable anonymously and starts empty', async ({ page }) => {
    const response = await page.goto('/dashboard/notebook');
    expect(response?.status()).toBe(200);
    await waitForShell(page);
    await expect(page.getByText("Explanations you save in a lesson's “Teach it back” section appear here.")).toBeVisible();
    await expect(page.getByRole('link', { name: 'Browse the curriculum' })).toHaveAttribute('href', '/curriculum');
    await expect(page.getByRole('button', { name: 'Open AI assistant' })).toHaveCount(0);
  });
});
