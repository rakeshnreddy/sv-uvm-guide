import React from 'react';
import { renderToString } from 'react-dom/server';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import PublicHeader, { PUBLIC_HEADER_CONTAINER, PUBLIC_HEADER_LINKS } from '@/components/layout/PublicHeader';
import { INTERVIEW_PREP_HREF } from '@/lib/site-links';

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'dark', resolvedTheme: 'dark', systemTheme: 'dark', setTheme: vi.fn() }),
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
});

describe('<PublicHeader />', () => {
  it('starts with the skip link, then a banner with the wordmark home, three links and the theme menu button', async () => {
    render(<PublicHeader />);
    const skip = screen.getByRole('link', { name: 'Skip to main content' });
    expect(skip).toHaveAttribute('href', '#main-content');
    const banner = screen.getByRole('banner');
    expect(skip.compareDocumentPosition(banner) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(within(banner).getByRole('link', { name: 'SV/UVM Hub home' })).toHaveAttribute('href', '/');
    const nav = within(banner).getByRole('navigation', { name: 'Main' });
    expect(within(nav).getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Curriculum', '/curriculum'],
      ['Practice', '/practice'],
      ['Interview prep', INTERVIEW_PREP_HREF],
    ]);
    const theme = await within(banner).findByRole('button', { name: 'Theme' });
    expect(theme).toHaveAttribute('aria-haspopup', 'menu');
    expect(theme).toHaveClass('h-10', 'w-10');
  });

  it('is one opaque row with a hairline below, 56 px on phones and 64 px from 640 px, in the landing container', () => {
    render(<PublicHeader />);
    const banner = screen.getByRole('banner');
    expect(banner).toHaveClass('border-b', 'border-border', 'bg-background');
    expect(banner.className).not.toMatch(/blur|bg-background\//);
    const row = banner.firstElementChild as HTMLElement;
    expect(row).toHaveClass('h-14', 'sm:h-16', 'max-w-6xl', 'px-4', 'sm:px-6');
    expect(PUBLIC_HEADER_CONTAINER).toContain('max-w-6xl');
  });

  it('keeps only the wordmark, Curriculum and the theme control below 640 px', () => {
    render(<PublicHeader />);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    for (const link of PUBLIC_HEADER_LINKS) {
      const item = within(nav).getByRole('link', { name: link.label }).closest('li');
      if (link.label === 'Curriculum') expect(item).not.toHaveClass('hidden');
      else expect(item).toHaveClass('hidden', 'sm:block');
    }
  });

  it('has no filled accent button and no search yet', () => {
    render(<PublicHeader />);
    const banner = screen.getByRole('banner');
    expect(banner.querySelector('.bg-primary')).toBeNull();
    expect(within(banner).queryByRole('search')).not.toBeInTheDocument();
    expect(within(banner).queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('server-renders the theme control in its final 40 px box, so hydration does not shift the row', () => {
    const container = document.createElement('div');
    container.innerHTML = renderToString(<PublicHeader />);
    const button = container.querySelector('button[aria-label="Theme"]');
    expect(button).toHaveClass('h-10', 'w-10');
    expect(button?.parentElement?.parentElement).toHaveClass('h-10', 'w-10', 'shrink-0');
    expect(container.textContent).not.toMatch(/loading/i);
  });
});
