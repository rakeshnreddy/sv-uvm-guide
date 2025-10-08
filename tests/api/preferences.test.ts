import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GET, PATCH } from '@/app/api/preferences/route';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@/lib/notifications';
import { cloneNotificationPreferences } from '@/lib/user-preferences';

const getSession = vi.fn();

vi.mock('@/lib/session', () => ({
  getSession: () => getSession(),
}));

describe('api/preferences route', () => {
  beforeEach(() => {
    getSession.mockReset();
  });

  it('returns normalized preferences on GET', async () => {
    const customPreferences = {
      theme: 'light',
      notifications: {
        channels: {
          email: false,
        },
      },
    };

    getSession.mockResolvedValue({
      userId: 'demo-user',
      preferences: customPreferences,
      save: vi.fn(),
    });

    const response = await GET();
    const payload = await response.json();

    expect(payload.preferences.theme).toBe('light');
    expect(payload.preferences.notifications.channels.email).toBe(false);
    expect(payload.preferences.notifications.channels.inApp).toBe(true);
  });

  it('merges PATCH payload and persists session', async () => {
    const save = vi.fn();
    const basePreferences = {
      theme: 'dark',
      shareTelemetry: true,
      notifications: cloneNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES),
    };

    getSession.mockResolvedValue({
      userId: 'demo-user',
      preferences: basePreferences,
      save,
    });

    const request = new Request('http://localhost/api/preferences', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        preferences: {
          theme: 'light',
          notifications: {
            channels: {
              email: false,
            },
            quietHours: null,
          },
        },
      }),
    });

    const response = await PATCH(request);
    const payload = await response.json();

    expect(save).toHaveBeenCalledOnce();
    expect(payload.preferences.theme).toBe('light');
    expect(payload.preferences.notifications.channels.email).toBe(false);
    expect(payload.preferences.notifications.channels.inApp).toBe(true);
    expect(payload.preferences.notifications.quietHours).toBeUndefined();
  });
});
