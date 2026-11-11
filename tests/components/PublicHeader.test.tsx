import React from 'react';
import { renderToString } from 'react-dom/server';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PublicHeader, {
  FIRST_LESSON_HREF,
  PUBLIC_CONTAINER,
  PUBLIC_HEADER_CONTAINER,
} from '@/components/layout/PublicHeader';
import { shellStore } from '@/components/search/shell-store';
import { longestContinueLabel } from '@/components/layout/public-header-resume';
import { continueLessons } from '@/lib/continue-lesson-data';
import { lessonLogRecord } from '@/lib/learner-store/repositories/lessons';
import { moduleHref } from '@/lib/curriculum-data';
import { PUBLIC_NAV, SITE_NAME } from '@/lib/site-links';
import manifest from '../../content/curriculum/curriculum.manifest.json';

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'dark', resolvedTheme: 'dark', systemTheme: 'dark', setTheme: vi.fn() }),
}));

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

// The real dialog loads the search index; a stub keeps these tests about the header.
vi.mock('@/components/search/SearchDialog', async () => {
  const { useShellState } = await import('@/components/search/shell-store');
  return {
    __esModule: true,
    default: function SearchDialogStub() {
      const open = useShellState((state) => state.searchOpen);
      return open ? <div role="dialog" aria-label="Search" data-testid="search-dialog" /> : null;
    },
  };
});

type MockNextLinkProps = React.PropsWithChildren<Omit<React.ComponentProps<'a'>, 'href'> & { href: string }>;

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: MockNextLinkProps) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

beforeEach(() => {
  window.localStorage.clear();
  shellStore.reset();
});

afterEach(() => {
  cleanup();
  act(() => shellStore.reset());
  lessonLogRecord.clear();
  window.localStorage.clear();
});

