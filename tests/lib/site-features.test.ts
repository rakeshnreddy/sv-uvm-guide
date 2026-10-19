import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function importSwitches() {
  const [{ SITE_FEATURES }, accounts] = await Promise.all([
    import('@/lib/site-features'),
    import('@/lib/persistence/accounts'),
  ]);
  return { SITE_FEATURES, ...accounts };
}

describe('SITE_FEATURES and the account switches', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('shows the learner pages and hides every account-only feature with the default env', async () => {
    const { SITE_FEATURES, ACCOUNTS_ENABLED, SERVER_SYNC_READY } = await importSwitches();

    expect(ACCOUNTS_ENABLED).toBe(false);
    expect(SERVER_SYNC_READY).toBe(false);
    expect(SITE_FEATURES).toEqual({
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
    });
    expect(Object.isFrozen(SITE_FEATURES)).toBe(true);
  });

  it('ignores FEATURE_FLAGS_FORCE_ON', async () => {
    vi.stubEnv('FEATURE_FLAGS_FORCE_ON', 'true');

    const { SITE_FEATURES, ACCOUNTS_ENABLED } = await importSwitches();

    expect(ACCOUNTS_ENABLED).toBe(false);
    expect(SITE_FEATURES.accounts).toBe(false);
    expect(SITE_FEATURES.community).toBe(false);
    expect(SITE_FEATURES.aiTutor).toBe(false);
    expect(SITE_FEATURES.simulation).toBe(false);
    expect(SITE_FEATURES.draftPages).toBe(false);
    expect(SITE_FEATURES.assessmentCenter).toBe(false);
  });

  it('keeps community, aiTutor and simulation off without accounts, even with their own flags on', async () => {
    vi.stubEnv('NEXT_PUBLIC_FEATURE_FLAG_COMMUNITY', 'true');
    vi.stubEnv('NEXT_PUBLIC_FEATURE_FLAG_AI_TUTOR', 'true');
    vi.stubEnv('NEXT_PUBLIC_FEATURE_FLAG_SIMULATION', 'true');

    const { SITE_FEATURES } = await importSwitches();

    expect(SITE_FEATURES.accounts).toBe(false);
    expect(SITE_FEATURES.community).toBe(false);
    expect(SITE_FEATURES.aiTutor).toBe(false);
    expect(SITE_FEATURES.simulation).toBe(false);
  });

  it('turns community, aiTutor and simulation on only with accountUI as well', async () => {
    vi.stubEnv('NEXT_PUBLIC_FEATURE_FLAG_ACCOUNT_UI', 'true');
    vi.stubEnv('NEXT_PUBLIC_FEATURE_FLAG_COMMUNITY', 'true');
    vi.stubEnv('NEXT_PUBLIC_FEATURE_FLAG_AI_TUTOR', 'true');
    vi.stubEnv('NEXT_PUBLIC_FEATURE_FLAG_SIMULATION', 'true');

    const { SITE_FEATURES, ACCOUNTS_ENABLED, SERVER_SYNC_READY } = await importSwitches();

    expect(ACCOUNTS_ENABLED).toBe(true);
    expect(SERVER_SYNC_READY).toBe(false);
    expect(SITE_FEATURES.accounts).toBe(true);
    expect(SITE_FEATURES.community).toBe(true);
    expect(SITE_FEATURES.aiTutor).toBe(true);
    expect(SITE_FEATURES.simulation).toBe(true);
  });

  it('turns accounts on alone without the other account-only features', async () => {
    vi.stubEnv('NEXT_PUBLIC_FEATURE_FLAG_ACCOUNT_UI', 'true');

    const { SITE_FEATURES } = await importSwitches();

    expect(SITE_FEATURES.accounts).toBe(true);
    expect(SITE_FEATURES.community).toBe(false);
    expect(SITE_FEATURES.aiTutor).toBe(false);
    expect(SITE_FEATURES.simulation).toBe(false);
  });

  it('maps personalization to draft pages and tracking to the assessment center', async () => {
    vi.stubEnv('NEXT_PUBLIC_FEATURE_FLAG_PERSONALIZATION', 'true');
    vi.stubEnv('NEXT_PUBLIC_FEATURE_FLAG_TRACKING', 'true');

    const { SITE_FEATURES } = await importSwitches();

    expect(SITE_FEATURES.draftPages).toBe(true);
    expect(SITE_FEATURES.assessmentCenter).toBe(true);
    expect(SITE_FEATURES.accounts).toBe(false);
  });

  it('computes the switches with isFeatureEnabled, not the featureFlags object', async () => {
    vi.doMock('@/tools/featureFlags', () => ({
      isFeatureEnabled: (flag: string) => flag === 'accountUI' || flag === 'aiTutor',
      featureFlags: Object.freeze({}),
    }));
    try {
      const { SITE_FEATURES, ACCOUNTS_ENABLED } = await importSwitches();

      expect(ACCOUNTS_ENABLED).toBe(true);
      expect(SITE_FEATURES.aiTutor).toBe(true);
      expect(SITE_FEATURES.simulation).toBe(false);
    } finally {
      vi.doUnmock('@/tools/featureFlags');
    }
  });
});
