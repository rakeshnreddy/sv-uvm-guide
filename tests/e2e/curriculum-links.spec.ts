
import { test, expect } from '@playwright/test';
import { curriculumData } from '../../src/lib/curriculum-data';

test('should successfully load all curriculum pages and have correct titles', async ({ page }) => {
  test.setTimeout(300000); // 5 minute timeout for this long-running test

  for (const courseModule of curriculumData) {
    for (const section of courseModule.sections) {
      for (const topic of section.topics) {
        const url = `/curriculum/${courseModule.slug}/${section.slug}/${topic.slug}`;

        await test.step(`checking ${url}`, async () => {
          const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
          expect(response, `Navigation to ${url} should return a response`).not.toBeNull();
          expect(response!.status(), `Failed to load ${url}`).toBeLessThan(400);

          const heading = page.getByRole('heading', { level: 1 }).first();
          await expect(heading).toContainText(topic.title);
        });
      }
    }
  }
});
