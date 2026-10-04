/**
 * Comparison data for common SystemVerilog data types, and "predict the
 * value" drills whose answers are computed by `sv-four-state-model.ts`.
 *
 * Every fact below was checked against the text of IEEE 1800-2023:
 * - Table 6-8 (§6.11): widths, 2-state vs 4-state, signedness of the integer types.
 * - §6.11.2: logic and reg denote the same type; 4-state → 2-state turns x/z into 0.
 * - §6.11.3: byte, shortint, int, integer, longint are signed by default;
 *   time, bit, reg, logic are unsigned by default.
 * - Table 6-7 (§6.8): default initial values: 4-state integral 'x,
 *   2-state integral '0, real 0.0, string "" (empty string).
 * - §6.6, §6.7.1: an undriven net has the value z (trireg excepted); a net
 *   declared without a data type is logic; any 4-state data type may be used
 *   for a net.
 * - §6.5: a net may have several continuous drivers (resolved); a variable
 *   may have several procedural writers (last write wins) or exactly one
 *   continuous driver, never both.
 * - §6.12: real is the same as a C double.
 * - §23.2.2.3: an `input` port declared `input logic a` with no port kind
 *   defaults to a net.
 */

import {
  INTEGRAL_TYPES,
  assignToIntegral,
  bitsToString,
  defaultNetValue,
  defaultVariableValue,
  fromNumber,
  parseBits,
  toSigned,
  toUnsigned,
  type Bit4,
  type IntegralTypeId,
} from "./sv-four-state-model";

export type DataTypeRowId = IntegralTypeId | "wire" | "real" | "string";

export interface DataTypeRow {
  id: DataTypeRowId;
  /** What a learner types, e.g. `logic [7:0] v;`. */
  example: string;
  kind: "variable" | "net";
  /** null for non-integral types. */
  states: 2 | 4 | null;
  /** Bits per value; null when the width is set by the declaration. */
  width: number | null;
  signed: boolean | null;
  defaultText: string;
  clause: string;
  note: string;
}

const integralRow = (id: IntegralTypeId, example: string, note: string): DataTypeRow => {
  const info = INTEGRAL_TYPES[id];
  const bits = defaultVariableValue(id, 1);
  return {
    id,
    example,
    kind: "variable",
    states: info.states,
    width: info.width,
    signed: info.signed,
    defaultText: `'${bits[0]}`,
    clause: "Table 6-7, Table 6-8",
    note,
  };
};

export const DATA_TYPE_ROWS: DataTypeRow[] = [
  integralRow("bit", "bit [7:0] b;", "2-state vector of any width. No x or z: assigning one turns it into 0 (§6.11.2)."),
  integralRow("logic", "logic [7:0] v;", "4-state vector. Alone it declares a variable; `wire logic w;` is a net, and so is an `input logic` port (§23.2.2.3)."),
  integralRow("reg", "reg [7:0] r;", "Exactly the same type as logic (§6.11.2). The name does not imply a hardware register."),
  integralRow("byte", "byte c;", "8-bit signed, often used for ASCII characters."),
  integralRow("shortint", "shortint s;", "16-bit signed."),
  integralRow("int", "int i;", "32-bit signed. The usual loop counter and testbench integer."),
  integralRow("longint", "longint l;", "64-bit signed."),
  integralRow("integer", "integer n;", "32-bit signed like int, but 4-state: it starts at x."),
  integralRow("time", "time t;", "64-bit unsigned, 4-state. Holds simulation time values."),
  {
    id: "wire",
    example: "wire [7:0] w;",
    kind: "net",
    states: 4,
    width: null,
    signed: false,
    defaultText: `'${defaultNetValue("wire")[0]}`,
    clause: "§6.6, §6.7.1",
    note: "A net with data type logic. It has no storage: its value is the resolution of its continuous drivers, or z with no driver. It cannot be assigned procedurally (§6.5).",
  },
  { id: "real", example: "real r;", kind: "variable", states: null, width: 64, signed: null, defaultText: "0.0", clause: "Table 6-7, §6.12", note: "Same as a C double. Not an integral type." },
  { id: "string", example: "string s;", kind: "variable", states: null, width: null, signed: null, defaultText: '"" (empty)', clause: "Table 6-7, §6.16", note: "Variable-length string. It starts empty, not null." },
];

export const writerRule: Record<DataTypeRow["kind"], string> = {
  variable: "Several procedural writers (last write wins), or exactly one continuous assignment, never both (§6.5).",
  net: "Any number of continuous drivers, combined by the net's resolution function. No procedural writes (§6.5).",
};

/** Compact literal: binary up to 8 bits, otherwise hex when every bit is the same. */
export function formatBits(bits: readonly Bit4[]): string {
  const s = bitsToString(bits);
  if (bits.length <= 8) return `${bits.length}'b${s}`;
  if (bits.every((b) => b === bits[0]) && bits.length % 4 === 0) return `${bits.length}'h${bits[0].repeat(bits.length / 4)}`;
  return `${bits.length}'b${s}`;
}

export interface DrillOption {
  id: string;
  label: string;
  correct: boolean;
  feedback: string;
}

export interface ValueDrill {
  id: string;
  code: string;
  question: string;
  /** Value computed by the four-state model. */
  answer: string;
  why: string;
  clause: string;
  options: DrillOption[];
}

function fillOptions(width: number, correctBits: Bit4[], feedback: Record<"x" | "0" | "z", string>): DrillOption[] {
  const answer = formatBits(correctBits);
  return (["x", "0", "z"] as const).map((v) => {
    const label = formatBits(Array<Bit4>(width).fill(v));
    return { id: v, label, correct: label === answer, feedback: feedback[v] };
  });
}

