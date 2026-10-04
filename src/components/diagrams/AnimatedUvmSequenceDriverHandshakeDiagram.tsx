"use client";

import React, { useEffect, useMemo, useState } from "react";

import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { PlaybackControls } from "@/components/visual-system/PlaybackControls";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { usePlayback } from "@/components/visual-system/usePlayback";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  driverSource,
  fixedHandshakeScenario,
  handshakeScenario,
  handshakeSequenceSource,
  simulateSequencer,
  type HandshakePresetId,
  type Lane,
  type QueueEntryView,
  type SqrStep,
  type UvmLogLine,
} from "@/lib/uvm-sequencer-model";
import { cn } from "@/lib/utils";

export const HANDSHAKE_ASSUMPTIONS = [
  "Rules follow uvm-core 2020.3.1: start_item/finish_item (uvm_sequence_base), get_next_item/item_done (uvm_sequencer), response routing (uvm_sequencer_param_base).",
  "One sequence, one sequencer, one driver. Driving one item takes 10 ns.",
  "randomize() always succeeds; pre_do, mid_do and post_do are empty.",
  "A hang is reported when nothing can change any more, or at the model's time limit. A real test keeps waiting until the phase timeout.",
];

interface PresetCopy {
  label: string;
  group: "learn" | "debug";
  blurb: string;
  question: string;
  options: PredictionOption[];
  fixLabel?: string;
  fixNote?: string;
}

