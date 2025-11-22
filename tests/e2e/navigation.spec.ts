import { test, expect } from '@playwright/test';

test('sequence config page next link navigates to resource DB page', async ({ page }) => {
  await page.goto('/curriculum/T2_Intermediate/I-UVM-3_Sequences/uvm-config-db');
  const nextLessonLink = page.getByRole('link', { name: /^Next lesson uvm_resource_db/i });
  await expect(nextLessonLink, 'Next lesson link should be rendered once').toHaveCount(1);
  await nextLessonLink.click();
  await expect(page).toHaveURL('/curriculum/T2_Intermediate/I-UVM-3_Sequences/uvm-resource-db');
  await expect(page.getByRole('heading', { level: 1 }).first()).toContainText('uvm_resource_db and Precedence');
});


test.describe('Advanced Navigation Features', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should toggle sidebar with navbar button', async ({ page }) => {
    const quickAccessHeading = page.getByRole('heading', { name: 'Quick Access' });
    await expect(quickAccessHeading).toHaveCount(0);
    await page.getByLabel('Toggle Sidebar').click();
    await expect(quickAccessHeading).toBeVisible();
    await page.getByRole('button', { name: 'Close quick access sidebar' }).click();
    await expect(quickAccessHeading).toHaveCount(0);
  });

  test('should toggle sidebar with keyboard shortcut (Ctrl+B)', async ({ page }) => {
    const quickAccessHeading = page.getByRole('heading', { name: 'Quick Access' });
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
    await expect(page.getByText('Notifications', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/View all/)).toBeVisible();
  });

  test('should show enhanced breadcrumbs on a curriculum page', async ({ page }) => {
    await page.goto('/curriculum/T1_Foundational/F2A_Core_Data_Types');

    // Check for progress indicator sourced from curriculum status
    await expect(
      page
        .locator('nav')
        .filter({ hasText: 'Core Data Types' })
        .locator('svg.lucide-clock.text-amber-500')
        .first(),
    ).toBeVisible();

    // Check for "Jump to" button and dropdown
    const jumpToButton = page.getByRole('button', { name: 'Jump to' });
    await expect(jumpToButton).toBeVisible();
    await jumpToButton.click();
    const jumpToDropdown = page.getByRole('menu', { name: 'Topics in F2A: Core Data Types' });
    await expect(jumpToDropdown).toBeVisible();
    await expect(jumpToDropdown.getByRole('menuitem', { name: 'F2A: Core Data Types' })).toBeVisible();
  });

});
