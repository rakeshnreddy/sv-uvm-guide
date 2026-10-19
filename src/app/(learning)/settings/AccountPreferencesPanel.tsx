"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { focusRing, secondaryAction } from '@/components/curriculum/overview-ui';
import { NOTIFICATION_CATEGORY_META } from '@/lib/notifications';
import {
  mergeUserPreferences,
  normalizeUserPreferences,
  type PartialUserPreferences,
  type UserPreferences,
} from '@/lib/user-preferences';
import { cn } from '@/lib/utils';

/**
 * Account preferences: notification categories, channels, digest, quiet hours
 * and telemetry, saved to the signed-in learner's account through
 * /api/me/preferences. SettingsPageClient renders this panel only while
 * useAccountSession().status is 'authenticated', so signed-out visitors and
 * the anonymous deploy never request the API.
 *
 * The initial preferences come from GET /api/me/preferences. Each change is
 * merged into the current preferences, shown at once, and sent as one PATCH,
 * started outside any setState updater so StrictMode cannot send it twice.
 */

type LoadState = 'loading' | 'ready' | 'error';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const STATUS_LABEL: Record<SaveStatus, string> = {
  idle: '',
  saving: 'Saving preferences…',
  saved: 'Preferences saved',
  error: 'Failed to save preferences',
};

const SAVE_ERROR_MESSAGE = 'Unable to save preferences right now. Please retry.';
const LOAD_ERROR_MESSAGE = 'Unable to load your preferences right now.';
const SAVED_STATUS_MS = 2000;

const card = 'min-w-0 rounded-3xl border border-border bg-card p-5 text-card-foreground shadow-sm sm:p-6';
const panel = 'min-w-0 rounded-2xl border border-border bg-background p-4';
const eyebrow = 'text-xs font-semibold uppercase tracking-wider text-muted-foreground';
const toggleRow = cn(
  'flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors motion-reduce:transition-none',
  focusRing,
);

function onOffClass(on: boolean): string {
  return on ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-background text-foreground hover:bg-muted';
}

