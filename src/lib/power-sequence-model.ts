/**
 * Power-down and wake-up of one switchable domain (PD_CPU) beside an
 * always-on domain (PD_TOP), driven one PMU action per step.
 *
 * Rules follow IEEE 1801 (UPF) power-aware simulation semantics as the
 * curriculum teaches them (IEEE 1801 clause numbers not verified here):
 * - Power switch (create_power_switch): cpu_pwr_en = 0 turns VDD_CPU off.
 * - Corruption (add_power_state ... -simstate CORRUPT): while VDD_CPU is off,
 *   every PD_CPU register reads X. Turning power back on does not restore
 *   anything; registers stay X until restored or re-initialised.
 * - Isolation (set_isolation, cells on the always-on supply): while
 *   cpu_iso_en = 1 the boundary drives the clamp value (0) into PD_TOP.
 * - Retention (set_retention): a cpu_save pulse copies the register into a
 *   retention element on the always-on supply; a cpu_restore pulse copies it
 *   back. Saving while the domain is off saves X.
 *
 * Out of scope: clock gating, reset, supply ramp/settling time, and the
 * PMU's req/ack handshakes. Each step is one PMU action.
 */

export type PmuEvent = "ISO_ON" | "SAVE" | "PWR_OFF" | "PWR_ON" | "RESTORE" | "ISO_OFF";
export type PowerValue = number | "X";
export type Bit = 0 | 1;

export const PMU_EVENTS: readonly PmuEvent[] = ["ISO_ON", "SAVE", "PWR_OFF", "PWR_ON", "RESTORE", "ISO_OFF"];
/** Value of the retained register `ctx`, which drives cpu_out across the boundary. */
export const CTX_VALUE = 0xa5;
/** Value of the non-retained register `scratch`. */
export const SCRATCH_VALUE = 0x3c;
export const CLAMP_VALUE = 0;

export const EVENT_LABELS: Record<PmuEvent, string> = {
  ISO_ON: "Assert isolation",
  SAVE: "Save (retention)",
  PWR_OFF: "Power off",
  PWR_ON: "Power on",
  RESTORE: "Restore (retention)",
  ISO_OFF: "Release isolation",
};

export type CheckId = "p_iso_before_pwr_down" | "p_save_while_powered" | "p_restore_while_powered" | "p_no_x_into_top";

export interface CheckDef {
  id: CheckId;
  sva: string;
  summary: string;
}

/** The power-aware assertions, written against the PMU's control signals (one step = one pmu_clk edge). */
export const CHECKS: Record<CheckId, CheckDef> = {
  p_iso_before_pwr_down: {
    id: "p_iso_before_pwr_down",
    sva: "$fell(cpu_pwr_en) |-> $past(cpu_iso_en)",
    summary: "Isolation is already on when power drops.",
  },
  p_save_while_powered: {
    id: "p_save_while_powered",
    sva: "cpu_save |-> cpu_pwr_en",
    summary: "Save only while the domain is powered.",
  },
  p_restore_while_powered: {
    id: "p_restore_while_powered",
    sva: "cpu_restore |-> cpu_pwr_en",
    summary: "Restore only after power is back.",
  },
  p_no_x_into_top: {
    id: "p_no_x_into_top",
    sva: "!$isunknown(top_cpu_out)",
    summary: "The always-on domain never sees X from PD_CPU.",
  },
};

export const CHECK_IDS = Object.keys(CHECKS) as CheckId[];

export interface PowerSnapshot {
  step: number;
  event: PmuEvent | null;
  pwrEn: Bit;
  isoEn: Bit;
  /** Pulses: 1 only on the SAVE / RESTORE step. */
  save: Bit;
  restore: Bit;
  supplyOn: boolean;
  /** Retained register (drives cpu_out). */
  ctx: PowerValue;
  /** Retention element on the always-on supply; null until the first save. */
  retained: PowerValue | null;
  /** Non-retained register. */
  scratch: PowerValue;
  /** PD_CPU output pin, before the isolation cell. */
  cpuOut: PowerValue;
  /** What PD_TOP receives after the isolation cell. */
  topSees: PowerValue;
  /** Checks that fail at this step. */
  failures: CheckId[];
  what: string;
  why: string;
  /** Keys of the UPF lines that govern this step. */
  upfKeys: string[];
}

export type PowerOutcome = "clean" | "x_leak" | "context_lost" | "both";

export interface PowerRun {
  events: PmuEvent[];
  snapshots: PowerSnapshot[];
  /** First failing step per check. */
  firstFailure: Partial<Record<CheckId, number>>;
  xLeakSteps: number[];
  contextRestored: boolean;
  endIsolated: boolean;
  endPoweredOff: boolean;
  outcome: PowerOutcome;
  /** One-sentence verdict naming the first problem. */
  summary: string;
}

export const hex = (v: PowerValue | null) => (v === null ? "empty" : v === "X" ? "X" : `8'h${v.toString(16).toUpperCase().padStart(2, "0")}`);

