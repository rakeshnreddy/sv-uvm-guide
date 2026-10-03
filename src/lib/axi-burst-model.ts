/**
 * AXI burst address and byte-lane model.
 *
 * Every rule is taken from Arm IHI 0022E (AMBA AXI and ACE Protocol
 * Specification, Issue E):
 * - A3.4.1 "Address structure": 4KB rule, burst length limits, WRAP rules,
 *   burst size limit, and the "Burst address" equations (Start_Address,
 *   Number_Bytes, Aligned_Address, Address_N, Wrap_Boundary,
 *   Lower_Byte_Lane, Upper_Byte_Lane).
 * - A3.4.2 pseudocode, used where the equations are silent (FIXED bursts keep
 *   their first-beat lanes because the address never increments).
 * - A3.4.3 "Write strobes": strobes HIGH only for lanes that contain valid data.
 *
 * Pure and deterministic. No React.
 */

export type AxiBurstType = "FIXED" | "INCR" | "WRAP";
export type AxiVersion = "AXI4" | "AXI3";

export interface BurstRequest {
  /** AxADDR (Start_Address). */
  startAddress: number;
  /** AxLEN: number of transfers minus one. */
  axlen: number;
  /** AxSIZE: log2 of the bytes in each transfer. */
  axsize: number;
  burst: AxiBurstType;
  /** Data_Bus_Bytes: byte lanes on the data bus (4 for 32-bit, 8 for 64-bit, ...). */
  dataBusBytes: number;
  version?: AxiVersion;
}

export type BurstRuleId = "size-exceeds-bus" | "length-range" | "wrap-length" | "wrap-unaligned" | "cross-4kb";

export interface BurstViolation {
  rule: BurstRuleId;
  clause: string;
  message: string;
}

export interface BurstBeat {
  /** Transfer number. N = 1 is the first transfer, as in IHI0022E A3.4.1. */
  n: number;
  /** Address_N. */
  address: number;
  lowerByteLane: number;
  upperByteLane: number;
  /** Byte lanes used by this transfer, lowest first. */
  lanes: number[];
  /** Lowest and highest byte address that this transfer carries. */
  firstByte: number;
  lastByte: number;
  /** True for the transfer whose address wrapped to Wrap_Boundary. */
  wrapped: boolean;
  /** 4KB page (address / 4096) of the highest byte. */
  page: number;
  /** The A3.4.1 equation that produced Address_N, with the numbers filled in. */
  why: string;
}

export interface BurstResult {
  request: Required<BurstRequest>;
  numberBytes: number;
  burstLength: number;
  alignedAddress: number;
  /** True when Start_Address == Aligned_Address. */
  aligned: boolean;
  /** WRAP only. */
  wrapBoundary: number | null;
  /** Number_Bytes x Burst_Length: the most data the burst can move. */
  totalBytes: number;
  /** Empty when the burst has no defined address sequence (size > bus, illegal WRAP). */
  beats: BurstBeat[];
  lowestByte: number | null;
  highestByte: number | null;
  crosses4KB: boolean;
  /** The 4KB boundary that the burst crosses, if any. */
  crossedBoundary: number | null;
  violations: BurstViolation[];
  legal: boolean;
}

export const FOUR_KB = 0x1000;
export const WRAP_LENGTHS = [2, 4, 8, 16] as const;

/** Maximum Burst_Length (A3.4.1 "Burst length"). */
export function maxBurstLength(burst: AxiBurstType, version: AxiVersion = "AXI4"): number {
  if (version === "AXI3") return 16;
  return burst === "INCR" ? 256 : 16;
}

export function hex(value: number, digits = 4): string {
  return `0x${value.toString(16).toUpperCase().padStart(digits, "0")}`;
}

const INT = (x: number) => Math.floor(x);

function lanesBetween(lower: number, upper: number): number[] {
  const out: number[] = [];
  for (let lane = lower; lane <= upper; lane += 1) out.push(lane);
  return out;
}