const PRESETS: Record<HandshakePresetId, PresetCopy> = {
  basic: {
    label: "Clean handshake",
    group: "learn",
    blurb: "burst_seq sends three items. The driver pulls each one, drives it for 10 ns, then calls item_done().",
    question: "At t = 5 ns the driver is halfway through driving A1. Where is burst_seq?",
    options: [
      {
        id: "finish",
        label: "Blocked inside finish_item(A1), waiting for item_done()",
        correct: true,
        feedback: "finish_item() is send_request() plus wait_for_item_done(). It cannot return until the driver says the item is done, so the sequence cannot even reach start_item() for A2.",
      },
      {
        id: "next-start",
        label: "Already in start_item(A2): the sequencer buffers the next item",
        correct: false,
        feedback: "The sequencer does not prefetch. Its request FIFO holds the one item the driver is working on, and the next grant only happens when the driver calls get_next_item() again.",
      },
      {
        id: "done",
        label: "Back in body(): finish_item() returned when the driver took the item",
        correct: false,
        feedback: "Taking the item (get_next_item) is not completion. The item stays in the request FIFO, and finish_item() keeps waiting, until item_done().",
      },
      {
        id: "gni",
        label: "Inside get_next_item(), waiting for the driver",
        correct: false,
        feedback: "get_next_item() is the driver's call on seq_item_port. A sequence only ever calls start_item() and finish_item().",
      },
    ],
  },
  responses: {
    label: "Responses",
    group: "learn",
    blurb: "The driver answers each item with item_done(rsp) after rsp.set_id_info(req). The sequence collects it with get_response(rsp).",
    question: "When does burst_seq's get_response(rsp) for A1 return?",
    options: [
      {
        id: "now",
        label: "Immediately after finish_item(A1) returns",
        correct: true,
        feedback: "item_done(rsp) forwards the response before it wakes the sequence, so the response is already in the sequence's queue when get_response() is called.",
      },
      {
        id: "later",
        label: "Only after the driver has also called put_response(rsp)",
        correct: false,
        feedback: "item_done(rsp) already calls put_response() for you. Calling both would send two responses for one request.",
      },
      {
        id: "next",
        label: "After A2 is driven, because responses lag one item behind",
        correct: false,
        feedback: "Responses are matched to requests by sequence_id and transaction_id, not by position. Nothing delays them by an item.",
      },
    ],
  },
  missing_item_done: {
    label: "Bug: no item_done()",
    group: "debug",
    blurb: "The driver drives the item and loops straight back to get_next_item(). item_done() is missing.",
    question: "What does the log and the waveform show?",
    options: [
      {
        id: "twice",
        label: "An error 'Get_next_item called twice…' on every loop, A1 driven again and again, and burst_seq stuck in finish_item(A1)",
        correct: true,
        feedback: "A1 is still in the request FIFO, so each new get_next_item() reports the error and peeks the same item. The sequence never leaves finish_item(), so A2 never exists.",
      },
      {
        id: "driver-hang",
        label: "The driver hangs silently inside get_next_item()",
        correct: false,
        feedback: "get_next_item() does not block here: an item is already requested, so it returns the same A1 at once, with an error. The silent hang is on the sequence side.",
      },
      {
        id: "moves-on",
        label: "burst_seq moves on to A2 after a timeout",
        correct: false,
        feedback: "UVM has no per-item timeout. finish_item() waits forever for item_done(); only the phase timeout ends the test.",
      },
      {
        id: "fatal",
        label: "An immediate UVM_FATAL from item_done()",
        correct: false,
        feedback: "item_done() is never called, so it cannot complain. The fatal SQRBADITMDN is for the opposite bug: item_done() without get_next_item().",
      },
    ],
    fixLabel: "Add seq_item_port.item_done()",
    fixNote: "With item_done() each item completes and burst_seq finishes at t = 30 ns.",
  },
  double_get: {
    label: "Bug: get_next_item twice",
    group: "debug",
    blurb: "To 'look ahead', the driver calls get_next_item(req) and then get_next_item(next_req) before item_done().",
    question: "What does next_req hold?",
    options: [
      {
        id: "same",
        label: "The same handle as req, plus a UVM_ERROR",
        correct: true,
        feedback: "The sequence is still in finish_item(A1), so A2 cannot exist yet. The second call reports 'called twice' and peeks A1 again, and the driver drives A1 twice.",
      },
      {
        id: "next",
        label: "A2: the look-ahead works",
        correct: false,
        feedback: "A2 is only created after finish_item(A1) returns, which needs item_done(). The sequencer cannot hand out an item that does not exist.",
      },
      {
        id: "null",
        label: "null, because nothing else is ready",
        correct: false,
        feedback: "That is try_next_item()'s behaviour. get_next_item() never returns null.",
      },
      {
        id: "block",
        label: "The second call blocks forever",
        correct: false,
        feedback: "An item is already requested, so the call returns at once with the item still in the FIFO.",
      },
    ],
    fixLabel: "One get_next_item() per item_done()",
    fixNote: "To pipeline, use get(req) (which completes the item) or several sequences, never two get_next_item() calls.",
  },
  rsp_no_id: {
    label: "Bug: rsp without set_id_info",
    group: "debug",
    blurb: "The driver creates rsp and calls item_done(rsp) but never calls rsp.set_id_info(req).",
    question: "What happens when the response reaches the sequencer?",
    options: [
      {
        id: "fatal",
        label: "UVM_FATAL SQRPUT: 'Driver put a response with null sequence_id'",
        correct: true,
        feedback: "A freshly created rsp has sequence_id = -1. The sequencer routes responses by sequence_id, so it cannot deliver this one and stops the test.",
      },
      {
        id: "latest",
        label: "It goes to the sequence that sent the latest request",
        correct: false,
        feedback: "The sequencer never guesses. Routing uses only the ids that set_id_info() copies from the request.",
      },
      {
        id: "drop",
        label: "It is dropped silently and get_response() hangs",
        correct: false,
        feedback: "A response with no id is a fatal, not a silent drop. Silent drops happen when the response queue is full.",
      },
    ],
    fixLabel: "Call rsp.set_id_info(req)",
    fixNote: "set_id_info() copies sequence_id and transaction_id from the request.",
  },
  rsp_overflow: {
    label: "Bug: responses never collected",
    group: "debug",
    blurb: "The driver sends a response for each of 10 items. burst_seq never calls get_response().",
    question: "After 10 items, how many responses are waiting in burst_seq's response queue?",
    options: [
      {
        id: "eight",
        label: "8: responses 9 and 10 are dropped",
        correct: true,
        feedback: "response_queue_depth defaults to 8. put_base_response() drops anything beyond that. In uvm-core 2020.3.1 the drop is silent unless set_response_queue_error_report_enabled(1) was called.",
      },
      {
        id: "ten",
        label: "10: the queue grows without limit",
        correct: false,
        feedback: "Only set_response_queue_depth(-1) makes it unbounded. The default depth is 8.",
      },
      {
        id: "hang",
        label: "The driver blocks at item 9 until someone reads a response",
        correct: false,
        feedback: "Responses are delivered by functions (put_response), which cannot block. The response is dropped instead, and the driver keeps going.",
      },
      {
        id: "zero",
        label: "0: responses are discarded unless get_response() is waiting",
        correct: false,
        feedback: "Responses are queued even when nobody is waiting, up to the queue depth.",
      },
    ],
    fixLabel: "Call get_response(rsp) after each item",
    fixNote: "Alternatives: use_response_handler(1) with a response_handler() override, or set_response_queue_depth(-1) if you really want to keep every response.",
  },
  response_hang: {
    label: "Bug: waiting for a response",
    group: "debug",
    blurb: "burst_seq calls get_response(rsp) after each item, but the driver only calls item_done() with no response.",
    question: "Where does the test stop making progress?",
    options: [
      {
        id: "seq",
        label: "burst_seq blocks in get_response() after A1; the driver idles in get_next_item()",
        correct: true,
        feedback: "item_done() completed A1, so finish_item() returned. get_response() then waits for a response nobody will send, and with no new request the driver has nothing to do.",
      },
      {
        id: "finish",
        label: "burst_seq blocks in finish_item(A1)",
        correct: false,
        feedback: "item_done() was called, so finish_item() returned. The wait is one line later.",
      },
      {
        id: "driver",
        label: "The driver blocks in item_done() until the sequence asks for a response",
        correct: false,
        feedback: "item_done() is a function: it returns at once whether or not anybody wants a response.",
      },
    ],
    fixLabel: "Driver sends item_done(rsp)",
    fixNote: "Either the driver always responds, or the sequence must not call get_response().",
  },
};

