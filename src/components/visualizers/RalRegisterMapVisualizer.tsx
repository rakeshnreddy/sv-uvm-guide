"use client";

import React, { useId, useMemo, useState } from "react";

import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { HintLadder } from "@/components/visual-system/HintLadder";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  ACCESS_POLICIES,
  EXPLICIT_ENV,
  I2C_BLOCK,
  POLICY_INFO,
  RAL_CHALLENGES,
  applyOp,
  challengeAnswer,
  countErrors,
  effectiveAccess,
  fieldConfigureLine,
  fieldHex,
  fieldIsCompared,
  findReg,
  initialState,
  mirroredChoices,
  opCode,
  parseRegValue,
  regValue,
  runOps,
  showHex,
  svHex,
  withFieldConfig,
  withPolicyLab,
  type AccessPolicy,
  type RalBlockSpec,
  type RalEnv,
  type RalOp,
  type RalState,
  type RalStep,
  type UvmMessage,
} from "@/lib/ral-model";
import { cn } from "@/lib/utils";

export const RAL_MODEL_ASSUMPTIONS = [
  "Rules follow uvm-core 2020.3.1 (src/reg): uvm_reg_field set/XpredictX/XupdateX/do_predict, uvm_reg write/read/update/mirror/peek/poke/predict, uvm_reg_map auto-predict, uvm_reg_predictor::write.",
  "One address map with RW rights, 32-bit registers on a 32-bit bus, no byte enables, no register callbacks, zero-time accesses.",
  "The DUT implements every field's policy exactly; write-only fields read back as 0 on the bus.",
  "The DUT column is shown for teaching. A real testbench sees it only through peek() or a read.",
];

const buttonClass =
  "inline-flex min-h-10 items-center justify-center rounded-lg border border-border/70 bg-background/60 px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none [font-variant-ligatures:none]";

// ---------------------------------------------------------------------------
// Shared views (also used by RALPredictorVisualizer)
// ---------------------------------------------------------------------------

