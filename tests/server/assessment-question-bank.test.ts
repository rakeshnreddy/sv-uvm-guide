import { describe, expect, it } from "vitest";

import { adaptiveQuestionBank } from "@/components/assessment/AdaptiveTestEngine";
import { placementQuestions } from "@/components/assessment/placementQuizData";
import {
  AssessmentSubmissionError,
  assessmentQuestionBanks,
  gradeAssessmentSubmission,
} from "@/server/assessment-question-bank";

describe("versioned server assessment bank", () => {
  it("stays aligned with the adaptive and placement question definitions", () => {
    expect(assessmentQuestionBanks["adaptive-test"].questions.map((question) => ({
      id: question.id,
      correctOptionId: question.correctOptionId,
    }))).toEqual(adaptiveQuestionBank.map((question) => ({
      id: String(question.id),
      correctOptionId: String(question.correctAnswer),
    })));
    expect(assessmentQuestionBanks.placement.questions.map((question) => ({
      id: question.id,
      correctOptionId: question.correctOptionId,
    }))).toEqual(placementQuestions.map((question) => ({
      id: question.id,
      correctOptionId: question.options.find((option) => option.isCorrect)?.id,
    })));
  });

  it("calculates correctness exclusively from canonical option IDs", () => {
    const bank = assessmentQuestionBanks["adaptive-test"];
    const result = gradeAssessmentSubmission({
      assessmentId: "adaptive-test",
      assessmentVersion: bank.assessmentVersion,
      scoringVersion: bank.scoringVersion,
      responses: bank.questions.map((question) => ({
        questionId: question.id,
        optionId: question.correctOptionId,
      })),
    });

    expect(result.score).toBe(1);
    expect(result.responses.every((response) => response.isCorrect)).toBe(true);
  });

  it("rejects incomplete, unknown, and arbitrary response sets", () => {
    const bank = assessmentQuestionBanks["adaptive-test"];
    expect(() => gradeAssessmentSubmission({
      assessmentId: "adaptive-test",
      assessmentVersion: bank.assessmentVersion,
      scoringVersion: bank.scoringVersion,
      responses: [{ questionId: "forged", optionId: "0" }],
    })).toThrow(new AssessmentSubmissionError("ASSESSMENT_RESPONSE_SET_MISMATCH"));

    expect(() => gradeAssessmentSubmission({
      assessmentId: "adaptive-test",
      assessmentVersion: bank.assessmentVersion,
      scoringVersion: bank.scoringVersion,
      responses: bank.questions.map(() => ({ questionId: "1", optionId: "0" })),
    })).toThrow(new AssessmentSubmissionError("ASSESSMENT_RESPONSE_SET_MISMATCH"));
  });
});
