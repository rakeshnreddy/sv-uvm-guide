import { describe, expect, it } from "vitest";

import {
  adaptiveQuestionBank,
  adaptiveTestReducer,
  type AdaptiveTestState,
} from "@/components/assessment/AdaptiveTestEngine";

describe("adaptive assessment reducer", () => {
  it("selects questions deterministically and waits in feedback", () => {
    const intro: AdaptiveTestState = { status: "intro" };
    const first = adaptiveTestReducer(intro, { type: "START", seed: 42 });
    const replay = adaptiveTestReducer(intro, { type: "START", seed: 42 });
    expect(first).toEqual(replay);
    expect(first.status).toBe("question");
    if (first.status !== "question") throw new Error("Expected a question");

    const feedback = adaptiveTestReducer(first, { type: "SUBMIT", answer: first.question.correctAnswer });
    expect(feedback.status).toBe("feedback");
    if (feedback.status !== "feedback") throw new Error("Expected feedback");
    expect(feedback.question.id).toBe(first.question.id);

    const next = adaptiveTestReducer(feedback, { type: "NEXT" });
    expect(next.status).toBe("question");
    if (next.status === "question") expect(next.question.id).not.toBe(first.question.id);
  });

  it("completes without duplicate questions", () => {
    let state: AdaptiveTestState = adaptiveTestReducer({ status: "intro" }, { type: "START", seed: 7 });
    while (state.status !== "complete") {
      if (state.status === "question") {
        state = adaptiveTestReducer(state, { type: "SUBMIT", answer: state.question.correctAnswer });
      } else if (state.status === "feedback") {
        state = adaptiveTestReducer(state, { type: "NEXT" });
      } else {
        throw new Error("Assessment unexpectedly returned to intro");
      }
    }
    expect(state.answers).toHaveLength(adaptiveQuestionBank.length);
    expect(new Set(state.answers.map((answer) => answer.questionId)).size).toBe(adaptiveQuestionBank.length);
  });
});
