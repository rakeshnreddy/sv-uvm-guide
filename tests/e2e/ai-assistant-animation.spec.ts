import { test, expect } from '@playwright/test';

test('AI assistant shows loading spinner when sending message', async ({ page }) => {
  await page.route('**/api/ai/chat', async route => {
    await new Promise(r => setTimeout(r, 500));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ reply: 'hi there' })
    });
  });
  await page.goto('/');
  await page.getByLabel('Open AI Assistant').click();
  const input = page.getByPlaceholder(/ask about systemverilog, uvm/i);
  await input.fill('hello');
  await page.getByLabel('Send message').click();
  const spinner = page.locator('.animate-spin');
  await expect(spinner).toBeVisible();
  await expect(spinner).toBeHidden();
  await expect(page.getByText('hi there')).toBeVisible();
});
