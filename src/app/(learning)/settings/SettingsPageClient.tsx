"use client";

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

import { LearnerDataControls } from '@/components/learner/LearnerDataControls';
import { LearnerSectionNav } from '@/components/learner/LearnerSectionNav';
import { StorageStatusNote } from '@/components/learner/StorageStatusNote';
import { ThemeSwitcher } from '@/components/ui/ThemeSwitcher';
import { estimateLearnerDataBytes } from '@/lib/learner-store/backup';
import { LEARNER_DATA_CHANGED_EVENT } from '@/lib/learner-store/keys';
import { subscribeLearnerStore } from '@/lib/learner-store/record';
import { useAccountSession } from '@/lib/persistence/target';
import { cn } from '@/lib/utils';

// Loaded only once the session is authenticated: anonymous visitors of this static page never download the
// account code or its notification and preference libraries.
const AccountPreferencesPanel = dynamic(() => import('./AccountPreferencesPanel'), {
  ssr: false,
  loading: () => <p className="text-sm text-muted-foreground">Loading your preferences…</p>,
});

const card = 'min-w-0 rounded-3xl border border-border bg-card p-5 text-card-foreground shadow-sm sm:p-6';
const sectionHeading = 'text-xl font-semibold text-foreground sm:text-2xl';
const body = 'text-sm text-muted-foreground';

/** How long to wait after a write before measuring usage again. */
const REMEASURE_DELAY_MS = 500;

/** "less than 1 KB", "about 12 KB", "about 1.4 MB": a rough figure, since the estimate is itself approximate. */
export function formatStorageEstimate(bytes: number): string {
  if (bytes < 1024) return 'less than 1 KB';
  if (bytes < 1024 * 1024) return `about ${Math.round(bytes / 1024)} KB`;
  return `about ${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Estimated bytes of learner data, measured after mount and again whenever it changes; null until measured. */
function useLearnerDataBytes(): number | null {
  const [bytes, setBytes] = useState<number | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const measure = () => setBytes(estimateLearnerDataBytes());
    const scheduleMeasure = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(measure, REMEASURE_DELAY_MS);
    };
    measure();
    const unsubscribe = subscribeLearnerStore(scheduleMeasure);
    window.addEventListener(LEARNER_DATA_CHANGED_EVENT, measure);
    return () => {
      unsubscribe();
      window.removeEventListener(LEARNER_DATA_CHANGED_EVENT, measure);
      if (timer !== undefined) clearTimeout(timer);
    };
  }, []);

  return bytes;
}

/**
 * Settings: the theme, and the learning data this browser keeps (where it
 * lives, how much there is, backup, restore and delete). Static: nothing here
 * requests the server. Account preferences appear only for a signed-in learner
 * while accounts are on.
 */
export default function SettingsPageClient() {
  const { status } = useAccountSession();
  const bytes = useLearnerDataBytes();

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 pb-16">
      <header className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl">Settings</h1>
          <p className="mt-2 max-w-3xl text-base text-muted-foreground">
            Your theme, and the learning data saved in this browser.
          </p>
        </div>
        <LearnerSectionNav current="settings" />
      </header>

      <section aria-labelledby="settings-appearance-heading" className={card}>
        <h2 id="settings-appearance-heading" className={sectionHeading}>
          Appearance
        </h2>
        <p className={cn(body, 'mt-2 max-w-3xl')}>
          Pick a colour theme and switch between light and dark. Your choice is saved in this browser and applies to
          every page.
        </p>
        <div role="group" aria-labelledby="settings-theme-label" className="mt-4 min-w-0">
          <p id="settings-theme-label" className="text-sm font-medium text-foreground">
            Colour theme and light or dark mode
          </p>
          <div className="mt-2">
            <ThemeSwitcher />
          </div>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Motion follows your operating system: turn on its reduce-motion setting and animations here are reduced too.
        </p>
      </section>

      <section id="data" aria-labelledby="settings-data-heading" className={cn(card, 'scroll-mt-24')}>
        <h2 id="settings-data-heading" className={sectionHeading}>
          Your learning data
        </h2>
        <div className="mt-2 max-w-3xl space-y-3">
          <p className="text-sm text-foreground">
            Your lesson progress, the lessons you opened and the days you studied, flashcard reviews, notebook
            (including Teach-it-back answers), lab code, quiz and placement results, exercise scores and chosen route
            are stored only in this browser, in its local storage.
            They are never sent to this site, and they don&apos;t follow you to another browser or device.
          </p>
          <StorageStatusNote savedLabel="Stored only in this browser" />
          <p className={body} data-testid="learner-data-estimate">
            {bytes === null
              ? 'Measuring the learning data in this browser…'
              : bytes === 0
                ? 'No learning data is saved in this browser yet.'
                : `Learning data in this browser: ${formatStorageEstimate(bytes)}.`}
          </p>
          <p className={body}>
            Some browsers clear data for sites you haven&apos;t visited recently, and clearing this site&apos;s data
            deletes it. Download a backup now and then; you can import it here or in another browser.
          </p>
        </div>
        <LearnerDataControls className="mt-6" />
      </section>

      {status === 'authenticated' ? <AccountPreferencesPanel /> : null}
    </div>
  );
}