export default function AccountPreferencesPanel() {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // The preferences as last applied, so quick successive changes build on each other.
  const latest = useRef<UserPreferences | null>(null);
  // Only the newest PATCH may update the panel; an older response that arrives late is ignored.
  const requestSeq = useRef(0);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoadState('loading');

    const load = async () => {
      try {
        const response = await fetch('/api/me/preferences', { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        const payload = (await response.json()) as { preferences?: PartialUserPreferences | null };
        if (controller.signal.aborted) return;
        const loaded = normalizeUserPreferences(payload?.preferences ?? null);
        latest.current = loaded;
        setPreferences(loaded);
        setLoadState('ready');
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error('settings: loading preferences failed', error);
        setLoadState('error');
      }
    };

    void load();
    return () => controller.abort();
  }, [loadAttempt]);

  const persistPreferences = useCallback(async (next: UserPreferences) => {
    const seq = ++requestSeq.current;
    if (savedTimer.current) clearTimeout(savedTimer.current);
    setStatus('saving');
    setErrorMessage(null);

    try {
      const response = await fetch('/api/me/preferences', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ preferences: next }),
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as { preferences?: PartialUserPreferences | null };
      if (!mounted.current || seq !== requestSeq.current) return;
      if (payload?.preferences) {
        const saved = normalizeUserPreferences(payload.preferences);
        latest.current = saved;
        setPreferences(saved);
      }

      setStatus('saved');
      savedTimer.current = setTimeout(() => {
        if (mounted.current) setStatus('idle');
      }, SAVED_STATUS_MS);
    } catch (error) {
      if (!mounted.current || seq !== requestSeq.current) return;
      setStatus('error');
      setErrorMessage(SAVE_ERROR_MESSAGE);
      console.error('settings: persistPreferences failed', error);
    }
  }, []);

  const applyUpdate = (partial: PartialUserPreferences) => {
    const current = latest.current;
    if (!current) return;
    const next = mergeUserPreferences(current, partial);
    latest.current = next;
    setPreferences(next);
    // Sent here, not inside a setState updater: StrictMode runs updaters twice.
    void persistPreferences(next);
  };

  const categories = useMemo(
    () => (preferences ? Object.entries(preferences.notifications.categories) : []),
    [preferences],
  );

  const statusLabel = STATUS_LABEL[status];

  const header = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h2 id="settings-account-heading" className="text-xl font-semibold text-foreground">
          Account preferences
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Saved to your account.</p>
      </div>
      <p
        role="status"
        aria-live="polite"
        className={cn(
          'text-sm font-medium',
          status === 'error' ? 'text-red-800 dark:text-red-200' : 'text-foreground',
        )}
      >
        {statusLabel ? (status === 'error' && errorMessage ? errorMessage : statusLabel) : null}
      </p>
    </div>
  );

  if (loadState !== 'ready' || !preferences) {
    return (
      <section aria-labelledby="settings-account-heading" className={card} aria-busy={loadState === 'loading'}>
        {header}
        {loadState === 'error' ? (
          <div className="mt-4 space-y-3">
            <p role="alert" className="text-sm font-medium text-red-800 dark:text-red-200">
              {LOAD_ERROR_MESSAGE}
            </p>
            <button type="button" className={secondaryAction} onClick={() => setLoadAttempt((attempt) => attempt + 1)}>
              Try again
            </button>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Loading your preferences…</p>
        )}
      </section>
    );
  }

  const emailUpdates = preferences.notifications.channels.email;
  const digestCadence = preferences.notifications.digest;
  const quietHours = preferences.notifications.quietHours;

  const toggleEmailUpdates = () => {
    applyUpdate({
      notifications: {
        channels: {
          email: !emailUpdates,
        },
      },
    });
  };

  const toggleCategory = (category: string, enabled: boolean) => {
    applyUpdate({
      notifications: {
        categories: {
          [category]: !enabled,
        },
      },
    });
  };

  const setDigest = (value: 'daily' | 'weekly') => {
    if (value === digestCadence) {
      return;
    }
    applyUpdate({
      notifications: {
        digest: value,
      },
    });
  };

  const toggleTelemetry = () => {
    applyUpdate({ shareTelemetry: !preferences.shareTelemetry });
  };

  const disableQuietHours = () => {
    if (!quietHours) {
      return;
    }
    applyUpdate({
      notifications: {
        quietHours: null,
      },
    });
  };

  const enableDefaultQuietHours = () => {
    applyUpdate({
      notifications: {
        quietHours: {
          start: '22:00',
          end: '06:00',
        },
      },
    });
  };

  return (
    <section aria-labelledby="settings-account-heading" className={card} aria-busy={status === 'saving'}>
      {header}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-foreground">Notifications</h3>
          <p className="mt-1 text-sm text-muted-foreground">Decide when we nudge you about streaks, reviews, and new labs.</p>
          <div className="mt-4 space-y-4">
            <button
              type="button"
              onClick={toggleEmailUpdates}
              aria-pressed={emailUpdates}
              className={cn(toggleRow, onOffClass(emailUpdates))}
            >
              Email updates about new modules
              <span className="text-xs text-muted-foreground">{emailUpdates ? 'On' : 'Off'}</span>
            </button>

            <div className={panel}>
              <p className={eyebrow}>Digest cadence</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                {(['daily', 'weekly'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setDigest(option)}
                    aria-pressed={digestCadence === option}
                    className={cn(
                      'min-h-[44px] flex-1 rounded-full border px-4 py-2 text-sm transition-colors motion-reduce:transition-none',
                      focusRing,
                      onOffClass(digestCadence === option),
                    )}
                  >
                    {option === 'daily' ? 'Daily recap' : 'Weekly summary'}
                  </button>
                ))}
              </div>
            </div>

            <div className={panel}>
              <p className={eyebrow}>Categories</p>
              <div className="mt-3 space-y-2">
                {categories.map(([key, enabled]) => {
                  const meta = NOTIFICATION_CATEGORY_META[key as keyof typeof NOTIFICATION_CATEGORY_META];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleCategory(key, enabled)}
                      aria-pressed={enabled}
                      className={cn(toggleRow, 'rounded-lg px-3 py-2', onOffClass(enabled))}
                    >
                      <span>{meta?.label ?? key}</span>
                      <span className="text-xs text-muted-foreground">{enabled ? 'On' : 'Off'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-foreground">Privacy & Data</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Control how we use engagement insights to personalize recommendations.
          </p>
          <button
            type="button"
            onClick={toggleTelemetry}
            aria-pressed={preferences.shareTelemetry}
            className={cn(toggleRow, 'mt-4', onOffClass(preferences.shareTelemetry))}
          >
            Share anonymous telemetry to improve recommendations
            <span className="text-xs text-muted-foreground">{preferences.shareTelemetry ? 'On' : 'Off'}</span>
          </button>

          <div className={cn(panel, 'mt-4')}>
            <p className={eyebrow}>Quiet hours</p>
            <p className="mt-2 text-sm text-foreground">
              {quietHours
                ? `Notifications pause between ${quietHours.start} and ${quietHours.end}.`
                : 'Quiet hours are disabled. Alerts arrive whenever activity happens.'}
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button type="button" className={secondaryAction} onClick={enableDefaultQuietHours}>
                Restore default window
              </button>
              <button type="button" className={secondaryAction} onClick={disableQuietHours}>
                Disable
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
