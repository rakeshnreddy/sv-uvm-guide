export type AssessmentId = "adaptive-test" | "placement";

interface AssessmentQuestionDefinition {
  id: string;
  optionIds: readonly string[];
  correctOptionId: string;
}

interface AssessmentDefinition {
  assessmentVersion: string;
  scoringVersion: string;
  questions: readonly AssessmentQuestionDefinition[];
}

const fourIndexedOptions = ["0", "1", "2", "3"] as const;

export const assessmentQuestionBanks: Record<AssessmentId, AssessmentDefinition> = {
  "adaptive-test": {
    assessmentVersion: "adaptive-v2",
    scoringVersion: "adaptive-scoring-v1",
    questions: [
      { id: "1", optionIds: fourIndexedOptions, correctOptionId: "0" },
      { id: "2", optionIds: fourIndexedOptions, correctOptionId: "1" },
      { id: "3", optionIds: fourIndexedOptions, correctOptionId: "2" },
      { id: "4", optionIds: fourIndexedOptions, correctOptionId: "2" },
      { id: "5", optionIds: fourIndexedOptions, correctOptionId: "1" },
      { id: "6", optionIds: fourIndexedOptions, correctOptionId: "1" },
    ],
  },
  placement: {
    assessmentVersion: "placement-v2",
    scoringVersion: "placement-scoring-v2",
    questions: [
      { id: "foundations-logic-range", optionIds: ["logic", "bit", "byte", "reg"], correctOptionId: "logic" },
      { id: "foundations-always-block", optionIds: ["always_comb", "always_ff", "always", "initial"], correctOptionId: "always_comb" },
      { id: "foundations-interface", optionIds: ["modport", "typedef", "virtual", "alias"], correctOptionId: "modport" },
      { id: "foundations-constraint", optionIds: ["dist", "randc", "foreach", "constraint_mode"], correctOptionId: "dist" },
      { id: "methodology-driver", optionIds: ["item_done", "grab", "disable", "raise_objection"], correctOptionId: "item_done" },
      { id: "methodology-config", optionIds: ["get_build", "set_time", "factory", "analysis"], correctOptionId: "get_build" },
      { id: "methodology-passive", optionIds: ["passive", "disable_run", "build_phase", "factory_override"], correctOptionId: "passive" },
      { id: "debug-coverage", optionIds: ["targeted_test", "ignore_bins", "force_coverage", "weight_zero"], correctOptionId: "targeted_test" },
      { id: "debug-objections", optionIds: ["test_owned", "scoreboard_owned", "global", "fixed_delay"], correctOptionId: "test_owned" },
      { id: "debug-waveform", optionIds: ["seed_waveform", "disable_backpressure", "increase_timeout", "random_seed"], correctOptionId: "seed_waveform" },
    ],
  },
};

export class AssessmentSubmissionError extends Error {
  constructor(
    public readonly code: "ASSESSMENT_VERSION_MISMATCH" | "ASSESSMENT_RESPONSE_SET_MISMATCH",
  ) {
    super(code);
    this.name = "AssessmentSubmissionError";
  }
}

export function gradeAssessmentSubmission(input: {
  assessmentId: AssessmentId;
  assessmentVersion: string;
  scoringVersion: string;
  responses: { questionId: string; optionId: string }[];
}) {
  const bank = assessmentQuestionBanks[input.assessmentId];
  if (
    input.assessmentVersion !== bank.assessmentVersion ||
    input.scoringVersion !== bank.scoringVersion
  ) {
    throw new AssessmentSubmissionError("ASSESSMENT_VERSION_MISMATCH");
  }

  const questions = new Map(bank.questions.map((question) => [question.id, question]));
  const submittedQuestionIds = new Set(input.responses.map((response) => response.questionId));
  if (
    input.responses.length !== bank.questions.length ||
    submittedQuestionIds.size !== bank.questions.length ||
    input.responses.some((response) => {
      const question = questions.get(response.questionId);
      return !question || !question.optionIds.includes(response.optionId);
    })
  ) {
    throw new AssessmentSubmissionError("ASSESSMENT_RESPONSE_SET_MISMATCH");
  }

  const responses = input.responses.map((response) => {
    const question = questions.get(response.questionId)!;
    const isCorrect = response.optionId === question.correctOptionId;
    return { ...response, isCorrect, score: isCorrect ? 1 : 0 };
  });
  const correct = responses.reduce((total, response) => total + response.score, 0);
  return { responses, score: correct / bank.questions.length };
}
