/**
 * File-reading model for FileReadCursorVisualizer (IEEE 1800-2023).
 *
 * Pure and deterministic; no React. A file is a character tape with a read
 * cursor. The model executes $fopen, $fscanf, $sscanf, $fgets, $feof and
 * $fclose on that tape and, on top of them, the lesson's read loops and its
 * plusarg-selected, file-driven adder bench.
 *
 * Rules implemented, with their clauses:
 * - §21.3.1  $fopen returns 0 when the file cannot be opened (a missing file opened "r").
 * - §21.3.4.3 $fscanf / $sscanf:
 *     - a white-space directive reads input up to the next nonwhite character
 *       (blanks, tabs, newlines and formfeeds; for $sscanf also nulls);
 *     - an ordinary character must match the next input character;
 *     - a conversion skips leading white space, then reads an input field that
 *       extends to the next inappropriate character (Table 21-7 sets for %h and %d);
 *     - a conflicting character ends the conversion and is left unread;
 *     - trailing white space, the final newline included, is left unread;
 *     - the return value is the number of items matched and assigned, which can
 *       be 0 on an early matching failure, and is EOF (-1) only when the input
 *       ends before the first matching failure or conversion;
 *     - a destination too small for the field receives, in general, its LSBs.
 * - §21.3.4.2 $fgets reads characters until a newline (transferred too) or EOF and
 *   returns the count; 0 on an error. At the end of the file it reads nothing.
 * - §21.3.8  $feof returns nonzero only when EOF has previously been detected
 *   while reading; it returns zero otherwise.
 * - §20.10   $error prints and the run continues; $fatal implies $finish.
 * - §20.2    $finish ends the run.
 * - §11.4.3  an x or z operand bit makes an arithmetic result entirely x.
 * - §11.4.5  !== compares bit for bit, including x and z, zero-extending the shorter unsigned operand;
 *   != gives 1'bx only when x/z bits make the relation ambiguous (a known differing bit gives 1).
 * - §12.4    an if condition that is x or z counts as false.
 * - §21.2.1.3 %h prints x / X / z / Z digits for unknown groups.
 *
 * Modelling choices, stated rather than hidden:
 * - "EOF detected" (§21.3.8) is modelled as: a read tried to read a character
 *   past the last one. A field that runs to the very end of the file detects it.
 * - Only %h (%x) and %d conversions, white space and ordinary characters are
 *   modelled. A %d sign with no digits after it is reported as a matching
 *   failure at the sign; the standard does not say how much input it consumes.
 * - A field shorter than its destination is zero-extended; §21.3.4.3 only
 *   states the too-large case.
 * - A read on descriptor 0 (an unchecked failed $fopen) is not defined by the
 *   standard. The model returns -1 and says that tools differ.
 */

import { displayPlusargValue, testPlusargs, valuePlusargs } from "./sv-plusargs-model";

// ---------------------------------------------------------------------------
// Four-state values
// ---------------------------------------------------------------------------

/** MSB-first string of '0' | '1' | 'x' | 'z'. */
export type Bits = string;

export interface VarDecl {
  name: string;
  width: number;
}

export function allX(width: number): Bits {
  return "x".repeat(width);
}

function resize(bits: Bits, width: number): Bits {
  if (bits.length >= width) return bits.slice(bits.length - width);
  return bits.padStart(width, "0");
}

const HEX_DIGITS = "0123456789abcdefABCDEF";
const HEX_FIELD = /[0-9a-fA-FxXzZ?_]/;

/** Table 21-7 %h: 0-9, a-f, A-F, x, X, z, Z, ?, _ ; each digit is four bits. */
export function hexFieldToBits(text: string, width: number): Bits {
  let bits = "";
  for (const ch of text) {
    if (ch === "_") continue;
    if (ch === "x" || ch === "X") bits += "xxxx";
    else if (ch === "z" || ch === "Z" || ch === "?") bits += "zzzz";
    else if (HEX_DIGITS.includes(ch)) bits += parseInt(ch, 16).toString(2).padStart(4, "0");
    else throw new Error(`"${ch}" is not a hex field character`);
  }
  return resize(bits, width);
}

/** Table 21-7 %d: optional sign and digits/underscores, or a single x, X, z, Z or ?. */
export function decFieldToBits(text: string, width: number): Bits {
  if (/^[xX]$/.test(text)) return allX(width);
  if (/^[zZ?]$/.test(text)) return "z".repeat(width);
  const neg = text.startsWith("-");
  const digits = text.replace(/^[+-]/, "").replace(/_/g, "");
  let v = BigInt(digits === "" ? "0" : digits);
  if (neg) v = -v;
  return BigInt.asUintN(width, v).toString(2).padStart(width, "0");
}

/** §21.2.1.3: one hex digit per 4 bits; all-x group → x, some x → X, all-z → z, some z → Z. */
export function formatHex(bits: Bits): string {
  // Groups are taken from the LSB end; the most significant group may hold fewer than 4 bits.
  const groups: string[] = [];
  for (let end = bits.length; end > 0; end -= 4) groups.unshift(bits.slice(Math.max(0, end - 4), end));
  let out = "";
  for (const g of groups) {
    if (/^x+$/.test(g)) out += "x";
    else if (/^z+$/.test(g)) out += "z";
    else if (g.includes("x")) out += "X";
    else if (g.includes("z")) out += "Z";
    else out += parseInt(g, 2).toString(16);
  }
  return out;
}

/** Chip text: X for an all-unknown value, otherwise the sized hex literal. */
export function chipValue(bits: Bits): string {
  if (/^x+$/.test(bits)) return "X";
  return `${bits.length}'h${formatHex(bits)}`;
}

/** §11.4.3: if any operand bit is x or z, the entire arithmetic result is x. */
export function addBits(a: Bits, b: Bits, width: number): Bits {
  if (/[xz]/.test(a) || /[xz]/.test(b)) return allX(width);
  const sum = BigInt(`0b${a}`) + BigInt(`0b${b}`);
  return BigInt.asUintN(width, sum).toString(2).padStart(width, "0");
}

/** §11.4.5 a !== b: bit-for-bit including x and z; the shorter unsigned operand is zero-extended. */
export function caseNotEqual(a: Bits, b: Bits): boolean {
  const w = Math.max(a.length, b.length);
  return a.padStart(w, "0") !== b.padStart(w, "0");
}

// ---------------------------------------------------------------------------
// Formats and the scan engine (§21.3.4.3)
// ---------------------------------------------------------------------------

export type Directive =
  | { kind: "space" }
  | { kind: "literal"; ch: string }
  | { kind: "conv"; code: "h" | "d"; suppress: boolean; text: string };

export function parseFormat(format: string): Directive[] {
  const out: Directive[] = [];
  let i = 0;
  while (i < format.length) {
    const ch = format[i];
    if (/[ \t\n\f]/.test(ch)) {
      while (i < format.length && /[ \t\n\f]/.test(format[i])) i += 1;
      out.push({ kind: "space" });
      continue;
    }
    if (ch === "%") {
      const m = /^%(\*?)([hHxXdD])/.exec(format.slice(i));
      if (!m) throw new Error(`format "${format.slice(i)}" is outside the model (only %h, %x and %d)`);
      const code = m[2].toLowerCase() === "d" ? "d" : "h";
      out.push({ kind: "conv", code, suppress: m[1] === "*", text: m[0] });
      i += m[0].length;
      continue;
    }
    out.push({ kind: "literal", ch });
    i += 1;
  }
  return out;
}

export interface ScanField {
  start: number;
  end: number;
  text: string;
  dest: string | null;
  bits: Bits | null;
  /** The converted input does not fit in the destination, so only its LSBs were kept (§21.3.4.3). */
  truncated?: boolean;
  /** Width of the destination variable. */
  destWidth?: number;
}

/**
 * §21.3.4.3 "If an argument is too small to hold the converted input, then, in
 * general, the LSBs are transferred": true when keeping the LSBs drops a bit
 * that is not 0. A wide field of leading zeros (003 into 9 bits) still fits.
 * A negative %d field is not flagged; its two's-complement LSBs are the value.
 */
export function fieldOverflows(text: string, code: "h" | "d", width: number): boolean {
  if (code === "h") {
    const raw = rawHexBits(text);
    return raw.length > width && /[^0]/.test(raw.slice(0, raw.length - width));
  }
  if (/^[xXzZ?]$/.test(text) || text.startsWith("-")) return false;
  const digits = text.replace(/^[+]/, "").replace(/_/g, "");
  return digits !== "" && BigInt.asUintN(width, BigInt(digits)) !== BigInt(digits);
}

function rawHexBits(text: string): Bits {
  return hexFieldToBits(text, 4 * text.replace(/_/g, "").length);
}

export type ScanStop = "complete" | "matching-failure" | "input-failure";

export interface ScanResult {
  /** Number of items assigned, or -1 (EOF). */
  code: number;
  start: number;
  end: number;
  fields: ScanField[];
  stop: ScanStop;
  /** Index of the conflicting character left unread after a matching failure. */
  offendingAt: number | null;
  /** This read tried to read past the last character (EOF detected, §21.3.8). */
  eofHit: boolean;
  /** A white-space directive inside the call (after its first field) skipped a newline. */
  crossedNewline: boolean;
  /** Which directive failed, counted from 0. */
  failedDirective: number | null;
  /** The failed directive in words: "conversion 3 (%h)" or "the literal ','". */
  failedWhat: string | null;
  assigned: Record<string, Bits>;
}

function isWhite(ch: string, nullIsWhite: boolean): boolean {
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\f" || (nullIsWhite && ch === "\0");
}

