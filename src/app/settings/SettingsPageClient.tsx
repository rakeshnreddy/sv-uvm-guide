"use client";

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { NOTIFICATION_CATEGORY_META } from '@/lib/notifications';
import {
  mergeUserPreferences,
  type UserPreferences,
  type PartialUserPreferences,
} from '@/lib/user-preferences';
import { cn } from '@/lib/utils';

interface SettingsPageClientProps {
  initialPreferences: UserPreferences;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const STATUS_LABEL: Record<SaveStatus, string> = {
  idle: '',
  saving: 'Saving preferences…',
  saved: 'Preferences saved',
  error: 'Failed to save preferences',
};

export default function SettingsPageClient({ initialPreferences }: SettingsPageClientProps) {
  const [preferences, setPreferences] = useState<UserPreferences>(initialPreferences);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setPreferences(initialPreferences);
  }, [initialPreferences]);

  const emailUpdates = preferences.notifications.channels.email;
  const digestCadence = preferences.notifications.digest;
  const quietHours = preferences.notifications.quietHours;
  const categories = useMemo(() => Object.entries(preferences.notifications.categories), [
    preferences.notifications.categories,
  ]);

  const persistPreferences = (next: UserPreferences) => {
    setStatus('saving');
    setErrorMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch('/api/preferences', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ preferences: next }),
        });

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const payload = (await response.json()) as { preferences?: UserPreferences };
        if (payload?.preferences) {
          setPreferences(payload.preferences);
        }

        setStatus('saved');
        setTimeout(() => setStatus('idle'), 2000);
      } catch (error) {
        setStatus('error');
        setErrorMessage('Unable to save preferences right now. Please retry.');
        console.error('settings: persistPreferences failed', error);
      }
    });
  };

  const applyUpdate = (partial: PartialUserPreferences) => {
    setPreferences((previous) => {
      const next = mergeUserPreferences(previous, partial);
      persistPreferences(next);
      return next;
    });
  };

  const toggleTheme = () => {
    applyUpdate({ theme: preferences.theme === 'dark' ? 'light' : 'dark' });
  };

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

  const statusLabel = STATUS_LABEL[status];

  return (
    <div className="space-y-10" aria-busy={isPending}>
      <header className="glass-card border border-white/10 bg-[var(--blueprint-glass)] p-8 shadow-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-[var(--blueprint-foreground)]">Settings</h1>
            <p className="mt-2 text-sm text-[rgba(230,241,255,0.75)]">
              Tune preferences for appearance, communication, and data usage. Changes sync instantly across the dashboard.
            </p>
          </div>
          {statusLabel && (
            <div
              role="status"
              className={cn(
                'rounded-full border px-4 py-1 text-xs font-semibold backdrop-blur',
                status === 'error'
                  ? 'border-rose-300/40 text-rose-200'
                  : status === 'saved'
                    ? 'border-emerald-300/40 text-emerald-200'
                    : 'border-white/20 text-[rgba(230,241,255,0.7)]',
              )}
            >
              {status === 'error' && errorMessage ? errorMessage : statusLabel}
            </div>
          )}
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="glass-card border border-white/10 bg-[var(--blueprint-glass)] p-6">
          <h2 className="text-xl font-semibold text-primary">Appearance</h2>
          <p className="mt-2 text-sm text-[rgba(230,241,255,0.75)]">Choose your default theme and interface density.</p>
          <div className="mt-6 flex items-center justify-between">
            <span className="text-sm text-[rgba(230,241,255,0.8)]">Enable dark interface</span>
            <button
              type="button"
              onClick={toggleTheme}
              aria-pressed={preferences.theme === 'dark'}
              className={cn(
                'w-14 rounded-full border border-white/15 bg-white/5 px-1 py-1 transition',
                preferences.theme === 'dark'
                  ? 'bg-[var(--blueprint-accent)]/40 text-white'
                  : 'text-[rgba(230,241,255,0.6)]',
              )}
            >
              <span
                className={cn(
                  'block h-6 w-6 rounded-full bg-white transition-transform',
                  preferences.theme === 'dark' ? 'translate-x-6' : 'translate-x-0',
                )}
              />
            </button>
          </div>
          <p className="mt-4 text-xs text-[rgba(230,241,255,0.55)]">
            Dark mode keeps the blueprint aesthetic. Switch to light mode if you prefer a higher-contrast reading experience.
          </p>
        </article>

        <article className="glass-card border border-white/10 bg-[var(--blueprint-glass)] p-6">
          <h2 className="text-xl font-semibold text-primary">Notifications</h2>
          <p className="mt-2 text-sm text-[rgba(230,241,255,0.75)]">Decide when we nudge you about streaks, reviews, and new labs.</p>
          <div className="mt-6 space-y-4">
            <button
              type="button"
              onClick={toggleEmailUpdates}
              aria-pressed={emailUpdates}
              className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-[rgba(230,241,255,0.8)] transition hover:bg-white/10"
            >
              Email updates about new modules
              <span className={`text-xs ${emailUpdates ? 'text-[var(--blueprint-accent)]' : 'text-[rgba(230,241,255,0.45)]'}`}>
                {emailUpdates ? 'On' : 'Off'}
              </span>
            </button>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[rgba(230,241,255,0.6)]">Digest cadence</p>
              <div className="mt-3 flex gap-2">
                {(['daily', 'weekly'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setDigest(option)}
                    className={cn(
                      'flex-1 rounded-full border px-4 py-2 text-sm transition',
                      digestCadence === option
                        ? 'border-[var(--blueprint-accent)]/60 bg-[var(--blueprint-accent)]/20 text-[var(--blueprint-accent)]'
                        : 'border-white/10 text-[rgba(230,241,255,0.7)] hover:border-white/20',
                    )}
                  >
                    {option === 'daily' ? 'Daily recap' : 'Weekly summary'}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[rgba(230,241,255,0.6)]">Categories</p>
              <div className="mt-3 space-y-2">
                {categories.map(([key, enabled]) => {
                  const meta = NOTIFICATION_CATEGORY_META[key as keyof typeof NOTIFICATION_CATEGORY_META];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleCategory(key, enabled)}
                      aria-pressed={enabled}
                      className={cn(
                        'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition',
                        enabled
                          ? 'border-[var(--blueprint-accent)]/50 bg-[var(--blueprint-accent)]/15 text-[var(--blueprint-accent)]'
                          : 'border-white/10 bg-transparent text-[rgba(230,241,255,0.7)] hover:border-white/20',
                      )}
                    >
                      <span>{meta?.label ?? key}</span>
                      <span className="text-xs">{enabled ? 'On' : 'Off'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="glass-card border border-white/10 bg-[var(--blueprint-glass)] p-6">
          <h2 className="text-xl font-semibold text-primary">Privacy & Data</h2>
          <p className="mt-2 text-sm text-[rgba(230,241,255,0.75)]">
            Control how we use engagement insights to personalize recommendations.
          </p>
          <button
            type="button"
            onClick={toggleTelemetry}
            aria-pressed={preferences.shareTelemetry}
            className="mt-6 flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-[rgba(230,241,255,0.8)] transition hover:bg-white/10"
          >
            Share anonymous telemetry to improve recommendations
            <span
              className={`text-xs ${preferences.shareTelemetry ? 'text-[var(--blueprint-accent)]' : 'text-[rgba(230,241,255,0.45)]'}`}
            >
              {preferences.shareTelemetry ? 'On' : 'Off'}
            </span>
          </button>

          <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[rgba(230,241,255,0.6)]">Quiet hours</p>
            <p className="mt-2 text-xs text-[rgba(230,241,255,0.7)]">
              {quietHours
                ? `Notifications pause between ${quietHours.start} and ${quietHours.end}.`
                : 'Quiet hours are disabled. Alerts arrive whenever activity happens.'}
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" size="sm" onClick={enableDefaultQuietHours}>
                Restore default window
              </Button>
              <Button variant="ghost" size="sm" onClick={disableQuietHours}>
                Disable
              </Button>
            </div>
          </div>
        </article>

        <article className="glass-card border border-white/10 bg-[var(--blueprint-glass)] p-6">
          <h2 className="text-xl font-semibold text-primary">Account Controls</h2>
          <p className="mt-2 text-sm text-[rgba(230,241,255,0.75)]">
            Export your learning records or deactivate the account when the project is complete.
          </p>
          <div className="mt-6 flex flex-wrap gap-4">
            <Button variant="outline">Export progress (CSV)</Button>
            <Button variant="outline">Request data deletion</Button>
            <Button variant="destructive">Deactivate account</Button>
          </div>
          <p className="mt-4 text-xs text-[rgba(230,241,255,0.55)]">
            These actions currently open support tickets; automated flows ship once the dashboard moves out of beta.
          </p>
        </article>
      </section>
    </div>
  );
}
