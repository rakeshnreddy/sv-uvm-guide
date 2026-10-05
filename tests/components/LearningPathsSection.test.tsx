import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import HeroSection from '@/components/home/HeroSection';
import LearningPathsSection from '@/components/home/LearningPathsSection';
import { curriculumData } from '@/lib/curriculum-data';
import { getAllLabs } from '@/lib/lab-registry';
import { EXPERT_INDEX_HREF, LEARNING_ROUTES, PLACEMENT_QUIZ_HREF, resolveRoutes, summarizeRoutes } from '@/lib/learning-paths';
import { appRouteExists } from '../fixtures/site-routes';

const F1A = '/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index';
const routes = summarizeRoutes(resolveRoutes(curriculumData, { labs: getAllLabs() }));

beforeAll(() => {
  // framer-motion's whileInView needs an IntersectionObserver; jsdom has none.
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    },
  );
});

afterEach(() => {
  cleanup();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('route summaries for the home page', () => {
  it('follow LEARNING_ROUTES: same order, taglines, steps and calls to action', () => {
    expect(routes.map((route) => route.id)).toEqual(LEARNING_ROUTES.map((route) => route.id));
    routes.forEach((route, index) => {
      const source = LEARNING_ROUTES[index];
      expect(route.tagline).toBe(source.tagline);
      expect(route.steps).toEqual(source.steps.map((step) => step.title));
      expect(route.overviewHref).toBe(`/curriculum#route-${route.id}`);
      expect(route.lessonCount).toBeGreaterThan(0);
    });
    expect(Object.fromEntries(routes.map((route) => [route.id, route.cta]))).toEqual({
      junior: { label: 'Begin the Junior route', href: F1A },
      practitioner: { label: 'Find your level', href: PLACEMENT_QUIZ_HREF },
      expert: { label: 'Expert layers', href: EXPERT_INDEX_HREF },
    });
  });
});

describe('home page route cards (G30-PATH-05; NB2 request 3)', () => {
  it('shows one card per route, as a list under a level-2 heading', () => {
    render(<LearningPathsSection routes={routes} />);
    const section = screen.getByRole('region', { name: 'Choose your route' });
    expect(within(section).getByRole('heading', { level: 2, name: 'Choose your route' })).toBeInTheDocument();
    const cards = within(section).getAllByRole('article');
    expect(cards.map((card) => card.getAttribute('aria-labelledby'))).toEqual(routes.map((route) => `home-route-${route.id}`));
    expect(within(section).getAllByRole('listitem').filter((item) => item.parentElement?.tagName === 'UL')).toHaveLength(3);
  });

  it('sends Junior to F1A, Practitioner to the placement quiz and Expert to the expert index', () => {
    render(<LearningPathsSection routes={routes} />);
    const card = (name: string) => screen.getByRole('article', { name });
    expect(within(card('Start here')).getByRole('link', { name: 'Begin the Junior route' })).toHaveAttribute('href', F1A);
    expect(within(card('Working DV engineer')).getByRole('link', { name: 'Find your level' })).toHaveAttribute(
      'href',
      '/quiz/placement',
    );
    expect(within(card('Jump in')).getByRole('link', { name: 'Expert layers' })).toHaveAttribute('href', '/curriculum/expert-index');
    expect(within(card('Start here')).getByRole('link', { name: 'See the Junior route' })).toHaveAttribute(
      'href',
      '/curriculum#route-junior',
    );
  });

  it('lists each route\'s steps in order and names its audience', () => {
    render(<LearningPathsSection routes={routes} />);
    for (const route of routes) {
      const card = screen.getByRole('article', { name: route.tagline });
      expect(within(card).getByText(`${route.name} route`)).toBeInTheDocument();
      expect(within(card).getByText(route.audience)).toBeInTheDocument();
      expect(within(card).getByText(`${route.steps.length} steps · ${route.lessonCount} lessons`)).toBeInTheDocument();
      const steps = within(card).getByRole('list');
      expect(within(steps).getAllByRole('listitem').map((item) => item.textContent)).toEqual(route.steps);
    }
  });

  it('links only pages that exist', () => {
    render(<LearningPathsSection routes={routes} />);
    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThanOrEqual(7);
    for (const link of links) {
      const href = link.getAttribute('href') ?? '';
      expect(appRouteExists(href), href).toBe(true);
    }
    expect(screen.getByRole('link', { name: 'Take the placement quiz' })).toHaveAttribute('href', '/quiz/placement');
    expect(screen.getByRole('link', { name: 'compare the routes on the curriculum overview' })).toHaveAttribute(
      'href',
      '/curriculum#routes',
    );
  });
});

describe('home hero', () => {
  it('offers the placement quiz under the Practitioner route\'s name, and the curriculum', () => {
    render(<HeroSection />);
    expect(screen.getByRole('heading', { level: 1, name: /Master SystemVerilog & UVM/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Find your level' })).toHaveAttribute('href', '/quiz/placement');
    expect(screen.getByRole('link', { name: 'Browse the curriculum' })).toHaveAttribute('href', '/curriculum');
  });
});
