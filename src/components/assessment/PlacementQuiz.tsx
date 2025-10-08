"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Progress } from "@/components/ui/Progress";
import {
  placementQuestions,
  calculatePlacementResults,
  placementCategoryFocus,
  PlacementQuestion,
  PlacementAnswer,
} from "@/components/assessment/placementQuizData";

type Stage = "intro" | "question" | "results";

interface FeedbackState {
  status: "correct" | "incorrect";
  message: string;
}

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

const confidenceBand = (value: number) => {
  if (value >= 0.85) return { label: "High", description: "You consistently apply advanced verification patterns." };
  if (value >= 0.65) return { label: "Steady", description: "Core skills are strong—reinforce edge-case playbooks." };
  if (value >= 0.4) return { label: "Emerging", description: "Foundational understanding is forming; keep practicing." };
  return { label: "Building", description: "Start with guided fundamentals to accelerate confidence." };
};

export const PlacementQuiz: React.FC = () => {
  const totalQuestions = placementQuestions.length;
  const [stage, setStage] = useState<Stage>("intro");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [answers, setAnswers] = useState<PlacementAnswer[]>([]);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const currentQuestion: PlacementQuestion | undefined = placementQuestions[currentIndex];

  const results = useMemo(() => {
    if (stage !== "results") return null;
    return calculatePlacementResults(placementQuestions, answers);
  }, [stage, answers]);

  const startQuiz = () => {
    setStage("question");
    setCurrentIndex(0);
    setSelectedOption(null);
    setAnswers([]);
    setFeedback(null);
  };

  const recordAnswer = (questionId: string, optionId: string) => {
    setAnswers((prev) => {
      const remaining = prev.filter((entry) => entry.questionId !== questionId);
      return [...remaining, { questionId, optionId }];
    });
  };

  const handleSubmit = () => {
    if (!currentQuestion || !selectedOption) return;
    recordAnswer(currentQuestion.id, selectedOption);

    const isCorrect = currentQuestion.options.some(
      (option) => option.id === selectedOption && option.isCorrect,
    );

    setFeedback({
      status: isCorrect ? "correct" : "incorrect",
      message: currentQuestion.rationale,
    });
  };

  const handleNext = () => {
    if (!currentQuestion) return;

    const isLast = currentIndex === totalQuestions - 1;
    if (isLast) {
      setStage("results");
      setFeedback(null);
      setSelectedOption(null);
      return;
    }

    setCurrentIndex((prev) => prev + 1);
    setSelectedOption(null);
    setFeedback(null);
  };

  const handleRetake = () => {
    setStage("intro");
    setCurrentIndex(0);
    setSelectedOption(null);
    setAnswers([]);
    setFeedback(null);
  };

  if (stage === "intro") {
    return (
      <section className="glass-card border border-white/10 bg-[var(--blueprint-glass)] p-8 shadow-xl">
        <p className="text-xs uppercase tracking-[0.35em] text-[rgba(230,241,255,0.65)]">Skill placement</p>
        <h1 className="mt-4 text-4xl font-semibold text-[var(--blueprint-foreground)]">Find the right starting tier</h1>
        <p className="mt-3 max-w-2xl text-sm text-[rgba(230,241,255,0.75)]">
          Answer ten focused questions spanning SystemVerilog foundations, UVM methodology, and debug habits. Each
          response updates your readiness profile so we can recommend the next curriculum tier and specific follow-up
          drills.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Button size="lg" onClick={startQuiz}>
            Start the assessment
          </Button>
          <span className="text-xs text-[rgba(230,241,255,0.6)]">Average completion time: 6 minutes</span>
        </div>
      </section>
    );
  }

  if (stage === "results" && results) {
    const confidence = confidenceBand(results.overallPercent);
    const sortedCategories = Object.entries(results.categoryScores).map(([category, value]) => {
      const percent = value.total > 0 ? value.correct / value.total : 0;
      return {
        id: category as keyof typeof placementCategoryFocus,
        ...placementCategoryFocus[category as keyof typeof placementCategoryFocus],
        percent,
      };
    });

    const focusCategories = sortedCategories.filter((category) => category.percent < 0.75);

    return (
      <div className="space-y-10">
        <header className="glass-card border border-white/10 bg-[var(--blueprint-glass)] p-8 shadow-xl">
          <h2 className="text-3xl font-semibold text-[var(--blueprint-foreground)]">Placement summary</h2>
          <p className="mt-2 text-sm text-[rgba(230,241,255,0.75)]">
            We analysed {results.totalQuestions} responses to determine your curriculum starting point. Scores account for
            question difficulty, so advanced wins weigh slightly more than introductory items.
          </p>
          <dl className="mt-6 grid gap-6 md:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-[0.2em] text-[rgba(230,241,255,0.55)]">Recommended tier</dt>
              <dd className="mt-2 text-xl font-semibold text-[var(--blueprint-foreground)]">
                {results.recommendedTier.label}
              </dd>
              <p className="mt-1 text-xs text-[rgba(230,241,255,0.65)]">{results.recommendedTier.summary}</p>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.2em] text-[rgba(230,241,255,0.55)]">Overall accuracy</dt>
              <dd className="mt-2 text-xl font-semibold text-[var(--blueprint-foreground)]">
                {formatPercent(results.overallPercent)} ({results.totalCorrect}/{results.totalQuestions})
              </dd>
              <p className="mt-1 text-xs text-[rgba(230,241,255,0.65)]">
                Weighted across difficulty bands for a sharper placement decision.
              </p>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.2em] text-[rgba(230,241,255,0.55)]">Confidence band</dt>
              <dd className="mt-2 text-xl font-semibold text-[var(--blueprint-foreground)]">{confidence.label}</dd>
              <p className="mt-1 text-xs text-[rgba(230,241,255,0.65)]">{confidence.description}</p>
            </div>
          </dl>
          <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-inner">
            <h3 className="text-sm font-semibold text-[var(--blueprint-foreground)]">Next-step focus</h3>
            <p className="mt-2 text-xs text-[rgba(230,241,255,0.7)]">
              {results.recommendedTier.focus}
            </p>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-3">
          {sortedCategories.map((category) => (
            <article
              key={category.id}
              className="glass-card border border-white/10 bg-[var(--blueprint-glass)] p-6"
            >
              <div className="flex items-baseline justify-between">
                <h3 className="text-lg font-semibold text-primary">{category.title}</h3>
                <span className="text-sm font-semibold text-primary/80">{formatPercent(category.percent)}</span>
              </div>
              <p className="mt-2 text-sm text-[rgba(230,241,255,0.75)]">{category.summary}</p>
              <ul className="mt-4 space-y-2 text-xs text-[rgba(230,241,255,0.7)]">
                {category.resources.map((resource) => (
                  <li key={resource.href} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[var(--blueprint-accent)]" />
                    <Link href={resource.href} className="underline-offset-2 hover:underline">
                      {resource.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        {focusCategories.length > 0 && (
          <section className="glass-card border border-white/10 bg-[var(--blueprint-glass)] p-6">
            <h3 className="text-lg font-semibold text-primary">Priority follow-up</h3>
            <p className="mt-2 text-sm text-[rgba(230,241,255,0.75)]">
              These domains scored below 75%. Schedule refreshers or labs before advancing.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {focusCategories.map((category) => (
                <div key={category.id} className="rounded-2xl border border-white/15 bg-white/5 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[var(--blueprint-foreground)]">
                      {category.title}
                    </span>
                    <span className="text-xs text-[rgba(230,241,255,0.65)]">
                      {formatPercent(category.percent)} correct
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-[rgba(230,241,255,0.7)]">{category.summary}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="secondary" onClick={handleRetake}>
            Retake assessment
          </Button>
          <Button asChild>
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return null;
  }

  const progressValue = ((currentIndex + (feedback ? 1 : 0)) / totalQuestions) * 100;

  return (
    <section className="glass-card border border-white/10 bg-[var(--blueprint-glass)] p-8 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-[rgba(230,241,255,0.65)]">Question {currentIndex + 1} of {totalQuestions}</p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--blueprint-foreground)]">{currentQuestion.prompt}</h2>
        </div>
        <div className="text-right text-xs text-[rgba(230,241,255,0.65)]">
          <p>Category: {titleCase(currentQuestion.category)}</p>
          <p>Difficulty: {titleCase(currentQuestion.difficulty)}</p>
        </div>
      </div>

      <div className="mt-6">
        <Progress value={progressValue} />
      </div>

      <div className="mt-6 grid gap-3">
        {currentQuestion.options.map((option) => {
          const isSelected = selectedOption === option.id;
          const isCorrect = feedback && option.isCorrect;
          const isIncorrect = feedback && isSelected && !option.isCorrect;

          return (
            <button
              key={option.id}
              type="button"
              disabled={Boolean(feedback)}
              onClick={() => setSelectedOption(option.id)}
              className={[
                "flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition",
                "border-white/10 bg-white/5 text-[var(--blueprint-foreground)] hover:border-[var(--blueprint-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--blueprint-accent)]",
                isSelected ? "border-[var(--blueprint-accent)] bg-[var(--blueprint-accent)]/10" : "",
                isCorrect ? "border-green-400/70 bg-green-400/10" : "",
                isIncorrect ? "border-rose-400/70 bg-rose-500/10" : "",
                feedback ? "cursor-not-allowed" : "",
              ].join(" ")}
            >
              <span className="text-sm font-medium">{option.label}</span>
              {feedback && option.isCorrect && (
                <span className="text-xs font-semibold uppercase tracking-wide text-green-200">Correct</span>
              )}
              {feedback && isIncorrect && (
                <span className="text-xs font-semibold uppercase tracking-wide text-rose-200">Incorrect</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {!feedback && (
          <Button onClick={handleSubmit} disabled={!selectedOption}>
            Submit answer
          </Button>
        )}
        {feedback && (
          <Button onClick={handleNext}>
            {currentIndex === totalQuestions - 1 ? "View results" : "Next question"}
          </Button>
        )}
        <span className="text-xs text-[rgba(230,241,255,0.65)]">
          {answers.length} of {totalQuestions} questions answered
        </span>
      </div>

      {feedback && (
        <div
          className={`mt-6 rounded-3xl border px-5 py-4 text-sm shadow-inner ${
            feedback.status === "correct"
              ? "border-green-400/40 bg-green-400/10 text-green-50"
              : "border-rose-400/40 bg-rose-500/15 text-rose-50"
          }`}
        >
          <p className="font-semibold">
            {feedback.status === "correct" ? "Nice work —" : "Let's adjust —"}
          </p>
          <p className="mt-1 text-xs leading-relaxed">{feedback.message}</p>
        </div>
      )}
    </section>
  );
};

const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export default PlacementQuiz;