const PRESET_ORDER: HandshakePresetId[] = ["basic", "responses", "missing_item_done", "double_get", "rsp_no_id", "rsp_overflow", "response_hang"];

const laneNames: Record<Lane, string> = { seq: "Sequence", sqr: "Sequencer", drv: "Driver" };
const laneCol: Record<Lane, number> = { seq: 1, sqr: 2, drv: 3 };

/** Latest step at or before `index` that set `field`. */
function lastKey(steps: SqrStep[], index: number, field: "seqCode" | "drvCode"): string | undefined {
  for (let i = index; i >= 0; i -= 1) {
    const key = steps[i]?.[field];
    if (key) return key;
  }
  return undefined;
}

export function QueueChips({ queue, lockList }: { queue: QueueEntryView[]; lockList: string[] }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Arbitration queue (front → back)</p>
      {queue.length === 0 ? (
        <p className="text-xs text-muted-foreground">empty</p>
      ) : (
        <ol className="flex flex-wrap gap-1.5" aria-label="Arbitration queue, front first">
          {queue.map((e, i) => {
            const blocked = lockList.length > 0 && !lockList.includes(e.seqId);
            return (
              <li
                key={`${e.kind}-${e.seqId}-${i}`}
                className={cn(
                  "rounded-md border px-1.5 py-0.5 font-mono text-[11px] [font-variant-ligatures:none]",
                  e.kind === "LOCK" ? "border-amber-500/60 bg-amber-500/10" : "border-cyan-500/50 bg-cyan-500/10",
                  blocked && "border-dashed opacity-70",
                )}
              >
                {e.kind === "LOCK" ? (e.grab ? "⚑ GRAB " : "🔒 LOCK ") : "REQ "}
                {e.seqId} p{e.priority}
                <span className="text-muted-foreground"> @{e.queuedAt}</span>
                {blocked ? <span className="ml-1 text-rose-700 dark:text-rose-300">⊘ blocked</span> : null}
              </li>
            );
          })}
        </ol>
      )}
      <p className="text-xs text-muted-foreground">
        lock_list:{" "}
        <span className="font-mono text-foreground [font-variant-ligatures:none]">{lockList.length ? lockList.map((id) => `🔒 ${id}`).join(", ") : "empty"}</span>
      </p>
    </div>
  );
}

export function UvmLog({ lines, label = "UVM log" }: { lines: UvmLogLine[]; label?: string }) {
  return (
    <figure className="overflow-hidden rounded-xl border border-border/70 bg-slate-950/90 text-slate-100">
      <figcaption className="border-b border-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</figcaption>
      {lines.length === 0 ? (
        <p className="px-3 py-2 font-mono text-[12px] text-slate-400">(no warnings or errors yet)</p>
      ) : (
        <ol className="max-h-40 overflow-auto px-3 py-2 font-mono text-[12px] leading-5 [font-variant-ligatures:none]">
          {lines.map((l, i) => (
            <li
              key={i}
              className={cn(
                "whitespace-pre-wrap break-words",
                l.severity === "FATAL" || l.severity === "ERROR" ? "text-rose-300" : l.severity === "WARNING" ? "text-amber-200" : "text-slate-200",
              )}
            >
              {`UVM_${l.severity} @ ${l.time} ns [${l.id}] ${l.text}`}
            </li>
          ))}
        </ol>
      )}
    </figure>
  );
}

function statusGlyph(status: string): string {
  if (status === "finished") return "✓";
  if (status === "running" || status === "driving") return "▶";
  if (status.startsWith("wait") || status === "get") return "⏸";
  if (status === "delay") return "…";
  return "○";
}

