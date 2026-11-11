import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import CurriculumPage from '@/app/(learning)/curriculum/page';
import HistoryPage from '@/app/(learning)/history/page';
import LearningStrategiesPage from '@/app/(learning)/learning-strategies/page';
import ProjectsPage from '@/app/(learning)/projects/page';
import PlacementQuizPage from '@/app/(learning)/quiz/placement/page';
import ResourcesPage from '@/app/(learning)/resources/page';
import UvmPhaseSorterPage from '@/app/(learning)/exercises/uvm-phase-sorter/page';
import FlashcardReviewPage from '@/app/(learning)/dashboard/review/page';
import PrivacyPolicyPage from '@/app/(public)/privacy-policy/page';
import TermsOfServicePage from '@/app/(public)/terms-of-service/page';
import PracticeHub from '@/components/practice/PracticeHub';

/*
 * Phase 3a page frames: every learning page sits on one PageShell (no second
 * centred container inside the page frame) under one PageHeader, whose h1
 * starts with the page's navigation label.
 */

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'dark', resolvedTheme: 'dark', systemTheme: 'dark', setTheme: vi.fn() }),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// Some page modules use the automatic JSX runtime that Next.js provides; give them the global it expects.
(globalThis as { React?: typeof React }).React = React;

afterEach(() => {
  cleanup();
});

const PAGES: [string, React.ComponentType, string, string][] = [
  ['/curriculum', CurriculumPage, 'content', 'Curriculum'],
  ['/practice', PracticeHub, 'content', 'Practice hub'],
  ['/dashboard/review', FlashcardReviewPage, 'content', 'Review'],
  ['/resources', ResourcesPage, 'content', 'Resources'],
  ['/projects', ProjectsPage, 'reading', 'Projects'],
  ['/history', HistoryPage, 'reading', 'History'],
  ['/learning-strategies', LearningStrategiesPage, 'reading', 'Learning strategies'],
  ['/quiz/placement', PlacementQuizPage, 'content', 'Find your level'],
  ['/exercises/uvm-phase-sorter', UvmPhaseSorterPage, 'content', 'UVM phase sorter'],
  ['/privacy-policy', PrivacyPolicyPage, 'reading', 'Privacy policy'],
  ['/terms-of-service', TermsOfServicePage, 'reading', 'Terms of service'],
];

/** A centred, capped container (mx-auto with a 768 to 1280 px or screen cap) that would fight the page frame. */
const CENTRED_CONTAINER = /(^|\s)mx-auto(\s|$)/;
const PAGE_CAP = /(^|\s)max-w-(3xl|4xl|5xl|6xl|7xl|screen-\w+)(\s|$)/;

describe.each(PAGES)('%s', (_route, Page, width, label) => {
  it('has one PageShell, one PageHeader and one h1 that starts with its navigation label', () => {
    const { container } = render(<Page />);
    const shells = container.querySelectorAll('[data-page-shell]');
    expect(shells).toHaveLength(1);
    expect(shells[0]).toHaveAttribute('data-width', width);

    const h1s = container.querySelectorAll('h1');
    expect(h1s).toHaveLength(1);
    expect(h1s[0].closest('[data-page-header]')).not.toBeNull();
    expect(h1s[0].textContent?.trim().startsWith(label)).toBe(true);
  });

  it('adds no centred page container and no card around the header', () => {
    const { container } = render(<Page />);
    const shell = container.querySelector('[data-page-shell]') as HTMLElement;
    const inner = shell.querySelector('[data-page-shell-inner]') as HTMLElement;
    // The page's own boxes: the h1's ancestors up to the shell, and the blocks directly inside it.
    const boxes: Element[] = [...Array.from(inner.children)];
    for (let node = container.querySelector('h1')?.parentElement; node && node !== shell; node = node.parentElement) boxes.push(node);
    for (const element of boxes) {
      const className = element.getAttribute('class') ?? '';
      if (PAGE_CAP.test(className)) expect(className, element.tagName).not.toMatch(CENTRED_CONTAINER);
    }
    const header = container.querySelector('[data-page-header]') as HTMLElement;
    expect(header.closest('.bg-card')).toBeNull();
  });
});

describe('top-level and second-level pages', () => {
  it('give breadcrumbs only below the top level', () => {
    const { container, unmount } = render(<CurriculumPage />);
    expect(container.querySelector('[data-page-header] nav[aria-label="Breadcrumb"]')).toBeNull();
    unmount();
    render(<PlacementQuizPage />);
    expect(document.querySelector('[data-page-header] nav[aria-label="Breadcrumb"]')).not.toBeNull();
  });

  it('put section headings in Section: the h2 token, labelled regions', () => {
    const { container } = render(<HistoryPage />);
    const sections = container.querySelectorAll('[data-section]');
    expect(sections.length).toBeGreaterThanOrEqual(4);
    for (const section of Array.from(sections)) {
      const heading = section.querySelector('h2');
      expect(heading).toHaveClass('text-h2');
      expect(section).toHaveAttribute('aria-labelledby', heading?.id);
    }
  });
});