/**
 * One $fscanf / $sscanf call on `text` starting at `pos`. `dests` receive the
 * non-suppressed conversions in order (§21.3.4.3).
 */
export function scan(text: string, pos: number, format: string, dests: VarDecl[], opts: { sscanf?: boolean } = {}): ScanResult {
  const directives = parseFormat(format);
  const nullWhite = Boolean(opts.sscanf);
  const start = pos;
  let p = pos;
  let eofHit = false;
  let count = 0;
  let converted = false;
  let crossedNewline = false;
  let destIndex = 0;
  const fields: ScanField[] = [];
  const assigned: Record<string, Bits> = {};

  const describe = (d: number | null): string | null => {
    if (d === null) return null;
    const dir = directives[d];
    if (dir.kind === "literal") return `the literal "${dir.ch}"`;
    if (dir.kind === "conv") return `conversion ${directives.slice(0, d + 1).filter((x) => x.kind === "conv").length} (${dir.text})`;
    return "white space";
  };
  const finish = (stop: ScanStop, offendingAt: number | null, failedDirective: number | null): ScanResult => ({
    code: stop === "input-failure" && !converted ? -1 : count,
    start,
    end: p,
    fields,
    stop,
    offendingAt,
    eofHit,
    crossedNewline,
    failedDirective,
    failedWhat: describe(failedDirective),
    assigned,
  });

  for (let d = 0; d < directives.length; d += 1) {
    const dir = directives[d];
    if (dir.kind === "space") {
      while (p < text.length && isWhite(text[p], nullWhite)) {
        if (text[p] === "\n" && fields.length > 0) crossedNewline = true;
        p += 1;
      }
      if (p >= text.length) eofHit = true;
      continue;
    }
    if (dir.kind === "literal") {
      if (p >= text.length) {
        eofHit = true;
        return finish("input-failure", null, d);
      }
      if (text[p] !== dir.ch) return finish("matching-failure", p, d);
      p += 1;
      continue;
    }
    // Conversion: leading white space is ignored.
    while (p < text.length && isWhite(text[p], nullWhite)) {
      if (text[p] === "\n" && fields.length > 0) crossedNewline = true;
      p += 1;
    }
    if (p >= text.length) {
      eofHit = true;
      return finish("input-failure", null, d);
    }
    const fieldStart = p;
    if (dir.code === "h") {
      while (p < text.length && HEX_FIELD.test(text[p])) p += 1;
    } else if (/[xXzZ?]/.test(text[p])) {
      p += 1;
    } else {
      let q = p;
      if (text[q] === "+" || text[q] === "-") q += 1;
      let r = q;
      while (r < text.length && /[0-9_]/.test(text[r])) r += 1;
      if (r > q) p = r;
    }
    if (p >= text.length) eofHit = true;
    if (p === fieldStart) return finish("matching-failure", p, d);
    const fieldText = text.slice(fieldStart, p);
    converted = true;
    if (dir.suppress) {
      fields.push({ start: fieldStart, end: p, text: fieldText, dest: null, bits: null });
      continue;
    }
    const dest = dests[destIndex];
    destIndex += 1;
    if (!dest) throw new Error("insufficient arguments for the format: undefined behaviour (§21.3.4.3), outside the model");
    const bits = dir.code === "h" ? hexFieldToBits(fieldText, dest.width) : decFieldToBits(fieldText, dest.width);
    assigned[dest.name] = bits;
    fields.push({ start: fieldStart, end: p, text: fieldText, dest: dest.name, bits, destWidth: dest.width, truncated: fieldOverflows(fieldText, dir.code, dest.width) });
    count += 1;
  }
  return finish("complete", null, null);
}

/** §21.3.4.2 $fgets into a string variable: up to and including a newline, or to EOF. */
export function fgets(text: string, pos: number): { code: number; line: string; start: number; end: number; eofHit: boolean } {
  let p = pos;
  while (p < text.length && text[p] !== "\n") p += 1;
  let eofHit = false;
  if (p < text.length) p += 1;
  else eofHit = true;
  return { code: p - pos, line: text.slice(pos, p), start: pos, end: p, eofHit };
}

/** Visible form of input characters: space as ␠, newline as ⏎. */
export function visibleText(s: string): string {
  return s.replace(/ /g, "␠").replace(/\n/g, "⏎").replace(/\t/g, "⇥");
}

export function countConversions(format: string): number {
  return parseFormat(format).filter((d) => d.kind === "conv" && !d.suppress).length;
}

/** The §21.3.4.3 sentence for one scan result. */
export function explainScan(r: ScanResult, text: string, fn: "$fscanf" | "$sscanf", n: number): string {
  return explainScanCore(r, text, fn, n) + truncationNote(r);
}

/** §21.3.4.3: a destination too small for the converted input keeps, in general, its LSBs. */
export function truncationNote(r: ScanResult): string {
  return r.fields
    .filter((f) => f.truncated && f.dest !== null && f.bits !== null)
    .map((f) => ` The field "${f.text}" is too wide for the ${f.destWidth}-bit ${f.dest}, so only its LSBs are kept: ${f.dest} = ${chipValue(f.bits as Bits)} (§21.3.4.3).`)
    .join("");
}

function explainScanCore(r: ScanResult, text: string, fn: "$fscanf" | "$sscanf", n: number): string {
  const src = fn === "$sscanf" ? "the string" : "the file";
  if (r.code === -1) {
    return `${r.start < r.end ? "White space was skipped, then " : ""}${src} ended before the first conversion, so ${fn} returned EOF (-1) and assigned nothing (§21.3.4.3).`;
  }
  if (r.stop === "matching-failure") {
    const ch = visibleText(text[r.offendingAt as number]);
    return `"${ch}" does not match ${r.failedWhat}, so that directive fails; "${ch}" is left unread and ${fn} returned the ${r.code} item${r.code === 1 ? "" : "s"} it assigned${r.code === 0 ? ", which is 0 on an early mismatch" : ""} (§21.3.4.3).`;
  }
  if (r.stop === "input-failure") {
    return `${src[0].toUpperCase()}${src.slice(1)} ended after ${r.code} of ${n} fields. -1 is only for input that ends before the first conversion, so ${fn} returned ${r.code} (§21.3.4.3).`;
  }
  const cross = r.crossedNewline ? " A white-space directive skipped a newline, so a field came from the next line." : "";
  const trailing = r.end < text.length && isWhite(text[r.end], fn === "$sscanf") ? " Trailing white space, the newline included, stays unread." : "";
  return `All ${n} conversions matched and were assigned, so ${fn} returned ${r.code} (§21.3.4.3).${cross}${trailing}`;
}

// ---------------------------------------------------------------------------
// Cursor mode: files and read loops
// ---------------------------------------------------------------------------

export type CursorFileId = "in-txt" | "vectors" | "garbled" | "short-line" | "empty" | "missing";
export type CursorLoop = "forever-break" | "while-feof" | "fgets-sscanf";

export interface CursorFile {
  id: CursorFileId;
  name: string;
  /** null: the file does not exist. */
  contents: string | null;
  format: string;
  vars: VarDecl[];
  note: string;
}

const VECTORS = "01 02 003\nff 01 100\n80 80 100\n7f 01 080\n";
const VECTORS_BAD = "01 02 003\nff 01 000\n80 80 100\n7f 01 080\n";
const VECTORS_GARBLED = "01 02 003\nff 01 g00\n80 80 100\n7f 01 080\n";
const VECTOR_VARS: VarDecl[] = [
  { name: "a_v", width: 8 },
  { name: "b_v", width: 8 },
  { name: "exp_v", width: 9 },
];

export const CURSOR_FILES: CursorFile[] = [
  { id: "in-txt", name: "in.txt", contents: "0a 05\nff 01\n", format: "%h %h", vars: [{ name: "x", width: 8 }, { name: "y", width: 8 }], note: "two lines, each ending in a newline" },
  { id: "vectors", name: "vectors.txt", contents: VECTORS, format: "%h %h %h", vars: VECTOR_VARS, note: "four clean vectors" },
  { id: "garbled", name: "vectors_garbled.txt", contents: VECTORS_GARBLED, format: "%h %h %h", vars: VECTOR_VARS, note: "line 2 holds g00, which is not hex" },
  { id: "short-line", name: "vectors_short.txt", contents: "01 02\nff 01 100\n80 80 100\n", format: "%h %h %h", vars: VECTOR_VARS, note: "line 1 has only two fields" },
  { id: "empty", name: "empty.txt", contents: "", format: "%h %h %h", vars: VECTOR_VARS, note: "zero bytes" },
  { id: "missing", name: "nope.txt", contents: null, format: "%h %h %h", vars: VECTOR_VARS, note: "does not exist" },
];

export function cursorFile(id: CursorFileId): CursorFile {
  const f = CURSOR_FILES.find((x) => x.id === id);
  if (!f) throw new Error(`unknown file ${id}`);
  return f;
}

export const CURSOR_LOOPS: { id: CursorLoop; label: string }[] = [
  { id: "forever-break", label: "forever + break on code" },
  { id: "while-feof", label: "while (!$feof) + void'" },
  { id: "fgets-sscanf", label: "$fgets + $sscanf" },
];

export interface CodeLine {
  key?: string;
  text: string;
}

