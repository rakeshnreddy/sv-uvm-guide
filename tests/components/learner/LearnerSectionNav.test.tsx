import React from 'react';
import { renderToString } from 'react-dom/server';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { LearnerSectionNav, LEARNER_SECTION_LINKS, type LearnerSection } from '@/components/learner/LearnerSectionNav';

const EXPECTED = [
  { name: 'Dashboard', href: '/dashboard', section: 'dashboard' },
  { name: 'Review', href: '/dashboard/review', section: 'review' },
  { name: 'Notebook', href: '/dashboard/notebook', section: 'notebook' },
  { name: 'Settings', href: '/settings', section: 'settings' },
] as const;

describe('LearnerSectionNav', () => {
  afterEach(() => {
    cleanup();
  });

  it('is a navigation landmark named "Your learning" with the four learner links', () => {
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

  it('renders on the server without hooks', () => {
    const html = renderToString(<LearnerSectionNav current="settings" />);

    expect(html).toContain('aria-label="Your learning"');
    expect(html).toContain('href="/settings"');
    expect(html).toContain('aria-current="page"');
  });
});
