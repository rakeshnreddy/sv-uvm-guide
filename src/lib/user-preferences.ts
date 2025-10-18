import { DEFAULT_NOTIFICATION_PREFERENCES, type NotificationPreferences } from '@/lib/notifications';

export interface UserPreferences {
  theme: 'dark' | 'light';
  shareTelemetry: boolean;
  notifications: NotificationPreferences;
}

export type PartialNotificationPreferences = Partial<
  Omit<NotificationPreferences, 'categories' | 'channels' | 'quietHours'>
> & {
  categories?: Partial<NotificationPreferences['categories']>;
  channels?: Partial<NotificationPreferences['channels']>;
  quietHours?: NotificationPreferences['quietHours'] | null;
};

export type PartialUserPreferences = Partial<Omit<UserPreferences, 'notifications'>> & {
  notifications?: PartialNotificationPreferences;
};

export function cloneNotificationPreferences(pref: NotificationPreferences): NotificationPreferences {
  return {
    ...pref,
    categories: { ...pref.categories },
    channels: { ...pref.channels },
    quietHours: pref.quietHours ? { ...pref.quietHours } : undefined,
  };
}

export function mergeNotificationPreferences(
  base: NotificationPreferences,
  updates?: PartialNotificationPreferences,
): NotificationPreferences {
  const result = cloneNotificationPreferences(base);

  if (!updates) {
    return result;
  }

  if (updates.categories) {
    result.categories = {
      ...result.categories,
      ...updates.categories,
    };
  }

  if (updates.channels) {
    result.channels = {
      ...result.channels,
      ...updates.channels,
    };
  }

  if (updates.digest) {
    result.digest = updates.digest;
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'quietHours')) {
    if (updates.quietHours === null) {
      result.quietHours = undefined;
    } else if (updates.quietHours) {
      result.quietHours = { ...updates.quietHours };
    } else {
      result.quietHours = undefined;
    }
  }

  return result;
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  theme: 'dark',
  shareTelemetry: false,
  notifications: cloneNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES),
};

export function mergeUserPreferences(
  base: UserPreferences,
  updates: PartialUserPreferences,
): UserPreferences {
  return {
    theme: updates.theme ?? base.theme,
    shareTelemetry: updates.shareTelemetry ?? base.shareTelemetry,
    notifications: updates.notifications
      ? mergeNotificationPreferences(base.notifications, updates.notifications)
      : cloneNotificationPreferences(base.notifications),
  };
}

export function normalizeUserPreferences(
  stored: PartialUserPreferences | UserPreferences | null | undefined,
  baseNotificationPreferences: NotificationPreferences = DEFAULT_NOTIFICATION_PREFERENCES,
): UserPreferences {
  const base: UserPreferences = {
    theme: DEFAULT_USER_PREFERENCES.theme,
    shareTelemetry: DEFAULT_USER_PREFERENCES.shareTelemetry,
    notifications: cloneNotificationPreferences(baseNotificationPreferences),
  };

  if (!stored) {
    return base;
  }

  return mergeUserPreferences(base, stored);
}
