/**
 * Deterministic model of the UVM reporting pipeline:
 *   `uvm_info/... → report object (verbosity filter) → report handler
 *   (severity override, action lookup) → report server (report catchers,
 *   UVM_NO_ACTION, counts, DISPLAY/LOG, quit count, EXIT).
 *
 * Every rule below was checked against the uvm-core 2020.3.1 sources
 * (IEEE 1800.2-2020 reference implementation):
 *  - uvm_report_object.svh  uvm_report(): only UVM_INFO is filtered by verbosity (6.3.3.3).
 *  - uvm_report_handler.svh initialize(): default verbosity UVM_MEDIUM; default actions
 *      INFO=DISPLAY, WARNING=DISPLAY, ERROR=DISPLAY|COUNT, FATAL=DISPLAY|EXIT.
 *    get_verbosity_level(): (severity,id) > id > max verbosity (6.4.3.1).
 *    get_action(): (severity,id) > id > severity (6.4.4.1).
 *    process_report_message(): an id-specific severity override wins over a generic one;
 *      the action is looked up with the overridden severity (6.4.7).
 *  - uvm_report_server.svh  process_report_message(): catchers run first; a CAUGHT
 *      message or a UVM_NO_ACTION message is dropped before counting.
 *    execute_report_message(): every executed message increments its severity and id
 *      count (whatever its action); UVM_COUNT only feeds the quit counter, and only when
 *      max_quit_count != 0 (default 0); reaching the max adds UVM_EXIT; UVM_EXIT → die().
 *    m_report_summarize(): summary layout ("--- UVM Report Summary ---", "Quit count", counts).
 *  - uvm_report_catcher.svh process_all_report_catchers(): catchers run in registration
 *      order, disabled ones are skipped, CAUGHT stops the chain; when a catcher changes the
 *      severity without calling set_action() and the action is still the default action
 *      of the old severity, the action becomes the default action of the new severity;
 *      demoted/caught statistics per original severity (6.6).
 *  - $error/$warning are IEEE 1800-2023 §20.10 severity system tasks: the simulator prints
 *    them; they never reach the UVM report server, so UVM does not count them.
 */

export type Severity = "UVM_INFO" | "UVM_WARNING" | "UVM_ERROR" | "UVM_FATAL";
export const SEVERITIES: readonly Severity[] = ["UVM_INFO", "UVM_WARNING", "UVM_ERROR", "UVM_FATAL"];

export type ActionFlag = "UVM_DISPLAY" | "UVM_LOG" | "UVM_COUNT" | "UVM_EXIT";
/** An empty list is UVM_NO_ACTION. */
export type Action = readonly ActionFlag[];

export const VERBOSITY = {
  UVM_NONE: 0,
  UVM_LOW: 100,
  UVM_MEDIUM: 200,
  UVM_HIGH: 300,
  UVM_FULL: 400,
  UVM_DEBUG: 500,
} as const;
export type VerbosityName = keyof typeof VERBOSITY;

/** uvm_report_handler::initialize() defaults. */
export const DEFAULT_SEVERITY_ACTIONS: Record<Severity, Action> = {
  UVM_INFO: ["UVM_DISPLAY"],
  UVM_WARNING: ["UVM_DISPLAY"],
  UVM_ERROR: ["UVM_DISPLAY", "UVM_COUNT"],
  UVM_FATAL: ["UVM_DISPLAY", "UVM_EXIT"],
};
export const DEFAULT_VERBOSITY: VerbosityName = "UVM_MEDIUM";

export interface ReportMessage {
  id: string;
  severity: Severity;
  /** Verbosity of a UVM_INFO (`uvm_info's third argument). Ignored for other severities. */
  verbosity?: VerbosityName;
  text: string;
  /** Full name of the issuing report object, e.g. "uvm_test_top.env.scb". */
  source: string;
  /** Simulation time in ns. */
  time: number;
  /** "sv" = $error/$warning/$info severity system task, not a UVM report. */
  origin?: "uvm" | "sv";
  file?: string;
  line?: number;
}

export type ReportSetting =
  | { kind: "verbosity"; comp: string; level: VerbosityName }
  | { kind: "id_verbosity"; comp: string; id: string; level: VerbosityName }
  | { kind: "severity_action"; comp: string; severity: Severity; action: Action }
  | { kind: "id_action"; comp: string; id: string; action: Action }
  | { kind: "severity_id_action"; comp: string; severity: Severity; id: string; action: Action }
  | { kind: "severity_override"; comp: string; from: Severity; to: Severity }
  | { kind: "severity_id_override"; comp: string; id: string; from: Severity; to: Severity };

