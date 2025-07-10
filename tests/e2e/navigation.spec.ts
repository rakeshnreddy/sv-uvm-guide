import { test, expect } from '@playwright/test';

const NAV_LINKS = [
  { name: 'Curriculum', path: '/curriculum', title: 'Curriculum Home' }, // Assuming Curriculum home is '/curriculum' with this title
  { name: 'Practice Hub', path: '/practice', title: 'Practice Hub' },
  { name: 'Resources', path: '/resources', title: 'Resources' },
  { name: 'Community', path: '/community', title: 'Community Forum' }, // Title on page is 'Community Forum'
  { name: 'Dashboard', path: '/dashboard', title: 'Your Dashboard' },   // Title on page is 'Your Dashboard'
];

test.describe('Hub Page Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Start at the homepage before each test
    await page.goto('/');
  });

  for (const linkInfo of NAV_LINKS) {
    test(`should navigate to ${linkInfo.name} page and verify title`, async ({ page }) => {
      // Click the navigation link in the header
      // This assumes links are identifiable by their text. Adjust if using aria-label or other selectors.
      const navLink = page.getByRole('link', { name: new RegExp(`^${linkInfo.name}$`, 'i') });
      await expect(navLink).toBeVisible();
      await navLink.click();

      // Assert that the URL changes to the correct path
      await expect(page).toHaveURL(linkInfo.path);

      // Assert that the <h1> on the navigated page matches the expected title
      // The title might be slightly different from the link text (e.g., "Community Forum" vs "Community")
      const pageTitle = page.getByRole('heading', { name: linkInfo.title, level: 1 });
      await expect(pageTitle).toBeVisible();
    });
  }

  // Special case for the main "Homepage" or "Home" link if it exists, usually links to "/"
  test('should navigate back to homepage if a Home link exists', async ({ page }) => {
    // First navigate away
    await page.getByRole('link', { name: 'Curriculum' }).click();
    await expect(page).toHaveURL('/curriculum');

    // Now try to navigate back home (assuming a "Home" link or a logo link)
    // This part is speculative as the exact "Home" link isn't defined in prompts.
    // If your logo links home: const homeLink = page.getByRole('link', { name: /site logo/i });
    // If you have a "Home" text link:
    const homeLink = page.getByRole('link', { name: 'Home' }); // Or whatever your home link text is

    // This test will only pass if such a link exists.
    // If it doesn't, this specific test can be removed or adapted.
    if (await homeLink.count() > 0) {
        await homeLink.click();
        await expect(page).toHaveURL('/');
        await expect(page.getByRole('heading', { name: 'Master SystemVerilog & UVM' })).toBeVisible();
    } else {
        test.skip(true, "No explicit 'Home' link found to test homepage navigation.");
    }
  });
});
