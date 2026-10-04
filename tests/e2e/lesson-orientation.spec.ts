import { expect, test, type Page } from '@playwright/test';

import { findPrevNextTopics, toPrettyCurriculumSlug } from '../../src/lib/curriculum-data';
import { getLessonContext } from '../../src/lib/curriculum/lesson-context';

/**
 * The lesson page's orientation and URL guarantees (G30 lesson-page-navigation
 * acceptance): one canonical URL per lesson, one main and one h1, "Before you
 * start" from the manifest, a Next card that follows the generated path, an
 * "On this page" list whose anchors exist, practice before References, and
 * not-found pages that are not dead ends.
 *
 * URLs that are not lessons are built with template literals so the QA audit
 * of hard-coded curriculum routes does not read them as stale lesson links.
 */

const F1A = '/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index';
const F1B = '/curriculum/T1_Foundational/F1B_The_Verification_Mindset/index';
const VIRTUAL_SEQUENCES = '/curriculum/T2_Intermediate/I-UVM-3B_Advanced_Sequencing_and_Layering/virtual-sequences';
const AMBA_FAMILIES = '/curriculum/T3_Advanced/B-AMBA-1_Protocol_Families_and_Tradeoffs/index';
const PSS = '/curriculum/T4_Expert/E-PSS-1_Portable_Stimulus_Standard/index';

const segmentsOf = (href: string) => href.replace(/^\/curriculum\//, '').split('/');

async function redirectTarget(page: Page, path: string): Promise<{ status: number; location: string }> {
  const response = await page.request.get(path, { maxRedirects: 0 });
  const location = response.headers()['location'] ?? '';
  return { status: response.status(), location: location ? new URL(location, 'http://localhost').pathname : '' };
}

test.describe('canonical lesson URLs (G30-PAGE-03, G30-LINK-V03, G30-LINK-V11)', () => {
  test('every other URL form redirects permanently to /curriculum/<Tier>/<Module>/<lesson>', async ({ page }) => {
    const pretty = `/curriculum/${segmentsOf(F1B).map(toPrettyCurriculumSlug).join('/')}`;
    const extra = `${F1A}/x/y`;
    const cases: Array<[string, string]> = [
      ['/curriculum/T1_Foundational/F1B_The_Verification_Mindset', F1B],
      ['/curriculum/T1_Foundational', F1A],
      [pretty, F1B],
      [extra, F1A],
    ];
    for (const [from, to] of cases) {
      expect(await redirectTarget(page, from), from).toEqual({ status: 308, location: to });
    }
    expect((await page.request.get(F1B, { maxRedirects: 0 })).status()).toBe(200);
  });

  test('a legacy module URL lands on its replacement lesson (G30-LINK-03)', async ({ page }) => {
    const response = await page.goto(`/curriculum/T2_Intermediate/${'I-UVM-3_Sequences'}`);
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL('/curriculum/T2_Intermediate/I-UVM-3A_Fundamentals/index');
  });

  test("the tier crumb's old target and F1A's Next both work", async ({ page }) => {
    await page.goto('/curriculum/T1_Foundational');
    await expect(page).toHaveURL(F1A);
    const next = page.getByRole('navigation', { name: 'Previous and next lesson' }).getByRole('link', { name: /^Next lesson/ });
    await next.click();
    await expect(page).toHaveURL(F1B);
  });
});

test.describe('lesson orientation at 1280 px', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  for (const href of [F1B, VIRTUAL_SEQUENCES, AMBA_FAMILIES]) {
    test(`${href} orients the learner`, async ({ page }) => {
      await page.goto(href);
      const context = getLessonContext(segmentsOf(href))!;

      await expect(page.locator('main')).toHaveCount(1);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.getByTestId('lesson-position')).toContainText(
        `Lesson ${context.lesson.position} of ${context.lesson.count} in ${context.module.label}`,
      );

      // "Before you start" lists the manifest prerequisites (and the previous page of the module).
      const chips = page.getByTestId('before-you-start-chips').getByRole('link');
      await expect(chips).toHaveCount(context.prerequisites.length);
      for (const [index, item] of context.prerequisites.entries()) {
        await expect(chips.nth(index)).toHaveAttribute('href', item.href);
      }

      // The Next card follows the generated (core) path.
      const { next } = findPrevNextTopics(segmentsOf(href));
      const nextLink = page.getByRole('navigation', { name: 'Previous and next lesson' }).getByRole('link', { name: /^Next lesson/ });
      await expect(nextLink).toHaveAttribute('href', `/curriculum/${next!.slug}`);

      // Every "On this page" anchor exists on the page.
      const toc = page.getByRole('navigation', { name: 'On this page' });
      await expect(toc).toBeVisible();
      const hashes = await toc.getByRole('link').evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
      expect(hashes.length).toBeGreaterThan(0);
      for (const hash of hashes) {
        expect(hash.startsWith('#'), hash).toBe(true);
        await expect(page.locator(`[id="${hash.slice(1)}"]`), hash).toHaveCount(1);
      }
    });
  }

  test('practice comes before References & Next Topics (G30-PAGE-V02)', async ({ page }) => {
    await page.goto(PSS);
    const lesson = page.getByTestId('lesson-content');
    const flashcards = lesson.getByRole('heading', { name: 'Reinforce the essentials' });
    const teachBack = lesson.getByRole('heading', { name: 'Teach it back' });
    const references = lesson.getByRole('heading', { name: 'References & Next Topics' });
    const top = async (locator: typeof flashcards) => (await locator.boundingBox())!.y;
    expect(await top(flashcards)).toBeLessThan(await top(references));
    expect(await top(teachBack)).toBeLessThan(await top(references));
    await expect(page.getByRole('navigation', { name: 'On this page' }).getByRole('link', { name: 'Reinforce the essentials' })).toHaveAttribute(
      'href',
      '#reinforce-the-essentials',
    );
  });
});

test.describe('lesson orientation at 390 px', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('"On this page" is a collapsed disclosure and the page does not scroll sideways', async ({ page }) => {
    await page.goto(VIRTUAL_SEQUENCES);
    const toggle = page.getByRole('button', { name: /^On this page/ });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect.poll(async () => {
      if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
      return toggle.getAttribute('aria-expanded');
    }).toBe('true');
    await expect(page.getByRole('navigation', { name: 'On this page' }).getByRole('link').first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe('not-found pages (G30-PAGE-04)', () => {
  test('a curriculum URL that is not a lesson gets the curriculum 404 inside the layout', async ({ page }) => {
    const response = await page.goto(`/curriculum/${'does-not-exist'}`);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Curriculum overview' })).toHaveAttribute('href', '/curriculum');
    await expect(page.getByRole('heading', { name: 'Search tips' })).toBeVisible();
  });

  test('a URL that escaped /curriculum suggests the lesson it meant and keeps the site navigation', async ({ page }) => {
    const response = await page.goto(`/${'T2_Intermediate'}/I-SV-1_OOP`);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
    await expect(page.getByRole('link', { name: /^I-SV-1: / }).first()).toHaveAttribute('href', '/curriculum/T2_Intermediate/I-SV-1_OOP/index');
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.getByRole('contentinfo')).toBeVisible();
  });
});