/** Source generated from the scenario; every executed step names one of these keys. */
export function cursorSource(file: CursorFile, loop: CursorLoop): CodeLine[] {
  const n = countConversions(file.format);
  const names = file.vars.map((v) => v.name).join(", ");
  const decls = groupDecls(file.vars);
  const fmtArgs = file.vars.map(() => "%h").join(" ");
  const display = `    $display("check %0d: ${fmtArgs}", n_checked, ${names});`;
  const head: CodeLine[] = [
    ...decls.map((t) => ({ key: "decl", text: t })),
    { key: "decl", text: loop === "fgets-sscanf" ? "int fd, code, n_checked, line_no;  string line;" : "int fd, code, n_checked;" },
    { key: "fopen", text: `fd = $fopen("${file.name}", "r");` },
    { key: "fatal", text: `if (fd == 0) $fatal(1, "cannot open ${file.name}");` },
  ];
  const tail: CodeLine[] = [{ key: "fclose", text: "$fclose(fd);" }];
  if (loop === "forever-break") {
    return [
      ...head,
      { key: "loop", text: "forever begin" },
      { key: "read", text: `  code = $fscanf(fd, "${file.format}", ${names});` },
      { key: "break", text: `  if (code != ${n}) break;` },
      { key: "count", text: "  n_checked++;" },
      { key: "check", text: display.replace(/^ {4}/, "  ") },
      { key: "end", text: "end" },
      ...tail,
    ];
  }
  if (loop === "while-feof") {
    return [
      ...head,
      { key: "feof", text: "while (!$feof(fd)) begin" },
      { key: "read", text: `  void'($fscanf(fd, "${file.format}", ${names}));` },
      { key: "count", text: "  n_checked++;" },
      { key: "check", text: display.replace(/^ {4}/, "  ") },
      { key: "end", text: "end" },
      ...tail,
    ];
  }
  return [
    ...head,
    { key: "fgets", text: "while ($fgets(line, fd) != 0) begin" },
    { key: "line-no", text: "  line_no++;" },
    { key: "sscanf", text: `  code = $sscanf(line, "${file.format}", ${names});` },
    { key: "bad", text: `  if (code != ${n}) begin` },
    { key: "bad", text: `    $display("line %0d: %0d of ${n} fields", line_no, code);` },
    { key: "bad", text: "    continue;" },
    { key: "bad", text: "  end" },
    { key: "count", text: "  n_checked++;" },
    { key: "check", text: display.replace(/^ {4}/, "  ") },
    { key: "end", text: "end" },
    ...tail,
  ];
}

function groupDecls(vars: VarDecl[]): string[] {
  const byWidth = new Map<number, string[]>();
  for (const v of vars) byWidth.set(v.width, [...(byWidth.get(v.width) ?? []), v.name]);
  return [...byWidth.entries()].map(([w, names]) => `logic [${w - 1}:0] ${names.join(", ")};`);
}

export type CursorStepKind = "start" | "fopen" | "fatal" | "read" | "break" | "check" | "feof" | "fgets" | "sscanf" | "bad" | "fclose" | "endless";

export interface CursorStep {
  kind: CursorStepKind;
  codeKey: string;
  what: string;
  why: string;
  /** Read cursor on the file tape after this step. */
  pos: number;
  /** File characters this step consumed. */
  consumed: [number, number] | null;
  /** All file characters consumed so far. */
  consumedUpTo: number;
  offendingAt: number | null;
  /** Return value shown on the chip, as text ("2", "-1", "0", "nonzero", "fd ≠ 0"). */
  returns: string | null;
  values: Record<string, Bits>;
  changed: string[];
  /** $feof would return nonzero now. */
  eof: boolean;
  log: string[];
  /** fgets-sscanf: the current line buffer and what $sscanf consumed in it. */
  line?: string;
  lineConsumed?: [number, number] | null;
  lineOffendingAt?: number | null;
  /** A check that used values the read before it did not assign. */
  stale?: boolean;
}

export type CheckOutcome = { kind: "count"; n: number } | { kind: "endless"; afterChecks: number } | { kind: "fatal" };

export interface CursorRun {
  file: CursorFile;
  loop: CursorLoop;
  source: CodeLine[];
  steps: CursorStep[];
  outcome: CheckOutcome;
  checks: number;
  staleChecks: number;
  /** Return codes of every $fscanf / $sscanf call, in order. */
  readCodes: number[];
  summary: string;
}

const MAX_ITERATIONS = 40;

export function runCursor(fileId: CursorFileId, loop: CursorLoop): CursorRun {
  const file = cursorFile(fileId);
  const source = cursorSource(file, loop);
  const n = countConversions(file.format);
  const steps: CursorStep[] = [];
  const values: Record<string, Bits> = Object.fromEntries(file.vars.map((v) => [v.name, allX(v.width)]));
  const log: string[] = [];
  let pos = 0;
  let consumedUpTo = 0;
  let eof = false;
  let checks = 0;
  let staleChecks = 0;
  const readCodes: number[] = [];
  let lastReadAssignedAll = false;
  let lastRead: { code: number; assigned: string[] } | null = null;
  let line: string | undefined;
  let lineNo = 0;

  const push = (s: Omit<CursorStep, "pos" | "values" | "eof" | "log" | "consumedUpTo">) =>
    steps.push({ ...s, pos, consumedUpTo, values: { ...values }, eof, log: [...log] });

  push({
    kind: "start",
    codeKey: "decl",
    what: `${file.vars.map((v) => v.name).join(" and ")} start as X: a logic variable that nothing has assigned holds X.`,
    why: `${file.name}: ${file.note}.`,
    consumed: null,
    offendingAt: null,
    returns: null,
    changed: [],
  });

  if (file.contents === null) {
    push({ kind: "fopen", codeKey: "fopen", what: `$fopen("${file.name}", "r") returned 0.`, why: "The file does not exist, so it cannot be opened for reading and $fopen returns 0 (§21.3.1).", consumed: null, offendingAt: null, returns: "0", changed: [] });
    log.push(`<Fatal prefix, 0 ns> cannot open ${file.name}`);
    push({ kind: "fatal", codeKey: "fatal", what: "fd is 0, so $fatal prints its message and ends the run.", why: "$fatal implies $finish (§20.10): no read runs and no check runs.", consumed: null, offendingAt: null, returns: null, changed: [] });
    return finishCursor(file, loop, source, steps, { kind: "fatal" }, 0, 0, readCodes);
  }
  const text = file.contents;
  push({ kind: "fopen", codeKey: "fopen", what: `$fopen("${file.name}", "r") returned a nonzero descriptor.`, why: "The file exists, so $fopen returns a file descriptor; only a failure returns 0 (§21.3.1). The cursor starts at the first character.", consumed: null, offendingAt: null, returns: "fd ≠ 0", changed: [] });

  const doCheck = (stale: boolean) => {
    checks += 1;
    if (stale) staleChecks += 1;
    const leftOver = file.vars.filter((v) => !lastRead?.assigned.includes(v.name));
    log.push(`check ${checks}: ${file.vars.map((v) => formatHex(values[v.name])).join(" ")}`);
    push({
      kind: "check",
      codeKey: "check",
      what: `Check ${checks} uses ${file.vars.map((v) => `${v.name}=${chipValue(values[v.name])}`).join(", ")}.`,
      why: stale ? staleWhy(lastRead, leftOver, values, n) : "Every value was assigned by the read just before this check.",
      consumed: null,
      offendingAt: null,
      returns: null,
      changed: [],
      stale,
    });
  };

  const doRead = (codeKey: string, fn: "$fscanf" | "$sscanf") => {
    const src = fn === "$sscanf" ? (line as string) : text;
    const from = fn === "$sscanf" ? 0 : pos;
    const r = scan(src, from, file.format, file.vars, { sscanf: fn === "$sscanf" });
    const changed: string[] = [];
    for (const [name, bits] of Object.entries(r.assigned)) {
      if (values[name] !== bits) changed.push(name);
      values[name] = bits;
    }
    readCodes.push(r.code);
    lastReadAssignedAll = Object.keys(r.assigned).length === n;
    lastRead = { code: r.code, assigned: Object.keys(r.assigned) };
    if (fn === "$fscanf") {
      pos = r.end;
      consumedUpTo = Math.max(consumedUpTo, r.end);
      if (r.eofHit) eof = true;
    }
    const consumedText = visibleText(src.slice(r.start, r.end));
    push({
      kind: fn === "$sscanf" ? "sscanf" : "read",
      codeKey,
      what: `${fn} ${r.end > r.start ? `consumed "${consumedText}"` : "consumed nothing"} and returned ${r.code}.${changed.length === 0 ? " No variable changed." : ""}`,
      why: explainScan(r, src, fn, n),
      consumed: fn === "$fscanf" ? [r.start, r.end] : null,
      offendingAt: fn === "$fscanf" ? r.offendingAt : null,
      returns: String(r.code),
      changed,
      line: fn === "$sscanf" ? line : undefined,
      lineConsumed: fn === "$sscanf" ? [r.start, r.end] : undefined,
      lineOffendingAt: fn === "$sscanf" ? r.offendingAt : undefined,
    });
    return r;
  };

  const closeStep = () =>
    push({ kind: "fclose", codeKey: "fclose", what: "$fclose(fd) closes the file.", why: "The loop has ended; closing releases the descriptor (§21.3.1).", consumed: null, offendingAt: null, returns: null, changed: [] });

  if (loop === "forever-break") {
    for (let it = 0; it < MAX_ITERATIONS; it += 1) {
      const r = doRead("read", "$fscanf");
      if (r.code !== n) {
        push({ kind: "break", codeKey: "break", what: `code is ${r.code}, not ${n}, so the loop breaks.`, why: r.code === -1 ? "-1 means the input ended before the first conversion: the normal end of the file." : `${r.code} of ${n} fields means bad input; the loop stops before using half-read values.`, consumed: null, offendingAt: null, returns: null, changed: [] });
        break;
      }
      doCheck(false);
    }
    closeStep();
    return finishCursor(file, loop, source, steps, { kind: "count", n: checks }, checks, staleChecks, readCodes);
  }

  if (loop === "while-feof") {
    let lastSig = "";
    for (let it = 0; it < MAX_ITERATIONS; it += 1) {
      push({
        kind: "feof",
        codeKey: "feof",
        what: `$feof(fd) returns ${eof ? "nonzero" : "0"}, so the loop ${eof ? "ends" : "runs again"}.`,
        why: eof
          ? "A read has already hit the end of the file, so $feof is now nonzero (§21.3.8)."
          : pos >= text.length
            ? "The cursor is at the end, but no read has tried to read past it yet, so $feof is still 0 (§21.3.8)."
            : `No read has hit the end yet (the next unread character is "${visibleText(text[pos])}"), so $feof returns 0 (§21.3.8).`,
        consumed: null,
        offendingAt: null,
        returns: eof ? "nonzero" : "0",
        changed: [],
      });
      if (eof) break;
      const sig = `${pos}|${JSON.stringify(values)}`;
      if (sig === lastSig) {
        push({
          kind: "endless",
          codeKey: "feof",
          what: "This iteration starts exactly like the previous one: same cursor, same values, $feof still 0.",
          why: `The read cannot get past "${visibleText(text[pos])}", so $feof never turns nonzero and the loop never ends. The model stops here; a simulator would spin until it is killed.`,
          consumed: null,
          offendingAt: pos,
          returns: null,
          changed: [],
        });
        return finishCursor(file, loop, source, steps, { kind: "endless", afterChecks: checks }, checks, staleChecks, readCodes);
      }
      lastSig = sig;
      doRead("read", "$fscanf");
      doCheck(!lastReadAssignedAll);
    }
    closeStep();
    return finishCursor(file, loop, source, steps, { kind: "count", n: checks }, checks, staleChecks, readCodes);
  }

  // fgets + sscanf
  for (let it = 0; it < MAX_ITERATIONS; it += 1) {
    const g = fgets(text, pos);
    pos = g.end;
    consumedUpTo = Math.max(consumedUpTo, g.end);
    if (g.eofHit) eof = true;
    if (g.code > 0) line = g.line;
    push({
      kind: "fgets",
      codeKey: "fgets",
      what: g.code > 0 ? `$fgets read "${visibleText(g.line)}" and returned ${g.code}.` : "$fgets read nothing and returned 0, so the loop ends.",
      why: g.code > 0 ? "It reads up to and including the newline (§21.3.4.2), so the next call starts on the next line." : "At the end of the file there is nothing to read, so $fgets returns 0, the number of characters it read (§21.3.4.2). 0 is also what an error returns; $ferror (§21.3.7) tells the two apart.",
      consumed: [g.start, g.end],
      offendingAt: null,
      returns: String(g.code),
      changed: [],
      line,
    });
    if (g.code === 0) break;
    lineNo += 1;
    const r = doRead("sscanf", "$sscanf");
    if (r.code !== n) {
      log.push(`line ${lineNo}: ${r.code} of ${n} fields`);
      push({ kind: "bad", codeKey: "bad", what: `Line ${lineNo} gave ${r.code} of ${n} fields: reported, then the loop continues.`, why: "$sscanf saw only this line, so a short or garbled line cannot borrow fields from the next one; the next $fgets starts cleanly.", consumed: null, offendingAt: null, returns: null, changed: [], line });
      continue;
    }
    doCheck(false);
  }
  closeStep();
  return finishCursor(file, loop, source, steps, { kind: "count", n: checks }, checks, staleChecks, readCodes);
}