function MessageChart({ steps, index }: { steps: SqrStep[]; index: number }) {
  const rows = steps.slice(0, index + 1).filter((s) => s.message);
  const recent = rows.slice(-7);
  return (
    <div className="rounded-xl border border-border/70 bg-background/50 p-3">
      <div className="grid grid-cols-3 gap-1 border-b border-border/60 pb-1 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>Sequence</span>
        <span>Sequencer</span>
        <span>Driver</span>
      </div>
      {recent.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">No calls between components yet.</p>
      ) : (
        <ol className="mt-1 space-y-1" aria-label="Calls between sequence, sequencer and driver, oldest first">
          {recent.map((s) => {
            const m = s.message!;
            const a = laneCol[m.from];
            const b = laneCol[m.to];
            const lo = Math.min(a, b);
            const hi = Math.max(a, b);
            const forward = b > a;
            const current = s.index === recent[recent.length - 1]?.index;
            return (
              <li key={s.index} className="grid grid-cols-3 gap-1 text-[11px]">
                <span
                  style={{ gridColumn: lo === hi ? `${lo} / ${lo + 1}` : `${lo} / ${hi + 1}` }}
                  className={cn(
                    "flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono [font-variant-ligatures:none]",
                    current ? "border-cyan-500 bg-cyan-500/15 text-foreground" : "border-border/60 text-muted-foreground",
                  )}
                >
                  <span className="sr-only">
                    {laneNames[m.from]} to {laneNames[m.to]}:{" "}
                  </span>
                  <span aria-hidden>{forward ? "" : "◀─"}</span>
                  <span className="flex-1 truncate text-center">
                    t={s.time} {m.label}
                  </span>
                  <span aria-hidden>{forward ? "─▶" : ""}</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function HandshakeTrace({
  steps,
  outcome,
  onStep,
  presetId,
  fixed,
  setFixed,
  seqLine,
  drvLine,
}: {
  steps: SqrStep[];
  outcome: { kind: string; summary: string };
  onStep: (index: number | null) => void;
  presetId: HandshakePresetId;
  fixed: boolean;
  setFixed: (v: boolean) => void;
  seqLine?: string;
  drvLine?: string;
}) {
  const playback = usePlayback(steps.length, `${presetId}:${fixed}`);
  const step = steps[Math.min(playback.index, steps.length - 1)];
  const copy = PRESETS[presetId];

  useEffect(() => {
    onStep(playback.index);
  }, [playback.index, onStep]);
  useEffect(() => () => onStep(null), [onStep]);

  const seqView = step.sequences[0];
  const logSoFar = steps.slice(0, step.index + 1).flatMap((s) => (s.log ? [s.log] : []));
  const atEnd = playback.index >= steps.length - 1;

  return (
    <div className="space-y-4">
      {copy.fixLabel ? (
        <label className="flex min-h-10 items-center gap-2 text-sm">
          <input type="checkbox" checked={fixed} onChange={(e) => setFixed(e.target.checked)} className="h-4 w-4 accent-emerald-500" />
          <span>
            Apply the fix: <strong>{copy.fixLabel}</strong>
          </span>
        </label>
      ) : null}

      <PlaybackControls playback={playback} stepCount={steps.length} stepNoun="Handshake step" describeStep={(i) => steps[i]?.what ?? ""} />

      <div className="rounded-xl border border-border/70 bg-background/60 p-3" aria-live="polite">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          t = {step.time} ns · step {step.index + 1} of {steps.length}
        </p>
        <p className="mt-1 text-[15px] font-medium text-foreground">{step.what}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          <strong className="text-foreground">Why: </strong>
          {step.why}
        </p>
      </div>

      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))]">
        <div className={cn("rounded-xl border p-3", step.actor === "seq" ? "border-cyan-500" : "border-border/70")}>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span className="mr-1 rounded-full border border-amber-500/60 px-1.5 text-[9px] text-amber-800 dark:text-amber-200">SEQ</span>
            burst_seq
          </p>
          <p className="mt-1 text-sm text-foreground">
            <span aria-hidden className="mr-1">
              {statusGlyph(seqView.status)}
            </span>
            {seqView.where}
          </p>
          {seqLine ? <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground [font-variant-ligatures:none]">{seqLine.trim()}</p> : null}
          <p className="mt-1 text-xs text-muted-foreground">response queue: {step.responses.A ?? 0}/8</p>
        </div>
        <div className={cn("rounded-xl border p-3", step.actor === "sqr" ? "border-cyan-500" : "border-border/70")}>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span className="mr-1 rounded-full border border-amber-500/60 px-1.5 text-[9px] text-amber-800 dark:text-amber-200">SQR</span>
            sequencer
          </p>
          <QueueChips queue={step.queue} lockList={step.lockList} />
          <p className="mt-1 text-xs text-muted-foreground">
            request FIFO: <span className="font-mono text-foreground">{step.fifo ? `[${step.fifo}]` : "[ ]"}</span>
          </p>
        </div>
        <div className={cn("rounded-xl border p-3", step.actor === "drv" ? "border-cyan-500" : "border-border/70")}>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span className="mr-1 rounded-full border border-amber-500/60 px-1.5 text-[9px] text-amber-800 dark:text-amber-200">DRV</span>
            bus_driver
          </p>
          <p className="mt-1 text-sm text-foreground">
            <span aria-hidden className="mr-1">
              {statusGlyph(step.driver.status)}
            </span>
            {step.driver.where}
          </p>
          {drvLine ? <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground [font-variant-ligatures:none]">{drvLine.trim()}</p> : null}
        </div>
      </div>

      <MessageChart steps={steps} index={playback.index} />

      <UvmLog lines={logSoFar} />

      {atEnd ? (
        <p
          className={cn(
            "rounded-lg border px-3 py-2 text-sm font-medium",
            outcome.kind === "complete"
              ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
              : "border-rose-500/50 bg-rose-500/10 text-rose-800 dark:text-rose-200",
          )}
        >
          {outcome.kind === "complete" ? "✓ " : "✕ "}
          {outcome.summary}
          {fixed && copy.fixNote ? ` ${copy.fixNote}` : ""}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Flagship visual for the sequence ↔ sequencer ↔ driver handshake. Every lane,
 * code highlight and log line comes from simulateSequencer().
 */
export const AnimatedUvmSequenceDriverHandshakeDiagram: React.FC<{ initialPreset?: HandshakePresetId }> = ({ initialPreset = "basic" }) => {
  const [presetId, setPresetId] = useState<HandshakePresetId>(initialPreset);
  const [fixed, setFixed] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const scenario = useMemo(() => (fixed ? fixedHandshakeScenario(presetId) : handshakeScenario(presetId)), [presetId, fixed]);
  const run = useMemo(() => simulateSequencer(scenario), [scenario]);
  const seqLines: CodeTraceLine[] = useMemo(() => handshakeSequenceSource(scenario.sequences[0]).map((l) => ({ ...l, owner: "testbench" })), [scenario]);
  const drvLines: CodeTraceLine[] = useMemo(() => driverSource(scenario.driver).map((l) => ({ ...l, owner: "testbench" })), [scenario]);
  const copy = PRESETS[presetId];

  const seqKey = activeIndex === null ? undefined : lastKey(run.steps, activeIndex, "seqCode");
  const drvKey = activeIndex === null ? undefined : lastKey(run.steps, activeIndex, "drvCode");
  const onStep = React.useCallback((i: number | null) => setActiveIndex(i), []);

  const choose = (id: HandshakePresetId) => {
    setPresetId(id);
    setFixed(false);
    setActiveIndex(null);
  };

  return (
    <VisualFrame
      label="Sequence, sequencer and driver handshake"
      eyebrow="Synchronized trace"
      title="The sequence ↔ driver handshake"
      summary="Predict where each side blocks, then step through the calls. The sequence, sequencer and driver lanes, both code panels and the log all read the same model step."
      fidelity="model"
      assumptions={HANDSHAKE_ASSUMPTIONS}
    >
      <SegmentedControl
        label="Handshake scenario"
        options={PRESET_ORDER.map((p) => ({ value: p, label: PRESETS[p].label }))}
        value={presetId}
        onChange={choose}
      />
      <p className="text-sm text-muted-foreground">{copy.blurb}</p>

      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))]">
        <CodeTrace label="Sequence (body)" lines={seqLines} activeKey={seqKey} className="min-w-0" />
        <CodeTrace label="Driver (run_phase)" lines={drvLines} activeKey={drvKey} className="min-w-0" />
      </div>

      <PredictionPrompt question={copy.question} options={copy.options} resetKey={presetId}>
        <HandshakeTrace
          steps={run.steps}
          outcome={run.outcome}
          onStep={onStep}
          presetId={presetId}
          fixed={fixed}
          setFixed={setFixed}
          seqLine={seqLines.find((l) => l.key === seqKey)?.text}
          drvLine={drvLines.find((l) => l.key === drvKey)?.text}
        />
      </PredictionPrompt>
    </VisualFrame>
  );
};

export default AnimatedUvmSequenceDriverHandshakeDiagram;
