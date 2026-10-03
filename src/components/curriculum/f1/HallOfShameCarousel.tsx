"use client";

import Image from "next/image";
import React, { useId, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";

export interface HallOfShameSource {
  label: string;
  url: string;
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
  },
];

interface HallOfShameCarouselProps {
  /** Defaults to the verified incidents above. */
  items?: HallOfShameItem[];
}

const navButton =
  "inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400 motion-reduce:transition-none";

/**
 * One incident at a time, moved only by the learner: buttons, dots, or ←/→
 * while focus is inside. No auto-advance and no slide animation.
 */
const HallOfShameCarousel = ({ items = HALL_OF_SHAME_INCIDENTS }: HallOfShameCarouselProps) => {
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
      className="not-prose relative my-8 w-full overflow-hidden rounded-3xl border border-white/10 bg-slate-950/90 p-4 text-white shadow-xl"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-2 pb-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-rose-300">
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
          className="grid gap-6 rounded-2xl border border-white/10 bg-slate-900/80 p-4 shadow-inner sm:p-6 grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))]"
        >
          <div className="min-w-0 space-y-4">
            {item.image ? (
              <div className="relative h-48 w-full overflow-hidden rounded-2xl border border-white/10">
                <Image src={item.image} alt="" fill sizes="(min-width: 1024px) 40vw, 90vw" className="object-cover" />
              </div>
            ) : null}
            <h4 className="text-lg font-semibold text-rose-200">{item.title}</h4>
            <p className="text-sm leading-relaxed text-slate-200">{item.story}</p>
          </div>
          <div className="flex min-w-0 flex-col gap-4 rounded-2xl border border-white/10 bg-slate-950/60 p-5 text-sm text-slate-200">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Impact</p>
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
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Sources</p>
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
      <p className="mt-2 text-center text-[11px] text-slate-400">Use the arrows, the dots, or ← / → while focus is inside. Nothing advances on its own.</p>
    </section>
  );
};

export default HallOfShameCarousel;
