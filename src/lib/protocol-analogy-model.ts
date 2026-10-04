/**
 * The mail-order analogy for AXI channels, with every step mapped to the real
 * handshake it stands for and the place where the analogy stops being true.
 *
 * Source: Arm IHI0022E (AXI and ACE Protocol Specification).
 * - §A3.2.1 handshake process; §A3.3 relationships between channels;
 * - §A3.3.1 dependencies between channel handshake signals (incl. the AXI4
 *   write response dependency);
 * - §A3.4.4 response structure; §A5.3.1 read ordering; §A5.4 removal of WID.
 *
 * Pure data and functions: no React.
 */

export type AxiChannel = "AW" | "W" | "B" | "AR" | "R";

export type TransactionKind = "write" | "read";

/** Order in which the write address (label) and write data (box) handshakes complete. */
export type WriteOrder = "label-first" | "box-first" | "same-cycle";

export const WRITE_ORDERS: { value: WriteOrder; label: string }[] = [
  { value: "label-first", label: "Label first (AW, then W)" },
  { value: "box-first", label: "Box first (W, then AW)" },
  { value: "same-cycle", label: "Same edge (AW and W together)" },
];

export interface ChannelMapping {
  channel: AxiChannel;
  /** The everyday object the channel stands for. */
  item: string;
  direction: "master → slave" | "slave → master";
  /** The handshake that moves it: both signals high at a rising ACLK edge. */
  handshake: string;
  /** Payload signals the item stands for. */
  payload: string;
}

export const CHANNEL_MAP: Record<AxiChannel, ChannelMapping> = {
  AW: { channel: "AW", item: "Shipping label", direction: "master → slave", handshake: "AWVALID && AWREADY", payload: "AWADDR, AWLEN, AWSIZE, AWBURST, AWID" },
  W: { channel: "W", item: "Box", direction: "master → slave", handshake: "WVALID && WREADY", payload: "WDATA, WSTRB, WLAST" },
  B: { channel: "B", item: "Delivery receipt", direction: "slave → master", handshake: "BVALID && BREADY", payload: "BRESP, BID" },
  AR: { channel: "AR", item: "Order form", direction: "master → slave", handshake: "ARVALID && ARREADY", payload: "ARADDR, ARLEN, ARSIZE, ARBURST, ARID" },
  R: { channel: "R", item: "Box with packing slip", direction: "slave → master", handshake: "RVALID && RREADY", payload: "RDATA, RRESP, RLAST, RID" },
};

export interface AnalogyStep {
  id: string;
  /** Channels whose handshake completes in this step. */
  completes: AxiChannel[];
  analogy: string;
  /** The real handshake, in signal terms. */
  real: string;
  /** Where the analogy stops matching AXI. */
  breaksDown: string;
  source: string;
}

const AW_STEP: AnalogyStep = {
  id: "aw",
  completes: ["AW"],
  analogy: "The store accepts your shipping label: where the box goes and how big it is.",
  real: "AW handshake: AWVALID && AWREADY at a rising ACLK edge transfers AWADDR, AWLEN, AWSIZE, AWBURST and AWID.",
  breaksDown:
    "A real label is stuck to the box. An AXI label travels on its own channel and may arrive before, with, or after the box. Nothing on W says which label it belongs to: in AXI4 the boxes simply arrive in label order (WID was removed).",
  source: "IHI0022E §A3.3, §A5.4",
};

const W_STEP: AnalogyStep = {
  id: "w",
  completes: ["W"],
  analogy: "The store accepts the box.",
  real: "W handshake: WVALID && WREADY transfers one beat of WDATA with WSTRB. This one-beat write (AWLEN = 0) sets WLAST on that beat.",
  breaksDown:
    "One box here is one beat. A burst is a run of beats on W with WLAST on the final one. And a courier may wait for the door to open, but an AXI source must not wait for READY before asserting VALID, and must hold VALID and the data until the handshake.",
  source: "IHI0022E §A3.2.1, §A3.3.1",
};

