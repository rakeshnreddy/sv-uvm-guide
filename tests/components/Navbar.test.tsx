import React from 'react';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Navbar, { HOME_LINK_LABEL, searchVisibility, signInHref } from '@/components/Navbar';
import Sidebar, { DOCKED_OUTLINE_WIDTH, OUTLINE_DRAWER_ID } from '@/components/layout/Sidebar';
import { MOBILE_GROUP_HEADING_CLASS, OUTLINE_SLOT_CLASS, PAGE_FRAME_CLASS } from '@/components/layout/nav-styles';
import { SEARCH_PLACEHOLDER } from '@/components/search/SearchCombobox';
import { SEARCH_DIALOG_TITLE } from '@/components/search/SearchDialog';
import { PRIMARY_NAV, SITE_NAME, isNavGroup } from '@/lib/site-links';
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
  ThemeSwitcher: ({ layout = 'bar' }: { layout?: 'bar' | 'menu' }) =>
    layout === 'menu' ? (
      <div role="radiogroup" aria-label="Theme" data-layout={layout}>
        <button type="button" role="radio" aria-checked="true">
          Dark
        </button>
      </div>
    ) : (
      <button type="button" aria-label="Theme" aria-haspopup="menu" data-layout={layout}>
        theme
      </button>
    ),
}));

/** Every main destination in PRIMARY_NAV order, with each group's children in place of the group. */
const MAIN_HREFS = PRIMARY_NAV.flatMap((item) => (isNavGroup(item) ? item.children.map((link) => link.href) : [item.href]));
/** The phone menu's "Your learning" rows: the footer's group less Dashboard. */
const LEARNING_HREFS = ['/dashboard/review', '/dashboard/notebook', '/assessment', '/settings'];
const LESSON = '/curriculum/T1_Foundational/F2A_Core_Data_Types/index';