/** Desired / mirrored / DUT per field, MSB first. ✕ marks a stale mirror, ↻ a pending update, ▲ a value this step changed. */
export function RegisterValueTable({
  block,
  regName,
  state,
  previous,
  caption,
}: {
  block: RalBlockSpec;
  regName: string;
  state: RalState;
  previous?: RalState;
  caption: string;
}) {
  const reg = findReg(block, regName);
  const rows = reg.fields.map((f, i) => ({ f, s: state.regs[regName][i], p: previous?.regs[regName]?.[i] })).sort((a, b) => b.f.lsb - a.f.lsb);
  const changed = (now: number, before: number | undefined) => before !== undefined && now !== before;
  const cell = (value: number, size: number, before: number | undefined, extra?: React.ReactNode) => {
    const ch = changed(value, before);
    return (
      <td className={cn("px-2 py-1.5 font-mono tabular-nums", ch && "bg-cyan-500/10")}>
        <span aria-label={`${fieldHex(value, size)}${ch ? ", just changed" : ""}`}>{fieldHex(value, size)}</span>
        {ch ? (
          <span aria-hidden className="ml-1 text-[10px] text-cyan-600 dark:text-cyan-300">
            ▲
          </span>
        ) : null}
        {extra}
      </td>
    );
  };
  const regRow = (key: "desired" | "mirrored" | "dut") => {
    const now = regValue(block, state, regName, key);
    const before = previous ? regValue(block, previous, regName, key) : undefined;
    return (
      <td className={cn("px-2 py-1.5 font-mono font-semibold tabular-nums", changed(now, before) && "bg-cyan-500/10")}>
        {showHex(now, reg.nBits)}
      </td>
    );
  };
  return (
    <div className="overflow-x-auto rounded-xl border border-border/70">
      <table className="w-full min-w-[300px] border-collapse text-left text-xs [font-variant-ligatures:none]">
        <caption className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{caption}</caption>
        <thead className="bg-muted/30 text-[11px] text-muted-foreground">
          <tr>
            <th scope="col" className="px-2 py-1.5 font-semibold">
              Field
            </th>
            <th scope="col" className="px-2 py-1.5 font-semibold">
              Policy
            </th>
            <th scope="col" className="px-2 py-1.5 font-semibold">
              <span className="mr-1 rounded-full border border-amber-500/60 bg-amber-500/10 px-1 text-[9px] font-bold text-amber-900 dark:text-amber-100">TB</span>
              desired · get()
            </th>
            <th scope="col" className="px-2 py-1.5 font-semibold">
              <span className="mr-1 rounded-md border border-cyan-500/60 bg-cyan-500/10 px-1 text-[9px] font-bold text-cyan-800 dark:text-cyan-100">RAL</span>
              mirrored
            </th>
            <th scope="col" className="px-2 py-1.5 font-semibold">
              <span className="mr-1 rounded-sm border border-violet-500/60 bg-violet-500/10 px-1 text-[9px] font-bold text-violet-800 dark:text-violet-100">DUT</span>
              actual
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ f, s, p }) => {
            const access = effectiveAccess(f.access, reg.rights);
            const stale = s.mirrored !== s.dut && access.slice(0, 2) !== "WO";
            const pending = s.desired !== s.mirrored && !["RO", "RC", "RS"].includes(access);
            return (
              <tr key={f.name} className="border-t border-border/60">
                <th scope="row" className="px-2 py-1.5 font-mono font-semibold text-foreground">
                  {f.name}
                  <span className="ml-1 font-normal text-muted-foreground">
                    [{f.lsb + f.size - 1 === f.lsb ? f.lsb : `${f.lsb + f.size - 1}:${f.lsb}`}]
                  </span>
                  {f.volatile ? <span className="ml-1 rounded border border-border px-1 text-[9px] font-normal uppercase text-muted-foreground">vol</span> : null}
                </th>
                <td className="px-2 py-1.5 font-mono">{f.access}</td>
                {cell(s.desired, f.size, p?.desired, pending ? <span className="ml-1 text-amber-700 dark:text-amber-300" aria-label="update pending">↻</span> : null)}
                {cell(s.mirrored, f.size, p?.mirrored, stale ? <span className="ml-1 font-bold text-rose-700 dark:text-rose-300" aria-label="stale: differs from the DUT">✕</span> : null)}
                {cell(s.dut, f.size, p?.dut)}
              </tr>
            );
          })}
          <tr className="border-t-2 border-border">
            <th scope="row" className="px-2 py-1.5 font-mono font-semibold">
              {reg.name}
            </th>
            <td className="px-2 py-1.5 text-muted-foreground">reg</td>
            {regRow("desired")}
            {regRow("mirrored")}
            {regRow("dut")}
          </tr>
        </tbody>
      </table>
      <p className="border-t border-border/60 px-3 py-1.5 text-[11px] text-muted-foreground">
        ✕ mirror differs from the DUT · ↻ desired differs from the mirror (update() would write) · ▲ changed by the last call · vol = configured volatile
      </p>
    </div>
  );
}

const severityClass: Record<UvmMessage["severity"], string> = {
  UVM_INFO: "text-slate-300",
  UVM_WARNING: "text-amber-300",
  UVM_ERROR: "text-rose-300",
  UVM_FATAL: "text-rose-300",
  SIM_FATAL: "text-rose-300",
};

/** Simulator-style log lines (abridged: no file, time or reporter). */
export function UvmLog({ messages, label = "Log" }: { messages: UvmMessage[]; label?: string }) {
  if (messages.length === 0) return null;
  return (
    <figure className="overflow-hidden rounded-lg border border-border/70 bg-slate-950/90">
      <figcaption className="border-b border-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        {label} (abridged: no file, time or reporter)
      </figcaption>
      <pre className="overflow-x-auto whitespace-pre-wrap break-words px-3 py-2 font-mono text-[11.5px] leading-5 [font-variant-ligatures:none]">
        {messages.map((m, i) => (
          <span key={i} className={cn("block", severityClass[m.severity])}>
            {m.severity === "SIM_FATAL" ? "Simulator error" : m.severity}
            {m.verbosity ? `(${m.verbosity})` : ""} [{m.id}] {m.text}
          </span>
        ))}
      </pre>
    </figure>
  );
}

