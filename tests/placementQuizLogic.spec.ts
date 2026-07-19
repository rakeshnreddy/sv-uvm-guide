import { describe, expect, it } from 'vitest';
import {
  calculatePlacementResults,
  PLACEMENT_ASSESSMENT_VERSION,
  PLACEMENT_SCORING_VERSION,
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

  it('does not recommend Tier 4 when methodology is below its floor', () => {
    const answers = buildAnswers((id) => correctOptionMap.get(id) ?? '');
    const methodologyQuestion = placementQuestions.find((question) => question.id === 'methodology-driver')!;
    const weakAnswer = methodologyQuestion.options.find((option) => !option.isCorrect)!.id;
    const weakened = answers.map((answer) =>
      answer.questionId === methodologyQuestion.id ? { ...answer, optionId: weakAnswer } : answer,
    );
    const result = calculatePlacementResults(placementQuestions, weakened);

    expect(result.overallPercent).toBeGreaterThan(0.85);
    expect(result.categoryScores.methodology.correct / result.categoryScores.methodology.total).toBeLessThan(0.75);
    expect(result.recommendedTier.tier).toBeLessThan(4);
  });

  it('does not count duplicate, unknown, or malformed responses', () => {
    const question = placementQuestions[0];
    const correct = correctOptionMap.get(question.id)!;
    const result = calculatePlacementResults(placementQuestions, [
      { questionId: question.id, optionId: correct },
      { questionId: question.id, optionId: correct },
      { questionId: 'unknown-question', optionId: 'anything' },
      { questionId: placementQuestions[1].id, optionId: 'unknown-option' },
    ]);

    expect(result.answeredCount).toBe(0);
    expect(result.totalCorrect).toBe(0);
    expect(result.invalidResponseCount).toBe(3);
    expect(result.isComplete).toBe(false);
    expect(result.recommendedTier.tier).toBe(1);
  });

  it('keeps scoring fixtures keyed to explicit versions', () => {
    const result = calculatePlacementResults(
      placementQuestions,
      buildAnswers((id) => correctOptionMap.get(id) ?? ''),
    );
    expect({
      assessmentVersion: result.assessmentVersion,
      scoringVersion: result.scoringVersion,
      tier: result.recommendedTier.tier,
      answeredCount: result.answeredCount,
    }).toEqual({
      assessmentVersion: PLACEMENT_ASSESSMENT_VERSION,
      scoringVersion: PLACEMENT_SCORING_VERSION,
      tier: 4,
      answeredCount: placementQuestions.length,
    });
  });
});
