"use client";

import React, { useState } from "react";

import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { cn } from "@/lib/utils";

interface Option {
  id: string;
  label: string;
  correct: boolean;
  /** Diagnoses why this choice fits or does not. */
  feedback: string;
}

interface Challenge {
  id: string;
  prompt: string;
  options: Option[];
  /** Idiomatic code for the best choice. */
  code: string;
}

export const PACKET_SORTER_CHALLENGES: Challenge[] = [
  {
    id: "in-order",
    prompt: "Packets arrive one at a time and must be processed in arrival order. Which structure holds them?",
    options: [
      { id: "queue", label: "Queue", correct: true, feedback: "push_back on arrival, pop_front to process: FIFO order with no index bookkeeping (§7.10)." },
      { id: "dynamic-array", label: "Dynamic array", correct: false, feedback: "A dynamic array cannot grow one element at a time. You would reallocate with new[n+1](arr) per packet and track a read index yourself." },
      { id: "associative-array", label: "Associative array", correct: false, feedback: "It works only if you invent sequence-number keys. A queue gives you arrival order for free." },
    ],
    code: "pkt_t pkt_q[$];\npkt_q.push_back(p);      // monitor\np = pkt_q.pop_front();   // checker",
  },
  {
    id: "sparse",
    prompt: "You store error packets indexed by their 32-bit error ID. Only a handful of IDs ever occur. Which structure?",
    options: [
      { id: "associative-array", label: "Associative array", correct: true, feedback: "Entries exist only for IDs you write, and exists() checks membership without a warning (§7.8, §7.9.3)." },
      { id: "dynamic-array", label: "Dynamic array", correct: false, feedback: "Indexing by a 32-bit ID would need new[2**32] elements to hold the largest ID." },
      { id: "queue", label: "Queue", correct: false, feedback: "Every lookup would be a linear search with find_first_index. Associative arrays look up by key." },
    ],
    code: "pkt_t err_pkts[bit [31:0]];\nerr_pkts[p.err_id] = p;\nif (err_pkts.exists(id)) ...",
  },
  {
    id: "unknown-count",
    prompt: "You collect every packet length for statistics at the end of the test. You do not know how many packets will arrive. Which structure?",
    options: [
      { id: "queue", label: "Queue", correct: true, feedback: "push_back grows the queue by one each time. At the end, lens.sum() with (int'(item)) and friends work on it directly." },
      { id: "dynamic-array", label: "Dynamic array", correct: false, feedback: "Dynamic arrays have no push_back. You would write lens = new[lens.size()+1](lens) for every packet: a reallocate-and-copy each time (§7.5.1)." },
      { id: "associative-array", label: "Associative array", correct: false, feedback: "It works with a counter as the key, but you invent and manage an index that a queue provides for free." },
    ],
    code: "int lens[$];\nlens.push_back(p.len);           // per packet\ntotal = lens.sum() with (int'(item));",
  },
  {
    id: "known-at-runtime",
    prompt: "A plusarg tells you at run time that there are N lanes. Lane results arrive in any order and you write each one by lane number. Which structure?",
    options: [
      { id: "dynamic-array", label: "Dynamic array", correct: true, feedback: "new[N] creates exactly N default-initialized slots, so lane_res[lane] = v is valid in any order (§7.5.1)." },
      { id: "queue", label: "Queue", correct: false, feedback: "Writing q[5] when size() is 2 is an invalid index: the write is ignored (§7.4.5). Queues fit in-order filling." },
      { id: "fixed-size-array", label: "Fixed-size array", correct: false, feedback: "A fixed-size array needs its size at elaboration. N is only known at run time." },
    ],
    code: "int lane_res[];\nlane_res = new[n_lanes];   // all 0 (int is 2-state)\nlane_res[lane] = result;",
  },
  {
    id: "bounded",
    prompt: "A stimulus buffer may hold at most 8 pending items. A ninth must be dropped, and the tool must tell you. Which declaration?",
    options: [
      { id: "bounded-7", label: "item_t buf[$:7]", correct: true, feedback: "The bound is the last legal index, so [$:7] holds 8 items. A ninth push_back is discarded with a required warning (§7.10.5)." },
      { id: "bounded-8", label: "item_t buf[$:8]", correct: false, feedback: "Off by one: [$:8] allows indices 0..8, which is nine items." },
      { id: "unbounded", label: "item_t buf[$]", correct: false, feedback: "An unbounded queue just grows. Nothing is dropped and nothing warns." },
    ],
    code: "item_t buf[$:7];                // indices 0..7: at most 8 items\nif (buf.size() == 8) n_drops++;  // count drops yourself if you need them\nbuf.push_back(it);              // a 9th item is discarded with a warning",
  },
  {
    id: "packed",
    prompt: "A register mirror must line up bit-for-bit with a 32-bit bus so you can assign the whole bus to it in one statement. Which declaration?",
    options: [
      { id: "packed", label: "logic [3:0][7:0] mirror", correct: true, feedback: "Packed dimensions form one 32-bit vector, so mirror = bus; works and mirror[2] is byte 2 (§7.4.1, §7.6)." },
      { id: "unpacked", label: "logic [7:0] mirror [4]", correct: false, feedback: "An unpacked array is not a vector: mirror = bus; does not compile without a cast or streaming operator (§7.6)." },
      { id: "queue", label: "logic [7:0] mirror [$]", correct: false, feedback: "A queue is an unpacked, variable-size array. It cannot be assigned from a vector either." },
    ],
    code: "logic [3:0][7:0] mirror;\nmirror = bus;           // one 32-bit assignment\nbyte2  = mirror[2];     // packed index selects byte 2",
  },
];

