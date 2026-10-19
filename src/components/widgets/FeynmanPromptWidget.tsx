"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lightbulb } from "lucide-react";
import React, { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { useKeyedRecord } from "@/lib/learner-store/react";
import { writeOutcomeMessage, type WriteOutcome } from "@/lib/learner-store/record";
import { recordActivity } from "@/lib/learner-store/repositories/activity";
import {
  NOTEBOOK_BODY_MAX_CHARS,
  NOTEBOOK_ENTRY_MAX_CHARS,
  NOTEBOOK_MAX_ENTRIES,
  NOTEBOOK_TOTAL_MAX_CHARS,
  notebookEntries,
  notebookEntryCount,
  notebookTotalChars,
  teachBackEntryId,
  upsertTeachBack,
} from "@/lib/learner-store/repositories/notebook";
import { useServerFeature } from "@/lib/persistence/target";
import { cn } from "@/lib/utils";

/** Where saved explanations are listed. */
export const NOTEBOOK_HREF = "/dashboard/notebook";
/** Export, import and reset of learner data. */
const BACKUP_HREF = "/settings#data";

/** The static self-check shown beside every explanation. */
export const TEACH_BACK_SELF_CHECK: readonly string[] = Object.freeze([
  "Define it in one sentence",
  "Give a concrete SV/UVM example",
  "Say when it goes wrong",
  "Avoid words you couldn't define",
]);

const formatCount = (value: number) => value.toLocaleString("en-US");

const linkClass =
  "rounded-sm font-semibold text-current underline underline-offset-2 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const errorTextClass = "text-sm font-medium text-red-700 dark:text-red-300";

/** The pathname as a lesson path: no trailing slash. Null when there is none. */
function canonicalPath(pathname: string | null | undefined): string | null {
  if (!pathname) return null;
  const trimmed = pathname.split(/[?#]/)[0].replace(/\/+$/, "");
  return trimmed.startsWith("/") ? trimmed : null;
}

/** The notebook write a message describes. */
export interface NotebookWriteAttempt {
  /** The entry written; null for a new entry whose id is not known. */
  entryId: string | null;
  title?: string;
  body: string;
}

/**
 * The visible message for a notebook write that did not save. 'too-large' has
 * four causes, told apart here from the attempt and what is stored: a body
 * over NOTEBOOK_BODY_MAX_CHARS, a new entry with the notebook at
 * NOTEBOOK_MAX_ENTRIES, a notebook over NOTEBOOK_TOTAL_MAX_CHARS, and
 * otherwise an entry whose stored form (after JSON escaping) is over the
 * per-entry limit.
 */
export function notebookWriteErrorMessage(outcome: WriteOutcome, attempt: NotebookWriteAttempt): string {
  if (outcome === "too-large") {
    const { entryId, title = "", body } = attempt;
    if (body.length > NOTEBOOK_BODY_MAX_CHARS) {
      return `Not saved: an entry can hold up to ${formatCount(NOTEBOOK_BODY_MAX_CHARS)} characters and this one has ${formatCount(body.length)}. Shorten it and try again.`;
    }
    const isNew = entryId === null || notebookEntries.get(entryId) === null;
    if (isNew && notebookEntryCount() >= NOTEBOOK_MAX_ENTRIES) {
      return `Not saved: the notebook in this browser holds the most entries it can (${formatCount(NOTEBOOK_MAX_ENTRIES)}). Delete entries you no longer need in your notebook, then try again.`;
    }
    // A lower bound on the stored size: the repository adds the lesson and the timestamps.
    const storedSize = JSON.stringify({ v: 1, data: { id: entryId ?? "", title, body } }).length;
    if (notebookTotalChars(entryId ?? undefined) + storedSize > NOTEBOOK_TOTAL_MAX_CHARS) {
      return `Not saved: the notebook in this browser is full (it can hold ${formatCount(NOTEBOOK_TOTAL_MAX_CHARS)} characters in all). Delete old entries in your notebook, then try again.`;
    }
    return `Not saved: this entry is too large to store. Quotes, backslashes and other special characters take extra room, and a stored entry can take up to ${formatCount(NOTEBOOK_ENTRY_MAX_CHARS)} characters. Shorten it and try again.`;
  }
  return writeOutcomeMessage(outcome) ?? "Not saved: this browser didn't store it. Try again.";
}

// ---------------------------------------------------------------------------
// AI feedback (account-only: shown only with the AI tutor on and a learner signed in)
// ---------------------------------------------------------------------------

/** The shortest explanation the feedback route accepts. */
export const AI_FEEDBACK_MIN_CHARS = 20;
/** The longest request content the feedback route accepts (topic plus explanation). */
export const AI_FEEDBACK_MAX_CHARS = 8_000;

export interface FeynmanFeedback {
  /** 0 to 100. */
  score: number;
  feedback: string;
  missingConcepts: string[];
}

export type FeynmanFeedbackOutcome = { ok: true; result: FeynmanFeedback } | { ok: false; message: string };

/** Visible messages for the feedback route's error statuses (and a failed request). */
export const AI_FEEDBACK_ERROR_MESSAGES = Object.freeze({
  400: `AI feedback needs an explanation of ${AI_FEEDBACK_MIN_CHARS} to ${formatCount(AI_FEEDBACK_MAX_CHARS)} characters.`,
  401: "Your session has ended. Sign in again to get AI feedback.",
  429: "You've asked for feedback several times in a short while. Wait a minute, then try again.",
  503: "AI feedback isn't available right now. Try again later.",
  504: "The AI took too long to answer. Try again.",
  unavailable: "Couldn't get AI feedback right now. Try again later.",
  network: "Couldn't reach the AI feedback service. Check your connection and try again.",
} as const);

export function aiFeedbackErrorMessage(status: number): string {
  switch (status) {
    case 400:
    case 401:
    case 429:
    case 503:
    case 504:
      return AI_FEEDBACK_ERROR_MESSAGES[status];
    default:
      return AI_FEEDBACK_ERROR_MESSAGES.unavailable;
  }
}

/** Validates the route's {score, feedback, missingConcepts}; null for anything else. */
export function parseFeynmanFeedback(payload: unknown): FeynmanFeedback | null {
  if (!payload || typeof payload !== "object") return null;
  const { score, feedback, missingConcepts } = payload as Record<string, unknown>;
  if (typeof score !== "number" || !Number.isFinite(score) || typeof feedback !== "string") return null;
  return {
    score: Math.min(100, Math.max(0, Math.round(score))),
    feedback,
    missingConcepts: Array.isArray(missingConcepts)
      ? missingConcepts.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 10)
      : [],
  };
}

/** POSTs an explanation to /api/ai/feynman-feedback and maps every failure to a visible message. */
export async function requestFeynmanFeedback(content: string, signal?: AbortSignal): Promise<FeynmanFeedbackOutcome> {
  let response: Response;
  try {
    response = await fetch("/api/ai/feynman-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
      signal,
    });
  } catch {
    return { ok: false, message: AI_FEEDBACK_ERROR_MESSAGES.network };
  }
  if (!response.ok) return { ok: false, message: aiFeedbackErrorMessage(response.status) };
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, message: AI_FEEDBACK_ERROR_MESSAGES.unavailable };
  }
  const result = parseFeynmanFeedback(payload);
  return result ? { ok: true, result } : { ok: false, message: AI_FEEDBACK_ERROR_MESSAGES.unavailable };
}

