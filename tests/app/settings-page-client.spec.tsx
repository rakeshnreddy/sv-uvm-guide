import React, { StrictMode } from 'react';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SettingsPageClient, { formatStorageEstimate } from '@/app/(learning)/settings/SettingsPageClient';
import { LEARNER_DATA_MAX_LABEL } from '@/lib/learner-store/backup';
import { __resetRecordsForTests } from '@/lib/learner-store/record';
import { __resetStorageForTests } from '@/lib/learner-store/storage';
import type { AccountSessionStatus } from '@/lib/persistence/target';
import { cloneNotificationPreferences, DEFAULT_USER_PREFERENCES, type UserPreferences } from '@/lib/user-preferences';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@/lib/notifications';

const mocks = vi.hoisted(() => ({
  status: 'disabled' as AccountSessionStatus,
  setTheme: vi.fn(),
  panelModuleLoads: 0,
}));

// The real panel, counting when its module is loaded: SettingsPageClient must load it only for a signed-in learner.
vi.mock('@/app/(learning)/settings/AccountPreferencesPanel', async (importOriginal) => {
  mocks.panelModuleLoads += 1;
  return importOriginal();
});

// The account seam: only the session status changes between tests.
vi.mock('@/lib/persistence/target', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/persistence/target')>();
  return {
    ...actual,
    useAccountSession: () => ({
      status: mocks.status,
      userId: mocks.status === 'authenticated' ? 'learner-1' : null,
    }),
  };
});

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'default-dark', resolvedTheme: 'default-dark', setTheme: mocks.setTheme }),
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

const buildPreferences = (): UserPreferences => ({
  ...DEFAULT_USER_PREFERENCES,
  notifications: cloneNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES),
});

interface FakeResponse {
  ok: boolean;
  status?: number;
  json: () => Promise<unknown>;
}

const ok = (body: unknown): FakeResponse => ({ ok: true, json: () => Promise.resolve(body) });
const failed = (status: number): FakeResponse => ({ ok: false, status, json: async () => ({}) });

/** A fetch mock for /api/me/preferences: GET answers with `get`, PATCH with `patch(body)`. */
function mockPreferencesApi(get: () => FakeResponse, patch: (body: { preferences: UserPreferences }) => FakeResponse) {
  const fetchSpy = vi.fn((url: string, init?: RequestInit) => {
    expect(url).toBe('/api/me/preferences');
    if (init?.method === 'PATCH') return Promise.resolve(patch(JSON.parse(String(init.body))));
    return Promise.resolve(get());
  });
  global.fetch = fetchSpy as unknown as typeof fetch;
  return fetchSpy;
}

function patchCalls(fetchSpy: ReturnType<typeof mockPreferencesApi>) {
  return fetchSpy.mock.calls.filter(([, init]) => init?.method === 'PATCH');
}

function getCalls(fetchSpy: ReturnType<typeof mockPreferencesApi>) {
  return fetchSpy.mock.calls.filter(([, init]) => init?.method === undefined || init.method === 'GET');
}

