import { test, expect } from '@playwright/test';
import { curriculumData } from '../../src/lib/curriculum-data';

test('all curriculum pages load', async ({ page }) => {
  for (const module of curriculumData) {
    for (const section of module.sections) {
      for (const topic of section.topics) {
        const url = `/curriculum/${module.slug}/${section.slug}/${topic.slug}`;
        const response = await page.goto(url);
        expect(response?.status(), `Failed to load ${url}`).toBeLessThan(400);
      }
    }
  }
});