/** Drills: every `answer` and every `correct` flag is computed, never typed in. */
export function buildValueDrills(): ValueDrill[] {
  const drills: ValueDrill[] = [];

  const intBits = defaultVariableValue("int");
  drills.push({
    id: "int-default",
    code: "int count;",
    question: "What does count hold before anything assigns it?",
    answer: formatBits(intBits),
    why: "int is a 2-state type, so it cannot start at x. 2-state integral variables default to '0.",
    clause: "Table 6-7",
    options: fillOptions(32, intBits, {
      x: "Only 4-state types (logic, reg, integer, time) start at x. int has no x to start from.",
      "0": "2-state integral variables default to '0 (Table 6-7). That is also why an uninitialized int hides reset bugs that a logic would show as x.",
      z: "z means 'not driven' and belongs to nets. A variable of any type never starts at z.",
    }),
  });

  const logicBits = defaultVariableValue("logic", 4);
  drills.push({
    id: "logic-default",
    code: "logic [3:0] v;",
    question: "What does v hold before anything assigns it?",
    answer: formatBits(logicBits),
    why: "logic is 4-state, and 4-state integral variables default to 'x: every bit unknown until something writes it.",
    clause: "Table 6-7",
    options: fillOptions(4, logicBits, {
      x: "4-state integral variables default to 'x (Table 6-7): unknown until written. Seeing x on a flop after reset is a real bug signal.",
      "0": "Only 2-state types (bit, int, …) start at 0. A logic starts at x, which is what makes missing resets visible.",
      z: "z is the value of an undriven net. v is a variable: it holds x until written.",
    }),
  });

  const integerBits = defaultVariableValue("integer");
  drills.push({
    id: "integer-default",
    code: "integer n;",
    question: "integer and int are both 32-bit signed. What does n hold before anything assigns it?",
    answer: formatBits(integerBits),
    why: "integer is the 4-state 32-bit signed type, so it starts at x; int is its 2-state twin and starts at 0.",
    clause: "Table 6-7, Table 6-8",
    options: fillOptions(32, integerBits, {
      x: "integer is 4-state (Table 6-8), so it defaults to 'x like logic.",
      "0": "That is int. integer is the 4-state version: same width and sign, but it starts at x.",
      z: "Variables never start at z; z is an undriven net.",
    }),
  });

  const wireBits = defaultNetValue("wire", 4);
  drills.push({
    id: "wire-undriven",
    code: "wire [3:0] w;   // nothing drives w",
    question: "What value does w have?",
    answer: formatBits(wireBits),
    why: "A net stores nothing: its value comes from its drivers. With no driver at all, a wire is high-impedance.",
    clause: "§6.6, §6.7.1",
    options: fillOptions(4, wireBits, {
      x: "x appears on a net when drivers conflict (or drive x). With no driver at all the value is z (§6.6).",
      "0": "Nets do not default to 0. Only tri0 pulls an undriven net low.",
      z: "An undriven net is z (§6.6, §6.7.1). trireg is the one exception: it starts at x and then holds its last driven value.",
    }),
  });

  const ff = fromNumber(0xff, 8);
  const asByte = toSigned(ff);
  const asBits = toUnsigned(ff);
  drills.push({
    id: "byte-signed",
    code: `byte b = 8'hFF;\n$display("%0d", b);`,
    question: "What does $display print?",
    answer: String(asByte),
    why: "byte is signed by default, so the bit pattern 1111_1111 is read as two's complement: -1.",
    clause: "§6.11.3",
    options: [
      { id: "signed", label: String(asByte), correct: true, feedback: "byte, shortint, int, integer and longint are signed by default (§6.11.3). 8'hFF in a signed 8-bit type is -1." },
      { id: "unsigned", label: String(asBits), correct: false, feedback: "That would be bit [7:0] or byte unsigned. A plain byte is signed (§6.11.3)." },
    ],
  });

  drills.push({
    id: "bit-unsigned",
    code: `bit [7:0] u = 8'hFF;\n$display("%0d", u);`,
    question: "Same bits, declared as bit [7:0]. What does $display print?",
    answer: String(asBits),
    why: "bit, logic, reg and time are unsigned by default, so 1111_1111 is 255.",
    clause: "§6.11.3",
    options: [
      { id: "signed", label: String(asByte), correct: false, feedback: "Vectors of bit, logic and reg are unsigned unless declared signed (§6.9, §6.11.3)." },
      { id: "unsigned", label: String(asBits), correct: true, feedback: "bit vectors are unsigned by default (§6.11.3): 8'hFF is 255." },
    ],
  });

  const converted = assignToIntegral(parseBits("1x0z"), { states: 2, width: 4 });
  const convertedText = formatBits(converted.bits);
  drills.push({
    id: "four-to-two",
    code: "bit [3:0] n = 4'b1x0z;",
    question: "What does the 2-state variable n hold after this assignment?",
    answer: convertedText,
    why: "When a 4-state value is converted to a 2-state type, every x and z bit becomes 0; the known bits are copied.",
    clause: "§6.11.2",
    options: [
      { id: "zeroed", label: convertedText, correct: true, feedback: "x and z bits become 0 in a 2-state type (§6.11.2). The fact that they were unknown is lost silently." },
      { id: "kept", label: "4'b1x0z", correct: convertedText === "4'b1x0z", feedback: "A bit variable has no x or z to store. Those bits are converted, not kept." },
      { id: "all-x", label: "4'bxxxx", correct: false, feedback: "Nothing turns the whole value into x: a 2-state type cannot hold x at all." },
      { id: "ones", label: "4'b1101", correct: convertedText === "4'b1101", feedback: "Unknown bits are converted to 0, not 1." },
    ],
  });

  return drills;
}
