import { test, expect } from '@playwright/test';

test('sequence config page next link navigates to resource DB page', async ({ page }) => {
  await page.goto('/curriculum/T2_Intermediate/I-UVM-3_Sequences/uvm-config-db');
  await page.click('a:has-text("uvm_resource_db")');
  await expect(page).toHaveURL('/curriculum/T2_Intermediate/I-UVM-3_Sequences/uvm-resource-db');
  await expect(page.getByRole('heading', { level: 1 }).first()).toContainText('uvm_resource_db and Precedence');
});


test.describe('Advanced Navigation Features', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should toggle sidebar with navbar button', async ({ page }) => {
    const quickAccessHeading = page.locator('h2:has-text("Quick Access")');
    await expect(quickAccessHeading).toHaveCount(0);
    await page.getByLabel('Toggle Sidebar').click();
    await expect(quickAccessHeading).toBeVisible();
    await page.locator('h2:has-text("Quick Access") + button').click();
    await expect(quickAccessHeading).toHaveCount(0);
  });

  test('should toggle sidebar with keyboard shortcut (Ctrl+B)', async ({ page }) => {
    const quickAccessHeading = page.locator('h2:has-text("Quick Access")');
    await expect(quickAccessHeading).toHaveCount(0);
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.press(`${modifier}+KeyB`);
    await expect(quickAccessHeading).toBeVisible();
    await page.keyboard.press(`${modifier}+KeyB`);
    await expect(quickAccessHeading).toHaveCount(0);
  });

  test('should focus search bar with keyboard shortcut (Ctrl+K)', async ({ page }) => {
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.press(`${modifier}+KeyK`);
    const searchInput = page.getByTestId('main-search-input');
    await expect.poll(async () => {
      return searchInput.evaluate((el) => document.activeElement === el);
    }).toBeTruthy();
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
    await page.goto('/curriculum/T1_Foundational/F2_SystemVerilog_Basics');

    // Check for progress indicator sourced from curriculum status
    await expect(
      page
        .locator('nav')
        .filter({ hasText: 'SystemVerilog Language Basics' })
        .locator('svg.lucide-clock.text-amber-500')
        .first(),
    ).toBeVisible();

    // Check for "Jump to" button and dropdown
    const jumpToButton = page.getByRole('button', { name: 'Jump to' });
    await expect(jumpToButton).toBeVisible();
    await jumpToButton.click();
    const jumpToDropdown = page.locator('div.absolute:has-text("Topics in F2: SystemVerilog Language Basics")');
    await expect(jumpToDropdown).toBeVisible();
    await expect(jumpToDropdown.getByRole('link', { name: 'F2: SystemVerilog Language Basics' })).toBeVisible();
  });

});
