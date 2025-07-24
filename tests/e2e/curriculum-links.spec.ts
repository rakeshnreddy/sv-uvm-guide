
import { test, expect } from '@playwright/test';
import { curriculumData } from '../../src/lib/curriculum-data';

for (const courseModule of curriculumData) {
  for (const section of courseModule.sections) {
    for (const topic of section.topics) {
      const url = `/curriculum/${courseModule.slug}/${section.slug}/${topic.slug}`;
      test(`should successfully load ${url}`, async ({ page }) => {
        const response = await page.goto(url);
        expect(response?.status()).toBe(200);
      });
    }
  }
}
