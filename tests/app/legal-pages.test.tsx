import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import PrivacyPolicyPage from '@/app/(public)/privacy-policy/page';
import TermsOfServicePage from '@/app/(public)/terms-of-service/page';

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
});

describe.each([
  ['Privacy Policy', PrivacyPolicyPage],
  ['Terms of Service', TermsOfServicePage],
])('%s page (G30-SIDE-V06)', (title, Page) => {
  it('links back to the site from its header', () => {
    render(<Page />);
    // The page frame's header comes first; InfoPage adds its own header inside the article.
    const header = screen.getAllByRole('banner')[0];
    expect(within(header).getByRole('link', { name: 'Back to the curriculum' })).toHaveAttribute('href', '/curriculum');
    expect(within(header).getByRole('link', { name: 'SV/UVM Hub home' })).toHaveAttribute('href', '/');
  });

  it('keeps its content in one main landmark under its own heading', () => {
    render(<Page />);
    const main = screen.getByRole('main');
    expect(within(main).getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
  });

  it('ends with the site footer and its site map', () => {
    render(<Page />);
    const footer = screen.getByRole('contentinfo');
    const siteMap = within(footer).getByRole('navigation', { name: 'Site map' });
    expect(within(siteMap).getByRole('link', { name: 'Curriculum overview' })).toHaveAttribute('href', '/curriculum');
    expect(within(siteMap).getByRole('link', { name: 'Practice hub' })).toHaveAttribute('href', '/practice');
    // The shortcuts dialog lives in the learning layout, so this page does not offer it.
    expect(within(footer).queryByRole('button', { name: 'Keyboard shortcuts' })).not.toBeInTheDocument();
  });
});