function barNav() {
  return within(screen.getByRole('banner')).getByRole('navigation', { name: 'Main' });
}

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
  it('is a banner with a named main navigation, a search landmark and the wordmark', () => {
    render(<Navbar />);
    const banner = screen.getByRole('banner');
    const main = barNav();
    expect(within(main).getByRole('link', { name: 'Curriculum' })).toHaveAttribute('href', '/curriculum');
    const search = within(banner).getByRole('search', { name: 'Curriculum' });
    expect(within(search).getByRole('combobox', { name: SEARCH_PLACEHOLDER })).toHaveAttribute('data-testid', 'main-search-input');
    expect(HOME_LINK_LABEL).toBe(`${SITE_NAME} home`);
    expect(within(banner).getByRole('link', { name: HOME_LINK_LABEL })).toHaveAttribute('href', '/');
  });

  it('shows the five PRIMARY_NAV items in order: links for Curriculum, Interview prep and Dashboard, disclosures for Practice and Reference', () => {
    render(<Navbar />);
    const main = barNav();
    const items = Array.from(main.children).map((child) => {
      const control = child.matches('a, button') ? child : child.querySelector('button')!;
      return [control.tagName.toLowerCase(), control.textContent];
    });
    expect(items).toEqual([
      ['a', 'Curriculum'],
      ['button', 'Practice'],
      ['a', 'Interview prep'],
      ['button', 'Reference'],
      ['a', 'Dashboard'],
    ]);
    expect(within(main).getByRole('link', { name: 'Interview prep' })).toHaveAttribute('href', '/interview-prep');
    expect(within(main).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard');
    // The old entries are gone: no "Start here", no "Labs" as a top item, no "More".
    expect(within(main).queryByRole('button', { name: 'More' })).not.toBeInTheDocument();
    expect(screen.queryByText('Start here')).not.toBeInTheDocument();
    expect(main).toHaveClass('hidden', 'lg:flex');
  });

  it('marks the current item with aria-current, weight 500 and a 2 px accent underline (activeNavLabel)', () => {
    nav.pathname = '/curriculum';
    const { unmount } = render(<Navbar />);
    let current = within(barNav()).getByRole('link', { name: 'Curriculum' });
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current).toHaveClass('border-b-2', 'border-primary', 'font-medium', 'text-foreground', 'duration-150', 'ease-bench');
    expect(current).not.toHaveClass('font-semibold', 'bg-primary', 'text-primary');
    const other = within(barNav()).getByRole('link', { name: 'Dashboard' });
    expect(other).toHaveClass('border-transparent', 'font-medium', 'text-muted-foreground', 'hover:text-foreground');
    expect(other).not.toHaveAttribute('aria-current');
    // Every item, link or button, is set at weight 500, so nothing shifts between pages.
    for (const control of barNav().querySelectorAll(':scope > a, :scope > div > button')) {
      expect(control).toHaveClass('font-medium');
      expect(control).not.toHaveClass('font-semibold', 'font-normal');
    }
    unmount();

    nav.pathname = LESSON;
    const second = render(<Navbar />);
    current = within(barNav()).getByRole('link', { name: 'Curriculum' });
    expect(current).toHaveAttribute('aria-current', 'true');
    second.unmount();

    // Dashboard covers /settings and /assessment; Practice covers /exercises/**.
    nav.pathname = '/settings';
    const third = render(<Navbar />);
    expect(within(barNav()).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'true');
    third.unmount();

    nav.pathname = '/exercises/uvm-phase-sorter';
    render(<Navbar />);
    const practice = within(barNav()).getByRole('button', { name: 'Practice' });
    expect(practice).toHaveAttribute('aria-current', 'true');
    expect(practice).toHaveClass('border-primary', 'text-foreground');
    expect(within(barNav()).getByRole('link', { name: 'Curriculum' })).not.toHaveAttribute('aria-current');
  });

  it('is one opaque sticky 64 px row with a hairline: no blur and no translucent background', () => {
    render(<Navbar />);
    const banner = screen.getByRole('banner');
    expect(banner).toHaveClass('sticky', 'top-0', 'h-16', 'border-b', 'border-border', 'bg-background');
    expect(banner.className).not.toMatch(/backdrop-blur|bg-background\/|supports-\[backdrop-filter\]/);
  });

  it('gives every header icon button one style: 40 px, rounded-lg, bordered card surface, hover raised', () => {
    nav.pathname = LESSON;
    render(<Navbar />);
    const banner = screen.getByRole('banner');
    for (const name of ['Course outline', 'Search', 'Open main menu']) {
      for (const button of within(banner).getAllByRole('button', { name })) {
        expect(button).toHaveClass('h-10', 'w-10', 'rounded-lg', 'border', 'border-border', 'bg-card', 'hover:bg-muted', 'duration-150', 'ease-bench');
        expect(button).not.toHaveClass('rounded-xl', 'bg-background', 'transition-all');
        expect(button.querySelector('svg')).toHaveClass('h-[18px]', 'w-[18px]');
      }
    }
  });

  it('caps the search field at 420 px and shows the menu button only below lg', () => {
    render(<Navbar />);
    const search = within(screen.getByRole('banner')).getByRole('search', { name: 'Curriculum' });
    expect(search).toHaveClass('max-w-[420px]', 'hidden', 'md:flex');
    expect(screen.getByRole('button', { name: 'Open main menu' })).toHaveClass('lg:hidden');
    expect(searchVisibility(false)).toEqual({ field: 'hidden md:flex', button: 'md:hidden' });
    // While the outline is docked the field gives way to the button from lg to xl.
    expect(searchVisibility(true)).toEqual({ field: 'hidden md:flex lg:hidden xl:flex', button: 'md:hidden lg:inline-flex xl:hidden' });
  });

  it('links no hidden page while every switch is off', () => {
    for (const key of Object.keys(features) as Array<keyof typeof features>) features[key] = false;
    try {
      render(<Navbar />);
      const banner = screen.getByRole('banner');
      expect(within(banner).getAllByRole('link', { name: 'Dashboard' })[0]).toHaveAttribute('href', '/dashboard');
      const hrefs = within(banner)
        .getAllByRole('link', { hidden: true })
        .map((link) => link.getAttribute('href'));
      for (const hidden of ['/community', '/notifications']) {
        expect(hrefs).not.toContain(hidden);
      }
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      Object.assign(features, { dashboard: true, review: true, notebook: true, settings: true });
    }
  });
});

