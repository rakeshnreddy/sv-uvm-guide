"use client";

import React, { useMemo, useState } from "react";

import { CodeTrace } from "@/components/visual-system/CodeTrace";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { EXCLUSIVE_PRESETS, runExclusive, type ExclusiveOp, type ExclusiveStep, type MonitorPolicy } from "@/lib/axi-exclusive-model";
import { cn } from "@/lib/utils";

export const EXCLUSIVE_ASSUMPTIONS = [
  "Transaction level: each access completes before the next one starts.",
  "IDs are as seen at the slave, so M0 and M1 have different IDs.",
  "Monitor behaviour from IHI0022E A7.2.1 to A7.2.3; restrictions from A7.2.4; slaves without support from A7.2.2 and A7.2.5.",
  "A7.2.3 recommends one monitor per exclusive-capable ID. The single shared monitor is an implementation choice shown for comparison.",
  "Any write to a monitored location ends that monitoring, whoever issued it (the A7.2.3 wording).",
];

const POLICY_LABELS: Record<MonitorPolicy, string> = {
  "per-id": "Monitor per ID (recommended)",
  single: "One shared monitor",
  unsupported: "No exclusive support",
};

type Outcome = "exokay" | "okay-failed" | "okay-performed" | "okay-unsupported-read" | "unpredictable";

const OUTCOME_LABEL: Record<Outcome, string> = {
  exokay: "EXOKAY: the write is performed",
  "okay-failed": "OKAY: the exclusive failed, memory is not written",
  "okay-performed": "OKAY: memory is written anyway",
  "okay-unsupported-read": "OKAY: exclusives are not supported here",
  unpredictable: "UNPREDICTABLE: the access breaks a restriction",
};

const OUTCOME_MISCONCEPTION: Record<Outcome, string> = {
  exokay: "EXOKAY needs the location to still be monitored for this ID when the exclusive arrives.",
  "okay-failed": "A failed exclusive needs a monitor that lost track of this ID: a write to the location, or the monitor moving.",
  "okay-performed": "Only a slave without exclusive support writes memory and answers OKAY (A7.2.5).",
  "okay-unsupported-read": "OKAY to an exclusive read means the slave has no exclusive support (A7.2.2).",
  unpredictable: "UNPREDICTABLE applies only when an A7.2.4 restriction is broken.",
};

function outcomeOf(step: ExclusiveStep): Outcome {
  if (step.resp === "UNPREDICTABLE") return "unpredictable";
  if (step.resp === "EXOKAY") return "exokay";
  if (step.op.kind === "ex-read") return "okay-unsupported-read";
  return step.memoryUpdated ? "okay-performed" : "okay-failed";
}

const hex = (n: number) => `0x${n.toString(16).toUpperCase()}`;

function describeOp(op: ExclusiveOp) {
  const what = { "ex-read": "Exclusive read", "ex-write": "Exclusive write", write: "Normal write", read: "Normal read" }[op.kind];
  const lock = op.kind === "ex-read" ? "ARLOCK=1" : op.kind === "ex-write" ? "AWLOCK=1" : op.kind === "write" ? "AWLOCK=0" : "ARLOCK=0";
  const idName = op.kind === "ex-read" || op.kind === "read" ? "ARID" : "AWID";
  const shape = op.beats > 1 || op.bytesPerBeat !== 4 ? `, ${op.beats} x ${op.bytesPerBeat} B` : "";
  const data = op.data !== undefined ? `, data ${op.data}` : "";
  return `${what} ${hex(op.addr)} (${lock}, ${idName}=${op.id}${shape}${data})`;
}

const SVA_LINES = [
  "// [Protocol A7.2.4] shape of an exclusive read (same checks for AW)",
  "a_excl_shape: assert property (@(posedge ACLK) disable iff (!ARESETn)",
  "  ARVALID && ARLOCK |->",
  "    $onehot(((ARLEN + 1) << ARSIZE)) &&            // power of 2 bytes",
  "    (((ARLEN + 1) << ARSIZE) <= 128) &&           // at most 128 bytes",
  "    (ARLEN <= 15) &&                              // AXI4: at most 16 transfers",
  "    ((ARADDR % ((ARLEN + 1) << ARSIZE)) == 0));   // aligned to the total",
  "// [Not a protocol error] an exclusive write without a matching",
  "// exclusive read is legal: it simply fails with OKAY (A7.2.3).",
];

