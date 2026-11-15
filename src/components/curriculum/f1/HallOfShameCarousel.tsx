"use client";

import Image from "next/image";
import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";

import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { cn } from "@/lib/utils";

export interface HallOfShameSource {
  label: string;
  url: string;
}

/** One answer to "which check was missing?", with the reason it is right or wrong. */
export interface HallOfShameCheckOption {
  text: string;
  correct: boolean;
  /** Diagnoses the thinking behind this choice, using only facts on the card. */
  feedback: string;
}

/** The escape analysis for one incident, read across the cards on the summary slide. */
export interface HallOfShameEscape {
  /** The question the verification plan never asked. */
  question: string;
  /** The check that answers it. */
  check: string;
  /** When that check would have run. */
  when: string;
}

export interface HallOfShameItem {
  title: string;
  story: string;
  impact: string;
  /** Decorative picture; optional. */
  image?: string;
  /** The check that would have caught it, revealed on demand. */
  lesson?: string;
  /** Where each claim on the card can be checked. */
  sources?: HallOfShameSource[];
  /** With `predict`, the learner picks the missing check from these before the lesson is shown. */
  checkOptions?: HallOfShameCheckOption[];
  /** With `predict`, the row this card adds to the summary slide. */
  escape?: HallOfShameEscape;
}

/**
 * Verified incident cards. Every date, number and root cause below was
 * checked on 2026-10-03 against the linked sources; numbers that only appear
 * in secondary retellings (e.g. a dollar cost for Ariane 501) are left out.
 */
