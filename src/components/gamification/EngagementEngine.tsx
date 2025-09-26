/**
 * @file EngagementEngine.tsx
 * @description This component is the core of the gamification system's engagement features.
 * It tracks user activity, analyzes engagement patterns, provides motivational feedback,
 * and visualizes progress to enhance user retention and learning effectiveness.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Progress } from '@/components/ui/Progress';
import { Button } from '@/components/ui/Button';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Award, Target, TrendingUp, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

// --- TYPE DEFINITIONS ---
// These types define the data structures for engagement tracking.
// In a real application, these would likely be synchronized with the Prisma schema.

type UserActivityType = 'lesson_completed' | 'challenge_attempted' | 'project_submitted' | 'forum_post' | 'code_review';

interface ActivityLog {
  id: string;
  userId: string;
  type: UserActivityType;
  timestamp: Date;
  details: Record<string, any>; // e.g., { lessonId: 'F1_S1_M1' }
}

interface EngagementMetrics {
  dailyStreak: number;
  weeklyActiveDays: number;
  lessonsCompleted: number;
  challengesAttempted: number;
  timeSpentMinutes: number;
}

interface EngagementPattern {
  mostActiveDay: string;
  preferredTopic: string;
  learningStyle: 'binge-learner' | 'steady-progress' | 'weekend-warrior';
}

interface PersonalizedStrategy {
  id: string;
  title: string;
  description: string;
  action: () => void;
}

// Personalized gamification profile structures
type MotivationalStyle = 'competitive' | 'collaborative' | 'curious' | 'goal-oriented';

interface MotivationalProfile {
  style: MotivationalStyle;
  rewardPreference: 'badges' | 'certificates' | 'career' | 'tools';
}

interface EngagementGoal {
  id: string;
  description: string;
  target: number;
  progress: number;
  unit: string;
}

// --- FALLBACK DATA ---
// These constants act as graceful fallbacks when the real API is unavailable.

const EMPTY_METRICS: EngagementMetrics = {
  dailyStreak: 0,
  weeklyActiveDays: 0,
  lessonsCompleted: 0,
  challengesAttempted: 0,
  timeSpentMinutes: 0,
};

const EMPTY_CHART_DATA = [
  { name: 'Mon', activity: 0 },
  { name: 'Tue', activity: 0 },
  { name: 'Wed', activity: 0 },
  { name: 'Thu', activity: 0 },
  { name: 'Fri', activity: 0 },
  { name: 'Sat', activity: 0 },
  { name: 'Sun', activity: 0 },
];

const FALLBACK_MENTOR_MESSAGE = 'Welcome back! Ready to keep your verification skills sharp today?';

const FALLBACK_DATA = {
  metrics: {
    dailyStreak: 5,
    weeklyActiveDays: 4,
    lessonsCompleted: 12,
    challengesAttempted: 8,
    timeSpentMinutes: 420,
  } satisfies EngagementMetrics,
  activityHistory: [
    {
      id: '1',
      userId: 'user1',
      type: 'lesson_completed',
      timestamp: new Date(Date.now() - 86400000 * 1),
      details: {
        lesson: 'UVM Basics',
        lessonSlug: ['T2_Intermediate', 'I-UVM-1_UVM_Intro', 'index'],
      },
    },
    {
      id: '2',
      userId: 'user1',
      type: 'challenge_attempted',
      timestamp: new Date(Date.now() - 86400000 * 2),
      details: {
        challenge: 'FIFO Sequencer',
        lessonSlug: ['T3_Advanced', 'A-UVM-1_Advanced_Sequencing', 'sequence-arbitration'],
      },
    },
    {
      id: '3',
      userId: 'user1',
      type: 'lesson_completed',
      timestamp: new Date(Date.now() - 86400000 * 3),
      details: {
        lesson: 'SystemVerilog Assertions',
        lessonSlug: ['T2_Intermediate', 'I-SV-4_Assertions_and_SVA', 'index'],
      },
    },
    {
      id: '4',
      userId: 'user1',
      type: 'forum_post',
      timestamp: new Date(Date.now() - 86400000 * 4),
      details: {
        postTitle: 'Question about RAL',
        lessonSlug: ['T3_Advanced', 'A-UVM-4_The_UVM_Register_Abstraction_Layer_RAL', 'index'],
      },
    },
  ] as ActivityLog[],
  motivationalProfile: {
    style: 'goal-oriented',
    rewardPreference: 'badges',
  } satisfies MotivationalProfile,
  goals: [
    { id: 'weekly_lessons', description: 'Lessons this week', target: 5, progress: 3, unit: 'lessons' },
  ] as EngagementGoal[],
};

type SerializedActivityLog = Omit<ActivityLog, 'timestamp'> & { timestamp: string };

interface EngagementApiResponse {
  metrics: EngagementMetrics;
  activityHistory: SerializedActivityLog[];
  motivationalProfile?: MotivationalProfile | null;
  goals?: EngagementGoal[];
  mentorMessage?: string;
  activityChart?: { name: string; activity: number }[];
  patterns?: EngagementPattern;
}


// --- COMPONENT PROPS ---

interface EngagementEngineProps {
  userId: string;
  useMockData?: boolean;
}

/**
 * The EngagementEngine component serves as a user-facing dashboard to drive engagement.
 */
