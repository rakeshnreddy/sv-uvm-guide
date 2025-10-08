import { describe, expect, it } from 'vitest';
import { deriveNotificationsFromEngagement, resolveNotificationPreferences } from '@/lib/notifications';
import type { EngagementResponse } from '@/lib/engagement';

const BASE_TIME = new Date('2024-05-01T12:00:00.000Z');

function createEngagementFixture(): EngagementResponse {
  return {
    metrics: {
      dailyStreak: 6,
      weeklyActiveDays: 4,
      lessonsCompleted: 14,
      challengesAttempted: 5,
      timeSpentMinutes: 360,
    },
    activityHistory: [
      {
        id: 'lesson-1',
        userId: 'demo-user',
        type: 'lesson_completed',
        timestamp: new Date(BASE_TIME.getTime() - 60 * 60 * 1000).toISOString(),
        details: {
          lesson: 'Advanced Sequences',
          lessonSlug: ['T3_Advanced', 'A-UVM-1_Advanced_Sequencing', 'index'],
        },
      },
      {
        id: 'challenge-1',
        userId: 'demo-user',
        type: 'challenge_attempted',
        timestamp: new Date(BASE_TIME.getTime() - 2 * 60 * 60 * 1000).toISOString(),
        details: {
          challenge: 'Scoreboard Builder',
        },
      },
      {
        id: 'forum-1',
        userId: 'demo-user',
        type: 'forum_post',
        timestamp: new Date(BASE_TIME.getTime() - 3 * 60 * 60 * 1000).toISOString(),
        details: {
          postTitle: 'UVM Factory overrides',
        },
      },
    ],
    motivationalProfile: {
      style: 'goal-oriented',
      rewardPreference: 'badges',
    },
    goals: [
      {
        id: 'weekly-lessons',
        description: 'Lessons this week',
        target: 5,
        progress: 2,
        unit: 'lessons',
      },
    ],
    mentorMessage: 'Switch to stimulus heuristics practice to reinforce today\'s lesson.',
    activityChart: [
      { name: 'Sun', activity: 1 },
      { name: 'Mon', activity: 3 },
      { name: 'Tue', activity: 2 },
      { name: 'Wed', activity: 0 },
      { name: 'Thu', activity: 0 },
      { name: 'Fri', activity: 0 },
      { name: 'Sat', activity: 0 },
    ],
    patterns: {
      mostActiveDay: 'Monday',
      preferredTopic: 'Advanced Sequences',
      learningStyle: 'steady-progress',
    },
  } satisfies EngagementResponse;
}

describe('deriveNotificationsFromEngagement', () => {
  it('emits notifications for activity history and derived insights', () => {
    const engagement = createEngagementFixture();
    const preferences = resolveNotificationPreferences('demo-user');

    const notifications = deriveNotificationsFromEngagement(engagement, preferences);

    const categories = notifications.map((notification) => notification.category);
    expect(categories).toContain('progress');
    expect(categories).toContain('practice');
    expect(categories).toContain('community');
    expect(categories).toContain('mentor');
    expect(notifications.some((notification) => notification.id.startsWith('goal-'))).toBe(true);
  });

  it('filters notifications when a category preference is disabled', () => {
    const engagement = createEngagementFixture();
    const basePreferences = resolveNotificationPreferences('demo-user');
    const preferences = {
      ...basePreferences,
      categories: {
        ...basePreferences.categories,
      },
    };
    preferences.categories.practice = false;

    const notifications = deriveNotificationsFromEngagement(engagement, preferences);

    expect(notifications.some((notification) => notification.category === 'practice')).toBe(false);
    expect(notifications.some((notification) => notification.category === 'progress')).toBe(true);
  });

  it('respects the limit option when provided', () => {
    const engagement = createEngagementFixture();
    const preferences = resolveNotificationPreferences('demo-user');

    const notifications = deriveNotificationsFromEngagement(engagement, preferences, { limit: 2 });

    expect(notifications).toHaveLength(2);
  });
});
