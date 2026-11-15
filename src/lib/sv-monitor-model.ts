/**
 * $monitor's watch semantics on the F2D lesson's bench.
 *
 * Pure model, no React. Rules, IEEE 1800-2023:
 * - §21.2.3 Continuous monitoring: each time a variable or expression in the
 *   argument list changes value, except the $time, $stime and $realtime
 *   system functions, the entire list is displayed at the end of the time
 *   step. Two or more arguments changing at the same time give one display
 *   with the new values. Only one $monitor display list is active at any one
 *   time, and a new $monitor call can be issued any number of times.
 *   $monitoroff turns the monitor flag off; $monitoron turns it on so the most
 *   recent $monitor call resumes, and shall produce a display immediately
 *   after it is invoked, whether or not a value changed. The flag is on at the
 *   start of simulation.
 * - §21.3.2: $fmonitor works like $monitor but writes to a file, any number
 *   of $fmonitor tasks can be active at once, and there is no counterpart to
 *   $monitoron and $monitoroff.
 * - §4.4.2.9: $monitor and $strobe events are scheduled in the Postponed
 *   region, the end of the time slot, where no value can change any more.
 *
 * Accuracy caveat: the normative text of §21.2.3 does not say that the
 * $monitor call itself prints a first line. The §20.3.1 example output does
 * show one ("0 set=x" when set never changes at time 0), and the lesson's
 * rows at 0 ns and 40 ns depend on it, so the model prints it and labels it
 * "as shown in the §20.3.1 example". It applies the same to $fmonitor, which
 * §21.3.2 says works just like $monitor.
 *
 * Where the standard is silent the model says so instead of choosing: a
 * $monitor call made while the flag is off gets an "not defined" first line.
 * Statements the learner adds go only into slots where no watched value
 * changes, so no ordering inside a slot is ever assumed.
 */

import { formatNumber } from "@/lib/sv-format-model";

export type Signal = "a" | "b";
export type MonitorArg = "$time" | Signal;
export type ListId = "list1" | "list2";
export type Channel = "stdout" | "file";

export const SIGNAL_WIDTH = 4;
/** $time returns an integer that is a 64-bit time (§20.3.1). */
export const TIME_WIDTH = 64;
export const FILE_NAME = "b.log";

export interface Assignment {
  time: number;
  signal: Signal;
  value: number;
}

/** The lesson's stimulus: `a = 0; b = 0;` then `#10 a = 1; #10 begin a = 2; a = 3; end #10 b = 5; ... #10 begin a = 4; b = 6; end`. */
export const STIMULUS: readonly Assignment[] = [
  { time: 0, signal: "a", value: 0 },
  { time: 0, signal: "b", value: 0 },
  { time: 10, signal: "a", value: 1 },
  { time: 20, signal: "a", value: 2 },
  { time: 20, signal: "a", value: 3 },
  { time: 30, signal: "b", value: 5 },
  { time: 50, signal: "a", value: 4 },
  { time: 50, signal: "b", value: 6 },
];

export const FIRST_CALL_TIME = 0;
export const LESSON_SECOND_CALL_TIME = 40;
export const FINISH_TIME = 60;
/** Slots with no assignment, where the second call may move. */
export const SECOND_CALL_TIMES = [15, 25, 35, 40, 45, 55] as const;
/** Slots with no assignment, where $monitoroff and $monitoron may go. */
export const TOGGLE_TIMES = [5, 15, 25, 35, 45, 55] as const;

export type SecondTask = "$monitor" | "$fmonitor";

export interface MonitorConfig {
  /** null deletes the second call. */
  secondCallTime: number | null;
  secondTask: SecondTask;
  firstListHasB: boolean;
  monitorOffTime: number | null;
  monitorOnTime: number | null;
}

export const DEFAULT_MONITOR_CONFIG: MonitorConfig = {
  secondCallTime: LESSON_SECOND_CALL_TIME,
  secondTask: "$monitor",
  firstListHasB: false,
  monitorOffTime: null,
  monitorOnTime: null,
};

