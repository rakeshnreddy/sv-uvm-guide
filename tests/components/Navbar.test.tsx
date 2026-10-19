import React from 'react';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Navbar, { mainNavLinks, navLinkCurrent, signInHref } from '@/components/Navbar';
import Sidebar, { OUTLINE_DRAWER_ID } from '@/components/layout/Sidebar';
import { shellStore } from '@/components/search/shell-store';

type SessionStatus = 'disabled' | 'loading' | 'authenticated' | 'unauthenticated';
type ServerFeature = 'aiTutor' | 'simulation' | 'notifications';

const { features, session, auth, nav } = vi.hoisted(() => ({
  // The default site: learner pages on, accounts and everything that needs them off.
  features: {
    dashboard: true,
    review: true,
    notebook: true,
    settings: true,
    accounts: false,
    community: false,
    aiTutor: false,
    simulation: false,
    draftPages: false,
    assessmentCenter: false,
  },
  session: { status: 'disabled' as SessionStatus, userId: null as string | null },
  auth: { user: null as null | { uid: string; isAnonymous: false; displayName?: string | null }, signOut: vi.fn() },
  nav: { pathname: '/curriculum' as string },
}));

// Components read switches through SITE_FEATURES and the target hooks only (GD5, GD6).
vi.mock('@/lib/site-features', () => ({ SITE_FEATURES: features }));

vi.mock('@/lib/persistence/target', () => ({
  useAccountSession: () => ({ status: session.status, userId: session.userId }),
  usePersistenceTarget: () => ({ target: 'local', ready: session.status !== 'loading' }),
  useServerFeature: (feature: ServerFeature) =>
    (feature === 'notifications' ? features.accounts : features[feature]) && session.status === 'authenticated',
}));

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

/** Accounts on, nobody signed in. */
function accountsOnSignedOut() {
  features.accounts = true;
  session.status = 'unauthenticated';
  session.userId = null;
  auth.user = null;
}

/** Accounts on, a learner signed in. */
function accountsOnSignedIn(displayName: string | null = 'Ada') {
  features.accounts = true;
  session.status = 'authenticated';
  session.userId = 'u1';
  auth.user = { uid: 'u1', isAnonymous: false, displayName };
}

