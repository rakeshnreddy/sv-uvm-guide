/**
 * Build-time feature flags.
 *
 * Every override is a NEXT_PUBLIC_FEATURE_FLAG_* variable read by its full
 * name (`process.env.NEXT_PUBLIC_...`), so Next inlines the same value into
 * the server render, the client bundle and /api/feature-flags, and hydration
 * always agrees. There is no global force-on override: a variable without the
 * NEXT_PUBLIC_ prefix never reaches the browser, so it would make the server
 * render and hydration disagree.
 *
 * Pages and components read switches through SITE_FEATURES
 * (src/lib/site-features.ts) or ACCOUNTS_ENABLED / SERVER_SYNC_READY
 * (src/lib/persistence/accounts.ts), never from this module directly.
 */
const defaultFlags = {
  community: false,
  tracking: false,
  personalization: false,
  fakeComments: false,
  accountUI: false,
  aiTutor: false,
  simulation: false,
} as const;

export type FeatureFlag = keyof typeof defaultFlags;

function parseBooleanFlag(value: string | undefined): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'on', 'yes', 'enabled'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'off', 'no', 'disabled'].includes(normalized)) {
    return false;
  }

  return undefined;
}

// Each variable is spelled out in full: Next only inlines direct
// `process.env.NEXT_PUBLIC_...` accesses into client code.
const environmentOverrides: Partial<Record<FeatureFlag, boolean>> = {
  community: parseBooleanFlag(process.env.NEXT_PUBLIC_FEATURE_FLAG_COMMUNITY),
  tracking: parseBooleanFlag(process.env.NEXT_PUBLIC_FEATURE_FLAG_TRACKING),
  personalization: parseBooleanFlag(process.env.NEXT_PUBLIC_FEATURE_FLAG_PERSONALIZATION),
  fakeComments: parseBooleanFlag(process.env.NEXT_PUBLIC_FEATURE_FLAG_FAKE_COMMENTS),
  accountUI: parseBooleanFlag(process.env.NEXT_PUBLIC_FEATURE_FLAG_ACCOUNT_UI),
  aiTutor: parseBooleanFlag(process.env.NEXT_PUBLIC_FEATURE_FLAG_AI_TUTOR),
  simulation: parseBooleanFlag(process.env.NEXT_PUBLIC_FEATURE_FLAG_SIMULATION),
};

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  const override = environmentOverrides[flag];
  if (override !== undefined) {
    return override;
  }

  return defaultFlags[flag];
}

export const featureFlags: Readonly<Record<FeatureFlag, boolean>> = Object.freeze({
  community: isFeatureEnabled('community'),
  tracking: isFeatureEnabled('tracking'),
  personalization: isFeatureEnabled('personalization'),
  fakeComments: isFeatureEnabled('fakeComments'),
  accountUI: isFeatureEnabled('accountUI'),
  aiTutor: isFeatureEnabled('aiTutor'),
  simulation: isFeatureEnabled('simulation'),
});