export interface CatcherSpec {
  name: string;
  /** Id this catcher acts on: exact, or a glob with * and ?. */
  id: string;
  /** Act only on this severity. */
  severity?: Severity;
  /** Act only when the message text contains this. */
  textContains?: string;
  verdict: "THROW" | "CAUGHT";
  /** set_severity() inside catch(). */
  demoteTo?: Severity;
  /** set_action() inside catch(). */
  setAction?: Action;
  /** callback_mode(); disabled catchers are skipped. */
  enabled?: boolean;
  /** uvm_report_cb::add(obj, catcher): a component glob, or null for every report object. */
  attachTo?: string | null;
}

export interface ReportConfig {
  settings: ReportSetting[];
  catchers: CatcherSpec[];
  /** +UVM_MAX_QUIT_COUNT / set_max_quit_count. 0 (the default) never quits on count. */
  maxQuitCount: number;
}

export const DEFAULT_REPORT_CONFIG: ReportConfig = { settings: [], catchers: [], maxQuitCount: 0 };

export type StageName = "sv-task" | "verbosity" | "override" | "action" | "catcher" | "no-action" | "server" | "after-exit";

export interface StageResult {
  stage: StageName;
  ok: boolean;
  text: string;
}

export type MessageFate = "displayed" | "executed-silently" | "filtered" | "caught" | "no-action" | "sv-task" | "not-reached";

export interface MessageOutcome {
  message: ReportMessage;
  fate: MessageFate;
  originalSeverity: Severity;
  finalSeverity: Severity;
  action: Action;
  /** Counted in "Report counts by severity". */
  counted: boolean;
  /** Incremented the quit counter. */
  quitCounted: boolean;
  demoted: boolean;
  caughtBy?: string;
  /** The composed line the report server would print, when displayed. */
  line?: string;
  exits: boolean;
  stages: StageResult[];
  /** One-sentence explanation of the fate. */
  why: string;
}