/** Runs the IHI0022E A3.4.1 burst equations and legality rules. */
export function computeBurst(input: BurstRequest): BurstResult {
  const request: Required<BurstRequest> = { version: "AXI4", ...input };
  const { startAddress, axlen, axsize, burst, dataBusBytes, version } = request;
  const numberBytes = 2 ** axsize; // Number_Bytes = 2 ^ AxSIZE
  const burstLength = axlen + 1; // Burst_Length = AxLEN + 1
  const alignedAddress = INT(startAddress / numberBytes) * numberBytes; // Aligned_Address
  const aligned = alignedAddress === startAddress;
  const totalBytes = numberBytes * burstLength;
  const violations: BurstViolation[] = [];

  if (numberBytes > dataBusBytes) {
    violations.push({
      rule: "size-exceeds-bus",
      clause: "IHI0022E A3.4.1",
      message: `AxSIZE=${axsize} asks for ${numberBytes} bytes per transfer, but the bus has ${dataBusBytes} byte lanes. "The size of any transfer must not exceed the data bus width."`,
    });
  }
  const maxLen = maxBurstLength(burst, version);
  if (burstLength < 1 || burstLength > maxLen) {
    violations.push({
      rule: "length-range",
      clause: "IHI0022E A3.4.1",
      message: `${version} ${burst} bursts carry 1 to ${maxLen} transfers; AxLEN=${axlen} asks for ${burstLength}.`,
    });
  }
  let wrapBoundary: number | null = null;
  if (burst === "WRAP") {
    if (!(WRAP_LENGTHS as readonly number[]).includes(burstLength)) {
      violations.push({
        rule: "wrap-length",
        clause: "IHI0022E A3.4.1",
        message: `A wrapping burst must have 2, 4, 8 or 16 transfers; this one has ${burstLength}.`,
      });
    }
    if (!aligned) {
      violations.push({
        rule: "wrap-unaligned",
        clause: "IHI0022E A3.4.1",
        message: `A wrapping burst must start aligned to the transfer size: ${hex(startAddress)} is not a multiple of ${numberBytes}.`,
      });
    }
    wrapBoundary = INT(startAddress / totalBytes) * totalBytes; // Wrap_Boundary
  }

  const undefinedSequence = violations.some((v) => v.rule === "size-exceeds-bus" || v.rule === "wrap-length" || v.rule === "wrap-unaligned");
  const beats: BurstBeat[] = [];
  if (!undefinedSequence && burstLength >= 1) {
    const base = (addr: number) => INT(addr / dataBusBytes) * dataBusBytes;
    let wrappedAlready = false;
    for (let n = 1; n <= burstLength; n += 1) {
      let address: number;
      let wrapped = false;
      let why: string;
      if (n === 1) {
        address = startAddress;
        why = `Address_1 = Start_Address = ${hex(startAddress)}`;
      } else if (burst === "FIXED") {
        address = startAddress;
        why = `FIXED: every transfer uses Start_Address = ${hex(startAddress)}`;
      } else if (burst === "INCR" || (burst === "WRAP" && !wrappedAlready)) {
        address = alignedAddress + (n - 1) * numberBytes;
        why = `Address_${n} = Aligned_Address + (${n}-1) x Number_Bytes = ${hex(alignedAddress)} + ${n - 1} x ${numberBytes} = ${hex(address)}`;
        if (burst === "WRAP" && wrapBoundary !== null && address === wrapBoundary + totalBytes) {
          address = wrapBoundary;
          wrapped = true;
          wrappedAlready = true;
          why = `Address reached Wrap_Boundary + Number_Bytes x Burst_Length = ${hex(wrapBoundary + totalBytes)}, so Address_${n} = Wrap_Boundary = ${hex(wrapBoundary)}`;
        }
      } else {
        // WRAP after the wrap: Address_N = Start_Address + ((N-1) x Number_Bytes) - (Number_Bytes x Burst_Length)
        address = startAddress + (n - 1) * numberBytes - totalBytes;
        why = `After the wrap: Address_${n} = Start_Address + (${n}-1) x ${numberBytes} - ${totalBytes} = ${hex(address)}`;
      }

      let lowerByteLane: number;
      let upperByteLane: number;
      const firstAndUnaligned = n === 1 || (burst === "FIXED" && !aligned);
      if (firstAndUnaligned) {
        // First transfer (and every FIXED transfer, whose address never moves; A3.4.2).
        lowerByteLane = startAddress - base(startAddress);
        upperByteLane = alignedAddress + (numberBytes - 1) - base(startAddress);
      } else {
        lowerByteLane = address - base(address);
        upperByteLane = lowerByteLane + numberBytes - 1;
      }
      const firstByte = base(address) + lowerByteLane;
      const lastByte = base(address) + upperByteLane;
      beats.push({
        n,
        address,
        lowerByteLane,
        upperByteLane,
        lanes: lanesBetween(lowerByteLane, upperByteLane),
        firstByte,
        lastByte,
        wrapped,
        page: INT(lastByte / FOUR_KB),
        why,
      });
    }
  }

  let lowestByte: number | null = null;
  let highestByte: number | null = null;
  for (const beat of beats) {
    lowestByte = lowestByte === null ? beat.firstByte : Math.min(lowestByte, beat.firstByte);
    highestByte = highestByte === null ? beat.lastByte : Math.max(highestByte, beat.lastByte);
  }
  const crosses4KB = lowestByte !== null && highestByte !== null && INT(lowestByte / FOUR_KB) !== INT(highestByte / FOUR_KB);
  const crossedBoundary = crosses4KB && lowestByte !== null ? (INT(lowestByte / FOUR_KB) + 1) * FOUR_KB : null;
  if (crosses4KB && lowestByte !== null && highestByte !== null && crossedBoundary !== null) {
    violations.push({
      rule: "cross-4kb",
      clause: "IHI0022E A3.4.1",
      message: `"A burst must not cross a 4KB address boundary." Bytes ${hex(lowestByte)} to ${hex(highestByte)} straddle ${hex(crossedBoundary)}.`,
    });
  }

  return {
    request,
    numberBytes,
    burstLength,
    alignedAddress,
    aligned,
    wrapBoundary,
    totalBytes,
    beats,
    lowestByte,
    highestByte,
    crosses4KB,
    crossedBoundary,
    violations,
    legal: violations.length === 0,
  };
}