export default function ExclusiveAccessVisualizer() {
  const [presetId, setPresetId] = useState(EXCLUSIVE_PRESETS[0].id);
  const preset = EXCLUSIVE_PRESETS.find((p) => p.id === presetId) ?? EXCLUSIVE_PRESETS[0];
  const [policy, setPolicy] = useState<MonitorPolicy>(preset.policies[0]);
  const activePolicy = preset.policies.includes(policy) ? policy : preset.policies[0];

  const run = useMemo(() => runExclusive(preset.ops, activePolicy, { "0x1000": 0, "0x1004": 0 }), [preset, activePolicy]);
  const asked = run.steps[preset.questionStep];
  const correct = outcomeOf(asked);

  const options: PredictionOption[] = useMemo(() => {
    const ids: Outcome[] =
      asked.op.kind === "ex-read" ? ["exokay", "okay-unsupported-read", "unpredictable"] : ["exokay", "okay-failed", "okay-performed"];
    if (!ids.includes(correct)) ids.push(correct);
    return ids.map((id) => ({
      id,
      label: OUTCOME_LABEL[id],
      correct: id === correct,
      feedback: id === correct ? asked.why : `${OUTCOME_MISCONCEPTION[id]} Here: ${asked.why}`,
    }));
  }, [asked, correct]);

  const choosePreset = (id: string) => {
    setPresetId(id);
    const next = EXCLUSIVE_PRESETS.find((p) => p.id === id);
    if (next && !next.policies.includes(policy)) setPolicy(next.policies[0]);
  };

  return (
    <div data-testid="exclusive-access-visualizer">
      <VisualFrame
        label="AXI exclusive access monitor"
        eyebrow="Predict, then trace the monitor"
        title="Does the exclusive write succeed?"
        summary="Choose a situation and how the slave implements its exclusive monitor. Predict the response, then follow the monitor through every access."
        fidelity="model"
        assumptions={EXCLUSIVE_ASSUMPTIONS}
      >
        <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))]">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-foreground">Situation</p>
            <SegmentedControl label="Exclusive access situation" options={EXCLUSIVE_PRESETS.map((p) => ({ value: p.id, label: p.title }))} value={preset.id} onChange={choosePreset} />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-foreground">Slave&apos;s monitor</p>
            <SegmentedControl
              label="Monitor implementation"
              options={preset.policies.map((p) => ({ value: p, label: POLICY_LABELS[p] }))}
              value={activePolicy}
              onChange={(v) => setPolicy(v as MonitorPolicy)}
            />
          </div>
        </div>
        <p className="text-sm text-foreground">{preset.summary}</p>

        <ol className="space-y-1 text-sm" aria-label="Accesses in order">
          {preset.ops.map((op, i) => (
            <li key={i} className={cn("rounded-lg border px-3 py-1.5", i === preset.questionStep ? "border-amber-500/60 bg-amber-500/[0.06]" : "border-border/60")}>
              <span className="mr-2 font-mono text-xs text-muted-foreground">{i + 1}.</span>
              <span className={cn("mr-2 rounded px-1.5 py-0.5 text-xs font-bold", op.id === 0 ? "bg-sky-500/15 text-sky-800 dark:text-sky-200" : "bg-violet-500/15 text-violet-800 dark:text-violet-200")}>
                {op.master}
              </span>
              <span className="font-mono text-[13px] [font-variant-ligatures:none]">{describeOp(op)}</span>
              {i === preset.questionStep ? <span className="ml-2 text-xs font-semibold text-amber-800 dark:text-amber-200">← predict this</span> : null}
            </li>
          ))}
        </ol>

        <PredictionPrompt question={preset.question} options={options} resetKey={`${preset.id}|${activePolicy}`}>
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full min-w-[300px] text-left text-sm">
                <caption className="sr-only">Response, memory and monitor state after each access</caption>
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-2 py-1.5">#</th>
                    <th scope="col" className="px-2 py-1.5">Response</th>
                    <th scope="col" className="px-2 py-1.5">Memory 0x1000</th>
                    <th scope="col" className="px-2 py-1.5">Monitor after</th>
                    <th scope="col" className="px-2 py-1.5">Why</th>
                  </tr>
                </thead>
                <tbody>
                  {run.steps.map((s, i) => (
                    <tr key={i} className={cn("border-t border-border/50 align-top", i === preset.questionStep && "bg-amber-500/[0.06]")}>
                      <td className="px-2 py-1 font-mono">{i + 1}</td>
                      <td className="px-2 py-1 font-mono font-semibold">
                        <span className={s.resp === "EXOKAY" ? "text-emerald-700 dark:text-emerald-300" : s.resp === "UNPREDICTABLE" ? "text-rose-700 dark:text-rose-300" : "text-foreground"}>
                          {s.resp === "EXOKAY" ? "✓ " : s.resp === "UNPREDICTABLE" ? "✕ " : "○ "}
                          {s.resp}
                        </span>
                      </td>
                      <td className="px-2 py-1 font-mono">
                        {s.memoryAfter["0x1000"] ?? 0}
                        {s.memoryUpdated ? <span className="ml-1 text-xs text-muted-foreground">(written)</span> : null}
                      </td>
                      <td className="px-2 py-1 font-mono text-xs">
                        {activePolicy === "unsupported" ? "no monitor" : s.monitorAfter.length ? s.monitorAfter.map((m) => `ID ${m.id}: ${hex(m.addr)}`).join("; ") : "empty"}
                      </td>
                      <td className="px-2 py-1 text-xs text-foreground/90">{s.why}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {activePolicy === "single" ? (
              <p className="rounded-lg border border-amber-500/40 bg-amber-500/[0.06] px-3 py-2 text-sm text-foreground">
                Implementation choice: a single shared monitor can fail an exclusive write that nobody interfered with. That is why A7.2.3 recommends one monitor per
                ID, and why software must always be ready to retry.
              </p>
            ) : null}
          </div>
        </PredictionPrompt>

        <div className="rounded-xl border border-border/60 p-3 text-sm">
          <p className="mb-1 font-semibold text-foreground">A7.2.4 restrictions (breaking one is UNPREDICTABLE)</p>
          <ul className="list-disc space-y-0.5 pl-5 text-foreground/90">
            <li>Total bytes (size x length) is a power of 2, at most 128; AXI4 allows at most 16 transfers.</li>
            <li>The address is aligned to the total number of bytes.</li>
            <li>The exclusive write matches the exclusive read: same address, ID, size, length and control signals.</li>
            <li>AxCACHE must let the monitoring slave see the access (for example, not Cacheable).</li>
          </ul>
        </div>
        <CodeTrace label="Checker: protocol rule vs legal-but-failing behaviour" lines={SVA_LINES.map((text) => ({ text, owner: "testbench" as const }))} />
      </VisualFrame>
    </div>
  );
}
