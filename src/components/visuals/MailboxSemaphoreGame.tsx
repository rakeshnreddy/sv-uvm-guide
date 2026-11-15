"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { HintLadder } from "@/components/visual-system/HintLadder";
import { OutcomeGroups, type OutcomeGroup } from "@/components/visual-system/OutcomeGroups";
import { PlaybackControls } from "@/components/visual-system/PlaybackControls";
import { PredictionPrompt } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { usePlayback } from "@/components/visual-system/usePlayback";
import { IpcPanel, PROCESS_MODEL_ASSUMPTIONS, ProcessLanes, ProcessTraceView, ThreadTable, linesFor } from "@/components/visuals/ForkJoinVisualizer";
import {
  BENCH_ASSUMPTIONS,
  BENCH_VARIANT_CHANGES,
  HANDOFF_REGROUP_ASSUMPTION,
  BENCH_VARIANT_LABELS,
  BENCH_VARIANTS,
  SAME_TIME_TIMING,
  SAME_TIME_VARIANT_LABELS,
  benchMoments,
  benchStory,
  endingSentence,
  firstGotAt,
  logLineText,
  outcomeRuns,
  passed,
  presentProcessRun,
  sameTimeStory,
  stepClauses,
  type BenchQuestion,
  type BenchVariant,
  type SameTimeVariant,
} from "@/lib/sv-ipc-bench-scenarios";
import {
  formatVal,
  gradeKeyLeak,
  keyLeakScenario,
  mailboxPut,
  mailboxScenario,
  mailboxTake,
  newMailbox,
  newSemaphore,
  prepareScenario,
  semaphoreGet,
  semaphorePut,
  semaphoreScenario,
  simulateProcesses,
  stepNarrationBadges,
  type KeyLeakFix,
  type MailboxCore,
  type ProcessScenario,
  type SemaphoreCore,
  type SemaphoreVariant,
  type SimResult,
  type SvVal,
} from "@/lib/sv-process-model";
import { cn } from "@/lib/utils";

type Mode = "semaphore" | "mailbox" | "debug" | "bench";

/** A semaphore-mode program that replaces the scripted FIFO prediction. */
export type MailboxSemaphoreProgram = "same-time";

interface TranscriptEntry {
  id: number;
  who: string;
  code: string;
  result: string;
  tone: "ok" | "block" | "wake" | "warn";
}

const toneClass: Record<TranscriptEntry["tone"], string> = {
  ok: "text-code-foreground",
  block: "text-amber-200",
  wake: "text-emerald-200",
  warn: "text-rose-200",
};
const toneGlyph: Record<TranscriptEntry["tone"], string> = { ok: "▶", block: "⏸", wake: "↺", warn: "⚠" };

const actionButton =
  "inline-flex min-h-10 items-center rounded-lg border border-border/70 bg-background/60 px-2.5 font-mono text-xs text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none [font-variant-ligatures:none]";

