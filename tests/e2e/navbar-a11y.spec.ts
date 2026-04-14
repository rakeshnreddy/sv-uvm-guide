import { test, expect } from '@playwright/test';

test.describe('Navbar Accessibility Verification', () => {
  test('interactive elements should have correct ARIA attributes', async ({ page }) => {
    // Navigate to a page with the Navbar
    await page.goto('/');

    // 1. Check User Profile Dropdown Button
    const userProfileBtn = page.getByTestId('user-profile-button');
    await expect(userProfileBtn).toHaveAttribute('aria-label', 'User profile');
    await expect(userProfileBtn).toHaveAttribute('aria-expanded', 'false');

    // Hover to open
    await userProfileBtn.hover();
    await expect(userProfileBtn).toHaveAttribute('aria-expanded', 'true');

    // 2. Check Notification Center Toggle Button
    const notificationBtn = page.getByTestId('notification-button');
    await expect(notificationBtn).toHaveAttribute('aria-label', 'Notifications');
    await expect(notificationBtn).toHaveAttribute('aria-expanded', 'false');

    // Click to open
    await notificationBtn.click();
    await expect(notificationBtn).toHaveAttribute('aria-expanded', 'true');
    // Click to close
    await notificationBtn.click();
    await expect(notificationBtn).toHaveAttribute('aria-expanded', 'false');

    // 3. Check Desktop Nav Link Dropdowns (e.g., Curriculum if it has a dropdown)
    // The codebase showed a dropdown check, but in navLinks, Curriculum didn't have a dropdown in the snippet.
    // However, if any button has aria-expanded inside the nav, we can test it.
    const navButtons = await page.locator('nav button[aria-expanded]').elementHandles();
    // Assuming Curriculum or another link has a dropdown, we verify the attribute exists.
    for (const btn of navButtons) {
      const isExpanded = await btn.getAttribute('aria-expanded');
      expect(isExpanded === 'true' || isExpanded === 'false').toBeTruthy();
    }

    // 4. Check Mobile view elements
    // Switch to mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Check Mobile Search Icon Button
    const searchBtn = page.locator('button[aria-label="Search"]');
    await expect(searchBtn).toBeVisible();

    // Check Mobile Menu Toggle Button
    const mobileMenuToggleBtn = page.locator('button[aria-controls="mobile-menu"]');
    await expect(mobileMenuToggleBtn).toHaveAttribute('aria-expanded', 'false');

    // Click to open mobile menu
    await mobileMenuToggleBtn.click();
    await expect(mobileMenuToggleBtn).toHaveAttribute('aria-expanded', 'true');

    // Check Mobile Menu Close Icon Button
    const closeMenuBtn = page.locator('button[aria-label="Close menu"]');
    await expect(closeMenuBtn).toBeVisible();

    // Take a screenshot of the opened mobile menu for verification
    await page.screenshot({ path: 'tests/e2e/screenshots/navbar-mobile-a11y.png' });
  });
});
