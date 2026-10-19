import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/*
 * Hidden pages answer 404 (notFound) unless their switch is on. Pages read
 * switches through SITE_FEATURES (src/lib/site-features.ts), which is built
 * from isFeatureEnabled(); the real site-features and accounts modules run
 * here on top of a mocked '@/tools/featureFlags' that defines both exports,
 * in agreement (GD6). The dashboard and settings pages are always on; their
 * own tests cover them.
 */

type FeatureFlagName = 'community' | 'tracking' | 'personalization' | 'fakeComments' | 'accountUI' | 'aiTutor' | 'simulation';

const ALL_FLAGS: readonly FeatureFlagName[] = [
  'community',
  'tracking',
  'personalization',
  'fakeComments',
  'accountUI',
  'aiTutor',
  'simulation',
];

(globalThis as typeof globalThis & { React?: typeof React }).React = React;

interface LoadRouteOptions {
  flags?: Partial<Record<FeatureFlagName, boolean>>;
  /** The value of every flag not listed in `flags`. */
  defaultValue?: boolean;
}

const notFound = vi.fn((): never => {
  throw new Error('notFound');
});

async function loadRoute<T>(modulePath: string, options: LoadRouteOptions = {}) {
  const { flags = {}, defaultValue = false } = options;

  vi.resetModules();

  const isFeatureEnabled = (flag: FeatureFlagName): boolean => flags[flag] ?? defaultValue;
  vi.doMock('@/tools/featureFlags', () => ({
    __esModule: true,
    isFeatureEnabled,
    featureFlags: Object.freeze(Object.fromEntries(ALL_FLAGS.map((flag) => [flag, isFeatureEnabled(flag)]))),
  }));

  vi.doMock('next/navigation', () => ({
    __esModule: true,
    notFound,
  }));

  return import(modulePath) as Promise<T>;
}

type PageModule = { default: (props?: unknown) => Promise<React.ReactElement> | React.ReactElement; dynamic?: string };

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  for (const mocked of [
    '@/tools/featureFlags',
    'next/navigation',
    'next/headers',
    '@/lib/auth',
    '@/lib/prisma',
    '@/lib/engagement',
    '@/lib/firebase',
    'firebase/firestore',
  ]) {
    vi.doUnmock(mocked);
  }
});

async function expectNotFound(page: PageModule, props?: unknown) {
  await expect(Promise.resolve().then(() => page.default(props))).rejects.toThrow('notFound');
  expect(notFound).toHaveBeenCalledOnce();
}

describe('community pages (community also needs accounts)', () => {
  const communityRoutes = [
    { name: 'community', module: '@/app/(learning)/community/page' },
    { name: 'community test page', module: '@/app/(learning)/community/test-page/page' },
    { name: 'community post', module: '@/app/(learning)/community/post/[postId]/page' },
  ];
  const postProps = { params: { postId: 'post-1' } };

  communityRoutes.forEach(({ name, module }) => {
    it(`${name} calls notFound when community is off`, async () => {
      const page = await loadRoute<PageModule>(module, { flags: { community: false }, defaultValue: true });
      await expectNotFound(page, postProps);
    });

    it(`${name} calls notFound when community is on but accountUI is off`, async () => {
      const page = await loadRoute<PageModule>(module, { flags: { community: true, accountUI: false }, defaultValue: true });
      await expectNotFound(page, postProps);
    });
  });

  it('community renders when community and accountUI are both on', async () => {
    const page = await loadRoute<PageModule>('@/app/(learning)/community/page', {
      flags: { community: true, accountUI: true },
    });
    const element = await page.default();
    expect(element).toBeDefined();
    expect(notFound).not.toHaveBeenCalled();
  });

  it('community test page renders when community and accountUI are both on', async () => {
    const page = await loadRoute<PageModule>('@/app/(learning)/community/test-page/page', {
      flags: { community: true, accountUI: true },
    });
    const element = await page.default();
    expect(element).toBeDefined();
    expect(notFound).not.toHaveBeenCalled();
  });

  it('community post looks the post up when community and accountUI are both on, and 404s a missing one', async () => {
    const getDoc = vi.fn(async () => ({ exists: () => false }));
    vi.doMock('@/lib/firebase', () => ({ db: {} }));
    vi.doMock('firebase/firestore', () => ({ doc: vi.fn(() => 'posts/post-1'), getDoc }));
    const page = await loadRoute<PageModule>('@/app/(learning)/community/post/[postId]/page', {
      flags: { community: true, accountUI: true },
    });
    await expectNotFound(page, postProps);
    expect(getDoc).toHaveBeenCalledOnce();
  });
});