export interface ReportRun {
  outcomes: MessageOutcome[];
  severityCounts: Record<Severity, number>;
  idCounts: Record<string, number>;
  quitCount: number;
  caught: Record<Exclude<Severity, "UVM_INFO">, number>;
  demoted: Record<Exclude<Severity, "UVM_INFO">, number>;
  exitedAt?: { index: number; time: number; reason: string };
  /** $error calls: printed by the simulator, invisible to UVM. */
  svErrors: number;
  summaryLines: string[];
  verdict: { passed: boolean; reason: string };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function severityRank(s: Severity): number {
  return SEVERITIES.indexOf(s);
}

/** uvm_is_match-style glob: * matches any string, ? one character. */
export function globMatch(pattern: string, text: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`).test(text);
}

export function formatAction(action: Action): string {
  if (action.length === 0) return "UVM_NO_ACTION";
  return action.join(" | ");
}

function sameAction(a: Action, b: Action): boolean {
  return a.length === b.length && a.every((f) => b.includes(f));
}

interface Handler {
  maxVerbosity: number;
  idVerbosity: Map<string, number>;
  severityActions: Record<Severity, Action>;
  idActions: Map<string, Action>;
  severityIdActions: Map<string, Action>;
  sevOverrides: Map<Severity, Severity>;
  sevIdOverrides: Map<string, Map<Severity, Severity>>;
}

/** The report handler of one component after applying every matching setting in order. */
function handlerFor(source: string, settings: ReportSetting[]): Handler {
  const h: Handler = {
    maxVerbosity: VERBOSITY[DEFAULT_VERBOSITY],
    idVerbosity: new Map(),
    severityActions: { ...DEFAULT_SEVERITY_ACTIONS },
    idActions: new Map(),
    severityIdActions: new Map(),
    sevOverrides: new Map(),
    sevIdOverrides: new Map(),
  };
  for (const s of settings) {
    if (!globMatch(s.comp, source)) continue;
    switch (s.kind) {
      case "verbosity":
        h.maxVerbosity = VERBOSITY[s.level];
        break;
      case "id_verbosity":
        h.idVerbosity.set(s.id, VERBOSITY[s.level]);
        break;
      case "severity_action":
        h.severityActions[s.severity] = s.action;
        break;
      case "id_action":
        h.idActions.set(s.id, s.action);
        break;
      case "severity_id_action":
        h.severityIdActions.set(`${s.severity}|${s.id}`, s.action);
        break;
      case "severity_override":
        h.sevOverrides.set(s.from, s.to);
        break;
      case "severity_id_override": {
        const m = h.sevIdOverrides.get(s.id) ?? new Map<Severity, Severity>();
        m.set(s.from, s.to);
        h.sevIdOverrides.set(s.id, m);
        break;
      }
    }
  }
  return h;
}

/** uvm_report_handler::get_verbosity_level: id setting, else the max verbosity. */
export function verbosityLevelFor(source: string, id: string, settings: ReportSetting[]): number {
  const h = handlerFor(source, settings);
  return h.idVerbosity.get(id) ?? h.maxVerbosity;
}

/** uvm_report_handler::get_action: (severity,id) > id > severity. */
export function actionFor(source: string, severity: Severity, id: string, settings: ReportSetting[]): Action {
  return lookupAction(handlerFor(source, settings), severity, id);
}

function lookupAction(h: Handler, severity: Severity, id: string): Action {
  return h.severityIdActions.get(`${severity}|${id}`) ?? h.idActions.get(id) ?? h.severityActions[severity];
}

export function composeLine(m: ReportMessage, severity: Severity): string {
  const where = m.file ? `${m.file}(${m.line ?? 0}) ` : "";
  return `${severity} ${where}@ ${m.time}: ${m.source} [${m.id}] ${m.text}`;
}

function verbosityName(level: number): string {
  const entry = (Object.entries(VERBOSITY) as [VerbosityName, number][]).find(([, v]) => v === level);
  return entry ? entry[0] : String(level);
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export function runReports(messages: ReportMessage[], config: ReportConfig = DEFAULT_REPORT_CONFIG): ReportRun {
  const severityCounts: Record<Severity, number> = { UVM_INFO: 0, UVM_WARNING: 0, UVM_ERROR: 0, UVM_FATAL: 0 };
  const idCounts: Record<string, number> = {};
  const caught = { UVM_WARNING: 0, UVM_ERROR: 0, UVM_FATAL: 0 };
  const demoted = { UVM_WARNING: 0, UVM_ERROR: 0, UVM_FATAL: 0 };
  let quitCount = 0;
  let svErrors = 0;
  let exitedAt: ReportRun["exitedAt"];
  const outcomes: MessageOutcome[] = [];

  messages.forEach((m, index) => {
    const base = {
      message: m,
      originalSeverity: m.severity,
      finalSeverity: m.severity,
      action: [] as Action,
      counted: false,
      quitCounted: false,
      demoted: false,
      exits: false,
    };

    if (exitedAt) {
      outcomes.push({
        ...base,
        fate: "not-reached",
        stages: [{ stage: "after-exit", ok: false, text: "The simulation already ended (UVM_EXIT → die())." }],
        why: "Never issued: an earlier report took the UVM_EXIT action and uvm_root::die() ended the run.",
      });
      return;
    }

    if (m.origin === "sv") {
      if (m.severity === "UVM_ERROR" || m.severity === "UVM_FATAL") svErrors += 1;
      outcomes.push({
        ...base,
        fate: "sv-task",
        line: `** ${m.severity === "UVM_ERROR" ? "Error" : m.severity === "UVM_WARNING" ? "Warning" : "Info"} (simulator format) @ ${m.time}: ${m.text}`,
        stages: [{ stage: "sv-task", ok: false, text: "$error is a SystemVerilog severity task (IEEE 1800-2023 §20.10); the simulator prints it directly." }],
        why: "A $error never enters the UVM report server, so no catcher sees it and the UVM summary does not count it.",
      });
      return;
    }

    const h = handlerFor(m.source, config.settings);
    const stages: StageResult[] = [];

    // 1. Verbosity filter (uvm_report_object::uvm_report: UVM_INFO only).
    if (m.severity === "UVM_INFO") {
      const level = h.idVerbosity.get(m.id) ?? h.maxVerbosity;
      const msgVerbosity = VERBOSITY[m.verbosity ?? "UVM_MEDIUM"];
      if (level < msgVerbosity) {
        stages.push({
          stage: "verbosity",
          ok: false,
          text: `${m.verbosity ?? "UVM_MEDIUM"} message vs. ${verbosityName(level)} setting: filtered.`,
        });
        outcomes.push({
          ...base,
          fate: "filtered",
          stages,
          why: `The component's verbosity is ${verbosityName(level)}, lower than the message's ${m.verbosity ?? "UVM_MEDIUM"}, so the message is never even created: no catcher sees it and nothing is counted.`,
        });
        return;
      }
      stages.push({ stage: "verbosity", ok: true, text: `${m.verbosity ?? "UVM_MEDIUM"} ≤ ${verbosityName(level)}: passes.` });
    } else {
      stages.push({ stage: "verbosity", ok: true, text: "Warnings, errors and fatals are not filtered by verbosity." });
    }

    // 2. Severity override in the handler (id-specific wins).
    let severity = m.severity;
    const idOverride = h.sevIdOverrides.get(m.id)?.get(severity);
    const generic = h.sevIdOverrides.has(m.id) ? undefined : h.sevOverrides.get(severity);
    const overridden = idOverride ?? generic;
    if (overridden && overridden !== severity) {
      stages.push({ stage: "override", ok: true, text: `Severity override: ${severity} → ${overridden}.` });
      severity = overridden;
    }

    // 3. Action lookup with the (possibly overridden) severity.
    let action = lookupAction(h, severity, m.id);
    stages.push({ stage: "action", ok: action.length > 0, text: `Action for ${severity} [${m.id}]: ${formatAction(action)}.` });

    // 4. Report catchers (server side), in registration order.
    const severityBeforeCatchers = severity;
    let caughtBy: string | undefined;
    for (const c of config.catchers) {
      if (c.enabled === false) continue;
      if (c.attachTo !== undefined && c.attachTo !== null && !globMatch(c.attachTo, m.source)) continue;
      const matches =
        globMatch(c.id, m.id) && (!c.severity || c.severity === severity) && (!c.textContains || m.text.includes(c.textContains));
      if (!matches) {
        stages.push({ stage: "catcher", ok: true, text: `${c.name}: not its message → THROW unchanged.` });
        continue;
      }
      const prevSeverity = severity;
      if (c.demoteTo) severity = c.demoteTo;
      if (c.setAction) {
        action = c.setAction;
      } else if (severity !== prevSeverity && sameAction(action, h.severityActions[prevSeverity])) {
        // Action still at the old severity's default → becomes the new severity's default.
        action = h.severityActions[severity];
      }
      const change = severity !== prevSeverity ? ` set_severity(${severity}) → action ${formatAction(action)};` : "";
      if (c.verdict === "CAUGHT") {
        caughtBy = c.name;
        stages.push({ stage: "catcher", ok: false, text: `${c.name}:${change} returns CAUGHT. The message stops here.` });
        break;
      }
      stages.push({ stage: "catcher", ok: true, text: `${c.name}:${change} returns THROW.` });
    }

    const orig = m.severity;
    const isDemoted = severityRank(severity) < severityRank(orig);
    if (caughtBy) {
      if (orig !== "UVM_INFO") caught[orig] += 1;
    }
    if (isDemoted && orig !== "UVM_INFO") demoted[orig] += 1;

    if (caughtBy) {
      outcomes.push({
        ...base,
        finalSeverity: severity,
        action,
        demoted: isDemoted,
        caughtBy,
        fate: "caught",
        stages,
        why: `${caughtBy} returned CAUGHT, so the server drops the message: not displayed and not in the severity counts (only the catcher summary counts it as caught).`,
      });
      return;
    }

    // 5. UVM_NO_ACTION: dropped before counting.
    if (action.length === 0) {
      stages.push({ stage: "no-action", ok: false, text: "Action is UVM_NO_ACTION: the server drops the message." });
      outcomes.push({
        ...base,
        finalSeverity: severity,
        action,
        demoted: isDemoted,
        fate: "no-action",
        stages,
        why: `With UVM_NO_ACTION the report server discards the message before counting, so this ${orig} disappears from the summary — a silent way to make a failing test pass.`,
      });
      return;
    }

    // 6. Execute: counts always, then DISPLAY/LOG, COUNT→quit, EXIT.
    severityCounts[severity] += 1;
    idCounts[m.id] = (idCounts[m.id] ?? 0) + 1;
    let quitCounted = false;
    let finalAction = action;
    if (action.includes("UVM_COUNT") && config.maxQuitCount !== 0) {
      quitCount += 1;
      quitCounted = true;
      if (quitCount >= config.maxQuitCount && !action.includes("UVM_EXIT")) finalAction = [...action, "UVM_EXIT"];
    }
    const displayed = finalAction.includes("UVM_DISPLAY");
    const exits = finalAction.includes("UVM_EXIT");
    const serverText = [
      `counted as ${severity}`,
      displayed ? "displayed" : finalAction.includes("UVM_LOG") ? "written to the log file only" : "not displayed",
      quitCounted ? `quit count ${quitCount}${config.maxQuitCount ? ` of ${config.maxQuitCount}` : ""}` : "",
      exits ? "UVM_EXIT → die()" : "",
    ]
      .filter(Boolean)
      .join("; ");
    stages.push({ stage: "server", ok: true, text: `Server: ${serverText}.` });

    let why: string;
    if (exits && quitCounted && quitCount >= config.maxQuitCount && !action.includes("UVM_EXIT")) {
      why = `This error is number ${quitCount} toward +UVM_MAX_QUIT_COUNT=${config.maxQuitCount}, so the server adds UVM_EXIT and the run ends here.`;
    } else if (exits) {
      why = `${severity} carries UVM_EXIT, so uvm_root::die() ends the simulation after printing the summary.`;
    } else if (isDemoted) {
      why = `Demoted from ${orig} to ${severity} by a catcher, so it is counted as ${severity}, not as ${orig}.`;
    } else if (severity !== severityBeforeCatchers || severity !== orig) {
      why = `Its severity became ${severity}, so it is counted and displayed as ${severity}.`;
    } else if (!displayed) {
      why = `It is counted as ${severity} even though its action does not display it: the server counts every message it executes.`;
    } else if (severity === "UVM_ERROR" && !action.includes("UVM_COUNT")) {
      why = "Still counted as UVM_ERROR: removing UVM_COUNT only stops it feeding +UVM_MAX_QUIT_COUNT.";
    } else {
      why = `Displayed and counted as ${severity}.`;
    }

    outcomes.push({
      ...base,
      finalSeverity: severity,
      action: finalAction,
      counted: true,
      quitCounted,
      demoted: isDemoted,
      fate: displayed ? "displayed" : "executed-silently",
      line: composeLine(m, severity),
      exits,
      stages,
      why,
    });
    if (exits) {
      exitedAt = {
        index,
        time: m.time,
        reason: quitCounted && !action.includes("UVM_EXIT") ? "quit count reached" : `${severity} action UVM_EXIT`,
      };
    }
  });

  const summaryLines = summarize({
    severityCounts,
    idCounts,
    quitCount,
    maxQuitCount: config.maxQuitCount,
    caught,
    demoted,
    catchersRegistered: config.catchers.length > 0,
  });
  const failures = severityCounts.UVM_ERROR + severityCounts.UVM_FATAL;
  const verdict =
    failures === 0
      ? {
          passed: true,
          reason:
            svErrors > 0
              ? `UVM counts 0 errors, yet ${svErrors} $error call${svErrors > 1 ? "s" : ""} fired. A check that reads only the UVM summary passes a failing run.`
              : "UVM_ERROR + UVM_FATAL = 0.",
        }
      : { passed: false, reason: `UVM_ERROR + UVM_FATAL = ${failures}.` };

  return { outcomes, severityCounts, idCounts, quitCount, caught, demoted, exitedAt, svErrors, summaryLines, verdict };
}

function pad5(n: number): string {
  return String(n).padStart(5, " ");
}

/** Layout of uvm_report_catcher::summarize + uvm_report_server::m_report_summarize. */
export function summarize(args: {
  severityCounts: Record<Severity, number>;
  idCounts: Record<string, number>;
  quitCount: number;
  maxQuitCount: number;
  caught: Record<Exclude<Severity, "UVM_INFO">, number>;
  demoted: Record<Exclude<Severity, "UVM_INFO">, number>;
  catchersRegistered: boolean;
}): string[] {
  const lines: string[] = [];
  if (args.catchersRegistered) {
    lines.push("--- UVM Report catcher Summary ---");
    lines.push(`Number of demoted UVM_FATAL reports  :${pad5(args.demoted.UVM_FATAL)}`);
    lines.push(`Number of demoted UVM_ERROR reports  :${pad5(args.demoted.UVM_ERROR)}`);
    lines.push(`Number of demoted UVM_WARNING reports:${pad5(args.demoted.UVM_WARNING)}`);
    lines.push(`Number of caught UVM_FATAL reports   :${pad5(args.caught.UVM_FATAL)}`);
    lines.push(`Number of caught UVM_ERROR reports   :${pad5(args.caught.UVM_ERROR)}`);
    lines.push(`Number of caught UVM_WARNING reports :${pad5(args.caught.UVM_WARNING)}`);
    lines.push("");
  }
  lines.push("--- UVM Report Summary ---");
  if (args.maxQuitCount !== 0) {
    if (args.quitCount >= args.maxQuitCount) lines.push("Quit count reached!");
    lines.push(`Quit count : ${pad5(args.quitCount)} of ${pad5(args.maxQuitCount)}`);
  }
  lines.push("** Report counts by severity");
  for (const s of SEVERITIES) lines.push(`${s} :${pad5(args.severityCounts[s])}`);
  lines.push("** Report counts by id");
  // String-indexed associative arrays iterate in lexicographic order (IEEE 1800-2023 §7.8.2).
  for (const id of Object.keys(args.idCounts).sort()) lines.push(`[${id}] ${pad5(args.idCounts[id])}`);
  return lines;
}

// ---------------------------------------------------------------------------
// Code generation: the SystemVerilog that produces a configuration
// ---------------------------------------------------------------------------

export function catcherSource(c: CatcherSpec): string[] {
  const className = c.name;
  const conds: string[] = [];
  if (c.id.includes("*") || c.id.includes("?")) {
    if (c.id !== "*") conds.push(`uvm_is_match("${c.id}", get_id())`);
  } else conds.push(`get_id() == "${c.id}"`);
  if (c.severity) conds.push(`get_severity() == ${c.severity}`);
  if (c.textContains) conds.push(`uvm_is_match("*${c.textContains}*", get_message())`);
  const indent = conds.length ? "      " : "    ";
  const body: string[] = [];
  if (c.demoteTo) body.push(`${indent}set_severity(${c.demoteTo});`);
  if (c.setAction) body.push(`${indent}set_action(${formatAction(c.setAction)});`);
  body.push(`${indent}return ${c.verdict};`);
  const decision = conds.length ? [`    if (${conds.join(" && ")}) begin`, ...body, `    end`, `    return THROW;`] : body;
  return [
    `class ${className} extends uvm_report_catcher;`,
    `  \`uvm_object_utils(${className})`,
    `  function new(string name = "${className}");`,
    `    super.new(name);`,
    `  endfunction`,
    `  virtual function action_e catch();`,
    ...decision,
    `  endfunction`,
    `endclass`,
  ];
}

