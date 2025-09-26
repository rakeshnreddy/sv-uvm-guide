import { NextResponse } from 'next/server';

type UserActivityType =
  | 'lesson_completed'
  | 'challenge_attempted'
  | 'project_submitted'
  | 'forum_post'
  | 'code_review';

interface ActivityLog {
  id: string;
  userId: string;
  type: UserActivityType;
  timestamp: string;
  details: Record<string, unknown>;
}

interface EngagementResponse {
  metrics: {
    dailyStreak: number;
    weeklyActiveDays: number;
    lessonsCompleted: number;
    challengesAttempted: number;
    timeSpentMinutes: number;
  };
  activityHistory: ActivityLog[];
  motivationalProfile: {
    style: 'competitive' | 'collaborative' | 'curious' | 'goal-oriented';
    rewardPreference: 'badges' | 'certificates' | 'career' | 'tools';
  } | null;
  goals: {
    id: string;
    description: string;
    target: number;
    progress: number;
    unit: string;
  }[];
  mentorMessage: string;
  activityChart: { name: string; activity: number }[];
  patterns: {
    mostActiveDay: string;
    preferredTopic: string;
    learningStyle: 'binge-learner' | 'steady-progress' | 'weekend-warrior';
  };
}

const fallbackResponse: EngagementResponse = {
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
    { id: 'weekly_lessons', description: 'Lessons this week', target: 5, progress: 3, unit: 'lessons' },
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

export async function GET(_request: Request, { params }: { params: { userId: string } }) {
  const userId = params.userId ?? 'anonymous';

  const payload: EngagementResponse = {
    ...fallbackResponse,
    activityHistory: fallbackResponse.activityHistory.map(log => ({
      ...log,
      userId,
    })),
  };

  return NextResponse.json(payload);
}
