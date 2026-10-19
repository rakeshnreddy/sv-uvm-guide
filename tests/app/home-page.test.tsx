import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import HomePage from '@/app/(public)/page';

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
  default: () => <section aria-label="Hero" />,
}));
vi.mock('next/dynamic', () => ({
  __esModule: true,
  default: () =>
    function SectionStub() {
      return <section aria-label="Below the fold" />;
    },
}));

afterEach(() => {
  cleanup();
});

describe('home page', () => {
  it('keeps the sections in the main landmark', () => {
    render(<HomePage />);
    const main = screen.getByRole('main');
    expect(within(main).getByRole('region', { name: 'Hero' })).toBeInTheDocument();
    expect(within(main).getAllByRole('region', { name: 'Below the fold' })).toHaveLength(2);
  });

  it('ends with the site footer, which links to the Privacy Policy and the Terms', () => {
    render(<HomePage />);
    const footer = screen.getByRole('contentinfo');
    expect(screen.getByRole('main')).not.toContainElement(footer);
    const siteMap = within(footer).getByRole('navigation', { name: 'Site map' });
    expect(within(siteMap).getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy-policy');
    expect(within(siteMap).getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/terms-of-service');
    // The shortcuts dialog lives in the learning layout, so the home page does not offer it.
    expect(within(footer).queryByRole('button', { name: 'Keyboard shortcuts' })).not.toBeInTheDocument();
  });
});