const EngagementEngine: React.FC<EngagementEngineProps> = ({ userId, useMockData }) => {
  // --- STATE MANAGEMENT ---
  const [metrics, setMetrics] = useState<EngagementMetrics | null>(null);
  const [patterns, setPatterns] = useState<EngagementPattern | null>(null);
  const [strategies, setStrategies] = useState<PersonalizedStrategy[]>([]);
  const [profile, setProfile] = useState<MotivationalProfile | null>(null);
  const [goals, setGoals] = useState<EngagementGoal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mentorMessage, setMentorMessage] = useState<string>('');
  const [activityHistory, setActivityHistory] = useState<ActivityLog[]>([]);
  const [activityChart, setActivityChart] = useState<{ name: string; activity: number }[]>(EMPTY_CHART_DATA);

  const mockEnabled = useMemo(() => {
    if (typeof useMockData === 'boolean') {
      return useMockData;
    }
    return process.env.NEXT_PUBLIC_USE_MOCK_ENGAGEMENT === 'true';
  }, [useMockData]);

  const recommendedDifficulty = useMemo(() => {
    if (!metrics) return 'Medium';
    if (metrics.dailyStreak >= 7 && metrics.challengesAttempted > 10) return 'Hard';
    if (metrics.lessonsCompleted < 5) return 'Easy';
    return 'Medium';
  }, [metrics]);

  const addGoal = () => {
    const description = prompt('Goal description?');
    const targetStr = prompt('Target amount?');
    const target = targetStr ? parseInt(targetStr, 10) : 0;
    if (description && target > 0) {
      setGoals(prev => [...prev, { id: Date.now().toString(), description, target, progress: 0, unit: 'units' }]);
    }
  };

  const updateRewardPreference = (pref: MotivationalProfile['rewardPreference']) => {
    setProfile(prev => prev ? { ...prev, rewardPreference: pref } : null);
  };

  // --- DATA FETCHING & ANALYSIS ---
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/engagement/${userId}`);
        if (!response.ok) {
          throw new Error('Failed to load engagement data');
        }
        const data: EngagementApiResponse = await response.json();

        setMetrics(data.metrics ?? EMPTY_METRICS);

        const history = (data.activityHistory ?? []).map(log => ({
          ...log,
          timestamp: new Date(log.timestamp),
        }));
        setActivityHistory(history);

        if (data.patterns) {
          setPatterns(data.patterns);
        } else {
          analyzePatterns(history);
        }

        setProfile(data.motivationalProfile ?? null);
        setGoals(data.goals ?? []);
        setMentorMessage(data.mentorMessage ?? FALLBACK_MENTOR_MESSAGE);
        setActivityChart(data.activityChart ?? buildActivityChart(history));
      } catch (error) {
        if (mockEnabled) {
          setMetrics(FALLBACK_DATA.metrics);
          setActivityHistory(FALLBACK_DATA.activityHistory);
          setActivityChart(buildActivityChart(FALLBACK_DATA.activityHistory));
          analyzePatterns(FALLBACK_DATA.activityHistory);
          setProfile(FALLBACK_DATA.motivationalProfile);
          setGoals(FALLBACK_DATA.goals);
          setMentorMessage(FALLBACK_MENTOR_MESSAGE);
        } else {
          setMetrics(EMPTY_METRICS);
          setActivityHistory([]);
          setActivityChart(EMPTY_CHART_DATA);
          setPatterns(null);
          setProfile(null);
          setGoals([]);
          setMentorMessage('');
          setStrategies([]);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [mockEnabled, userId]);

  // --- ENGAGEMENT LOGIC ---

  /**
   * Analyzes user activity history to derive engagement patterns.
   * In a real system, this logic might live on the backend.
   */
  const analyzePatterns = (activity: ActivityLog[]): EngagementPattern => {
    const dayMap = activity.reduce((acc, log) => {
      const day = log.timestamp.toLocaleString('en-US', { weekday: 'long' });
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const dayEntries = Object.entries(dayMap);
    const mostActiveDay = dayEntries.length
      ? dayEntries.reduce((max, current) => (current[1] > max[1] ? current : max))[0]
      : 'N/A';

    const lessonCounts = activity.reduce((acc, log) => {
      const lesson = typeof log.details.lesson === 'string' ? log.details.lesson : null;
      if (lesson) {
        acc.set(lesson, (acc.get(lesson) ?? 0) + 1);
      }
      return acc;
    }, new Map<string, number>());

    const preferredTopic = lessonCounts.size
      ? [...lessonCounts.entries()].reduce((max, current) => (current[1] > max[1] ? current : max))[0]
      : 'General Skill Building';

    const learningStyle: EngagementPattern['learningStyle'] = activity.length > 5 ? 'steady-progress' : 'binge-learner';

    const derived = {
      mostActiveDay,
      preferredTopic,
      learningStyle,
    } satisfies EngagementPattern;

    setPatterns(derived);
    return derived;
  };

  const buildActivityChart = (activity: ActivityLog[]) => {
    if (!activity.length) {
      return EMPTY_CHART_DATA;
    }
    const dayBuckets = new Map<string, number>();
    activity.forEach(log => {
      const day = log.timestamp.toLocaleString('en-US', { weekday: 'short' });
      dayBuckets.set(day, (dayBuckets.get(day) ?? 0) + 1);
    });

    const orderedDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return orderedDays.map(name => ({ name, activity: dayBuckets.get(name) ?? 0 }));
  };

  /**
   * Generates personalized engagement strategies based on user patterns and metrics.
   */
  useEffect(() => {
    if (patterns && metrics) {
      const newStrategies: PersonalizedStrategy[] = [];
      if (metrics.dailyStreak > 3) {
        newStrategies.push({
          id: 'streak_master',
          title: `You're on a ${metrics.dailyStreak}-day streak!`,
          description: "Keep the momentum going! Complete one more lesson today to extend your streak.",
          action: () => console.log('Navigate to next lesson'),
        });
      }
      if (patterns.learningStyle === 'steady-progress') {
        newStrategies.push({
          id: 'steady_learner',
          title: 'Consistency is Key',
          description: `You're doing great with steady progress. Try a slightly more challenging problem this week to level up.`,
          action: () => console.log('Navigate to a harder challenge'),
        });
      }
      if (metrics.timeSpentMinutes < 30) {
         newStrategies.push({
          id: 'quick_boost',
          title: 'Quick Boost',
          description: `Just 15 minutes can make a difference. Try a quick flashcard session!`,
          action: () => console.log('Navigate to flashcards'),
        });
      }
      if (profile?.style === 'collaborative') {
        newStrategies.push({
          id: 'join_group',
          title: 'Learn with Peers',
          description: 'Your collaborative style thrives in study groups. Join one today.',
          action: () => console.log('Navigate to study groups'),
        });
      }

      if (profile?.style === 'competitive') {
        newStrategies.push({
          id: 'compete_leaderboard',
          title: 'Climb the Ranks',
          description: 'Join the weekly leaderboard challenge to satisfy your competitive spirit.',
          action: () => console.log('Navigate to leaderboards'),
        });
      }
      if (goals.length === 0) {
        newStrategies.push({
          id: 'set_goal',
          title: 'Set a Learning Goal',
          description: 'Define a weekly goal to guide your progress.',
          action: addGoal,
        });
      }
      setStrategies(newStrategies);
    }
  }, [patterns, metrics, profile, goals]);


  // --- RENDER LOGIC ---

  if (isLoading) {
    return <Card><CardContent><p>Loading Engagement Data...</p></CardContent></Card>;
  }

  if (!metrics) {
    return <Card><CardContent><p>Could not load engagement data.</p></CardContent></Card>;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center"><TrendingUp className="mr-2" /> Your Engagement Hub</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* 1. Engagement Metrics Dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="p-4 bg-secondary rounded-lg">
            <p className="text-2xl font-bold">{metrics.dailyStreak}</p>
            <p className="text-sm text-muted-foreground">Day Streak</p>
          </div>
          <div className="p-4 bg-secondary rounded-lg">
            <p className="text-2xl font-bold">{metrics.weeklyActiveDays}/7</p>
            <p className="text-sm text-muted-foreground">Active This Week</p>
          </div>
          <div className="p-4 bg-secondary rounded-lg">
            <p className="text-2xl font-bold">{metrics.lessonsCompleted}</p>
            <p className="text-sm text-muted-foreground">Lessons Done</p>
          </div>
          <div className="p-4 bg-secondary rounded-lg">
            <p className="text-2xl font-bold">{Math.floor(metrics.timeSpentMinutes / 60)}h {metrics.timeSpentMinutes % 60}m</p>
            <p className="text-sm text-muted-foreground">Time Spent</p>
          </div>
        </div>

        {/* 2. Progress Visualization */}
        <div>
            <h3 className="text-lg font-semibold mb-2">Weekly Activity</h3>
            <ResponsiveContainer width="100%" height={200}>
                <BarChart data={activityChart} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}/>
                    <Legend />
                    <Bar dataKey="activity" fill="hsl(var(--primary))" name="Activity Units" />
                </BarChart>
            </ResponsiveContainer>
        </div>

        {/* 3. Goal Setting Assistance & Progress Pacing */}
        <div>
          <h3 className="text-lg font-semibold mb-2">Your Goals</h3>
          <div className="space-y-2">
            {goals.map(goal => (
              <div key={goal.id} className="p-2 border rounded">
                <div className="flex justify-between text-sm">
                  <span>{goal.description}</span>
                  <span>{goal.progress}/{goal.target} {goal.unit}</span>
                </div>
                <Progress value={(goal.progress / goal.target) * 100} />
              </div>
            ))}
            {goals.length === 0 && (
              <p className="text-sm text-muted-foreground">No goals yet. Set one to guide your learning.</p>
            )}
            <Button onClick={addGoal} size="sm" className="mt-2">Add Goal</Button>
          </div>
        </div>

        {/* 4. Adaptive Difficulty Recommendation */}
        <div className="p-4 bg-secondary rounded-lg">
          <p className="text-sm">Recommended next challenge difficulty: <span className="font-bold">{recommendedDifficulty}</span></p>
          {profile && (
            <p className="text-xs text-muted-foreground mt-1">Motivational style: {profile.style}, prefers {profile.rewardPreference}</p>
          )}
          {profile && (
            <div className="mt-2 text-xs">
              <span className="mr-2">Reward preference:</span>
              {(['badges','certificates','career','tools'] as const).map(p => (
                <button key={p} onClick={() => updateRewardPreference(p)} className={cn('px-2 py-1 rounded border text-xs', profile.rewardPreference===p?'bg-primary text-primary-foreground':'bg-transparent')}>{p}</button>
              ))}
            </div>
          )}

        </div>

        {/* 5. Motivational Feedback & Personalized Strategies */}
        <div>
          <h3 className="text-lg font-semibold mb-2">Personalized Suggestions</h3>
          <div className="space-y-4">
            {strategies.length > 0 ? strategies.map(strategy => (
              <div key={strategy.id} className="p-4 border rounded-lg flex items-center justify-between">
                <div>
                  <h4 className="font-bold">{strategy.title}</h4>
                  <p className="text-sm text-muted-foreground">{strategy.description}</p>
                </div>
                <Button onClick={strategy.action}>Go!</Button>
              </div>
            )) : <p>No suggestions right now. Keep up the great work!</p>}
          </div>
        </div>

        {/* 6. Retention Optimization & Personalized Content */}
        <div className="p-4 bg-accent/50 rounded-lg text-center">
            <h4 className="font-bold mb-2">Did you know?</h4>
            {patterns && <p className="text-sm">You're most active on {patterns.mostActiveDay}s. Plan a deep-dive session then!</p>}
            <p className="text-sm mt-1">Based on your progress, you might enjoy our section on <a href="#" className="underline">Advanced UVM Sequencing</a>.</p>
        </div>

        {/* 7. Virtual Mentor */}
        {mentorMessage && (
          <div className="p-4 bg-primary/10 rounded-lg">
            <h4 className="font-bold mb-1 flex items-center"><UserCheck className="mr-2"/>Your Mentor</h4>
            <p className="text-sm text-muted-foreground">{mentorMessage}</p>
          </div>
        )}

      </CardContent>
    </Card>
  );
};

export default EngagementEngine;