/** One executed call: code, bus traffic, who predicted, the reason, and the log. */
export function StepCard({ step, block }: { step: RalStep; block: RalBlockSpec }) {
  const reg = "reg" in step.op ? findReg(block, step.op.reg) : null;
  return (
    <div className="space-y-2 rounded-xl border border-border/70 bg-background/50 p-3 text-sm">
      <code className="block whitespace-pre-wrap break-words font-mono text-[12.5px] font-semibold text-foreground [font-variant-ligatures:none]">{step.code}</code>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
        <dt className="text-muted-foreground">Bus</dt>
        <dd className="font-mono [font-variant-ligatures:none]">
          {step.bus
            ? `${step.bus.initiator === "RAL" ? "" : `${step.bus.initiator}: `}${step.bus.kind} ${svHex(step.bus.addr)} ${step.bus.kind === "WRITE" ? "←" : "→"} ${svHex(step.bus.data)}`
            : "no bus transfer"}
        </dd>
        <dt className="text-muted-foreground">Predicted by</dt>
        <dd className={cn(step.predictions.length > 1 && "font-semibold text-rose-700 dark:text-rose-300")}>
          {step.predictions.length ? step.predictions.map((p) => `${p.source} (${p.kind})`).join(", then ") : "nothing"}
          {step.predictions.length > 1 ? " ✕ twice" : ""}
        </dd>
        {step.returned ? (
          <>
            <dt className="text-muted-foreground">Returned</dt>
            <dd className="font-mono">
              {step.returned.label} = {showHex(step.returned.value, reg?.nBits ?? 32)}
            </dd>
          </>
        ) : null}
        {step.status ? (
          <>
            <dt className="text-muted-foreground">status</dt>
            <dd className={cn("font-mono", step.status === "UVM_NOT_OK" && "text-rose-700 dark:text-rose-300")}>{step.status}</dd>
          </>
        ) : null}
      </dl>
      <p className="text-foreground/90">
        <strong className="text-foreground">Why: </strong>
        {step.why}
      </p>
      <UvmLog messages={step.messages} />
    </div>
  );
}

export function envSummary(env: RalEnv): string {
  const pred =
    env.predictor === "connected"
      ? "uvm_reg_predictor connected to the monitor"
      : env.predictor === "unconnected"
        ? "uvm_reg_predictor built but bus_in not connected"
        : "no uvm_reg_predictor";
  return `${pred} · auto-predict ${env.autoPredict ? "on" : "off"} · HDL path ${env.hdlPath ? "set" : "missing"}`;
}

export function opLines(ops: RalOp[], block: RalBlockSpec, prefix: string): CodeTraceLine[] {
  return ops.map((op, i) => ({ text: opCode(op, block), key: `${prefix}${i}`, owner: op.kind === "hw" || op.kind === "busWrite" ? "design" : "testbench" }));
}

// ---------------------------------------------------------------------------
// Predict mode
// ---------------------------------------------------------------------------