/** The request content for an explanation, as the feedback route receives it. */
function feedbackContent(topic: string, explanation: string): string {
  return `Topic: ${topic}\n\nExplanation: ${explanation.trim()}`;
}

/** `basis` is the request content the message or the result is about. */
type FeedbackState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string; basis: string }
  | { status: "done"; result: FeynmanFeedback; basis: string };

export interface AiFeedbackPanelProps {
  /** The lesson or note title sent with the explanation. */
  topic: string;
  explanation: string;
  className?: string;
}

function AiFeedbackControls({ topic, explanation, className }: AiFeedbackPanelProps) {
  const [state, setState] = useState<FeedbackState>({ status: "idle" });
  const controllerRef = useRef<AbortController | null>(null);
  const resultHeadingId = useId();

  useEffect(() => () => controllerRef.current?.abort(), []);

  // Feedback (or an error) about another version of the explanation: an error is dropped, a result is marked outdated.
  const basis = feedbackContent(topic, explanation);
  const outdated = (state.status === "error" || state.status === "done") && state.basis !== basis;

  const loading = state.status === "loading";

  const requestFeedback = async () => {
    if (loading) return;
    const content = basis;
    if (explanation.trim().length < AI_FEEDBACK_MIN_CHARS) {
      setState({
        status: "error",
        message: `Write at least ${AI_FEEDBACK_MIN_CHARS} characters before asking for feedback.`,
        basis: content,
      });
      return;
    }
    if (content.length > AI_FEEDBACK_MAX_CHARS) {
      setState({ status: "error", message: AI_FEEDBACK_ERROR_MESSAGES[400], basis: content });
      return;
    }
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ status: "loading" });
    const outcome = await requestFeynmanFeedback(content, controller.signal);
    if (controller.signal.aborted) return;
    setState(
      outcome.ok
        ? { status: "done", result: outcome.result, basis: content }
        : { status: "error", message: outcome.message, basis: content },
    );
  };

  return (
    <div className={cn("flex flex-col items-start gap-3", className)}>
      {/* aria-disabled while loading, so the button keeps keyboard focus; requestFeedback ignores it then. */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={requestFeedback}
        disabled={!explanation.trim()}
        aria-disabled={loading ? true : undefined}
        className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
      >
        {loading ? "Getting AI feedback…" : "Get AI feedback"}
      </Button>
      <div role="status" aria-live="polite" className="w-full">
        {state.status === "error" && !outdated ? <p className={errorTextClass}>{state.message}</p> : null}
        {state.status === "done" ? (
          <div
            aria-labelledby={resultHeadingId}
            role="group"
            className="rounded-md border border-border bg-background/70 p-4 text-sm text-foreground"
          >
            {outdated ? (
              <p className="mb-2 text-xs font-medium text-amber-800 dark:text-amber-200">
                Outdated: this feedback is for an earlier version of your explanation. Choose Get AI feedback to check
                the current one.
              </p>
            ) : null}
            <p id={resultHeadingId} className="font-semibold">
              AI feedback · score {state.result.score} / 100
            </p>
            <p className="mt-2 whitespace-pre-wrap break-words">{state.result.feedback}</p>
            {state.result.missingConcepts.length > 0 ? (
              <>
                <p className="mt-3 font-semibold">Concepts to add</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {state.result.missingConcepts.map((concept, index) => (
                    <li key={`${index}-${concept}`} className="whitespace-pre-wrap break-words">
                      {concept}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            <p className="mt-3 text-xs text-muted-foreground">AI feedback can be wrong: check it against the lesson.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * "Get AI feedback" on an explanation, with the result as plain text. Renders
 * nothing (and never requests anything) unless the AI tutor is on and a
 * learner is signed in.
 */
export function AiFeedbackPanel(props: AiFeedbackPanelProps) {
  const enabled = useServerFeature("aiTutor");
  if (!enabled) return null;
  return <AiFeedbackControls {...props} />;
}

// ---------------------------------------------------------------------------
// Teach it back
// ---------------------------------------------------------------------------

export interface FeynmanPromptWidgetProps {
  /** The lesson title: shown in the prompt and saved with the explanation. */
  conceptTitle?: string;
  /**
   * The canonical lesson pathname, '/curriculum/<Tier>/<Module>/<lesson>'.
   * Defaults to the current pathname; with neither, saving is disabled.
   */
  lessonPath?: string;
}

type SaveStatus =
  | { kind: "idle" }
  | { kind: "saved"; outcome: "saved" | "memory-only" }
  | { kind: "error"; message: string };

/**
 * "Teach it back": the learner explains the lesson in their own words and
 * saves the explanation to the notebook in this browser (one entry per
 * lesson). The saved text is restored after mount; it is written only when
 * the learner chooses "Save to notebook". Renders no <section>: the lesson's
 * practice block owns the section and its "Teach it back" heading.
 */
const FeynmanPromptWidget: React.FC<FeynmanPromptWidgetProps> = ({ conceptTitle, lessonPath }) => {
  const pathname: string | null = usePathname();
  const path = canonicalPath(lessonPath ?? pathname);
  const entryId = path ? teachBackEntryId(path) : null;
  const entry = useKeyedRecord(notebookEntries, entryId);
  const savedBody = entry?.body ?? "";

  const [draft, setDraft] = useState("");
  const [edited, setEdited] = useState(false);
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const baseId = useId();
  const textareaId = `${baseId}-explanation`;
  const hintId = `${baseId}-hint`;
  const checklistId = `${baseId}-checklist`;

  // Another lesson (a client navigation that keeps this widget mounted): drop this lesson's unsaved draft.
  const [draftEntryId, setDraftEntryId] = useState(entryId);
  if (draftEntryId !== entryId) {
    setDraftEntryId(entryId);
    setEdited(false);
    setStatus({ kind: "idle" });
  }

  // Restore (and follow changes from the notebook or another tab) until the learner edits.
  useEffect(() => {
    if (!edited) setDraft(savedBody);
  }, [edited, savedBody]);

  // Grow the textarea with its content.
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [draft]);

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(event.target.value);
    setEdited(true);
    setStatus({ kind: "idle" });
  };

  const canSave = Boolean(path) && draft.trim().length > 0 && draft !== savedBody;
  const overLimit = draft.length > NOTEBOOK_BODY_MAX_CHARS;

  const handleSave = () => {
    if (!path || !canSave) return;
    const outcome = upsertTeachBack({ lessonPath: path, lessonTitle: conceptTitle?.trim() ?? "", body: draft });
    if (outcome === "saved" || outcome === "memory-only") {
      recordActivity("note");
      setEdited(false);
      setStatus({ kind: "saved", outcome });
      return;
    }
    setStatus({
      kind: "error",
      message: notebookWriteErrorMessage(outcome, { entryId, title: conceptTitle?.trim() ?? "", body: draft }),
    });
  };

  const notebookLink = (
    <Link href={NOTEBOOK_HREF} className={linkClass}>
      Open notebook
    </Link>
  );

  return (
    <div className="rounded-2xl border border-primary/30 bg-secondary/20 p-4 dark:border-primary/40 dark:bg-secondary/10 sm:p-5">
      <div className="flex items-start gap-3">
        <Lightbulb aria-hidden="true" className="mt-0.5 h-6 w-6 flex-shrink-0 text-primary" />
        <p className="min-w-0 text-sm text-foreground/80">
          Explain {conceptTitle ? `"${conceptTitle}"` : "this concept"} in your own simple words, as if to a colleague
          who is new to it. Gaps show up where the explanation gets vague.
        </p>
      </div>

      <p id={checklistId} className="mt-4 text-sm font-semibold text-foreground">
        Check your explanation:
      </p>
      <ul aria-labelledby={checklistId} className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground/80">
        {TEACH_BACK_SELF_CHECK.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <label htmlFor={textareaId} className="mt-4 block text-sm font-semibold text-foreground">
        Your explanation
      </label>
      <textarea
        id={textareaId}
        ref={textareaRef}
        value={draft}
        onChange={handleChange}
        aria-describedby={hintId}
        placeholder="Type your explanation here. The simpler, the better."
        rows={4}
        className="mt-2 min-h-[6rem] w-full resize-none overflow-y-hidden rounded-md border border-border bg-background/70 p-3 text-sm text-foreground outline-none transition-shadow duration-150 ease-in-out focus:border-transparent focus:ring-2 focus:ring-primary motion-reduce:transition-none dark:bg-background/40"
      />
      <div className="mt-1 flex flex-wrap items-start justify-between gap-x-4 gap-y-1 text-xs">
        <p id={hintId} className="text-muted-foreground">
          Stored only in this browser, in your notebook, when you choose Save to notebook.
        </p>
        <p className={overLimit ? "font-medium text-red-700 dark:text-red-300" : "text-muted-foreground"}>
          {formatCount(draft.length)} / {formatCount(NOTEBOOK_BODY_MAX_CHARS)} characters
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {/*
          With nothing new to save the button is aria-disabled rather than disabled, so it keeps keyboard focus
          right after a save; handleSave ignores it then. Without a lesson path it can never save: disabled.
        */}
        <Button
          type="button"
          onClick={handleSave}
          size="sm"
          variant="default"
          disabled={!path}
          aria-disabled={path && !canSave ? true : undefined}
          className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        >
          Save to notebook
        </Button>
      </div>

      <p role="status" aria-live="polite" className="mt-3 text-sm text-foreground">
        {status.kind === "saved" && status.outcome === "saved" ? (
          <>
            Saved in this browser · {notebookLink}
          </>
        ) : null}
        {status.kind === "saved" && status.outcome === "memory-only" ? (
          <span className="font-medium text-amber-800 dark:text-amber-200">
            {writeOutcomeMessage("memory-only")}{" "}
            <Link href={BACKUP_HREF} className={linkClass}>
              Back up your data
            </Link>{" "}
            · {notebookLink}
          </span>
        ) : null}
        {status.kind === "error" ? (
          <span className={errorTextClass}>
            {status.message} {notebookLink}
          </span>
        ) : null}
      </p>

      <AiFeedbackPanel topic={conceptTitle?.trim() || "This lesson"} explanation={draft} className="mt-3" />
    </div>
  );
};

export default FeynmanPromptWidget;
