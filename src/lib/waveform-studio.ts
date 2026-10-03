/**
 * Waveform Studio: parsing, samples and protocol analysis for the practice
 * route /practice/waveform-studio. Pure, no React.
 *
 * - Sources may be strict JSON or the relaxed WaveJSON people paste from the
 *   WaveDrom editor (unquoted keys, single quotes, trailing commas). Relaxed
 *   text is rewritten token by token; it is never evaluated.
 * - AXI samples come from `axi-channel-model` (the same generator as the
 *   B-AXI-1 figures) and AHB samples from `ahb-model`, so they cannot drift
 *   from the lessons.
 * - Any spec whose signals use AXI channel names (AWVALID/AWREADY, WVALID, …)
 *   is checked with `checkWaveDrom`, which applies IHI0022E A3.2.1 and A3.3.1.
 */
import { checkWaveDrom, lessonFigure as axiFigure, type ChannelName, type ProtocolViolation } from "@/lib/axi-channel-model";
import { lessonFigure as ahbFigure } from "@/lib/ahb-model";
import type { WaveDromSource } from "@/lib/wavedrom";

export type ParseResult = { ok: true; source: WaveDromSource; relaxed: boolean } | { ok: false; error: string };

const IDENT_START = /[A-Za-z_$]/;
const IDENT_PART = /[A-Za-z0-9_$]/;

/**
 * Rewrites relaxed WaveJSON into strict JSON: single-quoted strings become
 * double-quoted, bare object keys are quoted, and trailing commas are dropped.
 * Throws with a position on characters that cannot appear in WaveJSON.
 */
export function relaxedToStrictJson(text: string): string {
  let out = "";
  let i = 0;
  const n = text.length;
  while (i < n) {
    const ch = text[i];
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let body = "";
      i += 1;
      while (i < n && text[i] !== quote) {
        if (text[i] === "\\" && i + 1 < n) {
          const next = text[i + 1];
          // \' is only meaningful inside single quotes; JSON has no such escape.
          body += next === "'" ? "'" : `\\${next}`;
          i += 2;
          continue;
        }
        if (text[i] === "\n") throw new Error(`Unterminated string near character ${i}.`);
        body += quote === "'" && text[i] === '"' ? '\\"' : text[i];
        i += 1;
      }
      if (i >= n) throw new Error("Unterminated string.");
      out += `"${body}"`;
      i += 1;
      continue;
    }
    if (ch === "/" && text[i + 1] === "/") {
      while (i < n && text[i] !== "\n") i += 1;
      continue;
    }
    if (ch === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      if (end < 0) throw new Error("Unterminated comment.");
      i = end + 2;
      continue;
    }
    if (ch === ",") {
      // Drop a trailing comma before } or ].
      let j = i + 1;
      while (j < n && /\s/.test(text[j])) j += 1;
      if (text[j] === "}" || text[j] === "]") {
        i += 1;
        continue;
      }
      out += ch;
      i += 1;
      continue;
    }
    if (IDENT_START.test(ch)) {
      let j = i;
      while (j < n && IDENT_PART.test(text[j])) j += 1;
      const word = text.slice(i, j);
      let k = j;
      while (k < n && /\s/.test(text[k])) k += 1;
      if (text[k] === ":") out += `"${word}"`;
      else if (word === "true" || word === "false" || word === "null") out += word;
      else throw new Error(`Unexpected word "${word}" near character ${i}. Quote string values.`);
      i = j;
      continue;
    }
    if (/[\s{}[\]:0-9.+\-eE]/.test(ch)) {
      out += ch;
      i += 1;
      continue;
    }
    throw new Error(`Unexpected character "${ch}" near character ${i}.`);
  }
  return out;
}

export function parseStudioSource(text: string): ParseResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "The source is empty. Pick a sample or paste WaveJSON." };
  let value: unknown;
  let relaxed = false;
  try {
    value = JSON.parse(trimmed);
  } catch {
    try {
      value = JSON.parse(relaxedToStrictJson(trimmed));
      relaxed = true;
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Could not parse the source." };
    }
  }
  if (!value || typeof value !== "object" || !Array.isArray((value as { signal?: unknown }).signal)) {
    return { ok: false, error: 'WaveJSON needs a top-level "signal" array.' };
  }
  return { ok: true, source: value as WaveDromSource, relaxed };
}

export interface StudioSample {
  id: string;
  label: string;
  protocol: "AXI" | "AHB";
  /** What the learner should look for or fix. */
  task: string;
  source: WaveDromSource;
}

/**
 * Debug sample: AWVALID rises at edge 1, then drops at edge 3 before AWREADY
 * (breaks A3.2.1: once VALID is asserted it must stay asserted until the
 * handshake).
 */