/**
 * The command-line plusarg that applies a setting without recompiling
 * (formats from uvm_cmdline_report.svh / uvm_component.svh m_set_cl_*).
 */
export function settingPlusarg(s: ReportSetting): string {
  const comp = s.comp;
  const act = (a: Action) => (a.length ? a.join("|") : "UVM_NO_ACTION");
  switch (s.kind) {
    case "verbosity":
      return comp === "*" ? `+UVM_VERBOSITY=${s.level}` : `+uvm_set_verbosity=${comp},_ALL_,${s.level},build`;
    case "id_verbosity":
      return `+uvm_set_verbosity=${comp},${s.id},${s.level},build`;
    case "severity_action":
      return `+uvm_set_action=${comp},_ALL_,${s.severity},${act(s.action)}`;
    case "id_action":
      return `+uvm_set_action=${comp},${s.id},_ALL_,${act(s.action)}`;
    case "severity_id_action":
      return `+uvm_set_action=${comp},${s.id},${s.severity},${act(s.action)}`;
    case "severity_override":
      return `+uvm_set_severity=${comp},_ALL_,${s.from},${s.to}`;
    case "severity_id_override":
      return `+uvm_set_severity=${comp},${s.id},${s.from},${s.to}`;
  }
}

/** The equivalent procedural call (uvm_report_object / uvm_component *_hier API). */
export function settingSource(s: ReportSetting): string {
  const target = s.comp === "*" ? "uvm_top" : s.comp.replace(/^uvm_test_top\.?/, "").replace(/\.\*$/, "") || "this";
  const hier = s.comp === "*" || s.comp.endsWith("*") ? "_hier" : "";
  switch (s.kind) {
    case "verbosity":
      return `${target}.set_report_verbosity_level${hier}(${s.level});`;
    case "id_verbosity":
      return `${target}.set_report_id_verbosity${hier}("${s.id}", ${s.level});`;
    case "severity_action":
      return `${target}.set_report_severity_action${hier}(${s.severity}, ${formatAction(s.action)});`;
    case "id_action":
      return `${target}.set_report_id_action${hier}("${s.id}", ${formatAction(s.action)});`;
    case "severity_id_action":
      return `${target}.set_report_severity_id_action${hier}(${s.severity}, "${s.id}", ${formatAction(s.action)});`;
    // No *_hier form exists for severity overrides (uvm_report_object.svh, 6.3.7):
    // call it on each report object, or use +uvm_set_severity.
    case "severity_override":
      return `${target}.set_report_severity_override(${s.from}, ${s.to});`;
    case "severity_id_override":
      return `${target}.set_report_severity_id_override(${s.from}, "${s.id}", ${s.to});`;
  }
}

