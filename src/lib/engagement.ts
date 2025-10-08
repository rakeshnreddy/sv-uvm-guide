export type EngagementActivityType =
  | 'lesson_completed'
  | 'challenge_attempted'
  | 'project_submitted'
  | 'forum_post'
  | 'code_review';

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
  learningStyle: 'binge-learner' | 'steady-progress' | 'weekend-warrior';
}

export interface EngagementMotivationalProfile {
  style: 'competitive' | 'collaborative' | 'curious' | 'goal-oriented';
  rewardPreference: 'badges' | 'certificates' | 'career' | 'tools';
}

export interface EngagementResponse {
  metrics: EngagementMetrics;
  activityHistory: EngagementActivityLog[];
  motivationalProfile: EngagementMotivationalProfile | null;
  goals: EngagementGoal[];
  mentorMessage: string;
  activityChart: { name: string; activity: number }[];
  patterns: EngagementPatterns;
}

export const ENGAGEMENT_FALLBACK_RESPONSE: EngagementResponse = {
  metrics: {
    dailyStreak: 5,
    weeklyActiveDays: 4,
    lessonsCompleted: 12,
    challengesAttempted: 8,
    timeSpentMinutes: 420,
  },
  activityHistory: [
    {
      id: '1',
      userId: 'demo-user',
      type: 'lesson_completed',
      timestamp: new Date(Date.now() - 86400000 * 1).toISOString(),
      details: {
        lesson: 'UVM Basics',
        lessonSlug: ['T2_Intermediate', 'I-UVM-1_UVM_Intro', 'index'],
      },
    },
    {
      id: '2',
      userId: 'demo-user',
      type: 'challenge_attempted',
      timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
      details: {
        challenge: 'FIFO Sequencer',
        lessonSlug: ['T3_Advanced', 'A-UVM-1_Advanced_Sequencing', 'sequence-arbitration'],
      },
    },
    {
      id: '3',
      userId: 'demo-user',
      type: 'lesson_completed',
      timestamp: new Date(Date.now() - 86400000 * 3).toISOString(),
      details: {
        lesson: 'SystemVerilog Assertions',
        lessonSlug: ['T2_Intermediate', 'I-SV-4_Assertions_and_SVA', 'index'],
      },
    },
    {
      id: '4',
      userId: 'demo-user',
      type: 'forum_post',
      timestamp: new Date(Date.now() - 86400000 * 4).toISOString(),
      details: {
        postTitle: 'Question about RAL',
        lessonSlug: ['T3_Advanced', 'A-UVM-4_The_UVM_Register_Abstraction_Layer_RAL', 'index'],
      },
    },
  ],
  motivationalProfile: {
    style: 'goal-oriented',
    rewardPreference: 'badges',
  },
  goals: [
    {
      id: 'weekly_lessons',
      description: 'Lessons this week',
      target: 5,
      progress: 3,
      unit: 'lessons',
    },
    {
      id: 'practice_sessions',
      description: 'Practice sessions',
      target: 4,
      progress: 1,
      unit: 'sessions',
    },
  ],
  mentorMessage: 'Welcome back! Ready to keep your verification skills sharp today?',
  activityChart: [
    { name: 'Sun', activity: 0 },
    { name: 'Mon', activity: 3 },
    { name: 'Tue', activity: 2 },
    { name: 'Wed', activity: 2 },
    { name: 'Thu', activity: 1 },
    { name: 'Fri', activity: 0 },
    { name: 'Sat', activity: 0 },
  ],
  patterns: {
    mostActiveDay: 'Monday',
    preferredTopic: 'UVM Basics',
    learningStyle: 'steady-progress',
  },
};

export function buildEngagementResponse(userId: string): EngagementResponse {
  return {
    ...ENGAGEMENT_FALLBACK_RESPONSE,
    activityHistory: ENGAGEMENT_FALLBACK_RESPONSE.activityHistory.map((log) => ({
      ...log,
      userId,
      timestamp: log.timestamp,
      details: { ...log.details },
    })),
  };
}
