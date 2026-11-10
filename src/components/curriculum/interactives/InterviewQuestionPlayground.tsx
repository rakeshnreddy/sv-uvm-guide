"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, HelpCircle, AlertTriangle, Lightbulb } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export interface PlaygroundOption {
  id: string;
  label: string | React.ReactNode;
  isCorrect: boolean;
  explanation: React.ReactNode;
}

/** Authoring shape used by curriculum MDX: `{ text, isCorrect, feedback }`. */
export interface AuthoredPlaygroundOption {
  id?: string;
  label?: string | React.ReactNode;
  text?: string | React.ReactNode;
  isCorrect?: boolean;
  correct?: boolean;
  explanation?: React.ReactNode;
  feedback?: React.ReactNode;
}

export interface InterviewQuestionPlaygroundProps {
  title?: string;
  question: React.ReactNode;
  options: (PlaygroundOption | AuthoredPlaygroundOption)[];
}

export const normalizePlaygroundOptions = (options: (PlaygroundOption | AuthoredPlaygroundOption)[] = []): PlaygroundOption[] =>
  options.map((raw, index) => {
    const option = raw as AuthoredPlaygroundOption;
    return {
      id: option.id ?? `option-${index}`,
      label: option.label ?? option.text ?? "",
      isCorrect: Boolean(option.isCorrect ?? option.correct),
      explanation: option.explanation ?? option.feedback ?? null,
    };
  });

/**
 * Classes for one answer option. A selected option before submit is the raised
 * surface with a 2 px accent marker on its leading edge; after submit the correct
 * option reads as success and a wrong pick as danger.
 */
export function optionClassName({
  isSelected,
  hasSubmitted,
  showSuccess,
  showFailure,
  isCorrect,
}: {
  isSelected: boolean;
  hasSubmitted: boolean;
  showSuccess: boolean;
  showFailure: boolean;
  isCorrect: boolean;
}): string {
  return cn(
    "relative flex w-full items-center justify-between overflow-hidden rounded-lg border border-l-2 p-4 text-left transition-colors duration-150 ease-bench focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    showSuccess
      ? "border-success border-l-success bg-success-subtle"
      : showFailure
        ? "border-danger border-l-danger bg-danger-subtle"
        : isSelected && !hasSubmitted
          ? "border-border border-l-primary bg-muted"
          : "border-border border-l-border bg-card hover:bg-muted",
    hasSubmitted && !isSelected && !isCorrect && "opacity-60",
  );
}

export default function InterviewQuestionPlayground({
  title = "Interview pitfall",
  question,
  options: authoredOptions,
}: InterviewQuestionPlaygroundProps) {
  const options = React.useMemo(() => normalizePlaygroundOptions(authoredOptions), [authoredOptions]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [shake, setShake] = useState(false);

  const handleSelect = (id: string) => {
    if (hasSubmitted) return;
    setSelectedId(id);
  };

  const handleSubmit = () => {
    if (!selectedId || hasSubmitted) return;
    const selectedOption = options.find((o) => o.id === selectedId);
    
    setHasSubmitted(true);

    if (selectedOption && !selectedOption.isCorrect) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  const handleReset = () => {
    setSelectedId(null);
    setHasSubmitted(false);
  };

  const selectedOption = options.find((o) => o.id === selectedId);
  const isCorrect = selectedOption?.isCorrect;

  return (
    <div data-testid="interview-playground" className="my-8 rounded-xl border border-border bg-card p-6 text-card-foreground shadow-card">
      <div className="mb-6 flex items-center gap-3 border-b border-border pb-4">
        <div data-testid="interview-playground-icon" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <HelpCircle size={22} aria-hidden />
        </div>
        <h3 className="m-0 text-h3 text-foreground">{title}</h3>
      </div>

      <div className="mb-6 text-foreground prose-p:my-2 prose-code:text-sm">{question}</div>

      <motion.div
        className="flex flex-col gap-3"
        animate={shake ? { x: [-10, 10, -10, 10, -5, 5, 0] } : {}}
        transition={{ duration: 0.4 }}
      >
        {options.map((option) => {
          const isSelected = selectedId === option.id;
          const showSuccess = hasSubmitted && option.isCorrect;
          const showFailure = hasSubmitted && isSelected && !option.isCorrect;

          return (
            <motion.button
              key={option.id}
              type="button"
              onClick={() => handleSelect(option.id)}
              disabled={hasSubmitted}
              aria-pressed={isSelected}
              whileTap={!hasSubmitted ? { scale: 0.99 } : {}}
              className={optionClassName({ isSelected, hasSubmitted, showSuccess, showFailure, isCorrect: option.isCorrect })}
            >
              <span
                className={cn(
                  // Long simulator switches have no break points; let them wrap, not clip.
                  "min-w-0 flex-1 font-medium [overflow-wrap:anywhere]",
                  showSuccess ? "text-success" : showFailure ? "text-danger" : "text-foreground",
                )}
              >
                {option.label}
              </span>

              <AnimatePresence>
                {showSuccess && (
                  <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="ml-4 shrink-0 text-success">
                    <CheckCircle size={24} aria-label="Correct answer" />
                  </motion.div>
                )}
                {showFailure && (
                  <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="ml-4 shrink-0 text-danger">
                    <XCircle size={24} aria-label="Your answer, incorrect" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </motion.div>

      <div className="mt-6 flex items-center justify-between">
        {/* Secondary style: a lesson holds several of these cards, and the contract allows one filled accent button per view. */}
        {!hasSubmitted ? (
          <Button type="button" variant="secondary" onClick={handleSubmit} disabled={!selectedId}>
            Submit answer
          </Button>
        ) : (
          <Button type="button" variant="secondary" onClick={handleReset}>
            Try again
          </Button>
        )}
      </div>

      <AnimatePresence>
        {hasSubmitted && selectedOption && (
          <motion.div
            initial={{ opacity: 0, y: 10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            className="mt-6 overflow-hidden"
          >
            <div
              data-testid="interview-playground-feedback"
              className={cn(
                "rounded-lg border p-4 text-foreground",
                isCorrect ? "border-success bg-success-subtle" : "border-danger bg-danger-subtle",
              )}
            >
              <div className={cn("mb-2 flex items-center gap-2 font-semibold", isCorrect ? "text-success" : "text-danger")}>
                {isCorrect ? (
                  <>
                    <Lightbulb size={20} aria-hidden />
                    <span>Correct analysis</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={20} aria-hidden />
                    <span>Watch out</span>
                  </>
                )}
              </div>
              <div className="text-sm leading-relaxed prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:font-mono">
                {selectedOption.explanation}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
