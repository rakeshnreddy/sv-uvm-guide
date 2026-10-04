import React from 'react';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Navbar, { navLinkCurrent } from '@/components/Navbar';
import Sidebar, { OUTLINE_DRAWER_ID } from '@/components/layout/Sidebar';
import { shellStore } from '@/components/search/shell-store';

const { flags, auth, nav } = vi.hoisted(() => ({
  flags: { community: false, tracking: false, personalization: false, fakeComments: false, accountUI: false },
  auth: { user: null as null | { uid: string; isAnonymous: false; displayName?: string | null }, signOut: vi.fn() },
  nav: { pathname: '/curriculum' as string },
}));

vi.mock('@/tools/featureFlags', () => ({ featureFlags: flags }));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: auth.user, loading: false, signOut: auth.signOut }),
}));

vi.mock('@/components/ui/ThemeSwitcher', () => ({
  ThemeSwitcher: () => (
    <button type="button" aria-label="Toggle theme">
      theme
    </button>
  ),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('next/link', async () => {
  const ReactModule = await import('react');
  type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean };
  const MockLink = ReactModule.forwardRef<HTMLAnchorElement, LinkProps>(({ href, children, prefetch: _prefetch, onClick, ...rest }, ref) => (
    <a
      ref={ref}
      href={href}
      {...rest}
      onClick={(event) => {
        onClick?.(event);
        event.preventDefault();
      }}
    >
      {children}
    </a>
  ));
  MockLink.displayName = 'MockLink';
  return { __esModule: true, default: MockLink };
});

beforeEach(() => {
  flags.accountUI = false;
  auth.user = null;
  auth.signOut.mockReset();
  nav.pathname = '/curriculum';
  shellStore.reset();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ notifications: [] }), { status: 200 })),
  );
});

afterEach(() => {
  cleanup();
  shellStore.reset();
  vi.unstubAllGlobals();
});

describe('Navbar landmarks and links', () => {
  it('is a banner with a named main navigation and a search landmark', () => {
    render(<Navbar />);
    const banner = screen.getByRole('banner');
    const main = within(banner).getAllByRole('navigation', { name: 'Main' })[0];
    expect(within(main).getByRole('link', { name: 'Curriculum' })).toHaveAttribute('href', '/curriculum');
    expect(within(main).getByRole('link', { name: 'Practice' })).toHaveAttribute('href', '/practice');
    const search = within(banner).getByRole('search', { name: 'Curriculum' });
    expect(within(search).getByRole('combobox', { name: 'Search lessons and sections' })).toHaveAttribute(
      'data-testid',
      'main-search-input',
    );
    expect(within(banner).getByRole('link', { name: 'SV/UVM Hub home' })).toHaveAttribute('href', '/');
  });

  it('marks the current section for assistive technology, not just by colour', () => {
    nav.pathname = '/curriculum/T1_Foundational/F2A_Core_Data_Types/index';
    render(<Navbar />);
    const main = screen.getAllByRole('navigation', { name: 'Main' })[0];
    expect(within(main).getByRole('link', { name: 'Curriculum' })).toHaveAttribute('aria-current', 'true');
    expect(within(main).getByRole('link', { name: 'Practice' })).not.toHaveAttribute('aria-current');
    expect(navLinkCurrent('/practice', '/practice')).toBe('page');
    expect(navLinkCurrent('/practice/lab/x', '/practice')).toBe('true');
    expect(navLinkCurrent('/practices', '/practice')).toBeUndefined();
  });
});

describe('account-only UI (G30-SIDE-V07)', () => {
  it('shows no notifications, profile, sign-out or developer text while accountUI is off', () => {
    render(<Navbar />);
    expect(screen.queryByTestId('notification-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('user-profile-button')).not.toBeInTheDocument();
    expect(screen.queryByText(/sign out/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument();
    expect(screen.queryByText(/accountUI|account UI flag/i)).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('opens the account menu on click when accountUI is on, and closes it with Escape', async () => {
    flags.accountUI = true;
    const user = userEvent.setup();
    render(<Navbar />);
    const account = screen.getByTestId('user-profile-button');
    expect(account).toHaveAccessibleName('Account');
    expect(account).toHaveAttribute('aria-expanded', 'false');

    await user.click(account);
    expect(account).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Not signed in')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(account).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).toBe(account);

    account.focus();
    await user.keyboard('{Enter}');
    expect(account).toHaveAttribute('aria-expanded', 'true');
  });

  it('offers Sign out only to a signed-in learner, and it signs out', async () => {
    flags.accountUI = true;
    auth.user = { uid: 'u1', isAnonymous: false, displayName: 'Ada' };
    const user = userEvent.setup();
    render(<Navbar />);
    await user.click(screen.getByTestId('user-profile-button'));
    expect(screen.getByText('Ada')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });

  it('shows the notification feed when accountUI is on', async () => {
    flags.accountUI = true;
    const user = userEvent.setup();
    render(<Navbar />);
    const bell = screen.getByTestId('notification-button');
    await user.click(bell);
    expect(bell).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findByText('You’re all caught up')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View all' })).toHaveAttribute('href', '/notifications');
  });
});

describe('course outline button', () => {
  it('has one name for every width and reports the drawer state (G30-SIDE-08)', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Navbar />
        <Sidebar />
      </>,
    );
    const toggles = screen.getAllByRole('button', { name: 'Course outline' });
    expect(toggles).toHaveLength(1);
    const toggle = toggles[0];
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).not.toHaveAttribute('aria-controls');

    await user.click(toggle);
    const drawer = screen.getByRole('dialog', { name: 'Course outline' });
    expect(drawer).toHaveAttribute('id', OUTLINE_DRAWER_ID);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAttribute('aria-controls', OUTLINE_DRAWER_ID);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).toBe(toggle);
  });
});

describe('search on phones (G30-SRCH-02)', () => {
  it('opens the search dialog from the search button', async () => {
    const user = userEvent.setup();
    render(<Navbar />);
    const [searchButton] = screen.getAllByRole('button', { name: 'Search' });
    expect(searchButton).toHaveAttribute('aria-haspopup', 'dialog');
    await user.click(searchButton);
    const dialog = screen.getByRole('dialog', { name: 'Search the curriculum' });
    expect(document.activeElement).toBe(within(dialog).getByRole('combobox'));
    expect(searchButton).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('mobile menu', () => {
  it('is a modal dialog with the close button first and the main links', async () => {
    const user = userEvent.setup();
    render(<Navbar />);
    const menuButton = screen.getByRole('button', { name: 'Open main menu' });
    await user.click(menuButton);

    const menu = screen.getByTestId('mobile-menu');
    expect(menu).toHaveAttribute('role', 'dialog');
    expect(menu).toHaveAttribute('aria-modal', 'true');
    expect(within(menu).getAllByRole('button')[0]).toHaveAccessibleName('Close menu');
    expect(within(menu).getByRole('link', { name: 'Curriculum' })).toHaveAttribute('href', '/curriculum');
    expect(menuButton).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('mobile-menu')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(menuButton);
  });

  it('closes when a link is followed', async () => {
    const user = userEvent.setup();
    render(<Navbar />);
    await user.click(screen.getByRole('button', { name: 'Open main menu' }));
    await user.click(within(screen.getByTestId('mobile-menu')).getByRole('link', { name: 'Practice' }));
    expect(screen.queryByTestId('mobile-menu')).not.toBeInTheDocument();
    act(() => shellStore.openMenu());
    expect(screen.getByTestId('mobile-menu')).toBeInTheDocument();
  });
});
