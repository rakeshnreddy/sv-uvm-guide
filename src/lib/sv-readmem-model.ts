/**
 * $readmemh load model: where each number in a memory file lands.
 *
 * Every rule below comes from IEEE 1800-2023 §21.4 ("Loading memory array data
 * from a file"), with §5.7.1 (integer literal constants) for the digits and
 * §6.8 (Table 6-7) for the value an unwritten logic word holds. Where §21.4 is
 * silent the model says so in the diagnostic it produces (`basis: "model"`),
 * instead of stating a tool's behaviour as a rule.
 *
 * The model is pure: no React, no DOM. Every sentence the ReadmemLoader shows
 * is built here, so the text and the computed result cannot disagree.
 */

export const READMEM_CLAUSE = "IEEE 1800-2023 §21.4";
export const LITERAL_CLAUSE = "IEEE 1800-2023 §5.7.1";
export const DEFAULT_VALUE_CLAUSE = "IEEE 1800-2023 §6.8, Table 6-7";

/** How the start and finish arguments of the call are given. */
export type ReadmemArgMode = "none" | "start" | "ascending" | "descending";

export const ARG_MODES: readonly ReadmemArgMode[] = ["none", "start", "ascending", "descending"];

export interface ReadmemCall {
  mode: ReadmemArgMode;
  start?: number;
  finish?: number;
}

export interface ReadmemMemory {
  /** Variable name, e.g. "rom". */
  name: string;
  /** Packed width of one word in bits. */
  width: number;
  /** Number of words; the unpacked range is [0:depth-1]. */
  depth: number;
}

export interface ReadmemPreset {
  id: string;
  /** Short sentence-case name for the preset picker. It names the file's content only, never the outcome, so it cannot answer the prediction. */
  label: string;
  /** Where the lesson uses it. */
  lessonUse: string;
  fileName: string;
  /** The memory file's text. */
  file: string;
  memory: ReadmemMemory;
  defaultMode: ReadmemArgMode;
  /** The start and finish values each argument mode uses for this preset. */
  args: { start: number; ascending: [number, number]; descending: [number, number] };
}

const ROM: ReadmemMemory = { name: "rom", width: 8, depth: 16 };

export const READMEM_PRESETS: readonly ReadmemPreset[] = [
  {
    id: "rom-hex",
    label: "The lesson's rom.hex",
    lessonUse: "Loading memories: $readmemh",
    fileName: "rom.hex",
    file: "// rom.hex\n@0\n12 34     // addresses 0 and 1\n@8\nff        // address 8\n",
    memory: ROM,
    defaultMode: "none",
    args: { start: 2, ascending: [0, 15], descending: [15, 0] },
  },
  {
    id: "at4",
    label: "@4 then aa bb",
    lessonUse: "Quiz question 7",
    fileName: "rom.hex",
    file: "@4\naa bb\n",
    memory: ROM,
    defaultMode: "none",
    args: { start: 2, ascending: [0, 7], descending: [7, 0] },
  },
  {
    id: "at10",
    label: "@10 then 5a",
    lessonUse: "Loading memories: $readmemh",
    fileName: "rom.hex",
    file: "@10\n5a\n",
    memory: { name: "rom", width: 8, depth: 32 },
    defaultMode: "none",
    args: { start: 4, ascending: [0, 15], descending: [31, 0] },
  },
  {
    id: "data-hex",
    label: "data.hex: four numbers",
    lessonUse: "Loading memories: $readmemh (the start and finish table)",
    fileName: "data.hex",
    file: "11\n22\n33\n44\n",
    memory: ROM,
    defaultMode: "none",
    args: { start: 4, ascending: [4, 7], descending: [7, 4] },
  },
  {
    id: "short",
    label: "Kata 2: sums_short.hex",
    lessonUse: "Kata 2: expected sums from memory files",
    fileName: "sums_short.hex",
    file: "003\n100\n100\n",
    memory: { name: "sum_mem", width: 9, depth: 4 },
    defaultMode: "none",
    args: { start: 1, ascending: [0, 3], descending: [3, 0] },
  },
  {
    id: "sized",
    label: "12, 8'h34, 56",
    lessonUse: "Loading memories: $readmemh (and the pitfalls table)",
    fileName: "rom.hex",
    file: "12\n8'h34\n56\n",
    memory: ROM,
    defaultMode: "none",
    args: { start: 4, ascending: [0, 15], descending: [15, 0] },
  },
  {
    id: "out-of-range",
    label: "@2 then 11 22",
    lessonUse: "Loading memories: $readmemh",
    fileName: "rom.hex",
    file: "@2\n11 22\n",
    memory: ROM,
    defaultMode: "ascending",
    args: { start: 4, ascending: [4, 7], descending: [7, 4] },
  },
];

