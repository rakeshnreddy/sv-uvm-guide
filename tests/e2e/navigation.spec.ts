import { test, expect } from '@playwright/test';

test('factory page next link navigates to component communication page', async ({ page }) => {
  await page.goto('/curriculum/uvm-core/fundamentals/factory');
  await page.click('a:has-text("Component Communication")');
  await expect(page).toHaveURL('/curriculum/uvm-core/fundamentals/component-communication');
  await expect(page.locator('h1')).toContainText('Component Communication');
});


test.describe('Advanced Navigation Features', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should toggle sidebar with navbar button', async ({ page }) => {
    await expect(page.getByText('Quick Access')).not.toBeVisible();
    await page.getByLabel('Toggle Sidebar').click();
    await expect(page.getByText('Quick Access')).toBeVisible();
    await page.locator('h2:has-text("Quick Access") + button').click();
    await expect(page.getByText('Quick Access')).not.toBeVisible();
  });

  test('should toggle sidebar with keyboard shortcut (Ctrl+B)', async ({ page }) => {
    await expect(page.getByText('Quick Access')).not.toBeVisible();
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.locator('body').focus();
    await page.keyboard.press(`${modifier}+B`);
    await expect(page.getByText('Quick Access')).toBeVisible();
    await page.keyboard.press(`${modifier}+B`);
    await expect(page.getByText('Quick Access')).not.toBeVisible();
  });

  test('should focus search bar with keyboard shortcut (Ctrl+K)', async ({ page }) => {
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.locator('body').focus();
    await page.keyboard.press(`${modifier}+K`);
    const searchInput = page.getByTestId('main-search-input');
    await expect(searchInput).toBeFocused();
  });

  test('should open user profile and notification dropdowns', async ({ page }) => {
    await page.waitForSelector('nav');
    // Test User Profile Dropdown
    await page.getByTestId('user-profile-button').hover();
    await expect(page.getByText('Jane Doe')).toBeVisible();

    // Test Notification Center
    await page.getByTestId('notification-button').click();
    await expect(page.getByText('Achievement Unlocked!')).toBeVisible();
  });

  test('should show enhanced breadcrumbs on a curriculum page', async ({ page }) => {
    await page.goto('/curriculum/T1_Foundational/F2_Data_Types/arrays');

    // Check for progress indicator
    await expect(page.locator('nav:has-text("Data Types")').locator('svg.lucide-circle.text-primary')).toBeVisible();

    // Check for "Jump to" button and dropdown
    const jumpToButton = page.getByRole('button', { name: 'Jump to' });
    await expect(jumpToButton).toBeVisible();
    await jumpToButton.click();
    const jumpToDropdown = page.locator('div.absolute:has-text("Topics in Data Types")');
    await expect(jumpToDropdown).toBeVisible();
    await expect(jumpToDropdown.getByRole('link', { name: 'User Defined' })).toBeVisible();
  });

});