/**
 * Why a check is stale, naming only what the read before it left unassigned.
 * §21.3.4.3: the return value counts the items that were assigned, so a read
 * that returns 2 of 3 did assign two fields.
 */
function staleWhy(lastRead: { code: number; assigned: string[] } | null, leftOver: VarDecl[], values: Record<string, Bits>, n: number): string {
  const holds = (v: VarDecl) => (/^x+$/.test(values[v.name]) ? `${v.name} is still X` : `${v.name} still holds ${chipValue(values[v.name])}`);
  if (!lastRead || lastRead.assigned.length === 0) {
    const ret = lastRead ? ` (it returned ${lastRead.code})` : "";
    return `None of these values was assigned by the read just before this check${ret}: they are left over from an earlier read or still X, so this check is a stale repeat.`;
  }
  const names = leftOver.map((v) => v.name);
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `${list} ${names.length === 1 ? "was" : "were"} not assigned by the read just before this check (it returned ${lastRead.code} of ${n}): ${leftOver.map(holds).join(", ")}, left over from before. ${lastRead.assigned.join(" and ")} ${lastRead.assigned.length === 1 ? "is" : "are"} fresh, so this check mixes new and old values.`;
}

function finishCursor(
  file: CursorFile,
  loop: CursorLoop,
  source: CodeLine[],
  steps: CursorStep[],
  outcome: CheckOutcome,
  checks: number,
  staleChecks: number,
  readCodes: number[],
): CursorRun {
  return { file, loop, source, steps, outcome, checks, staleChecks, readCodes, summary: summarizeCursor(outcome, readCodes, staleChecks) };
}

export function outcomeText(o: CheckOutcome): string {
  if (o.kind === "fatal") return "No checks: $fatal ends the run before any read";
  if (o.kind === "endless") return "The loop never ends";
  return `${o.n} check${o.n === 1 ? "" : "s"}`;
}

function summarizeCursor(outcome: CheckOutcome, codes: number[], stale: number): string {
  if (outcome.kind === "fatal") return "$fopen returned 0 and $fatal ended the run, so nothing was read or checked.";
  const seq = codes.length ? `The reads returned ${codes.join(", ")}` : "No read ran";
  const staleText = stale > 0 ? ` ${stale} of the checks used at least one value the read before it did not assign.` : "";
  if (outcome.kind === "endless") return `${seq}, then the same 0 forever; ${outcome.afterChecks} checks ran before the loop started repeating itself.${staleText}`;
  return `${seq}; ${outcome.n} check${outcome.n === 1 ? "" : "s"} ran.${staleText}`;
}

/** Prediction options for "how many checks run?". */
export function checkOutcomeOptions(run: CursorRun): { id: string; label: string; correct: boolean; feedback: string }[] {
  const lines = run.file.contents === null ? 0 : run.file.contents.split("\n").filter((l) => l.length > 0).length;
  const candidates: CheckOutcome[] = [];
  // With a missing file the $fatal option is the "no checks" answer; a separate "0 checks" would be a second right answer.
  for (let k = run.outcome.kind === "fatal" ? 1 : 0; k <= Math.max(lines + 1, 2); k += 1) candidates.push({ kind: "count", n: k });
  candidates.push({ kind: "endless", afterChecks: 0 }, { kind: "fatal" });
  const same = (a: CheckOutcome, b: CheckOutcome) => a.kind === b.kind && (a.kind !== "count" || a.n === (b as { n: number }).n);
  return candidates.map((c, i) => {
    const correct = same(c, run.outcome);
    let feedback = run.summary;
    if (!correct) {
      if (c.kind === "fatal") feedback = `$fatal runs only when $fopen returns 0; ${run.file.name} opens. ${run.summary}`;
      else if (c.kind === "endless") feedback = `A loop spins forever only when a read makes no progress and $feof stays 0. ${run.summary}`;
      else if (run.loop === "while-feof" && run.outcome.kind === "count" && c.n === run.outcome.n - 1 && run.file.contents === "") feedback = `Before the first read $feof is 0, because no read has hit the end yet (§21.3.8), so the body runs once on X values. ${run.summary}`;
      else if (run.loop === "while-feof" && run.outcome.kind === "count" && c.n === run.outcome.n - 1) feedback = `${feofOneShortFeedback(run)} ${run.summary}`;
      else if (run.outcome.kind === "fatal") feedback = `${run.file.name} does not exist, so $fopen returns 0 (§21.3.1) and the run ends at $fatal. ${run.summary}`;
      else feedback = `Count the reads and their return codes. ${run.summary}`;
    }
    return { id: `o${i}`, label: outcomeText(c), correct, feedback };
  });
}

/**
 * while (!$feof): why the check count is not one fewer. Two different files reach it:
 * - the last read returns -1 after a read that assigned every field (in.txt, vectors.txt):
 *   only the final newline was left unread, so $feof was still 0;
 * - the last read assigned some fields and then hit the end (vectors_short.txt): input
 *   was still unread after the previous read, so this read ran and its check ran too.
 */
export function feofOneShortFeedback(run: CursorRun): string {
  const n = countConversions(run.file.format);
  const reads = run.steps.filter((s) => s.kind === "read");
  const codes = run.readCodes;
  const k = codes.length;
  const text = run.file.contents ?? "";
  const before = reads[k - 2];
  const unread = before ? text.slice(before.pos) : text;
  if (codes[k - 1] === -1 && codes[k - 2] === n && /^\s*\n$/.test(unread)) {
    return `That would be right if $feof turned nonzero right after the last good read, but the final newline is still unread then (§21.3.8), so read ${k} runs, returns -1 and assigns nothing, and the check after it reuses the old values.`;
  }
  if (codes[k - 1] >= 0 && codes[k - 1] < n) {
    return `That would be right if $feof turned nonzero after read ${k - 1}, but "${visibleText(unread)}" is still unread then, so $feof is 0 (§21.3.8) and read ${k} runs. It assigns ${codes[k - 1]} of ${n} fields and reaches the end of the file looking for the next one, which sets EOF; it returns ${codes[k - 1]}, not -1 (§21.3.4.3), and the check after it still runs.`;
  }
  return `$feof turns nonzero only after a read has reached the end of the file (§21.3.8); count the reads that run before that happens.`;
}

