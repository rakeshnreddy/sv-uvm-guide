import { expect, test } from '@playwright/test';

test.describe('Learner navigation flow', () => {
  test.setTimeout(180000);

  test('moves from curriculum to lab, back to module, flashcards, quiz, and next module', async ({ page }) => {
    await page.goto('/curriculum/T4_Expert/E-PSS-1_Portable_Stimulus_Standard/index');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('E-PSS-1: Portable Stimulus Standard', {
      timeout: 60000,
    });

    await test.step('Open linked lab', async () => {
      await page.getByRole('link', { name: 'Launch Lab' }).click();
      await expect(page).toHaveURL(/\/practice\/lab\/pss-portable-intent/);
      await expect(page.getByRole('heading', { name: 'Memory Read/Write Portable Intent' })).toBeVisible();
      await expect(page.locator('.monaco-editor')).toBeVisible({ timeout: 60000 });
      await expect(page.getByRole('button', { name: /starter\/mem_test\.pss/i })).toBeVisible();
      await page.getByRole('button', { name: /solution\/generated_uvm_sequence\.sv/i }).click();
      await expect(page.getByText('generated_uvm_sequence.sv', { exact: true })).toBeVisible();
    });

    await test.step('Return to owning module', async () => {
      await page.getByRole('link', { name: 'Back to Module' }).click();
      await expect(page).toHaveURL(/E-PSS-1_Portable_Stimulus_Standard/);
      await expect(page.getByRole('heading', { level: 1 })).toContainText('E-PSS-1: Portable Stimulus Standard');
    });

    await test.step('Use flashcards', async () => {
      const flashcardSection = page.locator('section').filter({ hasText: 'Reinforce the essentials' });
      await expect(flashcardSection).toBeVisible({ timeout: 30000 });
      await flashcardSection.scrollIntoViewIfNeeded();
      const flashcard = flashcardSection.locator('[role="button"]').first();
      await flashcard.click();
      await expect(flashcard).toHaveAttribute('aria-pressed', 'true', { timeout: 15000 });
    });

    await test.step('Answer the quiz', async () => {
      const quizQuestion = page.getByRole('heading', {
        name: /What is the primary problem that the Portable Stimulus Standard/,
      });
      await quizQuestion.scrollIntoViewIfNeeded();
      await page
        .getByRole('button', {
          name: 'It eliminates the need to maintain separate test implementations for different execution targets',
        })
        .click();
      await expect(page.getByText(/Correct!|Incorrect\./).first()).toBeVisible({ timeout: 15000 });
    });

    await test.step('Navigate to the next module', async () => {
      await page.locator('main nav').getByRole('link', { name: /Next/i }).click();
      await expect(page.locator('header h1')).toContainText('Power-Aware UVM Verification Strategy', {
        timeout: 60000,
      });
    });
  });
});