export const HALL_OF_SHAME_INCIDENTS: HallOfShameItem[] = [
  {
    title: "Intel Pentium FDIV bug (1994) · hardware",
    image: "/visuals/pentium-fdiv.svg",
    story:
      "The Pentium's floating-point divider looked up quotient digits in a table, and entries that should have held +2 held 0. Most divisions never reached them: Intel's own analysis put the rate at about 1 in 9 billion random divides. Prof. Thomas Nicely reported wrong results in October 1994. Intel first replaced chips only for users who could show they needed the accuracy, then on 19 December 1994 offered a replacement to anyone who asked.",
    impact: "A $475 million pre-tax charge, taken in the fourth quarter of 1994, to cover replacement and inventory costs.",
    lesson:
      "A table that fed every division was not checked exhaustively against its mathematical definition, and random tests almost never reached the bad entries. An equivalence check of the table against its specification, or a formal proof of the divider, finds this; random simulation alone did not.",
    sources: [
      { label: "K. Shirriff, “Intel's $475 million error: the silicon behind the Pentium division bug” (2024)", url: "https://www.righto.com/2024/12/this-die-photo-of-pentium-shows.html" },
      { label: "A. Edelman, “The Mathematics of the Pentium Division Bug”, SIAM Review 39(1), 1997", url: "https://epubs.siam.org/doi/10.1137/S0036144595293959" },
      { label: "Intel Corporation, Form 10-K for fiscal 1994 (SEC filing)", url: "https://www.sec.gov/Archives/edgar/data/0000050863/000005086395000004/0000050863-95-000004.txt" },
    ],
    checkOptions: [
      {
        text: "More random divides in simulation",
        correct: false,
        feedback:
          "Random divides are what almost never reached the bad entries: Intel's own estimate was about 1 in 9 billion random divides. More of the same stimulus asks the same question with the same long odds, and random simulation before release did not find it.",
      },
      {
        text: "An exhaustive or formal check of the quotient table against its mathematical definition, at block level",
        correct: true,
        feedback:
          "Every division used the table, so every entry had to be right. Comparing the whole table with its definition, or proving the divider formally, checks every entry without waiting for random stimulus to reach the bad ones.",
      },
      {
        text: "A faster clock check on the divider",
        correct: false,
        feedback:
          "The fault was in what the table held (entries that should have held +2 held 0), not in when signals arrived. A timing check asks whether logic settles within the clock period; it never compares table entries with their definition.",
      },
    ],
    escape: {
      question: "Is every entry of the table correct?",
      check: "Compare the whole table with its mathematical definition, or prove the divider formally.",
      when: "When the block is built, at block level.",
    },
  },
  {
    title: "Ariane 5 Flight 501 (4 June 1996) · software reuse",
    story:
      "A software failure, included here as a reuse lesson. About 37 seconds after main-engine ignition, both inertial reference computers stopped: converting the 64-bit floating-point horizontal bias to a 16-bit signed integer overflowed, and that conversion was not protected. The code came from Ariane 4, whose trajectory kept the value in range; Ariane 5 builds up horizontal velocity about five times faster. The launcher veered off course and broke up about 39 seconds after ignition.",
    impact:
      "The launcher and its payload, ESA's four Cluster science satellites, were lost. The official inquiry report gives no cost figure, so none is quoted here.",
    lesson:
      "Reused code was not re-verified against the new operating range: no test fed it an Ariane 5 trajectory. Verification plans must be redone when the environment changes, even for code that has flown before.",
    sources: [
      { label: "ESA/CNES Inquiry Board, “Ariane 501 – Report by the Board of Inquiry” (July 1996)", url: "https://sci.esa.int/web/cluster/-/38889-ariane-501-report-by-board-of-inquiry" },
      { label: "ESA press release, “Flight 501 failure – first information” (1996)", url: "https://www.esa.int/Newsroom/Press_Releases/Flight_501_failure-_first_information" },
    ],
    checkOptions: [
      {
        text: "None: the code had already flown on Ariane 4, so it was proven",
        correct: false,
        feedback:
          "It was proven only for Ariane 4's trajectory, which kept the value in range. Ariane 5 builds up horizontal velocity about five times faster, so the old evidence did not cover the new range.",
      },
      {
        text: "A second inertial reference computer as a backup",
        correct: false,
        feedback:
          "Both inertial reference computers stopped, because the same unprotected conversion overflowed in both. A backup that runs the same code meets the same failure.",
      },
      {
        text: "A faster clock check on the flight computers",
        correct: false,
        feedback:
          "The failure was a value out of range: converting the 64-bit floating-point horizontal bias to a 16-bit signed integer overflowed. A timing check never feeds the code an Ariane 5 trajectory, so it cannot see that.",
      },
      {
        text: "Re-verifying the reused code over Ariane 5's operating range, with an Ariane 5 trajectory as input",
        correct: true,
        feedback:
          "Reused code carries the old environment's assumptions with it. Feeding it the new trajectory tests the range it will actually see, which is where the 16-bit conversion overflowed.",
      },
    ],
    escape: {
      question: "Does the reused code still hold over the new operating range?",
      check: "Verify the reused code again over the new operating range.",
      when: "Whenever the operating environment changes, even for code that has flown before.",
    },
  },
  {
    title: "Spectre and Meltdown (disclosed January 2018) · hardware security",
    image: "/visuals/spectre-meltdown.svg",
    story:
      "Processors execute instructions speculatively and throw the results away when the guess was wrong, but the cache keeps traces of what was touched. By timing cache accesses, code can read data it was never allowed to see. The researchers reported it to vendors in June 2017 and published on 3 January 2018. Spectre was demonstrated on Intel, AMD and ARM processors; Meltdown was verified on Intel processors, and ARM reported some of its cores affected.",
    impact:
      "Operating systems shipped workarounds such as kernel page-table isolation (KPTI), which slows workloads that make many system calls; one detailed Linux analysis measured from about 1% to several percent, more at high system-call rates.",
    lesson:
      "Every instruction returned the architecturally correct result, so functional verification passed. The flaw was in what timing reveals. Security verification needs properties about information flow, not only about values.",
    sources: [
      { label: "Google Project Zero, “Reading privileged memory with a side-channel” (3 Jan 2018)", url: "https://projectzero.google/2018/01/reading-privileged-memory-with-side.html" },
      { label: "Meltdown and Spectre papers and FAQ (Graz University of Technology et al.)", url: "https://meltdownattack.com/" },
      { label: "B. Gregg, “KPTI/KAISER Meltdown Initial Performance Regressions” (2018)", url: "https://www.brendangregg.com/blog/2018-02-09/kpti-kaiser-meltdown-performance.html" },
    ],
    checkOptions: [
      {
        text: "More functional tests of each instruction's result",
        correct: false,
        feedback:
          "Every instruction returned the architecturally correct result, so functional verification already passed. More checks on values ask the same question again; the leak was in what timing reveals.",
      },
      {
        text: "Security properties about information flow: what timing can reveal about data the code may not read",
        correct: true,
        feedback:
          "The results were right but the cache kept traces of what speculation touched, and timing those accesses revealed data the code was never allowed to see. A property about information flow, not about values, is what asks that question.",
      },
      {
        text: "A faster clock check on the cache",
        correct: false,
        feedback:
          "A timing check asks whether logic settles within the clock period. The leak was that how long a cache access takes depends on what speculation touched, which a clock-period check never asks about.",
      },
    ],
    escape: {
      question: "What does timing reveal about data the code may not read?",
      check: "Security properties about information flow, beside the functional checks.",
      when: "Alongside functional verification, which passed.",
    },
  },
];