function boundary(supplyOn: boolean, isoEn: Bit, ctx: PowerValue): { cpuOut: PowerValue; topSees: PowerValue } {
  const cpuOut: PowerValue = supplyOn ? ctx : "X";
  return { cpuOut, topSees: isoEn ? CLAMP_VALUE : cpuOut };
}

export function runPowerSequence(events: readonly PmuEvent[]): PowerRun {
  const initialOut = boundary(true, 0, CTX_VALUE);
  const snapshots: PowerSnapshot[] = [
    {
      step: 0,
      event: null,
      pwrEn: 1,
      isoEn: 0,
      save: 0,
      restore: 0,
      supplyOn: true,
      ctx: CTX_VALUE,
      retained: null,
      scratch: SCRATCH_VALUE,
      ...initialOut,
      failures: [],
      what: "PD_CPU is running: VDD_CPU is on and isolation is off.",
      why: `PD_TOP sees cpu_out directly: ${hex(CTX_VALUE)}.`,
      upfKeys: ["domain", "nets"],
    },
  ];

  events.forEach((event, i) => {
    const prev = snapshots[snapshots.length - 1];
    const s: PowerSnapshot = { ...prev, step: i + 1, event, save: 0, restore: 0, failures: [], what: "", why: "", upfKeys: [] };
    switch (event) {
      case "ISO_ON":
        s.isoEn = 1;
        s.what = "The PMU raises cpu_iso_en.";
        s.why = "set_isolation clamps every PD_CPU output to 0 while the isolation signal is high. PD_TOP now sees the clamp, not the CPU.";
        s.upfKeys = ["iso"];
        break;
      case "ISO_OFF":
        s.isoEn = 0;
        s.what = "The PMU lowers cpu_iso_en.";
        s.why = !s.supplyOn
          ? "The clamp is gone while VDD_CPU is still off, so the corrupted output reaches PD_TOP."
          : s.ctx === "X"
            ? "The clamp is gone, but ctx has not been restored and is still X, so X reaches PD_TOP."
            : `The clamp is gone and ctx holds ${hex(s.ctx)}, so PD_TOP sees valid data again.`;
        s.upfKeys = ["iso"];
        break;
      case "SAVE":
        s.save = 1;
        s.retained = s.supplyOn ? s.ctx : "X";
        s.what = "The PMU pulses cpu_save.";
        s.why = s.supplyOn
          ? `set_retention's save signal copies ctx (${hex(s.ctx)}) into the retention element, which sits on the always-on supply.`
          : "The domain is already off, so ctx is X. The retention element saves X: the real state is gone.";
        s.upfKeys = ["ret", "ret_save"];
        break;
      case "RESTORE":
        s.restore = 1;
        if (!s.supplyOn) {
          s.why = "VDD_CPU is still off, so there is no powered register to restore into; ctx stays X.";
        } else if (s.retained === null) {
          s.ctx = "X";
          s.why = "Nothing was ever saved, so the retention element holds no valid state; ctx stays X.";
        } else {
          s.ctx = s.retained;
          s.why =
            s.retained === "X"
              ? "The restore signal copies the retention element back, but it holds X (it was saved while off)."
              : `The restore signal copies ${hex(s.retained)} back into ctx. scratch is not retained and stays X until reset or software rewrites it.`;
        }
        s.what = "The PMU pulses cpu_restore.";
        s.upfKeys = ["ret", "ret_restore"];
        break;
      case "PWR_OFF":
        s.pwrEn = 0;
        s.supplyOn = false;
        s.ctx = "X";
        s.scratch = "X";
        s.what = "The PMU drops cpu_pwr_en; the power switch turns VDD_CPU off.";
        s.why = `The OFF power state is CORRUPT: every PD_CPU register reads X. The retention element keeps ${hex(s.retained)}.${s.isoEn ? "" : " Isolation is not on, so X leaves the domain."}`;
        s.upfKeys = ["switch", "state", "state_off"];
        break;
      case "PWR_ON":
        s.pwrEn = 1;
        s.supplyOn = true;
        s.what = "The PMU raises cpu_pwr_en; VDD_CPU returns.";
        s.why = "Power returning restores nothing: ctx and scratch stay X until a restore (or a reset).";
        s.upfKeys = ["switch", "state", "state_on"];
        break;
    }
    Object.assign(s, boundary(s.supplyOn, s.isoEn, s.ctx));

    if (prev.pwrEn === 1 && s.pwrEn === 0 && prev.isoEn === 0) s.failures.push("p_iso_before_pwr_down");
    if (s.save === 1 && s.pwrEn === 0) s.failures.push("p_save_while_powered");
    if (s.restore === 1 && s.pwrEn === 0) s.failures.push("p_restore_while_powered");
    if (s.topSees === "X") s.failures.push("p_no_x_into_top");
    snapshots.push(s);
  });

  const firstFailure: Partial<Record<CheckId, number>> = {};
  for (const snap of snapshots) for (const f of snap.failures) if (firstFailure[f] === undefined) firstFailure[f] = snap.step;
  const xLeakSteps = snapshots.filter((s) => s.topSees === "X").map((s) => s.step);
  const last = snapshots[snapshots.length - 1];
  const contextRestored = last.ctx === CTX_VALUE;
  const xLeak = xLeakSteps.length > 0;
  const outcome: PowerOutcome = xLeak && !contextRestored ? "both" : xLeak ? "x_leak" : !contextRestored ? "context_lost" : "clean";

  const problems: string[] = [];
  if (xLeak) problems.push(`X reaches PD_TOP at step ${xLeakSteps.join(", ")}`);
  if (!contextRestored) problems.push(`ctx ends as ${hex(last.ctx)} instead of ${hex(CTX_VALUE)}`);
  if (last.isoEn) problems.push("isolation is still on, so PD_TOP never sees the CPU again");
  if (!last.supplyOn) problems.push("the domain is still off");
  const summary =
    problems.length === 0
      ? `Clean: PD_TOP only ever sees ${hex(CTX_VALUE)} or the clamp, and ctx comes back as ${hex(CTX_VALUE)}.`
      : `Not clean: ${problems.join("; ")}.`;

  return {
    events: [...events],
    snapshots,
    firstFailure,
    xLeakSteps,
    contextRestored,
    endIsolated: last.isoEn === 1,
    endPoweredOff: !last.supplyOn,
    outcome,
    summary,
  };
}

