import { describe, expect, it } from 'vitest';
import {
  calculatePlacementResults,
  placementQuestions,
  PlacementAnswer,
  PlacementCategory,
} from '@/components/assessment/placementQuizData';

const buildAnswers = (selector: (questionId: string) => string): PlacementAnswer[] =>
  placementQuestions.map((question) => ({
    questionId: question.id,
    optionId: selector(question.id),
  }));

const correctOptionMap = new Map(
  placementQuestions.map((question) => [
    question.id,
    question.options.find((option) => option.isCorrect)?.id ?? '',
  ]),
);

const wrongOptionMap = new Map(
  placementQuestions.map((question) => {
    const fallback = question.options.find((option) => !option.isCorrect)?.id ?? '';
    return [question.id, fallback];
  }),
);

describe('calculatePlacementResults', () => {
  it('recommends Tier 4 when all answers are correct', () => {
    const answers = buildAnswers((id) => correctOptionMap.get(id) ?? '');
    const results = calculatePlacementResults(placementQuestions, answers);

    expect(results.totalCorrect).toBe(placementQuestions.length);
    expect(results.recommendedTier.tier).toBe(4);
    expect(results.overallPercent).toBeGreaterThan(0.85);
    for (const category of Object.keys(results.categoryScores) as PlacementCategory[]) {
      expect(results.categoryScores[category].correct).toBe(results.categoryScores[category].total);
    }
  });

  it('recommends Tier 1 when every answer is incorrect', () => {
    const answers = buildAnswers((id) => wrongOptionMap.get(id) ?? '');
    const results = calculatePlacementResults(placementQuestions, answers);

    expect(results.totalCorrect).toBe(0);
    expect(results.overallPercent).toBe(0);
    expect(results.recommendedTier.tier).toBe(1);
  });

  it('tracks category scores independently', () => {
    const answers = placementQuestions.map((question) => {
      const correct = correctOptionMap.get(question.id) ?? '';
      const incorrect = question.options.find((option) => !option.isCorrect)?.id ?? '';
      const optionId = question.category === 'foundations' ? correct : incorrect;
      return { questionId: question.id, optionId };
    });

    const results = calculatePlacementResults(placementQuestions, answers);

    expect(results.categoryScores.foundations.correct).toBe(results.categoryScores.foundations.total);
    expect(results.categoryScores.methodology.correct).toBe(0);
    expect(results.categoryScores.debug.correct).toBe(0);
    expect(results.recommendedTier.tier).toBeLessThan(4);
  });
});