/* -------------------------------------------------------------------------
 * Escape-analysis model (pure, no React). The task limits this extension to
 * this file and its test, so the model lives here rather than in src/lib.
 * Facts come only from the cards and their cited sources; nothing is
 * computed from table geometry (the 1 in 9 billion figure is Intel's
 * estimate, quoted, never derived).
 * ---------------------------------------------------------------------- */

/** The thread the lesson draws across the cards (F1A, "What each card teaches"). */
export const COMMON_THREAD = "The plan never asked the question that failed.";

/**
 * Options for the summary slide. They describe the default incidents, so they
 * are used only with those (or when a lesson passes its own threadOptions).
 * The correct option's feedback is built from the cards' escape questions.
 */
export function defaultThreadOptions(items: HallOfShameItem[] = HALL_OF_SHAME_INCIDENTS): HallOfShameCheckOption[] {
  const questions = items.map((i) => i.escape?.question).filter((q): q is string => Boolean(q));
  const quoted = questions.map((q) => `“${q}”`);
  const list = quoted.length < 2 ? quoted.join("") : `${quoted.slice(0, -1).join(", ")} and ${quoted[quoted.length - 1]}`;
  return [
    {
      text: "Each team ran too few simulation cycles",
      correct: false,
      feedback:
        "More of the same stimulus would not have helped: random divides almost never reached the bad FDIV entries, no test fed the reused Ariane code an Ariane 5 trajectory, and Spectre and Meltdown passed every functional check.",
    },
    {
      text: "The verification plan never asked the question that failed",
      correct: true,
      feedback: `Each check that would have caught an escape answers a question the plan did not ask: ${list} A passing regression shows only that the checks you wrote passed for the stimulus you ran.`,
    },
    {
      text: "All three lacked the same technique: formal verification",
      correct: false,
      feedback:
        "The three checks differ: an exhaustive or formal table check, re-verifying reused code over a new range, and information-flow security properties. The point is the question each plan failed to ask, not one missing technique.",
    },
    {
      text: "All three were software bugs",
      correct: false,
      feedback:
        "Only Ariane 501 was a software failure, included as a reuse lesson. FDIV was in the divider's lookup table, and Spectre and Meltdown come from how processors speculate and what the cache keeps.",
    },
  ];
}

/** Why a card's options cannot gate its reveal; empty when they can. */
export function checkOptionProblems(options: HallOfShameCheckOption[] | undefined): string[] {
  if (!options || options.length === 0) return ["no options are given"];
  const problems: string[] = [];
  if (options.length < 2) problems.push("a prediction needs at least two options");
  const correct = options.filter((o) => o.correct).length;
  if (correct !== 1) problems.push(`exactly one option must be correct (found ${correct})`);
  if (options.some((o) => !o.text.trim())) problems.push("an option has no text");
  if (options.some((o) => !o.feedback.trim())) problems.push("an option has no feedback");
  const texts = options.map((o) => o.text.trim().toLowerCase()).filter(Boolean);
  if (new Set(texts).size !== texts.length) problems.push("two options have the same text");
  return problems;
}

/** Stable ids per slide, so feedback and results never mix between cards. */
export function toPredictionOptions(options: HallOfShameCheckOption[], slideKey: string): PredictionOption[] {
  return options.map((o, i) => ({ id: `${slideKey}-${i}`, label: o.text, correct: o.correct, feedback: o.feedback }));
}

export type PredictSlide =
  | { kind: "incident"; item: HallOfShameItem; incident: number }
  | { kind: "summary"; options: HallOfShameCheckOption[] };

/**
 * One slide per incident, then the common-thread summary when there are
 * thread options for this set of items and at least one incident.
 */
