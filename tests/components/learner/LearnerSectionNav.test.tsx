import React from 'react';
import { renderToString } from 'react-dom/server';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  LearnerSectionNav,
  LEARNER_SECTION_LINKS,
  learnerBreadcrumbs,
  type LearnerSection,
} from '@/components/learner/LearnerSectionNav';
import { FOOTER_NAV } from '@/lib/site-links';

const EXPECTED = [
  { name: 'Dashboard', href: '/dashboard', section: 'dashboard' },
  { name: 'Review', href: '/dashboard/review', section: 'review' },
  { name: 'Notebook', href: '/dashboard/notebook', section: 'notebook' },
  { name: 'Self-assessment', href: '/assessment', section: 'assessment' },
  { name: 'Settings', href: '/settings', section: 'settings' },
] as const;

describe('LearnerSectionNav', () => {
  afterEach(() => {
    cleanup();
  });

  it('is a navigation landmark named "Your learning" with the five learner links', () => {
    render(<LearnerSectionNav current="dashboard" />);

    const nav = screen.getByRole('navigation', { name: 'Your learning' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual(
      EXPECTED.map((item) => [item.name, item.href]),
    );
    expect(LEARNER_SECTION_LINKS.map((link) => link.href)).toEqual(EXPECTED.map((item) => item.href));
  });

  it.each(EXPECTED.map((item) => item.section))('marks only the %s link as the current page', (section: LearnerSection) => {
    render(<LearnerSectionNav current={section} />);

    for (const item of EXPECTED) {
      const link = screen.getByRole('link', { name: item.name });
      if (item.section === section) expect(link).toHaveAttribute('aria-current', 'page');
      else expect(link).not.toHaveAttribute('aria-current');
    }
  });

  it('wraps on narrow screens and shows a focus ring on every link', () => {
    render(<LearnerSectionNav current="review" className="mb-6" />);

    const nav = screen.getByRole('navigation', { name: 'Your learning' });
    expect(nav).toHaveClass('min-w-0', 'mb-6');
    expect(nav.querySelector('ul')).toHaveClass('flex', 'flex-wrap');
    for (const link of within(nav).getAllByRole('link')) {
      expect(link.className).toContain('focus-visible:ring-2');
      expect(link.className).toContain('min-h-[2.75rem]');
    }
  });

  it('marks the current page with the raised surface and an accent underline, not an accent fill', () => {
    render(<LearnerSectionNav current="review" />);

    const current = screen.getByRole('link', { name: 'Review' });
    expect(current).toHaveClass('bg-muted', 'border-b-2', 'border-b-primary', 'text-foreground');
    expect(current.className).not.toMatch(/(^|\s)bg-primary(\s|$)/);
    expect(current.className).not.toContain('text-primary-foreground');
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveClass('bg-muted');
  });

  it('renders on the server without hooks', () => {
    const html = renderToString(<LearnerSectionNav current="settings" />);

    expect(html).toContain('aria-label="Your learning"');
    expect(html).toContain('href="/settings"');
    expect(html).toContain('aria-current="page"');
  });

  it('takes every label and href from the navigation config', () => {
    const configured = FOOTER_NAV.flatMap((group) => group.children);
    for (const link of LEARNER_SECTION_LINKS) {
      expect(configured).toContainEqual({ label: link.label, href: link.href });
    }
  });

  it('gives the pages below the dashboard the trail Dashboard › <page>', () => {
    expect(learnerBreadcrumbs('review')).toEqual([{ label: 'Dashboard', href: '/dashboard' }, { label: 'Review' }]);
    expect(learnerBreadcrumbs('assessment')).toEqual([{ label: 'Dashboard', href: '/dashboard' }, { label: 'Self-assessment' }]);
    expect(learnerBreadcrumbs('settings')[1]).toEqual({ label: 'Settings' });
    expect(learnerBreadcrumbs('notebook')[1]).toEqual({ label: 'Notebook' });
  });
});