describe('header alignment', () => {
  it('uses the page frame on pages without the outline, with no outline button', () => {
    nav.pathname = '/practice';
    render(<Navbar />);
    const frame = screen.getByRole('banner').querySelector('[data-header-frame]')!;
    for (const name of PAGE_FRAME_CLASS.split(' ')) expect(frame).toHaveClass(name);
    expect(screen.getByRole('banner').querySelector('[data-header-slot]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Course outline' })).not.toBeInTheDocument();
  });

  it('puts the outline button and wordmark in a left slot as wide as the docked outline on lesson pages', () => {
    nav.pathname = LESSON;
    render(<Navbar />);
    const slot = screen.getByRole('banner').querySelector('[data-header-slot="outline"]')!;
    expect(within(slot as HTMLElement).getByRole('button', { name: 'Course outline' })).toBeInTheDocument();
    expect(within(slot as HTMLElement).getByRole('link', { name: HOME_LINK_LABEL })).toBeInTheDocument();
    // The slot takes the docked column's widths from lg ("w-64 xl:w-72" becomes "lg:w-64 xl:w-72").
    const widths = DOCKED_OUTLINE_WIDTH.split(' ').map((name) => (name.includes(':') ? name : `lg:${name}`));
    for (const name of widths) expect(slot).toHaveClass(name);
    expect(OUTLINE_SLOT_CLASS).toContain('lg:w-64');
  });

  it('drops the slot when the learner has hidden the docked outline', () => {
    nav.pathname = LESSON;
    act(() => shellStore.setOutlineCollapsed(true));
    render(<Navbar />);
    expect(screen.getByRole('banner').querySelector('[data-header-slot]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Course outline' })).toBeInTheDocument();
  });
});

