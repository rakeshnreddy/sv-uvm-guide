"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Progress } from "@/components/ui/Progress";
import { cn } from "@/lib/utils";

export interface DataTypeQuizQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  /** Shown for every answer: why the question's answer holds. */
  explanation: string;
  /** Optional per-option feedback that diagnoses the misconception behind each choice. */
  optionFeedback?: string[];
}

interface DataTypeQuizProps {
  questions: DataTypeQuizQuestion[];
}

const PASSING_THRESHOLD = 0.8; // 4 out of 5

const DataTypeQuiz: React.FC<DataTypeQuizProps> = ({ questions }) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [isQuizFinished, setQuizFinished] = useState(false);
  const [showReward, setShowReward] = useState(false);
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const retryButtonRef = useRef<HTMLButtonElement>(null);
  const rewardTitleId = useId();

  const totalQuestions = questions.length;
  const showFeedback = selectedOption !== null;
  const progress = useMemo(() => {
    if (!totalQuestions) return 0;
    const completed = isQuizFinished ? totalQuestions : currentQuestion + (showFeedback ? 1 : 0);
    return Math.round((completed / totalQuestions) * 100);
  }, [currentQuestion, isQuizFinished, showFeedback, totalQuestions]);

  useEffect(() => {
    if (showFeedback) nextButtonRef.current?.focus();
  }, [showFeedback, currentQuestion]);

  useEffect(() => {
    if (showReward) closeButtonRef.current?.focus();
  }, [showReward]);

  if (!totalQuestions) return null;

  const question = questions[currentQuestion];
  const isCorrect = selectedOption === question.correctAnswerIndex;
  const hasPassed = isQuizFinished && score / totalQuestions >= PASSING_THRESHOLD;

  const handleOptionSelect = (index: number) => {
    if (showFeedback || isQuizFinished) return;
    setSelectedOption(index);
    if (index === question.correctAnswerIndex) setScore((prev) => prev + 1);
  };

  const advanceOrFinish = () => {
    if (!showFeedback) return;
    if (currentQuestion + 1 >= totalQuestions) {
      setQuizFinished(true);
      setSelectedOption(null);
      if (score / totalQuestions >= PASSING_THRESHOLD) setShowReward(true);
      return;
    }
    setCurrentQuestion(currentQuestion + 1);
    setSelectedOption(null);
  };

  const restartQuiz = () => {
    setCurrentQuestion(0);
    setSelectedOption(null);
    setScore(0);
    setQuizFinished(false);
    setShowReward(false);
  };

  const closeReward = () => {
    setShowReward(false);
    // Return focus to the page content the dialog covered.
    requestAnimationFrame(() => retryButtonRef.current?.focus());
  };

  const chosenFeedback = selectedOption !== null ? question.optionFeedback?.[selectedOption] : undefined;
  const correctFeedback = question.optionFeedback?.[question.correctAnswerIndex];

  return (
    <>
      <Card className="my-10 border-primary/40 bg-background/90 shadow-xl" data-testid="data-type-quiz">
        <CardHeader className="space-y-4">
          <CardTitle className="text-2xl">Data Type Detective</CardTitle>
          <p className="text-sm text-muted-foreground">
            Each scenario hides one nuance of nets, variables and the 4-state value system. Every answer, right or wrong, tells you which rule decides it.
          </p>
          <div>
            <div className="mb-2 flex w-full items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <span>Progress</span>
              <span>
                {Math.min(currentQuestion + 1, totalQuestions)}/{totalQuestions}
              </span>
            </div>
            <Progress value={progress} aria-label="Quiz progress" />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {!isQuizFinished ? (
            <div className="space-y-5" data-testid="quiz-question">
              <div className="rounded-lg border bg-muted/20 p-5">
                <p className="text-sm font-medium text-muted-foreground">Scenario</p>
                <h3 className="mt-2 text-lg font-semibold">{question.question}</h3>
              </div>
              <div className="grid gap-3" role="group" aria-label="Answer options">
                {question.options.map((option, index) => {
                  const isSelected = selectedOption === index;
                  const isAnswer = showFeedback && index === question.correctAnswerIndex;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => handleOptionSelect(index)}
                      aria-disabled={showFeedback || undefined}
                      className={cn(
                        "flex items-start justify-between gap-3 rounded-lg border p-4 text-left font-mono text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none [font-variant-ligatures:none]",
                        !showFeedback && "hover:bg-muted",
                        isAnswer && "border-emerald-500 bg-emerald-500/10",
                        isSelected && !isAnswer && "border-destructive bg-destructive/10",
                        showFeedback && !isAnswer && !isSelected && "opacity-70",
                      )}
                    >
                      <span>{option}</span>
                      {isAnswer ? <span aria-label="correct answer">✓</span> : null}
                      {isSelected && !isAnswer ? <span aria-label="your answer, incorrect">✕</span> : null}
                    </button>
                  );
                })}
              </div>
              {showFeedback ? (
                <div
                  className={cn("rounded-lg border p-4 text-sm", isCorrect ? "border-emerald-500 bg-emerald-500/10" : "border-destructive bg-destructive/10")}
                  data-testid="quiz-feedback"
                  aria-live="polite"
                >
                  <p className="font-semibold">{isCorrect ? "Correct!" : "Not quite."}</p>
                  {chosenFeedback ? <p className="mt-1 text-foreground">{chosenFeedback}</p> : null}
                  {!isCorrect && correctFeedback ? (
                    <p className="mt-2 text-muted-foreground">
                      <strong className="text-foreground">Why the answer holds: </strong>
                      {correctFeedback}
                    </p>
                  ) : null}
                  <p className="mt-2 text-muted-foreground">{question.explanation}</p>
                  <div className="mt-3 flex justify-end">
                    <Button ref={nextButtonRef} onClick={advanceOrFinish}>
                      {currentQuestion + 1 === totalQuestions ? "See results" : "Next scenario"}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-5" data-testid="quiz-results">
              <div className="rounded-lg border bg-muted/20 p-5 text-center" aria-live="polite">
                <h3 className="text-2xl font-semibold">
                  You scored {score} / {totalQuestions}
                </h3>
                <p className="mt-2 text-muted-foreground">
                  {hasPassed ? "You navigated the data type pitfalls like a pro." : "Review the lesson above and try again: mastery is in the nuances."}
                </p>
              </div>
              <div className="flex items-center justify-center gap-3">
                <Button ref={retryButtonRef} variant="outline" onClick={restartQuiz}>
                  Retry challenge
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {showReward ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-background/80 p-4 backdrop-blur"
          role="dialog"
          aria-modal="true"
          aria-labelledby={rewardTitleId}
          data-testid="quiz-reward-overlay"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              closeReward();
            } else if (event.key === "Tab") {
              // The close button is the only control: keep focus inside the dialog.
              event.preventDefault();
              closeButtonRef.current?.focus();
            }
          }}
        >
          <div className="relative w-full max-w-md rounded-xl border border-primary/40 bg-background p-8 shadow-2xl" data-testid="quiz-reward-modal">
            <div className="absolute right-4 top-4">
              <Button ref={closeButtonRef} variant="outline" size="sm" onClick={closeReward}>
                Close
              </Button>
            </div>
            <div className="space-y-4 text-center">
              <h3 id={rewardTitleId} className="text-2xl font-semibold text-primary">
                Success!
              </h3>
              <p className="text-sm text-muted-foreground">You earned:</p>
              <div className="flex flex-wrap items-center justify-center gap-3 text-lg font-semibold">
                <span className="rounded-full bg-primary/10 px-4 py-2 text-primary">+150 XP</span>
                <span className="rounded-full bg-amber-100 px-4 py-2 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200">Data Architect Badge</span>
              </div>
              <p className="text-sm text-muted-foreground">Keep 4-state types on DUT-facing signals so x and z can expose real bugs.</p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default DataTypeQuiz;
