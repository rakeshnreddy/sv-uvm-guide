import { describe, expect, it } from 'vitest';
import {
  recordEvent,
  computeCompetency,
  computeEngagement,
  predictPerformance,
  type AnalyticsEvent,
} from '@/lib/analytics';

describe('analytics', () => {
  const mockAssessmentEvent: AnalyticsEvent = {
    type: 'assessment',
    value: 80,
    timestamp: Date.now(),
  };

  const mockInteractionEvent: AnalyticsEvent = {
    type: 'interaction',
    value: 0,
    timestamp: Date.now(),
  };

  describe('recordEvent', () => {
    it('should append an event to the history', () => {
      const history: AnalyticsEvent[] = [];
      const updatedHistory = recordEvent(history, mockInteractionEvent);
      expect(updatedHistory).toHaveLength(1);
      expect(updatedHistory[0]).toEqual(mockInteractionEvent);
    });

    it('should not mutate original history', () => {
      const history: AnalyticsEvent[] = [mockAssessmentEvent];
      recordEvent(history, mockInteractionEvent);
      expect(history).toHaveLength(1);
    });
  });

  describe('computeCompetency', () => {
    it('should return 0 for empty history', () => {
      expect(computeCompetency([])).toBe(0);
    });

    it('should return 0 when no assessment events are present', () => {
      const history: AnalyticsEvent[] = [mockInteractionEvent, mockInteractionEvent];
      expect(computeCompetency(history)).toBe(0);
    });

    it('should calculate the average of assessment scores', () => {
      const history: AnalyticsEvent[] = [
        { type: 'assessment', value: 70, timestamp: 1 },
        { type: 'interaction', value: 0, timestamp: 2 },
        { type: 'assessment', value: 90, timestamp: 3 },
      ];
      expect(computeCompetency(history)).toBe(80);
    });

    it('should handle a single assessment score', () => {
      const history: AnalyticsEvent[] = [mockAssessmentEvent];
      expect(computeCompetency(history)).toBe(80);
    });
  });

  describe('computeEngagement', () => {
    it('should return 0 for empty history', () => {
      expect(computeEngagement([])).toBe(0);
    });

    it('should return 0 when no interaction events are present', () => {
      const history: AnalyticsEvent[] = [mockAssessmentEvent, mockAssessmentEvent];
      expect(computeEngagement(history)).toBe(0);
    });

    it('should count the number of interaction events', () => {
      const history: AnalyticsEvent[] = [
        { type: 'interaction', value: 0, timestamp: 1 },
        { type: 'assessment', value: 100, timestamp: 2 },
        { type: 'interaction', value: 0, timestamp: 3 },
        { type: 'interaction', value: 0, timestamp: 4 },
      ];
      expect(computeEngagement(history)).toBe(3);
    });
  });

  describe('predictPerformance', () => {
    it('should combine competency and engagement correctly', () => {
      // Competency = 80, Engagement = 10
      // Performance = 80 * (1 + 10 / 10) = 80 * 2 = 160
      const history: AnalyticsEvent[] = [
        { type: 'assessment', value: 80, timestamp: 1 },
        ...Array(10).fill({ type: 'interaction', value: 0, timestamp: 2 }),
      ];
      expect(predictPerformance(history)).toBe(160);
    });

    it('should return 0 when competency is 0', () => {
      const history: AnalyticsEvent[] = [mockInteractionEvent];
      expect(predictPerformance(history)).toBe(0);
    });

    it('should return competency value when engagement is 0', () => {
      const history: AnalyticsEvent[] = [mockAssessmentEvent];
      expect(predictPerformance(history)).toBe(80);
    });
  });
});
