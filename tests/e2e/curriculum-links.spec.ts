
import { test, expect } from '@playwright/test';
import { curriculumData } from '../../src/lib/curriculum-data';

test('should successfully load all curriculum pages and have correct titles', async ({ page }) => {
  for (const courseModule of curriculumData) {
    for (const section of courseModule.sections) {
      for (const topic of section.topics) {
        const url = `/curriculum/${courseModule.slug}/${section.slug}/${topic.slug}`;

        await test.step(`checking ${url}`, async () => {
          const response = await page.goto(url);
          expect(response?.status()).toBe(200);

          const heading = page.locator('h1').first();
          await expect(heading).toHaveText(topic.title);
        });
      }
    }
  }
});