describe('SettingsPageClient', () => {
  const user = userEvent.setup();
  const originalFetch = global.fetch;

  beforeEach(() => {
    window.localStorage.clear();
    __resetStorageForTests();
    __resetRecordsForTests();
    mocks.status = 'disabled';
    mocks.setTheme.mockReset();
    global.fetch = vi.fn(() => Promise.reject(new Error('unexpected request'))) as unknown as typeof fetch;
  });

  afterEach(() => {
    cleanup();
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('local mode (no account)', () => {
    it('renders Appearance and the learning data section without any request', async () => {
      render(<SettingsPageClient />);

      expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
      const nav = screen.getByRole('navigation', { name: 'Your learning' });
      expect(within(nav).getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');

      const appearance = screen.getByRole('region', { name: 'Appearance' });
      const themeGroup = within(appearance).getByRole('group', { name: 'Colour theme and light or dark mode' });
      expect(await within(themeGroup).findByRole('combobox', { name: 'Select theme' })).toBeInTheDocument();
      await user.click(within(themeGroup).getByRole('button', { name: 'Toggle theme' }));
      expect(mocks.setTheme).toHaveBeenCalledWith('default-light');
      expect(appearance).toHaveTextContent(/reduce-motion setting/i);

      const data = screen.getByRole('region', { name: 'Your learning data' });
      expect(data).toHaveAttribute('id', 'data');
      expect(data).toHaveTextContent(/stored only in this browser, in its local storage/i);
      // Every area a backup carries is named, the lesson-visit and activity logs included.
      expect(data).toHaveTextContent(/the lessons you opened and the days you studied/i);
      expect(within(data).getByText('Stored only in this browser')).toBeInTheDocument();
      expect(data).toHaveTextContent(/Some browsers clear data for sites you haven.t visited recently/);
      expect(await within(data).findByText('No learning data is saved in this browser yet.')).toBeInTheDocument();
      expect(within(data).getByRole('button', { name: 'Download a backup (JSON)' })).toBeInTheDocument();
      expect(within(data).getByLabelText(`Choose a backup file (JSON, at most ${LEARNER_DATA_MAX_LABEL})`)).toHaveAttribute('type', 'file');
      expect(within(data).getByRole('button', { name: 'Delete all learning data in this browser' })).toBeInTheDocument();

      expect(screen.queryByRole('heading', { name: 'Account preferences' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Email updates about new modules/i })).not.toBeInTheDocument();
      // The dead account buttons and the unused database theme toggle are gone.
      expect(screen.queryByText(/Enable dark interface/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Deactivate account|Request data deletion|Export progress \(CSV\)/i })).not.toBeInTheDocument();
      expect(global.fetch).not.toHaveBeenCalled();
      // The account code is not even loaded.
      expect(mocks.panelModuleLoads).toBe(0);
    });

    it('shows how much learning data this browser holds', async () => {
      window.localStorage.setItem('curriculumProgress', JSON.stringify({ F1A: { completedLessons: ['index'] } }));
      window.localStorage.setItem('theme', 'x'.repeat(4096));
      render(<SettingsPageClient />);
      // The theme is not learning data, so it is not counted.
      expect(await screen.findByText('Learning data in this browser: less than 1 KB.')).toBeInTheDocument();
      expect(formatStorageEstimate(12 * 1024)).toBe('about 12 KB');
      expect(formatStorageEstimate(1.4 * 1024 * 1024)).toBe('about 1.4 MB');
    });

    it.each<AccountSessionStatus>(['unauthenticated', 'loading'])(
      'keeps the account panel hidden and the network quiet while the session is %s',
      async (status) => {
        mocks.status = status;
        render(<SettingsPageClient />);
        expect(await screen.findByRole('button', { name: 'Download a backup (JSON)' })).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Account preferences' })).not.toBeInTheDocument();
        expect(global.fetch).not.toHaveBeenCalled();
        expect(mocks.panelModuleLoads).toBe(0);
      },
    );
  });

  describe('AccountPreferencesPanel (signed in)', () => {
    beforeEach(() => {
      mocks.status = 'authenticated';
    });

    it('loads with GET, then toggles email notifications with exactly one PATCH and shows save status', async () => {
      const preferences = buildPreferences();
      preferences.notifications.channels.email = true;
      const fetchSpy = mockPreferencesApi(
        () => ok({ preferences }),
        (body) => ok({ preferences: body.preferences }),
      );

      // StrictMode runs effects and state updaters twice: the panel must still send one PATCH per change.
      render(
        <StrictMode>
          <SettingsPageClient />
        </StrictMode>,
      );

      const panel = await screen.findByRole('region', { name: 'Account preferences' });
      // Loaded on demand, once the session is authenticated.
      expect(mocks.panelModuleLoads).toBe(1);
      const emailToggle = await within(panel).findByRole('button', { name: /Email updates about new modules/i });
      expect(emailToggle).toHaveAttribute('aria-pressed', 'true');
      expect(getCalls(fetchSpy).length).toBeGreaterThan(0);
      expect(patchCalls(fetchSpy)).toHaveLength(0);

      await user.click(emailToggle);

      await waitFor(() => expect(within(panel).getByText('Preferences saved')).toBeVisible());
      const patches = patchCalls(fetchSpy);
      expect(patches).toHaveLength(1);
      const [, init] = patches[0];
      expect(init?.headers).toEqual({ 'Content-Type': 'application/json' });
      const requestPayload = JSON.parse(String(init?.body));
      expect(requestPayload.preferences.notifications.channels.email).toBe(false);
      expect(emailToggle).toHaveAttribute('aria-pressed', 'false');

      // A second change builds on the first, again with one PATCH.
      await user.click(within(panel).getByRole('button', { name: /Share anonymous telemetry/i }));
      await waitFor(() => expect(patchCalls(fetchSpy)).toHaveLength(2));
      const second = JSON.parse(String(patchCalls(fetchSpy)[1][1]?.body));
      expect(second.preferences.shareTelemetry).toBe(true);
      expect(second.preferences.notifications.channels.email).toBe(false);
    });

    it('notifies when the server call fails', async () => {
      mockPreferencesApi(
        () => ok({ preferences: buildPreferences() }),
        () => failed(500),
      );
      vi.spyOn(console, 'error').mockImplementation(() => undefined);

      render(<SettingsPageClient />);

      const telemetryToggle = await screen.findByRole('button', { name: /Share anonymous telemetry/i });
      await user.click(telemetryToggle);

      await waitFor(() => expect(screen.getByText(/Unable to save preferences right now. Please retry./i)).toBeVisible());
    });

    it('shows a loading state, then an error with a retry when the preferences cannot be loaded', async () => {
      let attempts = 0;
      const fetchSpy = mockPreferencesApi(
        () => {
          attempts += 1;
          return attempts === 1 ? failed(503) : ok({ preferences: buildPreferences() });
        },
        (body) => ok({ preferences: body.preferences }),
      );
      vi.spyOn(console, 'error').mockImplementation(() => undefined);

      render(<SettingsPageClient />);
      expect(screen.getByText('Loading your preferences…')).toBeInTheDocument();

      expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load your preferences right now.');
      await user.click(screen.getByRole('button', { name: 'Try again' }));

      expect(await screen.findByRole('button', { name: /Email updates about new modules/i })).toBeInTheDocument();
      expect(getCalls(fetchSpy)).toHaveLength(2);
      expect(patchCalls(fetchSpy)).toHaveLength(0);
    });
  });
});

// ensure components using the legacy JSX runtime can resolve React
(globalThis as typeof globalThis & { React?: typeof React }).React = React;
