import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const modulePath = '@/tools/featureFlags';

async function importFeatureFlags() {
  return import(modulePath) as Promise<typeof import('@/tools/featureFlags')>;
}

describe('featureFlags', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults every flag to false when no overrides exist', async () => {
    const { featureFlags, isFeatureEnabled } = await importFeatureFlags();

    expect(featureFlags.community).toBe(false);
    expect(featureFlags.tracking).toBe(false);
    expect(featureFlags.personalization).toBe(false);
    expect(featureFlags.fakeComments).toBe(false);
    expect(featureFlags.accountUI).toBe(false);
    expect(featureFlags.aiTutor).toBe(false);
    expect(featureFlags.simulation).toBe(false);

    expect(isFeatureEnabled('community')).toBe(false);
    expect(isFeatureEnabled('tracking')).toBe(false);
    expect(isFeatureEnabled('aiTutor')).toBe(false);
    expect(isFeatureEnabled('simulation')).toBe(false);
  });

  it('honours environment overrides using flexible truthy/falsey values', async () => {
    vi.stubEnv('NEXT_PUBLIC_FEATURE_FLAG_COMMUNITY', 'enabled');
    vi.stubEnv('NEXT_PUBLIC_FEATURE_FLAG_TRACKING', '0');

    const { isFeatureEnabled, featureFlags } = await importFeatureFlags();

    expect(isFeatureEnabled('community')).toBe(true);
    expect(isFeatureEnabled('tracking')).toBe(false);
    expect(featureFlags.community).toBe(true);
    expect(featureFlags.tracking).toBe(false);
  });

  it('ignores invalid environment values and falls back to defaults', async () => {
    vi.stubEnv('NEXT_PUBLIC_FEATURE_FLAG_PERSONALIZATION', 'maybe');

    const { isFeatureEnabled } = await importFeatureFlags();

    expect(isFeatureEnabled('personalization')).toBe(false);
  });

  it('turns aiTutor and simulation on from their own NEXT_PUBLIC variables', async () => {
    vi.stubEnv('NEXT_PUBLIC_FEATURE_FLAG_AI_TUTOR', 'true');
    vi.stubEnv('NEXT_PUBLIC_FEATURE_FLAG_SIMULATION', ' Yes ');

    const { isFeatureEnabled, featureFlags } = await importFeatureFlags();

    expect(isFeatureEnabled('aiTutor')).toBe(true);
    expect(isFeatureEnabled('simulation')).toBe(true);
    expect(featureFlags.aiTutor).toBe(true);
    expect(featureFlags.simulation).toBe(true);
    expect(featureFlags.accountUI).toBe(false);
  });

  it('keeps aiTutor and simulation off when their variables say so', async () => {
    vi.stubEnv('NEXT_PUBLIC_FEATURE_FLAG_AI_TUTOR', 'off');
    vi.stubEnv('NEXT_PUBLIC_FEATURE_FLAG_SIMULATION', 'false');

    const { isFeatureEnabled } = await importFeatureFlags();

    expect(isFeatureEnabled('aiTutor')).toBe(false);
    expect(isFeatureEnabled('simulation')).toBe(false);
  });

  it('ignores FEATURE_FLAGS_FORCE_ON: the browser never sees it, so the server must not either', async () => {
    vi.stubEnv('FEATURE_FLAGS_FORCE_ON', 'true');

    const { isFeatureEnabled, featureFlags } = await importFeatureFlags();

    expect(isFeatureEnabled('tracking')).toBe(false);
    expect(isFeatureEnabled('accountUI')).toBe(false);
    expect(Object.values(featureFlags).every((value) => value === false)).toBe(true);
  });

  it('agrees between isFeatureEnabled and the frozen featureFlags object', async () => {
    vi.stubEnv('NEXT_PUBLIC_FEATURE_FLAG_ACCOUNT_UI', '1');

    const { isFeatureEnabled, featureFlags } = await importFeatureFlags();

    expect(Object.isFrozen(featureFlags)).toBe(true);
    for (const [flag, value] of Object.entries(featureFlags)) {
      expect(isFeatureEnabled(flag as keyof typeof featureFlags)).toBe(value);
    }
    expect(featureFlags.accountUI).toBe(true);
  });
});