const AW_W_STEP: AnalogyStep = {
  id: "aw+w",
  completes: ["AW", "W"],
  analogy: "Label and box are handed over at the same moment.",
  real: "AWVALID && AWREADY and WVALID && WREADY are both true at the same rising ACLK edge, so both handshakes complete together. The specification allows this explicitly.",
  breaksDown:
    "In the analogy this looks like one act. In AXI they are still two independent handshakes that happen to coincide; either could have been delayed by its own READY.",
  source: "IHI0022E §A3.3",
};

const B_STEP: AnalogyStep = {
  id: "b",
  completes: ["B"],
  analogy: "The store mails you a delivery receipt.",
  real: "B handshake: BVALID && BREADY transfers BRESP and BID. In AXI4 the slave may assert BVALID only after the AW handshake and the W handshake carrying WLAST.",
  breaksDown:
    "A real store could mail a receipt as soon as it reads the label. An AXI4 slave must have both the label (AW) and the last beat (WLAST) first. There is one receipt per transaction, never one per beat.",
  source: "IHI0022E §A3.3.1 (AXI4 write response dependency), §A3.4.4",
};

const AR_STEP: AnalogyStep = {
  id: "ar",
  completes: ["AR"],
  analogy: "The store accepts your order form.",
  real: "AR handshake: ARVALID && ARREADY transfers ARADDR, ARLEN, ARSIZE, ARBURST and ARID.",
  breaksDown:
    "You can have many orders open at once. Orders with different ARIDs may come back in any order; orders with the same ARID come back in the order you placed them.",
  source: "IHI0022E §A5.3.1",
};

const R_STEP: AnalogyStep = {
  id: "r",
  completes: ["R"],
  analogy: "The store ships the box with a packing slip attached.",
  real: "R handshake: RVALID && RREADY transfers RDATA with RRESP and RID. The slave may assert RVALID only after the AR handshake. RLAST marks the final beat.",
  breaksDown:
    "A burst is several boxes, each with its own slip: RRESP is per beat and can differ between beats. Beats of reads with different IDs may be interleaved, which no parcel service does.",
  source: "IHI0022E §A3.3.1, §A3.4.4, §A5.3.1",
};

export function writeSteps(order: WriteOrder): AnalogyStep[] {
  if (order === "label-first") return [AW_STEP, W_STEP, B_STEP];
  if (order === "box-first") return [W_STEP, AW_STEP, B_STEP];
  return [AW_W_STEP, B_STEP];
}

export function readSteps(): AnalogyStep[] {
  return [AR_STEP, R_STEP];
}

export function stepsFor(kind: TransactionKind, order: WriteOrder): AnalogyStep[] {
  return kind === "write" ? writeSteps(order) : readSteps();
}

/** Channels whose handshake has completed after `count` steps. */
export function completedChannels(steps: AnalogyStep[], count: number): AxiChannel[] {
  return steps.slice(0, count).flatMap((s) => s.completes);
}

export interface OrderViolation {
  channel: AxiChannel;
  rule: string;
}

/**
 * Checks a sequence of handshake completions against the AXI4 inter-channel
 * rules (IHI0022E §A3.3.1). AW and W have no order between them (§A3.3).
 */
export function checkHandshakeOrder(steps: AnalogyStep[]): OrderViolation[] {
  const seen = new Set<AxiChannel>();
  const violations: OrderViolation[] = [];
  for (const step of steps) {
    for (const channel of step.completes) {
      if (channel === "B" && (!seen.has("AW") || !seen.has("W"))) {
        violations.push({ channel, rule: "BVALID only after the AW handshake and the WLAST handshake (IHI0022E §A3.3.1, AXI4)" });
      }
      if (channel === "R" && !seen.has("AR")) {
        violations.push({ channel, rule: "RVALID only after the AR handshake (IHI0022E §A3.3.1)" });
      }
    }
    for (const channel of step.completes) seen.add(channel);
  }
  return violations;
}

/** The VALID/READY analogy: one courier, one door. */
export const HANDSHAKE_ANALOGY = {
  analogy: "VALID is the courier holding out a parcel. READY is the open door. The parcel changes hands only on a clock edge when both are true.",
  breaksDown:
    "A courier may wait for the door to open before holding out the parcel. An AXI source must not: VALID must not depend on READY. The receiver, however, may wait for VALID before raising READY, or raise READY early. Once VALID is high it stays high, with stable data, until the handshake.",
  source: "IHI0022E §A3.2.1, §A3.3.1",
};
