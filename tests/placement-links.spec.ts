import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  placementCategoryFocus,
  placementTierRecommendations,
  type PlacementCategory,
} from '@/components/assessment/placementQuizData';
import { cleanLessonTitle, labelWithCode, moduleCode } from '@/lib/curriculum-overview';
import { curriculumData } from '@/lib/curriculum-data';
import { getAllLabs } from '@/lib/lab-registry';
import { getRoute, resolvePlacementPlan, resolveRoutes } from '@/lib/learning-paths';
import { appRouteExists, isCanonicalLessonHref, readManifest } from './fixtures/site-routes';

(globalThis as typeof globalThis & { React?: typeof React }).React = React;

const routes = resolveRoutes(curriculumData, { labs: getAllLabs() });

function lessonTitle(href: string): string {
  const [tierId, moduleId, slug] = href.replace('/curriculum/', '').split('/');
  const topic = curriculumData
    .find((t) => t.slug === tierId)
    ?.sections.find((s) => s.slug === moduleId)
    ?.topics.find((t) => t.slug === slug);
  return labelWithCode(moduleCode(moduleId), cleanLessonTitle(topic?.title ?? ''));
}

describe('placement result links', () => {
  it('resolve every category resource to a lesson or a page that exists (G30-PATH-01)', () => {
    for (const category of Object.keys(placementCategoryFocus) as PlacementCategory[]) {
      const { resources } = placementCategoryFocus[category];
      expect(resources.length, category).toBeGreaterThan(0);
      for (const resource of resources) {
        expect(appRouteExists(resource.href), `${category}: ${resource.href}`).toBe(true);
        if (resource.href.startsWith('/curriculum/')) {
          expect(isCanonicalLessonHref(resource.href), resource.href).toBe(true);
          expect(resource.label, resource.href).toBe(lessonTitle(resource.href));
        }
      }
    }
  });

  it('no longer link the three lessons that never existed', () => {
    const hrefs = Object.values(placementCategoryFocus).flatMap((c) => c.resources.map((r) => r.href));
    for (const dead of [
      '/curriculum/T1_Foundational/F2_SystemVerilog_Basics/index',
      '/curriculum/T2_Intermediate/I-UVM-2_Agents_and_Sequences/index',
      '/curriculum/T3_Advanced/A-COV-1_Coverage_Strategies/index',
    ]) {
      expect(hrefs).not.toContain(dead);
    }
  });

  it('label each recommended tier with its manifest title and start it on a route (G30-PATH-03)', () => {
    const manifestTitles = new Map(readManifest().tiers.map((t, i) => [i + 1, t.title]));
    expect(placementTierRecommendations.map((r) => r.tier)).toEqual([4, 3, 2, 1]);
    for (const recommendation of placementTierRecommendations) {
      expect(recommendation.label).toBe(manifestTitles.get(recommendation.tier));
      expect(recommendation.route.tier).toBe(recommendation.tier);
      const plan = resolvePlacementPlan(recommendation.route, routes);
      expect(isCanonicalLessonHref(plan.startHref), plan.startHref).toBe(true);
      expect(plan.startTitle).toBe(cleanLessonTitle(plan.startTitle));
      for (const skim of plan.skim) expect(isCanonicalLessonHref(skim.href), skim.href).toBe(true);
      // The start lesson sits in the recommended tier, so the label and the link agree.
      expect(plan.startHref.split('/')[2]).toMatch(new RegExp(`^T${recommendation.tier}_`));
    }
  });

  it('start each tier where its route step begins', () => {
    const start = Object.fromEntries(
      placementTierRecommendations.map((r) => [r.tier, resolvePlacementPlan(r.route, routes).startHref]),
    );
    expect(start).toEqual({
      1: '/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index',
      2: '/curriculum/T2_Intermediate/I-SV-1_OOP/index',
      3: '/curriculum/T3_Advanced/A-UVM-6_Scoreboards_and_Reference_Models/index',
      4: '/curriculum/T4_Expert/E-DBG-1_Advanced_UVM_Debug_Methodologies/index',
    });
    expect(getRoute('junior').steps.map((s) => s.id)).toEqual(
      expect.arrayContaining(placementTierRecommendations.filter((r) => r.route.routeId === 'junior').map((r) => r.route.startStepId)),
    );
  });
});

describe('placement page with default flags', () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('@/tools/featureFlags');
  });

  async function renderPage(tracking: boolean): Promise<string> {
    vi.resetModules();
    vi.doMock('@/tools/featureFlags', () => ({ __esModule: true, isFeatureEnabled: () => tracking }));
    vi.doMock('next/link', () => ({
      __esModule: true,
      default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
        React.createElement('a', { href, ...rest }, children),
    }));
    const { default: Page } = await import('@/app/(learning)/quiz/placement/page');
    return renderToStaticMarkup(React.createElement(Page));
  }

  it('links neither the dashboard nor the disabled assessment center when tracking is off (G30-PATH-02, G30-PATH-06)', async () => {
    const html = await renderPage(false);
    expect(html).toContain('<h1');
    expect(html).not.toContain('href="/dashboard"');
    expect(html).not.toContain('href="/assessment"');
    for (const href of [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1])) {
      expect(appRouteExists(href), href).toBe(true);
    }
  });

  it('links the assessment center when tracking is on', async () => {
    expect(await renderPage(true)).toContain('href="/assessment"');
  });
});
