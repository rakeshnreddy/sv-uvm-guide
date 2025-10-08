import { describe, expect, it } from 'vitest';
import {
  DEFAULT_USER_PREFERENCES,
  mergeNotificationPreferences,
  mergeUserPreferences,
  normalizeUserPreferences,
} from '@/lib/user-preferences';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@/lib/notifications';

describe('mergeNotificationPreferences', () => {
  it('updates nested channel preferences without mutating the base object', () => {
    const base = mergeNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
    const merged = mergeNotificationPreferences(base, { channels: { email: false } });

    expect(merged.channels.email).toBe(false);
    expect(merged.channels.inApp).toBe(true);
    expect(base.channels.email).toBe(true);
  });

  it('removes quiet hours when passed a null override', () => {
    const base = mergeNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
    const merged = mergeNotificationPreferences(base, { quietHours: null });

    expect(merged.quietHours).toBeUndefined();
    expect(base.quietHours).toBeDefined();
  });
});

describe('mergeUserPreferences', () => {
  it('applies partial updates while keeping existing values intact', () => {
    const updated = mergeUserPreferences(DEFAULT_USER_PREFERENCES, {
      theme: 'light',
      notifications: {
        categories: {
          community: true,
        },
      },
    });

    expect(updated.theme).toBe('light');
    expect(updated.notifications.categories.community).toBe(true);
    expect(updated.notifications.categories.progress).toBe(true);
    expect(DEFAULT_USER_PREFERENCES.theme).toBe('dark');
  });
});

describe('normalizeUserPreferences', () => {
  it('merges stored preferences with user-specific defaults', () => {
    const fallback = mergeNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES, {
      categories: {
        community: true,
      },
    });

    const stored = {
      theme: 'light' as const,
      notifications: {
        channels: {
          email: false,
        },
      },
    };

    const normalized = normalizeUserPreferences(stored, fallback);

    expect(normalized.theme).toBe('light');
    expect(normalized.notifications.channels.email).toBe(false);
    expect(normalized.notifications.categories.community).toBe(true);
    expect(normalized.notifications.channels.inApp).toBe(true);
  });
});