export const PacketSorterGame: React.FC = () => {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [finished, setFinished] = useState(false);

  const challenge = PACKET_SORTER_CHALLENGES[current];
  const chosenId = answers[challenge.id];
  const chosen = challenge.options.find((o) => o.id === chosenId);
  const best = challenge.options.find((o) => o.correct) as Option;
  const correctCount = PACKET_SORTER_CHALLENGES.filter((c) => c.options.find((o) => o.id === answers[c.id])?.correct).length;
  const answeredCount = Object.keys(answers).length;
  const total = PACKET_SORTER_CHALLENGES.length;

  const restart = () => {
    setAnswers({});
    setCurrent(0);
    setFinished(false);
  };

  if (finished) {
    return (
      <VisualFrame label="Structure choice practice" eyebrow="Practice" title="Pick the container: results" fidelity="illustration">
        <div className="space-y-4" data-testid="packet-sorter-summary" role="status">
          <p className="text-base font-semibold text-foreground" data-testid="packet-score">
            You chose the best structure in {correctCount} of {total} scenarios.
          </p>
          <p className="text-sm text-muted-foreground">
            {correctCount === total
              ? "Every choice matched the idiomatic answer."
              : "Review the scenarios marked ✕ below: each one names the rule behind the better choice."}
          </p>
          <ol className="space-y-2">
            {PACKET_SORTER_CHALLENGES.map((c) => {
              const pick = c.options.find((o) => o.id === answers[c.id]);
              const ok = Boolean(pick?.correct);
              const right = c.options.find((o) => o.correct) as Option;
              return (
                <li key={c.id} className={cn("rounded-lg border p-3 text-sm", ok ? "border-emerald-500/60 bg-emerald-500/10" : "border-rose-500/60 bg-rose-500/10")}>
                  <p className="font-medium text-foreground">
                    <span aria-hidden>{ok ? "✓ " : "✕ "}</span>
                    <span className="sr-only">{ok ? "Correct: " : "Incorrect: "}</span>
                    {c.prompt}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    You chose <strong className="text-foreground">{pick?.label ?? "nothing"}</strong>
                    {ok ? "." : <>; best is <strong className="text-foreground">{right.label}</strong>. {right.feedback}</>}
                  </p>
                </li>
              );
            })}
          </ol>
          <button type="button" onClick={restart} data-testid="packet-restart" className="min-h-10 rounded-lg border border-border/70 px-4 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Try again
          </button>
        </div>
      </VisualFrame>
    );
  }

  return (
    <VisualFrame
      label="Structure choice practice"
      eyebrow={`Practice · scenario ${current + 1} of ${total}`}
      title="Pick the container"
      summary="Choose the structure an experienced verification engineer would reach for. Every option explains itself after you answer."
      fidelity="illustration"
    >
      <div className="space-y-4" data-testid="packet-sorter-game">
        <p className="text-base font-medium text-foreground" data-testid="packet-sorter-prompt">
          {challenge.prompt}
        </p>
        <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))]" role="group" aria-label="Options">
          {challenge.options.map((option) => {
            const isChosen = chosenId === option.id;
            const revealed = Boolean(chosenId);
            return (
              <button
                key={option.id}
                type="button"
                data-testid={`packet-option-${option.id}`}
                disabled={revealed}
                onClick={() => setAnswers((a) => ({ ...a, [challenge.id]: option.id }))}
                aria-pressed={isChosen}
                className={cn(
                  "min-h-10 rounded-lg border px-3 py-2 text-left font-mono text-sm text-foreground transition-colors [font-variant-ligatures:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                  !revealed && "border-border/70 bg-background/60 hover:bg-muted",
                  revealed && option.correct && "border-emerald-500/70 bg-emerald-500/10",
                  revealed && isChosen && !option.correct && "border-rose-500/70 bg-rose-500/10",
                  revealed && !isChosen && !option.correct && "border-border/50 opacity-70",
                )}
              >
                {option.label}
                {revealed && option.correct ? <span className="ml-2 font-sans text-xs text-emerald-700 dark:text-emerald-300">✓ best choice</span> : null}
                {revealed && isChosen && !option.correct ? <span className="ml-2 font-sans text-xs text-rose-700 dark:text-rose-300">✕ your choice</span> : null}
              </button>
            );
          })}
        </div>

        <div aria-live="polite">
          {chosen ? (
            <div data-testid="packet-sorter-feedback" className="space-y-2 rounded-xl border border-border/70 bg-background/50 p-3 text-sm">
              <p className={chosen.correct ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}>
                <strong>{chosen.correct ? "Correct. " : "Not the best fit. "}</strong>
                {chosen.feedback}
              </p>
              {!chosen.correct ? (
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Best choice, {best.label}: </strong>
                  {best.feedback}
                </p>
              ) : null}
              <pre className="overflow-x-auto rounded-lg bg-slate-950/90 p-3 font-mono text-[12.5px] leading-5 text-slate-100 [font-variant-ligatures:none]">
                <code>{challenge.code}</code>
              </pre>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground" data-testid="packet-progress">
            {correctCount} correct of {answeredCount} answered
          </p>
          <button
            type="button"
            data-testid="packet-next"
            disabled={!chosen}
            onClick={() => (current < total - 1 ? setCurrent((c) => c + 1) : setFinished(true))}
            className="min-h-10 rounded-lg bg-cyan-600 px-4 text-sm font-semibold text-white hover:bg-cyan-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
          >
            {current === total - 1 ? "See results" : "Next scenario"}
          </button>
        </div>
      </div>
    </VisualFrame>
  );
};

export default PacketSorterGame;
