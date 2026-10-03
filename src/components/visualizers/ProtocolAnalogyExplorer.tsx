"use client";

import React, { useState } from "react";

import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  CHANNEL_MAP,
  HANDSHAKE_ANALOGY,
  WRITE_ORDERS,
  completedChannels,
  stepsFor,
  type AxiChannel,
  type TransactionKind,
  type WriteOrder,
} from "@/lib/protocol-analogy-model";
import { cn } from "@/lib/utils";

export const ANALOGY_ASSUMPTIONS = [
  "A picture, not a simulation. Each step names the real handshake it stands for, from Arm IHI0022E.",
  "Single-beat transactions (AxLEN = 0): the only W beat carries WLAST and the only R beat carries RLAST.",
  "One transaction at a time. Real AXI masters keep many in flight, tagged with IDs.",
];

const LANES: Record<TransactionKind, AxiChannel[]> = { write: ["AW", "W", "B"], read: ["AR", "R"] };

const TABS: { kind: TransactionKind; label: string }[] = [
  { kind: "write", label: "Writing Data (Sending a Package)" },
  { kind: "read", label: "Reading Data (Ordering a Package)" },
];

const WRITE_PREDICTION: PredictionOption[] = [
  {
    id: "must-wait",
    label: "No. The W handshake has to wait until the AW handshake is done.",
    correct: false,
    feedback:
      "This is the misconception the label-then-box story plants. Write data can appear at an interface before its address (IHI0022E §A3.3). A master that holds WVALID low until AWREADY breaks §A3.3.1 and can deadlock against a legal slave that waits for WVALID before raising AWREADY.",
  },
  {
    id: "independent",
    label: "Yes. AW and W are independent channels; W may complete before, with, or after AW.",
    correct: true,
    feedback:
      "Apart from the handshake dependencies, the protocol defines no relationship between the channels, so write data may arrive before its address or in the same cycle (IHI0022E §A3.3). Only the receipt (B) must wait for both.",
  },
  {
    id: "wready-first",
    label: "Only if the slave raises WREADY before the master raises WVALID.",
    correct: false,
    feedback:
      "The master must not wait for WREADY or AWREADY before asserting WVALID (IHI0022E §A3.3.1). The slave may hold WREADY low until it sees AW, but that is the slave's choice and only delays the W handshake.",
  },
  {
    id: "axi3-only",
    label: "Only in AXI3, where WID tells the slave which label the box belongs to.",
    correct: false,
    feedback:
      "W before AW is allowed in AXI4 too. WID existed for write interleaving, which AXI4 removed (IHI0022E §A5.4); it was never what allowed W before AW.",
  },
];

const READ_PREDICTION: PredictionOption[] = [
  {
    id: "prefetch",
    label: "Yes, if the store guesses what you will order and ships early.",
    correct: false,
    feedback:
      "A slave may prefetch internally, but it may assert RVALID for a transaction only after both ARVALID and ARREADY (IHI0022E §A3.3.1). Data cannot be delivered against an order that has not been accepted.",
  },
  {
    id: "after-ar",
    label: "No. RVALID may rise only after the AR handshake has completed.",
    correct: true,
    feedback:
      "Read data must always follow the address it relates to (IHI0022E §A3.3), and the slave must wait for ARVALID and ARREADY before asserting RVALID (§A3.3.1).",
  },
  {
    id: "rready-high",
    label: "Yes, as long as the master is already holding RREADY high.",
    correct: false,
    feedback:
      "RREADY high only says the master can accept data. It does not create a transaction; R still has to follow its AR handshake (IHI0022E §A3.3.1).",
  },
];

function Lane({ channel, state }: { channel: AxiChannel; state: "waiting" | "now" | "done" }) {
  const map = CHANNEL_MAP[channel];
  const toSlave = map.direction === "master → slave";
  return (
    <li
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2 text-sm transition-colors duration-200 motion-reduce:transition-none",
        state === "done" && "border-emerald-500/50 bg-emerald-500/[0.07]",
        state === "now" && "border-cyan-500/70 bg-cyan-500/10",
        state === "waiting" && "border-dashed border-border/80",
      )}
    >
      <span className="w-12 shrink-0 font-mono font-semibold text-foreground [font-variant-ligatures:none]">{channel}</span>
      <span className="flex min-w-0 flex-1 flex-col text-foreground">
        <span className="font-medium">{map.item}</span>
        <span className="text-xs text-muted-foreground">
          <span aria-hidden>{toSlave ? "customer → store" : "store → customer"}</span>
          <span className="sr-only">{map.direction}</span>
        </span>
      </span>
      <span
        className={cn(
          "shrink-0 text-xs font-semibold",
          state === "done" && "text-emerald-700 dark:text-emerald-300",
          state === "now" && "text-cyan-800 dark:text-cyan-200",
          state === "waiting" && "text-muted-foreground",
        )}
      >
        {state === "done" ? "✓ handshake done" : state === "now" ? "▶ handshake this step" : "○ not yet"}
      </span>
    </li>
  );
}