// ---------------------------------------------------------------------------
// Explorer scenario: an error-injection test (data, shared by the visual and tests)
// ---------------------------------------------------------------------------

const MON = "uvm_test_top.env.agt.mon";
const DRV = "uvm_test_top.env.agt.drv";
const SCB = "uvm_test_top.env.scb";

/**
 * crc_inject_test: the sequence corrupts the CRC of packets 2 and 4 on purpose.
 * The monitor flags them with `uvm_error("CRC", ...)` — expected errors.
 * Packet 5 exposes a real DUT bug, and an interface assertion uses $error.
 */
export const crcInjectMessages: ReportMessage[] = [
  { id: "TEST", severity: "UVM_INFO", verbosity: "UVM_LOW", text: "crc_inject_test: corrupting CRC of pkts 2 and 4", source: "uvm_test_top", time: 0, file: "crc_inject_test.sv", line: 31 },
  { id: "DRV", severity: "UVM_INFO", verbosity: "UVM_HIGH", text: "drove pkt 1 len=16", source: DRV, time: 40, file: "pkt_driver.sv", line: 58 },
  { id: "SCB", severity: "UVM_INFO", verbosity: "UVM_MEDIUM", text: "pkt 1 match", source: SCB, time: 60, file: "pkt_scoreboard.sv", line: 77 },
  { id: "CRC", severity: "UVM_ERROR", text: "bad CRC on pkt 2", source: MON, time: 90, file: "pkt_monitor.sv", line: 102 },
  { id: "a_ready_known", severity: "UVM_ERROR", origin: "sv", text: "tb_top.bus_if.a_ready_known: ready is X", source: "tb_top.bus_if", time: 95 },
  { id: "CFG", severity: "UVM_WARNING", text: "timeout_cycles not set, using 100", source: DRV, time: 120, file: "pkt_driver.sv", line: 41 },
  { id: "CRC", severity: "UVM_ERROR", text: "bad CRC on pkt 4", source: MON, time: 150, file: "pkt_monitor.sv", line: 102 },
  { id: "SCB", severity: "UVM_ERROR", text: "pkt 5 mismatch: exp data 'h3c, act 'h3d", source: SCB, time: 180, file: "pkt_scoreboard.sv", line: 84 },
  { id: "SCB", severity: "UVM_INFO", verbosity: "UVM_MEDIUM", text: "pkt 6 match", source: SCB, time: 200, file: "pkt_scoreboard.sv", line: 77 },
];

