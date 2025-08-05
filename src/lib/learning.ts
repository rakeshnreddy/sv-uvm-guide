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