export function getReadmemPreset(id: string | undefined): ReadmemPreset {
  return READMEM_PRESETS.find((p) => p.id === id) ?? READMEM_PRESETS[0];
}

export function callForMode(preset: ReadmemPreset, mode: ReadmemArgMode): ReadmemCall {
  if (mode === "none") return { mode };
  if (mode === "start") return { mode, start: preset.args.start };
  const [start, finish] = mode === "ascending" ? preset.args.ascending : preset.args.descending;
  return { mode, start, finish };
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

export function hexDigitsFor(width: number): number {
  return Math.ceil(width / 4);
}

export function declarationText(memory: ReadmemMemory): string {
  return `logic [${memory.width - 1}:0] ${memory.name} [0:${memory.depth - 1}];`;
}

export function callText(fileName: string, memory: ReadmemMemory, call: ReadmemCall): string {
  const parts = [`"${fileName}"`, memory.name];
  if (call.start !== undefined) parts.push(String(call.start));
  if (call.finish !== undefined) parts.push(String(call.finish));
  return `$readmemh(${parts.join(", ")});`;
}

/** Short label for an argument mode on a given preset, e.g. "rom, 7, 0". */
export function argModeLabel(preset: ReadmemPreset, mode: ReadmemArgMode): string {
  const call = callForMode(preset, mode);
  const parts = [preset.memory.name];
  if (call.start !== undefined) parts.push(String(call.start));
  if (call.finish !== undefined) parts.push(String(call.finish));
  return parts.join(", ");
}

export const ARG_MODE_NAMES: Record<ReadmemArgMode, string> = {
  none: "No addresses",
  start: "Start only",
  ascending: "Start and finish",
  descending: "Start above finish",
};

export function listText(items: readonly (string | number)[]): string {
  const s = items.map(String);
  if (s.length === 0) return "none";
  if (s.length === 1) return s[0];
  if (s.length === 2) return `${s[0]} and ${s[1]}`;
  return `${s.slice(0, -1).join(", ")} and ${s[s.length - 1]}`;
}

export function hexAddress(address: number): string {
  return address.toString(16);
}

// ---------------------------------------------------------------------------
// Tokenizer (§21.4: white space, comments and numbers only)
// ---------------------------------------------------------------------------

export type TokenKind =
  | "comment"
  | "address"
  | "word"
  /** A number with a size or a base, e.g. 8'h12: §21.4 forbids both. */
  | "sized"
  /** "@" with no hexadecimal number straight after it. */
  | "bad-address"
  /** Anything else a $readmemh file may not hold. */
  | "invalid";

export interface FileToken {
  index: number;
  kind: TokenKind;
  text: string;
  /** Offsets into the file text: [from, to). */
  from: number;
  to: number;
  /** 1-based line number. */
  line: number;
}

const HEX_ADDRESS = /^@[0-9a-fA-F]+$/;
const HEX_WORD = /^[0-9a-fA-FxXzZ_]+$/;

/** §21.4 digits with x, z and _; §5.7.1: an underscore is legal anywhere in a number except as the first character. */
function isWordText(text: string): boolean {
  return text.length > 0 && HEX_WORD.test(text) && text[0] !== "_";
}

function classify(text: string): TokenKind {
  if (text.startsWith("@")) return HEX_ADDRESS.test(text) ? "address" : "bad-address";
  if (text.includes("'")) return "sized";
  if (isWordText(text)) return "word";
  return "invalid";
}

/**
 * Splits a memory file into tokens. Both comment forms are allowed (§21.4);
 * white space separates numbers. Comments are kept as tokens so a step-through
 * can show them being skipped.
 */
export function tokenizeReadmemFile(file: string): FileToken[] {
  const tokens: FileToken[] = [];
  let i = 0;
  let line = 1;
  const push = (kind: TokenKind, from: number, to: number, atLine: number) => {
    tokens.push({ index: tokens.length, kind, text: file.slice(from, to), from, to, line: atLine });
  };
  while (i < file.length) {
    const ch = file[i];
    if (ch === "\n") {
      line += 1;
      i += 1;
      continue;
    }
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (file.startsWith("//", i)) {
      const end = file.indexOf("\n", i);
      const to = end === -1 ? file.length : end;
      push("comment", i, to, line);
      i = to;
      continue;
    }
    if (file.startsWith("/*", i)) {
      const end = file.indexOf("*/", i + 2);
      const to = end === -1 ? file.length : end + 2;
      const startLine = line;
      line += (file.slice(i, to).match(/\n/g) ?? []).length;
      push(end === -1 ? "invalid" : "comment", i, to, startLine);
      i = to;
      continue;
    }
    let j = i;
    while (j < file.length && !/\s/.test(file[j]) && !file.startsWith("//", j) && !file.startsWith("/*", j)) j += 1;
    const text = file.slice(i, j);
    push(classify(text), i, j, line);
    i = j;
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// Words (§21.4 digits, §5.7.1 padding and truncation)
// ---------------------------------------------------------------------------

type Bit = "0" | "1" | "x" | "z";

function digitBits(d: string): Bit[] {
  const c = d.toLowerCase();
  if (c === "x") return ["x", "x", "x", "x"];
  if (c === "z") return ["z", "z", "z", "z"];
  return parseInt(c, 16)
    .toString(2)
    .padStart(4, "0")
    .split("") as Bit[];
}

export interface WordValue {
  /** The word as hex digits, one per 4 bits from the right (e.g. "12", "100", "xx"). */
  digits: string;
  /** True when the token had more significant digits than the word holds. */
  truncated: boolean;
  /** True when any bit is x or z. */
  unknown: boolean;
}

function bitsToDigits(bits: Bit[]): string {
  let out = "";
  for (let end = bits.length; end > 0; end -= 4) {
    const group = bits.slice(Math.max(0, end - 4), end);
    let d: string;
    if (group.every((b) => b === "x")) d = "x";
    else if (group.every((b) => b === "z")) d = "z";
    else if (group.includes("x")) d = "X";
    else if (group.includes("z")) d = "Z";
    else d = parseInt(group.join(""), 2).toString(16);
    out = d + out;
  }
  return out;
}

/**
 * Turns a hexadecimal token into a word of the memory's width. §21.4 lets x, z
 * and _ appear "as in a SystemVerilog source description"; the padding and
 * truncation follow the sized-literal rule of §5.7.1 (pad on the left with 0,
 * or with x or z when the leftmost bit is x or z; truncate from the left).
 * §21.4 does not restate those two rules for files, so they are the model's reading.
 */
export function wordValue(token: string, width: number): WordValue {
  // Callers pass a "word" token only; anything else has no defined value here.
  if (!isWordText(token)) throw new Error(`wordValue: "${token}" is not a hexadecimal word token`);
  const digits = token.replace(/_/g, "");
  let bits: Bit[] = digits.split("").flatMap(digitBits);
  let truncated = false;
  if (bits.length > width) {
    const dropped = bits.slice(0, bits.length - width);
    truncated = dropped.some((b) => b !== "0");
    bits = bits.slice(bits.length - width);
  } else if (bits.length < width) {
    const lead = bits[0];
    const pad: Bit = lead === "x" || lead === "z" ? lead : "0";
    bits = [...Array<Bit>(width - bits.length).fill(pad), ...bits];
  }
  return { digits: bitsToDigits(bits), truncated, unknown: bits.some((b) => b === "x" || b === "z") };
}

/** A logic word that was never written holds x in every bit (§6.8, Table 6-7). */
export function unknownWord(width: number): string {
  return "x".repeat(hexDigitsFor(width));
}

export function sizedText(width: number, digits: string): string {
  return `${width}'h${digits}`;
}

// ---------------------------------------------------------------------------
// Load simulation
// ---------------------------------------------------------------------------

export type Severity = "error" | "warning" | "note";

export interface ReadmemDiagnostic {
  severity: Severity;
  message: string;
  /** The clause the diagnostic rests on. */
  clause: string;
  /** "rule" when the standard requires it; "model" where the standard is silent and the model chose. */
  basis: "rule" | "model";
}

export interface MemoryCell {
  address: number;
  digits: string;
  written: boolean;
  /** The step that last wrote the cell, if any. */
  writtenAt: number | null;
  /** Index of the file token that wrote it. */
  tokenIndex: number | null;
}

export type StepKind = "start" | "comment" | "address" | "write" | "stop" | "error" | "check" | "end";

export interface ReadmemStep {
  index: number;
  kind: StepKind;
  tokenIndex: number | null;
  /** Load pointer after this step (may lie outside the memory once loading has run past the end). */
  pointer: number;
  /** The address written by this step, for a write. */
  address: number | null;
  message: string;
  /**
   * What this step reports. Where the file breaks a §21.4 "shall" the rule comes
   * first (basis "rule") and the model's choice to stop follows as its own note
   * (basis "model"), so the UI can label which part the standard settles.
   */
  diagnostics: ReadmemDiagnostic[];
  cells: MemoryCell[];
}

export interface ReadmemRange {
  low: number;
  high: number;
  /** True when the call itself gave the range (start, or start and finish). */
  fromCall: boolean;
}

export type ReadmemOutcome = "complete" | "terminated" | "stopped";

/** The token that ended the load early, and the address it would have used. */
export interface ReadmemEnd {
  tokenIndex: number;
  text: string;
  /** The @ target for an address token, otherwise the pointer when the token was met. */
  wouldBeAddress: number;
  /** "rule" when §21.4 itself ends the load (an @ outside the call's range); "model" when ending is the model's choice. */
  basis: "rule" | "model";
}

export interface ReadmemRun {
  memory: ReadmemMemory;
  call: ReadmemCall;
  tokens: FileToken[];
  steps: ReadmemStep[];
  direction: "up" | "down";
  startAddress: number;
  range: ReadmemRange;
  /** Addresses written, in the order the file reached them (an address appears once, at its first write). */
  landed: number[];
  diagnostics: ReadmemDiagnostic[];
  outcome: ReadmemOutcome;
  /** Set when the load ended before the file was fully read. */
  endedAt: ReadmemEnd | null;
  /**
   * True when the model's own choice (a basis "model" stop or termination) decides
   * where values land, so the grading must not present the landing set as the standard's.
   */
  modelDecides: boolean;
  hasAddressLines: boolean;
  wordCount: number;
}

/** Throws when the call's addresses lie outside the memory: presets never do this. */
export function validateCall(memory: ReadmemMemory, call: ReadmemCall): void {
  const inMemory = (a: number) => Number.isInteger(a) && a >= 0 && a < memory.depth;
  if (call.mode === "none") return;
  if (call.start === undefined || !inMemory(call.start)) throw new Error(`start address ${call.start} is outside ${memory.name} [0:${memory.depth - 1}]`);
  if (call.mode === "start") return;
  if (call.finish === undefined || !inMemory(call.finish)) throw new Error(`finish address ${call.finish} is outside ${memory.name} [0:${memory.depth - 1}]`);
  if (call.mode === "ascending" && call.start > call.finish) throw new Error("an ascending call needs start <= finish");
  if (call.mode === "descending" && call.start <= call.finish) throw new Error("a descending call needs start > finish");
}

/**
 * §21.4: with no addresses loading starts at the lowest address and moves up;
 * with a start only it starts there and moves up; with start and finish it
 * starts at start and moves toward finish, so downward when start > finish.
 */
export function loadDirection(call: ReadmemCall): "up" | "down" {
  return call.start !== undefined && call.finish !== undefined && call.start > call.finish ? "down" : "up";
}

/** §21.4: the default start address is the lowest address in the memory. */
export function startAddress(call: ReadmemCall): number {
  return call.start ?? 0;
}

/**
 * The range @ addresses must fall in. §21.4 checks file addresses against "the
 * address range specified by the system task arguments". With start and finish
 * that is start through finish. With only a start, §21.4 says loading runs from
 * start toward the highest address, which the model takes as the range: the
 * standard does not spell this case out (see `startOnlyRangeNote`).
 */
export function addressRange(memory: ReadmemMemory, call: ReadmemCall): ReadmemRange {
  if (call.mode === "none" || call.start === undefined) return { low: 0, high: memory.depth - 1, fromCall: false };
  if (call.finish === undefined) return { low: call.start, high: memory.depth - 1, fromCall: true };
  return { low: Math.min(call.start, call.finish), high: Math.max(call.start, call.finish), fromCall: true };
}

export function rangeText(range: ReadmemRange): string {
  return `${range.low} to ${range.high}`;
}

export function directionText(direction: "up" | "down"): string {
  return direction === "up" ? "upward" : "downward";
}

/** The start step's sentence: where the pointer begins and which way it moves. */
export function describeStart(memory: ReadmemMemory, call: ReadmemCall, hasAddressLines = false): string {
  const start = startAddress(call);
  if (call.mode === "none") {
    return hasAddressLines
      ? `No start or finish address: the pointer starts at the lowest address, ${start}, unless an @ line in the file moves it, and moves upward, even after an @ line.`
      : `No start or finish address: loading starts at the lowest address, ${start}, and moves upward, even after an @ line.`;
  }
  if (call.mode === "start") {
    return `Start ${start}, no finish: loading starts at address ${start} and moves upward toward ${memory.depth - 1}, even after an @ line.`;
  }
  const dir = loadDirection(call);
  const why = dir === "down" ? "start is greater than finish, so the address goes down by one after each word" : "start is not greater than finish, so the address goes up by one after each word";
  return `Start ${call.start}, finish ${call.finish}: ${why}. This direction holds even after an @ line.`;
}

export const START_ONLY_RANGE_NOTE =
  "§21.4 checks @ addresses against the range the call gives but does not spell out that range for a start-only call; the model takes it as the start address up to the highest address, the way §21.4 says loading proceeds.";

/** §21.4 gives an address as "@ followed by a hexadecimal number" and lists x, z and _ only for data numbers. */
export const ADDRESS_DIGITS_NOTE =
  "§21.4 gives a file address as @ followed by a hexadecimal number and lists x, z and _ only for the data numbers; the model reads the address as plain hexadecimal digits, so it rejects _, x or z after the @.";

/** §21.4 lists x, z and _ for data numbers; §5.7.1 also lets ? stand for z in a literal. */
export const QUESTION_MARK_NOTE =
  "§21.4 lists x, z and _ for the numbers in the file but not ?, which §5.7.1 allows in place of z in a literal; the model treats ? as a character the file may not hold.";



function snapshot(cells: MemoryCell[]): MemoryCell[] {
  return cells.map((c) => ({ ...c }));
}

/** The stop sentence when the next word has nowhere to go; it never names an address the memory does not have as if it existed. */
function pastEndText(memory: ReadmemMemory, call: ReadmemCall, pointer: number): string {
  const inMemory = pointer >= 0 && pointer < memory.depth;
  const beyond = pointer < 0 ? "below 0" : `above ${memory.depth - 1}`;
  if (call.finish !== undefined) {
    return inMemory ? `Address ${pointer} is past the finish address ${call.finish}.` : `The next address would be ${beyond}, past the finish address ${call.finish}.`;
  }
  return `The next address would be above ${memory.depth - 1}, the highest address of ${memory.name}.`;
}

/** Runs $readmemh over a file and records one step per token, plus the start and end. */
export function simulateReadmem(file: string, memory: ReadmemMemory, call: ReadmemCall): ReadmemRun {
  validateCall(memory, call);
  const tokens = tokenizeReadmemFile(file);
  const direction = loadDirection(call);
  const start = startAddress(call);
  const range = addressRange(memory, call);
  const hasAddressLines = tokens.some((t) => t.kind === "address" || t.kind === "bad-address");
  const wordCount = tokens.filter((t) => t.kind === "word").length;
  const step = direction === "up" ? 1 : -1;

  const cells: MemoryCell[] = Array.from({ length: memory.depth }, (_, address) => ({
    address,
    digits: unknownWord(memory.width),
    written: false,
    writtenAt: null,
    tokenIndex: null,
  }));
  const steps: ReadmemStep[] = [];
  const diagnostics: ReadmemDiagnostic[] = [];
  const landed: number[] = [];
  let pointer = start;
  let outcome: ReadmemOutcome = "complete";
  let endedAt: ReadmemEnd | null = null;

  const add = (kind: StepKind, tokenIndex: number | null, message: string, stepDiagnostics: ReadmemDiagnostic | ReadmemDiagnostic[] | null = null, address: number | null = null) => {
    const list = stepDiagnostics === null ? [] : Array.isArray(stepDiagnostics) ? stepDiagnostics : [stepDiagnostics];
    diagnostics.push(...list);
    steps.push({ index: steps.length, kind, tokenIndex, pointer, address, message, diagnostics: list, cells: snapshot(cells) });
  };
  const endAt = (token: FileToken, wouldBeAddress: number, basis: "rule" | "model") => {
    endedAt = { tokenIndex: token.index, text: token.text, wouldBeAddress, basis };
  };
  /** The model's half of a format break: §21.4 forbids the token but does not say how a tool reacts. */
  const modelStopNote = (text: string): ReadmemDiagnostic => ({
    severity: "note",
    message: `§21.4 does not say how a tool reacts to ${text}; the model stops loading here, so every later cell keeps its old value.`,
    clause: READMEM_CLAUSE,
    basis: "model",
  });

  add("start", null, describeStart(memory, call, hasAddressLines));

  const inRange = (a: number) => a >= range.low && a <= range.high;

  for (const token of tokens) {
    if (token.kind === "comment") {
      add("comment", token.index, `${token.text.startsWith("//") ? "A // comment" : "A /* */ comment"}: skipped. Both comment forms are allowed in the file.`);
      continue;
    }
    if (token.kind === "address") {
      const digits = token.text.slice(1);
      const target = parseInt(digits, 16);
      // Only when reading the digits as decimal would give a different address (a leading zero alone does not).
      const readsDifferently = !/^[0-9]+$/.test(digits) || parseInt(digits, 10) !== target;
      const decimalNote = readsDifferently ? ` (${digits} is hexadecimal, so this is address ${target}, not ${digits})` : "";
      if (range.fromCall && !inRange(target)) {
        const rangeWords =
          call.mode === "start"
            ? `outside the range ${rangeText(range)} (the start address up to the highest address, the model's reading of a start-only call)`
            : `outside the range ${rangeText(range)} that the call gives`;
        add(
          "error",
          token.index,
          `@${digits} is address ${target}${decimalNote}, ${rangeWords}. That is an error, and the load ends here.`,
          {
            severity: "error",
            message: `@${digits} (address ${target}) is outside the call's range ${rangeText(range)}: an error, and the load is terminated.${call.mode === "start" ? ` ${START_ONLY_RANGE_NOTE}` : ""}`,
            clause: READMEM_CLAUSE,
            basis: call.mode === "start" ? "model" : "rule",
          },
        );
        outcome = "terminated";
        endAt(token, target, call.mode === "start" ? "model" : "rule");
        break;
      }
      if (!range.fromCall && (target < 0 || target >= memory.depth)) {
        add("stop", token.index, `@${digits} is address ${target}, outside ${memory.name} [0:${memory.depth - 1}]. The model stops here.`, {
          severity: "note",
          message: `@${digits} (address ${target}) lies outside the memory. §21.4 does not say what a tool does with an @ address outside the memory when the call gives no range; the model stops loading.`,
          clause: READMEM_CLAUSE,
          basis: "model",
        });
        outcome = "stopped";
        endAt(token, target, "model");
        break;
      }
      pointer = target;
      add("address", token.index, `@${digits} moves the pointer to address ${target}${decimalNote}. The direction stays ${directionText(direction)}.`);
      continue;
    }
    if (token.kind === "bad-address") {
      const bare = token.text === "@";
      // "@1_0" or "@1x": §21.4 does not settle whether _, x or z may follow the @, so rejecting them is the model's reading.
      const numberLike = !bare && isWordText(token.text.slice(1));
      add(
        "stop",
        token.index,
        numberLike
          ? `"${token.text}" is not an address in this model: the model reads an address as @ followed straight away by plain hexadecimal digits, with no _, x or z. The model stops here.`
          : `"${token.text}" is not an address: an address is @ followed straight away by hexadecimal digits. The model stops here.`,
        [
          numberLike
            ? { severity: "error", message: `"${token.text}": ${ADDRESS_DIGITS_NOTE}`, clause: READMEM_CLAUSE, basis: "model" }
            : {
                severity: "error",
                message: bare
                  ? `"@" with nothing after it: §21.4 allows no white space between the @ and the number.`
                  : `"${token.text}" is not @ followed by hexadecimal digits, the address form §21.4 gives.`,
                clause: READMEM_CLAUSE,
                basis: "rule",
              },
          modelStopNote(`"${token.text}"`),
        ],
      );
      outcome = "stopped";
      endAt(token, pointer, "model");
      break;
    }
    if (token.kind === "sized") {
      add("stop", token.index, `${token.text} carries a size or a base. Numbers in the file may have neither, so this file breaks the format. The model stops here.`, [
        {
          severity: "error",
          message: `${token.text}: numbers in a memory file shall have neither the length nor the base format specified.`,
          clause: READMEM_CLAUSE,
          basis: "rule",
        },
        modelStopNote(token.text),
      ]);
      outcome = "stopped";
      endAt(token, pointer, "model");
      break;
    }
    if (token.kind === "invalid") {
      const leadingUnderscore = token.text.startsWith("_");
      // A token that would be a number if ? were read as z: whether ? is legal in the file is open.
      const questionOnly = !leadingUnderscore && token.text.includes("?") && isWordText(token.text.replace(/\?/g, "z"));
      add("stop", token.index, `"${token.text}" is not a hexadecimal number${questionOnly ? " in this model" : ""}. The model stops here.`, [
        questionOnly
          ? { severity: "error", message: `"${token.text}": ${QUESTION_MARK_NOTE}`, clause: READMEM_CLAUSE, basis: "model" }
          : {
              severity: "error",
              message: leadingUnderscore
                ? `"${token.text}" starts with an underscore, which §5.7.1 does not allow as the first character of a number.`
                : `"${token.text}": the file may hold only white space, comments and hexadecimal numbers.`,
              clause: leadingUnderscore ? LITERAL_CLAUSE : READMEM_CLAUSE,
              basis: "rule",
            },
        modelStopNote(`"${token.text}"`),
      ]);
      outcome = "stopped";
      endAt(token, pointer, "model");
      break;
    }
    // A data word.
    if (pointer < range.low || pointer > range.high) {
      const past = pastEndText(memory, call, pointer);
      const ruleText = range.fromCall && call.finish !== undefined
        ? "§21.4 says loading continues toward the finish address and does not say what a tool does with words beyond it; the model stops loading."
        : "§21.4 loads consecutive words until the highest address is reached or the file ends; the model stops loading, and how a tool reports the words left over is not set by the standard.";
      add("stop", token.index, `${past} The word ${token.text} has nowhere to go, so loading stops.`, {
        severity: "note",
        message: `${past} ${ruleText}`,
        clause: READMEM_CLAUSE,
        basis: "model",
      });
      outcome = "stopped";
      // With no addresses in the call §21.4 itself loads "until ... the highest address in the memory is reached",
      // so where the words land is the standard's; only what happens to the words left over is the model's.
      endAt(token, pointer, call.mode === "none" ? "rule" : "model");
      break;
    }
    const value = wordValue(token.text, memory.width);
    const address = pointer;
    cells[address] = { address, digits: value.digits, written: true, writtenAt: steps.length, tokenIndex: token.index };
    if (!landed.includes(address)) landed.push(address);
    pointer = address + step;
    const truncNote = value.truncated
      ? ` It has more digits than a ${memory.width}-bit word holds; the model drops the extra digits on the left as a sized literal would (§5.7.1), a reading §21.4 does not state.`
      : "";
    add(
      "write",
      token.index,
      `${token.text} loads into address ${address}: ${memory.name}[${address}] = ${sizedText(memory.width, value.digits)}. The pointer moves ${directionText(direction)} to ${pointer}.${truncNote}`,
      value.truncated
        ? { severity: "note", message: `${token.text} is wider than the ${memory.width}-bit word. The model truncates from the left as §5.7.1 does for a sized literal; §21.4 does not say.`, clause: LITERAL_CLAUSE, basis: "model" }
        : null,
      address,
    );
  }

  // §21.4: with start and finish given and no @ lines, a word count that differs from the range is a warning.
  const formatBreak = tokens.some((t) => t.kind === "sized" || t.kind === "invalid");
  const countApplies = outcome !== "terminated" && call.mode !== "none" && call.mode !== "start" && !hasAddressLines;
  if (countApplies && formatBreak) {
    add("check", null, "Final check: skipped. The file breaks the number format, so the model does not run the word-count check.", {
      severity: "note",
      message: "§21.4 does not say whether the word-count warning applies to a file that breaks the number format; the model skips the check for such a file.",
      clause: READMEM_CLAUSE,
      basis: "model",
    });
  } else if (countApplies) {
    const rangeWords = range.high - range.low + 1;
    if (wordCount !== rangeWords) {
      add("check", null, `Final check: the file holds ${wordCount} word${wordCount === 1 ? "" : "s"} but the range ${call.start} to ${call.finish} holds ${rangeWords}. That is a warning, not an error.`, {
        severity: "warning",
        message: `The file holds ${wordCount} data word${wordCount === 1 ? "" : "s"} and the range ${call.start} to ${call.finish} holds ${rangeWords}: a warning. The words in the file load from the start address, and addresses the file does not reach are not modified.`,
        clause: READMEM_CLAUSE,
        basis: "rule",
      });
    } else {
      add("check", null, `Final check: the file holds ${wordCount} word${wordCount === 1 ? "" : "s"} and the range ${call.start} to ${call.finish} holds ${rangeWords}, so there is no warning.`);
    }
  }

  const untouched = cells.filter((c) => !c.written).length;
  const endText =
    outcome === "terminated"
      ? "The load was terminated."
      : outcome === "stopped"
        ? "The model stopped loading."
        : "The file is fully read.";
  add(
    "end",
    null,
    `${endText} ${landed.length === 0 ? "No address was written" : `Written: ${listText(landed)}`}. ${untouched === 0 ? "Every cell was written." : `${untouched} cell${untouched === 1 ? "" : "s"} the file never reached ${untouched === 1 ? "keeps its" : "keep their"} old value: x for a logic word that was never written.`}`,
  );

  const end = endedAt as ReadmemEnd | null;
  const modelDecides = end !== null && end.basis === "model";
  return { memory, call, tokens, steps, direction, startAddress: start, range, landed, diagnostics, outcome, endedAt: end, modelDecides, hasAddressLines, wordCount };
}

export function runPreset(preset: ReadmemPreset, mode: ReadmemArgMode = preset.defaultMode): ReadmemRun {
  return simulateReadmem(preset.file, preset.memory, callForMode(preset, mode));
}

// ---------------------------------------------------------------------------
// Prediction grading
// ---------------------------------------------------------------------------

export type CellVerdict = "hit" | "missed" | "extra" | "quiet";

export interface PredictionGrade {
  correct: boolean;
  hits: number[];
  missed: number[];
  extra: number[];
  verdicts: Record<number, CellVerdict>;
  headline: string;
  /** Why the right answer holds, then one line per wrong cell. */
  reasons: string[];
}

export function cellVerdict(address: number, predicted: ReadonlySet<number>, landed: readonly number[]): CellVerdict {
  const p = predicted.has(address);
  const l = landed.includes(address);
  if (p && l) return "hit";
  if (l) return "missed";
  if (p) return "extra";
  return "quiet";
}

export const VERDICT_TEXT: Record<CellVerdict, string> = {
  hit: "✓ picked, loaded",
  missed: "✕ loaded, not picked",
  extra: "✕ picked, not loaded",
  quiet: "",
};

/** The explanation for the right answer, built from the steps. */
export function whyItLands(run: ReadmemRun): string {
  const writes = run.steps.filter((s) => s.kind === "write");
  const start = run.steps[0].message;
  const parts = [start];
  const addressSteps = run.steps.filter((s) => s.kind === "address");
  for (const s of addressSteps) parts.push(s.message);
  if (writes.length > 0) {
    parts.push(
      writes.length === 1
        ? `The word lands at ${writes[0].address as number}.`
        : `The words land at ${listText(writes.map((w) => w.address as number))}, in that order.`,
    );
  } else {
    parts.push("No word is loaded.");
  }
  for (const s of run.steps) {
    if (s.kind === "error" || s.kind === "stop" || (s.kind === "check" && s.diagnostics.length > 0)) parts.push(s.message);
  }
  return parts.join(" ");
}

/**
 * The grading headline. When a model-basis stop or termination decides the
 * landing set, the headline says so instead of presenting it as the standard's.
 */
export function landingHeadline(run: ReadmemRun, correct: boolean, landedSorted: readonly number[]): string {
  const where = landedSorted.length === 0 ? null : listText(landedSorted);
  if (run.modelDecides) {
    const body = where === null ? "no value lands anywhere" : `values land at ${where}`;
    return `${correct ? "Right" : "Not quite"}. In this model: ${body}.`;
  }
  if (correct) return where === null ? "Right: no value lands anywhere." : `Right: values land at ${where}.`;
  return `Not quite: values land at ${where ?? "no address"}.`;
}

/** True when an address lies at or beyond, in load order, the address the ending token would have used. */
export function endedBefore(run: ReadmemRun, address: number): boolean {
  if (!run.endedAt) return false;
  const at = run.endedAt.wouldBeAddress;
  return run.direction === "up" ? address >= at : address <= at;
}

/** Why a picked cell was not written when the load ended early, worded by who decides the end. */
export function endedBeforeReason(end: ReadmemEnd, address: number): string {
  return end.basis === "rule"
    ? `Address ${address}: the load ended at ${end.text}, before reaching it (${READMEM_CLAUSE}).`
    : `Address ${address}: the model stops at ${end.text}, before reaching it. §21.4 does not say how a tool reacts there, so this is the model's reading (${READMEM_CLAUSE}).`;
}

export function gradePrediction(run: ReadmemRun, predicted: ReadonlySet<number>): PredictionGrade {
  const landedSorted = [...run.landed].sort((a, b) => a - b);
  const hits = landedSorted.filter((a) => predicted.has(a));
  const missed = landedSorted.filter((a) => !predicted.has(a));
  const extra = [...predicted].filter((a) => !run.landed.includes(a)).sort((a, b) => a - b);
  const verdicts: Record<number, CellVerdict> = {};
  for (let a = 0; a < run.memory.depth; a += 1) verdicts[a] = cellVerdict(a, predicted, run.landed);
  const correct = missed.length === 0 && extra.length === 0;
  const headline = landingHeadline(run, correct, landedSorted);

  const reasons = [whyItLands(run)];
  const addressDigits = run.steps
    .filter((s) => s.kind === "address" || s.kind === "error")
    .map((s) => run.tokens[s.tokenIndex as number].text.slice(1));
  for (const a of missed) {
    const w = run.steps.find((s) => s.kind === "write" && s.address === a);
    reasons.push(`Address ${a}: the word ${w ? run.tokens[w.tokenIndex as number].text : ""} loads here at step ${w ? w.index + 1 : "?"}.`);
  }
  for (const a of extra) {
    const asDecimal = addressDigits.find((d) => d === String(a) && parseInt(d, 16) !== a);
    if (asDecimal !== undefined) {
      reasons.push(`Address ${a}: @${asDecimal} is hexadecimal, so it means address ${parseInt(asDecimal, 16)}, not ${a}.`);
    } else if (run.endedAt && endedBefore(run, a)) {
      reasons.push(endedBeforeReason(run.endedAt, a));
    } else {
      reasons.push(`Address ${a}: the file never reaches it, so it keeps its old value, ${sizedText(run.memory.width, unknownWord(run.memory.width))} for a logic word never written.`);
    }
  }
  return { correct, hits, missed, extra, verdicts, headline, reasons };
}

/** One-line text alternative for the memory after a given step. */
export function memorySummary(run: ReadmemRun, stepIndex: number): string {
  const s = run.steps[Math.max(0, Math.min(stepIndex, run.steps.length - 1))];
  const written = s.cells.filter((c) => c.written);
  const writtenText = written.length === 0 ? "no cell written yet" : written.map((c) => `${run.memory.name}[${c.address}] = ${c.digits}`).join(", ");
  if (written.length === s.cells.length) return `${writtenText}; every cell was written.`;
  return `${writtenText}; every other cell holds ${unknownWord(run.memory.width)}.`;
}
