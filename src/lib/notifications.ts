import { resolveCurriculumPath } from '@/lib/curriculum-path';
import {
  type EngagementActivityLog,
  type EngagementResponse,
  type EngagementActivityType,
} from '@/lib/engagement';

export type NotificationCategory =
  | 'progress'
  | 'practice'
  | 'review'
  | 'community'
  | 'mentor';

export interface NotificationPreferences {
  categories: Record<NotificationCategory, boolean>;
  channels: {
    inApp: boolean;
    email: boolean;
  };
  digest: 'daily' | 'weekly';
  quietHours?: {
    start: string;
    end: string;
  };
}

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  category: NotificationCategory;
  timestamp: string;
  href?: string;
  unread: boolean;
  priority: 'normal' | 'high';
}

export const NOTIFICATION_CATEGORY_META: Record<NotificationCategory, { label: string; badgeClass: string }> = {
  progress: {
    label: 'Progress',
    badgeClass: 'bg-[var(--blueprint-accent)]/15 text-[var(--blueprint-accent)]',
  },
  practice: {
    label: 'Practice',
    badgeClass: 'bg-amber-500/20 text-amber-200',
  },
  review: {
    label: 'Review',
    badgeClass: 'bg-rose-500/20 text-rose-200',
  },
  community: {
    label: 'Community',
    badgeClass: 'bg-sky-500/15 text-sky-200',
  },
  mentor: {
    label: 'Mentor',
    badgeClass: 'bg-violet-500/20 text-violet-200',
  },
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  categories: {
    progress: true,
    practice: true,
    review: true,
    community: false,
    mentor: true,
  },
  channels: {
    inApp: true,
    email: true,
  },
  digest: 'weekly',
  quietHours: {
    start: '22:00',
    end: '06:00',
  },
};

type PreferenceLookup = Record<string, NotificationPreferences>;

const USER_NOTIFICATION_PREFERENCES: PreferenceLookup = {
  'demo-user': {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    categories: {
      ...DEFAULT_NOTIFICATION_PREFERENCES.categories,
      community: true,
    },
    digest: 'daily',
  },
  'uvm-team-lead': {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    categories: {
      ...DEFAULT_NOTIFICATION_PREFERENCES.categories,
      review: true,
      mentor: false,
    },
  },
};