/** Prediction options for "does a check reuse values its read did not assign?". */
export function staleOptions(run: CursorRun): { id: string; label: string; correct: boolean; feedback: string }[] {
  const yes = run.staleChecks > 0;
  const why = yes
    ? `Yes: ${run.staleChecks} check${run.staleChecks === 1 ? "" : "s"} used left-over values. The loop never looks at the return code, so it uses the variables even when the read assigned fewer than all of them (or none) (§21.3.4.3).`
    : run.outcome.kind === "fatal"
      ? "No: the run ends at $fatal, so no check runs at all."
      : "No: every check runs only after a read that assigned all of its fields.";
  return [
    { id: "yes", label: "Yes: some check reuses values (for example the last vector twice)", correct: yes, feedback: why },
    { id: "no", label: "No: every check uses freshly read values", correct: !yes, feedback: why },
  ];
}

/** Options for "what will the next call return?" at a call step. */
export function nextReturnChoices(step: CursorStep, n: number): string[] {
  if (step.kind === "read" || step.kind === "sscanf") return ["-1", ...Array.from({ length: n + 1 }, (_, i) => String(i))];
  if (step.kind === "feof") return ["0", "nonzero"];
  if (step.kind === "fgets") return ["0", "a count > 0"];
  if (step.kind === "fopen") return ["0", "fd ≠ 0"];
  return [];
}

export function returnMatches(step: CursorStep, choice: string): boolean {
  if (step.kind === "fgets") return choice === "0" ? step.returns === "0" : step.returns !== "0";
  return choice === step.returns;
}

/** Plain-language description of the tape for screen readers. */
export function describeTape(name: string, text: string, step: Pick<CursorStep, "pos" | "consumed" | "offendingAt" | "eof">): string {
  const at = step.pos >= text.length ? "at the end of the file" : `before "${visibleText(text[step.pos])}" (character ${step.pos + 1} of ${text.length})`;
  const took = step.consumed && step.consumed[1] > step.consumed[0] ? ` This call consumed "${visibleText(text.slice(step.consumed[0], step.consumed[1]))}".` : "";
  const off = step.offendingAt !== null && step.offendingAt < text.length ? ` "${visibleText(text[step.offendingAt])}" is left unread.` : "";
  return `${name}, ${text.length} characters. Read cursor ${at}.${took}${off} $feof is ${step.eof ? "nonzero" : "0"}.`;
}

/** Screen-reader description of the $fgets line buffer: a string, so no read cursor and no $feof. */
export function describeLineTape(text: string, consumed: [number, number] | null, offendingAt: number | null): string {
  const took = consumed && consumed[1] > consumed[0] ? ` This $sscanf call consumed "${visibleText(text.slice(consumed[0], consumed[1]))}".` : "";
  const off = offendingAt !== null && offendingAt < text.length ? ` "${visibleText(text[offendingAt])}" is left unread.` : "";
  return `line, ${text.length} characters: the string $sscanf parses, "${visibleText(text)}".${took}${off}`;
}

// ---------------------------------------------------------------------------
// Bench mode: the plusarg-selected, file-driven adder bench
// ---------------------------------------------------------------------------

export const BENCH_FILES: Record<string, string | null> = {
  "vectors.txt": VECTORS,
  "vectors_bad.txt": VECTORS_BAD,
  "vectors_garbled.txt": VECTORS_GARBLED,
  "empty.txt": "",
  "nope.txt": null,
  "vectros.txt": null,
};

export type BenchFileName = "vectors.txt" | "vectors_bad.txt" | "vectors_garbled.txt" | "nope.txt" | "empty.txt";
export const BENCH_FILE_CHOICES: { name: BenchFileName; note: string }[] = [
  { name: "vectors.txt", note: "clean" },
  { name: "vectors_bad.txt", note: "line 2 expects the wrong sum" },
  { name: "vectors_garbled.txt", note: "line 2 holds g00" },
  { name: "nope.txt", note: "missing" },
  { name: "empty.txt", note: "zero bytes" },
];

export interface BenchConfig {
  /** The +VECTORS value; the file system is BENCH_FILES unless `contents` overrides it. */
  file: string;
  contents?: string | null;
  dump: boolean;
  /** Emit and run the +DUMP / $dumpvars lines. */
  dumpSupport: boolean;
  fopenCheck: boolean;
  loop: "forever-break" | "while-eq" | "while-feof";
  /** while-feof only: wrap the read in void'(...) rather than assigning code. */
  castVoid: boolean;
  failCounter: boolean;
  passInElse: boolean;
  badInputCheck: boolean;
  emptyCheck: boolean;
  echo: boolean;
  failAction: "error" | "fatal";
  compare: "!==" | "!=";
}

/** The worked example exactly as the lesson writes it. */
export const GUARDED_BENCH: BenchConfig = {
  file: "vectors.txt",
  dump: false,
  dumpSupport: true,
  fopenCheck: true,
  loop: "forever-break",
  castVoid: false,
  failCounter: true,
  passInElse: true,
  badInputCheck: true,
  emptyCheck: true,
  echo: false,
  failAction: "error",
  compare: "!==",
};

export type DiagramEdgeId = "cli" | "vec" | "dut" | "log" | "vcd";

export interface BenchVars {
  vec_file: string;
  dump: string;
  fd: string;
  code: string;
  a_v: Bits;
  b_v: Bits;
  exp_v: Bits;
  sum: Bits;
  n_pass: number;
  n_fail: number;
}

export interface BenchStep {
  codeKey: string;
  timeNs: number;
  what: string;
  why: string;
  edge: DiagramEdgeId | null;
  returns: string | null;
  vars: BenchVars;
  changed: (keyof BenchVars)[];
  log: string[];
  /** Cursor on the vector file after this step (null when no file is open). */
  pos: number | null;
  consumed: [number, number] | null;
  offendingAt: number | null;
  /** $feof(fd) would return nonzero now (§21.3.8). */
  eof: boolean;
}

export interface BenchRun {
  config: BenchConfig;
  cmdline: string[];
  source: CodeLine[];
  steps: BenchStep[];
  log: string[];
  summary: string | null;
  endedBy: "finish" | "fatal";
  endTimeNs: number;
  nPass: number;
  nFail: number;
  checks: number;
  errors: number;
  fileText: string | null;
  story: string;
}

export function formatNs(ns: number): string {
  // $timeformat(-9, 0, " ns", 6): nanoseconds, no fraction, minimum field width 6 (§20.4.3 sets the width rule).
  return `${ns} ns`.padStart(6, " ");
}

export function benchCmdline(config: Pick<BenchConfig, "file" | "dump" | "dumpSupport">): string[] {
  return [`+VECTORS=${config.file}`, ...(config.dump && config.dumpSupport ? ["+DUMP"] : [])];
}

export function benchSource(c: BenchConfig): CodeLine[] {
  const L: CodeLine[] = [];
  const add = (key: string | undefined, text: string) => L.push({ key, text });
  add("decl", "initial begin");
  add("decl", "  string vec_file;  bit dump;");
  add("decl", "  int fd, code, line_no, n_pass, n_fail;");
  add("decl", "  logic [7:0] a_v, b_v;  logic [8:0] exp_v;");
  add("timeformat", '  $timeformat(-9, 0, " ns", 6);');
  add("plusarg-vectors", '  if (!$value$plusargs("VECTORS=%s", vec_file)) vec_file = "vectors.txt";');
  if (c.dumpSupport) {
    add("plusarg-dump", '  dump = ($test$plusargs("DUMP") != 0);');
    add("config", '  $display("vectors=%s dump=%0b", vec_file, dump);');
    add("dump", "  if (dump) begin");
    add("dump", '    $dumpfile("waves.vcd");');
    add("dump", "    $dumpvars(0, tb_top);");
    add("dump", "  end");
  } else {
    add("config", '  $display("vectors=%s", vec_file);');
  }
  add("fopen", '  fd = $fopen(vec_file, "r");');
  if (c.fopenCheck) add("fopen-check", '  if (fd == 0) $fatal(1, "cannot open vector file %s", vec_file);');
  const read = '$fscanf(fd, "%h %h %h", a_v, b_v, exp_v)';
  if (c.loop === "forever-break") {
    add("loop", "  forever begin");
    add("fscanf", `    code = ${read};`);
    add("break", "    if (code != 3) break;");
  } else if (c.loop === "while-eq") {
    add("fscanf", `  while (${read} == 3) begin`);
  } else {
    add("feof", "  while (!$feof(fd)) begin");
    add("fscanf", c.castVoid ? `    void'(${read});` : `    code = ${read};`);
  }
  add("line-no", "    line_no++;");
  if (c.echo) add("echo", '    $display("check %0d: %h %h %h", line_no, a_v, b_v, exp_v);');
  add("drive", "    a <= a_v;  b <= b_v;");
  add("settle", "    #1;");
  const errTask = c.failAction === "error" ? "$error(" : "$fatal(1, ";
  const errLine = `${errTask}"vector %0d: %h + %h = %h, expected %h", line_no, a_v, b_v, sum, exp_v);`;
  const cond = `    if (sum ${c.compare} exp_v)`;
  if (c.failCounter) {
    add("compare", `${cond} begin`);
    add("fail-count", "      n_fail++;");
    add("error", `      ${errLine}`);
    add("compare", c.passInElse ? "    end else n_pass++;" : "    end");
  } else {
    add("compare", cond);
    add("error", `      ${errLine}`);
    if (c.passInElse) add("pass", "    else n_pass++;");
  }
  if (!c.passInElse) add("pass", "    n_pass++;");
  add("loop-end", "  end");
  if (c.badInputCheck) {
    add("bad-input", "  if (code != -1) begin");
    add("bad-input", "    n_fail++;");
    add("bad-input", '    $error("vector %0d: unparsable input (%0d of 3 fields)", line_no + 1, code);');
    add("bad-input", "  end");
  }
  add("fclose", "  $fclose(fd);");
  if (c.emptyCheck) {
    add("empty-check", "  if (n_pass + n_fail == 0) begin");
    add("empty-check", "    n_fail++;");
    add("empty-check", '    $error("no vectors in %s: nothing was checked", vec_file);');
    add("empty-check", "  end");
  }
  add("summary", '  $display("[%t] PASS=%0d FAIL=%0d", $realtime, n_pass, n_fail);');
  add("finish", "  $finish;");
  add(undefined, "end");
  return L;
}

