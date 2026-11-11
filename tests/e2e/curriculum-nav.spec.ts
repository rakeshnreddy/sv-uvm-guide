import { test, expect } from '@playwright/test';
import { curriculumData } from '../../src/lib/curriculum-data';
import { tierSectionHref, tierSectionId } from '../../src/lib/site-links';

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

test('tier URLs go to their section of /curriculum, with the heading clear of the header', async ({ page }) => {
  for (const tier of curriculumData) {
    const response = await page.goto(`/curriculum/${tier.slug}`);
    expect(response!.status(), `/curriculum/${tier.slug}`).toBeLessThan(400);
    await expect(page).toHaveURL(new RegExp(`/curriculum${tierSectionHref(tier.slug).replace('/curriculum', '')}$`));
    const section = page.locator(`section#${tierSectionId(tier.slug)}`);
    await expect(section).toHaveCount(1);
    const heading = section.getByRole('heading', { level: 3 });
    await expect(heading).toBeInViewport();
    expect((await heading.boundingBox())!.y, tier.slug).toBeGreaterThanOrEqual(64);
  }
});