export interface WatchList {
  id: ListId;
  task: "$monitor" | "$fmonitor";
  channel: Channel;
  format: string;
  args: MonitorArg[];
  callTime: number;
}

export function listsFor(config: MonitorConfig): WatchList[] {
  const lists: WatchList[] = [
    {
      id: "list1",
      task: "$monitor",
      channel: "stdout",
      format: config.firstListHasB ? "t=%0d a=%0d b=%0d" : "t=%0d a=%0d",
      args: config.firstListHasB ? ["$time", "a", "b"] : ["$time", "a"],
      callTime: FIRST_CALL_TIME,
    },
  ];
  if (config.secondCallTime !== null) {
    lists.push({
      id: "list2",
      task: config.secondTask,
      channel: config.secondTask === "$fmonitor" ? "file" : "stdout",
      format: "t=%0d b=%0d",
      args: ["$time", "b"],
      callTime: config.secondCallTime,
    });
  }
  return lists;
}

export const watchedSignals = (list: WatchList): Signal[] => list.args.filter((a): a is Signal => a !== "$time");

export const argsText = (list: WatchList): string => list.args.join(", ");

export function callText(list: WatchList): string {
  // $fopen with no type argument returns a multichannel descriptor (§21.3.1).
  const target = list.task === "$fmonitor" ? "mcd, " : "";
  return `${list.task}(${target}"${list.format}", ${argsText(list)});`;
}

/** Each %0d is replaced by the next argument, printed by the format model (§21.2.1.2: %0 is the minimum width). */
export function formatLine(list: WatchList, time: number, values: Record<Signal, number>): string {
  let i = 0;
  return list.format.replace(/%0d/g, () => {
    const arg = list.args[i];
    i += 1;
    return arg === "$time" ? formatNumber(time, TIME_WIDTH, "%0d") : formatNumber(values[arg], SIGNAL_WIDTH, "%0d");
  });
}

// ---------------------------------------------------------------------------
// The run

export type LineTiming = "postponed" | "immediate" | "not-defined";
export type LineCause = "first-line" | "change" | "monitoron";

export interface PrintedLine {
  time: number;
  channel: Channel;
  listId: ListId;
  text: string;
  timing: LineTiming;
  cause: LineCause;
}

export type NoteCode =
  | "first-line"
  | "replaces"
  | "fmonitor-added"
  | "change-printed"
  | "collapsed"
  | "not-watched"
  | "replaced-earlier"
  | "time-not-counted"
  | "flag-off"
  | "monitoroff"
  | "monitoron"
  | "fmonitor-ignores-flag"
  | "call-while-off"
  | "finish";

export interface SlotNote {
  code: NoteCode;
  sentence: string;
}

export interface SlotChange {
  signal: Signal;
  /** Every value written in this slot, in order. */
  values: number[];
  from: number | null;
}

export interface SlotResult {
  time: number;
  statements: string[];
  changes: SlotChange[];
  lines: PrintedLine[];
  notes: SlotNote[];
  values: Record<Signal, number | null>;
  activeMonitor: ListId | null;
  flagOn: boolean;
}

export interface Band {
  listId: ListId;
  task: WatchList["task"];
  channel: Channel;
  from: number;
  to: number;
  label: string;
  /** The watched arguments, e.g. "$time, a". */
  args: string;
}

export interface SourceLine {
  key: string;
  text: string;
}

export interface MonitorRun {
  config: MonitorConfig;
  lists: WatchList[];
  slots: SlotResult[];
  log: PrintedLine[];
  bands: Band[];
  /** Spans in which the $monitor flag is off. */
  offRanges: { from: number; to: number }[];
  source: SourceLine[];
  problems: string[];
}