const DROPPED_VALID: WaveDromSource = {
  signal: [
    { name: "ACLK", wave: "p......" },
    {},
    [
      "AW channel",
      { name: "AWVALID", wave: "01.01.0" },
      { name: "AWREADY", wave: "0....10" },
      { name: "AWADDR", wave: "x=.x=.x", data: ["0x1000", "0x1000"] },
    ],
  ] as unknown as WaveDromSource["signal"],
};

/**
 * Debug sample: BVALID rises at edge 3, before the WLAST handshake at edge 4
 * (breaks A3.3.1: the slave must wait for AW and the last W transfer before
 * asserting BVALID).
 */
const EARLY_BVALID: WaveDromSource = {
  signal: [
    { name: "ACLK", wave: "p......" },
    {},
    [
      "AW channel",
      { name: "AWVALID", wave: "010...." },
      { name: "AWREADY", wave: "010...." },
      { name: "AWADDR", wave: "x=x....", data: ["0x1000"] },
    ],
    {},
    [
      "W channel",
      { name: "WVALID", wave: "0.1..0." },
      { name: "WREADY", wave: "0.1..0." },
      { name: "WDATA", wave: "x.===x.", data: ["D0", "D1", "D2"] },
      { name: "WLAST", wave: "x.0.1x." },
    ],
    {},
    [
      "B channel",
      { name: "BVALID", wave: "0..10.." },
      { name: "BREADY", wave: "0..10.." },
      { name: "BRESP", wave: "x..=x..", data: ["OKAY"] },
    ],
  ] as unknown as WaveDromSource["signal"],
};

export const STUDIO_SAMPLES: StudioSample[] = [
  {
    id: "axi-handshake",
    label: "AXI: VALID/READY handshake",
    protocol: "AXI",
    task: "Find the edges where a transfer happens: both VALID and READY are 1 at the same rising edge.",
    source: axiFigure("handshake") as unknown as WaveDromSource,
  },
  {
    id: "axi-write",
    label: "AXI: write burst (AW, W, B)",
    protocol: "AXI",
    task: "Check that BVALID rises only after both the AW handshake and the WLAST handshake (A3.3.1).",
    source: axiFigure("write") as unknown as WaveDromSource,
  },
  {
    id: "axi-read",
    label: "AXI: read burst (AR, R)",
    protocol: "AXI",
    task: "R data may only start after the AR handshake. Count the R beats and find RLAST.",
    source: axiFigure("read") as unknown as WaveDromSource,
  },
  {
    id: "axi-bug-dropped-valid",
    label: "Debug: AWVALID dropped",
    protocol: "AXI",
    task: "The checker reports a violation. Keep AWVALID high from edge 1 until the AWREADY edge, then re-check: the address must also stay stable while it waits.",
    source: DROPPED_VALID,
  },
  {
    id: "axi-bug-early-bvalid",
    label: "Debug: BVALID too early",
    protocol: "AXI",
    task: "BVALID rises before the last write beat is accepted. Move the B handshake so it follows the WLAST handshake.",
    source: EARLY_BVALID,
  },
  {
    id: "ahb-pipeline",
    label: "AHB: address/data pipeline",
    protocol: "AHB",
    task: "Each transfer's data phase is one cycle after its address phase. Match each HWDATA to its HADDR.",
    source: ahbFigure("ahb1-pipeline") as unknown as WaveDromSource,
  },
  {
    id: "ahb-wait",
    label: "AHB: wait state",
    protocol: "AHB",
    task: "HREADY low stretches the data phase and holds the next address. Which address is held?",
    source: ahbFigure("ahb1-wait-state") as unknown as WaveDromSource,
  },
  {
    id: "ahb-error",
    label: "AHB: two-cycle ERROR",
    protocol: "AHB",
    task: "ERROR takes two cycles: HRESP=ERROR with HREADY low, then HRESP=ERROR with HREADY high.",
    source: ahbFigure("ahb2-two-cycle-error") as unknown as WaveDromSource,
  },
];

export function formatSource(source: WaveDromSource): string {
  // One lane per line keeps the source easy to edit on small screens.
  const lanes = (source.signal as unknown[]).map((lane) => `    ${JSON.stringify(lane)}`);
  const rest = Object.entries(source)
    .filter(([key]) => key !== "signal")
    .map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)}`);
  return `{\n  "signal": [\n${lanes.join(",\n")}\n  ]${rest.length ? `,\n${rest.join(",\n")}` : ""}\n}`;
}

export interface StudioAnalysis {
  /** True when at least one AXI VALID/READY pair was found. */
  axiChecked: boolean;
  violations: ProtocolViolation[];
  handshakes: Partial<Record<ChannelName, number[]>>;
  edges: number;
}

export function analyzeSource(source: WaveDromSource): StudioAnalysis {
  const result = checkWaveDrom(source as unknown as { signal: unknown[] });
  const axiChecked = Object.keys(result.handshakes).length > 0;
  return { axiChecked, violations: axiChecked ? result.violations : [], handshakes: result.handshakes, edges: result.edges };
}
