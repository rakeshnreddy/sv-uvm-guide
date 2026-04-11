import { describe, expect, it } from 'vitest';
import {
  generateLearningPath,
  getAdaptiveChallenge,
  recordAssessment,
  predictProgress,
  updateProgress,
  recommendNextChallenge,
  type UserProfile,
  type AssessmentRecord,
  type ProgressState,
} from '@/lib/learning';

describe('learning.ts', () => {
  const mockProfile: UserProfile = {
    id: 'user-1',
    level: 2,
    completed: ['module-0', 'module-1'],
  };

  describe('generateLearningPath', () => {
    it('should return the next module based on current level', () => {
      const result = generateLearningPath(mockProfile);
      expect(result).toEqual(['module-3']);
    });

    it('should handle level 0 correctly', () => {
      const profile: UserProfile = { ...mockProfile, level: 0 };
      const result = generateLearningPath(profile);
      expect(result).toEqual(['module-1']);
    });
  });

  describe('getAdaptiveChallenge', () => {
    it('should return a challenge string referencing the level', () => {
      const result = getAdaptiveChallenge(mockProfile);
      expect(result).toBe('challenge-for-level-2');
    });

    it('should update based on profile level changes', () => {
      const profile: UserProfile = { ...mockProfile, level: 5 };
      const result = getAdaptiveChallenge(profile);
      expect(result).toBe('challenge-for-level-5');
    });
  });

  describe('recordAssessment', () => {
    it('should append a new record to the history', () => {
      const history: AssessmentRecord[] = [
        { score: 80, topic: 'SV-1', timestamp: 1000 },
      ];
      const newRecord: AssessmentRecord = { score: 90, topic: 'SV-2', timestamp: 2000 };
      const result = recordAssessment(history, newRecord);

      expect(result).toHaveLength(2);
      expect(result[1]).toEqual(newRecord);
      expect(result).not.toBe(history); // Should be a new array
    });
  });

  describe('predictProgress', () => {
    it('should return 0 for an empty history', () => {
      const result = predictProgress([]);
      expect(result).toBe(0);
    });

    it('should calculate the average score correctly', () => {
      const history: AssessmentRecord[] = [
        { score: 80, topic: 'SV-1', timestamp: 1000 },
        { score: 100, topic: 'SV-2', timestamp: 2000 },
      ];
      // Total = 180, Average = 90, result = 180 / (2 * 100) = 0.9
      const result = predictProgress(history);
      expect(result).toBe(0.9);
    });

    it('should handle perfect scores', () => {
      const history: AssessmentRecord[] = [{ score: 100, topic: 'SV-1', timestamp: 1000 }];
      expect(predictProgress(history)).toBe(1.0);
    });
  });

  describe('updateProgress', () => {
    it('should add a new completed module', () => {
      const state: ProgressState = {
        profile: { id: 'u1', level: 0, completed: [] },
        history: [],
      };
      const newState = updateProgress(state, 'mod-1');
      expect(newState.profile.completed).toContain('mod-1');
    });

    it('should not add duplicate completed modules', () => {
      const state: ProgressState = {
        profile: { id: 'u1', level: 0, completed: ['mod-1'] },
        history: [],
      };
      const newState = updateProgress(state, 'mod-1');
      expect(newState.profile.completed).toHaveLength(1);
    });

    it('should level up every two modules', () => {
      const state: ProgressState = {
        profile: { id: 'u1', level: 0, completed: ['mod-1'] },
        history: [],
      };

      // 2 modules completed => floor(2/2) = 1
      const state2 = updateProgress(state, 'mod-2');
      expect(state2.profile.level).toBe(1);

      // 3 modules completed => floor(3/2) = 1
      const state3 = updateProgress(state2, 'mod-3');
      expect(state3.profile.level).toBe(1);

      // 4 modules completed => floor(4/2) = 2
      const state4 = updateProgress(state3, 'mod-4');
      expect(state4.profile.level).toBe(2);
    });

    it('should not decrease level', () => {
      const state: ProgressState = {
        profile: { id: 'u1', level: 5, completed: ['mod-1'] },
        history: [],
      };
      const newState = updateProgress(state, 'mod-2');
      // floor(2/2) = 1, but current level is 5, so it should stay 5
      expect(newState.profile.level).toBe(5);
    });
  });

  describe('recommendNextChallenge', () => {
    it('should recommend hard difficulty if progress > 0.8', () => {
      const state: ProgressState = {
        profile: { id: 'u1', level: 3, completed: [] },
        history: [{ score: 90, topic: 'T1', timestamp: 1 }],
      };
      const result = recommendNextChallenge(state);
      expect(result).toBe('hard-challenge-level-3');
    });

    it('should recommend medium difficulty if progress > 0.5 and <= 0.8', () => {
      const state: ProgressState = {
        profile: { id: 'u1', level: 3, completed: [] },
        history: [{ score: 60, topic: 'T1', timestamp: 1 }],
      };
      const result = recommendNextChallenge(state);
      expect(result).toBe('medium-challenge-level-3');
    });

    it('should recommend easy difficulty if progress <= 0.5', () => {
      const state: ProgressState = {
        profile: { id: 'u1', level: 3, completed: [] },
        history: [{ score: 40, topic: 'T1', timestamp: 1 }],
      };
      const result = recommendNextChallenge(state);
      expect(result).toBe('easy-challenge-level-3');
    });

    it('should recommend easy if history is empty', () => {
      const state: ProgressState = {
        profile: { id: 'u1', level: 3, completed: [] },
        history: [],
      };
      const result = recommendNextChallenge(state);
      expect(result).toBe('easy-challenge-level-3');
    });
  });
});