export function configProblems(config: MonitorConfig): string[] {
  const problems: string[] = [];
  if (config.secondCallTime !== null && !(SECOND_CALL_TIMES as readonly number[]).includes(config.secondCallTime))
    problems.push(`the second call can only go at ${SECOND_CALL_TIMES.join(", ")} ns, slots with no assignment`);
  for (const [name, t] of [
    ["$monitoroff", config.monitorOffTime],
    ["$monitoron", config.monitorOnTime],
  ] as const) {
    if (t !== null && !(TOGGLE_TIMES as readonly number[]).includes(t)) problems.push(`${name} can only go at ${TOGGLE_TIMES.join(", ")} ns`);
  }
  const taken = [config.secondCallTime, config.monitorOffTime, config.monitorOnTime].filter((t): t is number => t !== null);
  if (new Set(taken).size !== taken.length) problems.push("two added statements share a slot; the lab keeps them in separate slots so no order inside a slot is assumed");
  return problems;
}

const ns = (t: number) => `${t} ns`;
const listName = (list: WatchList) => `${list.task}(${argsText(list)})`;

interface Statement {
  time: number;
  key: string;
  text: string;
}

function statementsFor(config: MonitorConfig, lists: WatchList[]): Statement[] {
  const out: Statement[] = [];
  STIMULUS.forEach((s, i) => out.push({ time: s.time, key: `assign-${i}`, text: `${s.signal} = ${s.value};` }));
  if (config.secondTask === "$fmonitor" && config.secondCallTime !== null) out.push({ time: 0, key: "fopen", text: `mcd = $fopen("${FILE_NAME}");` });
  lists.forEach((l) => out.push({ time: l.callTime, key: l.id === "list1" ? "first-call" : "second-call", text: callText(l) }));
  if (config.monitorOffTime !== null) out.push({ time: config.monitorOffTime, key: "monitoroff", text: "$monitoroff;" });
  if (config.monitorOnTime !== null) out.push({ time: config.monitorOnTime, key: "monitoron", text: "$monitoron;" });
  out.push({ time: FINISH_TIME, key: "finish", text: "$finish;" });
  // Stable by time; within time 0 the assignments come first, as in the lesson.
  return out.map((s, i) => ({ s, i })).sort((p, q) => p.s.time - q.s.time || p.i - q.i).map((p) => p.s);
}

/** The bench as SystemVerilog, generated from the same statements the run executes. */
export function monitorSource(config: MonitorConfig): SourceLine[] {
  const lists = listsFor(config);
  const statements = statementsFor(config, lists);
  const lines: SourceLine[] = [
    { key: "timescale", text: "`timescale 1ns/1ns" },
    { key: "module", text: "module tb_top;" },
    { key: "decl", text: "  logic [3:0] a, b;" },
  ];
  if (statements.some((s) => s.key === "fopen")) lines.push({ key: "decl-mcd", text: "  integer mcd;" });
  lines.push({ key: "initial", text: "  initial begin" });
  const times = Array.from(new Set(statements.map((s) => s.time)));
  let prev = 0;
  times.forEach((t) => {
    const group = statements.filter((s) => s.time === t);
    if (t === 0) {
      group.forEach((s) => lines.push({ key: s.key, text: `    ${s.text}` }));
    } else {
      const delay = `#${t - prev}`;
      if (group.length === 1) lines.push({ key: group[0].key, text: `    ${delay} ${group[0].text}` });
      else {
        const comment = group.length === 2 && group.every((s) => s.key.startsWith("assign")) && group[0].text[0] === group[1].text[0] ? "   // two changes in one time slot" : "";
        lines.push({ key: group.map((s) => s.key).join("+"), text: `    ${delay} begin ${group.map((s) => s.text).join(" ")} end${comment}` });
      }
    }
    prev = t;
  });
  lines.push({ key: "end", text: "  end" }, { key: "endmodule", text: "endmodule" });
  return lines;
}

