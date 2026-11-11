import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PageShellDefault, {
  IN_FRAME_RESET_CLASS,
  PAGE_WIDTH_CLASS,
  PageShell,
  STANDALONE_FRAME_CLASS,
  PAGE_SHELL_CLASS,
} from '@/components/layout/PageShell';
import { PAGE_FRAME_CLASS } from '@/components/layout/nav-styles';

const classes = (element: Element) => element.className.split(/\s+/);

describe('PageShell', () => {
  it('caps the content at the chosen width without centring it (reading 768, content 1152, wide 1280)', () => {
    expect(PAGE_WIDTH_CLASS).toEqual({ reading: 'max-w-3xl', content: 'max-w-6xl', wide: 'max-w-7xl' });
    for (const width of ['reading', 'content', 'wide'] as const) {
      const { container, unmount } = render(<PageShell width={width}>Body</PageShell>);
      const outer = container.querySelector('[data-page-shell]')!;
      const inner = container.querySelector('[data-page-shell-inner]')!;
      expect(outer.getAttribute('data-width')).toBe(width);
      expect(classes(inner)).toContain(PAGE_WIDTH_CLASS[width]);
      expect(classes(inner)).not.toContain('mx-auto');
      unmount();
    }
  });

  it('defaults to the content width and a div', () => {
    const { container } = render(<PageShell>Body</PageShell>);
    const outer = container.querySelector('[data-page-shell]')!;
    expect(outer.tagName).toBe('DIV');
    expect(outer.getAttribute('data-width')).toBe('content');
  });

  it('draws the frame itself outside a page frame, with the same gutters as the learning frame', () => {
    const gutters = ['px-4', 'sm:px-6', 'lg:px-8'];
    expect(PAGE_FRAME_CLASS.split(' ')).toEqual(expect.arrayContaining(gutters));
    // The public header's container (1152 px), so the page starts under the public wordmark.
    expect(STANDALONE_FRAME_CLASS.split(' ')).toEqual(expect.arrayContaining(['mx-auto', 'w-full', 'max-w-6xl', 'py-8', ...gutters]));
  });

  it('undoes its own frame inside MainLayout\'s [data-page-frame], so there is no second centred container', () => {
    const reset = IN_FRAME_RESET_CLASS.split(' ');
    expect(reset).toEqual([
      '[[data-page-frame]_&]:mx-0',
      '[[data-page-frame]_&]:max-w-none',
      '[[data-page-frame]_&]:px-0',
      '[[data-page-frame]_&]:py-0',
    ]);
    const shell = PAGE_SHELL_CLASS.split(' ');
    expect(shell).toEqual(expect.arrayContaining([...reset, 'mx-auto', 'px-4']));
  });

  it('renders as article or section, merges classes and passes attributes through', () => {
    render(
      <PageShell as="article" width="reading" className="pb-16" innerClassName="space-y-6" data-testid="shell" aria-label="Policy">
        <p>Body</p>
      </PageShell>,
    );
    const outer = screen.getByTestId('shell');
    expect(outer.tagName).toBe('ARTICLE');
    expect(outer).toHaveAttribute('aria-label', 'Policy');
    expect(classes(outer)).toContain('pb-16');
    expect(classes(outer.firstElementChild!)).toContain('space-y-6');
    expect(screen.getByText('Body')).toBeInTheDocument();
    expect(PageShellDefault).toBe(PageShell);
  });
});
