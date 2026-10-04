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
  // The assistant is mounted by the (learning) layout; the public landing page at / does not render it.
  await page.goto('/curriculum');
  await page.getByRole('button', { name: 'Open AI assistant' }).click();
  const dialog = page.getByRole('dialog', { name: 'AI Assistant' });
  await dialog.getByRole('textbox', { name: 'Message to AI tutor' }).fill('hello');
  await dialog.getByRole('button', { name: 'Send message' }).click();
  const thinking = dialog.getByText('Assistant is thinking…');
  await expect(thinking).toBeVisible();
  await expect(thinking).toBeHidden();
  await expect(dialog.getByText('hi there')).toBeVisible();
});