/**
 * §21.3.2 only says $fmonitor has no counterpart to $monitoron and
 * $monitoroff; it does not say what $monitoroff does to an $fmonitor list.
 * The lab's reading, shown as such and listed in the component's assumptions.
 */
export const FMONITOR_FLAG_READING =
  "§21.3.2 gives $fmonitor no on/off control of its own, so the lab reads $monitoroff as affecting only $monitor, and the file list keeps printing.";

export function runMonitor(config: MonitorConfig = DEFAULT_MONITOR_CONFIG): MonitorRun {
  const problems = configProblems(config);
  const lists = listsFor(config);
  const statements = statementsFor(config, lists);
  const times = Array.from(new Set(statements.map((s) => s.time))).sort((p, q) => p - q);
  const values: Record<Signal, number | null> = { a: null, b: null };
  let flagOn = true; // §21.2.3: on at the beginning of simulation
  let active: WatchList | null = null;
  const fmonitors: WatchList[] = [];
  const slots: SlotResult[] = [];
  const offRanges: { from: number; to: number }[] = [];
  let offSince: number | null = null;
  let replacedAt: { list: WatchList; time: number } | null = null;

  for (const time of times) {
    const group = statements.filter((s) => s.time === time);
    const changes: SlotChange[] = [];
    const notes: SlotNote[] = [];
    const lines: PrintedLine[] = [];
    let newMonitor: WatchList | null = null;
    const newFmonitors: WatchList[] = [];
    let flagTurnedOffHere = false;

    for (const s of group) {
      if (s.key.startsWith("assign")) {
        const a = STIMULUS[Number(s.key.slice("assign-".length))];
        let c = changes.find((x) => x.signal === a.signal);
        if (!c) {
          c = { signal: a.signal, values: [], from: values[a.signal] };
          changes.push(c);
        }
        c.values.push(a.value);
        values[a.signal] = a.value;
      } else if (s.key === "first-call" || s.key === "second-call") {
        const list = lists.find((l) => (s.key === "first-call" ? l.id === "list1" : l.id === "list2")) as WatchList;
        if (list.task === "$monitor") {
          if (active) {
            replacedAt = { list: active, time };
            notes.push({
              code: "replaces",
              sentence: `This call replaces the active list ${listName(active)}: only one $monitor list is active at any one time (§21.2.3), and nothing in that clause asks for a warning when it happens.`,
            });
          }
          active = list;
          newMonitor = list;
        } else {
          fmonitors.push(list);
          newFmonitors.push(list);
          notes.push({
            code: "fmonitor-added",
            sentence: `$fmonitor sets up a second list, writing to ${FILE_NAME}, beside the $monitor list: any number of $fmonitor lists can be active at once (§21.3.2).`,
          });
        }
      } else if (s.key === "monitoroff") {
        flagOn = false;
        flagTurnedOffHere = true;
        offSince = time;
        notes.push({ code: "monitoroff", sentence: "$monitoroff turns the monitor flag off, so the $monitor list prints nothing until $monitoron (§21.2.3)." });
      } else if (s.key === "monitoron") {
        const wasOn = flagOn;
        flagOn = true;
        if (offSince !== null) {
          offRanges.push({ from: offSince, to: time });
          offSince = null;
        }
        if (active) {
          lines.push({ time, channel: active.channel, listId: active.id, text: formatLine(active, time, values as Record<Signal, number>), timing: "immediate", cause: "monitoron" });
          notes.push({
            code: "monitoron",
            sentence: wasOn
              ? "The flag is already on; $monitoron still prints the most recent $monitor list immediately, whether or not a value changed (§21.2.3)."
              : "$monitoron turns the flag on and prints the most recent $monitor list immediately, whether or not a value changed (§21.2.3).",
          });
        }
      }
    }

    const changed = new Set(changes.map((c) => c.signal));
    const watchedChange = (list: WatchList) => watchedSignals(list).filter((s) => changed.has(s));
    const known = values as Record<Signal, number>;

    // The $monitor list, at the end of the slot (Postponed, §4.4.2.9).
    if (active) {
      const hit = watchedChange(active);
      if (newMonitor === active) {
        if (flagOn) {
          lines.push({ time, channel: active.channel, listId: active.id, text: formatLine(active, time, known), timing: "postponed", cause: "first-line" });
          notes.push({
            code: "first-line",
            sentence: `The new list prints a first line at the end of this slot, as shown in the §20.3.1 example; §21.2.3 itself does not state it. The lab places that line in the Postponed region, where §4.4.2.9 schedules $monitor events.`,
          });
        } else {
          lines.push({ time, channel: active.channel, listId: active.id, text: formatLine(active, time, known), timing: "not-defined", cause: "first-line" });
          notes.push({
            code: "call-while-off",
            sentence: "The flag is off when this call sets up its list. The standard does not say whether such a call prints a first line, so the lab marks the line as not defined; $monitoron would print the list.",
          });
        }
      } else if (hit.length > 0 && !lines.some((l) => l.listId === active?.id)) {
        if (flagOn) {
          lines.push({ time, channel: active.channel, listId: active.id, text: formatLine(active, time, known), timing: "postponed", cause: "change" });
          const multi = changes.find((c) => hit.includes(c.signal) && c.values.length > 1);
          notes.push({
            code: multi ? "collapsed" : "change-printed",
            sentence: multi
              ? `${multi.signal} changed ${multi.values.length} times in this slot (${multi.values.join(", then ")}), but one line prints, with the new value: the list is displayed once, at the end of the time step (§21.2.3).`
              : `${hit.join(" and ")} changed and ${hit.length > 1 ? "are" : "is"} in the list, so one line prints at the end of the slot, in the Postponed region (§21.2.3, §4.4.2.9).`,
          });
        } else {
          notes.push({ code: "flag-off", sentence: `${hit.join(" and ")} changed, but the monitor flag is off (since $monitoroff at ${ns(offSince ?? time)}), so the $monitor list stays silent (§21.2.3).` });
        }
      }
      const unwatched = changes.map((c) => c.signal).filter((s) => !watchedSignals(active as WatchList).includes(s));
      if (unwatched.length && newMonitor !== active && time !== 0) {
        const old = replacedAt && watchedSignals(replacedAt.list).some((s) => unwatched.includes(s)) ? replacedAt : null;
        notes.push(
          old
            ? {
                code: "replaced-earlier",
                sentence: `${unwatched.join(" and ")} changed, but the list that watched ${unwatched.join(" and ")} was replaced at ${ns(old.time)}; the active list is ${listName(active)} (§21.2.3).`,
              }
            : { code: "not-watched", sentence: `${unwatched.join(" and ")} changed, but the active list ${listName(active)} does not watch ${unwatched.length > 1 ? "them" : "it"}.` },
        );
      }
    }

    // $fmonitor lists: no flag (§21.3.2).
    for (const f of fmonitors) {
      const isNew = newFmonitors.includes(f);
      const hit = watchedChange(f);
      if (isNew || hit.length > 0) {
        lines.push({ time, channel: f.channel, listId: f.id, text: formatLine(f, time, known), timing: "postponed", cause: isNew ? "first-line" : "change" });
        if (isNew)
          notes.push({ code: "first-line", sentence: `The $fmonitor list prints a first line to ${FILE_NAME} at the end of this slot, as $monitor does in the §20.3.1 example (§21.3.2: it works just like $monitor).` });
        else notes.push({ code: "change-printed", sentence: `${hit.join(" and ")} changed, so the $fmonitor list writes one line to ${FILE_NAME} at the end of the slot (§21.3.2, §21.2.3).` });
        if (!flagOn && !isNew) notes.push({ code: "fmonitor-ignores-flag", sentence: FMONITOR_FLAG_READING });
      }
    }

    if (lines.length === 0) {
      if (time === FINISH_TIME) notes.push({ code: "finish", sentence: "$finish ends the run; no watched value changed in this slot, so nothing prints." });
      else {
        const explained = notes.some((n) => n.code === "not-watched" || n.code === "replaced-earlier" || n.code === "flag-off") || flagTurnedOffHere;
        notes.push({
          code: "time-not-counted",
          sentence: `$time moved to ${time}, but changes of $time, $stime and $realtime do not count (§21.2.3)${explained ? "" : ", and no watched value changed"}.`,
        });
      }
    }

    slots.push({ time, statements: group.map((s) => s.text), changes, lines, notes, values: { ...values }, activeMonitor: active ? active.id : null, flagOn });
  }
  if (offSince !== null) offRanges.push({ from: offSince, to: FINISH_TIME });

  const bands: Band[] = [];
  const monitorCalls = lists.filter((l) => l.task === "$monitor").sort((p, q) => p.callTime - q.callTime);
  monitorCalls.forEach((l, i) => {
    const next = monitorCalls[i + 1];
    bands.push({ listId: l.id, task: l.task, channel: l.channel, from: l.callTime, to: next ? next.callTime : FINISH_TIME, label: `${l.task}: ${argsText(l)}`, args: argsText(l) });
  });
  lists
    .filter((l) => l.task === "$fmonitor")
    .forEach((l) => bands.push({ listId: l.id, task: l.task, channel: l.channel, from: l.callTime, to: FINISH_TIME, label: `$fmonitor to ${FILE_NAME}: ${argsText(l)}`, args: argsText(l) }));

  return { config, lists, slots, log: slots.flatMap((s) => s.lines), bands, offRanges, source: monitorSource(config), problems };
}