export function buildPredictSlides(items: HallOfShameItem[], threadOptions?: HallOfShameCheckOption[]): PredictSlide[] {
  const slides: PredictSlide[] = items.map((item, incident) => ({ kind: "incident", item, incident }));
  const options = threadOptions ?? (items === HALL_OF_SHAME_INCIDENTS ? defaultThreadOptions(items) : undefined);
  if (items.length > 0 && options && checkOptionProblems(options).length === 0) slides.push({ kind: "summary", options });
  return slides;
}

export function slideName(slide: PredictSlide, incidentCount: number): string {
  return slide.kind === "incident" ? `${slide.item.title} (${slide.incident + 1} of ${incidentCount})` : "The common thread (summary)";
}

export function slideAnnouncement(slide: PredictSlide | undefined, incidentCount: number): string {
  if (!slide) return "";
  return slide.kind === "incident"
    ? `Incident ${slide.incident + 1} of ${incidentCount}: ${slide.item.title}`
    : `Summary: the common thread across ${incidentCount} ${incidentCount === 1 ? "incident" : "incidents"}`;
}

/** The learner's record: per incident, whether a locked-in prediction was right. */
export type PredictionResults = Record<number, boolean>;

/** True when a card's options can take a prediction (otherwise it falls back to the plain reveal). */
export function canPredictItem(item: HallOfShameItem): boolean {
  return Boolean(item.checkOptions) && checkOptionProblems(item.checkOptions).length === 0;
}

/**
 * `incidentCount` bounds the result keys; `predictableCount` (default: every
 * incident) is the number of cards that can take a prediction at all.
 */
export function tallyText(results: PredictionResults, incidentCount: number, predictableCount: number = incidentCount): string {
  const locked = Object.keys(results).filter((k) => Number(k) < incidentCount);
  const right = locked.filter((k) => results[Number(k)]).length;
  const cards = (n: number) => `${n} ${n === 1 ? "card" : "cards"}`;
  const skipped = incidentCount - predictableCount;
  const note = skipped > 0 ? ` ${cards(skipped)} had no prediction to make.` : "";
  if (predictableCount <= 0) return `None of the ${cards(incidentCount)} takes a prediction.`;
  if (locked.length === 0) return `No prediction locked in yet on the ${cards(predictableCount)}.${note}`;
  return `You locked in a prediction on ${locked.length} of ${cards(predictableCount)} and chose the missing check on ${right}.${note}`;
}

/**
 * Incidents whose reveal the learner has not opened. The summary's options
 * and feedback name every card's check, so the summary stays locked until
 * this is empty: a card is never answered before its own reveal.
 */
export function pendingReveals(incidentCount: number, revealed: ReadonlySet<number>): number[] {
  return Array.from({ length: incidentCount }, (_, i) => i).filter((i) => !revealed.has(i));
}

export function pendingText(pending: number[]): string {
  if (pending.length === 0) return "";
  const names = pending.map((i) => `${i + 1}`);
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `The summary names every card's missing check, so it opens once you have opened each card's reveal. Still to open: incident${pending.length === 1 ? "" : "s"} ${list}.`;
}

export interface EscapeRow {
  incident: number;
  title: string;
  /** Hidden until that card's own reveal, so the summary never answers it. */
  escape: HallOfShameEscape | null;
  hasEscape: boolean;
}

export function escapeRows(items: HallOfShameItem[], revealed: ReadonlySet<number>): EscapeRow[] {
  return items.map((item, incident) => ({
    incident,
    title: item.title,
    hasEscape: Boolean(item.escape),
    escape: item.escape && revealed.has(incident) ? item.escape : null,
  }));
}

interface HallOfShameCarouselProps {
  /** Defaults to the verified incidents above. */
  items?: HallOfShameItem[];
  /**
   * Predict-then-reveal: each card hides its lesson until the learner picks
   * the missing check, then a summary slide asks for the common thread.
   * Without it the carousel renders as it always has.
   */
  predict?: boolean;
  /** Summary-slide options for a lesson's own items (the defaults describe the default incidents). */
  threadOptions?: HallOfShameCheckOption[];
}

const navButton =
  "inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400 motion-reduce:transition-none";

/**
 * One incident at a time, moved only by the learner: buttons, dots, or ←/→
 * while focus is inside. No auto-advance and no slide animation.
 */