beforeEach(() => {
  features.accounts = false;
  features.community = false;
  session.status = 'disabled';
  session.userId = null;
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

  it('links Start here, Labs, Interview prep and Dashboard in order (G30-SIDE-05, G30-PATH-07)', () => {
    render(<Navbar />);
    const main = within(screen.getByRole('banner')).getAllByRole('navigation', { name: 'Main' })[0];
    const links = within(main).getAllByRole('link');
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Start here', '/curriculum#routes'],
      ['Curriculum', '/curriculum'],
      ['Practice', '/practice'],
      ['Labs', '/practice#labs'],
      ['Interview prep', '/interview-prep'],
      ['Dashboard', '/dashboard'],
    ]);
  });

  it('links the dashboard and no hidden page while every switch is off', () => {
    for (const key of Object.keys(features) as Array<keyof typeof features>) features[key] = false;
    try {
      render(<Navbar />);
      const banner = screen.getByRole('banner');
      expect(within(banner).getAllByRole('link', { name: 'Dashboard' })[0]).toHaveAttribute('href', '/dashboard');
      expect(within(banner).queryByRole('link', { name: 'Community' })).not.toBeInTheDocument();
      const hrefs = within(banner)
        .getAllByRole('link', { hidden: true })
        .map((link) => link.getAttribute('href'));
      for (const hidden of ['/community', '/notifications', '/resources', '/projects', '/history', '/assessment']) {
        expect(hrefs).not.toContain(hidden);
      }
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      Object.assign(features, { dashboard: true, review: true, notebook: true, settings: true });
    }
  });

  it('lists Community only while community is on (it also needs accounts)', async () => {
    expect(mainNavLinks({ community: false }).map((link) => link.label)).not.toContain('Community');
    expect(mainNavLinks({ community: true }).at(-1)).toEqual({ label: 'Community', href: '/community', wideOnly: true });

    const user = userEvent.setup();
    features.community = true;
    render(<Navbar />);
    const main = within(screen.getByRole('banner')).getAllByRole('navigation', { name: 'Main' })[0];
    expect(within(main).getByRole('link', { name: 'Community' })).toHaveAttribute('href', '/community');
    await user.click(within(main).getByRole('button', { name: 'More' }));
    expect(within(main).getAllByRole('link', { name: 'Community' })).toHaveLength(2);
  });

  it('keeps the bar narrow: Labs, Interview prep and Dashboard join it from xl, the rest from md', () => {
    render(<Navbar />);
    const main = within(screen.getByRole('banner')).getAllByRole('navigation', { name: 'Main' })[0];
    for (const name of ['Labs', 'Interview prep', 'Dashboard']) {
      expect(within(main).getByRole('link', { name })).toHaveClass('hidden', 'xl:inline-flex');
    }
    for (const name of ['Start here', 'Curriculum', 'Practice']) {
      const link = within(main).getByRole('link', { name });
      expect(link).toHaveClass('inline-flex');
      expect(link).not.toHaveClass('hidden');
    }
  });

  it('spaces the md bar tightly until lg, so it fits the 720 px of room at 768 px', () => {
    render(<Navbar />);
    const banner = screen.getByRole('banner');
    const main = within(banner).getAllByRole('navigation', { name: 'Main' })[0];
    for (const name of ['Start here', 'Curriculum', 'Practice']) {
      expect(within(main).getByRole('link', { name })).toHaveClass('px-2', 'lg:px-3');
    }
    expect(within(main).getByRole('button', { name: 'More' })).toHaveClass('px-2', 'lg:px-3');
    const controls = within(banner).getByRole('button', { name: 'Toggle theme' }).parentElement!;
    expect(controls).toHaveClass('gap-1', 'lg:gap-2');
    const divider = controls.querySelector('span[aria-hidden="true"]');
    expect(divider).toHaveClass('hidden', 'lg:block');
  });

  it('lists Labs, Interview prep and Dashboard under "More" from md to xl, as a disclosure', async () => {
    const user = userEvent.setup();
    nav.pathname = '/curriculum';
    render(<Navbar />);
    const main = within(screen.getByRole('banner')).getAllByRole('navigation', { name: 'Main' })[0];
    const more = within(main).getByRole('button', { name: 'More' });
    expect(more.parentElement).toHaveClass('xl:hidden');
    expect(more).toHaveAttribute('aria-expanded', 'false');
    const panel = document.getElementById(more.getAttribute('aria-controls')!)!;
    expect(panel).not.toBeVisible();

    await user.click(more);
    expect(more).toHaveAttribute('aria-expanded', 'true');
    expect(within(panel).getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Labs', '/practice#labs'],
      ['Interview prep', '/interview-prep'],
      ['Dashboard', '/dashboard'],
    ]);

    await user.keyboard('{Escape}');
    expect(more).toHaveAttribute('aria-expanded', 'false');
    expect(more).toHaveFocus();
  });

  it('marks pages, never a link to part of a page', () => {
    nav.pathname = '/curriculum';
    const { unmount } = render(<Navbar />);
    let main = screen.getAllByRole('navigation', { name: 'Main' })[0];
    expect(within(main).getByRole('link', { name: 'Curriculum' })).toHaveAttribute('aria-current', 'page');
    expect(within(main).getByRole('link', { name: 'Start here' })).not.toHaveAttribute('aria-current');
    unmount();

    nav.pathname = '/interview-prep';
    render(<Navbar />);
    main = screen.getAllByRole('navigation', { name: 'Main' })[0];
    expect(within(main).getByRole('link', { name: 'Interview prep' })).toHaveAttribute('aria-current', 'page');
    expect(within(main).getByRole('link', { name: 'Practice' })).not.toHaveAttribute('aria-current');
    expect(navLinkCurrent('/curriculum', '/curriculum#routes')).toBeUndefined();
    expect(navLinkCurrent('/practice', '/practice#labs')).toBeUndefined();
  });
});

