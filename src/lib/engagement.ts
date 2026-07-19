import type { ActivityType, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const ENGAGEMENT_ALGORITHM_VERSION = "engagement-v1";

export type EngagementActivityType =
  | "lesson_completed"
  | "challenge_attempted"
  | "project_submitted"
  | "forum_post"
  | "code_review";

export interface EngagementActivityLog {
  id: string;
  userId: string;
  type: EngagementActivityType;
  timestamp: string;
  details: Record<string, unknown>;
}

export interface EngagementMetrics {
  dailyStreak: number;
  weeklyActiveDays: number;
  lessonsCompleted: number;
  challengesAttempted: number;
  timeSpentMinutes: number;
}

export interface EngagementGoal {
  id: string;
  description: string;
  target: number;
  progress: number;
  unit: string;
}

export interface EngagementPatterns {
  mostActiveDay: string;
  preferredTopic: string;
  learningStyle: "binge-learner" | "steady-progress" | "weekend-warrior";
}

export interface EngagementMotivationalProfile {
  style: "competitive" | "collaborative" | "curious" | "goal-oriented";
  rewardPreference: "badges" | "certificates" | "career" | "tools";
}

export interface EngagementResponse {
  algorithmVersion: typeof ENGAGEMENT_ALGORITHM_VERSION;
  metrics: EngagementMetrics;
  activityHistory: EngagementActivityLog[];
  motivationalProfile: EngagementMotivationalProfile | null;
  goals: EngagementGoal[];
  mentorMessage: string;
  activityChart: { name: string; activity: number }[];
  patterns: EngagementPatterns;
}

const activityTypeMap: Partial<Record<ActivityType, EngagementActivityType>> = {
  LESSON_COMPLETED: "lesson_completed",
  CHALLENGE_ATTEMPTED: "challenge_attempted",
  PROJECT_SUBMITTED: "project_submitted",
  FORUM_POSTED: "forum_post",
  CODE_REVIEWED: "code_review",
};

function safeTimeZone(timeZone: string): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
    return timeZone;
  } catch {
    return "UTC";
  }
}

function zonedDateKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function previousDateKey(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function calculateDailyStreak(
  activityDates: Date[],
  now: Date,
  requestedTimeZone: string,
): number {
  const timeZone = safeTimeZone(requestedTimeZone);
  const activeDays = new Set(activityDates.map((date) => zonedDateKey(date, timeZone)));
  let cursor = zonedDateKey(now, timeZone);

  // A learner may not have logged activity yet today; retain the streak when
  // yesterday is active, then require contiguous local-calendar days.
  if (!activeDays.has(cursor)) cursor = previousDateKey(cursor);
  let streak = 0;
  while (activeDays.has(cursor)) {
    streak += 1;
    cursor = previousDateKey(cursor);
  }
  return streak;
}

function jsonObject(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function derivePatterns(
  activity: EngagementActivityLog[],
  timeZone: string,
): EngagementPatterns {
  const dayCounts = new Map<string, number>();
  const topicCounts = new Map<string, number>();

  activity.forEach((item) => {
    const day = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone }).format(
      new Date(item.timestamp),
    );
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
    const topic =
      typeof item.details.topic === "string"
        ? item.details.topic
        : typeof item.details.lesson === "string"
          ? item.details.lesson
          : null;
    if (topic) topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
  });

  const topEntry = (values: Map<string, number>, fallback: string) =>
    [...values.entries()].reduce<[string, number]>(
      (best, current) => (current[1] > best[1] ? current : best),
      [fallback, 0],
    )[0];
  const weekendActivity = (dayCounts.get("Saturday") ?? 0) + (dayCounts.get("Sunday") ?? 0);
  const activeDayCount = dayCounts.size;

  return {
    mostActiveDay: topEntry(dayCounts, "No activity yet"),
    preferredTopic: topEntry(topicCounts, "General skill building"),
    learningStyle:
      activity.length > 0 && weekendActivity / activity.length >= 0.6
        ? "weekend-warrior"
        : activeDayCount >= 4
          ? "steady-progress"
          : "binge-learner",
  };
}

function deriveActivityChart(
  activityDates: Date[],
  now: Date,
  timeZone: string,
) {
  const counts = new Map<string, number>();
  activityDates.forEach((date) => {
    const key = zonedDateKey(date, timeZone);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  const todayKey = zonedDateKey(now, timeZone);
  const keys: string[] = [todayKey];
  while (keys.length < 7) keys.unshift(previousDateKey(keys[0]));
  return keys.map((key) => ({
    name: new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(
      new Date(`${key}T12:00:00Z`),
    ),
    activity: counts.get(key) ?? 0,
  }));
}

export async function buildEngagementResponse(
  userId: string,
  now: Date,
  requestedTimeZone: string,
): Promise<EngagementResponse> {
  const timeZone = safeTimeZone(requestedTimeZone);
  const recentSince = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1_000);
  const weekSince = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1_000);

  const [activityRows, lessonCount, goals, user] = await Promise.all([
    prisma.activity.findMany({
      where: { userId, occurredAt: { gte: recentSince }, type: { not: "AI_REQUEST" } },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: 200,
    }),
    prisma.lessonProgress.count({ where: { userId, completedAt: { not: null } } }),
    prisma.goal.findMany({
      where: { userId, status: "ACTIVE" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
    prisma.user.findUnique({ select: { preferences: true }, where: { id: userId } }),
  ]);

  const activityHistory = activityRows.flatMap((row) => {
    const type = activityTypeMap[row.type];
    return type
      ? [
          {
            id: row.id,
            userId: row.userId,
            type,
            timestamp: row.occurredAt.toISOString(),
            details: jsonObject(row.metadata),
          } satisfies EngagementActivityLog,
        ]
      : [];
  });
  const activityDates = activityRows.map((row) => row.occurredAt);
  const weeklyActiveDays = new Set(
    activityRows
      .filter((row) => row.occurredAt >= weekSince)
      .map((row) => zonedDateKey(row.occurredAt, timeZone)),
  ).size;
  const totalDurationMs = activityRows.reduce((sum, row) => sum + row.durationMs, 0);
  const challengesAttempted = activityRows.filter(
    (row) => row.type === "CHALLENGE_ATTEMPTED",
  ).length;
  const preferences = jsonObject(user?.preferences ?? null);
  const motivationalProfile =
    preferences.motivationalProfile &&
    typeof preferences.motivationalProfile === "object" &&
    !Array.isArray(preferences.motivationalProfile)
      ? (preferences.motivationalProfile as EngagementMotivationalProfile)
      : null;

  return {
    algorithmVersion: ENGAGEMENT_ALGORITHM_VERSION,
    metrics: {
      dailyStreak: calculateDailyStreak(activityDates, now, timeZone),
      weeklyActiveDays,
      lessonsCompleted: lessonCount,
      challengesAttempted,
      timeSpentMinutes: Math.round(totalDurationMs / 60_000),
    },
    activityHistory,
    motivationalProfile,
    goals: goals.map((goal) => ({
      id: goal.id,
      description: goal.description,
      target: goal.target,
      progress: goal.progress,
      unit: goal.unit,
    })),
    mentorMessage:
      activityRows.length > 0
        ? "Keep the momentum: choose one focused lesson or lab for your next session."
        : "Start with one short lesson today; consistency matters more than session length.",
    activityChart: deriveActivityChart(activityDates, now, timeZone),
    patterns: derivePatterns(activityHistory, timeZone),
  };
}
