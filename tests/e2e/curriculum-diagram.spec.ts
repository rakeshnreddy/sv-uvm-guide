import { test, expect } from '@playwright/test';
import { verificationStackLinks } from '@/components/diagrams/verification-stack-links';

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const curriculumLinks = verificationStackLinks.filter(link => link.href.startsWith('/curriculum/'));

test.describe('Curriculum verification stack quick links', () => {
  for (const { title, href } of curriculumLinks) {
    test(`selecting "${title}" navigates to ${href}`, async ({ page }) => {
      await page.goto('/curriculum');

      // Scope to the stack section: the overview also lists routes and modules whose
      // names can contain a card title (for example "Functional Coverage Fundamentals").
      const stack = page.getByRole('region', { name: 'Explore the verification stack' });
      const card = stack.getByRole('link', { name: new RegExp(escapeRegExp(title), 'i') });
      await card.waitFor({ state: 'visible' });

      const expectedUrl = new RegExp(`${escapeRegExp(href)}$`);

      await Promise.all([
        page.waitForURL(expectedUrl),
        card.click(),
      ]);

      await expect(page).toHaveURL(expectedUrl);
    });
  }
});