describe('notifications page (accounts only)', () => {
  const engagementResponse = {
    algorithmVersion: 'engagement-v1',
    metrics: {
      dailyStreak: 1,
      weeklyActiveDays: 1,
      lessonsCompleted: 1,
      challengesAttempted: 0,
      timeSpentMinutes: 20,
    },
    activityHistory: [
      {
        id: 'lesson-1',
        userId: 'user-1',
        type: 'lesson_completed',
        timestamp: '2026-07-18T10:00:00.000Z',
        details: { lesson: 'UVM Basics' },
      },
    ],
    motivationalProfile: null,
    goals: [],
    mentorMessage: 'Keep going.',
    activityChart: [],
    patterns: {
      mostActiveDay: 'Saturday',
      preferredTopic: 'UVM Basics',
      learningStyle: 'steady-progress',
    },
  };

  /** The runtime environment src/server/persistence-gate.ts needs, besides the accountUI build flag. */
  function stubServerPersistence(configured: boolean) {
    vi.stubEnv('DATABASE_URL', configured ? 'postgres://user:pass@db.invalid:5432/app' : '');
    vi.stubEnv('GOOGLE_CLIENT_ID', configured ? 'google-client-id' : '');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', configured ? 'google-client-secret' : '');
    vi.stubEnv('NEXTAUTH_SECRET', configured ? 'a-nextauth-secret-of-at-least-32-characters' : '');
    vi.stubEnv('SESSION_SECRET', '');
    vi.stubEnv('AUTH_TEST_MODE', 'false');
  }

  function mockAccountBackends(requireSession: () => Promise<unknown>, { configured = true } = {}) {
    stubServerPersistence(configured);
    const cookies = vi.fn(() => ({ get: () => undefined }));
    const findUnique = vi.fn().mockResolvedValue({ preferences: null, timeZone: 'UTC' });
    const buildEngagementResponse = vi.fn().mockResolvedValue(engagementResponse);
    const requireSessionMock = vi.fn(requireSession);
    vi.doMock('next/headers', () => ({ cookies }));
    vi.doMock('@/lib/auth', () => ({ requireSession: requireSessionMock }));
    vi.doMock('@/lib/prisma', () => ({ prisma: { user: { findUnique } } }));
    vi.doMock('@/lib/engagement', () => ({ buildEngagementResponse }));
    return { cookies, requireSession: requireSessionMock, findUnique, buildEngagementResponse };
  }

  it('is static: no force-dynamic, so with accounts off it prerenders as a 404', async () => {
    const page = await loadRoute<PageModule>('@/app/(learning)/notifications/page');
    expect(page.dynamic).toBeUndefined();
  });

  it('calls notFound when accountUI is off, before reading cookies or loading the account', async () => {
    const backends = mockAccountBackends(async () => ({ user: { id: 'user-1' } }));
    const page = await loadRoute<PageModule>('@/app/(learning)/notifications/page', {
      flags: { accountUI: false },
      defaultValue: true,
    });
    await expectNotFound(page);
    expect(backends.cookies).not.toHaveBeenCalled();
    expect(backends.findUnique).not.toHaveBeenCalled();
    expect(backends.buildEngagementResponse).not.toHaveBeenCalled();
  });

  it('renders the full feed for a signed-in learner when accountUI is on', async () => {
    const backends = mockAccountBackends(async () => ({ user: { id: 'user-1' } }));
    const page = await loadRoute<PageModule>('@/app/(learning)/notifications/page', {
      flags: { accountUI: true },
    });

    const element = await page.default();
    render(element);

    expect(backends.cookies).toHaveBeenCalledOnce();
    expect(backends.buildEngagementResponse).toHaveBeenCalledWith('user-1', expect.any(Date), 'UTC');
    expect(screen.getByRole('heading', { level: 1, name: 'Notifications' })).toBeInTheDocument();
    expect(screen.getByText(/Nice work finishing UVM Basics/i)).toBeInTheDocument();
    expect(screen.queryByText(/Notifications will launch/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Sign in to see your notifications.')).not.toBeInTheDocument();
    expect(notFound).not.toHaveBeenCalled();
  });

  it('asks a signed-out visitor to sign in, and comes back to /notifications', async () => {
    const backends = mockAccountBackends(async () => {
      const error = new Error('Authentication required');
      error.name = 'AuthenticationError';
      throw error;
    });
    const page = await loadRoute<PageModule>('@/app/(learning)/notifications/page', {
      flags: { accountUI: true },
    });

    render(await page.default());

    expect(screen.getByText('Sign in to see your notifications.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/api/auth/signin?callbackUrl=%2Fnotifications',
    );
    expect(screen.queryByText(/will launch/i)).not.toBeInTheDocument();
    expect(backends.findUnique).not.toHaveBeenCalled();
    expect(backends.buildEngagementResponse).not.toHaveBeenCalled();
  });

  it('offers no Sign in link on a half-configured deploy, where /api/auth/signin answers 404', async () => {
    const backends = mockAccountBackends(async () => ({ user: { id: 'user-1' } }), { configured: false });
    const page = await loadRoute<PageModule>('@/app/(learning)/notifications/page', {
      flags: { accountUI: true },
    });

    render(await page.default());

    // Still a per-request render: the gate reads the runtime environment.
    expect(backends.cookies).toHaveBeenCalledOnce();
    expect(screen.getByRole('heading', { level: 1, name: 'Notifications' })).toBeInTheDocument();
    expect(screen.getByText(/Sign-in is not available on this site yet/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open your dashboard' })).toHaveAttribute('href', '/dashboard');
    expect(backends.requireSession).not.toHaveBeenCalled();
    expect(backends.findUnique).not.toHaveBeenCalled();
    expect(backends.buildEngagementResponse).not.toHaveBeenCalled();
    expect(notFound).not.toHaveBeenCalled();
  });

  it('says the feed could not be loaded, as visible text, when the account lookup fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const backends = mockAccountBackends(async () => ({ user: { id: 'user-1' } }));
    backends.findUnique.mockRejectedValueOnce(new Error('database unavailable'));
    const page = await loadRoute<PageModule>('@/app/(learning)/notifications/page', {
      flags: { accountUI: true },
    });

    render(await page.default());

    expect(screen.getByText('Your notifications could not be loaded. Try again in a moment.')).toBeInTheDocument();
    expect(screen.queryByText('Sign in to see your notifications.')).not.toBeInTheDocument();
    expect(backends.buildEngagementResponse).not.toHaveBeenCalled();
  });
});

describe('draft pages (personalization means draft preview only)', () => {
  const draftRoutes = [
    { name: 'projects', module: '@/app/(learning)/projects/page', heading: 'Practical Projects & Case Studies' },
    { name: 'history', module: '@/app/(learning)/history/page', heading: 'History of SystemVerilog & UVM' },
    { name: 'resources', module: '@/app/(learning)/resources/page', heading: 'Resources' },
  ];

  draftRoutes.forEach(({ name, module, heading }) => {
    it(`${name} calls notFound when personalization is off`, async () => {
      const page = await loadRoute<PageModule>(module, { flags: { personalization: false }, defaultValue: true });
      await expectNotFound(page);
    });

    it(`${name} renders its draft when personalization is on, and is a static page`, async () => {
      const page = await loadRoute<PageModule>(module, { flags: { personalization: true } });
      expect(page.dynamic).toBeUndefined();

      render(await page.default());

      expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
      expect(notFound).not.toHaveBeenCalled();
    });
  });

  it('history no longer depends on the tracking flag, a session or stored preferences', async () => {
    const page = await loadRoute<PageModule>('@/app/(learning)/history/page', {
      flags: { personalization: true, tracking: false, accountUI: false },
    });
    render(await page.default());
    expect(screen.getByText('Interactive Timeline of SV & UVM Evolution')).toBeInTheDocument();
    expect(screen.queryByText(/history module is paused/i)).not.toBeInTheDocument();
  });
});

describe('assessment center (tracking means draft preview only)', () => {
  it('calls notFound when tracking is off', async () => {
    const page = await loadRoute<PageModule>('@/app/(learning)/assessment/page', {
      flags: { tracking: false },
      defaultValue: true,
    });
    await expectNotFound(page);
  });

  it('renders the assessment center when tracking is on', async () => {
    const page = await loadRoute<PageModule>('@/app/(learning)/assessment/page', { flags: { tracking: true } });
    const element = await page.default();
    expect(element).toBeDefined();
    expect(notFound).not.toHaveBeenCalled();
  });
});