describe('Practice and Reference disclosures', () => {
  it('opens a panel of links with aria-expanded and aria-controls, and Escape closes it and returns focus', async () => {
    const user = userEvent.setup();
    render(<Navbar />);
    const practice = within(barNav()).getByRole('button', { name: 'Practice' });
    expect(practice).toHaveAttribute('aria-expanded', 'false');
    const panel = document.getElementById(practice.getAttribute('aria-controls')!)!;
    expect(panel).toHaveAttribute('data-state', 'closed');
    expect(panel).toHaveClass('invisible');

    await user.click(practice);
    expect(practice).toHaveAttribute('aria-expanded', 'true');
    expect(panel).toHaveAttribute('data-state', 'open');
    expect(panel).toHaveClass('visible', 'bg-popover', 'border', 'border-border', 'rounded-xl', 'shadow-card', 'duration-200', 'ease-bench');
    const group = PRIMARY_NAV.find((item) => item.label === 'Practice')!;
    expect(isNavGroup(group)).toBe(true);
    expect(within(panel).getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')])).toEqual(
      isNavGroup(group) ? group.children.map((link) => [link.label, link.href]) : [],
    );

    await user.keyboard('{Escape}');
    expect(practice).toHaveAttribute('aria-expanded', 'false');
    expect(practice).toHaveFocus();
  });

  it('lists the five Reference pages', async () => {
    const user = userEvent.setup();
    render(<Navbar />);
    const reference = within(barNav()).getByRole('button', { name: 'Reference' });
    await user.click(reference);
    const panel = document.getElementById(reference.getAttribute('aria-controls')!)!;
    expect(within(panel).getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Knowledge hub',
      'Resources',
      'Projects',
      'Learning strategies',
      'History',
    ]);
  });

  it('closes when focus leaves it, on a press outside, and when a link is followed', async () => {
    const user = userEvent.setup();
    render(<Navbar />);
    const practice = within(barNav()).getByRole('button', { name: 'Practice' });
    const panel = document.getElementById(practice.getAttribute('aria-controls')!)!;

    await user.click(practice);
    const links = within(panel).getAllByRole('link');
    // Tabbing through the panel keeps it open; tabbing past the last link closes it.
    await user.tab();
    expect(links[0]).toHaveFocus();
    for (let i = 1; i < links.length; i += 1) await user.tab();
    expect(practice).toHaveAttribute('aria-expanded', 'true');
    await user.tab();
    expect(within(barNav()).getByRole('link', { name: 'Interview prep' })).toHaveFocus();
    expect(practice).toHaveAttribute('aria-expanded', 'false');

    await user.click(practice);
    await user.click(screen.getByRole('banner').querySelector('[data-header-frame]') as HTMLElement);
    expect(practice).toHaveAttribute('aria-expanded', 'false');

    await user.click(practice);
    await user.click(within(panel).getByRole('link', { name: 'Labs' }));
    expect(practice).toHaveAttribute('aria-expanded', 'false');
  });

  it('opening one disclosure closes the other', async () => {
    const user = userEvent.setup();
    render(<Navbar />);
    const practice = within(barNav()).getByRole('button', { name: 'Practice' });
    const reference = within(barNav()).getByRole('button', { name: 'Reference' });
    await user.click(practice);
    await user.click(reference);
    expect(practice).toHaveAttribute('aria-expanded', 'false');
    expect(reference).toHaveAttribute('aria-expanded', 'true');
  });

  it('marks one current child with the raised surface and the 2 px accent marker', async () => {
    nav.pathname = '/practice/waveform-studio';
    const user = userEvent.setup();
    render(<Navbar />);
    const practice = within(barNav()).getByRole('button', { name: 'Practice' });
    expect(practice).toHaveAttribute('aria-current', 'true');
    await user.click(practice);
    const panel = document.getElementById(practice.getAttribute('aria-controls')!)!;
    const marked = panel.querySelectorAll('[aria-current]');
    expect(marked).toHaveLength(1);
    expect(marked[0]).toHaveTextContent('Waveform studio');
    expect(marked[0]).toHaveAttribute('aria-current', 'page');
    expect(marked[0]).toHaveClass('border-l-2', 'border-primary', 'bg-muted', 'font-medium');
    expect(within(panel).getByRole('link', { name: 'Practice hub' })).toHaveClass('border-transparent', 'font-medium');
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
  it('has one name for every width and reports the drawer state on a lesson (G30-SIDE-08)', async () => {
    nav.pathname = LESSON;
    const user = userEvent.setup();
    render(
      <>
        <Navbar />
        <Sidebar />
      </>,
    );
    const toggles = within(screen.getByRole('banner')).getAllByRole('button', { name: 'Course outline' });
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

  it('is shown only where the outline exists (lesson pages)', () => {
    for (const pathname of ['/curriculum', '/practice', '/dashboard', '/interview-prep']) {
      nav.pathname = pathname;
      const { unmount } = render(<Navbar />);
      expect(within(screen.getByRole('banner')).queryByRole('button', { name: 'Course outline' })).not.toBeInTheDocument();
      unmount();
    }
  });
});

describe('search on phones (G30-SRCH-02)', () => {
  it('opens the search dialog from the search button', async () => {
    const user = userEvent.setup();
    render(<Navbar />);
    const [searchButton] = screen.getAllByRole('button', { name: 'Search' });
    expect(searchButton).toHaveAttribute('aria-haspopup', 'dialog');
    await user.click(searchButton);
    const dialog = screen.getByRole('dialog', { name: SEARCH_DIALOG_TITLE });
    expect(document.activeElement).toBe(within(dialog).getByRole('combobox'));
    expect(searchButton).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('phone menu', () => {
  async function openPhoneMenu(user: ReturnType<typeof userEvent.setup>) {
    const menuButton = screen.getByRole('button', { name: 'Open main menu' });
    await user.click(menuButton);
    return { menuButton, menu: screen.getByTestId('mobile-menu') };
  }

  it('is a modal dialog with the close button first, every main destination, then Your learning', async () => {
    const user = userEvent.setup();
    render(<Navbar />);
    const { menu, menuButton } = await openPhoneMenu(user);
    expect(menu).toHaveAttribute('role', 'dialog');
    expect(menu).toHaveAttribute('aria-modal', 'true');
    expect(menu.parentElement).toHaveClass('lg:hidden');
    expect(within(menu).getAllByRole('button')[0]).toHaveAccessibleName('Close menu');
    const mainNav = within(menu).getByRole('navigation', { name: 'Main' });
    expect(within(mainNav).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(MAIN_HREFS);
    expect(within(menu).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([...MAIN_HREFS, ...LEARNING_HREFS]);
    for (const link of within(menu).getAllByRole('link')) expect(link).toHaveClass('min-h-11', 'focus-visible:ring-2');
    expect(menuButton).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('mobile-menu')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(menuButton);
  });

  it('lists each disclosure\'s children under its group label', async () => {
    const user = userEvent.setup();
    render(<Navbar />);
    const { menu } = await openPhoneMenu(user);
    const mainNav = within(menu).getByRole('navigation', { name: 'Main' });
    for (const item of PRIMARY_NAV) {
      if (!isNavGroup(item)) continue;
      const heading = within(mainNav).getByRole('heading', { name: item.label, level: 3 });
      expect(heading).toHaveClass('text-label', 'text-muted-foreground');
      const list = within(mainNav).getByRole('list', { name: item.label });
      expect(within(list).getAllByRole('link').map((link) => link.textContent)).toEqual(item.children.map((link) => link.label));
    }
    // The bar's group buttons are not repeated in the menu.
    expect(within(mainNav).queryByRole('button')).not.toBeInTheDocument();
  });

  it('closes when a link is followed', async () => {
    const user = userEvent.setup();
    render(<Navbar />);
    await openPhoneMenu(user);
    await user.click(within(screen.getByTestId('mobile-menu')).getByRole('link', { name: 'Practice hub' }));
    expect(screen.queryByTestId('mobile-menu')).not.toBeInTheDocument();
    act(() => shellStore.openMenu());
    expect(screen.getByTestId('mobile-menu')).toBeInTheDocument();
  });

  it('starts with a Course outline row that closes the menu and opens the outline drawer', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Navbar />
        <Sidebar />
      </>,
    );
    const { menu, menuButton } = await openPhoneMenu(user);
    const row = within(menu).getByRole('button', { name: 'Course outline' });
    expect(row).toHaveAttribute('aria-haspopup', 'dialog');
    expect(row).toHaveClass('min-h-11', 'w-full', 'focus-visible:ring-2');
    const buttons = within(menu).getAllByRole('button');
    expect(buttons[0]).toHaveAccessibleName('Close menu');
    expect(buttons[1]).toBe(row);
    const mainNav = within(menu).getByRole('navigation', { name: 'Main' });
    expect(row.compareDocumentPosition(mainNav) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await user.click(row);
    expect(screen.queryByTestId('mobile-menu')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Course outline' })).toHaveAttribute('id', OUTLINE_DRAWER_ID);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(menuButton);
  });

  it('shows the theme controls under Appearance whatever the accounts switch says', async () => {
    for (const accounts of [false, true]) {
      if (accounts) accountsOnSignedOut();
      const user = userEvent.setup();
      const { unmount } = render(<Navbar />);
      const { menu } = await openPhoneMenu(user);
      const appearance = within(menu).getByRole('region', { name: 'Appearance' });
      expect(within(appearance).getByRole('heading', { name: 'Appearance', level: 3 })).toBeInTheDocument();
      expect(within(appearance).getByRole('radiogroup', { name: 'Theme' })).toHaveAttribute('data-layout', 'menu');
      expect(within(appearance).queryByRole('button', { name: 'Theme' })).not.toBeInTheDocument();
      unmount();
      shellStore.reset();
    }
  });

  it('dims the page behind the phone menu without blur, and keeps shadows to shadow-card', async () => {
    const user = userEvent.setup();
    render(<Navbar />);
    const { menu } = await openPhoneMenu(user);
    const backdrop = screen.getByTestId('mobile-menu-backdrop');
    expect(backdrop).toHaveClass('bg-background/80');
    expect(backdrop.className).not.toMatch(/blur/);
    expect(menu).toHaveClass('shadow-card');
    expect(menu.className).not.toMatch(/shadow-(lg|xl|2xl)/);
  });

  it('sets every group heading in the label style (12/16, weight 500, sentence case), in order', async () => {
    accountsOnSignedOut();
    const user = userEvent.setup();
    render(<Navbar />);
    const { menu } = await openPhoneMenu(user);
    const headings = within(menu).getAllByRole('heading', { level: 3 });
    expect(headings.map((heading) => heading.textContent)).toEqual(['Practice', 'Reference', 'Appearance', 'Your learning', 'Account']);
    for (const heading of headings) {
      expect(heading).toHaveClass('text-label', 'text-muted-foreground');
      expect(heading).not.toHaveClass('text-sm', 'font-semibold', 'uppercase');
    }
    expect(MOBILE_GROUP_HEADING_CLASS).toContain('text-label');
  });

  it('marks the current row with the raised surface and a 2 px leading accent, at the same weight as the others', async () => {
    nav.pathname = '/practice';
    const user = userEvent.setup();
    render(<Navbar />);
    const { menu } = await openPhoneMenu(user);
    const main = within(menu).getByRole('navigation', { name: 'Main' });
    const current = within(main).getByRole('link', { name: 'Practice hub' });
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current).toHaveClass('border-l-2', 'border-primary', 'bg-muted', 'font-medium');
    const other = within(main).getByRole('link', { name: 'Curriculum' });
    expect(other).toHaveClass('border-l-2', 'border-transparent', 'font-medium');
    expect(main.querySelectorAll('[aria-current]')).toHaveLength(1);
  });

  it('lists Review, Notebook, Self-assessment and Settings under Your learning, marking the current page', async () => {
    nav.pathname = '/assessment';
    const user = userEvent.setup();
    render(<Navbar />);
    const { menu } = await openPhoneMenu(user);
    const learning = within(menu).getByRole('navigation', { name: 'Your learning' });
    const links = within(learning).getAllByRole('link');
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Review', '/dashboard/review'],
      ['Notebook', '/dashboard/notebook'],
      ['Self-assessment', '/assessment'],
      ['Settings', '/settings'],
    ]);
    expect(within(learning).getByRole('link', { name: 'Self-assessment' })).toHaveAttribute('aria-current', 'page');
    // Dashboard is the current main item on /assessment, as in the bar.
    expect(within(menu).getByRole('navigation', { name: 'Main' }).querySelector('a[href="/dashboard"]')).toHaveAttribute('aria-current', 'true');

    await user.click(within(learning).getByRole('link', { name: 'Notebook' }));
    expect(screen.queryByTestId('mobile-menu')).not.toBeInTheDocument();
  });

  it('keeps every control inside the focus loop, in reading order', async () => {
    const user = userEvent.setup();
    render(<Navbar />);
    const { menu, menuButton } = await openPhoneMenu(user);
    const labelOf = (href: string) =>
      PRIMARY_NAV.flatMap((item) => (isNavGroup(item) ? item.children : [item])).find((link) => link.href === href)!.label;
    const expected = [
      'Close menu',
      'Course outline',
      ...MAIN_HREFS.map(labelOf),
      'Dark',
      'Review',
      'Notebook',
      'Self-assessment',
      'Settings',
    ];
    const seen: string[] = [];
    for (let i = 0; i < expected.length; i += 1) {
      const active = document.activeElement as HTMLElement;
      expect(menu.contains(active)).toBe(true);
      seen.push(active.getAttribute('aria-label') ?? active.textContent ?? '');
      await user.keyboard('{Tab}');
    }
    expect(seen).toEqual(expected);
    expect(document.activeElement).toHaveAccessibleName('Close menu');
    await user.keyboard('{Escape}');
    expect(document.activeElement).toBe(menuButton);
  });
});

describe('account items in the phone menu (accounts seam below md)', () => {
  async function openPhoneMenu(user: ReturnType<typeof userEvent.setup>) {
    const menuButton = screen.getByRole('button', { name: 'Open main menu' });
    await user.click(menuButton);
    return { menuButton, menu: screen.getByTestId('mobile-menu') };
  }

  it('adds no account items while accounts are off: no account heading, Sign in or Sign out, and no fetch', async () => {
    const user = userEvent.setup();
    render(<Navbar />);
    const { menu } = await openPhoneMenu(user);
    expect(within(menu).queryByTestId('mobile-account')).not.toBeInTheDocument();
    expect(within(menu).queryByRole('heading', { name: 'Account' })).not.toBeInTheDocument();
    // Settings is still offered, once, under "Your learning" (navigation-6).
    expect(within(menu).getAllByRole('link', { name: 'Settings' })).toHaveLength(1);
    expect(within(menu).queryByText(/sign in|sign out|signed in|checking sign-in/i)).not.toBeInTheDocument();
    expect(within(menu).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([...MAIN_HREFS, ...LEARNING_HREFS]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('offers a signed-out visitor Sign in back to this page, after the main links, with Settings listed once', async () => {
    accountsOnSignedOut();
    nav.pathname = '/practice/lab/basics-1';
    const user = userEvent.setup();
    render(<Navbar />);
    const { menu } = await openPhoneMenu(user);

    const account = within(menu).getByTestId('mobile-account');
    expect(within(account).getByRole('heading', { name: 'Account', level: 3 })).toBeInTheDocument();
    expect(within(account).getByText('Not signed in')).toHaveAttribute('aria-live', 'polite');
    expect(within(account).getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Sign in', '/api/auth/signin?callbackUrl=%2Fpractice%2Flab%2Fbasics-1'],
    ]);
    // Settings sits under "Your learning" for everyone, so the account items do not repeat it.
    expect(within(menu).getAllByRole('link', { name: 'Settings' })).toHaveLength(1);
    expect(within(menu).queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
    expect(within(menu).queryByRole('link', { name: 'Notifications' })).not.toBeInTheDocument();
    // Dashboard stays a main link and is not repeated, so the menu has one Dashboard link.
    expect(within(menu).getAllByRole('link', { name: 'Dashboard' })).toHaveLength(1);
    // The account items follow the main navigation and are full-width 44 px rows with a focus ring.
    const mainNav = within(menu).getByRole('navigation', { name: 'Main' });
    expect(mainNav.compareDocumentPosition(account) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(mainNav).queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
    for (const link of within(account).getAllByRole('link')) expect(link).toHaveClass('min-h-11', 'focus-visible:ring-2');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps the account items inside the dialog focus loop, and following Sign in closes the menu', async () => {
    accountsOnSignedOut();
    const user = userEvent.setup();
    render(<Navbar />);
    const { menu, menuButton } = await openPhoneMenu(user);
    const close = within(menu).getByRole('button', { name: 'Close menu' });
    const signIn = within(menu).getByRole('link', { name: 'Sign in' });
    expect(document.activeElement).toBe(close);
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(signIn);
    await user.keyboard('{Tab}');
    expect(document.activeElement).toBe(close);

    signIn.addEventListener('click', (event) => event.preventDefault());
    await user.click(signIn);
    expect(screen.queryByTestId('mobile-menu')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(menuButton);
  });

  it('offers neither Sign in nor Sign out while the session check runs', async () => {
    features.accounts = true;
    session.status = 'loading';
    const user = userEvent.setup();
    render(<Navbar />);
    const { menu } = await openPhoneMenu(user);
    const account = within(menu).getByTestId('mobile-account');
    expect(within(account).getByText('Checking sign-in…')).toBeInTheDocument();
    expect(within(account).queryAllByRole('link')).toHaveLength(0);
    expect(within(menu).getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
    expect(within(menu).queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
    expect(within(menu).queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('offers a signed-in learner Notifications and Sign out, and Sign out signs out and closes the menu', async () => {
    accountsOnSignedIn('Ada');
    const user = userEvent.setup();
    render(<Navbar />);
    // The desktop bell loads its feed once; the phone menu adds no request of its own.
    expect(fetch).toHaveBeenCalledTimes(1);
    const { menu, menuButton } = await openPhoneMenu(user);
    const account = within(menu).getByTestId('mobile-account');
    expect(within(account).getByText('Signed in as Ada')).toBeInTheDocument();
    expect(within(account).getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Notifications', '/notifications'],
    ]);
    expect(within(menu).getAllByRole('link', { name: 'Settings' })).toHaveLength(1);
    expect(within(menu).queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);

    const signOut = within(account).getByRole('button', { name: 'Sign out' });
    expect(signOut).toHaveClass('min-h-11', 'w-full', 'focus-visible:ring-2');
    await user.click(signOut);
    expect(auth.signOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('mobile-menu')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(menuButton);
  });

  it('says "Signed in" without a display name, and marks Settings while on /settings', async () => {
    accountsOnSignedIn(null);
    nav.pathname = '/settings';
    const user = userEvent.setup();
    render(<Navbar />);
    const { menu } = await openPhoneMenu(user);
    const account = within(menu).getByTestId('mobile-account');
    expect(within(account).getByText('Signed in')).toBeInTheDocument();
    expect(within(menu).getByRole('navigation', { name: 'Your learning' }).querySelector('a[href="/settings"]')).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(account).getByRole('link', { name: 'Notifications' })).not.toHaveAttribute('aria-current');
  });
});
