export interface AnalyticsEvent {
  type: 'assessment' | 'interaction';
  value: number;
  timestamp: number;
}

/** Record an analytics event */
export function recordEvent(
  history: AnalyticsEvent[],
  event: AnalyticsEvent,
): AnalyticsEvent[] {
  return [...history, event];
}

/** Average assessment scores to represent competency */
export function computeCompetency(history: AnalyticsEvent[]): number {
  const assessments = history.filter(e => e.type === 'assessment');
  if (assessments.length === 0) return 0;
  return assessments.reduce((acc, e) => acc + e.value, 0) / assessments.length;
}

/** Count of interaction events as engagement metric */
export function computeEngagement(history: AnalyticsEvent[]): number {
  return history.filter(e => e.type === 'interaction').length;
}

/**
 * Predict performance by combining competency and engagement in a naive model
 */
export function predictPerformance(history: AnalyticsEvent[]): number {
  const competency = computeCompetency(history);
  const engagement = computeEngagement(history);
  return competency * (1 + engagement / 10);
}