export function runBench(config: BenchConfig): BenchRun {
  if (config.badInputCheck && config.loop !== "forever-break") throw new Error("the bad-input check is modelled only after the forever/break loop");
  const cmdline = benchCmdline(config);
  const source = benchSource(config);
  const steps: BenchStep[] = [];
  const log: string[] = [];
  let t = 0;
  let pos: number | null = null;
  let eof = false;
  const v: BenchVars = { vec_file: '""', dump: "0", fd: "0", code: "0", a_v: allX(8), b_v: allX(8), exp_v: allX(9), sum: allX(9), n_pass: 0, n_fail: 0 };
  let a: Bits = allX(8);
  let b: Bits = allX(8);
  let checks = 0;
  let errors = 0;
  let lineNo = 0;
  let fileText: string | null = null;

  const push = (s: { codeKey: string; what: string; why: string; edge: DiagramEdgeId | null; returns?: string | null; changed?: (keyof BenchVars)[]; consumed?: [number, number] | null; offendingAt?: number | null }) =>
    steps.push({
      codeKey: s.codeKey,
      timeNs: t,
      what: s.what,
      why: s.why,
      edge: s.edge,
      returns: s.returns ?? null,
      vars: { ...v },
      changed: s.changed ?? [],
      log: [...log],
      pos,
      consumed: s.consumed ?? null,
      offendingAt: s.offendingAt ?? null,
      eof,
    });

  const end = (endedBy: "finish" | "fatal", summary: string | null): BenchRun => {
    const run: BenchRun = { config, cmdline, source, steps, log: [...log], summary, endedBy, endTimeNs: t, nPass: v.n_pass, nFail: v.n_fail, checks, errors, fileText, story: "" };
    run.story = benchStory(run);
    return run;
  };

  push({ codeKey: "timeformat", what: "$timeformat(-9, 0, \" ns\", 6) sets how %t prints: nanoseconds, no fraction, at least 6 characters.", why: "It runs at time 0, before any %t is printed.", edge: null });

  // Plusargs (§21.6), evaluated by the plusargs model.
  const vr = valuePlusargs(cmdline, "VECTORS=%s", { type: "string", value: "" });
  v.vec_file = vr.returns === 0 ? '"vectors.txt"' : displayPlusargValue(vr.after);
  const fileName = v.vec_file.slice(1, -1);
  push({
    codeKey: "plusarg-vectors",
    what: `$value$plusargs("VECTORS=%s", vec_file) returned ${vr.returns === 0 ? "0" : "nonzero"}; vec_file = ${v.vec_file}.`,
    why: vr.returns === 0 ? "No +VECTORS plusarg, so the default is used." : `"${cmdline[vr.matchIndex as number]}" begins with "VECTORS=", and the remainder is stored as a string (§21.6).`,
    edge: "cli",
    returns: vr.returns === 0 ? "0" : "nonzero",
    changed: ["vec_file"],
  });
  if (config.dumpSupport) {
    const dr = testPlusargs(cmdline, "DUMP");
    v.dump = dr.returns === 0 ? "0" : "1";
    push({ codeKey: "plusarg-dump", what: `$test$plusargs("DUMP") returned ${dr.returns === 0 ? "0" : "nonzero"}, so dump = ${v.dump}.`, why: "Comparing with != 0 turns any nonzero result into 1 (§21.6 promises only nonzero).", edge: "cli", returns: dr.returns === 0 ? "0" : "nonzero", changed: ["dump"] });
    log.push(`vectors=${fileName} dump=${v.dump}`);
  } else {
    log.push(`vectors=${fileName}`);
  }
  push({ codeKey: "config", what: "The bench prints its effective configuration.", why: "A misspelt plusarg would otherwise be ignored in silence; this line makes it visible.", edge: "log" });
  if (config.dumpSupport && v.dump === "1") {
    push({ codeKey: "dump", what: "$dumpfile and $dumpvars start recording waves.vcd.", why: "Only a run with +DUMP records waveforms.", edge: "vcd" });
  }

  const contents = config.contents !== undefined ? config.contents : fileName in BENCH_FILES ? BENCH_FILES[fileName] : null;
  fileText = contents;
  if (contents === null) {
    v.fd = "0";
    push({ codeKey: "fopen", what: `$fopen("${fileName}", "r") returned 0.`, why: "The file does not exist, so it cannot be opened for reading (§21.3.1).", edge: "vec", returns: "0", changed: ["fd"] });
    if (config.fopenCheck) {
      log.push(`<Fatal prefix, ${t} ns> cannot open vector file ${fileName}`);
      push({ codeKey: "fopen-check", what: "fd is 0: $fatal prints its message and ends the run.", why: "$fatal implies $finish (§20.10), so no summary line is ever printed.", edge: "log" });
      return end("fatal", null);
    }
  } else {
    v.fd = "nonzero";
    pos = 0;
    push({ codeKey: "fopen", what: `$fopen("${fileName}", "r") returned a nonzero descriptor.`, why: "Only a failure returns 0 (§21.3.1).", edge: "vec", returns: "fd ≠ 0", changed: ["fd"] });
    if (config.fopenCheck) push({ codeKey: "fopen-check", what: "fd is nonzero, so the run continues.", why: "The check costs one line and turns a missing file into a loud failure.", edge: null });
  }

  const read = (): number => {
    if (contents === null) {
      // Not defined by the standard: a read on descriptor 0.
      v.code = "-1";
      push({ codeKey: "fscanf", what: "$fscanf on descriptor 0 does not return 3 (the model shows -1).", why: "The standard does not define a read on a descriptor that $fopen never returned; tools differ in the code and in whether they print anything. The values stay X.", edge: "vec", returns: "-1", changed: ["code"] });
      return -1;
    }
    const r = scan(contents, pos as number, "%h %h %h", VECTOR_VARS);
    pos = r.end;
    if (r.eofHit) eof = true;
    const changed: (keyof BenchVars)[] = ["code"];
    for (const [name, bits] of Object.entries(r.assigned)) {
      const key = name as "a_v" | "b_v" | "exp_v";
      if (v[key] !== bits) changed.push(key);
      v[key] = bits;
    }
    v.code = String(r.code);
    push({
      codeKey: "fscanf",
      what: `$fscanf ${r.end > r.start ? `consumed "${visibleText(contents.slice(r.start, r.end))}"` : "consumed nothing"} and returned ${r.code}.`,
      why: explainScan(r, contents, "$fscanf", 3),
      edge: "vec",
      returns: String(r.code),
      changed,
      consumed: [r.start, r.end],
      offendingAt: r.offendingAt,
    });
    return r.code;
  };

  const body = (): "continue" | "fatal" => {
    lineNo += 1;
    if (config.echo) log.push(`check ${lineNo}: ${formatHex(v.a_v)} ${formatHex(v.b_v)} ${formatHex(v.exp_v)}`);
    a = v.a_v;
    b = v.b_v;
    push({ codeKey: "drive", what: `Vector ${lineNo}: a <= ${chipValue(a)}, b <= ${chipValue(b)}.`, why: "The bench drives the adder's inputs from the values the read left in a_v and b_v.", edge: "dut" });
    t += 1;
    v.sum = addBits(a, b, 9);
    push({ codeKey: "settle", what: `#1: time is now ${t} ns and sum = ${chipValue(v.sum)}.`, why: "The delay lets the adder's continuous assignment settle before the check.", edge: "dut", changed: ["sum"] });
    checks += 1;
    const loose = config.compare === "!=" ? looseNotEqualValue(v.sum, v.exp_v) : null;
    const mismatch = config.compare === "!==" ? caseNotEqual(v.sum, v.exp_v) : loose === "1";
    if (mismatch) {
      const msg = `vector ${lineNo}: ${formatHex(v.a_v)} + ${formatHex(v.b_v)} = ${formatHex(v.sum)}, expected ${formatHex(v.exp_v)}`;
      if (config.failCounter) v.n_fail += 1;
      if (config.failAction === "fatal") {
        log.push(`<Fatal prefix, ${t} ns> ${msg}`);
        errors += 1;
        push({ codeKey: "error", what: `sum ${config.compare} exp_v is true: $fatal reports vector ${lineNo} and ends the run.`, why: "$fatal implies $finish (§20.10): the remaining vectors are never checked and no summary prints.", edge: "log", changed: config.failCounter ? ["n_fail"] : [] });
        return "fatal";
      }
      log.push(`<Error prefix, ${t} ns> ${msg}`);
      errors += 1;
      push({
        codeKey: config.failCounter ? "fail-count" : "error",
        what: `sum ${config.compare} exp_v is true: ${config.failCounter ? "n_fail++ and " : ""}$error reports vector ${lineNo}.`,
        why: config.failCounter
          ? "$error reports a run-time error and the run goes on; the standard defines no counter that $error updates (§20.10), so n_fail is what the summary reads."
          : "$error reports a run-time error and the run goes on; the standard defines no counter that $error updates, and only $fatal ends the run (§20.10). Nothing here increments n_fail.",
        edge: "log",
        changed: config.failCounter ? ["n_fail"] : [],
      });
      if (!config.passInElse) {
        v.n_pass += 1;
        push({ codeKey: "pass", what: "n_pass++ runs anyway: it is not in an else branch.", why: "The failing vector is now counted as a pass as well.", edge: null, changed: ["n_pass"] });
      }
    } else {
      v.n_pass += 1;
      push({
        // The pass line is keyed "compare" only when it is the "end else n_pass++" of the begin/end form.
        codeKey: config.failCounter && config.passInElse ? "compare" : "pass",
        what: `sum ${config.compare} exp_v is ${loose === "x" ? "x, which the if treats as false" : "false"}: n_pass++ (now ${v.n_pass}).`,
        why:
          loose === null
            ? "!== compares every bit, x and z included (§11.4.5), and they agree."
            : loose === "x"
              ? "!= returned x: the x or z bits make the relation ambiguous (§11.4.5), and an if treats an x condition as false (§12.4), so n_pass++ runs."
              : "!= compares bit for bit (§11.4.5); no bit is x or z and none differs, so it returns 0.",
        edge: null,
        changed: ["n_pass"],
      });
    }
    return "continue";
  };

  let lastCode = 0;
  for (let it = 0; it < MAX_ITERATIONS; it += 1) {
    if (config.loop === "while-feof") {
      const atEof = contents === null ? true : eof;
      push({ codeKey: "feof", what: `$feof(fd) returns ${atEof ? "nonzero" : "0"}.`, why: atEof ? "A read has already hit the end (§21.3.8): the loop ends." : "No read has hit the end yet, so the loop runs again (§21.3.8).", edge: "vec", returns: atEof ? "nonzero" : "0" });
      if (atEof) break;
      read();
      if (body() === "fatal") return end("fatal", null);
      continue;
    }
    lastCode = read();
    if (lastCode !== 3) {
      push({ codeKey: config.loop === "forever-break" ? "break" : "fscanf", what: `code is ${lastCode}, not 3: the loop ends.`, why: lastCode === -1 ? "-1: the input ended before the first conversion." : `${lastCode} of 3 fields: the input is broken here.`, edge: null });
      break;
    }
    if (body() === "fatal") return end("fatal", null);
  }

  if (config.badInputCheck) {
    if (lastCode !== -1) {
      v.n_fail += 1;
      errors += 1;
      log.push(`<Error prefix, ${t} ns> vector ${lineNo + 1}: unparsable input (${lastCode} of 3 fields)`);
      push({ codeKey: "bad-input", what: `code is ${lastCode}, not -1: the read stopped on bad input, so n_fail++ and $error.`, why: "$fscanf cannot resynchronise on a stream, so the bench counts the broken file as a failure.", edge: "log", changed: ["n_fail"] });
    } else {
      push({ codeKey: "bad-input", what: "code is -1: the loop stopped at the end of the file, not on bad input.", why: "Only -1 means a clean end (§21.3.4.3).", edge: null });
    }
  }
  push({ codeKey: "fclose", what: contents === null ? "$fclose(fd) with fd = 0." : "$fclose(fd) closes the file.", why: contents === null ? "There is no open file to close; what a tool does with descriptor 0 is not defined by the standard." : "The descriptor is released (§21.3.1).", edge: "vec" });
  if (config.emptyCheck) {
    if (v.n_pass + v.n_fail === 0) {
      v.n_fail += 1;
      errors += 1;
      log.push(`<Error prefix, ${t} ns> no vectors in ${fileName}: nothing was checked`);
      push({ codeKey: "empty-check", what: "Nothing was checked: n_fail++ and $error.", why: "A run that checked nothing must not pass.", edge: "log", changed: ["n_fail"] });
    } else {
      push({ codeKey: "empty-check", what: `${v.n_pass + v.n_fail} result${v.n_pass + v.n_fail === 1 ? "" : "s"} counted, so the empty-file guard does nothing.`, why: "It fires only when no vector was checked.", edge: null });
    }
  }
  const summary = `[${formatNs(t)}] PASS=${v.n_pass} FAIL=${v.n_fail}`;
  log.push(summary);
  push({ codeKey: "summary", what: `The summary prints the counters: ${summary}.`, why: "The verdict a regression script reads comes only from n_pass and n_fail.", edge: "log" });
  push({ codeKey: "finish", what: `$finish ends the run at ${t} ns.`, why: "$finish ends the simulation (§20.2); the tool adds its own report.", edge: null });
  return end("finish", summary);
}

