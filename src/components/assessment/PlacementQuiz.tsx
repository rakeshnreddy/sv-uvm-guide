"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import {
  placementQuestions,
  calculatePlacementResults,
  placementCategoryFocus,
  PLACEMENT_ASSESSMENT_VERSION,
  PLACEMENT_SCORING_VERSION,
  type PlacementCategory,
  type PlacementQuestion,
  type PlacementAnswer,
  type PlacementResults,
} from "@/components/assessment/placementQuizData";
import type { PlacementPlan } from "@/lib/learning-paths";
import { routeAnchor, writeSelectedRoute, type RouteId } from "@/lib/learning-route-state";
import { useHydrated, useRecord } from "@/lib/learner-store/react";
import { writeOutcomeMessage, type WriteOutcome } from "@/lib/learner-store/record";
import { recordActivity } from "@/lib/learner-store/repositories/activity";
import {
  addPlacementAttempt,
  assessmentRecord,
  latestPlacementAttempt,
  type PlacementAttempt,
} from "@/lib/learner-store/repositories/assessments";
import { usePersistenceTarget } from "@/lib/persistence/target";
import { cn } from "@/lib/utils";

type Stage = "intro" | "question" | "results";

interface FeedbackState {
  status: "correct" | "incorrect";
  message: string;
  correctLabel: string;
}

export interface PlacementQuizProps {
  /** Start lesson, route and skim list for each recommended tier (1–4), resolved on the server from the manifest. */
  plans: Readonly<Record<number, PlacementPlan>>;
}

const panel = "rounded-3xl border border-border bg-card p-5 text-card-foreground shadow-sm sm:p-8";
const eyebrow = "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";
const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const primaryLink = cn(
  "inline-flex min-h-[44px] items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90",
  focusRing,
);
const secondaryLink = cn(
  "inline-flex min-h-[44px] items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:border-primary",
  focusRing,
);
const textLink = cn("rounded-sm font-medium text-primary underline-offset-4 hover:underline", focusRing);

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const dateFormat = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" });

/** The attempt saved in this browser for a complete result. Percentages are fractions from 0 to 1. */
export function toPlacementAttempt(
  results: PlacementResults,
  answers: readonly PlacementAnswer[],
  completedAt: number,
): PlacementAttempt {
  return {
    assessmentVersion: results.assessmentVersion,
    scoringVersion: results.scoringVersion,
    responses: answers.map(({ questionId, optionId }) => ({ questionId, optionId })),
    tier: results.recommendedTier.tier,
    routeId: results.recommendedTier.route.routeId,
    percent: results.overallPercent,
    categories: (Object.keys(results.categoryScores) as PlacementCategory[]).map((id) => {
      const score = results.categoryScores[id];
      return { id, percent: score.total > 0 ? score.correct / score.total : 0 };
    }),
    completedAt,
  };
}

/**
 * The saved attempt's answers, when they rebuild the same plan with the current
 * questions: every question answered once with a known option, giving the
 * saved tier and route. Null otherwise (an earlier quiz, or an imported or
 * edited attempt with missing answers), so "See your plan" never shows a plan
 * that contradicts the saved result.
 */
function replayableAnswers(attempt: PlacementAttempt | null): PlacementAnswer[] | null {
  if (
    !attempt ||
    attempt.assessmentVersion !== PLACEMENT_ASSESSMENT_VERSION ||
    attempt.scoringVersion !== PLACEMENT_SCORING_VERSION
  ) {
    return null;
  }
  const answers = attempt.responses.map(({ questionId, optionId }) => ({ questionId, optionId }));
  const replay = calculatePlacementResults(placementQuestions, answers);
  if (!replay.isComplete) return null;
  if (replay.recommendedTier.tier !== attempt.tier || replay.recommendedTier.route.routeId !== attempt.routeId) return null;
  return answers;
}

function routeNameFor(plans: Readonly<Record<number, PlacementPlan>>, routeId: RouteId): string {
  return Object.values(plans).find((plan) => plan.routeId === routeId)?.routeName ?? titleCase(routeId);
}

