import { test, expect } from '@playwright/test';
import { curriculumData } from '../../src/lib/curriculum-data';

test('all curriculum pages load', async ({ page }) => {
  test.setTimeout(300000); // 5 minute timeout for this long-running test

  for (const module of curriculumData) {
    for (const section of module.sections) {
      for (const topic of section.topics) {
        const url = `/curriculum/${module.slug}/${section.slug}/${topic.slug}`;
        const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
        expect(response, `Navigation to ${url} should return a response`).not.toBeNull();
        expect(response!.status(), `Failed to load ${url}`).toBeLessThan(400);
      }
    }
  }
});