/**
 * Largest INCR burst length that starts at `startAddress` and stays inside its
 * 4KB page (A3.4.1). Uses Aligned_Address because every transfer after the
 * first is aligned.
 */
export function maxIncrBeatsBefore4KB(startAddress: number, axsize: number, version: AxiVersion = "AXI4"): number {
  const numberBytes = 2 ** axsize;
  const aligned = INT(startAddress / numberBytes) * numberBytes;
  const pageEnd = (INT(startAddress / FOUR_KB) + 1) * FOUR_KB;
  return Math.min(maxBurstLength("INCR", version), (pageEnd - aligned) / numberBytes);
}

export interface StrobeCheck {
  legal: boolean;
  /** Strobe lanes outside the transfer's active lanes (illegal). */
  extraLanes: number[];
  /** Active lanes whose strobe is LOW (legal: a sparse write). */
  skippedLanes: number[];
}

/**
 * IHI0022E A3.4.3 "Write strobes": "A master must ensure that the write
 * strobes are HIGH only for byte lanes that contain valid data." So WSTRB must
 * be a subset of the active lanes; it need not equal them.
 */
export function checkWriteStrobe(beat: Pick<BurstBeat, "lanes">, strobeLanes: number[]): StrobeCheck {
  const active = new Set(beat.lanes);
  const strobe = new Set(strobeLanes);
  const extraLanes = [...strobe].filter((lane) => !active.has(lane)).sort((a, b) => a - b);
  const skippedLanes = beat.lanes.filter((lane) => !strobe.has(lane));
  return { legal: extraLanes.length === 0, extraLanes, skippedLanes };
}

/** WSTRB as a SystemVerilog literal, lane Data_Bus_Bytes-1 on the left, grouped by 4. */
export function formatStrobe(lanes: number[], dataBusBytes: number): string {
  const on = new Set(lanes);
  let bits = "";
  for (let lane = dataBusBytes - 1; lane >= 0; lane -= 1) {
    bits += on.has(lane) ? "1" : "0";
    if (lane % 4 === 0 && lane !== 0) bits += "_";
  }
  return `${dataBusBytes}'b${bits}`;
}

export const AXBURST_ENCODING: Record<AxiBurstType, string> = { FIXED: "2'b00", INCR: "2'b01", WRAP: "2'b10" };

/** The address-channel assignment a driver would make for this burst. */
export function burstToSv(request: BurstRequest, channel: "AW" | "AR" = "AW"): string {
  return [
    `${channel}ADDR  = 32'h${request.startAddress.toString(16).toUpperCase().padStart(8, "0")};`,
    `${channel}LEN   = 8'd${request.axlen};   // ${request.axlen + 1} transfer${request.axlen === 0 ? "" : "s"}`,
    `${channel}SIZE  = 3'd${request.axsize};   // ${2 ** request.axsize} byte${request.axsize === 0 ? "" : "s"} per transfer`,
    `${channel}BURST = ${AXBURST_ENCODING[request.burst]}; // ${request.burst}`,
  ].join("\n");
}
