"use client";

import React, { useMemo, useState } from "react";

import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { PlaybackControls } from "@/components/visual-system/PlaybackControls";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { usePlayback } from "@/components/visual-system/usePlayback";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  buildHookTrace,
  CHILD_START_CODE,
  childHookSequence,
  type ChildStartStyle,
  type HookEvent,
  type HookKind,
  type HookTraceConfig,
} from "@/lib/uvm-sequencer-model";
import { cn } from "@/lib/utils";

const ASSUMPTIONS = [
  "Order of calls follows uvm-core 2020.3.1 uvm_sequence_base::start(), start_item() and finish_item(), and the `uvm_do macro (uvm_rand_send).",
  "One sequencer and a driver that always calls item_done(). Time is not shown: this is call order only.",
  "Hooks are empty; randomize() succeeds.",
];

const STYLES: ChildStartStyle[] = ["start_with_parent", "uvm_do", "start_no_parent"];
const STYLE_LABEL: Record<ChildStartStyle, string> = {
  start_with_parent: "start(m_sequencer, this)",
  uvm_do: "`uvm_do(child)",
  start_no_parent: "start(m_sequencer)",
};

const kindGlyph: Record<HookKind, string> = {
  hook: "◇",
  "parent-hook": "◆",
  body: "▶",
  item: "■",
  api: "→",
  sequencer: "SQR",
  driver: "DRV",
  error: "✕",
};

const statusStyle: Record<string, { glyph: string; className: string }> = {
  idle: { glyph: "○", className: "border-border/70 text-muted-foreground" },
  running: { glyph: "▶", className: "border-cyan-500 bg-cyan-500/10 text-foreground" },
  done: { glyph: "✓", className: "border-emerald-500/60 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200" },
  blocked: { glyph: "⊘", className: "border-rose-500 bg-rose-500/10 text-rose-800 dark:text-rose-200" },
};

function hookOptions(child: string, parent: string): { id: string; label: string; style?: ChildStartStyle }[] {
  return [
    { id: "full", label: childHookSequence(child, parent, "start_with_parent").join(" → "), style: "start_with_parent" },
    { id: "no-pre-post-body", label: childHookSequence(child, parent, "uvm_do").join(" → "), style: "uvm_do" },
    { id: "no-parent", label: childHookSequence(child, parent, "start_no_parent").join(" → "), style: "start_no_parent" },
    { id: "body-only", label: `${child}.pre_start() → ${child}.body() → ${child}.post_start()` },
  ];
}

const hookFeedback: Record<string, string> = {
  full: "start(sqr, this) keeps call_pre_post = 1, so pre_body/post_body run, and because a parent is passed, the parent's pre_do(0), mid_do and post_do wrap the child's body.",
  "no-pre-post-body": "`uvm_do ends in start(seqr, this, PRIORITY, 0): call_pre_post = 0 skips pre_body/post_body, but the parent's pre_do/mid_do/post_do still run. It also randomizes the child first.",
  "no-parent": "start(sqr) with no parent makes the child a new root: pre_body/post_body run, but there is no parent to call pre_do/mid_do/post_do on.",
  "body-only": "pre_start and post_start always run, but they are never the only hooks: pre_body/post_body or the parent's hooks (or both) are added by every start style.",
};

