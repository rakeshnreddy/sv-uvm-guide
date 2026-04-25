import { expect, test, type Page } from '@playwright/test';
import {
  curriculumData,
  findPrevNextTopics,
  getBreadcrumbs,
  toPrettyCurriculumSlug,
  type Topic,
} from '../../src/lib/curriculum-data';

type TopicRoute = {
  tierSlug: string;
  sectionSlug: string;
  topic: Topic;
};

const topicRoutes: TopicRoute[] = curriculumData.flatMap((tier) =>
  tier.sections.flatMap((section) =>
    section.topics.map((topic) => ({
      tierSlug: tier.slug,
      sectionSlug: section.slug,
      topic,
    })),
  ),
);

const canonicalHref = ({ tierSlug, sectionSlug, topic }: TopicRoute) =>
  `/curriculum/${tierSlug}/${sectionSlug}/${topic.slug}`;

const prettyHref = ({ tierSlug, sectionSlug, topic }: TopicRoute) =>
  `/curriculum/${[
    toPrettyCurriculumSlug(tierSlug),
    toPrettyCurriculumSlug(sectionSlug),
    toPrettyCurriculumSlug(topic.slug),
  ].join('/')}`;

const sameOriginInternalHref = (rawHref: string, baseUrl: string): string | null => {
  if (
    !rawHref ||
    rawHref.startsWith('#') ||
    rawHref.startsWith('mailto:') ||
    rawHref.startsWith('tel:') ||
    rawHref.startsWith('javascript:')
  ) {
    return null;
  }

  const base = new URL(baseUrl);
  const target = new URL(rawHref, base);
  if (target.origin !== base.origin) {
    return null;
  }

  return `${target.pathname}${target.search}${target.hash}`;
};

const expectRouteToLoad = async (page: Page, href: string, expectedTitle?: string) => {
  const response = await page.goto(href, { waitUntil: 'domcontentloaded' });
  expect(response, `${href} should return a response`).not.toBeNull();
  expect(response!.status(), `${href} should return < 400`).toBeLessThan(400);

  const heading = page.getByRole('heading', { level: 1 }).first();
  await expect(heading, `${href} should render an h1`).toBeVisible();
  if (expectedTitle) {
    await expect(heading, `${href} should render the expected lesson title`).toContainText(expectedTitle);
  }
};

test.describe('comprehensive curriculum navigation', () => {
  test('pretty curriculum URLs render the canonical lesson content', async ({ page }) => {
    test.setTimeout(5 * 60 * 1000);

    for (const route of topicRoutes) {
      await test.step(prettyHref(route), async () => {
        await expectRouteToLoad(page, prettyHref(route), route.topic.title);
      });
    }
  });

  test('every lesson exposes clickable breadcrumbs and previous/next browser history', async ({ page }) => {
    test.setTimeout(10 * 60 * 1000);

    for (const route of topicRoutes) {
      const href = canonicalHref(route);

      await test.step(href, async () => {
        await expectRouteToLoad(page, href, route.topic.title);

        const breadcrumbs = getBreadcrumbs([route.tierSlug, route.sectionSlug, route.topic.slug]);
        for (const breadcrumb of breadcrumbs.slice(0, -1)) {
          const breadcrumbLink = page.locator(`a[href="${breadcrumb.path}"]`).filter({ hasText: breadcrumb.title }).first();
          await expect(breadcrumbLink, `${href} should expose breadcrumb ${breadcrumb.path}`).toBeVisible();
        }

        const jumpToButton = page.getByRole('button', { name: 'Jump to' });
        await expect(jumpToButton, `${href} should expose the jump menu`).toBeVisible();
        await expect.poll(async () => {
          if ((await jumpToButton.getAttribute('aria-expanded')) === 'true') {
            return 'true';
          }

          await jumpToButton.click();
          await page.waitForTimeout(100);
          return jumpToButton.getAttribute('aria-expanded');
        }, {
          message: `${href} should toggle the jump menu after hydration`,
          timeout: 10_000,
        }).toBe('true');

        const jumpMenuId = await jumpToButton.getAttribute('aria-controls');
        expect(jumpMenuId, `${href} should point at the jump menu`).toBeTruthy();
        const jumpMenu = page.locator(`[id="${jumpMenuId}"]`);
        await expect(jumpMenu, `${href} should open the jump menu`).toBeVisible();
        await expect(jumpMenu.locator('a[href^="/curriculum/"]').first()).toBeVisible();

        const { prev, next } = findPrevNextTopics([route.tierSlug, route.sectionSlug, route.topic.slug]);
        for (const target of [prev, next].filter((item): item is Topic => Boolean(item))) {
          const targetHref = `/curriculum/${target.slug}`;
          await expectRouteToLoad(page, href, route.topic.title);
          const navLink = page.locator(`main nav a[href="${targetHref}"]`).first();
          await expect(navLink, `${href} should link to ${targetHref}`).toBeVisible();

          await navLink.click();
          await page.waitForLoadState('domcontentloaded');
          await expect(page, `${href} should navigate to ${targetHref}`).toHaveURL(targetHref);

          await page.goBack({ waitUntil: 'domcontentloaded' });
          await expect(page, `${targetHref} should go back to ${href}`).toHaveURL(href);

          await page.goForward({ waitUntil: 'domcontentloaded' });
          await expect(page, `${href} should go forward to ${targetHref}`).toHaveURL(targetHref);

          await page.goBack({ waitUntil: 'domcontentloaded' });
          await expect(page, `${targetHref} should return to ${href}`).toHaveURL(href);
        }
      });
    }
  });

  test('every internal link rendered from curriculum pages resolves without a 404', async ({ page }) => {
    test.setTimeout(10 * 60 * 1000);
    const linksBySource = new Map<string, Set<string>>();
    const brokenLinks: string[] = [];

    for (const route of topicRoutes) {
      const sourceHref = canonicalHref(route);
      await expectRouteToLoad(page, sourceHref, route.topic.title);

      const hrefs = await page.locator('a[href]').evaluateAll((anchors, currentUrl) => {
        return anchors
          .map((anchor) => ({
            href: anchor.getAttribute('href') ?? '',
            target: anchor.getAttribute('target') ?? '',
          }))
          .filter(({ target }) => target.toLowerCase() !== '_blank')
          .map(({ href }) => href);
      }, page.url());

      const normalized = new Set(
        hrefs
          .map((href) => sameOriginInternalHref(href, page.url()))
          .filter((href): href is string => Boolean(href)),
      );

      linksBySource.set(sourceHref, normalized);
    }

    for (const [sourceHref, hrefs] of linksBySource) {
      await test.step(sourceHref, async () => {
        for (const href of hrefs) {
          const [pathAndSearch] = href.split('#');
          const response = await page.request.get(pathAndSearch || href);
          if (response.status() >= 400) {
            brokenLinks.push(`${sourceHref} -> ${href} returned ${response.status()}`);
          }
        }
      });
    }

    expect(brokenLinks).toEqual([]);
  });
});
