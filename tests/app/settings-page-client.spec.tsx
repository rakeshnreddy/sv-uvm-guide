import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsPageClient from '@/app/settings/SettingsPageClient';
import { cloneNotificationPreferences, DEFAULT_USER_PREFERENCES } from '@/lib/user-preferences';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@/lib/notifications';

const buildPreferences = () => ({
  ...DEFAULT_USER_PREFERENCES,
  notifications: cloneNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES),
});

describe('SettingsPageClient', () => {
  const user = userEvent.setup();
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('toggles email notifications and shows save status', async () => {
    const preferences = buildPreferences();
    const updatedPreferences = {
      ...preferences,
      notifications: {
        ...preferences.notifications,
        channels: {
          ...preferences.notifications.channels,
          email: false,
        },
      },
    };

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ preferences: updatedPreferences }),
    });
    global.fetch = fetchSpy as unknown as typeof fetch;

    render(<SettingsPageClient initialPreferences={preferences} />);

    const emailToggle = screen.getByRole('button', { name: /Email updates about new modules/i });
    await user.click(emailToggle);

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    const requestPayload = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(requestPayload.preferences.notifications.channels.email).toBe(false);

    await waitFor(() => expect(screen.getByText(/Preferences saved/i)).toBeVisible());
  });

  it('notifies when the server call fails', async () => {
    const preferences = buildPreferences();
    const fetchSpy = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    global.fetch = fetchSpy as unknown as typeof fetch;

    render(<SettingsPageClient initialPreferences={preferences} />);

    const telemetryToggle = screen.getByRole('button', { name: /Share anonymous telemetry/i });
    await user.click(telemetryToggle);

    await waitFor(() => expect(screen.getByText(/Unable to save preferences/i)).toBeVisible());
  });
});
// ensure components using the legacy JSX runtime can resolve React
(globalThis as typeof globalThis & { React?: typeof React }).React = React;
