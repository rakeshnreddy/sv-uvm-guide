import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Footer, { FOOTER_HEADING_CLASS } from '@/components/Footer';

type MockNextLinkProps = React.PropsWithChildren<Omit<React.ComponentProps<'a'>, 'href'> & { href: string }>;

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: MockNextLinkProps) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
});

describe('<Footer />', () => {
  it('keeps the column headings as h2, in the primary text colour at the label size', () => {
    render(<Footer />);
    const headings = screen.getAllByRole('heading', { level: 2 });
    expect(headings.map((heading) => heading.textContent)).toEqual(['Learn', 'Practice', 'Reference', 'About this site']);
    for (const heading of headings) {
      expect(heading).toHaveClass('text-label', 'text-foreground');
      expect(heading).not.toHaveClass('text-subtle', 'uppercase');
    }
    expect(FOOTER_HEADING_CLASS).toContain('text-foreground');
  });

  it('names the closing links in sentence case', () => {
    render(<Footer />);
    const siteMap = screen.getByRole('navigation', { name: 'Site map' });
    expect(within(siteMap).getByRole('link', { name: 'Privacy policy' })).toHaveAttribute('href', '/privacy-policy');
    expect(within(siteMap).getByRole('link', { name: 'Terms of service' })).toHaveAttribute('href', '/terms-of-service');
    expect(within(siteMap).queryByRole('link', { name: 'Privacy Policy' })).not.toBeInTheDocument();
  });

  it('sets no footer text under 12 px', () => {
    const { container } = render(<Footer />);
    expect(container.innerHTML).not.toMatch(/text-\[(9|10|11)px\]|text-2xs/);
  });
});
