const defaultFlags = {
  community: false,
  tracking: false,
  personalization: false,
  fakeComments: false,
  accountUI: false,
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

const globalOverride = parseBooleanFlag(process.env.FEATURE_FLAGS_FORCE_ON);

const environmentOverrides: Partial<Record<FeatureFlag, boolean>> = {
  community: parseBooleanFlag(process.env.NEXT_PUBLIC_FEATURE_FLAG_COMMUNITY),
  tracking: parseBooleanFlag(process.env.NEXT_PUBLIC_FEATURE_FLAG_TRACKING),
  personalization: parseBooleanFlag(process.env.NEXT_PUBLIC_FEATURE_FLAG_PERSONALIZATION),
  fakeComments: parseBooleanFlag(process.env.NEXT_PUBLIC_FEATURE_FLAG_FAKE_COMMENTS),
  accountUI: parseBooleanFlag(process.env.NEXT_PUBLIC_FEATURE_FLAG_ACCOUNT_UI),
};

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  if (globalOverride === true) {
    return true;
  }

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
});