function buildPrediction(cfg: HookTraceConfig): { question: string; options: PredictionOption[] } {
  const child = cfg.children[0];
  if (cfg.rootLocks) {
    const deadlocks = child.style === "start_no_parent";
    return {
      question: `${cfg.root} calls lock(), then starts ${child.name} with ${CHILD_START_CODE[child.style](child.name)}. What happens at ${child.name}'s first start_item()?`,
      options: [
        {
          id: "granted",
          label: `It is granted: the lock covers ${cfg.root} and its children`,
          correct: !deadlocks,
          feedback: deadlocks
            ? `Only real children are covered. With no parent argument, is_child(${cfg.root}, ${child.name}) is false, so the lock blocks ${child.name}.`
            : `is_blocked() ignores a lock held by the sequence's own ancestor. ${child.name} was started with ${cfg.root} as its parent, so it is not blocked.`,
        },
        {
          id: "deadlock",
          label: `It waits forever: ${cfg.root}'s lock blocks ${child.name}, and ${cfg.root} waits for ${child.name} to finish`,
          correct: deadlocks,
          feedback: deadlocks
            ? `${child.name} has no parent, so it is just another sequence to the sequencer. ${cfg.root} holds the lock and is itself blocked in ${child.name}.start(): a deadlock.`
            : `That deadlock needs a child started without a parent. Here the parent is passed, so the lock does not block ${child.name}.`,
        },
        {
          id: "error",
          label: "UVM reports an error and grants it anyway",
          correct: false,
          feedback: "Arbitration never reports a blocked request. A blocked request simply waits, which is why lock problems look like silent hangs.",
        },
      ],
    };
  }
  const opts = hookOptions(child.name, cfg.root);
  return {
    question: `${cfg.root}.body() starts ${child.name} with ${CHILD_START_CODE[child.style](child.name)}. Which calls does that produce, in order?`,
    options: opts.map((o) => ({ id: o.id, label: o.label, correct: o.style === child.style, feedback: hookFeedback[o.id] })),
  };
}

function rootSource(cfg: HookTraceConfig): CodeTraceLine[] {
  const lines: CodeTraceLine[] = [
    { text: `class ${cfg.root} extends uvm_sequence #(bus_item);`, owner: "testbench" },
    { text: `  \`uvm_object_utils(${cfg.root})` },
    { text: "  write_seq w;  read_seq r;" },
    { text: "  task body();" },
  ];
  if (cfg.rootLocks) lines.push({ text: "    lock();", key: "lock" });
  cfg.children.forEach((c, i) => {
    const v = i === 0 ? "w" : "r";
    if (c.style !== "uvm_do") lines.push({ text: `    ${v} = ${c.name}::type_id::create("${v}");` });
    lines.push({ text: `    ${CHILD_START_CODE[c.style](v)}`, key: c.name });
  });
  if (cfg.rootLocks) lines.push({ text: "    unlock();", key: "unlock" });
  lines.push({ text: "  endtask" }, { text: "endclass" });
  return lines;
}

