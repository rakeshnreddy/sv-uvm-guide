"use client";

import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

interface Challenge {
  id: string;
  prompt: string;
  options: string[];
  correct: string;
  explanation: string;
}

type ChallengeAnswer = {
  challengeId: string;
  selected: string;
  correct: boolean;
};

const challenges: Challenge[] = [
  {
    id: "queue",
    prompt: "100 packets are arriving in order and must be processed in the same order. Choose a data structure to hold them.",
    options: ["Dynamic Array", "Queue", "Associative Array"],
    correct: "Queue",
    explanation: "Queues guarantee First-In-First-Out ordering, matching packet arrival to processing order.",
  },
  {
    id: "associative",
    prompt:
      "You need to store error packets, indexed by their unique 32-bit error ID. Very few IDs will actually have errors. Choose a structure.",
    options: ["Dynamic Array", "Queue", "Associative Array"],
    correct: "Associative Array",
    explanation:
      "Associative arrays sparsely allocate entries based on key access, so you only store the IDs that matter.",
  },
  {
    id: "dynamic",
    prompt: "You are collecting all packet lengths for statistical analysis later. You don't know how many packets will arrive. Choose a structure.",
    options: ["Dynamic Array", "Queue", "Associative Array"],
    correct: "Dynamic Array",
    explanation:
      "Dynamic arrays resize at runtime, giving you indexed access to however many packet lengths arrive.",
  },
  {
    id: "packed",
    prompt:
      "A register mirror needs to line up bit-for-bit with a DUT bus so you can drive packed fields over an interface. Choose a structure.",
    options: ["Packed Array", "Dynamic Array", "Queue"],
    correct: "Packed Array",
    explanation:
      "Packed arrays preserve contiguous bit ordering, making them ideal for hardware-accurate register and bus mirrors.",
  },
  {
    id: "queue_replay",
    prompt:
      "Diagnostics bursts arrive late and must pre-empt the oldest stored packet. Choose the structure that lets you push_front() and pop_back() without rewriting code.",
    options: ["Dynamic Array", "Queue", "Associative Array"],
    correct: "Queue",
    explanation:
      "Queues support push_front(), pop_back(), insert(), and delete() so replay buffers stay compact and drop the right packet.",
  },
];

const modalVariants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

export const PacketSorterGame: React.FC = () => {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<ChallengeAnswer[]>([]);
  const [showModal, setShowModal] = useState(false);

  const currentChallenge = challenges[current];
  const selectedAnswer = answers.find((answer) => answer.challengeId === currentChallenge?.id);

  const correctCount = useMemo(() => answers.filter((answer) => answer.correct).length, [answers]);
  const isFinished = useMemo(() => answers.length === challenges.length, [answers.length]);

  const handleSelect = (option: string) => {
    if (!currentChallenge) return;
    if (selectedAnswer) return;

    setAnswers((prev) => [
      ...prev,
      {
        challengeId: currentChallenge.id,
        selected: option,
        correct: option === currentChallenge.correct,
      },
    ]);
  };

  const goToNext = () => {
    if (current < challenges.length - 1) {
      setCurrent((prev) => prev + 1);
    } else {
      setShowModal(true);
    }
  };

  const restartGame = () => {
    setAnswers([]);
    setCurrent(0);
    setShowModal(false);
  };

  const feedback = selectedAnswer
    ? selectedAnswer.correct
      ? {
          tone: "success" as const,
          title: "Correct!",
          detail: currentChallenge.explanation,
        }
      : {
          tone: "error" as const,
          title: "Not quite",
          detail: `${selectedAnswer.selected} struggles here. ${currentChallenge.explanation}`,
        }
    : null;

  return (
    <div className="space-y-6" data-testid="packet-sorter-game">
      <div className="space-y-1">
        <Badge variant="outline" className="uppercase tracking-wide text-xs text-muted-foreground">
          Challenge {current + 1} of {challenges.length}
        </Badge>
        <h3 className="text-xl font-semibold">Think on Your Feet: Manage the Data Flow</h3>
        <p className="text-muted-foreground">Pick the structure that keeps packets organized under pressure.</p>
      </div>

      <div className="space-y-4 rounded-xl border border-border/60 bg-background/80 p-6 shadow-sm" data-testid="packet-sorter-card">
        <div className="text-lg font-medium" data-testid="packet-sorter-prompt">
          {currentChallenge.prompt}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {currentChallenge.options.map((option) => {
            const optionAnswer = answers.find((answer) => answer.challengeId === currentChallenge.id);
            const isSelected = optionAnswer?.selected === option;
            const isCorrect = isSelected && optionAnswer?.correct;
            return (
              <Button
                key={option}
                data-testid={`packet-option-${option.replace(/\s+/g, "-").toLowerCase()}`}
                variant="outline"
                className={cn(
                  "h-auto whitespace-normal text-left",
                  !isSelected && "bg-secondary/30",
                  isSelected && !isCorrect && "border-rose-500/60 bg-rose-500/10 text-rose-700 dark:bg-rose-900/80 dark:text-rose-100",
                  isCorrect && "border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:bg-emerald-900/80 dark:text-emerald-100",
                )}
                onClick={() => handleSelect(option)}
              >
                {option}
              </Button>
            );
          })}
        </div>
        <AnimatePresence>
          {feedback && (
            <motion.div
              key={feedback.title}
              data-testid="packet-sorter-feedback"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className={
                feedback.tone === "success"
                  ? "rounded-md border border-emerald-500/60 bg-emerald-500/10 p-4 text-emerald-700 dark:bg-emerald-900/80 dark:text-emerald-100"
                  : "rounded-md border border-rose-500/60 bg-rose-500/10 p-4 text-rose-700 dark:bg-rose-900/80 dark:text-rose-100"
              }
            >
              <div className="font-semibold">{feedback.title}</div>
              <div className="text-sm">{feedback.detail}</div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground" data-testid="packet-score">
            Score: {correctCount} / {challenges.length}
          </div>
          <Button data-testid="packet-next" onClick={goToNext} disabled={!selectedAnswer}>
            {current === challenges.length - 1 ? "Finish" : "Next Challenge"}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            data-testid="packet-sorter-modal"
          >
            <motion.div
              variants={modalVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="w-full max-w-md space-y-4 rounded-2xl border border-primary/40 bg-background p-6 text-center shadow-xl"
            >
              <h4 className="text-2xl font-semibold">Success!</h4>
              <p className="text-muted-foreground">You earned +150 XP and the Data Flow Master badge.</p>
              <div className="space-y-2 text-left text-sm">
                {challenges.map((challenge) => {
                  const answer = answers.find((item) => item.challengeId === challenge.id);
                  const correct = answer?.correct;
                  return (
                    <div
                      key={challenge.id}
                      className={
                        correct
                          ? "rounded-md border border-emerald-500/60 bg-emerald-500/10 p-3"
                          : "rounded-md border border-rose-500/60 bg-rose-500/10 p-3"
                      }
                    >
                      <div className="font-semibold">{challenge.prompt}</div>
                      <div className="mt-1 text-sm">
                        You chose <strong>{answer?.selected ?? "No answer"}</strong> — {challenge.explanation}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-center gap-2">
                <Button variant="outline" onClick={() => setShowModal(false)} data-testid="packet-modal-close">
                  Close
                </Button>
                <Button onClick={restartGame} data-testid="packet-modal-restart">
                  Play Again
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PacketSorterGame;