// ---------------------------------------------------------------------------
// Predictions per slot

export const NOT_DEFINED_ID = "not-defined";
export const SILENT_ID = "silent";

export interface SlotOption {
  id: string;
  /** The lines this option claims, channel-prefixed for the file. Empty means silent. */
  lines: string[];
  label: string;
  correct: boolean;
}

export const lineLabel = (line: { channel: Channel; text: string }) => (line.channel === "file" ? `${FILE_NAME}: ${line.text}` : line.text);

const optionId = (lines: string[]) => (lines.length ? lines.join(" | ") : SILENT_ID);

/** The answer for a slot as an option id. */
export function slotAnswerId(slot: SlotResult): string {
  if (slot.lines.some((l) => l.timing === "not-defined")) return NOT_DEFINED_ID;
  return optionId(slot.lines.map(lineLabel));
}

/**
 * Options for one slot: the answer, silence, and the lines a learner with a
 * common misconception would expect, all computed from the run (for a slot
 * with two writes to one signal, the line with the first value and both lines;
 * then every list's line at this time). At most four, in a fixed order. Lines
 * on one channel are joined with ", then"; lines on different channels with
 * "and", because no order between stdout and the file is defined.
 */
export function slotOptions(run: MonitorRun, time: number): SlotOption[] {
  const slot = run.slots.find((s) => s.time === time);
  if (!slot) return [];
  const answer = slotAnswerId(slot);
  const known = slot.values as Record<Signal, number>;
  const candidates: string[][] = [];
  // The two-write misconceptions come first, so the four-option cut never drops them.
  const multi = slot.changes.find((c) => c.values.length > 1);
  if (multi) {
    const first = { ...known, [multi.signal]: multi.values[0] };
    run.lists
      .filter((l) => watchedSignals(l).includes(multi.signal))
      .forEach((l) => {
        const early = lineLabel({ channel: l.channel, text: formatLine(l, time, first) });
        const late = lineLabel({ channel: l.channel, text: formatLine(l, time, known) });
        candidates.push([early], [early, late]);
      });
  }
  run.lists.forEach((l) => candidates.push([lineLabel({ channel: l.channel, text: formatLine(l, time, known) })]));
  const ids = new Map<string, string[]>();
  const add = (lines: string[]) => {
    const id = optionId(lines);
    if (!ids.has(id)) ids.set(id, lines);
  };
  if (answer === NOT_DEFINED_ID) ids.set(NOT_DEFINED_ID, []);
  else add(slot.lines.map(lineLabel));
  add([]);
  candidates.forEach(add);
  const chosen = Array.from(ids.entries()).slice(0, 4);
  const isFile = (line: string) => line.startsWith(`${FILE_NAME}: `);
  const joinLines = (lines: string[]) => lines.reduce((acc, line, i) => (i === 0 ? line : `${acc}${isFile(line) === isFile(lines[i - 1]) ? ", then " : " and "}${line}`), "");
  const label = (id: string, lines: string[]) => (id === NOT_DEFINED_ID ? "The standard does not say" : lines.length === 0 ? "Silent" : joinLines(lines));
  const order = (id: string) => (id === SILENT_ID ? "0" : id === NOT_DEFINED_ID ? "1" : `2${id}`);
  return chosen
    .map(([id, lines]) => ({ id, lines, label: label(id, lines), correct: id === answer }))
    .sort((p, q) => (order(p.id) < order(q.id) ? -1 : order(p.id) > order(q.id) ? 1 : 0));
}