/** Index of the message that reveals the real DUT bug. */
export const REAL_BUG_INDEX = 7;

export type CatcherChoice = "none" | "demote-crc" | "catch-all-errors";
export type ErrorActionChoice = "default" | "display-only" | "no-action";

export interface ReportKnobs {
  verbosity: "UVM_LOW" | "UVM_MEDIUM" | "UVM_HIGH";
  catcher: CatcherChoice;
  errorAction: ErrorActionChoice;
  maxQuitCount: 0 | 2;
}

export const DEFAULT_KNOBS: ReportKnobs = { verbosity: "UVM_MEDIUM", catcher: "none", errorAction: "default", maxQuitCount: 0 };

export const CRC_DEMOTER: CatcherSpec = {
  name: "crc_demoter",
  id: "CRC",
  severity: "UVM_ERROR",
  textContains: "bad CRC",
  demoteTo: "UVM_INFO",
  verdict: "THROW",
  attachTo: null,
};

export const ERROR_SWALLOWER: CatcherSpec = {
  name: "error_swallower",
  id: "*",
  severity: "UVM_ERROR",
  verdict: "CAUGHT",
  attachTo: null,
};

export function knobsToConfig(k: ReportKnobs): ReportConfig {
  const settings: ReportSetting[] = [];
  if (k.verbosity !== "UVM_MEDIUM") settings.push({ kind: "verbosity", comp: "*", level: k.verbosity });
  if (k.errorAction === "display-only") settings.push({ kind: "severity_action", comp: "uvm_test_top.env.*", severity: "UVM_ERROR", action: ["UVM_DISPLAY"] });
  if (k.errorAction === "no-action") settings.push({ kind: "severity_action", comp: "uvm_test_top.env.*", severity: "UVM_ERROR", action: [] });
  const catchers = k.catcher === "demote-crc" ? [CRC_DEMOTER] : k.catcher === "catch-all-errors" ? [ERROR_SWALLOWER] : [];
  return { settings, catchers, maxQuitCount: k.maxQuitCount };
}

