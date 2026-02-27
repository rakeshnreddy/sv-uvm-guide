"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, HelpCircle, AlertTriangle, Lightbulb } from "lucide-react";

export interface PlaygroundOption {
  id: string;
  label: string | React.ReactNode;
  isCorrect: boolean;
  explanation: React.ReactNode;
}

export interface InterviewQuestionPlaygroundProps {
  title?: string;
  question: React.ReactNode;
  options: PlaygroundOption[];
}

export default function InterviewQuestionPlayground({
  title = "Interview Pitfall",
  question,
  options,
}: InterviewQuestionPlaygroundProps) {
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
    <div className="my-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-6 flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
          <HelpCircle size={24} />
        </div>
        <h3 className="m-0 text-xl font-semibold text-slate-800 dark:text-slate-100">
          {title}
        </h3>
      </div>

      <div className="mb-6 text-slate-700 dark:text-slate-300 prose-p:my-2 prose-code:text-sm">
        {question}
      </div>

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
              onClick={() => handleSelect(option.id)}
              disabled={hasSubmitted}
              whileHover={!hasSubmitted ? { scale: 1.01 } : {}}
              whileTap={!hasSubmitted ? { scale: 0.99 } : {}}
              className={`relative flex items-center justify-between overflow-hidden rounded-lg border p-4 text-left transition-all ${
                isSelected && !hasSubmitted
                  ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500 dark:bg-blue-900/20"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600 dark:hover:bg-slate-800/80"
              } ${
                showSuccess
                  ? "border-green-500 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                  : ""
              } ${
                showFailure
                  ? "border-rose-500 bg-rose-50 dark:border-rose-800 dark:bg-rose-900/20"
                  : ""
              } ${
                hasSubmitted && !isSelected && !option.isCorrect
                  ? "opacity-50 grayscale"
                  : ""
              }`}
            >
              <span
                className={`flex-1 font-medium ${
                  showSuccess
                    ? "text-green-800 dark:text-green-300"
                    : showFailure
                    ? "text-rose-800 dark:text-rose-300"
                    : "text-slate-700 dark:text-slate-200"
                }`}
              >
                {option.label}
              </span>

              <AnimatePresence>
                {showSuccess && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="ml-4 text-green-500"
                  >
                    <CheckCircle size={24} />
                  </motion.div>
                )}
                {showFailure && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="ml-4 text-rose-500"
                  >
                    <XCircle size={24} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </motion.div>

      <div className="mt-6 flex items-center justify-between">
        {!hasSubmitted ? (
          <button
            onClick={handleSubmit}
            disabled={!selectedId}
            className={`rounded-lg px-6 py-2.5 font-medium transition-colors ${
              selectedId
                ? "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                : "cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
            }`}
          >
            Submit Answer
          </button>
        ) : (
          <button
            onClick={handleReset}
            className="rounded-lg border border-slate-200 bg-white px-6 py-2.5 font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Try Again
          </button>
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
              className={`rounded-lg border p-4 ${
                isCorrect
                  ? "border-green-200 bg-green-50 text-green-900 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-200"
                  : "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-200"
              }`}
            >
              <div className="mb-2 flex items-center gap-2 font-bold">
                {isCorrect ? (
                  <>
                    <Lightbulb size={20} />
                    <span>Correct Analysis</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={20} />
                    <span>Watch Out!</span>
                  </>
                )}
              </div>
              <div className="text-sm leading-relaxed opacity-90 prose-code:font-mono prose-code:bg-black/5 prose-code:px-1 prose-code:rounded dark:prose-code:bg-white/10">
                {selectedOption.explanation}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
