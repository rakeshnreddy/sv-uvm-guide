import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Footer, { FOOTER_GRID_CLASS, FOOTER_HEADING_CLASS, FOOTER_LINK_CLASS, SOURCE_REPO_URL, footerContainerClass } from '@/components/Footer';
import { footerLinkCurrent } from '@/components/layout/FooterLink';
import { PAGE_FRAME_CLASS } from '@/components/layout/nav-styles';
import { FOOTER_NAV, LEGAL_LINKS, SITE_NAME } from '@/lib/site-links';

const navigation = vi.hoisted(() => ({ pathname: '/' as string | null }));

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
}));

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
  navigation.pathname = '/';
});

describe('<Footer />', () => {
  it('renders the four link groups from FOOTER_NAV, with h2 headings in the primary text colour at the label size', () => {
    render(<Footer />);
    const headings = screen.getAllByRole('heading', { level: 2 });
    expect(headings.map((heading) => heading.textContent)).toEqual(['Learn', 'Practice', 'Your learning', 'Reference']);
    expect(headings.map((heading) => heading.textContent)).toEqual(FOOTER_NAV.map((group) => group.label));
    for (const heading of headings) {
      expect(heading).toHaveClass('text-label', 'text-foreground');
      expect(heading).not.toHaveClass('text-subtle', 'uppercase');
    }
    expect(FOOTER_HEADING_CLASS).toContain('text-foreground');
  });

  it('lists every group link with the label and href from site-links.ts', () => {
    render(<Footer />);
    const siteMap = screen.getByRole('navigation', { name: 'Site map' });
    const groups = within(siteMap).getAllByRole('list');
    expect(groups).toHaveLength(FOOTER_NAV.length);
    FOOTER_NAV.forEach((group, index) => {
      expect(within(groups[index]).getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')])).toEqual(
        group.children.map((link) => [link.label, link.href]),
      );
    });
  });

  it('ends with one closing line: the site name, the licence, the source and the legal pages', () => {
    render(<Footer />);
    const line = screen.getByTestId('footer-closing-line');
    expect(within(line).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      SITE_NAME,
      'MIT licensed',
      'Source on GitHub',
      ...LEGAL_LINKS.map((link) => link.label),
    ]);
    expect(within(line).getByRole('link', { name: 'Source on GitHub' })).toHaveAttribute('href', SOURCE_REPO_URL);
    expect(within(line).getByRole('link', { name: 'Privacy policy' })).toHaveAttribute('href', '/privacy-policy');
    expect(within(line).getByRole('link', { name: 'Terms of service' })).toHaveAttribute('href', '/terms-of-service');
    expect(screen.queryByRole('link', { name: 'Privacy Policy' })).not.toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).not.toHaveTextContent(/All rights reserved|©/);
  });

  it('offers the keyboard shortcuts button only where the learning layout asks for it', () => {
    render(<Footer />);
    expect(screen.queryByRole('button', { name: 'Keyboard shortcuts' })).not.toBeInTheDocument();
    cleanup();
    render(<Footer showShortcuts />);
    const button = screen.getByRole('button', { name: 'Keyboard shortcuts' });
    expect(screen.getByTestId('footer-closing-line')).toContainElement(button);
    expect(button).toHaveClass('min-h-10');
  });

  it('lays the groups out in two columns on phones and four from 1024 px, with 40 px link targets', () => {
    render(<Footer />);
    expect(screen.getByRole('navigation', { name: 'Site map' })).toHaveClass('grid-cols-2', 'lg:grid-cols-4');
    expect(FOOTER_GRID_CLASS).toContain('grid-cols-2');
    expect(FOOTER_LINK_CLASS).toContain('min-h-10');
    for (const link of screen.getAllByRole('link')) expect(link).toHaveClass('min-h-10');
  });

  it('lines up with the page frame on learning pages and keeps the public container elsewhere', () => {
    const { container } = render(<Footer frame="learning" />);
    const frame = container.querySelector('[data-footer-frame]')!;
    expect(frame).toHaveAttribute('data-footer-frame', 'learning');
    for (const name of PAGE_FRAME_CLASS.split(' ')) expect(frame).toHaveClass(name);
    cleanup();
    const publicFooter = render(<Footer />).container.querySelector('[data-footer-frame]')!;
    expect(publicFooter).toHaveAttribute('data-footer-frame', 'public');
    expect(publicFooter).toHaveClass('max-w-6xl');
    expect(footerContainerClass('learning')).toContain('max-w-7xl');
  });

  it('marks the link to the open page with aria-current="page", and no other', () => {
    navigation.pathname = '/privacy-policy';
    render(<Footer />);
    const current = screen.getAllByRole('link').filter((link) => link.getAttribute('aria-current'));
    expect(current.map((link) => [link.textContent, link.getAttribute('aria-current')])).toEqual([['Privacy policy', 'page']]);
  });

  it('marks /practice on the practice hub but never its section links', () => {
    navigation.pathname = '/practice';
    render(<Footer />);
    const current = screen.getAllByRole('link').filter((link) => link.getAttribute('aria-current'));
    expect(current.map((link) => link.getAttribute('href'))).toEqual(['/practice']);
  });

  it('footerLinkCurrent is "page" only for the exact path', () => {
    expect(footerLinkCurrent('/dashboard', '/dashboard')).toBe('page');
    expect(footerLinkCurrent('/dashboard/', '/dashboard')).toBe('page');
    expect(footerLinkCurrent('/dashboard/review', '/dashboard')).toBeUndefined();
    expect(footerLinkCurrent('/practice', '/practice#labs')).toBeUndefined();
    expect(footerLinkCurrent(null, '/dashboard')).toBeUndefined();
  });

  it('sets no footer text under 12 px', () => {
    const { container } = render(<Footer />);
    expect(container.innerHTML).not.toMatch(/text-\[(9|10|11)px\]|text-2xs/);
  });
});