function TraceView({ events, deadlock, resetKey }: { events: HookEvent[]; deadlock: boolean; resetKey: string }) {
  const playback = usePlayback(events.length, resetKey);
  const index = Math.min(playback.index, events.length - 1);
  const ev = events[index];
  const names = Object.keys(ev.status);
  return (
    <div className="space-y-3">
      <PlaybackControls playback={playback} stepCount={events.length} stepNoun="Call" describeStep={(i) => events[i]?.call ?? ""} />
      <div className="rounded-xl border border-border/70 bg-background/60 p-3" aria-live="polite">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          call {index + 1} of {events.length}
        </p>
        <p className="mt-1 font-mono text-[15px] font-medium text-foreground [font-variant-ligatures:none]">{ev.call}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          <strong className="text-foreground">Why: </strong>
          {ev.why}
        </p>
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Sequence status">
        {names.map((n) => {
          const st = statusStyle[ev.status[n]];
          return (
            <span key={n} className={cn("rounded-full border px-2.5 py-1 font-mono text-xs [font-variant-ligatures:none]", st.className)}>
              <span aria-hidden>{st.glyph} </span>
              {n}: {ev.status[n]}
            </span>
          );
        })}
      </div>
      <ol className="max-h-80 overflow-auto rounded-xl border border-border/70 bg-slate-950/90 py-2 font-mono text-[12px] leading-6 text-slate-100 [font-variant-ligatures:none]" aria-label="Call log so far">
        {events.slice(0, index + 1).map((e) => (
          <li
            key={e.index}
            aria-current={e.index === index ? "step" : undefined}
            style={{ paddingLeft: `${0.75 + e.depth * 0.9}rem` }}
            className={cn(
              "border-l-2 pr-2",
              e.index === index ? "border-cyan-400 bg-cyan-400/15" : "border-transparent",
              e.kind === "error" && "text-rose-300",
              e.kind === "parent-hook" && "text-amber-200",
              (e.kind === "sequencer" || e.kind === "driver") && "text-slate-400",
            )}
          >
            <span aria-hidden className="mr-1.5 inline-block min-w-[1.5rem] text-[10px] text-slate-400">
              {kindGlyph[e.kind]}
            </span>
            {e.call}
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted-foreground">◇ own hook · ◆ parent hook · ▶ body · ■ item · SQR/DRV sequencer and driver work · ✕ never returns</p>
      {deadlock && index === events.length - 1 ? (
        <p className="rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-800 dark:text-rose-200">
          ✕ Deadlock: nothing reports an error. The test hangs until the phase timeout.
        </p>
      ) : null}
    </div>
  );
}

/**
 * Nested sequence execution: which hooks start() calls for each way of
 * starting a child, and where items enter the handshake.
 */
export function UvmSequenceHierarchyVisualizer() {
  const [writeStyle, setWriteStyle] = useState<ChildStartStyle>("start_with_parent");
  const [readStyle, setReadStyle] = useState<ChildStartStyle>("uvm_do");
  const [itemDetail, setItemDetail] = useState(false);
  const [rootLocks, setRootLocks] = useState(false);

  const cfg: HookTraceConfig = useMemo(
    () => ({
      root: "top_seq",
      children: [
        { name: "write_seq", style: writeStyle, items: 1 },
        { name: "read_seq", style: readStyle, items: 1 },
      ],
      itemDetail,
      rootLocks,
    }),
    [writeStyle, readStyle, itemDetail, rootLocks],
  );
  const trace = useMemo(() => buildHookTrace(cfg), [cfg]);
  const prediction = useMemo(() => buildPrediction(cfg), [cfg]);
  const predictionKey = `${writeStyle}:${rootLocks}`;

  return (
    <VisualFrame
      label="Sequence start hooks explorer"
      eyebrow="Call trace"
      title="What start() calls, and in which order"
      summary="top_seq starts two child sequences. Change how each child is started, predict the hooks, then step through the calls."
      fidelity="model"
      assumptions={ASSUMPTIONS}
    >
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))]">
        <div className="min-w-0 space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Start write_seq with</p>
          <SegmentedControl label="How top_seq starts write_seq" mono options={STYLES.map((s) => ({ value: s, label: STYLE_LABEL[s] }))} value={writeStyle} onChange={setWriteStyle} />
        </div>
        <div className="min-w-0 space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Start read_seq with</p>
          <SegmentedControl label="How top_seq starts read_seq" mono options={STYLES.map((s) => ({ value: s, label: STYLE_LABEL[s] }))} value={readStyle} onChange={setReadStyle} />
        </div>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <label className="flex min-h-10 items-center gap-2">
          <input type="checkbox" className="h-4 w-4 accent-cyan-500" checked={itemDetail} onChange={(e) => setItemDetail(e.target.checked)} />
          Show the calls inside start_item() / finish_item()
        </label>
        <label className="flex min-h-10 items-center gap-2">
          <input type="checkbox" className="h-4 w-4 accent-amber-500" checked={rootLocks} onChange={(e) => setRootLocks(e.target.checked)} />
          Debug: top_seq calls lock() first
        </label>
      </div>

      <CodeTrace label="top_seq.body()" lines={rootSource(cfg)} className="min-w-0" />

      <PredictionPrompt question={prediction.question} options={prediction.options} resetKey={predictionKey}>
        <TraceView events={trace.events} deadlock={trace.deadlock} resetKey={JSON.stringify(cfg)} />
      </PredictionPrompt>
    </VisualFrame>
  );
}

export default UvmSequenceHierarchyVisualizer;
