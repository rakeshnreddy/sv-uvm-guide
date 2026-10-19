import { test, expect } from '@playwright/test';

import { getLabById } from '@/lib/lab-registry';

// Anonymous, like the deployed site: lessons and labs need no sign-in.
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
      const firstQuestion = page.getByRole('heading', {
        name: /If a master wants to poll a hardware status register/,
      });
      await expect(firstQuestion).toBeVisible({ timeout: 30000 });
      await firstQuestion.scrollIntoViewIfNeeded();

      const firstAnswer = page.getByRole('button', {
        name: "4'b0000 (Non-bufferable, Non-cacheable) to ensure strict ordering",
      });
      await expect(firstAnswer).toBeVisible({ timeout: 15000 });
      await firstAnswer.click();

      await expect(page.getByText(/Correct!|Incorrect\./).first()).toBeVisible({ timeout: 15000 });
      await expect(page.getByRole('button', { name: 'Next Question' })).toBeVisible({ timeout: 15000 });
    });
  });

  test('Navigation and Links', async ({ page }) => {
    await page.goto('/curriculum/T4_Expert/E-PWR-1_Power_Aware_Verification');
    await expect(page.locator('header h1')).toBeVisible({ timeout: 60000 });

    await test.step('LabLink validation', async () => {
      const labLink = page.locator('a[href^="/practice/lab/"]').first();
      await labLink.scrollIntoViewIfNeeded();
      await expect(labLink).toBeVisible({ timeout: 30000 });
      const labHref = await labLink.getAttribute('href');
      expect(labHref).toMatch(/^\/practice\/lab\/[a-z0-9-]+$/);
      const lab = getLabById(labHref!.split('/').pop()!);
      expect(lab, `${labHref} is a registered lab`).toBeDefined();

      // The static lab page itself: 200 with the lab's title, no sign-in in between.
      const labPage = await page.context().newPage();
      try {
        const response = await labPage.goto(labHref!);
        expect(response?.status()).toBe(200);
        expect(new URL(labPage.url()).pathname).toBe(labHref);
        await expect(labPage.getByRole('heading', { level: 1 })).toHaveText(lab!.title, { timeout: 30000 });
      } finally {
        await labPage.close();
      }
    });

    await test.step('Breadcrumbs check', async () => {
      const breadcrumbs = page.locator('nav[aria-label="Breadcrumb"]');
      await expect(breadcrumbs).toBeVisible({ timeout: 30000 });
      const count = await breadcrumbs.locator('a').count();
      expect(count).toBeGreaterThan(1);
    });

    await test.step('Prev/Next navigation', async () => {
      // The lesson's own pager; the breadcrumb and "On this page" are navigation landmarks too.
      const nav = page.getByRole('navigation', { name: 'Previous and next lesson' });
      await expect(nav.getByRole('link', { name: /^Next lesson/ })).toBeVisible({ timeout: 30000 });
      await expect(nav.getByRole('link', { name: /^Previous lesson/ })).toBeVisible({ timeout: 30000 });
    });
  });
});
