/**
 * What the site shows. Pages and components read their switches here (or
 * ACCOUNTS_ENABLED / SERVER_SYNC_READY from src/lib/persistence/accounts.ts),
 * never from src/tools/featureFlags.ts.
 *
 * Every value is fixed at build time from NEXT_PUBLIC_FEATURE_FLAG_* variables,
 * so the server render and hydration always agree. Client-safe.
 */
import { ACCOUNTS_ENABLED } from '@/lib/persistence/accounts';
import { isFeatureEnabled } from '@/tools/featureFlags';

export interface SiteFeatureSwitches {
  /** The learner dashboard at /dashboard, built from data in this browser. */
  dashboard: boolean;
  /** The flashcard review queue at /dashboard/review. */
  review: boolean;
  /** The notebook at /dashboard/notebook. */
  notebook: boolean;
  /** Settings: theme plus export, import and reset of learner data. */
  settings: boolean;
  /** Sign-in, the account menu and notifications. */
  accounts: boolean;
  /** Community pages. They need several learners' data, so accounts too. */
  community: boolean;
  /** The AI tutor and AI feedback. They need a server secret, so accounts too. */
  aiTutor: boolean;
  /** Server-side simulation. It needs a job queue, so accounts too. */
  simulation: boolean;
  /**
   * Pages still in review. Off in production. None is gated at the moment:
   * /resources, /history, /knowledge-hub and /projects were rebuilt and are public.
   */
  draftPages: boolean;
  /**
   * The self-assessment at /assessment: lessons, quizzes, labs, reviews and the
   * placement result per track, built only from data kept in this browser.
   */
  assessmentCenter: boolean;
}

export const SITE_FEATURES: Readonly<SiteFeatureSwitches> = Object.freeze({
  dashboard: true,
  review: true,
  notebook: true,
  settings: true,
  accounts: ACCOUNTS_ENABLED,
  community: isFeatureEnabled('community') && ACCOUNTS_ENABLED,
  aiTutor: isFeatureEnabled('aiTutor') && ACCOUNTS_ENABLED,
  simulation: isFeatureEnabled('simulation') && ACCOUNTS_ENABLED,
  draftPages: isFeatureEnabled('personalization'),
  assessmentCenter: true,
});

export type SiteFeature = keyof typeof SITE_FEATURES;