/**
 * a != b (§11.4.5) as a 4-state result, after zero-extending the shorter unsigned operand.
 * It is 1'b1 when some bit position holds two known values that differ, 1'bx only when the
 * x/z bits make the relation ambiguous, and 1'b0 otherwise.
 */
export function looseNotEqualValue(a: Bits, b: Bits): "0" | "1" | "x" {
  const w = Math.max(a.length, b.length);
  const x = a.padStart(w, "0");
  const y = b.padStart(w, "0");
  let unknown = false;
  for (let i = 0; i < w; i += 1) {
    if (/[xz]/.test(x[i]) || /[xz]/.test(y[i])) unknown = true;
    else if (x[i] !== y[i]) return "1";
  }
  return unknown ? "x" : "0";
}

/** Whether `if (a != b)` takes its first branch: only for 1'b1, since an x condition counts as false (§12.4). */
export function looseNotEqual(a: Bits, b: Bits): boolean {
  return looseNotEqualValue(a, b) === "1";
}

function benchStory(run: BenchRun): string {
  if (run.endedBy === "fatal" && run.checks === 0) return `$fopen returned 0 and $fatal ended the run at ${run.endTimeNs} ns, so no summary line prints.`;
  if (run.endedBy === "fatal") return `$fatal ended the run at ${run.endTimeNs} ns after ${run.checks} check${run.checks === 1 ? "" : "s"}, so no summary line prints.`;
  const codes = run.steps.filter((s) => s.codeKey === "fscanf").map((s) => s.returns);
  return `The reads returned ${codes.join(", ")}; ${run.checks} vector${run.checks === 1 ? " was" : "s were"} checked and ${run.errors} error${run.errors === 1 ? " was" : "s were"} logged, so the summary is ${run.summary}.`;
}

export function benchRunFor(file: string, dump = false): BenchRun {
  return runBench({ ...GUARDED_BENCH, file, dump });
}

export const NO_SUMMARY = "No summary line: the run ends in $fatal";

/** Options for "what summary line does this run print?", built from the model's runs of every file. */
export function summaryOptions(file: BenchFileName, dump: boolean): { id: string; label: string; correct: boolean; feedback: string }[] {
  const actual = benchRunFor(file, dump);
  const byLabel = new Map<string, BenchRun>();
  for (const choice of BENCH_FILE_CHOICES) {
    const r = benchRunFor(choice.name, dump);
    const label = r.summary ?? NO_SUMMARY;
    if (!byLabel.has(label)) byLabel.set(label, r);
  }
  const correctLabel = actual.summary ?? NO_SUMMARY;
  return [...byLabel.entries()].map(([label, r], i) => ({
    id: `s${i}`,
    label,
    correct: label === correctLabel,
    feedback: label === correctLabel ? actual.story : `That is what ${r.config.file} gives: ${r.story} For ${file}: ${actual.story}`,
  }));
}

// ---------------------------------------------------------------------------
// Debug mode: the log that lies, cases 2 to 4
// ---------------------------------------------------------------------------

export type DebugCaseId = "case-2" | "case-3" | "case-4";

export type Honesty = "honest" | "lies" | "verdict-right";

export interface DebugFix {
  id: string;
  label: string;
  config: BenchConfig;
  /** Does the change remove the root cause, not just this run's symptom? */
  rootCause: boolean;
  /** What the fix changes, in one sentence (the outcome text is generated from the rerun). */
  change: string;
  /** Declared honesty of the rerun; a test pins it to the model. */
  expect: Honesty;
}

export interface DebugCase {
  id: DebugCaseId;
  title: string;
  symptom: string;
  config: BenchConfig;
  culprits: string[];
  /** Near-misses: lines that take part in the bug but are not its root. */
  near: Record<string, string>;
  hints: [string, string, string];
  fixes: DebugFix[];
}

const DEBUG_BASE: BenchConfig = { ...GUARDED_BENCH, dumpSupport: false };

const CASE2: BenchConfig = { ...DEBUG_BASE, file: "vectros.txt", fopenCheck: false, loop: "while-eq", badInputCheck: false, emptyCheck: false };
const CASE3: BenchConfig = { ...DEBUG_BASE, file: "vectors.txt", loop: "while-feof", castVoid: true, badInputCheck: false, echo: true };
const CASE4: BenchConfig = { ...DEBUG_BASE, file: "vectors_bad.txt", failCounter: false, passInElse: false };