describe('<PublicHeader />', () => {
  it('starts with the skip link, then a banner with the wordmark home, the three public links, search, theme and the accent action', async () => {
    render(<PublicHeader />);
    const skip = screen.getByRole('link', { name: 'Skip to main content' });
    expect(skip).toHaveAttribute('href', '#main-content');
    const banner = screen.getByRole('banner');
    expect(skip.compareDocumentPosition(banner) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(within(banner).getByRole('link', { name: `${SITE_NAME} home` })).toHaveAttribute('href', '/');
    const nav = within(banner).getByRole('navigation', { name: 'Main' });
    expect(within(nav).getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')])).toEqual(
      PUBLIC_NAV.map((link) => [link.label, link.href]),
    );
    expect(within(banner).getByRole('button', { name: 'Search' })).toHaveAttribute('aria-haspopup', 'dialog');
    const theme = await within(banner).findByRole('button', { name: 'Theme' });
    expect(theme).toHaveAttribute('aria-haspopup', 'menu');
    expect(theme).toHaveClass('h-10', 'w-10');
    expect(within(banner).getByRole('link', { name: 'Start learning' })).toHaveAttribute('href', FIRST_LESSON_HREF);
  });

  it('leaves the filled accent to the page: the bar\'s accent action is the secondary style, without the sheen', () => {
    render(<PublicHeader />);
    const banner = screen.getByRole('banner');
    expect(banner.querySelectorAll('.bg-primary, .sheen-primary')).toHaveLength(0);
    const resume = within(banner).getByTestId('public-header-resume');
    expect(resume).toHaveClass('border-border', 'bg-muted', 'text-primary', 'h-10');
  });

  it('covers the gutters around the bar with a faded page-colour backing that paints nothing under the glass', () => {
    render(<PublicHeader />);
    const layer = screen.getByRole('banner').querySelector('[data-header-glass]') as HTMLElement;
    // The backing first, then the bar's frame with the bar inside it.
    expect(layer.children).toHaveLength(2);
    const backing = layer.firstElementChild as HTMLElement;
    expect(backing).toHaveAttribute('data-header-backing');
    expect(backing).toHaveClass('absolute', 'inset-0', 'overflow-hidden');
    expect(backing.className).toMatch(/mask-image/);
    expect(backing.className).not.toMatch(/backdrop|blur/);
    // A cut-out in the bar's own frame and shape: the page colour is a spread shadow outside it.
    const cutout = backing.firstElementChild?.firstElementChild as HTMLElement;
    expect(cutout).toHaveClass('rounded-2xl', 'shadow-[0_0_0_100vmax_hsl(var(--background))]');
    expect(cutout.className).not.toMatch(/\bbg-/);
    expect(backing.firstElementChild?.className).toBe(layer.lastElementChild?.className);
    expect(layer.lastElementChild?.querySelector('[data-header-bar]')).not.toBeNull();
  });

  it('sends "Start learning" to the first lesson of the course', () => {
    const firstModule = manifest.tiers[0].modules[0].id;
    expect(FIRST_LESSON_HREF).toBe(moduleHref(firstModule));
    // The same first lesson the continue rule's lesson list starts with.
    expect(continueLessons()[0].href).toBe(FIRST_LESSON_HREF);
  });

  it('is a transparent sticky row over a glass bar, in the same container and gutters as the pages below it', () => {
    render(<PublicHeader />);
    const banner = screen.getByRole('banner');
    expect(banner).toHaveClass('sticky', 'top-0', 'z-40', 'forced-colors:bg-[Canvas]');
    expect(banner.className).not.toMatch(/\bglass\b|blur|\bbg-background\b|border-b/);
    // The header carries the height: 56 px on phones, 64 px from 640 px, like the learning header.
    expect(banner).toHaveClass('h-14', 'sm:h-16');
    const layer = banner.firstElementChild as HTMLElement;
    expect(layer).toHaveAttribute('data-header-glass');
    expect(layer).toHaveAttribute('aria-hidden', 'true');
    expect(layer.querySelectorAll('a, button')).toHaveLength(0);
    const bar = layer.querySelector('[data-header-bar]') as HTMLElement;
    expect(bar).toHaveClass('glass', 'rounded-2xl');
    // 4 px in on the 56 px phone row, 8 px from 640 px; the content box plus 16 px from lg, the viewport less 8 px below.
    expect(bar.parentElement).toHaveClass('inset-y-1', 'sm:inset-y-2', 'max-w-6xl', 'px-2', 'lg:px-4');
    const row = layer.nextElementSibling as HTMLElement;
    expect(row).toHaveClass('relative');
    expect(row).toHaveClass('h-full', 'max-w-6xl', 'px-4', 'sm:px-6', 'lg:px-8');
    expect(row.className).not.toMatch(/\bh-14\b|sm:h-16/);
    expect(PUBLIC_HEADER_CONTAINER).toContain(PUBLIC_CONTAINER);
  });

  it('makes the wordmark a 40 px target', () => {
    render(<PublicHeader />);
    const wordmark = within(screen.getByRole('banner')).getByRole('link', { name: /home$/ });
    expect(wordmark).toHaveClass('inline-flex', 'h-10', 'items-center');
  });

  it('keeps the wordmark, search and the menu button below 768 px; the links, theme and accent action from 768 px', () => {
    render(<PublicHeader />);
    const banner = screen.getByRole('banner');
    expect(within(banner).getByRole('navigation', { name: 'Main' })).toHaveClass('hidden', 'md:block');
    expect(within(banner).getByRole('button', { name: 'Theme' }).parentElement?.parentElement).toHaveClass('hidden', 'md:flex');
    expect(within(banner).getByTestId('public-header-resume').parentElement).toHaveClass('hidden', 'md:block');
    expect(within(banner).getByRole('button', { name: 'Open main menu' }).parentElement).toHaveClass('md:hidden');
    // Search is never hidden.
    expect(within(banner).getByRole('button', { name: 'Search' }).closest('.hidden')).toBeNull();
  });

  it('server-renders "Start learning" and every control at its final size, so hydration does not shift the row', () => {
    window.localStorage.setItem(
      'sv-uvm-guide:lessons',
      JSON.stringify({ v: 1, data: { lessons: { [FIRST_LESSON_HREF]: { firstVisitedAt: 1, lastVisitedAt: 2, visits: 1 } } } }),
    );
    const container = document.createElement('div');
    container.innerHTML = renderToString(<PublicHeader />);
    const resume = container.querySelector('[data-testid="public-header-resume"]');
    expect(resume).toHaveAttribute('data-state', 'start');
    expect(resume).toHaveAttribute('href', FIRST_LESSON_HREF);
    // Both labels share one grid cell with an invisible copy of the longest continue label, so the
    // link has one width in every state, whatever the module code.
    expect(resume?.querySelectorAll('span.col-start-1.row-start-1')).toHaveLength(3);
    expect(resume?.querySelector('[data-resume-sizer]')).toHaveTextContent(longestContinueLabel(continueLessons()));
    const button = container.querySelector('button[aria-label="Theme"]');
    expect(button).toHaveClass('h-10', 'w-10');
    expect(button?.parentElement?.parentElement).toHaveClass('h-10', 'w-10', 'shrink-0');
    expect(container.querySelector('button[aria-label="Search"]')).toHaveClass('h-10', 'w-10');
    expect(container.textContent).not.toMatch(/loading/i);
  });

  it('reads "Continue <code>" and links to the lesson to continue once the browser holds a lesson position', () => {
    const lesson = '/curriculum/T2_Intermediate/I-SV-1_OOP/index';
    lessonLogRecord.write({ lessons: { [lesson]: { firstVisitedAt: 1, lastVisitedAt: 2, visits: 1 } } });
    render(<PublicHeader />);
    const banner = screen.getByRole('banner');
    const title = continueLessons().find((entry) => entry.href === lesson)!.title;
    const link = within(banner).getByRole('link', { name: `Continue I-SV-1: ${title}` });
    expect(link).toHaveTextContent('Continue I-SV-1');
    expect(link).toHaveAttribute('href', lesson);
    expect(link).toHaveAttribute('data-state', 'continue');
    expect(within(banner).queryByRole('link', { name: 'Start learning' })).not.toBeInTheDocument();
  });

  it('loads the search dialog only when asked, and opens it from the button and from Ctrl+K', async () => {
    render(<PublicHeader />);
    expect(screen.queryByTestId('search-dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByTestId('search-dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search' })).toHaveAttribute('aria-expanded', 'true');

    act(() => shellStore.closeSearch());
    expect(screen.queryByTestId('search-dialog')).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'k', code: 'KeyK', ctrlKey: true });
    expect(await screen.findByTestId('search-dialog')).toBeInTheDocument();
  });

  it('opens a phone menu with the same links, the accent action and the theme choices, and closes it on Escape', async () => {
    render(<PublicHeader />);
    const menuButton = screen.getByRole('button', { name: 'Open main menu' });
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    menuButton.focus();
    fireEvent.click(menuButton);

    const menu = screen.getByRole('dialog', { name: 'Menu' });
    expect(menu).toHaveAttribute('aria-modal', 'true');
    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    const nav = within(menu).getByRole('navigation', { name: 'Main' });
    expect(within(nav).getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')])).toEqual(
      PUBLIC_NAV.map((link) => [link.label, link.href]),
    );
    expect(within(menu).getByRole('link', { name: 'Start learning' })).toHaveClass('h-11', 'w-full');
    expect(within(menu).getByRole('radiogroup', { name: 'Theme' })).toBeInTheDocument();
    // Focus moves into the dialog.
    expect(menu.contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(menuButton);
  });

  it('keeps Tab inside the phone menu', () => {
    render(<PublicHeader />);
    fireEvent.click(screen.getByRole('button', { name: 'Open main menu' }));
    const menu = screen.getByRole('dialog', { name: 'Menu' });
    const close = within(menu).getByRole('button', { name: 'Close menu' });
    close.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(menu.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(close);
  });
});