export type PowerScenarioId = "correct" | "save_then_iso" | "off_before_iso" | "early_release" | "save_after_off";

export const POWER_SCENARIOS: Record<PowerScenarioId, { title: string; events: PmuEvent[] }> = {
  correct: { title: "Isolate, save, off, on, restore, release", events: ["ISO_ON", "SAVE", "PWR_OFF", "PWR_ON", "RESTORE", "ISO_OFF"] },
  save_then_iso: { title: "Save first, then isolate", events: ["SAVE", "ISO_ON", "PWR_OFF", "PWR_ON", "RESTORE", "ISO_OFF"] },
  off_before_iso: { title: "Power off before isolation", events: ["SAVE", "PWR_OFF", "ISO_ON", "PWR_ON", "RESTORE", "ISO_OFF"] },
  early_release: { title: "Release isolation before restore", events: ["ISO_ON", "SAVE", "PWR_OFF", "PWR_ON", "ISO_OFF", "RESTORE"] },
  save_after_off: { title: "Save after power-off", events: ["ISO_ON", "PWR_OFF", "SAVE", "PWR_ON", "RESTORE", "ISO_OFF"] },
};

export interface UpfLine {
  key?: string;
  text: string;
}

/**
 * Illustrative UPF for this model (IEEE 1801-2013 style command forms;
 * supply-set details omitted). Lines carry keys so a view can highlight the
 * command that governs each step.
 */
export function upfLines(): UpfLine[] {
  return [
    { text: "# Illustrative UPF (IEEE 1801 style; supplies abbreviated)" },
    { key: "domain", text: "create_power_domain PD_TOP -include_scope" },
    { key: "domain", text: "create_power_domain PD_CPU -elements {u_cpu}" },
    { key: "nets", text: "create_supply_net VDD     -domain PD_TOP" },
    { key: "nets", text: "create_supply_net VDD_CPU -domain PD_TOP" },
    { key: "switch", text: "create_power_switch sw_cpu -domain PD_CPU \\" },
    { key: "switch", text: "    -input_supply_port  {vin VDD} \\" },
    { key: "switch", text: "    -output_supply_port {vout VDD_CPU} \\" },
    { key: "switch", text: "    -control_port       {ctrl u_pmu/cpu_pwr_en} \\" },
    { key: "switch", text: "    -on_state           {on_s vin {ctrl}}" },
    { key: "iso", text: "set_isolation iso_cpu -domain PD_CPU -applies_to outputs \\" },
    { key: "iso", text: "    -clamp_value 0 \\" },
    { key: "iso", text: "    -isolation_signal u_pmu/cpu_iso_en -isolation_sense high" },
    { key: "ret", text: "set_retention ret_cpu -domain PD_CPU -elements {u_cpu/ctx_reg} \\" },
    { key: "ret_save", text: "    -save_signal    {u_pmu/cpu_save high} \\" },
    { key: "ret_restore", text: "    -restore_signal {u_pmu/cpu_restore high}" },
    { key: "state", text: "add_power_state PD_CPU.primary \\" },
    { key: "state_on", text: "    -state ON  {-supply_expr {power == `{FULL_ON, 0.8}} -simstate NORMAL} \\" },
    { key: "state_off", text: "    -state OFF {-supply_expr {power == `{OFF}} -simstate CORRUPT}" },
  ];
}