function ChallengePanel() {
  const [id, setId] = useState(RAL_CHALLENGES[0].id);
  const ch = RAL_CHALLENGES.find((c) => c.id === id) ?? RAL_CHALLENGES[0];
  const graded = useMemo(() => challengeAnswer(I2C_BLOCK, ch), [ch]);
  const focusReg = "reg" in ch.ask ? ch.ask.reg : (ch.ops.find((o) => "reg" in o) as { reg: string } | undefined)?.reg ?? "CTRL";
  const options: PredictionOption[] = ch.options.map((o) => ({ id: o.id, label: <span className="font-mono [font-variant-ligatures:none]">{o.label}</span>, correct: o.answer === graded.answer, feedback: o.feedback }));
  const lines: CodeTraceLine[] = [
    ...(ch.setup.length ? [{ text: "// setup", key: "c-setup" }] : []),
    ...opLines(ch.setup, I2C_BLOCK, "s"),
    { text: "// the call to predict", key: "c-q" },
    ...opLines(ch.ops, I2C_BLOCK, "q"),
  ];
  return (
    <div className="space-y-4">
      <SegmentedControl
        label="Challenge"
        value={id}
        onChange={setId}
        options={RAL_CHALLENGES.map((c, i) => ({ value: c.id, label: `${i + 1}. ${c.title}` }))}
      />
      <p className="text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">Env: </span>
        {envSummary(ch.env)}
      </p>
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]">
        <CodeTrace label="Test code" lines={lines} contextKeys={ch.ops.map((_, i) => `q${i}`)} className="min-w-0" />
        <div className="min-w-0">
          <RegisterValueTable block={I2C_BLOCK} regName={focusReg} state={graded.setup.final} caption="Before the call" />
        </div>
      </div>
      <PredictionPrompt question={ch.question} options={options} resetKey={ch.id}>
        <div className="space-y-3">
          <RegisterValueTable block={I2C_BLOCK} regName={focusReg} state={graded.run.final} previous={graded.setup.final} caption="After the call (model)" />
          <ol className="space-y-2" aria-label="What each call did">
            {graded.run.steps.map((step, i) => (
              <li key={i}>
                <StepCard step={step} block={I2C_BLOCK} />
              </li>
            ))}
          </ol>
        </div>
      </PredictionPrompt>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sandbox mode
// ---------------------------------------------------------------------------

type PredictionMode = "explicit" | "auto" | "none";

function envFor(mode: PredictionMode, hdlPath: boolean): RalEnv {
  return {
    ...EXPLICIT_ENV,
    autoPredict: mode === "auto",
    predictor: mode === "explicit" ? "connected" : "absent",
    hdlPath,
  };
}

const ENV_CODE: Record<PredictionMode, string> = {
  explicit: "agent.mon.ap.connect(predictor.bus_in);  // explicit prediction",
  auto: "ral.default_map.set_auto_predict(1);       // implicit prediction",
  none: "// no predictor, auto-predict left at 0 (the UVM default)",
};

function Sandbox() {
  const ids = useId();
  const [prediction, setPrediction] = useState<PredictionMode>("explicit");
  const [hdlPath, setHdlPath] = useState(true);
  const [labPolicy, setLabPolicy] = useState<AccessPolicy>("W1C");
  const block = useMemo(() => withPolicyLab(I2C_BLOCK, labPolicy), [labPolicy]);
  const env = useMemo(() => envFor(prediction, hdlPath), [prediction, hdlPath]);
  const [state, setState] = useState<RalState>(() => initialState(withPolicyLab(I2C_BLOCK, "W1C")));
  const [steps, setSteps] = useState<RalStep[]>([]);
  const [regName, setRegName] = useState("CTRL");
  const [fieldName, setFieldName] = useState<string | null>(null);
  const [valueText, setValueText] = useState("'hFF");
  const [hwField, setHwField] = useState("");
  const [hwValue, setHwValue] = useState("'h1");
  const [predictFirst, setPredictFirst] = useState(true);
  const [pending, setPending] = useState<RalStep | null>(null);

  const reg = findReg(block, regName);
  const value = parseRegValue(valueText, reg.nBits);
  const selectedField = reg.fields.find((f) => f.name === fieldName) ?? null;
  const hwTarget = reg.fields.find((f) => f.name === hwField) ?? reg.fields[0];
  const hwParsed = parseRegValue(hwValue, hwTarget.size);
  const previous = steps[0]?.before;

  const commit = (step: RalStep) => {
    setState(step.after);
    setSteps((prev) => [step, ...prev].slice(0, 12));
    setPending(null);
  };
  const run = (op: RalOp) => {
    const step = applyOp(block, env, state, op);
    if (predictFirst && mirroredChoices(block, step).length > 1) {
      setPending(step);
      return;
    }
    commit(step);
  };
  const changePolicy = (p: AccessPolicy) => {
    const next = withPolicyLab(I2C_BLOCK, p);
    setLabPolicy(p);
    setState((s) => ({ ...s, regs: { ...s.regs, LAB: initialState(next).regs.LAB } }));
    setPending(null);
  };
  const resetAll = () => {
    setState(initialState(block));
    setSteps([]);
    setPending(null);
  };

  const needsValue: { label: string; make: (v: number) => RalOp }[] = [
    { label: "set(value)", make: (v) => ({ kind: "set", reg: regName, value: v }) },
    { label: "write(status, value)", make: (v) => ({ kind: "write", reg: regName, value: v }) },
    { label: "poke(status, value)", make: (v) => ({ kind: "poke", reg: regName, value: v }) },
    { label: "predict(value)", make: (v) => ({ kind: "predict", reg: regName, value: v }) },
    { label: "firmware writes value", make: (v) => ({ kind: "busWrite", reg: regName, value: v, initiator: "firmware" }) },
  ];
  const noValue: { label: string; op: RalOp }[] = [
    { label: "update(status)", op: { kind: "update", reg: regName } },
    { label: "read(status, rdata)", op: { kind: "read", reg: regName } },
    { label: "mirror(status, UVM_CHECK)", op: { kind: "mirror", reg: regName, check: true } },
    { label: "peek(status, rdata)", op: { kind: "peek", reg: regName } },
  ];

  const pendingChoices = pending ? mirroredChoices(block, pending) : [];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))]">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-foreground">Who updates the mirror?</p>
          <SegmentedControl
            label="Prediction path"
            value={prediction}
            onChange={setPrediction}
            options={[
              { value: "explicit", label: "Explicit predictor" },
              { value: "auto", label: "Auto-predict" },
              { value: "none", label: "None (default)" },
            ]}
          />
          <code className="block font-mono text-[11px] text-muted-foreground [font-variant-ligatures:none]">{ENV_CODE[prediction]}</code>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-foreground">Backdoor</p>
          <SegmentedControl
            label="Backdoor HDL path"
            value={hdlPath ? "yes" : "no"}
            onChange={(v) => setHdlPath(v === "yes")}
            options={[
              { value: "yes", label: "HDL path set" },
              { value: "no", label: "No HDL path" },
            ]}
          />
          <code className="block font-mono text-[11px] text-muted-foreground [font-variant-ligatures:none]">
            {hdlPath ? 'add_hdl_path("tb_top.dut.u_regs");' : "// configure(this, null, \"\") — no backdoor"}
          </code>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-foreground">Register (i2c_reg_block, default_map)</p>
        <SegmentedControl
          label="Register"
          mono
          value={regName}
          onChange={(r) => {
            setRegName(r);
            setFieldName(null);
            setHwField("");
          }}
          options={block.regs.map((r) => ({ value: r.name, label: `${r.name} @${svHex(r.offset)}` }))}
        />
        <p className="text-xs text-muted-foreground">{reg.description}</p>
        {regName === "LAB" ? (
          <label className="flex flex-wrap items-center gap-2 text-xs text-foreground">
            LAB.F access policy
            <select
              className="h-10 rounded-md border border-border/70 bg-background/60 px-2 font-mono text-sm"
              value={labPolicy}
              onChange={(e) => changePolicy(e.target.value as AccessPolicy)}
            >
              {ACCESS_POLICIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <span className="text-muted-foreground">(changing it resets LAB)</span>
          </label>
        ) : null}
        <div role="group" aria-label={`${reg.name} fields, most significant first`} className="flex flex-wrap gap-1.5">
          {[...reg.fields]
            .sort((a, b) => b.lsb - a.lsb)
            .map((f) => (
              <button
                key={f.name}
                type="button"
                aria-pressed={fieldName === f.name}
                onClick={() => setFieldName(fieldName === f.name ? null : f.name)}
                className={cn(
                  "min-h-10 rounded-md border px-2 py-1 text-left font-mono text-[11px] leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none [font-variant-ligatures:none]",
                  fieldName === f.name ? "border-cyan-500 bg-cyan-500/10" : "border-border/70 hover:bg-muted",
                )}
              >
                <span className="block font-semibold text-foreground">
                  {f.name} [{f.size === 1 ? f.lsb : `${f.lsb + f.size - 1}:${f.lsb}`}]
                </span>
                <span className="block text-muted-foreground">
                  {f.access}
                  {f.volatile ? " · volatile" : ""}
                </span>
              </button>
            ))}
        </div>
        {selectedField ? (
          <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-xs" aria-live="polite">
            <p className="font-semibold text-foreground">
              {reg.name}.{selectedField.name}: {selectedField.role}
            </p>
            <p className="mt-1 text-muted-foreground">
              {selectedField.access}: {POLICY_INFO[selectedField.access].write}; {POLICY_INFO[selectedField.access].read}.{" "}
              {selectedField.volatile
                ? "volatile = 1: configure() sets its compare to UVM_NO_CHECK, so mirror(UVM_CHECK) skips it."
                : `volatile = 0: mirror(UVM_CHECK) ${fieldIsCompared(effectiveAccess(selectedField.access, reg.rights), "UVM_CHECK") ? "compares it" : "never compares it (write-only)"}.`}
            </p>
            <code className="mt-1 block whitespace-pre-wrap break-words font-mono text-[11px] text-foreground [font-variant-ligatures:none]">{fieldConfigureLine(selectedField)}</code>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">Select a field to see its policy and its generated configure() call.</p>
        )}
      </div>

      <RegisterValueTable block={block} regName={regName} state={state} previous={previous} caption={`${reg.name} now`} />

      <fieldset className="space-y-3 rounded-xl border border-border/70 p-3" disabled={Boolean(pending)}>
        <legend className="px-1 text-xs font-semibold text-foreground">Call the register model on {reg.name}</legend>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-foreground" htmlFor={`${ids}-value`}>
            value (hex, e.g. &apos;hFF)
            <input
              id={`${ids}-value`}
              value={valueText}
              onChange={(e) => setValueText(e.target.value)}
              aria-invalid={value === null}
              aria-describedby={`${ids}-value-msg`}
              className={cn(
                "h-10 w-40 rounded-md border bg-background/60 px-2 font-mono text-sm [font-variant-ligatures:none]",
                value === null ? "border-rose-500" : "border-border/70",
              )}
            />
          </label>
          <p id={`${ids}-value-msg`} className={cn("text-xs", value === null ? "text-rose-700 dark:text-rose-300" : "text-muted-foreground")}>
            {value === null ? `Enter a hex value that fits in ${reg.nBits} bits.` : `= ${showHex(value, reg.nBits)}`}
          </p>
        </div>
        <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,170px),1fr))]">
          {needsValue.map((b) => (
            <button key={b.label} type="button" className={buttonClass} disabled={value === null} onClick={() => value !== null && run(b.make(value))}>
              {b.label}
            </button>
          ))}
          {noValue.map((b) => (
            <button key={b.label} type="button" className={buttonClass} onClick={() => run(b.op)}>
              {b.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-2 border-t border-border/60 pt-3">
          <label className="flex flex-col gap-1 text-xs text-foreground">
            Hardware changes field
            <select value={hwTarget.name} onChange={(e) => setHwField(e.target.value)} className="h-10 rounded-md border border-border/70 bg-background/60 px-2 font-mono text-sm">
              {reg.fields.map((f) => (
                <option key={f.name} value={f.name}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-foreground">
            to
            <input
              value={hwValue}
              onChange={(e) => setHwValue(e.target.value)}
              aria-invalid={hwParsed === null}
              className={cn("h-10 w-24 rounded-md border bg-background/60 px-2 font-mono text-sm", hwParsed === null ? "border-rose-500" : "border-border/70")}
            />
          </label>
          <button
            type="button"
            className={buttonClass}
            disabled={hwParsed === null}
            onClick={() => hwParsed !== null && run({ kind: "hw", reg: regName, field: hwTarget.name, value: hwParsed })}
          >
            apply hardware event
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-3 text-xs">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={predictFirst} onChange={(e) => setPredictFirst(e.target.checked)} className="h-4 w-4 accent-amber-500" />
            Predict the mirror before each call
          </label>
          <button type="button" className={buttonClass} onClick={() => run({ kind: "reset" })}>
            ral.reset()
          </button>
          <button type="button" className={buttonClass} onClick={resetAll}>
            reset DUT + model, clear log
          </button>
        </div>
      </fieldset>

      {pending ? (
        <PredictionPrompt
          question={
            <>
              After <code className="font-mono [font-variant-ligatures:none]">{pending.code}</code>, what will {block.instance}.{"reg" in pending.op ? pending.op.reg : ""}.get_mirrored_value() return?
            </>
          }
          options={pendingChoices.map((c) => ({ id: c.id, label: <span className="font-mono">{c.label}</span>, correct: c.correct, feedback: c.feedback }))}
          resetKey={`${steps.length}-${pending.code}`}
        >
          <div className="space-y-2">
            <StepCard step={pending} block={block} />
            <div className="flex flex-wrap gap-2">
              <button type="button" className={cn(buttonClass, "border-cyan-500/60 bg-cyan-500/10 font-sans font-semibold")} onClick={() => commit(pending)}>
                Apply to the model and continue
              </button>
              <button type="button" className={cn(buttonClass, "font-sans")} onClick={() => setPending(null)}>
                Cancel this call
              </button>
            </div>
          </div>
        </PredictionPrompt>
      ) : null}

      <div>
        <p className="mb-2 text-xs font-semibold text-foreground">Operation log (newest first)</p>
        {steps.length === 0 ? (
          <p className="text-xs text-muted-foreground">No calls yet. Try write(status, &apos;hFF) on INT_STATUS after a hardware event sets DONE.</p>
        ) : (
          <ol className="space-y-2" aria-live="polite" aria-label="Operation log">
            {steps.map((step, i) => (
              <li key={steps.length - i}>
                <StepCard step={step} block={block} />
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Debug mode: a hardware-driven field configured volatile=0
// ---------------------------------------------------------------------------

const BUGGY_BLOCK = withFieldConfig(I2C_BLOCK, "STATUS", "BUSY", { volatile: false });

const DEBUG_OPS: RalOp[] = [
  { kind: "hw", reg: "STATUS", field: "BUSY", value: 1, note: "transfer starts" },
  { kind: "mirror", reg: "STATUS", check: true },
  { kind: "hw", reg: "STATUS", field: "BUSY", value: 0, note: "transfer ends" },
  { kind: "mirror", reg: "STATUS", check: true },
];

const DEBUG_SUSPECTS: Record<string, { culprit: boolean; feedback: string }> = {
  BUSY: {
    culprit: true,
    feedback:
      "Found it. BUSY is driven by the DUT's own logic, but configure() passes volatile = 0, so the field keeps UVM_CHECK and claims the RAL can predict it. No bus access ever tells the model that BUSY changed.",
  },
  TX_EMPTY: { culprit: false, feedback: "TX_EMPTY is volatile = 1, so configure() gave it UVM_NO_CHECK and mirror(UVM_CHECK) never compares it. The UVM_INFO line names a different field." },
  RX_FULL: { culprit: false, feedback: "RX_FULL is volatile = 1 and never compared. Read the per-field UVM_INFO line under the error." },
  mirror: {
    culprit: false,
    feedback: "The check is doing its job: it compares every field that claims to be predictable. The question is why a hardware-driven field claims that.",
  },
};

const DEBUG_FIXES: { id: string; label: string; block: RalBlockSpec; ops: RalOp[]; review: string; reviewOk: boolean }[] = [
  {
    id: "volatile",
    label: 'BUSY.configure(this, 1, 0, "RO", 1, …)  // volatile = 1',
    block: I2C_BLOCK,
    ops: DEBUG_OPS,
    review: "Accepted. volatile = 1 documents that hardware owns the field, and configure() sets its compare to UVM_NO_CHECK. Fix it in the register spec so the generator emits it.",
    reviewOk: true,
  },
  {
    id: "compare",
    label: "ral.STATUS.BUSY.set_compare(UVM_NO_CHECK);  // in the env",
    block: BUGGY_BLOCK,
    ops: [{ kind: "setCompare", reg: "STATUS", field: "BUSY", check: false }, ...DEBUG_OPS],
    review: "Works for the check, but the model still says BUSY is predictable. Prefer volatile = 1 in the spec; keep set_compare() for temporary waivers.",
    reviewOk: false,
  },
  {
    id: "predict",
    label: "void'(ral.STATUS.predict('h1)); before each mirror()",
    block: BUGGY_BLOCK,
    ops: [DEBUG_OPS[0], { kind: "predict", reg: "STATUS", value: 0x1 }, DEBUG_OPS[1], DEBUG_OPS[2], { kind: "predict", reg: "STATUS", value: 0x1 }, DEBUG_OPS[3]],
    review: "Rejected. It guesses the hardware state. The guess is right while the transfer runs and wrong after it ends.",
    reviewOk: false,
  },
  {
    id: "nocheck",
    label: "ral.STATUS.mirror(status, UVM_NO_CHECK);",
    block: BUGGY_BLOCK,
    ops: DEBUG_OPS.map((op) => (op.kind === "mirror" ? { ...op, check: false } : op)),
    review: "Rejected. It silences the error by turning off the compare for every field of STATUS, so a real bug in this register would pass too.",
    reviewOk: false,
  },
];

function VolatileDebug() {
  const symptom = useMemo(() => runOps(BUGGY_BLOCK, EXPLICIT_ENV, DEBUG_OPS), []);
  const [suspect, setSuspect] = useState<string | null>(null);
  const [fixId, setFixId] = useState<string | null>(null);
  const found = suspect ? DEBUG_SUSPECTS[suspect]?.culprit === true : false;
  const status = findReg(BUGGY_BLOCK, "STATUS");
  const lines: CodeTraceLine[] = [
    { text: "// i2c_status_reg::build() (generated from the register spec)", key: "c1" },
    ...status.fields.map((f) => ({ text: fieldConfigureLine(f), key: f.name, owner: "testbench" as const })),
    { text: "// test: check STATUS while a transfer runs and after it ends", key: "c2" },
    { text: "ral.STATUS.mirror(status, UVM_CHECK);", key: "mirror", owner: "testbench" as const },
  ];
  const fix = DEBUG_FIXES.find((f) => f.id === fixId);
  const fixRun = useMemo(() => (fix ? runOps(fix.block, EXPLICIT_ENV, fix.ops) : null), [fix]);
  const fixErrors = fixRun ? countErrors(fixRun.steps) : 0;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        The regression log shows register errors on STATUS while the I2C controller is busy, and again after it goes idle. The predictor is connected and every
        frontdoor access is predicted. Find the line that makes the mirror disagree with the DUT.
      </p>
      <UvmLog messages={symptom.steps.flatMap((s) => s.messages).filter((m) => m.verbosity !== "UVM_HIGH")} label="Regression log" />
      <div>
        <p className="mb-2 text-sm font-semibold text-foreground">Step 1: select the line responsible</p>
        <CodeTrace
          label="Register model and test"
          lines={lines}
          activeKey={suspect ?? undefined}
          renderLineControl={(line) =>
            line.key && DEBUG_SUSPECTS[line.key] ? (
              <button
                type="button"
                aria-pressed={suspect === line.key}
                aria-label={`Suspect line: ${line.text.trim()}`}
                onClick={() => setSuspect(line.key as string)}
                className={cn(
                  "min-h-8 rounded-md border px-2 py-0.5 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300",
                  suspect === line.key ? "border-amber-400 bg-amber-400/20 text-amber-100" : "border-slate-500 text-slate-300 hover:bg-white/10",
                )}
              >
                {suspect === line.key ? "suspected" : "suspect"}
              </button>
            ) : null
          }
        />
        {suspect ? (
          <p aria-live="polite" className={cn("mt-2 text-sm", found ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300")}>
            <strong>{found ? "✓ " : "✕ Not this one. "}</strong>
            {DEBUG_SUSPECTS[suspect].feedback}
          </p>
        ) : null}
        {!found ? (
          <HintLadder
            className="mt-2"
            hints={[
              "Read the UVM_INFO line under the error: which field mismatches?",
              "Who changes that field: a bus access, or the DUT's own logic?",
              "Look at the fifth configure() argument of each field.",
            ]}
          />
        ) : null}
      </div>
      {found ? (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-foreground">Step 2: choose a fix; the model reruns both checks</legend>
          <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))]">
            {DEBUG_FIXES.map((f) => (
              <label key={f.id} className={cn("flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm", fixId === f.id ? "border-cyan-500 bg-cyan-500/10" : "border-border/70")}>
                <input type="radio" name="ral-volatile-fix" checked={fixId === f.id} onChange={() => setFixId(f.id)} className="mt-1 accent-cyan-500" />
                <span className="min-w-0 break-words font-mono text-[12px] [font-variant-ligatures:none]">{f.label}</span>
              </label>
            ))}
          </div>
          {fix && fixRun ? (
            <div
              aria-live="polite"
              className={cn("mt-3 space-y-2 rounded-xl border p-3 text-sm", fixErrors === 0 && fix.reviewOk ? "border-emerald-500/50 bg-emerald-500/10" : "border-amber-500/50 bg-amber-500/10")}
            >
              <p className="font-medium text-foreground">
                Model: {fixErrors === 0 ? "✓ no UVM_ERROR in either check" : `✕ ${fixErrors} UVM_ERROR${fixErrors > 1 ? "s" : ""}`}
              </p>
              <p className="text-foreground/90">
                <strong>Review: </strong>
                {fix.reviewOk ? "✓ " : "✕ "}
                {fix.review}
              </p>
              <UvmLog messages={fixRun.steps.flatMap((s) => s.messages).filter((m) => m.verbosity !== "UVM_HIGH")} label="Rerun log" />
            </div>
          ) : null}
        </fieldset>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Flagship
// ---------------------------------------------------------------------------

type Mode = "predict" | "sandbox" | "debug";

export function RalRegisterMapVisualizer() {
  const [mode, setMode] = useState<Mode>("predict");
  return (
    <VisualFrame
      label="RAL register model lab"
      eyebrow="Model lab"
      title="Desired, mirrored, DUT: three values per field"
      summary={
        <>
          Every field keeps a <strong>desired</strong> value (what the test wants), a <strong>mirrored</strong> value (what the model believes the DUT holds) and,
          in the DUT, an <strong>actual</strong> value. Predict how each call moves them, then experiment.
        </>
      }
      fidelity="model"
      assumptions={RAL_MODEL_ASSUMPTIONS}
    >
      <SegmentedControl
        label="Mode"
        value={mode}
        onChange={setMode}
        options={[
          { value: "predict", label: "Predict" },
          { value: "sandbox", label: "Sandbox" },
          { value: "debug", label: "Debug a mismatch" },
        ]}
      />
      {mode === "predict" ? <ChallengePanel /> : mode === "sandbox" ? <Sandbox /> : <VolatileDebug />}
    </VisualFrame>
  );
}

export default RalRegisterMapVisualizer;