export const DEBUG_CASES: DebugCase[] = [
  {
    id: "case-2",
    title: "Case 2: the fastest pass in history",
    symptom: "The run ends at time 0 and the summary has no failures.",
    config: CASE2,
    culprits: ["fopen"],
    near: { fscanf: "This read does fail, but it is the second failure in the chain: there is nothing to read because of an earlier call whose result nobody looked at." },
    hints: [
      "How much simulation time passed, and how many vectors were checked?",
      "Which call's return value does this code never test?",
      "$fopen returns 0 when the file cannot be opened (§21.3.1). Look at the file name on the first log line.",
    ],
    fixes: [
      { id: "fatal", label: "Add if (fd == 0) $fatal(1, ...) after $fopen", config: { ...CASE2, fopenCheck: true }, rootCause: true, change: "Every failed open now ends the run loudly.", expect: "honest" },
      { id: "spell", label: "Correct the plusarg to +VECTORS=vectors.txt", config: { ...CASE2, file: "vectors.txt" }, rootCause: false, change: "This run reads the right file, but the code still ignores fd, so the next typo lies again.", expect: "honest" },
      { id: "empty", label: "Add the empty-file guard before the summary", config: { ...CASE2, emptyCheck: true }, rootCause: false, change: "Nothing checked now counts as a failure, but the message blames the file's contents, not the failed open.", expect: "verdict-right" },
      { id: "forever", label: "Switch to forever with break on code != 3", config: { ...CASE2, loop: "forever-break" }, rootCause: false, change: "Same reads, same zero checks: the loop shape was never the problem.", expect: "lies" },
    ],
  },
  {
    id: "case-3",
    title: "Case 3: the vector that ran twice",
    symptom: "The file has four vectors, each line ending in a newline, but the log shows five checks.",
    config: CASE3,
    culprits: ["feof"],
    near: { fscanf: "Close: void' throws the -1 away, but the real question is why a fifth read happened at all. Look at the line that decides whether to read again." },
    hints: [
      "Compare check 4 and check 5 in the log.",
      "What does $feof return right after the fourth read? Is the final newline read yet?",
      "$feof turns nonzero only after a read has hit the end (§21.3.8). Loop on the read's return value instead.",
    ],
    fixes: [
      { id: "code", label: "Loop forever and break when $fscanf does not return 3", config: { ...CASE3, loop: "forever-break", castVoid: false, badInputCheck: true }, rootCause: true, change: "The return value of the read itself decides whether its values are used.", expect: "honest" },
      { id: "unvoid", label: "Assign the result to code instead of void'(...)", config: { ...CASE3, castVoid: false }, rootCause: false, change: "code now holds -1 on the fifth read, but nothing looks at it.", expect: "lies" },
      { id: "newline", label: "Delete the newline at the end of vectors.txt", config: { ...CASE3, contents: VECTORS.slice(0, -1) }, rootCause: false, change: "The fourth read now runs into the end of the file, so $feof turns nonzero in time; any file that ends with a newline brings the bug back.", expect: "honest" },
      { id: "loose", label: "Compare with != instead of !==", config: { ...CASE3, compare: "!=" }, rootCause: false, change: "The comparison is weaker (an X would no longer fail), and the loop still runs five times.", expect: "lies" },
    ],
  },
  {
    id: "case-4",
    title: "Case 4: errors in the log, PASS in the summary",
    symptom: "The log has an error, yet the summary says FAIL=0.",
    config: CASE4,
    culprits: ["error", "pass"],
    near: { compare: "The comparison works: it found the mismatch and the $error line printed. Follow what happens after it." },
    hints: [
      "The comparison caught the bad vector. What does the summary count?",
      "Which variable does the failing branch change? Which runs for every vector?",
      "The standard defines no counter that $error updates; only $fatal ends the run (§20.10).",
    ],
    fixes: [
      { id: "both", label: "Add n_fail++ to the failing branch and move n_pass++ into else", config: { ...CASE4, failCounter: true, passInElse: true }, rootCause: true, change: "Every vector now lands in exactly one counter.", expect: "honest" },
      { id: "fail-only", label: "Add n_fail++ to the failing branch only", config: { ...CASE4, failCounter: true }, rootCause: false, change: "FAIL is right, but the failing vector is still counted as a pass too.", expect: "verdict-right" },
      { id: "fatal", label: "Replace $error with $fatal(1, ...)", config: { ...CASE4, failAction: "fatal" }, rootCause: false, change: "The run now dies at the first mismatch, so no summary prints and later vectors are never checked.", expect: "verdict-right" },
      { id: "loose", label: "Compare with != instead of !==", config: { ...CASE4, compare: "!=" }, rootCause: false, change: "There is no X here, so the result is the same, and the check is weaker.", expect: "lies" },
    ],
  },
];

/**
 * How the visual's run of a case differs from the lesson's snippet, so a learner
 * comparing the two does not hunt for a mismatch. Built from the model's own run.
 */
export function debugCaseNote(c: DebugCase): string | null {
  if (c.id !== "case-2") return null;
  const run = runBench(c.config);
  return `The visual runs this case on the worked example's bench: the misspelt name arrives as ${run.cmdline.join(" ")} instead of a hard-coded $fopen("${c.config.file}", "r"), and the summary line carries the bench's %t time stamp, so it reads ${run.summary} where the lesson's snippet prints it without one. The bug, the fix and the verdict are the same.`;
}

export function debugCase(id: DebugCaseId): DebugCase {
  const c = DEBUG_CASES.find((x) => x.id === id);
  if (!c) throw new Error(`unknown case ${id}`);
  return c;
}

/** The fully guarded bench on the same file contents: what an honest log says. */
export function referenceRun(config: BenchConfig): BenchRun {
  return runBench({ ...GUARDED_BENCH, dumpSupport: config.dumpSupport, file: config.file, contents: config.contents, dump: config.dump });
}

function verdictOf(run: BenchRun): "pass" | "fail" {
  return run.summary !== null && run.nFail === 0 ? "pass" : "fail";
}

export function judgeRun(run: BenchRun): { honesty: Honesty; text: string } {
  const ref = referenceRun(run.config);
  const said = run.summary ?? "no summary line";
  const truth = ref.summary ?? "no summary line (it ends in $fatal)";
  if (run.summary === ref.summary) {
    return { honesty: "honest", text: `The log tells the truth: it matches the fully guarded bench on the same file (${truth}).` };
  }
  if (verdictOf(run) !== verdictOf(ref) || verdictOf(run) === "pass") {
    return { honesty: "lies", text: `The log still lies: it says ${said}, but the fully guarded bench on the same file gives ${truth}.` };
  }
  return { honesty: "verdict-right", text: `The verdict is right (${verdictOf(run) === "fail" ? "the run fails" : "the run passes"}), but the log is not the whole truth: it says ${said}, while the fully guarded bench gives ${truth}.` };
}

const ROLE: Record<string, string> = {
  decl: "declares the bench's variables",
  timeformat: "only sets how %t prints",
  "plusarg-vectors": "reads +VECTORS",
  "plusarg-dump": "reads +DUMP",
  config: "prints the configuration",
  dump: "only controls waveform recording",
  fopen: "opens the vector file",
  "fopen-check": "checks the descriptor",
  loop: "starts the read loop",
  fscanf: "reads one vector",
  break: "ends the loop on a bad code",
  feof: "decides whether to read again",
  "line-no": "numbers the vectors",
  echo: "prints the values it was given",
  drive: "drives the adder",
  settle: "waits for the adder to settle",
  compare: "compares the sum with the expected value",
  "fail-count": "counts a failure",
  error: "reports a mismatch",
  pass: "counts a pass",
  "loop-end": "closes the loop",
  "bad-input": "catches unparsable input",
  fclose: "closes the file",
  "empty-check": "catches a run that checked nothing",
  summary: "prints the counters",
  finish: "ends the run",
};

/**
 * Did the line(s) keyed `key` execute in this run? Most keys have their own steps;
 * declarations and loop structure do not, so they are judged from what ran around them.
 */
export function lineRan(run: BenchRun, key: string): boolean {
  const has = (k: string) => run.steps.some((s) => s.codeKey === k);
  const bodyRan = has("drive");
  switch (key) {
    case "decl":
      return true;
    case "loop":
    case "break":
      return has("fscanf");
    case "line-no":
    case "echo":
    case "settle":
    case "compare":
    case "loop-end":
      return bodyRan;
    case "error":
      return has("error") || has("fail-count");
    case "dump":
      // The if (dump) line is evaluated whenever the bench supports +DUMP.
      return run.config.dumpSupport;
    default:
      return has(key);
  }
}

/** Diagnostic feedback for clicking a line as the suspect; every line gets one, built from the buggy run. */
export function suspectFeedback(c: DebugCase, key: string): { correct: boolean; text: string } {
  const run = runBench(c.config);
  if (c.culprits.includes(key)) {
    const text =
      c.id === "case-2"
        ? `Yes. $fopen returned 0 (§21.3.1) and nothing checks fd, so the loop's first read fails, ${run.checks} vectors are checked, and the counters stay at zero: ${run.summary}.`
        : c.id === "case-3"
          ? `Yes. After the fourth read the final newline is still unread, so $feof is still 0 (§21.3.8); the fifth read returns -1, assigns nothing, and its stale values are checked: ${run.checks} checks for 4 vectors.`
          : `Yes. The failing branch calls $error but never increments n_fail, and n_pass++ runs for every vector, so ${run.errors} error in the log becomes ${run.summary}. The standard defines no counter that $error updates (§20.10): only the bench's own counters reach the summary.`;
    return { correct: true, text };
  }
  if (c.near[key]) return { correct: false, text: c.near[key] };
  const executed = lineRan(run, key);
  const role = ROLE[key] ?? "is part of the bench";
  const base = `Not this line: it ${role}${executed ? " and did what it says in this run" : ", and it did not even run here"}.`;
  if (key === "summary") return { correct: false, text: `Not this line: it prints n_pass=${run.nPass} and n_fail=${run.nFail} faithfully. The question is why the counters hold those values.` };
  if (key === "fclose" && run.fileText === null) return { correct: false, text: "Not this line: it passes fd = 0 to $fclose because the open failed. The standard does not define what a tool does with descriptor 0, and this line does not change the counters. Ask which line makes the summary disagree with what really happened." };
  if (key === "plusarg-vectors" || key === "config") return { correct: false, text: `${base} The first log line, "${run.log[0]}", shows exactly which file the bench was told to open.` };
  return { correct: false, text: `${base} Ask which line makes the summary disagree with what really happened.` };
}