export interface ReportPreset {
  id: string;
  title: string;
  summary: string;
  knobs: ReportKnobs;
}

export const reportPresets: ReportPreset[] = [
  { id: "defaults", title: "Defaults", summary: "No report configuration at all.", knobs: DEFAULT_KNOBS },
  { id: "demote", title: "Demote the injected CRC errors", summary: "A catcher turns only the expected CRC errors into UVM_INFO.", knobs: { ...DEFAULT_KNOBS, catcher: "demote-crc" } },
  { id: "overbroad", title: "Catch every error", summary: "A catcher returns CAUGHT for every UVM_ERROR.", knobs: { ...DEFAULT_KNOBS, catcher: "catch-all-errors" } },
  { id: "no-action", title: "UVM_NO_ACTION on errors", summary: "+uvm_set_action=uvm_test_top.env.*,_ALL_,UVM_ERROR,UVM_NO_ACTION", knobs: { ...DEFAULT_KNOBS, errorAction: "no-action" } },
  { id: "display-only", title: "Errors: UVM_DISPLAY only", summary: "Remove UVM_COUNT from the error action.", knobs: { ...DEFAULT_KNOBS, errorAction: "display-only", maxQuitCount: 2 } },
  { id: "quit", title: "+UVM_MAX_QUIT_COUNT=2", summary: "Stop the run at the second counted error.", knobs: { ...DEFAULT_KNOBS, maxQuitCount: 2 } },
  { id: "quiet", title: "+UVM_VERBOSITY=UVM_LOW", summary: "A quieter log.", knobs: { ...DEFAULT_KNOBS, verbosity: "UVM_LOW" } },
];

