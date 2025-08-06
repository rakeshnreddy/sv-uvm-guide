export interface UserProfile {
  id: string;
  level: number;
  completed: string[];
}

export interface AssessmentRecord {
  score: number;
  topic: string;
  timestamp: number;
}

export interface ProgressState {
  profile: UserProfile;
  history: AssessmentRecord[];
}

/**
 * Generate a simple learning path by recommending the next module based on
 * the user's current level and completed content.
 */
export function generateLearningPath(profile: UserProfile): string[] {
  const nextLevel = profile.level + 1;
  return [`module-${nextLevel}`];
}

/**
 * Provide an adaptive challenge tailored to the learner's level. In this
 * placeholder implementation we simply return a string referencing the level.
 */
export function getAdaptiveChallenge(profile: UserProfile): string {
  return `challenge-for-level-${profile.level}`;
}

/**
 * Append an assessment record for analytics purposes.
 */
export function recordAssessment(
  history: AssessmentRecord[],
  record: AssessmentRecord,
): AssessmentRecord[] {
  return [...history, record];
}

/**
 * Predict learner progress as a numeric metric between 0 and 1 by averaging
 * assessment scores.
 */
export function predictProgress(history: AssessmentRecord[]): number {
  if (history.length === 0) return 0;
  const total = history.reduce((acc, r) => acc + r.score, 0);
  return total / (history.length * 100);
}

/**
 * Update learner progress by recording completion of a module and adjusting
 * the user's level when enough modules have been completed.
 */
export function updateProgress(
  state: ProgressState,
  completedModule: string,
): ProgressState {
  if (!state.profile.completed.includes(completedModule)) {
    state.profile.completed.push(completedModule);
  }
  // Naive leveling: every two modules increases level by one.
  const newLevel = Math.floor(state.profile.completed.length / 2);
  state.profile.level = Math.max(state.profile.level, newLevel);
  return state;
}

/**
 * Recommend the next challenge based on past assessment performance. Learners
 * with high average scores receive harder challenges.
 */
export function recommendNextChallenge(state: ProgressState): string {
  const progress = predictProgress(state.history);
  const difficulty = progress > 0.8 ? "hard" : progress > 0.5 ? "medium" : "easy";
  return `${difficulty}-challenge-level-${state.profile.level}`;
}
