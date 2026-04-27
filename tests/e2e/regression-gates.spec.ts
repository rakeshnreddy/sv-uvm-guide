import { test, expect } from '@playwright/test';

test.describe('Curriculum Interaction Gates', () => {
  test.setTimeout(180000);

  test('Interactive Elements: Flashcards and Quiz', async ({ page }) => {
    await page.goto('/curriculum/T3_Advanced/B-AXI-4_AXI_Expert_Features_Cache_Atomics');
    await expect(page.locator('header h1')).toBeVisible({ timeout: 60000 });

    await test.step('Flashcard validation', async () => {
      const flashcardSection = page.locator('section').filter({ hasText: 'Reinforce the essentials' });
      await expect(flashcardSection).toBeVisible({ timeout: 30000 });
      await flashcardSection.scrollIntoViewIfNeeded();

      const flashcard = flashcardSection.locator('[role="button"]').first();
      await expect(flashcard).toBeVisible({ timeout: 30000 });

      await flashcard.click();
      await expect(flashcard).toHaveAttribute('aria-pressed', 'true', { timeout: 15000 });
      
      await flashcard.click();
      await expect(flashcard).toHaveAttribute('aria-pressed', 'false', { timeout: 15000 });

      const nextBtn = flashcardSection.getByLabel('Next card');
      await expect(nextBtn).toBeVisible();
      await nextBtn.click();
      await expect(flashcardSection.getByText(/Card 2 of \d+/)).toBeVisible({ timeout: 15000 });
    });

    await test.step('Quiz validation', async () => {
      const quizSection = page.locator('article .Quiz, article div:has(h3)').filter({ has: page.locator('button') }).first();
      await expect(quizSection).toBeVisible({ timeout: 30000 });
      await quizSection.scrollIntoViewIfNeeded();

      const options = quizSection.locator('button.outline');
      await expect(options.first()).toBeVisible({ timeout: 15000 });
      await options.first().click();

      await expect(quizSection.locator('text=/Correct!|Incorrect./')).toBeVisible({ timeout: 15000 });
      await expect(quizSection.getByRole('button', { name: 'Next Question' })).toBeVisible({ timeout: 15000 });
    });
  });

  test('Navigation and Links', async ({ page }) => {
    await page.goto('/curriculum/T4_Expert/E-PWR-1_Power_Aware_Verification');
    await expect(page.locator('header h1')).toBeVisible({ timeout: 60000 });

    await test.step('LabLink validation', async () => {
      const labLink = page.locator('a[href^="/labs/"]').first();
      await labLink.scrollIntoViewIfNeeded();
      await expect(labLink).toBeVisible({ timeout: 30000 });
      const labHref = await labLink.getAttribute('href');
      if (labHref) {
        const response = await page.request.get(labHref);
        expect(response.status()).toBeLessThan(400);
      }
    });

    await test.step('Breadcrumbs check', async () => {
      const breadcrumbs = page.locator('nav[aria-label="Breadcrumb"]');
      await expect(breadcrumbs).toBeVisible({ timeout: 30000 });
      const count = await breadcrumbs.locator('a').count();
      expect(count).toBeGreaterThan(1);
    });

    await test.step('Prev/Next navigation', async () => {
      const nav = page.locator('main nav');
      await expect(nav.locator('a:has-text("Next")')).toBeVisible({ timeout: 30000 });
      await expect(nav.locator('a:has-text("Previous")')).toBeVisible({ timeout: 30000 });
    });
  });
});