export interface CountPredictionOption {
  value: number;
  correct: boolean;
  feedback: string;
}

/**
 * Prediction options for "how many UVM_ERRORs does the summary count?".
 * Each wrong value comes from a specific misconception.
 */
export function errorCountOptions(knobs: ReportKnobs, messages: ReportMessage[] = crcInjectMessages): CountPredictionOption[] {
  const run = runReports(messages, knobsToConfig(knobs));
  const correct = run.severityCounts.UVM_ERROR;
  const issued = messages.filter((m) => m.origin !== "sv" && m.severity === "UVM_ERROR").length;
  const options = new Map<number, CountPredictionOption>();
  const add = (value: number, feedback: string) => {
    if (value < 0 || options.has(value)) return;
    options.set(value, { value, correct: value === correct, feedback });
  };
  add(correct, explainCount(knobs, run, issued));
  add(correct + run.svErrors, "That counts the $error from the interface assertion. $error is a SystemVerilog severity task; it never reaches the UVM report server.");
  add(issued, `That is the number of \`uvm_error calls issued (${issued}). The configuration changes what the server counts: catchers, UVM_NO_ACTION and an early exit all remove errors from the count.`);
  add(0, "Zero would mean every error vanished. Only a CAUGHT verdict, UVM_NO_ACTION, or an exit before the error removes it from the count.");
  add(issued + run.svErrors + 1, "No setting here adds errors. Count the `uvm_error calls, then remove the ones the configuration drops.");
  return [...options.values()].sort((a, b) => a.value - b.value).slice(0, 4);
}

function explainCount(knobs: ReportKnobs, run: ReportRun, issued: number): string {
  const parts: string[] = [];
  if (knobs.catcher === "demote-crc") parts.push("the two injected CRC errors are demoted to UVM_INFO and counted as UVM_INFO");
  if (knobs.catcher === "catch-all-errors") parts.push("the catcher returns CAUGHT for every error, so none reaches the counters — including the real scoreboard mismatch");
  if (knobs.errorAction === "no-action") parts.push("UVM_NO_ACTION makes the server drop every error before counting");
  if (knobs.errorAction === "display-only") parts.push("removing UVM_COUNT does not stop counting: the server counts every message it executes; UVM_COUNT only feeds the quit counter");
  if (run.exitedAt) parts.push(`the run exits at t = ${run.exitedAt.time} (${run.exitedAt.reason}), so later errors are never issued`);
  if (parts.length === 0) parts.push(`all ${issued} \`uvm_error calls are counted`);
  return `${run.severityCounts.UVM_ERROR} UVM_ERROR: ${parts.join("; ")}. The $error is never counted by UVM.`;
}
