import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const modulePath = '@/tools/featureFlags';

async function importFeatureFlags() {
  return import(modulePath);
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

    expect(isFeatureEnabled('community')).toBe(false);
    expect(isFeatureEnabled('tracking')).toBe(false);
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

  it('forces all flags on when FEATURE_FLAGS_FORCE_ON is truthy', async () => {
    vi.stubEnv('FEATURE_FLAGS_FORCE_ON', 'true');

    const { isFeatureEnabled, featureFlags } = await importFeatureFlags();

    expect(isFeatureEnabled('tracking')).toBe(true);
    expect(featureFlags.accountUI).toBe(true);
  });
});