export function ProtocolAnalogyExplorer() {
  const [kind, setKind] = useState<TransactionKind>("write");
  const [order, setOrder] = useState<WriteOrder>("label-first");
  const [step, setStep] = useState(0);

  const steps = stepsFor(kind, order);
  const total = steps.length;
  const current = step > 0 ? steps[step - 1] : null;
  const before = completedChannels(steps, Math.max(0, step - 1));
  const done = completedChannels(steps, step);

  const chooseKind = (next: TransactionKind) => {
    setKind(next);
    setOrder("label-first");
    setStep(0);
  };
  const chooseOrder = (next: WriteOrder) => {
    setOrder(next);
    setStep(0);
  };

  const laneState = (channel: AxiChannel): "waiting" | "now" | "done" => {
    if (!done.includes(channel)) return "waiting";
    return before.includes(channel) ? "done" : "now";
  };

  return (
    <div data-testid="protocol-analogy-explorer">
      <VisualFrame
        label="AXI mail-order analogy"
        eyebrow="Analogy"
        title="The mail-order analogy, mapped to real AXI handshakes"
        summary="Each step shows the everyday picture, the real VALID/READY handshake it stands for, and where the picture stops being true."
        fidelity="illustration"
        assumptions={ANALOGY_ASSUMPTIONS}
      >
        <div role="group" aria-label="Transaction type" className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.kind}
              type="button"
              aria-pressed={kind === tab.kind}
              onClick={() => chooseKind(tab.kind)}
              className={cn(
                "min-h-10 flex-1 basis-56 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                kind === tab.kind ? "border-cyan-500 bg-cyan-500/15 text-foreground" : "border-border/70 text-muted-foreground hover:bg-muted",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {kind === "write" ? (
          <PredictionPrompt
            question="The store has not accepted the shipping label (AW) yet. May the box (W) be handed over first?"
            options={WRITE_PREDICTION}
            resetKey="write"
          >
            <div className="space-y-2">
              <p className="text-sm text-foreground">Try each order. All three are legal AXI; the receipt (B) still comes last.</p>
              <SegmentedControl label="Write order" options={WRITE_ORDERS} value={order} onChange={chooseOrder} />
            </div>
          </PredictionPrompt>
        ) : (
          <PredictionPrompt
            question="Can the store ship the box (R) before it has accepted your order form (AR)?"
            options={READ_PREDICTION}
            resetKey="read"
          />
        )}

        <div className="rounded-xl border border-border/70 bg-background/60 p-3">
          <div className="mb-2 flex flex-wrap justify-between gap-2 text-xs font-semibold text-muted-foreground">
            <span>Master (customer)</span>
            <span>Slave (store)</span>
          </div>
          <ol className="space-y-2" aria-label={kind === "write" ? "Write channels" : "Read channels"}>
            {LANES[kind].map((channel) => (
              <Lane key={channel} channel={channel} state={laneState(channel)} />
            ))}
          </ol>
        </div>

        <div className="space-y-3 rounded-xl border border-border/70 bg-card/60 p-3 sm:p-4" aria-live="polite">
          {current ? (
            <>
              <p className="text-[15px] text-foreground">
                <span className="font-semibold">In the analogy: </span>
                {current.analogy}
              </p>
              <p className="text-sm text-foreground">
                <span className="font-semibold">Real AXI: </span>
                {current.real}
              </p>
              <p className="rounded-lg border border-amber-500/50 bg-amber-500/[0.07] p-3 text-sm text-foreground">
                <span className="font-semibold">
                  <span aria-hidden>⚠ </span>Where the analogy breaks:{" "}
                </span>
                {current.breaksDown}
              </p>
              <p className="font-mono text-[11px] text-muted-foreground [font-variant-ligatures:none]">{current.source}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {kind === "write"
                ? `Order shown: ${WRITE_ORDERS.find((o) => o.value === order)?.label}. Press Next Step to complete the first handshake.`
                : "Press Next Step to complete the first handshake."}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/20 p-3">
          <p className="text-sm font-semibold text-foreground" aria-live="polite">
            Step {step} of {total}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStep(0)}
              className="min-h-10 rounded-lg border border-border/70 px-4 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="min-h-10 rounded-lg border border-border/70 px-4 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(total, s + 1))}
              disabled={step >= total}
              className="min-h-10 rounded-lg bg-foreground px-4 text-sm font-semibold text-background hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next Step
            </button>
          </div>
        </div>

        <aside className="rounded-xl border border-border/70 bg-background/40 p-3 text-sm text-foreground" aria-label="VALID and READY in the analogy">
          <p>
            <span className="font-semibold">VALID and READY: </span>
            {HANDSHAKE_ANALOGY.analogy}
          </p>
          <p className="mt-2">
            <span className="font-semibold">
              <span aria-hidden>⚠ </span>Where it breaks:{" "}
            </span>
            {HANDSHAKE_ANALOGY.breaksDown}
          </p>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground [font-variant-ligatures:none]">{HANDSHAKE_ANALOGY.source}</p>
        </aside>
      </VisualFrame>
    </div>
  );
}
