"use client";

import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Progress } from "@/components/ui/Progress";
import { cn } from "@/lib/utils";

export interface DataTypeQuizQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

interface DataTypeQuizProps {
  questions: DataTypeQuizQuestion[];
}

const PASSING_THRESHOLD = 0.8; // 4 out of 5

const DataTypeQuiz: React.FC<DataTypeQuizProps> = ({ questions }) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [isQuizFinished, setQuizFinished] = useState(false);
  const [showReward, setShowReward] = useState(false);

  const totalQuestions = questions.length;
  const progress = useMemo(() => {
    if (!totalQuestions) {
      return 0;
    }
    const completed = isQuizFinished ? totalQuestions : currentQuestion + (showFeedback ? 1 : 0);
    return Math.round((completed / totalQuestions) * 100);
  }, [currentQuestion, isQuizFinished, showFeedback, totalQuestions]);

  const handleOptionSelect = (index: number) => {
    if (showFeedback || isQuizFinished) {
      return;
    }
    const question = questions[currentQuestion];
    const answeredCorrectly = index === question.correctAnswerIndex;
    setSelectedOption(index);
    setIsCorrect(answeredCorrectly);
    setShowFeedback(true);
    if (answeredCorrectly) {
      setScore((prev) => prev + 1);
    }
  };

  const advanceOrFinish = () => {
    if (!showFeedback) {
      return;
    }

    const nextQuestion = currentQuestion + 1;
    if (nextQuestion >= totalQuestions) {
      setQuizFinished(true);
      setShowFeedback(false);
      setIsCorrect(null);
      if (score / totalQuestions >= PASSING_THRESHOLD) {
        setShowReward(true);
      }
      return;
    }

    setCurrentQuestion(nextQuestion);
    setSelectedOption(null);
    setShowFeedback(false);
    setIsCorrect(null);
  };

  const restartQuiz = () => {
    setCurrentQuestion(0);
    setSelectedOption(null);
    setScore(0);
    setShowFeedback(false);
    setIsCorrect(null);
    setQuizFinished(false);
    setShowReward(false);
  };

  const closeReward = () => setShowReward(false);

  if (!totalQuestions) {
    return null;
  }

  const question = questions[currentQuestion];
  const hasPassed = isQuizFinished && score / totalQuestions >= PASSING_THRESHOLD;

  return (
    <>
      <Card className="my-10 border-primary/40 bg-background/90 shadow-xl" data-testid="data-type-quiz">
        <CardHeader className="space-y-4">
          <CardTitle className="text-2xl">Data Type Detective</CardTitle>
          <p className="text-sm text-muted-foreground">
            Apply what you just explored. Each scenario highlights a nuance between nets, variables, and the SystemVerilog
            value system—select the most appropriate answer to earn your badge.
          </p>
          <div>
            <div className="mb-2 flex w-full items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <span>Progress</span>
              <span>
                {currentQuestion + 1}/{totalQuestions}
              </span>
            </div>
            <Progress value={progress} aria-label="Quiz progress" />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <AnimatePresence mode="wait">
            {!isQuizFinished ? (
              <motion.div
                key={question.question}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.25 }}
                className="space-y-5"
                data-testid="quiz-question"
              >
                <div className="rounded-lg border bg-muted/20 p-5">
                  <p className="text-sm font-medium text-muted-foreground">Scenario</p>
                  <h3 className="mt-2 text-lg font-semibold">{question.question}</h3>
                </div>
                <div className="grid gap-3">
                  {question.options.map((option, index) => {
                    const isSelected = selectedOption === index;
                    const isAnswer = showFeedback && index === question.correctAnswerIndex;
                    return (
                      <motion.button
                        key={option}
                        type="button"
                        onClick={() => handleOptionSelect(index)}
                        whileTap={{ scale: showFeedback ? 1 : 0.97 }}
                        className={cn(
                          "rounded-lg border p-4 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          isAnswer && "border-emerald-500 bg-emerald-500/10",
                          isSelected && !isAnswer && showFeedback && "border-destructive bg-destructive/10",
                          !showFeedback && isSelected && "border-primary bg-primary/10"
                        )}
                      >
                        {option}
                      </motion.button>
                    );
                  })}
                </div>
                <AnimatePresence>
                  {showFeedback && selectedOption !== null && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      className={cn(
                        "rounded-lg border p-4 text-sm",
                        isCorrect ? "border-emerald-500 bg-emerald-500/10" : "border-destructive bg-destructive/10"
                      )}
                      data-testid="quiz-feedback"
                    >
                      <p className="font-semibold">
                        {isCorrect ? "Correct!" : "Not quite."}
                      </p>
                      <p className="mt-1 text-muted-foreground">{question.explanation}</p>
                      <div className="mt-3 flex justify-end">
                        <Button onClick={advanceOrFinish}>{currentQuestion + 1 === totalQuestions ? "See results" : "Next scenario"}</Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ) : (
              <motion.div
                key="quiz-results"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.25 }}
                className="space-y-5"
                data-testid="quiz-results"
              >
                <div className="rounded-lg border bg-muted/20 p-5 text-center">
                  <h3 className="text-2xl font-semibold">You scored {score} / {totalQuestions}</h3>
                  <p className="mt-2 text-muted-foreground">
                    {hasPassed
                      ? "You navigated the data type pitfalls like a pro."
                      : "Review the lesson above and try again—mastery is in the nuances."}
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <Button variant="outline" onClick={restartQuiz}>
                    Retry challenge
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      <AnimatePresence>
        {showReward && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-background/80 backdrop-blur"
            role="dialog"
            aria-modal="true"
            data-testid="quiz-reward-overlay"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md rounded-xl border border-primary/40 bg-background p-8 shadow-2xl"
              data-testid="quiz-reward-modal"
            >
              <div className="absolute right-4 top-4">
                <Button variant="outline" size="sm" onClick={closeReward}>
                  Close
                </Button>
              </div>
              <div className="space-y-4 text-center">
                <h3 className="text-2xl font-semibold text-primary">Success!</h3>
                <p className="text-sm text-muted-foreground">You earned:</p>
                <div className="flex items-center justify-center gap-3 text-lg font-semibold">
                  <span className="rounded-full bg-primary/10 px-4 py-2 text-primary">+150 XP</span>
                  <span className="rounded-full bg-amber-100 px-4 py-2 text-amber-600">Data Architect Badge</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Your instincts now line up with the IEEE 1800-2023 data type semantics—keep using X and Z to expose real hardware bugs.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default DataTypeQuiz;
