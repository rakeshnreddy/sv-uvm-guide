import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import HomePage from '@/app/(public)/page';
import { getHomeStats } from '@/components/home/home-stats';
import { curriculumData } from '@/lib/curriculum-data';
import { getAllLabs } from '@/lib/lab-registry';

vi.mock('next/link', async () => {
  const ReactModule = await import('react');
  type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean };
  const MockLink = ReactModule.forwardRef<HTMLAnchorElement, LinkProps>(({ href, children, prefetch: _prefetch, ...rest }, ref) => (
    <a ref={ref} href={href} {...rest}>
      {children}
    </a>
  ));
  MockLink.displayName = 'MockLink';
  return { __esModule: true, default: MockLink };
});

// The sections have their own tests; stubs keep this one about the page frame.
vi.mock('@/components/home/HeroSection', () => ({
  __esModule: true,
  default: ({ lessonCount, tierCount, labCount }: { lessonCount: number; tierCount: number; labCount: number }) => (
    <section aria-label="Hero" data-stats={`${lessonCount}/${tierCount}/${labCount}`} />
  ),
}));
// Imported directly, not through next/dynamic, so the server HTML holds every section (landing-16).
vi.mock('@/components/home/LearningPathsSection', () => ({
  __esModule: true,
  default: () => <section aria-label="Routes" />,
}));
vi.mock('@/components/home/InteractiveFeaturesSection', () => ({
  __esModule: true,
  default: () => <section aria-label="Features" />,
}));

afterEach(() => {
  cleanup();
});

describe('home page', () => {
  it('keeps the sections in the main landmark, in order', () => {
    render(<HomePage />);
    const main = screen.getByRole('main');
    expect(within(main).getAllByRole('region').map((region) => region.getAttribute('aria-label'))).toEqual([
      'Hero',
      'Routes',
      'Features',
    ]);
    expect(screen.queryByText('Loading Section...')).not.toBeInTheDocument();
  });

  it('passes the hero counts taken from the curriculum and the lab registry (landing-2)', () => {
    render(<HomePage />);
    const { lessonCount, tierCount, labCount } = getHomeStats(curriculumData, getAllLabs());
    expect(screen.getByRole('region', { name: 'Hero' })).toHaveAttribute('data-stats', `${lessonCount}/${tierCount}/${labCount}`);
  });

  it('ends with the site footer, which links to the Privacy Policy and the Terms', () => {
    render(<HomePage />);
    const footer = screen.getByRole('contentinfo');
    expect(screen.getByRole('main')).not.toContainElement(footer);
    const siteMap = within(footer).getByRole('navigation', { name: 'Site map' });
    expect(within(siteMap).getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy-policy');
    expect(within(siteMap).getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/terms-of-service');
    expect(within(siteMap).getByRole('link', { name: 'Labs' })).toHaveAttribute('href', '/practice#labs');
    // The project is MIT licensed, so the footer says so and links the source (landing-2).
    expect(footer).toHaveTextContent('MIT licensed');
    expect(footer).not.toHaveTextContent(/All rights reserved/i);
    expect(within(footer).getByRole('link', { name: 'Source on GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/rakeshnreddy/sv-uvm-guide',
    );
    // The shortcuts dialog lives in the learning layout, so the home page does not offer it.
    expect(within(footer).queryByRole('button', { name: 'Keyboard shortcuts' })).not.toBeInTheDocument();
  });
});