describe('account-only UI (G30-SIDE-V07)', () => {
  it('shows no notifications, account menu, sign-in, sign-out or developer text while accounts are off, and fetches nothing', () => {
    render(<Navbar />);
    expect(screen.queryByTestId('notification-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('user-profile-button')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Account' })).not.toBeInTheDocument();
    expect(screen.queryByText(/sign in/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sign out/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument();
    expect(screen.queryByText(/accountUI|account UI flag/i)).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('offers Sign in, Dashboard and Settings to a signed-out visitor, with no bell and no fetch', async () => {
    accountsOnSignedOut();
    const user = userEvent.setup();
    render(<Navbar />);
    expect(screen.queryByTestId('notification-button')).not.toBeInTheDocument();
    const account = screen.getByTestId('user-profile-button');
    expect(account).toHaveAccessibleName('Account');
    expect(account).toHaveAttribute('aria-expanded', 'false');

    await user.click(account);
    expect(account).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Not signed in')).toBeInTheDocument();
    const panel = document.getElementById(account.getAttribute('aria-controls')!)!;
    expect(within(panel).getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Dashboard', '/dashboard'],
      ['Settings', '/settings'],
      ['Sign in', '/api/auth/signin?callbackUrl=%2Fcurriculum'],
    ]);
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();

    await user.keyboard('{Escape}');
    expect(account).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).toBe(account);

    account.focus();
    await user.keyboard('{Enter}');
    expect(account).toHaveAttribute('aria-expanded', 'true');
  });

  it('signs in back to the current page', async () => {
    accountsOnSignedOut();
    nav.pathname = '/curriculum/T1_Foundational/F2A_Core_Data_Types/index';
    const user = userEvent.setup();
    render(<Navbar />);
    await user.click(screen.getByTestId('user-profile-button'));
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/api/auth/signin?callbackUrl=%2Fcurriculum%2FT1_Foundational%2FF2A_Core_Data_Types%2Findex',
    );
    expect(signInHref(null)).toBe('/api/auth/signin?callbackUrl=%2F');
    expect(signInHref('/practice/lab/basics-1')).toBe('/api/auth/signin?callbackUrl=%2Fpractice%2Flab%2Fbasics-1');
  });

  it('offers neither Sign in nor Sign out while the session is still loading', async () => {
    features.accounts = true;
    session.status = 'loading';
    const user = userEvent.setup();
    render(<Navbar />);
    expect(screen.queryByTestId('notification-button')).not.toBeInTheDocument();
    const account = screen.getByTestId('user-profile-button');
    await user.click(account);
    const panel = document.getElementById(account.getAttribute('aria-controls')!)!;
    expect(within(panel).getByText('Checking sign-in…')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('offers Sign out only to a signed-in learner, and it signs out', async () => {
    accountsOnSignedIn('Ada');
    const user = userEvent.setup();
    render(<Navbar />);
    const account = screen.getByTestId('user-profile-button');
    await user.click(account);
    const panel = document.getElementById(account.getAttribute('aria-controls')!)!;
    expect(within(panel).getByText('Ada')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard');
    await user.click(within(panel).getByRole('button', { name: 'Sign out' }));
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });

  it('shows the notification feed for a signed-in learner, loaded from /api/me/notifications', async () => {
    accountsOnSignedIn();
    const user = userEvent.setup();
    render(<Navbar />);
    const bell = screen.getByTestId('notification-button');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('/api/me/notifications?limit=4', expect.objectContaining({ signal: expect.any(AbortSignal) }));
    await user.click(bell);
    expect(bell).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findByText('You’re all caught up')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View all' })).toHaveAttribute('href', '/notifications');

    await user.keyboard('{Escape}');
    expect(bell).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).toBe(bell);
  });

  it('says so, as visible text, when the feed cannot be loaded', async () => {
    accountsOnSignedIn();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })));
    const user = userEvent.setup();
    render(<Navbar />);
    await user.click(screen.getByTestId('notification-button'));
    expect(await screen.findByText('Error: Unable to load notifications')).toBeInTheDocument();
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
    // Every main link, including the ones the desktop bar shows only from xl.
    expect(within(menu).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      '/curriculum#routes',
      '/curriculum',
      '/practice',
      '/practice#labs',
      '/interview-prep',
      '/dashboard',
    ]);
    for (const link of within(menu).getAllByRole('link')) expect(link).not.toHaveClass('hidden');
    // The Dashboard link is a full-width, 44 px row with a visible keyboard focus ring.
    expect(within(menu).getByRole('link', { name: 'Dashboard' })).toHaveClass('min-h-11', 'focus-visible:ring-2');
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