const confidenceBand = (value: number) => {
  if (value >= 0.85) return { label: "High", description: "You consistently apply advanced verification patterns." };
  if (value >= 0.65) return { label: "Steady", description: "Core skills are strong; reinforce the edge cases." };
  if (value >= 0.4) return { label: "Emerging", description: "Foundational understanding is forming; keep practising." };
  return { label: "Building", description: "Start with the guided fundamentals to build confidence." };
};

/** Renders `code` spans written with backticks in question and option text. */
function InlineCode({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith("`") && part.endsWith("`") ? (
          <code
            key={index}
            className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em] text-foreground [font-variant-ligatures:none]"
          >
            {part.slice(1, -1)}
          </code>
        ) : (
          <React.Fragment key={index}>{part}</React.Fragment>
        ),
      )}
    </>
  );
}

export const PlacementQuiz: React.FC<PlacementQuizProps> = ({ plans }) => {
  const totalQuestions = placementQuestions.length;
  const [stage, setStage] = useState<Stage>("intro");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [answers, setAnswers] = useState<PlacementAnswer[]>([]);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [saveOutcome, setSaveOutcome] = useState<WriteOutcome | null>(null);
  const [routeConfirmation, setRouteConfirmation] = useState<string | null>(null);

  // The last attempt saved in this browser; shown only after hydration, so the server render stays neutral.
  const hydrated = useHydrated();
  const assessments = useRecord(assessmentRecord);
  const lastAttempt = hydrated ? latestPlacementAttempt(assessments) : null;
  const lastAnswers = useMemo(() => replayableAnswers(lastAttempt), [lastAttempt]);
  const { target } = usePersistenceTarget();
  // Each completed set of answers is saved once (and sent to the account once), whatever re-renders.
  const savedAnswers = useRef<readonly PlacementAnswer[] | null>(null);
  const postedAnswers = useRef<readonly PlacementAnswer[] | null>(null);

  const questionHeadingRef = useRef<HTMLHeadingElement>(null);
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null);
  // Focus moves only after a learner action, never on first render.
  const pendingFocus = useRef<"question" | "next" | "results" | "start" | null>(null);

  const currentQuestion: PlacementQuestion | undefined = placementQuestions[currentIndex];

  const results = useMemo(() => {
    if (stage !== "results") return null;
    return calculatePlacementResults(placementQuestions, answers);
  }, [stage, answers]);

  useEffect(() => {
    if (!results?.isComplete) return;
    if (savedAnswers.current !== answers) {
      savedAnswers.current = answers;
      const completedAt = Date.now();
      setSaveOutcome(addPlacementAttempt(toPlacementAttempt(results, answers, completedAt)));
      recordActivity("placement", completedAt);
    }
    // Only signed-in learners whose records live on the server send the attempt to their account.
    if (target === "server" && postedAnswers.current !== answers) {
      postedAnswers.current = answers;
      void fetch("/api/me/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentId: "placement",
          assessmentVersion: results.assessmentVersion,
          scoringVersion: results.scoringVersion,
          responses: answers,
        }),
      }).catch(() => undefined);
    }
  }, [answers, results, target]);

  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    const element = {
      question: questionHeadingRef.current,
      next: nextButtonRef.current,
      results: resultsHeadingRef.current,
      start: startButtonRef.current,
    }[target];
    element?.focus();
  }, [stage, currentIndex, feedback]);

  const startQuiz = () => {
    pendingFocus.current = "question";
    setStage("question");
    setCurrentIndex(0);
    setSelectedOption(null);
    setAnswers([]);
    setFeedback(null);
    setSaveOutcome(null);
    setRouteConfirmation(null);
  };

  /** Shows the saved attempt's result again. It was saved when it was taken, so nothing is written or sent. */
  const showLastResult = () => {
    if (!lastAnswers) return;
    const restored = lastAnswers;
    savedAnswers.current = restored;
    postedAnswers.current = restored;
    pendingFocus.current = "results";
    setAnswers(restored);
    setFeedback(null);
    setSelectedOption(null);
    setSaveOutcome(null);
    setRouteConfirmation(null);
    setStage("results");
  };

  const followRoute = (plan: PlacementPlan) => {
    writeSelectedRoute(plan.routeId);
    setRouteConfirmation(
      `You're following the ${plan.routeName} route. The curriculum page and your dashboard show your next lesson on it.`,
    );
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

    const correct = currentQuestion.options.find((option) => option.isCorrect);
    const isCorrect = correct?.id === selectedOption;

    pendingFocus.current = "next";
    setFeedback({
      status: isCorrect ? "correct" : "incorrect",
      message: currentQuestion.rationale,
      correctLabel: correct?.label ?? "",
    });
  };

  const handleNext = () => {
    if (!currentQuestion) return;

    const isLast = currentIndex === totalQuestions - 1;
    if (isLast) {
      pendingFocus.current = "results";
      setStage("results");
      setFeedback(null);
      setSelectedOption(null);
      return;
    }

    pendingFocus.current = "question";
    setCurrentIndex((prev) => prev + 1);
    setSelectedOption(null);
    setFeedback(null);
  };

  const handleRetake = () => {
    pendingFocus.current = "start";
    setStage("intro");
    setCurrentIndex(0);
    setSelectedOption(null);
    setAnswers([]);
    setFeedback(null);
    setSaveOutcome(null);
    setRouteConfirmation(null);
  };

  if (stage === "intro") {
    const lastIsCurrent =
      lastAttempt !== null &&
      lastAttempt.assessmentVersion === PLACEMENT_ASSESSMENT_VERSION &&
      lastAttempt.scoringVersion === PLACEMENT_SCORING_VERSION;
    return (
      <section aria-labelledby="placement-start-heading" className={panel}>
        <h2 id="placement-start-heading" className="text-2xl font-semibold text-foreground">
          Ten questions, about six minutes
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          The questions span SystemVerilog foundations, UVM methodology and debug habits. Each answer shows why it is
          right or wrong. Harder questions weigh more, and the result names the lesson to start at. Your result is
          saved in this browser and shows on your{" "}
          <Link href="/dashboard" className={cn(textLink, "underline")}>
            dashboard
          </Link>
          .
        </p>
        {lastAttempt && (
          <div className="mt-5 rounded-2xl border border-border bg-background p-4 text-sm" data-testid="placement-last-result">
            {lastIsCurrent ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-foreground">
                    Your last result: Tier {lastAttempt.tier} on the {routeNameFor(plans, lastAttempt.routeId)} route,{" "}
                    {formatPercent(lastAttempt.percent)} · {dateFormat.format(lastAttempt.completedAt)}
                  </p>
                  {!lastAnswers && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      The full plan for this attempt can&apos;t be rebuilt here. Retake the quiz to see one.
                    </p>
                  )}
                </div>
                {lastAnswers && (
                  <Button variant="outline" onClick={showLastResult} className="min-h-[44px]">
                    See your plan
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-foreground">The quiz changed since your last attempt. Retake it.</p>
            )}
          </div>
        )}
        <div className="mt-6">
          <Button ref={startButtonRef} size="lg" onClick={startQuiz} className="min-h-[44px]">
            Start the quiz
          </Button>
        </div>
      </section>
    );
  }

  if (stage === "results" && results) {
    const recommendation = results.recommendedTier;
    const plan = plans[recommendation.tier];
    const saveMessage = saveOutcome ? writeOutcomeMessage(saveOutcome) : null;
    const confidence = confidenceBand(results.overallPercent);
    const categories = (Object.keys(results.categoryScores) as PlacementCategory[]).map((category) => {
      const score = results.categoryScores[category];
      return {
        id: category,
        ...placementCategoryFocus[category],
        percent: score.total > 0 ? score.correct / score.total : 0,
      };
    });

    return (
      <div className="space-y-8">
        <section aria-labelledby="placement-results-heading" className={panel}>
          <p className={eyebrow}>Placement result</p>
          <h2
            id="placement-results-heading"
            ref={resultsHeadingRef}
            tabIndex={-1}
            className="mt-2 text-2xl font-semibold text-foreground focus:outline-none sm:text-3xl"
          >
            Start in {recommendation.label}
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{recommendation.summary}</p>

          <dl className="mt-6 grid gap-4 sm:grid-cols-3">
            <div>
              <dt className={eyebrow}>Overall accuracy</dt>
              <dd className="mt-1 text-lg font-semibold text-foreground">
                {formatPercent(results.overallPercent)} ({results.totalCorrect} of {results.totalQuestions} correct)
              </dd>
              <dd className="text-xs text-muted-foreground">Weighted by question difficulty.</dd>
            </div>
            <div>
              <dt className={eyebrow}>Confidence</dt>
              <dd className="mt-1 text-lg font-semibold text-foreground">{confidence.label}</dd>
              <dd className="text-xs text-muted-foreground">{confidence.description}</dd>
            </div>
            <div>
              <dt className={eyebrow}>Answered</dt>
              <dd className="mt-1 text-lg font-semibold text-foreground">
                {results.answeredCount} of {results.totalQuestions}
              </dd>
            </div>
          </dl>

          {plan && (
            <div className="mt-6 rounded-2xl border border-primary/50 bg-background p-4 sm:p-5">
              <p className={eyebrow}>
                {plan.routeName} route · step {plan.startStepNumber} of {plan.stepCount}
              </p>
              <h3 className="mt-1 text-lg font-semibold text-foreground">{plan.startStepTitle}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{recommendation.focus}</p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link href={plan.startHref} className={primaryLink}>
                  Start at {plan.startTitle}
                </Link>
                <Link href={`/curriculum#${routeAnchor(plan.routeId)}`} className={secondaryLink}>
                  See the {plan.routeName} route
                </Link>
                <Button variant="outline" onClick={() => followRoute(plan)} className="min-h-[44px]">
                  Follow the {plan.routeName} route
                </Button>
              </div>
              <p role="status" aria-live="polite" className="text-sm text-foreground">
                {routeConfirmation ? <span className="mt-3 block">{routeConfirmation}</span> : null}
              </p>
              {plan.skim.length > 0 && (
                <div className="mt-5">
                  <h4 id="placement-skim-heading" className="text-sm font-semibold text-foreground">
                    Skim first if an answer surprised you
                  </h4>
                  <ul aria-labelledby="placement-skim-heading" className="mt-2 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                    {plan.skim.map((module) => (
                      <li key={module.href} className="min-w-0 [overflow-wrap:anywhere]">
                        <Link href={module.href} className={textLink}>
                          {module.title.startsWith(`${module.code}:`) ? module.title : `${module.code}: ${module.title}`}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>

        <section aria-labelledby="placement-areas-heading">
          <h2 id="placement-areas-heading" className="text-xl font-semibold text-foreground">
            Your score by area
          </h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {categories.map((category) => {
              const needsReview = category.percent < 0.75;
              return (
                <article
                  key={category.id}
                  aria-labelledby={`placement-area-${category.id}`}
                  className={cn(
                    "rounded-2xl border bg-card p-5 shadow-sm",
                    needsReview ? "border-primary/60" : "border-border",
                  )}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 id={`placement-area-${category.id}`} className="text-base font-semibold text-foreground">
                      {category.title}
                    </h3>
                    <span className="text-sm font-semibold text-foreground">{formatPercent(category.percent)} correct</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{category.summary}</p>
                  <p className="mt-2 text-xs font-semibold text-foreground">
                    {needsReview ? "Review this area first (under 75%)." : "Strong area (75% or more)."}
                  </p>
                  <ul className="mt-3 space-y-1.5 text-sm">
                    {category.resources.map((resource) => (
                      <li key={resource.href} className="min-w-0 [overflow-wrap:anywhere]">
                        <Link href={resource.href} className={textLink}>
                          {resource.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </section>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={handleRetake} className="min-h-[44px]">
              Retake the quiz
            </Button>
            <Link href="/dashboard" className={secondaryLink}>
              Go to dashboard
            </Link>
          </div>
          <p role="status" aria-live="polite" className="text-sm font-medium text-amber-800 dark:text-amber-200">
            {saveMessage}
          </p>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return null;
  }

  const answeredCount = currentIndex + (feedback ? 1 : 0);
  const progressPercent = (answeredCount / totalQuestions) * 100;
  const isLastQuestion = currentIndex === totalQuestions - 1;

  return (
    <section aria-labelledby="placement-question-heading" className={panel}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className={eyebrow}>
            Question {currentIndex + 1} of {totalQuestions}
          </p>
          <h2
            id="placement-question-heading"
            ref={questionHeadingRef}
            tabIndex={-1}
            className="mt-2 text-lg font-semibold text-foreground [overflow-wrap:anywhere] focus:outline-none sm:text-xl"
          >
            <InlineCode text={currentQuestion.prompt} />
          </h2>
        </div>
        <dl className="shrink-0 text-xs text-muted-foreground sm:text-right">
          <div>
            <dt className="inline">Area: </dt>
            <dd className="inline">{placementCategoryFocus[currentQuestion.category].title}</dd>
          </div>
          <div>
            <dt className="inline">Difficulty: </dt>
            <dd className="inline">{titleCase(currentQuestion.difficulty)}</dd>
          </div>
        </dl>
      </div>

      <div
        role="progressbar"
        aria-label="Questions answered"
        aria-valuemin={0}
        aria-valuemax={totalQuestions}
        aria-valuenow={answeredCount}
        aria-valuetext={`${answeredCount} of ${totalQuestions} answered`}
        className="mt-6 h-2.5 w-full rounded-full bg-muted"
      >
        <div
          className="h-2.5 rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <fieldset className="mt-6">
        <legend className="sr-only">Choose one answer</legend>
        <div className="grid gap-3">
          {currentQuestion.options.map((option) => {
            const inputId = `placement-${currentQuestion.id}-${option.id}`;
            const isSelected = selectedOption === option.id;
            const isCorrect = Boolean(feedback) && option.isCorrect;
            const isWrongPick = Boolean(feedback) && isSelected && !option.isCorrect;
            return (
              <label
                key={option.id}
                htmlFor={inputId}
                className={cn(
                  "flex min-h-[44px] items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm text-foreground",
                  "transition-colors motion-reduce:transition-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background",
                  feedback ? "cursor-default" : "cursor-pointer hover:border-primary/70",
                  isSelected ? "border-primary bg-primary/10" : "border-border bg-background",
                  isCorrect && "border-2 border-emerald-700 dark:border-emerald-400",
                  isWrongPick && "border-2 border-dashed border-rose-700 dark:border-rose-400",
                )}
              >
                <span className="flex min-w-0 items-start gap-3">
                  <input
                    id={inputId}
                    type="radio"
                    name={`placement-${currentQuestion.id}`}
                    value={option.id}
                    checked={isSelected}
                    disabled={Boolean(feedback)}
                    onChange={() => setSelectedOption(option.id)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                  />
                  <span className="min-w-0 [overflow-wrap:anywhere]">
                    <InlineCode text={option.label} />
                  </span>
                </span>
                {isCorrect && (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                    <Check className="h-4 w-4" aria-hidden="true" /> Correct answer
                  </span>
                )}
                {isWrongPick && (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-rose-800 dark:text-rose-300">
                    <X className="h-4 w-4" aria-hidden="true" /> Your answer
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {!feedback && (
          <Button onClick={handleSubmit} disabled={!selectedOption} className="min-h-[44px]">
            Check answer
          </Button>
        )}
        {feedback && (
          <Button ref={nextButtonRef} onClick={handleNext} className="min-h-[44px]">
            {isLastQuestion ? "See your result" : "Next question"}
          </Button>
        )}
        <span className="text-xs text-muted-foreground">
          {answers.length} of {totalQuestions} answered
        </span>
      </div>

      <div aria-live="polite" className="mt-6">
        {feedback && (
          <div
            className={cn(
              "rounded-2xl border bg-background px-4 py-3 text-sm",
              feedback.status === "correct" ? "border-emerald-700 dark:border-emerald-400" : "border-rose-700 dark:border-rose-400",
            )}
          >
            <p className="flex items-center gap-2 font-semibold text-foreground">
              {feedback.status === "correct" ? (
                <Check className="h-4 w-4 text-emerald-800 dark:text-emerald-300" aria-hidden="true" />
              ) : (
                <X className="h-4 w-4 text-rose-800 dark:text-rose-300" aria-hidden="true" />
              )}
              {feedback.status === "correct" ? "Correct." : "Not quite."}
            </p>
            {feedback.status === "incorrect" && (
              <p className="mt-1 text-foreground">
                Correct answer: <InlineCode text={feedback.correctLabel} />
              </p>
            )}
            <p className="mt-1 leading-relaxed text-muted-foreground">
              <InlineCode text={feedback.message} />
            </p>
          </div>
        )}
      </div>
    </section>
  );
};

export default PlacementQuiz;