export interface SlotGrade {
  time: number;
  correct: boolean;
  answerLabel: string;
  sentence: string;
}

export function gradeSlot(run: MonitorRun, time: number, optionId: string | null): SlotGrade {
  const slot = run.slots.find((s) => s.time === time) as SlotResult;
  const options = slotOptions(run, time);
  const answer = options.find((o) => o.correct) as SlotOption;
  return {
    time,
    correct: optionId === answer.id,
    answerLabel: answer.label,
    sentence: slot.notes.map((n) => n.sentence).join(" "),
  };
}

// ---------------------------------------------------------------------------
// Coverage: which value changes reach a log

export interface MissedChange {
  time: number;
  signal: Signal;
  value: number;
}

/** Each slot after time 0 where a signal changed but no line at that time comes from a list watching it. */
export function missedChanges(run: MonitorRun): MissedChange[] {
  const missed: MissedChange[] = [];
  run.slots
    .filter((s) => s.time > 0)
    .forEach((s) =>
      s.changes.forEach((c) => {
        const seen = s.lines.some((l) => l.timing !== "not-defined" && watchedSignals(run.lists.find((x) => x.id === l.listId) as WatchList).includes(c.signal));
        if (!seen) missed.push({ time: s.time, signal: c.signal, value: c.values[c.values.length - 1] });
      }),
    );
  return missed;
}