export function resolveNotificationPreferences(userId?: string | null): NotificationPreferences {
  if (!userId) {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
  return USER_NOTIFICATION_PREFERENCES[userId] ?? DEFAULT_NOTIFICATION_PREFERENCES;
}

interface BuildActivityNotificationOptions {
  activity: EngagementActivityLog;
  preferences: NotificationPreferences;
}

function formatRelativeTime(timestamp: string): string {
  const eventTime = new Date(timestamp).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - eventTime);
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 60) {
    return `${diffMinutes || 1}m ago`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 48) {
    return `${diffHours}h ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

const typeToCategory: Record<EngagementActivityType, NotificationCategory> = {
  lesson_completed: 'progress',
  challenge_attempted: 'practice',
  project_submitted: 'progress',
  forum_post: 'community',
  code_review: 'review',
};

function buildActivityNotification({ activity, preferences }: BuildActivityNotificationOptions): NotificationItem | null {
  const category = typeToCategory[activity.type];
  if (!preferences.categories[category]) {
    return null;
  }

  const base: NotificationItem = {
    id: `activity-${activity.id}`,
    title: '',
    description: '',
    category,
    timestamp: activity.timestamp,
    href: undefined,
    unread: true,
    priority: 'normal',
  };

  const details = activity.details ?? {};

  switch (activity.type) {
    case 'lesson_completed': {
      const lesson = typeof details.lesson === 'string' ? details.lesson : 'Lesson completed';
      const slug = Array.isArray((details as Record<string, unknown>).lessonSlug)
        ? (details as Record<string, string[]>).lessonSlug
        : undefined;
      return {
        ...base,
        title: 'Lesson complete',
        description: `Nice work finishing ${lesson}. Capture a takeaway while it is still top-of-mind.`,
        href: slug ? resolveCurriculumPath(slug, '/curriculum') : '/curriculum',
      };
    }
    case 'challenge_attempted': {
      const challenge = typeof details.challenge === 'string' ? details.challenge : 'Practice challenge';
      return {
        ...base,
        title: 'Challenge attempt logged',
        description: `You attempted ${challenge}. Review the solution or retry for a higher score.`,
        href: '/practice',
      };
    }
    case 'project_submitted': {
      const project = typeof details.project === 'string' ? details.project : 'Project submission';
      return {
        ...base,
        title: 'Project submitted',
        description: `${project} is awaiting reviewer feedback. Track progress in the dashboard.`,
        href: '/dashboard',
        priority: 'high',
      };
    }
    case 'forum_post': {
      const postTitle = typeof details.postTitle === 'string' ? details.postTitle : 'Discussion update';
      return {
        ...base,
        title: 'Community thread active',
        description: `New replies in “${postTitle}”. Share a follow-up when you have a moment.`,
        href: '/community',
      };
    }
    case 'code_review': {
      const reviewer = typeof details.reviewer === 'string' ? details.reviewer : 'A reviewer';
      return {
        ...base,
        title: 'Code review awaiting response',
        description: `${reviewer} left comments on your latest submission. Address them to keep momentum.`,
        href: '/dashboard',
        priority: 'high',
      };
    }
    default:
      return null;
  }
}

function calculateGoalNotifications(
  engagement: EngagementResponse,
  preferences: NotificationPreferences,
): NotificationItem[] {
  if (!preferences.categories.progress) {
    return [];
  }

  return engagement.goals.map((goal) => {
    const completionRatio = goal.target > 0 ? goal.progress / goal.target : 0;
    const isBehind = completionRatio < 0.5;
    return {
      id: `goal-${goal.id}`,
      title: isBehind ? 'Goal needs attention' : 'Goal on track',
      description: `${goal.description}: ${goal.progress}/${goal.target} ${goal.unit}. ${
        isBehind ? 'Schedule a focused session to close the gap.' : 'Nice pace—keep it up.'
      }`,
      category: 'progress',
      timestamp: new Date().toISOString(),
      href: '/dashboard',
      unread: true,
      priority: isBehind ? 'high' : 'normal',
    } satisfies NotificationItem;
  });
}

function buildStreakNotification(
  engagement: EngagementResponse,
  preferences: NotificationPreferences,
): NotificationItem | null {
  if (!preferences.categories.progress) {
    return null;
  }

  const streak = engagement.metrics.dailyStreak;
  if (streak <= 0) {
    return null;
  }

  const lastActivity = engagement.activityHistory
    .slice()
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

  const hoursSinceLastActivity = lastActivity
    ? (Date.now() - new Date(lastActivity.timestamp).getTime()) / 3600000
    : Number.POSITIVE_INFINITY;

  const urgency = hoursSinceLastActivity > 36 ? 'high' : 'normal';

  return {
    id: 'streak-status',
    title: hoursSinceLastActivity > 36 ? 'Streak at risk' : 'Streak intact',
    description: hoursSinceLastActivity > 36
      ? `You are on a ${streak}-day streak. Log a quick session to keep it alive.`
      : `Streak count: ${streak} days. Momentum is your advantage—plan the next lesson now.`,
    category: 'progress',
    timestamp: lastActivity ? lastActivity.timestamp : new Date().toISOString(),
    href: '/dashboard',
    unread: true,
    priority: urgency,
  } satisfies NotificationItem;
}

function buildMentorNotification(
  engagement: EngagementResponse,
  preferences: NotificationPreferences,
): NotificationItem | null {
  if (!preferences.categories.mentor) {
    return null;
  }

  if (!engagement.mentorMessage?.trim()) {
    return null;
  }

  return {
    id: 'mentor-message',
    title: 'Mentor insight',
    description: engagement.mentorMessage,
    category: 'mentor',
    timestamp: new Date().toISOString(),
    href: '/dashboard',
    unread: true,
    priority: 'normal',
  } satisfies NotificationItem;
}

export interface DeriveNotificationsOptions {
  limit?: number;
}

export function deriveNotificationsFromEngagement(
  engagement: EngagementResponse,
  preferences: NotificationPreferences,
  options: DeriveNotificationsOptions = {},
): NotificationItem[] {
  const activityNotifications = engagement.activityHistory
    .slice()
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .map((activity) => buildActivityNotification({ activity, preferences }))
    .filter((notification): notification is NotificationItem => Boolean(notification));

  const derived = [
    buildStreakNotification(engagement, preferences),
    ...calculateGoalNotifications(engagement, preferences),
    buildMentorNotification(engagement, preferences),
  ].filter((notification): notification is NotificationItem => Boolean(notification));

  const notifications = [...activityNotifications, ...derived].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  if (options.limit && options.limit > 0) {
    return notifications.slice(0, options.limit);
  }

  return notifications;
}

export function formatTimestamp(timestamp: string): string {
  return formatRelativeTime(timestamp);
}
