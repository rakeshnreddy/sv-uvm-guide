"use client";

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

import { LearnerDataControls } from '@/components/learner/LearnerDataControls';
import { LearnerPageHeader } from '@/components/learner/LearnerSectionNav';
import { PageShell } from '@/components/layout/PageShell';
import { Section } from '@/components/layout/Section';
import { siteLabel } from '@/lib/nav-labels';
import { SETTINGS_HREF } from '@/lib/site-links';
import { StorageStatusNote } from '@/components/learner/StorageStatusNote';
import { ThemeSwitcher } from '@/components/ui/ThemeSwitcher';
import { estimateLearnerDataBytes } from '@/lib/learner-store/backup';
import { LEARNER_DATA_CHANGED_EVENT } from '@/lib/learner-store/keys';
import { subscribeLearnerStore } from '@/lib/learner-store/record';
import { useAccountSession } from '@/lib/persistence/target';

// Loaded only once the session is authenticated: anonymous visitors of this static page never download the
// account code or its notification and preference libraries.
const AccountPreferencesPanel = dynamic(() => import('./AccountPreferencesPanel'), {
  ssr: false,
  loading: () => <p className="text-sm text-muted-foreground">Loading your preferences…</p>,
});

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
    // The content width, like every page under the same tab strip; only the sections below are capped.
    <PageShell width="content">
      <LearnerPageHeader
        current="settings"
        title={siteLabel(SETTINGS_HREF)}
        lead="Your theme, and the learning data saved in this browser."
      />
      <div className="max-w-3xl">
        <Section
          id="appearance"
          title="Appearance"
          description="Choose Light, Dark or System. System follows your device setting. Your choice is saved in this browser."
        >
          <div role="group" aria-labelledby="settings-theme-label" className="min-w-0">
            <p id="settings-theme-label" className="text-sm font-medium text-foreground">
              Light, dark or system
            </p>
            {/* On the page whose job is to set the mode, the three choices stay visible (the headers keep the icon menu). */}
            <div className="mt-2 max-w-sm">
              <ThemeSwitcher layout="menu" />
            </div>
          </div>
          <p className="mt-4 max-w-[30em] text-xs text-subtle">
            Motion follows your operating system: turn on its reduce-motion setting and animations here are reduced too.
          </p>
        </Section>

        <Section id="data" title="Your learning data">
          <div className="max-w-[30em] space-y-3">
            <p className="text-sm text-foreground">
              Your lesson progress, the lessons you opened and the days you studied, flashcard reviews, notebook
              (including Teach-it-back answers), lab code, quiz and placement results, exercise scores and chosen route
              are stored only in this browser, in its local storage. They are never sent to this site, and they
              don&apos;t follow you to another browser or device.
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
        </Section>

        {status === 'authenticated' ? (
          <div className="mt-12">
            <AccountPreferencesPanel />
          </div>
        ) : null}
      </div>
    </PageShell>
  );
}
