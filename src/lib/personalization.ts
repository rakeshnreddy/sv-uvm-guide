import { normalizeSlug } from './curriculum-data';

export type EngagementActivityType =
  | 'lesson_completed'
  | 'challenge_attempted'
  | 'project_submitted'
  | 'forum_post'
  | 'code_review';

export interface EngagementActivity {
  id: string;
  userId?: string;
  type: EngagementActivityType;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface EngagementSnapshotMetrics {
  dailyStreak: number;
  weeklyActiveDays: number;
  lessonsCompleted: number;
  challengesAttempted: number;
  timeSpentMinutes: number;
}

export interface EngagementSnapshot {
  metrics: EngagementSnapshotMetrics;
  activityHistory: EngagementActivity[];
}

export interface PersonalizedHomeUser {
  name: string;
  lastLesson: {
    title: string;
    slug: string[];
  };
  progress: number;
  streak: number;
}

interface DerivePersonalizationOptions {
  displayName?: string | null;
  fallbackSlug?: string[];
}

const DEFAULT_SLUG: string[] = ['T2_Intermediate', 'I-UVM-2_Building_TB', 'index'];

export const DEFAULT_ENGAGEMENT_SNAPSHOT: EngagementSnapshot = {
  metrics: {
    dailyStreak: 5,
    weeklyActiveDays: 4,
    lessonsCompleted: 12,
    challengesAttempted: 8,
    timeSpentMinutes: 420,
  },
  activityHistory: [
    {
      id: 'fallback-1',
      type: 'lesson_completed',
      timestamp: new Date(Date.now() - 86400000).toISOString(),
      details: {
        lesson: 'UVM Basics',
        lessonSlug: ['T2_Intermediate', 'I-UVM-1_UVM_Intro', 'index'],
      },
    },
    {
      id: 'fallback-2',
      type: 'lesson_completed',
      timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
      details: {
        lesson: 'SystemVerilog Assertions',
        lessonSlug: ['T2_Intermediate', 'I-SV-4_Assertions_and_SVA', 'index'],
      },
    },
    {
      id: 'fallback-3',
      type: 'challenge_attempted',
      timestamp: new Date(Date.now() - 86400000 * 3).toISOString(),
      details: {
        challenge: 'FIFO Sequencer',
        lessonSlug: ['T3_Advanced', 'A-UVM-1_Advanced_Sequencing', 'sequence-arbitration'],
      },
    },
  ],
};

const DEFAULT_LAST_LESSON = {
  title: 'Continue your SystemVerilog journey',
  slug: DEFAULT_SLUG,
};

const DEFAULT_USER_NAME = 'Learner';

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function coerceSlug(rawSlug: unknown, fallbackSlug: string[]): string[] {
  if (Array.isArray(rawSlug)) {
    const normalized = normalizeSlug(rawSlug.filter((segment): segment is string => typeof segment === 'string'));
    if (normalized.length === 3) {
      return normalized;
    }
  }
  return normalizeSlug(fallbackSlug).length === 3 ? normalizeSlug(fallbackSlug) : DEFAULT_SLUG;
}

function resolveLastLesson(activityHistory: EngagementActivity[], fallbackSlug: string[]) {
  const lessonLogs = activityHistory
    .filter((log) => log.type === 'lesson_completed')
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (lessonLogs.length === 0) {
    return DEFAULT_LAST_LESSON;
  }

  const latest = lessonLogs[0];
  const details = latest.details ?? {};
  const title = typeof details.lesson === 'string' && details.lesson.trim().length > 0
    ? details.lesson
    : DEFAULT_LAST_LESSON.title;

  const slug = coerceSlug(
    (details as Record<string, unknown>).lessonSlug ??
    (details as Record<string, unknown>).slug ??
    (details as Record<string, unknown>).recommendationSlug,
    fallbackSlug,
  );

  return {
    title,
    slug,
  };
}

export function derivePersonalization(
  snapshot: EngagementSnapshot | null,
  options: DerivePersonalizationOptions = {},
): PersonalizedHomeUser {
  const fallbackSlug = options.fallbackSlug ?? DEFAULT_SLUG;
  const baseSnapshot = snapshot ?? DEFAULT_ENGAGEMENT_SNAPSHOT;
  const metrics: EngagementSnapshotMetrics = baseSnapshot.metrics ?? {
    dailyStreak: 0,
    weeklyActiveDays: 0,
    lessonsCompleted: 0,
    challengesAttempted: 0,
    timeSpentMinutes: 0,
  };
  const activityHistory = baseSnapshot.activityHistory ?? [];

  const lastLesson = resolveLastLesson(activityHistory, fallbackSlug);
  const progressRatio = metrics.lessonsCompleted > 0
    ? clamp(metrics.lessonsCompleted / 40, 0, 1)
    : 0;

  return {
    name: options.displayName?.trim().length ? options.displayName : DEFAULT_USER_NAME,
    lastLesson,
    progress: Math.round(progressRatio * 100),
    streak: clamp(metrics.dailyStreak, 0, 999),
  };
}