// ---------------------------------------------------------------------------
// Debug case 1: the signal that went quiet

export type SuspectVerdict = "culprit" | "decoy";

export interface DebugSuspect {
  /** A key of `monitorSource(DEFAULT_MONITOR_CONFIG)`. */
  sourceKey: string;
  verdict: SuspectVerdict;
  feedback: string;
}

export const DEBUG_SUSPECTS: readonly DebugSuspect[] = [
  {
    sourceKey: "first-call",
    verdict: "decoy",
    feedback: "This list does watch a, and it printed a's changes at 10 and 20 ns. Something after it stopped it.",
  },
  {
    sourceKey: "assign-5",
    verdict: "decoy",
    feedback: "b changing is not a fault. Nothing printed at 30 ns because the list at that time watches a, not b.",
  },
  {
    sourceKey: "second-call",
    verdict: "culprit",
    feedback: "Yes. This second $monitor call replaced the list that watched a (only one $monitor list is active at a time, §21.2.3), and nothing in §21.2.3 asks for a warning; the only trace is that the lines switch from a= to b= at 40 ns. From 40 ns only $time and b are watched.",
  },
  {
    sourceKey: "assign-6+assign-7",
    verdict: "decoy",
    feedback: "a does change here. The change is real; the list watching a is gone, so nothing reports it.",
  },
];

