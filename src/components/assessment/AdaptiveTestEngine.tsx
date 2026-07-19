"use client";

import React, { useEffect, useReducer, useState } from "react";
import { Button } from "@/components/ui/Button";

export const ADAPTIVE_ASSESSMENT_VERSION = "adaptive-v2";
export const ADAPTIVE_SCORING_VERSION = "adaptive-scoring-v1";

type Difficulty = "Easy" | "Medium" | "Hard";

export interface AdaptiveQuestion {
  id: number;
  text: string;
  options: string[];
  correctAnswer: number;
  difficulty: Difficulty;
}

export interface AdaptiveAnswer {
  questionId: number;
  optionIndex: number;
  correct: boolean;
}

export const adaptiveQuestionBank: AdaptiveQuestion[] = [
  { id: 1, text: "What does the logic data type represent in SystemVerilog?", options: ["A 4-state value", "A 2-state value", "A real number", "A string"], correctAnswer: 0, difficulty: "Easy" },
  { id: 2, text: "Which keyword defines a module?", options: ["class", "module", "package", "interface"], correctAnswer: 1, difficulty: "Easy" },
  { id: 3, text: "What is the purpose of an always_ff block?", options: ["Combinational logic", "Latched logic", "Sequential logic", "Asynchronous events"], correctAnswer: 2, difficulty: "Medium" },
  { id: 4, text: "Which UVM object supplies sequence items to a driver?", options: ["Monitor", "Scoreboard", "Sequencer", "Subscriber"], correctAnswer: 2, difficulty: "Medium" },
  { id: 5, text: "What is the primary role of the UVM factory?", options: ["Run tests", "Create registered types with override support", "Connect TLM ports", "Manage objections"], correctAnswer: 1, difficulty: "Hard" },
  { id: 6, text: "What does 100% functional coverage establish?", options: ["The design is bug-free", "All measured coverage goals were hit", "Simulation is complete", "The testbench is optimal"], correctAnswer: 1, difficulty: "Hard" },
];

export type AdaptiveTestState =
  | { status: "intro" }
  | { status: "question"; question: AdaptiveQuestion; answers: AdaptiveAnswer[]; targetDifficulty: Difficulty; seed: number }
  | { status: "feedback"; question: AdaptiveQuestion; answers: AdaptiveAnswer[]; correct: boolean; selectedAnswer: number; targetDifficulty: Difficulty; seed: number }
  | { status: "complete"; answers: AdaptiveAnswer[] };

export type AdaptiveTestAction =
  | { type: "START"; seed: number }
  | { type: "SUBMIT"; answer: number }
  | { type: "NEXT" }
  | { type: "RETAKE" };

function nextDifficulty(current: Difficulty, correct: boolean): Difficulty {
  const levels: Difficulty[] = ["Easy", "Medium", "Hard"];
  const currentIndex = levels.indexOf(current);
  return levels[Math.max(0, Math.min(levels.length - 1, currentIndex + (correct ? 1 : -1)))];
}

function seededIndex(seed: number, length: number): number {
  let value = seed | 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return Math.abs((value ^ (value >>> 16)) % length);
}

function selectQuestion(
  answers: readonly AdaptiveAnswer[],
  targetDifficulty: Difficulty,
  seed: number,
): AdaptiveTestState {
  const answered = new Set(answers.map((answer) => answer.questionId));
  const remaining = adaptiveQuestionBank.filter((question) => !answered.has(question.id));
  if (remaining.length === 0) return { status: "complete", answers: [...answers] };
  const preferred = remaining.filter((question) => question.difficulty === targetDifficulty);
  const candidates = preferred.length > 0 ? preferred : remaining;
  return {
    status: "question",
    question: candidates[seededIndex(seed, candidates.length)],
    answers: [...answers],
    targetDifficulty,
    seed,
  };
}

