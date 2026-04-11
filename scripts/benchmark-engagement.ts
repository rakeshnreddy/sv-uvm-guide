
type UserActivityType = 'lesson_completed' | 'challenge_attempted' | 'project_submitted' | 'forum_post' | 'code_review';

interface ActivityLog {
  id: string;
  userId: string;
  type: UserActivityType;
  timestamp: Date;
  details: Record<string, any>;
}

interface EngagementPattern {
  mostActiveDay: string;
  preferredTopic: string;
  learningStyle: 'binge-learner' | 'steady-progress' | 'weekend-warrior';
}

const EMPTY_CHART_DATA = [
  { name: 'Mon', activity: 0 },
  { name: 'Tue', activity: 0 },
  { name: 'Wed', activity: 0 },
  { name: 'Thu', activity: 0 },
  { name: 'Fri', activity: 0 },
  { name: 'Sat', activity: 0 },
  { name: 'Sun', activity: 0 },
];

const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Current implementation
const analyzePatternsOriginal = (activity: ActivityLog[]): EngagementPattern => {
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

  return {
    mostActiveDay,
    preferredTopic,
    learningStyle,
  };
};

const buildActivityChartOriginal = (activity: ActivityLog[]) => {
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

// Optimized implementation
const analyzeAndChartOptimized = (activity: ActivityLog[]) => {
  if (!activity.length) {
    return {
      patterns: {
        mostActiveDay: 'N/A',
        preferredTopic: 'General Skill Building',
        learningStyle: 'binge-learner' as const,
      },
      chart: EMPTY_CHART_DATA,
    };
  }

  const dayCounts = new Int32Array(7);
  const lessonCounts = new Map<string, number>();

  let maxDayCount = -1;
  let mostActiveDayIndex = -1;

  let maxLessonCount = -1;
  let preferredTopic = 'General Skill Building';

  for (let i = 0; i < activity.length; i++) {
    const log = activity[i];
    const dayIndex = log.timestamp.getDay(); // 0-6, Sun-Sat

    // Day frequency
    dayCounts[dayIndex]++;
    if (dayCounts[dayIndex] > maxDayCount) {
      maxDayCount = dayCounts[dayIndex];
      mostActiveDayIndex = dayIndex;
    }

    // Lesson frequency
    const lesson = typeof log.details.lesson === 'string' ? log.details.lesson : null;
    if (lesson) {
      const newCount = (lessonCounts.get(lesson) ?? 0) + 1;
      lessonCounts.set(lesson, newCount);
      if (newCount > maxLessonCount) {
        maxLessonCount = newCount;
        preferredTopic = lesson;
      }
    }
  }

  const mostActiveDay = mostActiveDayIndex !== -1 ? DAYS_LONG[mostActiveDayIndex] : 'N/A';
  const learningStyle = activity.length > 5 ? 'steady-progress' : 'binge-learner';

  const orderedChart = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((name, i) => ({
    name,
    activity: dayCounts[i]
  }));

  return {
    patterns: {
      mostActiveDay,
      preferredTopic,
      learningStyle,
    },
    chart: orderedChart,
  };
};

// Generate mock data
const generateMockData = (count: number): ActivityLog[] => {
  const data: ActivityLog[] = [];
  const lessons = ['UVM Basics', 'SystemVerilog Assertions', 'RAL Fundamentals', 'FIFO Sequencer', 'Scoreboard Basics'];
  const baseTime = new Date().getTime();

  for (let i = 0; i < count; i++) {
    data.push({
      id: i.toString(),
      userId: 'user1',
      type: 'lesson_completed',
      timestamp: new Date(baseTime - Math.random() * 1000 * 60 * 60 * 24 * 30),
      details: {
        lesson: lessons[Math.floor(Math.random() * lessons.length)],
      },
    });
  }
  return data;
};

const runBenchmark = () => {
  const count = 100_000;
  console.log(`Generating ${count} mock activity logs...`);
  const data = generateMockData(count);

  console.log('Running Original Implementation...');
  const startOrig = performance.now();
  for (let i = 0; i < 10; i++) {
    analyzePatternsOriginal(data);
    buildActivityChartOriginal(data);
  }
  const endOrig = performance.now();
  console.log(`Original: Average time over 10 runs: ${((endOrig - startOrig) / 10).toFixed(2)}ms`);

  console.log('Running Optimized Implementation...');
  const startOpt = performance.now();
  for (let i = 0; i < 10; i++) {
    analyzeAndChartOptimized(data);
  }
  const endOpt = performance.now();
  console.log(`Optimized: Average time over 10 runs: ${((endOpt - startOpt) / 10).toFixed(2)}ms`);

  const improvement = ((endOrig - startOrig) - (endOpt - startOpt)) / (endOrig - startOrig) * 100;
  console.log(`Improvement: ${improvement.toFixed(2)}%`);
};

runBenchmark();
