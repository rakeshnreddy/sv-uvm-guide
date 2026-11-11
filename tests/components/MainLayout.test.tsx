import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import MainLayout from '@/components/layout/MainLayout';
import { PAGE_FRAME_CLASS } from '@/components/layout/nav-styles';
import { shellStore } from '@/components/search/shell-store';

vi.mock('@/components/Navbar', () => ({
  __esModule: true,
  default: () => (
    <header>
      <a href="/">Home</a>
      <nav aria-label="Main">
        <a href="/curriculum">Curriculum</a>
      </nav>
    </header>
  ),
}));

// The footer has its own suite (Footer.test.tsx); here it only has to close the frame.
vi.mock('@/components/Footer', () => ({
  __esModule: true,
  default: ({ showShortcuts, frame }: { showShortcuts?: boolean; frame?: string }) => (
    <footer data-show-shortcuts={showShortcuts ? 'true' : 'false'} data-frame={frame}>
      <nav aria-label="Site map">
        <a href="/curriculum">Curriculum</a>
      </nav>
    </footer>
  ),
}));

vi.mock('@/components/layout/Sidebar', () => ({
  __esModule: true,
  default: () => (
    <nav aria-label="Course outline">
      <a href="/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index">F1A</a>
    </nav>
  ),
}));

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

afterEach(() => {
  cleanup();
  shellStore.reset();
});

function firstFocusable(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
}

describe('MainLayout', () => {
  it('starts with a skip link to the main content (G30-PAGE-V18)', () => {
    render(
      <MainLayout>
        <h1>Mailboxes</h1>
      </MainLayout>,
    );
    const skip = screen.getByRole('link', { name: 'Skip to main content' });
    expect(firstFocusable()).toBe(skip);
    expect(skip).toHaveAttribute('href', '#main-content');
  });

  it('has exactly one main landmark, with the course outline outside it', () => {
    render(
      <MainLayout>
        <h1>Mailboxes</h1>
      </MainLayout>,
    );
    const mains = screen.getAllByRole('main');
    expect(mains).toHaveLength(1);
    expect(mains[0]).toHaveAttribute('id', 'main-content');
    expect(mains[0]).toHaveAttribute('tabindex', '-1');
    const outline = screen.getByRole('navigation', { name: 'Course outline' });
    expect(mains[0]).not.toContainElement(outline);
  });

  it('moves focus to the page heading, skipping the navbar, outline and breadcrumbs', async () => {
    const user = userEvent.setup();
    render(
      <MainLayout>
        <nav aria-label="Breadcrumb">
          <a href="/curriculum">Curriculum</a>
        </nav>
        <h1>Mailboxes</h1>
      </MainLayout>,
    );
    await user.tab();
    const skip = screen.getByRole('link', { name: 'Skip to main content' });
    expect(document.activeElement).toBe(skip);
    await user.keyboard('{Enter}');
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Mailboxes' }));
  });

  it('falls back to the main landmark on a page without a heading', async () => {
    const user = userEvent.setup();
    render(
      <MainLayout>
        <p>No heading here</p>
      </MainLayout>,
    );
    await user.click(screen.getByRole('link', { name: 'Skip to main content' }));
    expect(document.activeElement).toBe(screen.getByRole('main'));
  });

  it('ends with the footer site map and its shortcuts button, so no page is a dead end (G30-SIDE-07)', () => {
    render(
      <MainLayout>
        <h1>Page</h1>
      </MainLayout>,
    );
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByRole('navigation', { name: 'Site map' })).toBeInTheDocument();
    expect(footer).toHaveAttribute('data-show-shortcuts', 'true');
    expect(footer).toHaveAttribute('data-frame', 'learning');
    expect(screen.getByRole('main').compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('puts the page in the frame the navbar uses, so the header lines up with the page', () => {
    render(
      <MainLayout>
        <h1>Page</h1>
      </MainLayout>,
    );
    const frame = screen.getByRole('main').querySelector('[data-page-frame]');
    expect(frame).not.toBeNull();
    for (const name of PAGE_FRAME_CLASS.split(' ')) expect(frame).toHaveClass(name);
    expect(PAGE_FRAME_CLASS).toBe('mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8');
    expect(frame).not.toHaveClass('container');
  });
});