export function adaptiveTestReducer(state: AdaptiveTestState, action: AdaptiveTestAction): AdaptiveTestState {
  switch (action.type) {
    case "START":
      return selectQuestion([], "Easy", action.seed);
    case "SUBMIT": {
      if (state.status !== "question" || action.answer < 0 || action.answer >= state.question.options.length) return state;
      const correct = action.answer === state.question.correctAnswer;
      const answers = [...state.answers, { questionId: state.question.id, optionIndex: action.answer, correct }];
      return {
        status: "feedback",
        question: state.question,
        answers,
        correct,
        selectedAnswer: action.answer,
        targetDifficulty: nextDifficulty(state.question.difficulty, correct),
        seed: state.seed,
      };
    }
    case "NEXT":
      return state.status === "feedback"
        ? selectQuestion(state.answers, state.targetDifficulty, state.seed + 1)
        : state;
    case "RETAKE":
      return { status: "intro" };
    default:
      return state;
  }
}

export const AdaptiveTestEngine = () => {
  const [state, dispatch] = useReducer(adaptiveTestReducer, { status: "intro" });
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);

  useEffect(() => {
    if (state.status !== "complete") return;
    void fetch("/api/me/assessments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assessmentId: "adaptive-test",
        assessmentVersion: ADAPTIVE_ASSESSMENT_VERSION,
        scoringVersion: ADAPTIVE_SCORING_VERSION,
        responses: state.answers.map((answer) => ({
          questionId: String(answer.questionId),
          optionId: String(answer.optionIndex),
        })),
      }),
    }).catch(() => undefined);
  }, [state]);

  if (state.status === "intro") {
    return (
      <section className="my-6 rounded-lg border border-dashed border-white/30 bg-white/5 p-4">
        <h2 className="mb-4 text-2xl font-bold text-primary">Adaptive Test Engine</h2>
        <div className="text-center">
          <h3 className="mb-2 text-xl font-semibold text-primary">Ready to test your knowledge?</h3>
          <Button onClick={() => dispatch({ type: "START", seed: 0x5eed })}>Start quiz</Button>
        </div>
      </section>
    );
  }

  if (state.status === "complete") {
    const score = state.answers.filter((answer) => answer.correct).length;
    return (
      <section className="my-6 rounded-lg border border-dashed border-white/30 bg-white/5 p-4 text-center">
        <h2 className="text-2xl font-bold text-primary">Quiz complete</h2>
        <p className="mt-2">Your final score is {score} / {adaptiveQuestionBank.length}.</p>
        <Button onClick={() => dispatch({ type: "RETAKE" })} className="mt-4">Play again</Button>
      </section>
    );
  }

  const showingFeedback = state.status === "feedback";
  const score = state.answers.filter((answer) => answer.correct).length;
  const answer = showingFeedback ? state.selectedAnswer : selectedAnswer;

  return (
    <section className="my-6 rounded-lg border border-dashed border-white/30 bg-white/5 p-4">
      <h2 className="mb-4 text-2xl font-bold text-primary">Adaptive Test Engine</h2>
      <p className="mb-2 text-sm text-muted-foreground">Difficulty: {state.question.difficulty} · Score: {score}</p>
      <h3 className="mb-4 text-lg font-semibold">{state.question.text}</h3>
      <div className="space-y-2">
        {state.question.options.map((option, index) => (
          <Button
            key={option}
            variant={answer === index ? "default" : "outline"}
            onClick={() => setSelectedAnswer(index)}
            className="w-full justify-start text-left"
            disabled={showingFeedback}
          >
            {option}
          </Button>
        ))}
      </div>
      {!showingFeedback ? (
        <Button
          onClick={() => {
            if (selectedAnswer === null) return;
            dispatch({ type: "SUBMIT", answer: selectedAnswer });
          }}
          disabled={selectedAnswer === null}
          className="mt-4"
        >
          Submit
        </Button>
      ) : (
        <>
          <p className="mt-4 text-center font-semibold" aria-live="polite">
            {state.correct ? "Correct!" : "Incorrect. The correct answer was: " + state.question.options[state.question.correctAnswer]}
          </p>
          <Button
            onClick={() => {
              setSelectedAnswer(null);
              dispatch({ type: "NEXT" });
            }}
            className="mt-4"
          >
            Next question
          </Button>
        </>
      )}
    </section>
  );
};

export default AdaptiveTestEngine;
