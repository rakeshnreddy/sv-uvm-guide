import { describe, expect, it } from 'vitest';
import {
  derivePersonalization,
  DEFAULT_ENGAGEMENT_SNAPSHOT,
  type EngagementSnapshot,
} from '@/lib/personalization';

const baseSnapshot: EngagementSnapshot = {
  metrics: {
    dailyStreak: 4,
    weeklyActiveDays: 3,
    lessonsCompleted: 8,
    challengesAttempted: 2,
    timeSpentMinutes: 210,
  },
  activityHistory: [
    {
      id: 'lesson-old',
      type: 'lesson_completed',
      timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
      details: {
        lesson: 'SystemVerilog Assertions',
        lessonSlug: ['T2_Intermediate', 'I-SV-4_Assertions_and_SVA', 'index'],
      },
    },
    {
      id: 'lesson-new',
      type: 'lesson_completed',
      timestamp: new Date().toISOString(),
      details: {
        lesson: 'UVM Phasing In-Depth',
        lessonSlug: ['T2_Intermediate', 'I-UVM-5_Phasing_and_Synchronization', 'index'],
      },
    },
  ],
};

describe('derivePersonalization', () => {
  it('picks the most recent lesson slug and preserves the title', () => {
    const result = derivePersonalization(baseSnapshot, { displayName: 'Jules' });
    expect(result.name).toBe('Jules');
    expect(result.lastLesson.title).toBe('UVM Phasing In-Depth');
    expect(result.lastLesson.slug).toEqual([
      'T2_Intermediate',
      'I-UVM-5_Phasing_and_Synchronization',
      'index',
    ]);
    expect(result.streak).toBe(4);
    expect(result.progress).toBe(20); // 8 / 40 => 20%
  });

  it('falls back to defaults when lesson metadata is missing', () => {
    const snapshot: EngagementSnapshot = {
      metrics: { ...baseSnapshot.metrics, lessonsCompleted: 0 },
      activityHistory: [
        {
          id: 'incomplete',
          type: 'lesson_completed',
          timestamp: new Date().toISOString(),
          details: {},
        },
      ],
    };
    const result = derivePersonalization(snapshot, { displayName: '' });
    expect(result.name).toBe('Learner');
    expect(result.lastLesson.slug.length).toBe(3);
    expect(result.progress).toBe(0);
  });

  it('uses the shipped fallback snapshot when payload is null', () => {
    const result = derivePersonalization(null, { displayName: 'Avery' });
    expect(result.name).toBe('Avery');
    expect(result.lastLesson.slug).toEqual([
      'T2_Intermediate',
      'I-UVM-1_UVM_Intro',
      'index',
    ]);
  });
});
