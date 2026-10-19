import { expect, test } from '@playwright/test';

/**
 * Flashcard ratings and the review queue without an account (the default,
 * anonymous e2e mode): everything is saved in this browser.
 */
const LESSON = '/curriculum/T3_Advanced/B-AMBA-1_Protocol_Families_and_Tradeoffs/index';
const LESSON_TITLE = 'AMBA Protocol Families & Tradeoffs';
const DAY_MS = 24 * 60 * 60 * 1000;
const FLASHCARDS_STORAGE_KEY = 'sv-uvm-guide:flashcards';
const LONG_ANSWER_LESSON = '/curriculum/T3_Advanced/A-UVM-8_Multi_Agent_Topologies/index';
const LONG_ANSWER_DECK = 'A-UVM-8_Multi_Agent_Topologies';
/** a-uvm-8-17, whose answer is 571 characters, is card 15 (the last) of the deck. */
const LONG_ANSWER_INDEX = 14;

test.describe('flashcard review, stored in this browser', () => {
  test.setTimeout(180_000);

  test('rate a lesson card, keep the deck position across a reload, and review the card two days later', async ({ page }) => {
    const start = new Date(2026, 2, 2, 10, 0, 0);
    await page.clock.install({ time: start });

    await page.goto(LESSON);
    const section = page.locator('section').filter({ hasText: 'Reinforce the essentials' });
    await expect(section).toBeVisible({ timeout: 60_000 });
    await section.scrollIntoViewIfNeeded();
    await expect(section.getByText(/^Card 1 of \d+$/)).toBeVisible();

    const card = section.locator('[role="button"]').first();
    const front = await card.getByTestId('flashcard-front').textContent();
    const question = (front ?? '').replace(/^\s*Question:\s*/, '').trim();
    expect(question.length).toBeGreaterThan(0);

    // The card is aria-disabled until hydration, so this click waits for it.
    await card.click();
    await expect(card).toHaveAttribute('aria-pressed', 'true', { timeout: 15_000 });

    const ratings = section.getByRole('group', { name: 'How well did you recall this card?' });
    await expect(ratings).toBeVisible();
    await ratings.getByRole('button', { name: /^Good,/ }).click();
    await expect(section.getByText('Next review in 1 day.')).toBeVisible();
    await expect(section.getByText(/^Card 2 of \d+$/)).toBeVisible();
    await expect(card).toHaveAttribute('aria-pressed', 'false');

    await page.reload();
    await expect(section.getByText(/^Card 2 of \d+$/)).toBeVisible({ timeout: 60_000 });

    await page.clock.setSystemTime(new Date(start.getTime() + 2 * DAY_MS));
    await page.goto('/dashboard/review');
    await expect(page.getByRole('heading', { level: 1, name: 'Flashcard review' })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('navigation', { name: 'Your learning' }).getByRole('link', { name: 'Review' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.getByText('Due for review', { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('flashcard-front')).toContainText(question);
    const fromLesson = page.locator('p', { hasText: 'From lesson:' });
    await expect(fromLesson.getByRole('link', { name: LESSON_TITLE })).toHaveAttribute('href', LESSON);

    // Rate it from the queue: it leaves today's due cards.
    const reviewCard = page.locator('[role="button"]').filter({ has: page.getByTestId('flashcard-front') }).first();
    await reviewCard.click();
    await expect(reviewCard).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('group', { name: 'How well did you recall this card?' }).getByRole('button', { name: /^Good,/ }).click();
    await expect(page.getByText('Next review in 6 days.')).toBeVisible();
    await expect(page.getByText('Due for review', { exact: true })).toHaveCount(0);
  });

  test('at 390 px the question shows before a flip and a long answer leaves the ratings tappable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(
      ([key, value]) => {
        if (window.localStorage.getItem(key) === null) window.localStorage.setItem(key, value);
      },
      [
        FLASHCARDS_STORAGE_KEY,
        JSON.stringify({ v: 1, data: { cards: {}, decks: {}, positions: { [LONG_ANSWER_DECK]: LONG_ANSWER_INDEX } } }),
      ],
    );
    await page.goto(LONG_ANSWER_LESSON);
    const section = page.locator('section').filter({ hasText: 'Reinforce the essentials' });
    await expect(section).toBeVisible({ timeout: 60_000 });
    await expect(section.getByText(new RegExp(`^Card ${LONG_ANSWER_INDEX + 1} of \\d+$`))).toBeVisible({ timeout: 15_000 });

    const card = section.locator('[role="button"]').first();
    await expect(card.getByTestId('flashcard-front')).toContainText('never raise an automatic phase objection');
    const paintedFace = () =>
      card.evaluate((element) => {
        element.scrollIntoView({ block: 'center' });
        const box = element.getBoundingClientRect();
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        return hit?.closest('[data-testid]')?.getAttribute('data-testid') ?? null;
      });
    // Backface hiding works: the question face, not the mirrored answer, is on top before a flip.
    expect(await paintedFace()).toBe('flashcard-front');

    await card.click();
    await expect(card).toHaveAttribute('aria-pressed', 'true', { timeout: 15_000 });
    await expect.poll(paintedFace).toBe('flashcard-back');

    // The card grows with the answer, so the rating group sits below it and receives taps.
    const ratings = section.getByRole('group', { name: 'How well did you recall this card?' });
    await expect(ratings).toBeVisible();
    const cardBox = await card.boundingBox();
    const ratingsBox = await ratings.boundingBox();
    expect(cardBox && ratingsBox && cardBox.y + cardBox.height <= ratingsBox.y + 0.5).toBe(true);
    for (const name of [/^Again,/, /^Hard,/]) {
      const receivesTap = await ratings.getByRole('button', { name }).evaluate((element) => {
        element.scrollIntoView({ block: 'center' });
        const box = element.getBoundingClientRect();
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        return hit !== null && element.contains(hit);
      });
      expect(receivesTap).toBe(true);
    }
    // Nothing in the flashcard section scrolls sideways.
    expect(await section.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);

    await ratings.getByRole('button', { name: /^Hard,/ }).click();
    await expect(section.getByText('You reached the end of this deck.')).toBeVisible();
  });

  test('a first visit explains how to build the queue', async ({ page }) => {
    await page.goto('/dashboard/review');
    await expect(
      page.getByText("Rate cards in any lesson's “Reinforce the essentials” section to build your review queue."),
    ).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('link', { name: 'Browse the curriculum' })).toHaveAttribute('href', '/curriculum');
  });

  test('the old memory hub route is gone', async ({ page }) => {
    const response = await page.goto('/dashboard/memory-hub');
    expect(response?.status()).toBe(404);
  });
});