function Transcript({ entries, empty }: { entries: TranscriptEntry[]; empty: string }) {
  const latest = entries[entries.length - 1];
  return (
    <div className="space-y-2">
      <div className="max-h-64 overflow-y-auto rounded-lg border border-code-border bg-code-surface p-3 font-mono text-xs [font-variant-ligatures:none]">
        <p className="mb-1 font-sans text-label text-code-muted">SystemVerilog call log</p>
        {entries.length === 0 ? (
          <p className="text-code-muted">{empty}</p>
        ) : (
          <ol className="space-y-1">
            {entries.map((e) => (
              <li key={e.id} className={toneClass[e.tone]}>
                <span aria-hidden>{toneGlyph[e.tone]} </span>
                <span className="text-code-muted">{e.who}: </span>
                <span>{e.code}</span>
                <span className="block pl-4 font-sans text-xs text-code-muted">{e.result}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
      <p aria-live="polite" className="sr-only">
        {latest ? `${latest.who}: ${latest.code} ${latest.result}` : ""}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Semaphore sandbox: the learner issues calls; the shared IPC core decides.  */
/* ------------------------------------------------------------------------- */

type SemWho = "A" | "B" | "C";
const SEM_PROCS: SemWho[] = ["A", "B", "C"];

interface SemSandboxState {
  sem: SemaphoreCore<SemWho>;
  held: Record<SemWho, number>;
  entries: TranscriptEntry[];
}

const freshSem = (keys: number): SemSandboxState => ({ sem: newSemaphore<SemWho>(keys), held: { A: 0, B: 0, C: 0 }, entries: [] });

function SemaphoreSandbox() {
  const [initialKeys, setInitialKeys] = useState<"1" | "2">("1");
  const [state, setState] = useState<SemSandboxState>(() => freshSem(1));
  const blockedOn = (who: SemWho) => state.sem.waiters.find((w) => w.who === who);

  const act = (who: SemWho, op: "get" | "try_get" | "put", n: number) =>
    setState((s) => {
      const entries = [...s.entries];
      const held = { ...s.held };
      let nextId = s.entries.length;
      const add = (e: Omit<TranscriptEntry, "id">) => entries.push({ ...e, id: nextId++ });
      if (op === "put") {
        const r = semaphorePut(s.sem, n);
        held[who] = Math.max(0, held[who] - n);
        const free = r.state.keys + r.woken.reduce((sum, w) => sum + w.keys, 0);
        add({
          who,
          code: `sem.put(${n});`,
          result: `Returns ${n} key${n === 1 ? "" : "s"} (${free} free before waiters are served).${
            s.held[who] < n ? " This process held fewer keys than it returned: SystemVerilog does not check (§15.3.2)." : ""
          }${free > s.sem.initial ? ` The bucket now holds more than new(${s.sem.initial}) created (§15.3.1).` : ""}`,
          tone: s.held[who] < n ? "warn" : "ok",
        });
        r.woken.forEach((w, i) => {
          held[w.who] += w.keys;
          add({
            who: w.who,
            code: `sem.get(${w.keys}); // returns`,
            result: `${w.who} wakes by itself: ${i === 0 ? "first in the FIFO queue that fits" : "next in the FIFO queue"} (§15.3.3). ${r.state.keys} key${r.state.keys === 1 ? "" : "s"} left.`,
            tone: "wake",
          });
        });
        return { sem: r.state, held, entries };
      }
      const r = semaphoreGet(s.sem, who, n, op === "get");
      if (r.acquired) {
        held[who] += n;
        add({ who, code: `${op === "try_get" ? "ok = " : ""}sem.${op}(${n});`, result: `Takes ${n} key${n === 1 ? "" : "s"} at once${op === "try_get" ? " and returns 1" : ""}. ${r.state.keys} left.`, tone: "ok" });
      } else if (r.blocked) {
        add({
          who,
          code: `sem.get(${n});`,
          result: `Blocks: ${s.sem.keys} key${s.sem.keys === 1 ? "" : "s"} free, ${n} needed. ${who} is suspended at queue position ${r.state.waiters.length} and cannot run any code until keys come back.`,
          tone: "block",
        });
      } else {
        add({ who, code: `ok = sem.try_get(${n});`, result: `Returns 0 at once: only ${s.sem.keys} free. Nothing taken; ${who} keeps running — and must check ok before touching the resource.`, tone: "warn" });
      }
      return { ...s, sem: r.state, held, entries };
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          label="Semaphore keys"
          mono
          value={initialKeys}
          onChange={(k) => {
            setInitialKeys(k);
            setState(freshSem(Number(k)));
          }}
          options={[
            { value: "1", label: "semaphore sem = new(1);" },
            { value: "2", label: "semaphore sem = new(2);" },
          ]}
        />
        <button type="button" className={actionButton} onClick={() => setState(freshSem(Number(initialKeys)))}>
          Reset
        </button>
      </div>
      <div className="rounded-xl border border-border/70 p-3 text-sm">
        <p className="flex flex-wrap items-center gap-1" aria-label={`${state.sem.keys} key${state.sem.keys === 1 ? "" : "s"} in the bucket`}>
          <span className="text-xs text-muted-foreground">Bucket:</span>
          {state.sem.keys === 0 ? <span className="text-xs font-semibold text-rose-700 dark:text-rose-300">empty</span> : null}
          {Array.from({ length: Math.min(state.sem.keys, 8) }).map((_, i) => (
            <span key={i} aria-hidden className="rounded border border-amber-500/60 bg-amber-500/15 px-1 text-xs">
              ⚿
            </span>
          ))}
          {state.sem.keys > 8 ? <span className="text-xs">+{state.sem.keys - 8}</span> : null}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Wait queue (FIFO): {state.sem.waiters.length ? state.sem.waiters.map((w, i) => `${i + 1}. ${w.who} needs ${w.keys}`).join(" · ") : "empty"}
        </p>
      </div>
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,190px),1fr))]">
        {SEM_PROCS.map((who) => {
          const waiting = blockedOn(who);
          const statusId = `sem-status-${who}`;
          return (
            <div key={who} className={cn("rounded-xl border p-3", waiting ? "border-amber-500/60 bg-amber-500/[0.06]" : "border-border/70")}>
              <p className="font-semibold text-foreground">Process {who}</p>
              <p id={statusId} className={cn("mt-1 text-xs", waiting ? "text-amber-800 dark:text-amber-200" : "text-muted-foreground")}>
                <span aria-hidden>{waiting ? "⏸ " : "▶ "}</span>
                {waiting
                  ? `blocked in sem.get(${waiting.keys}) — position ${state.sem.waiters.indexOf(waiting) + 1}`
                  : `running · holds ${state.held[who]} key${state.held[who] === 1 ? "" : "s"}`}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(
                  [
                    ["get", 1],
                    ["get", 2],
                    ["try_get", 1],
                    ["put", 1],
                  ] as const
                ).map(([op, n]) => (
                  <button
                    key={`${op}${n}`}
                    type="button"
                    className={actionButton}
                    disabled={Boolean(waiting)}
                    aria-describedby={statusId}
                    aria-label={`${who}: sem.${op}(${n})`}
                    onClick={() => act(who, op, n)}
                  >
                    {op}({n})
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <Transcript entries={state.entries} empty="Click a call. Blocked processes resume by themselves when another process puts keys back — nobody polls." />
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Mailbox sandbox.                                                           */
/* ------------------------------------------------------------------------- */

type MbxWho = "producer" | "consumer 1" | "consumer 2";

interface MbxSandboxState {
  mbx: MailboxCore<MbxWho>;
  next: number;
  received: Partial<Record<MbxWho, SvVal>>;
  entries: TranscriptEntry[];
}

const freshMbx = (bound: number): MbxSandboxState => ({ mbx: newMailbox<MbxWho>(bound), next: 1, received: {}, entries: [] });

function MailboxSandbox() {
  const [bound, setBound] = useState<"2" | "1" | "0">("2");
  const [state, setState] = useState<MbxSandboxState>(() => freshMbx(2));
  const blockedPut = (who: MbxWho) => state.mbx.putWaiters.find((w) => w.who === who);
  const blockedGet = (who: MbxWho) => state.mbx.getWaiters.find((w) => w.who === who);
  const decl = `mailbox #(int) mbx = new(${bound === "0" ? "" : bound});`;

  const announce = (woken: { who: MbxWho; kind: "get" | "peek" | "put"; value: SvVal }[], add: (e: Omit<TranscriptEntry, "id">) => void, received: MbxSandboxState["received"]) =>
    woken.forEach((w) => {
      if (w.kind !== "put") received[w.who] = w.value;
      add({
        who: w.who,
        code: w.kind === "put" ? `mbx.put(${formatVal(w.value)}); // returns` : `mbx.${w.kind}(v); // returns`,
        result:
          w.kind === "put"
            ? `${w.who} wakes by itself: a slot opened, so its put completes (§15.4.3).`
            : `${w.who} wakes by itself with v = ${formatVal(w.value)}${w.kind === "peek" ? " (copied; the message stays)" : ""} — oldest waiter first (§15.4.5).`,
        tone: "wake",
      });
    });

  const put = (blocking: boolean) =>
    setState((s) => {
      const entries = [...s.entries];
      let nextId = s.entries.length;
      const add = (e: Omit<TranscriptEntry, "id">) => entries.push({ ...e, id: nextId++ });
      const received = { ...s.received };
      const value = s.next;
      const r = mailboxPut(s.mbx, "producer", value, blocking);
      if (r.blocked) {
        add({ who: "producer", code: `mbx.put(${value});`, result: `Blocks: the mailbox is full (${s.mbx.items.length}/${s.mbx.bound}). The producer is suspended until a consumer takes a message.`, tone: "block" });
      } else if (!r.stored) {
        add({ who: "producer", code: `ok = mbx.try_put(${value});`, result: "Returns 0 at once: the mailbox is full and stays unchanged (§15.4.4).", tone: "warn" });
        return { ...s, entries };
      } else {
        add({
          who: "producer",
          code: blocking ? `mbx.put(${value});` : `ok = mbx.try_put(${value});`,
          result: `Stored${blocking ? "" : "; returns 1"}. A waiting consumer, if any, receives it at once.`,
          tone: "ok",
        });
        announce(r.woken, add, received);
      }
      return { mbx: r.state, next: s.next + 1, received, entries };
    });

  const take = (who: MbxWho, peek: boolean, blocking: boolean) =>
    setState((s) => {
      const entries = [...s.entries];
      let nextId = s.entries.length;
      const add = (e: Omit<TranscriptEntry, "id">) => entries.push({ ...e, id: nextId++ });
      const received = { ...s.received };
      const op = `${blocking ? "" : "try_"}${peek ? "peek" : "get"}`;
      const r = mailboxTake(s.mbx, who, peek, blocking);
      if (r.blocked) {
        add({ who, code: `mbx.${op}(v);`, result: `Blocks: the mailbox is empty. ${who} is suspended and resumes by itself when a message arrives.`, tone: "block" });
      } else if (r.value === undefined) {
        add({ who, code: `ok = mbx.${op}(v);`, result: "Returns 0 at once: the mailbox is empty; v is unchanged.", tone: "warn" });
      } else {
        received[who] = r.value;
        add({
          who,
          code: blocking ? `mbx.${op}(v);` : `ok = mbx.${op}(v);`,
          result: `v = ${formatVal(r.value)}${peek ? " (copied; the message stays)" : ""}${blocking ? "" : "; returns 1"}.`,
          tone: "ok",
        });
        announce(r.woken, add, received);
      }
      return { ...s, mbx: r.state, received, entries };
    });

  const slots = state.mbx.bound === 0 ? Math.max(state.mbx.items.length, 3) : state.mbx.bound;
  const procs: MbxWho[] = ["producer", "consumer 1", "consumer 2"];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          label="Mailbox bound"
          mono
          value={bound}
          onChange={(b) => {
            setBound(b);
            setState(freshMbx(Number(b)));
          }}
          options={[
            { value: "2", label: "new(2)" },
            { value: "1", label: "new(1)" },
            { value: "0", label: "new() — unbounded" },
          ]}
        />
        <button type="button" className={actionButton} onClick={() => setState(freshMbx(Number(bound)))}>
          Reset
        </button>
      </div>
      <div className="rounded-xl border border-border/70 p-3 text-sm">
        <p className="font-mono text-xs [font-variant-ligatures:none]">{decl}</p>
        <ol className="mt-2 flex flex-wrap gap-1" aria-label={`${state.mbx.items.length} message${state.mbx.items.length === 1 ? "" : "s"} queued, oldest first`}>
          {Array.from({ length: slots }).map((_, i) => (
            <li
              key={i}
              className={cn(
                "flex h-9 min-w-9 items-center justify-center rounded border px-1 font-mono text-xs",
                i < state.mbx.items.length ? "border-indigo-400/70 bg-indigo-500/15" : "border-dashed border-border text-muted-foreground",
              )}
            >
              {i < state.mbx.items.length ? formatVal(state.mbx.items[i]) : "·"}
            </li>
          ))}
        </ol>
        <p className="mt-1 text-xs text-muted-foreground">
          mbx.num() = {state.mbx.items.length} · oldest on the left · blocked in get/peek:{" "}
          {state.mbx.getWaiters.length ? state.mbx.getWaiters.map((w, i) => `${i + 1}. ${w.who}${w.peek ? " (peek)" : ""}`).join(" · ") : "nobody"} · blocked in put:{" "}
          {state.mbx.putWaiters.length ? state.mbx.putWaiters.map((w) => `${w.who} (${formatVal(w.value)})`).join(" · ") : "nobody"}
        </p>
      </div>
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,190px),1fr))]">
        {procs.map((who) => {
          const waitingPut = blockedPut(who);
          const waitingGet = blockedGet(who);
          const blocked = Boolean(waitingPut || waitingGet);
          const statusId = `mbx-status-${who.replace(" ", "-")}`;
          return (
            <div key={who} className={cn("rounded-xl border p-3", blocked ? "border-amber-500/60 bg-amber-500/[0.06]" : "border-border/70")}>
              <p className="font-semibold capitalize text-foreground">{who}</p>
              <p id={statusId} className={cn("mt-1 text-xs", blocked ? "text-amber-800 dark:text-amber-200" : "text-muted-foreground")}>
                <span aria-hidden>{blocked ? "⏸ " : "▶ "}</span>
                {waitingPut
                  ? `blocked in mbx.put(${formatVal(waitingPut.value)}) — full`
                  : waitingGet
                    ? `blocked in mbx.${waitingGet.peek ? "peek" : "get"}(v) — empty`
                    : who === "producer"
                      ? `running · next value ${state.next}`
                      : `running · v = ${state.received[who] === undefined ? "(nothing yet)" : formatVal(state.received[who])}`}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {who === "producer" ? (
                  <>
                    <button type="button" className={actionButton} disabled={blocked} aria-label={`producer: mbx.put(${state.next})`} aria-describedby={statusId} onClick={() => put(true)}>
                      put({state.next})
                    </button>
                    <button type="button" className={actionButton} disabled={blocked} aria-label={`producer: ok = mbx.try_put(${state.next})`} aria-describedby={statusId} onClick={() => put(false)}>
                      try_put({state.next})
                    </button>
                  </>
                ) : (
                  (
                    [
                      ["get", false, true],
                      ["try_get", false, false],
                      ["peek", true, true],
                      ["try_peek", true, false],
                    ] as const
                  ).map(([label, peek, blocking]) => (
                    <button
                      key={label}
                      type="button"
                      className={actionButton}
                      disabled={blocked}
                      aria-describedby={statusId}
                      aria-label={`${who}: mbx.${label}(v)`}
                      onClick={() => take(who, peek, blocking)}
                    >
                      {label}(v)
                    </button>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
      <Transcript entries={state.entries} empty="Fill the mailbox, then keep putting — or let both consumers wait on an empty mailbox and watch who gets the first message." />
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Scripted predictions, run on the full process engine.                      */
/* ------------------------------------------------------------------------- */

interface ScriptedOption {
  id: string;
  label: string;
  feedback: string;
  matches: boolean;
}

function ScriptedPredict({
  idPrefix,
  variants,
  build,
  question,
  options,
  notice,
}: {
  idPrefix: string;
  variants: { value: string; label: string }[];
  build: (variant: string) => ProcessScenario;
  question: (variant: string) => string;
  options: (variant: string, result: SimResult) => ScriptedOption[];
  notice: string;
}) {
  const [variant, setVariant] = useState(variants[0].value);
  const scenario = useMemo(() => build(variant), [build, variant]);
  const prepared = useMemo(() => prepareScenario(scenario), [scenario]);
  // Shown as every mode shows a run: put() hand-offs regrouped to follow §15.4.3.
  const result = useMemo(() => presentProcessRun(simulateProcesses(scenario)), [scenario]);
  const lines = useMemo(() => linesFor(prepared), [prepared]);
  const opts = options(variant, result);
  return (
    <div className="space-y-3">
      <SegmentedControl label={`${idPrefix} program`} mono value={variant} onChange={setVariant} options={variants} />
      <CodeTrace label="Code (generated from the model)" lines={lines} />
      <PredictionPrompt resetKey={`${idPrefix}:${variant}`} question={question(variant)} options={opts.map((o) => ({ id: o.id, label: o.label, correct: o.matches, feedback: o.feedback }))}>
        <div className="space-y-3">
          <p className="text-sm text-foreground">
            <strong>What to notice: </strong>
            {notice}
          </p>
          <ProcessTraceView prepared={prepared} result={result} resetKey={`${idPrefix}:${variant}`} />
        </div>
      </PredictionPrompt>
    </div>
  );
}

const timeOf = (r: SimResult, text: string) => r.log.find((l) => l.text === text)?.time;

const buildSemaphore = (variant: string) => semaphoreScenario(variant as SemaphoreVariant);
const buildMailbox = (variant: string) => mailboxScenario(Number(variant));

function semaphoreOptions(variant: string, r: SimResult): ScriptedOption[] {
  if (variant === "multi-key") {
    const t = timeOf(r, "B got 2 keys");
    return [
      { id: "0", label: "t = 0 ns", matches: t === 0, feedback: "new(0) creates an empty bucket, so get(2) blocks at once." },
      { id: "5", label: "t = 5 ns", matches: t === 5, feedback: "At 5 ns only one key is in the bucket. get(2) needs both keys at the same time." },
      { id: "10", label: "t = 10 ns", matches: t === 10, feedback: "Right: the second put(1) at 10 ns makes two keys, and B's get(2) completes by itself — no polling." },
      { id: "never", label: "Never", matches: t === undefined, feedback: "put() can raise the count above the initial value: new(0) is only the starting count (§15.3.1)." },
    ];
  }
  const t = timeOf(r, "C got the key");
  return [
    { id: "4", label: "t = 4 ns", matches: t === 4, feedback: "At 4 ns A still holds the only key, so C's get(1) blocks." },
    { id: "10", label: "t = 10 ns", matches: t === 10, feedback: "C is not first in line: B started waiting at 2 ns, C at 4 ns, and the queue is FIFO — A's key goes to B (§15.3.3)." },
    { id: "15", label: "t = 15 ns", matches: t === 15, feedback: "Right: A's key goes to B at 10 ns (B queued first). B returns it at 15 ns and C, next in the FIFO queue, wakes by itself." },
    { id: "never", label: "Never", matches: t === undefined, feedback: "Every holder returns its key, so each waiter eventually gets one." },
  ];
}

function mailboxOptions(variant: string, r: SimResult): ScriptedOption[] {
  const t = timeOf(r, "sent 2");
  const bound = Number(variant);
  return [
    {
      id: "0",
      label: "t = 0 ns",
      matches: t === 0,
      feedback: bound === 0 ? "Right: new() is unbounded, so put() never blocks and the producer races ahead (§15.4.1)." : `With new(${bound}) only ${bound} message${bound === 1 ? "" : "s"} fit; the next put() blocks until the consumer takes one.`,
    },
    {
      id: "10",
      label: "t = 10 ns",
      matches: t === 10,
      feedback:
        bound === 2
          ? "Right: 0 and 1 fill the mailbox and put(2) blocks. The consumer's first get at 10 ns frees a slot, and the producer resumes by itself."
          : bound === 1
            ? "With room for one message, put(2) has to wait for the second get, at 20 ns."
            : "An unbounded mailbox never makes put() wait.",
    },
    {
      id: "20",
      label: "t = 20 ns",
      matches: t === 20,
      feedback: bound === 1 ? "Right: each put waits for the previous message to be taken — put(1) completes at 10 ns, put(2) at 20 ns." : "Count the slots: the producer only waits once the mailbox is full.",
    },
    { id: "never", label: "Never", matches: t === undefined, feedback: "The consumer keeps taking messages, so the producer always gets room eventually." },
  ];
}

/* ------------------------------------------------------------------------- */
/* Debug: the lost key.                                                       */
/* ------------------------------------------------------------------------- */

const LEAK_SUSPECTS: { key: string; culprit: boolean; feedback: string }[] = [
  { key: "send-get", culprit: false, feedback: "get() blocking is its job. The question is why no key ever comes back." },
  {
    key: "send-error",
    culprit: true,
    feedback: "Yes. The error path returns while send(2) still holds the bus key. Nothing ever puts it back, so every later get(1) waits forever.",
  },
  { key: "send-put", culprit: false, feedback: "This put is correct — but the error path never reaches it." },
  { key: "checker-call", culprit: false, feedback: "The checker is a victim: it waits for the key that send(2) took with it." },
];

const LEAK_FIXES: { id: KeyLeakFix; label: string; review: string }[] = [
  {
    id: "put-before-return",
    label: "if (id == 2) begin bus.put(1); return; end",
    review: "Accepted. Every path out of send now returns the key. In bigger code, prefer one exit point that always runs put().",
  },
  { id: "put-early", label: "Move bus.put(1) right after bus.get(1)", review: "Rejected. Nothing hangs, but the key no longer protects the bus: two senders drive it together (COLLISION)." },
  {
    id: "try-get",
    label: "Use void'(bus.try_get(1)) so send never blocks",
    review: "Rejected. try_get returns 0 when the bus is busy, the code ignores it and drives anyway, and its later put adds a key nobody took.",
  },
  {
    id: "two-keys",
    label: "Create the bus with new(2)",
    review: "Rejected. It hides this hang, but the leaked key is still gone, a second error path would hang again, and two keys let two senders in at once.",
  },
];

function KeyLeakDebug() {
  const buggy = useMemo(() => keyLeakScenario("bug"), []);
  const prepared = useMemo(() => prepareScenario(buggy), [buggy]);
  const run = useMemo(() => presentProcessRun(simulateProcesses(buggy)), [buggy]);
  const lines = useMemo(() => linesFor(prepared), [prepared]);
  const [suspect, setSuspect] = useState<string | null>(null);
  const [fixId, setFixId] = useState<KeyLeakFix | null>(null);
  const [showTrace, setShowTrace] = useState(false);
  const info = LEAK_SUSPECTS.find((s) => s.key === suspect);
  const found = info?.culprit ?? false;

  const fixRun = useMemo(() => {
    if (!fixId) return null;
    const scenario = keyLeakScenario(fixId);
    const result = presentProcessRun(simulateProcesses(scenario));
    return { scenario, result, grade: gradeKeyLeak(result), prepared: prepareScenario(scenario) };
  }, [fixId]);
  const fix = LEAK_FIXES.find((f) => f.id === fixId);

  const renderSuspect = (line: CodeTraceLine) => {
    const entry = LEAK_SUSPECTS.find((s) => s.key === line.key);
    if (!entry) return null;
    const chosen = suspect === entry.key;
    return (
      <button
        type="button"
        onClick={() => setSuspect(entry.key)}
        aria-pressed={chosen}
        aria-label={`Suspect line: ${line.text.trim()}`}
        className={cn(
          "inline-flex min-h-6 items-center rounded-md border px-2 py-0.5 font-sans text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300",
          chosen ? (entry.culprit ? "border-emerald-300 bg-emerald-400/20 text-emerald-100" : "border-rose-300 bg-rose-400/20 text-rose-100") : "border-cyan-400/50 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/20",
        )}
      >
        {chosen ? (entry.culprit ? "✓ culprit" : "✕ not it") : "suspect"}
      </button>
    );
  };

  const checks: { key: "noHang" | "noCollision" | "keysReturned"; label: string }[] = [
    { key: "noHang", label: "no process is left blocked" },
    { key: "noCollision", label: "never two senders on the bus" },
    { key: "keysReturned", label: "the bus ends with all its keys" },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-rose-500/40 bg-rose-500/[0.06] p-3 text-sm">
        <p className="font-semibold text-foreground">Symptom</p>
        <p className="mt-1 text-muted-foreground">
          The test should send four packets. Only the first completes; the run ends quietly at t = {run.endTime} ns with{" "}
          {run.blockedAtEnd.map((b) => `${b.label} stuck in ${b.on}`).join(" and ")}. SystemVerilog has no exceptions: nothing reports the lost key for you.
        </p>
        <ol className="mt-2 space-y-0.5 font-mono text-xs [font-variant-ligatures:none]" aria-label="Log of the failing run">
          {run.log.map((l, i) => (
            <li key={i}>
              <span className="text-muted-foreground">{l.time} ns</span> · {l.label}: {l.text}
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={() => setShowTrace((s) => !s)}
          aria-expanded={showTrace}
          className="mt-2 text-xs font-medium text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {showTrace ? "Hide" : "Step through"} the failing run
        </button>
      </div>
      {showTrace ? <ProcessTraceView prepared={prepared} result={run} resetKey="key-leak-bug" watch={["busy"]} /> : null}

      <CodeTrace label="Find the line that loses the key" lines={lines} renderLineControl={renderSuspect} />
      <div aria-live="polite" className="text-sm">
        {info ? (
          <p className={info.culprit ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}>
            <strong>{info.culprit ? "Found it. " : "Not this one. "}</strong>
            {info.feedback}
          </p>
        ) : null}
      </div>
      {!found ? (
        <HintLadder
          hints={[
            "Count the gets and the puts each call of send executes, for id = 1, 2 and 3.",
            "Which call of send takes a key and never gives it back?",
            "Look for a way out of the task that skips bus.put(1).",
          ]}
        />
      ) : (
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-foreground">Choose a fix. The model reruns the whole test and checks three things.</legend>
          <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))]">
            {LEAK_FIXES.map((f) => (
              <label key={f.id} className={cn("flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm", fixId === f.id ? "border-cyan-500 bg-cyan-500/10" : "border-border/70")}>
                <input type="radio" name="key-leak-fix" checked={fixId === f.id} onChange={() => setFixId(f.id)} className="size-5 shrink-0 mt-px accent-cyan-500" />
                <span className="font-mono text-xs [font-variant-ligatures:none]">{f.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {found && fixRun && fix ? (
        <div className="space-y-3" aria-live="polite">
          <ul className="space-y-1 text-sm">
            {checks.map((cr) => {
              const ok = fixRun.grade[cr.key];
              return (
                <li key={cr.key} className={ok ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}>
                  <span aria-hidden>{ok ? "✓ " : "✕ "}</span>
                  <span className="sr-only">{ok ? "passes: " : "fails: "}</span>
                  {cr.label}
                  {cr.key === "keysReturned" ? ` (${fixRun.result.finalSemaphores.bus?.keys} of ${fixRun.result.finalSemaphores.bus?.initial})` : ""}
                </li>
              );
            })}
          </ul>
          <ol className="space-y-0.5 font-mono text-xs text-muted-foreground [font-variant-ligatures:none]">
            {fixRun.result.log.map((l, i) => (
              <li key={i}>
                {l.time} ns · {l.label}: {l.text}
              </li>
            ))}
          </ol>
          <p
            className={cn(
              "rounded-lg border px-3 py-2 text-sm",
              fixRun.grade.passed ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100" : "border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-100",
            )}
          >
            <strong>{fixRun.grade.passed ? "All checks pass. " : "Code review: "}</strong>
            {fix.review}
          </p>
          <CodeTrace label="Your fixed code" lines={linesFor(fixRun.prepared)} />
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Bench: one run, scrubbed step by step, with the clause for each step.      */
/* ------------------------------------------------------------------------- */

const benchButton =
  "inline-flex min-h-10 items-center justify-center rounded-lg border border-border bg-card px-3 py-2 text-left text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none";
/** The current moment (DESIGN.md section 2, rule 3): raised surface, 2 px accent marker on the leading edge, primary text. */
const benchButtonCurrent = "aria-pressed:border-l-2 aria-pressed:border-l-primary aria-pressed:bg-muted aria-pressed:text-primary";
/** The shared primitives size some controls below 40 px (min-h-9 segments): size them for touch from here. */
const touchTargets = "[@media(pointer:coarse)]:[&_button]:min-h-10";
const benchPanel = "rounded-xl border border-border bg-card p-3";
const benchLabel = "text-label text-muted-foreground";

/** What happened at this step, why, and the clause that says so. */
function BenchStepNote({ step, result }: { step: SimResult["trace"][number]; result: SimResult }) {
  const badges = stepNarrationBadges(step, { outcome: result.outcome });
  const clauses = stepClauses(step);
  return (
    <div className={benchPanel} data-testid="bench-step-note">
      {/* Only a short summary is announced; Why and the clause stay readable on demand. */}
      <p className="sr-only" aria-live="polite" data-testid="bench-step-announce">
        t = {step.time} ns: {step.what}
      </p>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-medium text-foreground">{badges.kind}</span>
        <span className="rounded border border-border px-1.5 py-0.5 text-muted-foreground">{badges.where}</span>
        {badges.choice ? <span className="rounded bg-warning-subtle px-1.5 py-0.5 text-warning">{badges.choice}</span> : null}
        <span className="ml-auto font-mono tabular-nums text-muted-foreground">t = {step.time} ns</span>
      </div>
      <p className="mt-2 text-sm font-medium text-foreground [font-variant-ligatures:none]">
        <span className="text-muted-foreground">What: </span>
        {step.what}
      </p>
      <p className="mt-1 text-sm text-muted-foreground [font-variant-ligatures:none]">
        <span className="font-medium text-foreground">Why: </span>
        {step.why}
      </p>
      <p className="mt-1 text-xs text-muted-foreground" data-testid="bench-step-clause">
        {clauses.length ? `IEEE 1800-2023 ${clauses.join(", ")}` : "Model narration (no clause for this step)"}
      </p>
    </div>
  );
}

/** Each named event: whether it was triggered in this time step, and who waits on it. */
function EventPanel({ step }: { step: SimResult["trace"][number] }) {
  const names = Object.keys(step.events);
  if (names.length === 0) return null;
  return (
    <div className="space-y-2">
      {names.map((name) => {
        const waiting = step.procs.filter((p) => p.state === "blocked" && p.blockedOn?.startsWith(`@(${name})`)).map((p) => p.label);
        return (
          <div key={name} className={cn(benchPanel, "text-sm")}>
            <p className="font-mono text-xs font-semibold text-foreground [font-variant-ligatures:none]">event {name}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              <span aria-hidden>{step.events[name] ? "◆ " : "◇ "}</span>
              {step.events[name] ? `Triggered in this time step (${name}.triggered is 1 until time advances, §15.5.3)` : "Not triggered in this time step"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Waiting in @({name}): {waiting.length ? waiting.map((w) => <span key={w} className="mr-1 inline-flex items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-foreground"><span aria-hidden>⏸</span>{w}</span>) : "nobody"}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/** The run's output: time stamp, process and text, on the code surface. */
function BenchLog({ step, label = "Simulation output" }: { step: SimResult["trace"][number]; label?: string }) {
  const newest = step.kind === "print" ? step.log.length - 1 : -1;
  return (
    <div className="rounded-lg border border-code-border bg-code-surface p-3 font-mono text-xs text-code-foreground [font-variant-ligatures:none]">
      <p className="mb-1 font-sans text-label text-code-muted">{label}</p>
      {step.log.length === 0 ? (
        <span className="text-code-muted">(no output yet)</span>
      ) : (
        <ol className="space-y-0.5" aria-label={label}>
          {step.log.map((l, i) => (
            <li key={i} className={cn("flex gap-3", i === newest && "font-semibold")}>
              <span className="w-12 shrink-0 text-right tabular-nums text-code-muted">{l.time}</span>
              <span className="min-w-0 break-words">
                <span className="text-code-muted">{l.label}: </span>
                {l.severity ? `$${l.severity}: ` : ""}
                {l.text}
                {i === newest ? <span className="sr-only"> (just printed)</span> : null}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Code, step note, scrubber, key moments, queues, event, lanes and log for one model run. */
function BenchTrace({ result, lines, resetKey, logNote }: { result: SimResult; lines: CodeTraceLine[]; resetKey: string; logNote?: string }) {
  const playback = usePlayback(result.trace.length, resetKey);
  const index = Math.min(playback.index, result.trace.length - 1);
  const step = result.trace[index];
  const moments = useMemo(() => benchMoments(result), [result]);
  const contextKeys = step.procs.filter((p) => p.state !== "done" && p.state !== "killed" && p.lineKey).map((p) => p.lineKey as string);
  return (
    <div className="space-y-4" data-testid="bench-trace">
      <BenchStepNote step={step} result={result} />
      <div className={touchTargets}>
        <PlaybackControls playback={playback} stepCount={result.trace.length} stepNoun="Process step" describeStep={(i) => result.trace[i]?.what ?? ""} />
      </div>
      <div className="space-y-1">
        <p className={benchLabel}>Jump to</p>
        <div className="flex flex-wrap gap-2">
          {moments.map((m) => (
            <button key={m.id} type="button" className={cn(benchButton, benchButtonCurrent)} aria-pressed={index === m.index} onClick={() => playback.seek(m.index)}>
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid items-start gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))]">
        <CodeTrace label="Code under simulation" lines={lines} activeKey={step.lineKey} contextKeys={contextKeys} />
        <div className="min-w-0 space-y-3">
          <IpcPanel step={step} />
          <EventPanel step={step} />
          <ThreadTable step={step} lines={lines} />
        </div>
      </div>
      <ProcessLanes result={result} index={index} />
      <div className="space-y-1">
        <BenchLog step={step} />
        {logNote ? <p className="text-xs text-muted-foreground">{logNote}</p> : null}
      </div>
    </div>
  );
}

/** Mounted inside a prompt's reveal: tells the chain that this question has been answered or skipped. */
function RevealSignal({ index, onReveal }: { index: number; onReveal: (index: number) => void }) {
  useEffect(() => onReveal(index), [index, onReveal]);
  return null;
}

/**
 * The questions one after another: each opens only after the one before it is
 * answered (or skipped), and the reveal content comes after the last one,
 * outside the prompt cards.
 */
function QuestionChain({ questions, resetKey, children }: { questions: BenchQuestion[]; resetKey: string; children: React.ReactNode }) {
  const [state, setState] = useState({ key: resetKey, revealed: 0 });
  const revealed = state.key === resetKey ? state.revealed : 0;
  const onReveal = useCallback(
    (index: number) => setState((s) => ({ key: resetKey, revealed: Math.max(s.key === resetKey ? s.revealed : 0, index + 1) })),
    [resetKey],
  );
  return (
    <div className="space-y-4">
      {questions.slice(0, revealed + 1).map((q, i) => (
        <PredictionPrompt
          key={`${resetKey}:${q.id}`}
          className={cn(touchTargets, "[&>div:empty]:hidden")}
          resetKey={`${resetKey}:${q.id}`}
          question={q.question}
          options={q.options.map((o) => ({ id: o.id, label: o.label, correct: o.correct, feedback: o.feedback }))}
        >
          <RevealSignal index={i} onReveal={onReveal} />
        </PredictionPrompt>
      ))}
      {revealed >= questions.length ? children : null}
    </div>
  );
}

/** Under the bench's log: where the time stamp and process columns come from. */
const BENCH_LOG_NOTE = "The model adds each line's time stamp and process name; the lesson's code prints them itself with %0t, $time and the process name.";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const blockedText = (r: SimResult) => {
  const blocked = r.blockedAtEnd.filter((b) => b.label !== "clock");
  return blocked.length ? `${blocked.map((b) => `${b.label} blocked in ${b.on.split(" — ")[0]}`).join("; ")}; ended at ${r.endTime} ns` : `nobody blocked; ended at ${r.endTime} ns`;
};

const groupLines = (r: SimResult) => r.log.map((l) => ({ time: `${l.time} ns`, text: logLineText(l).replace(/^\d+ /, "") }));

function BenchLab() {
  const [variant, setVariant] = useState<BenchVariant>("as-written");
  const [advanced, setAdvanced] = useState(false);
  const story = useMemo(() => benchStory(variant, { advanced }), [variant, advanced]);
  const lines = useMemo(() => linesFor(prepareScenario(story.scenario)), [story.scenario]);
  const runs = useMemo(() => (story.exploration ? outcomeRuns(story.scenario, story.exploration) : []), [story]);
  const [selected, setSelected] = useState<string>("o0");
  const key = `${variant}:${advanced ? "clock" : "plain"}`;
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setSelected("o0");
  }
  const groups: OutcomeGroup[] = (story.exploration?.outcomes ?? []).map((g, i) => ({
    id: `o${i}`,
    title: passed(runs[i] ?? g.result) ? "PASS printed" : "No PASS line",
    runCount: g.runs.length,
    lines: groupLines(runs[i] ?? g.result),
    endState: blockedText(runs[i] ?? g.result),
    badge: passed(runs[i] ?? g.result) ? "✓ chk was already waiting" : "✕ chk missed the trigger",
  }));
  const shown = story.exploration ? (runs[Number(selected.slice(1))] ?? story.result) : story.result;
  const advancedId = "mailbox-bench-advanced";

  return (
    <div className="space-y-4">
      <div className={cn("space-y-3", touchTargets)}>
        <div className="space-y-1">
          <p className={benchLabel}>Bench change</p>
          <SegmentedControl label="Bench change" value={variant} onChange={setVariant} options={BENCH_VARIANTS.map((v) => ({ value: v, label: BENCH_VARIANT_LABELS[v] }))} />
        </div>
        <label htmlFor={advancedId} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
          <input id={advancedId} type="checkbox" className="size-5 shrink-0 accent-primary" checked={advanced} onChange={(e) => setAdvanced(e.target.checked)} />
          <span>
            Advanced: add <code className="font-mono text-xs [font-variant-ligatures:none]">always #5 clk = ~clk;</code> and a <code className="font-mono text-xs [font-variant-ligatures:none]">#100 $finish</code> watchdog
          </span>
        </label>
      </div>
      <p className="text-sm text-muted-foreground">{BENCH_VARIANT_CHANGES[variant]}</p>
      <CodeTrace label="Code (generated from the model)" lines={lines} />
      <QuestionChain questions={story.questions} resetKey={key}>
        <div className="space-y-4">
          {story.exploration ? (
            <OutcomeGroups
              groups={groups}
              runCount={story.exploration.runCount}
              capped={story.exploration.capped}
              onSelect={setSelected}
              selectedId={selected}
              selectLabel="Step through this run"
              label="Outcomes across every order of the ready processes"
              note="Lines are compared by time stamp: lines printed at one time stamp count as a set, because their order inside the time stamp is a scheduler choice too."
            />
          ) : (
            <p className="text-sm text-foreground" data-testid="bench-ending">
              {endingSentence(story.result)}
            </p>
          )}
          <BenchTrace key={`${key}:${selected}`} result={shown} lines={lines} resetKey={`${key}:${selected}`} logNote={BENCH_LOG_NOTE} />
        </div>
      </QuestionChain>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Same-time arrivals at the semaphore's FIFO queue.                          */
/* ------------------------------------------------------------------------- */

function SameTimeLab() {
  const [variant, setVariant] = useState<SameTimeVariant>("shared-key");
  const story = useMemo(() => sameTimeStory(variant), [variant]);
  const lines = useMemo(() => linesFor(prepareScenario(story.scenario)), [story.scenario]);
  const runs = useMemo(() => outcomeRuns(story.scenario, story.exploration), [story]);
  const [selected, setSelected] = useState("o0");
  const [lastVariant, setLastVariant] = useState(variant);
  if (variant !== lastVariant) {
    setLastVariant(variant);
    setSelected("o0");
  }
  const groups: OutcomeGroup[] = story.exploration.outcomes.map((g, i) => {
    const run = runs[i] ?? g.result;
    const first = firstGotAt(run, SAME_TIME_TIMING.releaseNs);
    const queue = story.queues[i] ?? [];
    return {
      id: `o${i}`,
      title: first ? `${first} first at ${SAME_TIME_TIMING.releaseNs} ns` : `Nobody at ${SAME_TIME_TIMING.releaseNs} ns`,
      runCount: g.runs.length,
      lines: groupLines(run),
      endState: queue.length ? `queue at ${SAME_TIME_TIMING.arriveNs} ns: ${queue.join(", then ")}` : `ended at ${run.endTime} ns`,
    };
  });
  const shown = runs[Number(selected.slice(1))] ?? story.result;
  return (
    <div className="space-y-3">
      <div className={cn("space-y-1", touchTargets)}>
        <p className={benchLabel}>Same-time program</p>
        <SegmentedControl
          label="Same-time program"
          value={variant}
          onChange={setVariant}
          options={(["shared-key", "owner"] as const).map((v) => ({ value: v, label: SAME_TIME_VARIANT_LABELS[v] }))}
        />
      </div>
      <CodeTrace label="Code (generated from the model)" lines={lines} />
      <QuestionChain questions={[story.question]} resetKey={`same-time:${variant}`}>
        <div className="space-y-4">
          <OutcomeGroups
            groups={groups}
            runCount={story.exploration.runCount}
            capped={story.exploration.capped}
            onSelect={setSelected}
            selectedId={selected}
            label="Outcomes across every order of the ready processes"
            note={
              variant === "owner"
                ? "One process owns the decision, so the time-stamped log no longer depends on which request arrived first."
                : `The FIFO queue keeps the arrival order (§15.3.3); the ${plural(groups.length, "group")} differ only in that arrival order.`
            }
          />
          <BenchTrace key={`${variant}:${selected}`} result={shown} lines={lines} resetKey={`same-time:${variant}:${selected}`} />
        </div>
      </QuestionChain>
    </div>
  );
}

/* ------------------------------------------------------------------------- */

interface MailboxSemaphoreGameProps {
  mode?: Mode;
  /** Semaphore mode only: "same-time" replaces the scripted FIFO prediction with two waiters arriving in one time slot. */
  initialProgram?: MailboxSemaphoreProgram;
}

/**
 * Mailboxes and semaphores on the process model: blocked callers wake by
 * themselves in FIFO order, try_* never block, get(n) waits for n keys, and a
 * lost key deadlocks the test. Bench mode runs the lesson's whole bench; the
 * same-time program shows what FIFO does not promise.
 */
export default function MailboxSemaphoreGame({ mode: initialMode = "semaphore", initialProgram }: MailboxSemaphoreGameProps) {
  const [mode, setMode] = useState<Mode>(initialMode);
  if (initialMode === "bench") {
    return (
      <div data-testid="mailbox-semaphore-game">
        <VisualFrame
          label="IPC bench lab"
          eyebrow="Make It Work"
          title="One bench: backpressure, a key queue and an event"
          summary="Pick the bench or one of the lesson's three breaks. Predict first, then scrub the run: watch the mailbox slot, the bus key queue and the drv_done trigger. Read the log by time stamp, not by line order."
          fidelity="model"
          assumptions={[...PROCESS_MODEL_ASSUMPTIONS, ...BENCH_ASSUMPTIONS]}
        >
          <BenchLab />
        </VisualFrame>
      </div>
    );
  }
  const sameTime = initialProgram === "same-time";
  return (
    <div data-testid="mailbox-semaphore-game">
      <VisualFrame
        label="Mailbox and semaphore lab"
        eyebrow={mode === "debug" ? "Debug it" : "Interprocess communication"}
        title={
          mode === "semaphore"
            ? sameTime
              ? "Same-time arrivals: what FIFO does and does not promise"
              : "Semaphores: keys, waiters and FIFO wake-up"
            : mode === "mailbox"
              ? "Mailboxes: bounded queues that block"
              : "The test that stops after one packet"
        }
        summary="Predict a scripted run first, then drive the calls yourself. Blocked processes are woken by the model — you never have to click them again."
        fidelity="model"
        assumptions={
          sameTime ? [...PROCESS_MODEL_ASSUMPTIONS, ...BENCH_ASSUMPTIONS] : mode === "mailbox" ? [...PROCESS_MODEL_ASSUMPTIONS, HANDOFF_REGROUP_ASSUMPTION] : PROCESS_MODEL_ASSUMPTIONS
        }
      >
        <div className={touchTargets}>
          <SegmentedControl
            label="Lab"
            value={mode}
            onChange={setMode}
            options={[
              { value: "semaphore", label: "Semaphore" },
              { value: "mailbox", label: "Mailbox" },
              { value: "debug", label: "Debug: the lost key" },
            ]}
          />
        </div>
        {mode === "semaphore" ? (
          <div className="space-y-6">
            {sameTime ? (
              <SameTimeLab />
            ) : (
              <ScriptedPredict
                key="Semaphore"
                idPrefix="Semaphore"
                variants={[
                  { value: "fifo", label: "FIFO wake-up" },
                  { value: "multi-key", label: "get(2)" },
                ]}
                build={buildSemaphore}
                question={(v) => (v === "multi-key" ? "When does B print “B got 2 keys”?" : "When does C print “C got the key”?")}
                options={semaphoreOptions}
                notice="Watch the wait queue under the code: a put() wakes the oldest waiter whose request fits, with no extra click or poll."
              />
            )}
            <section aria-label="Semaphore sandbox" className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground">Your turn: you decide which process calls what</h4>
              <SemaphoreSandbox />
            </section>
          </div>
        ) : mode === "mailbox" ? (
          <div className="space-y-6">
            <ScriptedPredict
              key="Mailbox"
              idPrefix="Mailbox"
              variants={[
                { value: "2", label: "new(2)" },
                { value: "1", label: "new(1)" },
                { value: "0", label: "new()" },
              ]}
              build={buildMailbox}
              question={() => "When does the producer print “sent 2”?"}
              options={mailboxOptions}
              notice="Watch the producer's lane turn amber while the mailbox is full; it resumes in the same time step as the consumer's get."
            />
            <section aria-label="Mailbox sandbox" className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground">Your turn: a producer and two consumers</h4>
              <MailboxSandbox />
            </section>
          </div>
        ) : (
          <KeyLeakDebug />
        )}
      </VisualFrame>
    </div>
  );
}