export interface DebugFix {
  id: string;
  label: string;
  config: MonitorConfig;
}

export const DEBUG_FIXES: readonly DebugFix[] = [
  { id: "one-list", label: "Delete the second call and add b to the first list", config: { ...DEFAULT_MONITOR_CONFIG, secondCallTime: null, firstListHasB: true } },
  { id: "fmonitor", label: "Make the second call an $fmonitor to a file", config: { ...DEFAULT_MONITOR_CONFIG, secondTask: "$fmonitor" } },
  { id: "monitoron", label: "Add $monitoron at 45 ns", config: { ...DEFAULT_MONITOR_CONFIG, monitorOnTime: 45 } },
  { id: "move-later", label: "Move the second call to 55 ns", config: { ...DEFAULT_MONITOR_CONFIG, secondCallTime: 55 } },
];

export type FixVerdict = "fixed" | "partial" | "not-fixed";

export interface FixGrade {
  fix: DebugFix;
  run: MonitorRun;
  /** Every change after 0 ns that no line reports in this run. */
  missed: MissedChange[];
  /** Changes the original log reported that this run no longer reports. */
  lost: MissedChange[];
  /** Changes the original log never reported either: gaps the case is not about. */
  alreadyMissed: MissedChange[];
  verdict: FixVerdict;
  sentence: string;
  /** A neutral note on the gaps the original bench already had, or null. */
  gapNote: string | null;
}

/** The change the case is about: a = 4 at 50 ns. */
export const CASE_CHANGE: MissedChange = { time: 50, signal: "a", value: 4 };

const changeText = (m: MissedChange) => `${m.signal}=${m.value} at ${ns(m.time)}`;
const sameChange = (p: MissedChange, q: MissedChange) => p.time === q.time && p.signal === q.signal;
const listText = (ms: MissedChange[]) => ms.map(changeText).join(", ");

/**
 * A fix is graded against the case: it fixes the bug when a = 4 at 50 ns is
 * logged and nothing the original log reported is lost. A gap the original
 * bench already had (b = 5 at 30 ns, when no list watched b) is not the bug,
 * so it is reported in a separate neutral note.
 */
export function gradeFix(fix: DebugFix): FixGrade {
  const original = runMonitor(DEFAULT_MONITOR_CONFIG);
  const originalMissed = missedChanges(original);
  const run = runMonitor(fix.config);
  const missed = missedChanges(run);
  const caseMissed = missed.some((m) => sameChange(m, CASE_CHANGE));
  const lost = missed.filter((m) => !originalMissed.some((o) => sameChange(o, m)));
  const alreadyMissed = missed.filter((m) => !sameChange(m, CASE_CHANGE) && originalMissed.some((o) => sameChange(o, m)));
  const verdict: FixVerdict = caseMissed ? "not-fixed" : lost.length ? "partial" : "fixed";
  const sentence =
    verdict === "fixed"
      ? missed.length
        ? `${changeText(CASE_CHANGE)} is logged now, and every change the original log reported is still reported.`
        : "Every change of a and b now reaches a log line in its own slot."
      : verdict === "partial"
        ? `${changeText(CASE_CHANGE)} is logged again, but ${listText(lost)}, which the original log reported, ${lost.length > 1 ? "are" : "is"} no longer logged.`
        : `${changeText(CASE_CHANGE)} is still not logged: the list that watched a is still replaced (§21.2.3). Not logged: ${listText(missed)}.`;
  const gapNote = alreadyMissed.length
    ? alreadyMissed
        .map((m) => {
          const slot = original.slots.find((s) => s.time === m.time);
          const active = original.lists.find((l) => l.id === slot?.activeMonitor);
          const why = active ? `: the list active then, ${listName(active)}, does not watch ${m.signal}` : "";
          return `${changeText(m)} was not logged before this fix either${why}.`;
        })
        .join(" ")
    : null;
  return { fix, run, missed, lost, alreadyMissed, verdict, sentence, gapNote };
}
