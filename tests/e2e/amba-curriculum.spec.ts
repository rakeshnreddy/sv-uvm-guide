import { expect, test, type Page } from '@playwright/test';
import {
  curriculumData,
  findPrevNextTopics,
  getBreadcrumbs,
  type Topic,
} from '../../src/lib/curriculum-data';

type TopicRoute = {
  tierSlug: string;
  sectionSlug: string;
  topic: Topic;
};

const ambaSectionSlugs = [
  'B-AMBA-1_Protocol_Families_and_Tradeoffs',
  'B-AMBA-2_Protocol_Intuition_and_Memory_Hooks',
  'B-AHB-1_AHB_Design_Timing_Mechanics',
  'B-AHB-2_AHB_Pitfalls_and_Deadlocks',
  'B-AHB-3_AHB_Verification',
  'B-AXI-1_AXI_Channel_Architecture',
  'B-AXI-2_AXI_Burst_Math',
  'B-AXI-3_AXI_Ordering_and_IDs',
  'B-AXI-4_AXI_Expert_Features_Cache_Atomics',
  'B-AXI-5_AXI_Pitfalls_Interconnect_Deadlocks',
  'B-AXI-6_AXI_Verification_Performance',
  'B-AMBA-F1_Bridges_and_System_Integration',
  'B-AMBA-F2_Future_Protocols_ACE_CHI',
  'B-AMBA-F3_Interview_Debug_Clinic',
];

const visualizerTestIds: Record<string, string> = {
  'B-AMBA-1_Protocol_Families_and_Tradeoffs': 'amba-family-explorer',
  'B-AMBA-2_Protocol_Intuition_and_Memory_Hooks': 'protocol-analogy-explorer',
  'B-AHB-1_AHB_Design_Timing_Mechanics': 'ahb-pipeline-burst-visualizer',
  'B-AXI-1_AXI_Channel_Architecture': 'axi-channel-handshake-visualizer',
  'B-AXI-2_AXI_Burst_Math': 'axi-memory-math-visualizer',
  'B-AXI-3_AXI_Ordering_and_IDs': 'axi-id-ordering-visualizer',
  'B-AXI-4_AXI_Expert_Features_Cache_Atomics': 'exclusive-access-visualizer',
  'B-AXI-5_AXI_Pitfalls_Interconnect_Deadlocks': 'axi-deadlock-simulator',
  'B-AMBA-F1_Bridges_and_System_Integration': 'bridge-translation-explorer',
};

const allRoutes: TopicRoute[] = curriculumData.flatMap((tier) =>
  tier.sections.flatMap((section) =>
    section.topics.map((topic) => ({
      tierSlug: tier.slug,
      sectionSlug: section.slug,
      topic,
    })),
  ),
);

const ambaRoutes = ambaSectionSlugs.map((sectionSlug) => {
  const route = allRoutes.find((candidate) => candidate.sectionSlug === sectionSlug);
  if (!route) {
    throw new Error(`Missing generated curriculum route for ${sectionSlug}`);
  }
  return route;
});

const hrefFor = ({ tierSlug, sectionSlug, topic }: TopicRoute) =>
  `/curriculum/${tierSlug}/${sectionSlug}/${topic.slug}`;

const expectLesson = async (page: Page, route: TopicRoute) => {
  const href = hrefFor(route);
  const response = await page.goto(href, { waitUntil: 'domcontentloaded' });
  expect(response, `${href} should return a response`).not.toBeNull();
  expect(response!.status(), `${href} should load successfully`).toBeLessThan(400);

  await expect(page.getByRole('heading', { level: 1 }).first(), `${href} should render the lesson title`)
    .toContainText(route.topic.title);
};

test.describe('AMBA curriculum coverage', () => {
  test('all AMBA protocol pages render lesson content and flashcards', async ({ page }) => {
    test.setTimeout(180_000);

    for (const route of ambaRoutes) {
      await test.step(route.sectionSlug, async () => {
        await expectLesson(page, route);
        await expect(page.getByRole('heading', { name: 'Reinforce the essentials' })).toBeVisible();
        await expect(page.getByText('Card 1 of 5')).toBeVisible();
      });
    }
  });

  test('embedded AMBA visualizers render and expose their basic controls', async ({ page }) => {
    test.setTimeout(180_000);

    for (const route of ambaRoutes.filter(({ sectionSlug }) => visualizerTestIds[sectionSlug])) {
      await test.step(route.sectionSlug, async () => {
        await expectLesson(page, route);
        await expect(page.getByTestId(visualizerTestIds[route.sectionSlug])).toBeVisible();
      });
    }
  });

  test('bridge and analogy interactives respond inside curriculum pages', async ({ page }) => {
    const bridgeRoute = ambaRoutes.find(({ sectionSlug }) => sectionSlug === 'B-AMBA-F1_Bridges_and_System_Integration');
    const analogyRoute = ambaRoutes.find(({ sectionSlug }) => sectionSlug === 'B-AMBA-2_Protocol_Intuition_and_Memory_Hooks');
    expect(bridgeRoute).toBeTruthy();
    expect(analogyRoute).toBeTruthy();

    await expectLesson(page, bridgeRoute!);
    await page.getByTestId('scenario-btn-0').click();
    await expect(page.getByTestId('axi-bursts-container')).toContainText('AXI Burst 1');
    await expect(page.getByTestId('axi-bursts-container')).not.toContainText('AXI Burst 2');

    await expectLesson(page, analogyRoute!);
    await page.getByRole('button', { name: 'Reading Data' }).click();
    await page.getByRole('button', { name: 'Next Step' }).click();
    await expect(page.getByText('Step 1 of 2')).toBeVisible();
  });

  test('AMBA breadcrumbs and previous-next links are navigable with browser history', async ({ page }) => {
    const route = ambaRoutes.find(({ sectionSlug }) => sectionSlug === 'B-AMBA-F1_Bridges_and_System_Integration');
    expect(route).toBeTruthy();

    const href = hrefFor(route!);
    await expectLesson(page, route!);

    const breadcrumbs = getBreadcrumbs([route!.tierSlug, route!.sectionSlug, route!.topic.slug]);
    for (const breadcrumb of breadcrumbs.slice(0, -1)) {
      await expect(
        page.locator(`a[href="${breadcrumb.path}"]`).filter({ hasText: breadcrumb.title }).first(),
        `${href} should expose breadcrumb ${breadcrumb.path}`,
      ).toBeVisible();
    }

    const { next } = findPrevNextTopics([route!.tierSlug, route!.sectionSlug, route!.topic.slug]);
    expect(next, `${href} should have a next AMBA topic`).toBeTruthy();

    const nextHref = `/curriculum/${next!.slug}`;
    await page.locator(`main nav a[href="${nextHref}"]`).first().click();
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(nextHref);

    await page.goBack({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(href);

    await page.goForward({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(nextHref);
  });
});