const HallOfShameCarousel = ({ items = HALL_OF_SHAME_INCIDENTS, predict = false, threadOptions }: HallOfShameCarouselProps) => {
  if (predict) return <PredictCarousel items={items} threadOptions={threadOptions} />;
  return <ClassicCarousel items={items} />;
};

const ClassicCarousel = ({ items }: { items: HallOfShameItem[] }) => {
  const [index, setIndex] = useState(0);
  const [lessonShown, setLessonShown] = useState(false);
  const lessonId = useId();
  const count = items.length;
  const item = items[Math.min(index, Math.max(0, count - 1))];

  const go = (next: number) => {
    if (count === 0) return;
    setIndex(((next % count) + count) % count);
    setLessonShown(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      go(index + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      go(index - 1);
    }
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Hall of Shame: cautionary bug stories"
      onKeyDown={onKeyDown}
      className="not-prose relative my-8 w-full overflow-hidden rounded-3xl border border-code-border bg-code-surface p-4 text-white shadow-xl"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-2 pb-4">
        <div>
          <p className="flex items-center gap-2 text-label text-rose-300">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            Cautionary tales, with sources
          </p>
          <h3 className="text-2xl font-bold text-white">The Hall of Shame</h3>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => go(index - 1)} aria-label="Previous incident" className={navButton} disabled={count < 2}>
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <span className="font-mono text-xs text-slate-300" aria-hidden>
            {count ? index + 1 : 0}/{count}
          </span>
          <button type="button" onClick={() => go(index + 1)} aria-label="Next incident" className={navButton} disabled={count < 2}>
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>

      {item ? (
        <article
          aria-roledescription="slide"
          aria-label={`${item.title} (${index + 1} of ${count})`}
          className="grid gap-6 rounded-2xl border border-code-border bg-slate-900/80 p-4 shadow-inner sm:p-6 grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))]"
        >
          <div className="min-w-0 space-y-4">
            {item.image ? (
              <div className="relative h-48 w-full overflow-hidden rounded-2xl border border-code-border">
                <Image src={item.image} alt="" fill sizes="(min-width: 1024px) 40vw, 90vw" className="object-cover" />
              </div>
            ) : null}
            <h4 className="text-lg font-semibold text-rose-200">{item.title}</h4>
            <p className="text-sm leading-relaxed text-slate-200">{item.story}</p>
          </div>
          <div className="flex min-w-0 flex-col gap-4 rounded-2xl border border-code-border bg-slate-950/60 p-5 text-sm text-slate-200">
            <div>
              <p className="text-label text-code-muted">Impact</p>
              <p className="text-base font-semibold text-white">{item.impact}</p>
            </div>
            {item.lesson ? (
              <div>
                <button
                  type="button"
                  aria-expanded={lessonShown}
                  aria-controls={lessonId}
                  onClick={() => setLessonShown((s) => !s)}
                  className="inline-flex min-h-10 items-center rounded-lg border border-amber-400/50 bg-amber-400/10 px-3 text-left text-sm font-medium text-amber-100 hover:bg-amber-400/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
                >
                  {lessonShown ? "Hide the lesson" : "What check would have caught it? Think, then reveal"}
                </button>
                <p id={lessonId} hidden={!lessonShown} className="mt-2 leading-relaxed text-slate-100">
                  {item.lesson}
                </p>
              </div>
            ) : null}
            <div>
              <p className="text-label text-code-muted">Sources</p>
              {item.sources && item.sources.length > 0 ? (
                <ul className="mt-1 list-disc space-y-1 pl-5 text-xs">
                  {item.sources.map((s) => (
                    <li key={s.url}>
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-sky-300 underline underline-offset-2 hover:text-sky-200">
                        {s.label}
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-slate-400">No source given for this card.</p>
              )}
            </div>
          </div>
        </article>
      ) : null}

      <p className="sr-only" aria-live="polite">
        {item ? `Incident ${index + 1} of ${count}: ${item.title}` : ""}
      </p>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-1" role="group" aria-label="Choose an incident">
        {items.map((it, i) => (
          <button
            key={`dot-${i}`}
            type="button"
            className="group inline-flex h-10 min-w-10 items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400"
            onClick={() => go(i)}
            aria-label={`Go to incident ${i + 1}: ${it.title}`}
            aria-current={i === index ? "true" : undefined}
          >
            <span
              aria-hidden
              className={`h-2 w-8 rounded-full transition-colors motion-reduce:transition-none ${i === index ? "bg-rose-400" : "bg-white/30 group-hover:bg-white/50"}`}
            />
          </button>
        ))}
      </div>
      <p className="mt-2 text-center text-xs text-slate-400">Use the arrows, the dots, or ← / → while focus is inside. Nothing advances on its own.</p>
    </section>
  );
};

/* ----------------------------- Predict mode ----------------------------- */

const secondaryButton =
  "inline-flex min-h-10 items-center justify-center rounded-lg border border-border bg-muted px-3 text-sm font-medium text-foreground transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none";
const iconButton = cn(secondaryButton, "w-10 px-0");
const labelClass = "text-label text-muted-foreground";

/** Marks a slide as revealed once PredictionPrompt renders its reveal (locked in or skipped). */
function RevealMarker({ incident, onReveal }: { incident: number; onReveal: (incident: number) => void }) {
  useEffect(() => {
    onReveal(incident);
  }, [incident, onReveal]);
  return null;
}

function SourceList({ sources }: { sources?: HallOfShameSource[] }) {
  return (
    <div>
      <p className={labelClass}>Sources</p>
      {sources && sources.length > 0 ? (
        <ul className="mt-1 list-disc pl-5 text-xs text-foreground">
          {sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center py-1 text-primary underline underline-offset-2">
                {s.label}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">No source given for this card.</p>
      )}
    </div>
  );
}

function LessonToggle({ lesson, onShow }: { lesson: string; onShow: () => void }) {
  const [shown, setShown] = useState(false);
  const id = useId();
  return (
    <div>
      <button
        type="button"
        aria-expanded={shown}
        aria-controls={id}
        onClick={() => {
          if (!shown) onShow();
          setShown((v) => !v);
        }}
        className={cn(secondaryButton, "text-left")}
      >
        {shown ? "Hide the lesson" : "What check would have caught it? Think, then reveal"}
      </button>
      <p id={id} hidden={!shown} className="mt-2 text-sm leading-relaxed text-foreground">
        {lesson}
      </p>
    </div>
  );
}

function IncidentSlide({
  item,
  incident,
  onCommit,
  onReveal,
  isActive,
  isRevealed,
}: {
  item: HallOfShameItem;
  incident: number;
  onCommit: (incident: number, correct: boolean) => void;
  onReveal: (incident: number) => void;
  /** Every slide stays mounted, so a card with nothing to reveal counts as opened only once it is shown. */
  isActive: boolean;
  isRevealed: boolean;
}) {
  const problems = item.checkOptions ? checkOptionProblems(item.checkOptions) : [];
  const canPredict = canPredictItem(item);
  return (
    <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))]">
      <div className="min-w-0 space-y-3">
        {item.image ? (
          <div className="relative h-40 w-full overflow-hidden rounded-lg border border-border">
            <Image src={item.image} alt="" fill sizes="(min-width: 1024px) 40vw, 90vw" className="object-cover" />
          </div>
        ) : null}
        <h4 className="text-base font-semibold text-foreground">{item.title}</h4>
        <p className="text-sm leading-relaxed text-foreground">{item.story}</p>
        <div className="rounded-lg border border-border bg-muted p-3">
          <p className={labelClass}>Impact</p>
          <p className="text-sm font-medium text-foreground">{item.impact}</p>
        </div>
      </div>
      <div className="min-w-0 space-y-3">
        {canPredict && item.checkOptions ? (
          <PredictionPrompt
            question="Which check would have caught it before it escaped?"
            options={toPredictionOptions(item.checkOptions, `incident-${incident}`)}
            onCommit={(_, correct) => onCommit(incident, correct)}
            className="[@media(pointer:coarse)]:[&_button]:min-h-10"
          >
            <div className="space-y-3" data-testid={`reveal-${incident}`}>
              <RevealMarker incident={incident} onReveal={onReveal} />
              {item.lesson ? (
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className={labelClass}>What this card teaches</p>
                  <p className="text-sm leading-relaxed text-foreground">{item.lesson}</p>
                </div>
              ) : null}
              {item.escape ? (
                <dl className="grid gap-2 rounded-lg border border-border bg-card p-3 text-sm grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))]">
                  <div>
                    <dt className={labelClass}>The question the plan never asked</dt>
                    <dd className="text-foreground">{item.escape.question}</dd>
                  </div>
                  <div>
                    <dt className={labelClass}>When the check would have run</dt>
                    <dd className="text-foreground">{item.escape.when}</dd>
                  </div>
                </dl>
              ) : null}
              <SourceList sources={item.sources} />
            </div>
          </PredictionPrompt>
        ) : (
          <>
            {problems.length > 0 ? (
              <p className="rounded-lg border border-border bg-muted p-3 text-xs text-muted-foreground">
                This card&apos;s check options cannot be used: {problems.join("; ")}.
              </p>
            ) : null}
            {item.lesson ? (
              <LessonToggle lesson={item.lesson} onShow={() => onReveal(incident)} />
            ) : isActive ? (
              <RevealMarker incident={incident} onReveal={onReveal} />
            ) : null}
            <SourceList sources={item.sources} />
          </>
        )}
        {canPredict && !isRevealed ? <p className="text-xs text-muted-foreground">The lesson and the sources appear with the reveal.</p> : null}
      </div>
    </div>
  );
}

function SummarySlide({
  items,
  options,
  results,
  revealed,
  onGo,
}: {
  items: HallOfShameItem[];
  options: HallOfShameCheckOption[];
  results: PredictionResults;
  revealed: ReadonlySet<number>;
  onGo: (incident: number) => void;
}) {
  const pending = pendingReveals(items.length, revealed);
  const rows = escapeRows(items, revealed).filter((r) => r.escape);
  return (
    <div className="space-y-3">
      <h4 className="text-base font-semibold text-foreground">The common thread</h4>
      <p className="text-sm text-muted-foreground" data-testid="tally">
        {tallyText(results, items.length, items.filter(canPredictItem).length)}
      </p>
      {pending.length > 0 ? (
        <div className="space-y-2 rounded-lg border border-border bg-muted p-3" data-testid="summary-locked">
          <p className="text-sm text-foreground">{pendingText(pending)}</p>
          <div className="flex flex-wrap gap-2">
            {pending.map((incident) => (
              <button key={incident} type="button" className={secondaryButton} onClick={() => onGo(incident)}>
                Go to incident {incident + 1}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <PredictionPrompt
          question="What do the escapes have in common?"
          options={toPredictionOptions(options, "summary")}
          className="[@media(pointer:coarse)]:[&_button]:min-h-10"
        >
          <div className="space-y-3" data-testid="summary-reveal">
            <p className="rounded-lg border border-border bg-card p-3 text-sm font-medium text-foreground">{COMMON_THREAD}</p>
            {rows.length > 0 ? (
              <ul className="space-y-2" aria-label="Escape analysis, card by card">
                {rows.map((row) =>
                  row.escape ? (
                    <li key={row.incident} className="rounded-lg border border-border bg-card p-3 text-sm">
                      <p className="font-medium text-foreground">{row.title}</p>
                      <dl className="mt-1 grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,160px),1fr))]">
                        <div>
                          <dt className={labelClass}>The question never asked</dt>
                          <dd className="text-foreground">{row.escape.question}</dd>
                        </div>
                        <div>
                          <dt className={labelClass}>The check that catches it</dt>
                          <dd className="text-foreground">{row.escape.check}</dd>
                        </div>
                        <div>
                          <dt className={labelClass}>When it runs</dt>
                          <dd className="text-foreground">{row.escape.when}</dd>
                        </div>
                      </dl>
                    </li>
                  ) : null,
                )}
              </ul>
            ) : null}
          </div>
        </PredictionPrompt>
      )}
    </div>
  );
}

const isFormField = (target: EventTarget | null) =>
  target instanceof HTMLElement && Boolean(target.closest("input, select, textarea, fieldset"));

const PredictCarousel = ({ items, threadOptions }: { items: HallOfShameItem[]; threadOptions?: HallOfShameCheckOption[] }) => {
  const slides = buildPredictSlides(items, threadOptions);
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<PredictionResults>({});
  const [revealed, setRevealed] = useState<ReadonlySet<number>>(() => new Set());
  const current = Math.min(index, Math.max(0, count - 1));
  const slideRefs = useRef<(HTMLElement | null)[]>([]);
  const [focusSlide, setFocusSlide] = useState<number | null>(null);
  const threadProblems = threadOptions ? checkOptionProblems(threadOptions) : [];

  const go = (next: number) => {
    if (count === 0) return;
    setIndex(((next % count) + count) % count);
  };
  // "Go to incident N" sits on the slide it hides, so move focus to the slide it opens.
  const goAndFocus = (next: number) => {
    go(next);
    setFocusSlide(next);
  };
  useEffect(() => {
    if (focusSlide === null) return;
    slideRefs.current[focusSlide]?.focus();
    setFocusSlide(null);
  }, [focusSlide]);
  const onCommit = useCallback((incident: number, correct: boolean) => setResults((r) => ({ ...r, [incident]: correct })), []);
  const onReveal = useCallback(
    (incident: number) => setRevealed((prev) => (prev.has(incident) ? prev : new Set(prev).add(incident))),
    [],
  );

  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    // Arrow keys move between radio options inside a prediction, so leave them alone there.
    if (isFormField(event.target)) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      go(current + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      go(current - 1);
    }
  };

  return (
    <VisualFrame
      label="Hall of Shame: which check would have caught it"
      eyebrow="Escape analysis"
      title="The Hall of Shame"
      summary="For each incident, choose the check that was missing, then compare with the card's lesson. The last slide asks what the escapes share."
      fidelity="illustration"
      assumptions={[
        "Incident facts come only from the sources on each card, checked on 2026-10-03.",
        "No failure rate is modelled: the 1 in 9 billion figure is Intel's estimate, quoted, not computed from the table.",
      ]}
    >
      <div onKeyDown={onKeyDown} aria-roledescription="carousel" role="group" aria-label="Incidents">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            Cautionary tales, with sources
          </p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => go(current - 1)} aria-label="Previous incident" className={iconButton} disabled={count < 2}>
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <span className="font-mono text-xs tabular-nums text-muted-foreground" aria-hidden>
              {slides[current]?.kind === "summary" ? "Summary" : `${count ? current + 1 : 0}/${items.length}`}
            </span>
            <button type="button" onClick={() => go(current + 1)} aria-label="Next incident" className={iconButton} disabled={count < 2}>
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>

        {count === 0 ? <p className="text-sm text-muted-foreground">No incidents to show.</p> : null}
        {threadProblems.length > 0 ? (
          <p className="mb-3 rounded-lg border border-border bg-muted p-3 text-xs text-muted-foreground">
            The summary slide is left out because its options cannot be used: {threadProblems.join("; ")}.
          </p>
        ) : null}
        {slides.map((slide, i) => (
          <article
            key={slide.kind === "incident" ? `incident-${slide.incident}` : "summary"}
            aria-roledescription="slide"
            aria-label={slideName(slide, items.length)}
            hidden={i !== current}
            ref={(el) => {
              slideRefs.current[i] = el;
            }}
            tabIndex={-1}
            className="rounded-xl border border-border bg-card p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-4"
          >
            {slide.kind === "incident" ? (
              <IncidentSlide
                item={slide.item}
                incident={slide.incident}
                onCommit={onCommit}
                onReveal={onReveal}
                isActive={i === current}
                isRevealed={revealed.has(slide.incident)}
              />
            ) : (
              <SummarySlide items={items} options={slide.options} results={results} revealed={revealed} onGo={goAndFocus} />
            )}
          </article>
        ))}

        <p className="sr-only" aria-live="polite">
          {slideAnnouncement(slides[current], items.length)}
        </p>

        <div className="mt-2 flex flex-wrap items-center justify-center gap-1" role="group" aria-label="Choose an incident">
          {slides.map((slide, i) => (
            <button
              key={`dot-${i}`}
              type="button"
              className="group inline-flex h-10 min-w-10 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => go(i)}
              aria-label={slide.kind === "incident" ? `Go to incident ${slide.incident + 1}: ${slide.item.title}` : "Go to the common thread"}
              aria-current={i === current ? "true" : undefined}
            >
              <span
                aria-hidden
                className={cn(
                  "h-2 rounded-full transition-colors motion-reduce:transition-none",
                  slide.kind === "summary" ? "w-4" : "w-8",
                  i === current ? "bg-primary" : "bg-border group-hover:bg-muted-foreground",
                )}
              />
            </button>
          ))}
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Use the arrows, the dots, or ← / → while focus is outside the options. Nothing advances on its own, and each card keeps your answer.
        </p>
      </div>
    </VisualFrame>
  );
};

export default HallOfShameCarousel;
