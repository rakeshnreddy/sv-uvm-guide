/**
 * AMBA protocol family facts and a small "which protocol fits this block?"
 * model. Pure data and functions: no React.
 *
 * Every fact cites the Arm specification it was checked against:
 * - APB:          Arm IHI0024D (AMBA APB Protocol Specification, APB2 to APB5)
 * - AHB:          Arm IHI0033B.b (AMBA AHB: AHB-Lite and AHB5)
 * - AXI3/AXI4, AXI4-Lite, ACE, ACE-Lite: Arm IHI0022E (AXI and ACE Protocol Specification)
 * - AXI4-Stream:  Arm IHI0051A (AMBA 4 AXI4-Stream Protocol Specification)
 * - CHI:          Arm IHI0050E.b (AMBA 5 CHI Architecture Specification)
 *
 * "Typical use" lines are engineering practice, not normative text, and are
 * labelled as such in the view.
 */

export type AmbaProtocolId = "apb" | "ahb" | "axi3" | "axi4" | "axi4-lite" | "axi4-stream" | "ace" | "ace-lite" | "chi";

/** How a dimension is supported. Rendered with a glyph and a word, never colour alone. */
export type Support = "yes" | "no" | "optional" | "limited" | "n/a";

export const SUPPORT_CUES: Record<Support, { glyph: string; word: string }> = {
  yes: { glyph: "✓", word: "Yes" },
  no: { glyph: "✕", word: "No" },
  optional: { glyph: "◐", word: "Optional" },
  limited: { glyph: "◐", word: "Limited" },
  "n/a": { glyph: "–", word: "Not applicable" },
};

export type FactKey = "channels" | "pipelining" | "bursts" | "outstanding" | "ordering" | "strobes" | "errors" | "coherency";

export const FACT_KEYS: FactKey[] = ["channels", "pipelining", "bursts", "outstanding", "ordering", "strobes", "errors", "coherency"];

export const FACT_LABELS: Record<FactKey, string> = {
  channels: "Channels / phases",
  pipelining: "Pipelining",
  bursts: "Bursts",
  outstanding: "Outstanding transactions and IDs",
  ordering: "Out-of-order completion",
  strobes: "Write strobes",
  errors: "Error responses",
  coherency: "Hardware coherency",
};

export interface Fact {
  /** Omitted for descriptive rows such as "Channels / phases". */
  support?: Support;
  text: string;
  /** Specification and section, e.g. "IHI0022E §A3.4.1". */
  source: string;
}

/**
 * Capabilities used by the fit model. Each one is a yes/no question a
 * designer asks about a block's interface.
 */
export type Capability =
  | "addressed"
  | "backToBack"
  | "bursts"
  | "outstanding"
  | "outOfOrder"
  | "concurrentReadWrite"
  | "ioCoherent"
  | "snooped"
  | "networkLayer";

export const CAPABILITIES: Capability[] = [
  "addressed",
  "backToBack",
  "bursts",
  "outstanding",
  "outOfOrder",
  "concurrentReadWrite",
  "ioCoherent",
  "snooped",
  "networkLayer",
];

export const CAPABILITY_LABELS: Record<Capability, string> = {
  addressed: "memory-mapped addresses",
  backToBack: "one data transfer per clock",
  bursts: "multi-beat bursts from one address",
  outstanding: "several transactions in flight",
  outOfOrder: "out-of-order completion (IDs)",
  concurrentReadWrite: "reads and writes in progress at once",
  ioCoherent: "requests that are coherent with other caches",
  snooped: "its own cache that the system can snoop",
  networkLayer: "packets, node IDs and link credits for a large network",
};

/** A channel or phase lane, from the initiator's point of view. */
export interface Lane {
  name: string;
  /** "out" = initiator to completer; "in" = completer (or interconnect) to initiator. */
  dir: "out" | "in";
  carries: string;
}

export interface AmbaProtocol {
  id: AmbaProtocolId;
  name: string;
  fullName: string;
  spec: string;
  tagline: string;
  summary: string;
  lanes: Lane[];
  facts: Record<FactKey, Fact>;
  /** Engineering practice, not normative. */
  typicalUse: string;
  caveat?: string;
  capabilities: Record<Capability, boolean>;
}

const caps = (on: Capability[]): Record<Capability, boolean> =>
  Object.fromEntries(CAPABILITIES.map((c) => [c, on.includes(c)])) as Record<Capability, boolean>;

const AXI_LANES: Lane[] = [
  { name: "AW", dir: "out", carries: "write address and control" },
  { name: "W", dir: "out", carries: "write data, WSTRB, WLAST" },
  { name: "B", dir: "in", carries: "one write response per transaction" },
  { name: "AR", dir: "out", carries: "read address and control" },
  { name: "R", dir: "in", carries: "read data, RRESP per beat, RLAST" },
];

const AXI4_FAMILY_CAPS: Capability[] = ["addressed", "backToBack", "bursts", "outstanding", "outOfOrder", "concurrentReadWrite"];

export const AMBA_PROTOCOLS: AmbaProtocol[] = [
  {
    id: "apb",
    name: "APB",
    fullName: "Advanced Peripheral Bus",
    spec: "Arm IHI0024D (APB2 to APB5)",
    tagline: "a non-pipelined register bus, one transfer at a time",
    summary:
      "The low-cost peripheral bus. Designed for the programmable control registers of peripherals, reached through a bridge from AHB or AXI. Data buses are at most 32 bits wide.",
    lanes: [
      { name: "SETUP", dir: "out", carries: "PSEL high, PENABLE low: address, PWRITE, write data" },
      { name: "ACCESS", dir: "out", carries: "PENABLE high until the completer drives PREADY high" },
      { name: "PRDATA / PREADY / PSLVERR", dir: "in", carries: "read data, completion and error in the last ACCESS cycle" },
    ],
    facts: {
      channels: {
        text: "One shared signal set. Each transfer is a SETUP cycle (PSEL high, PENABLE low), then ACCESS cycles (PENABLE high) until PREADY is high.",
        source: "IHI0024D §4.1",
      },
      pipelining: { support: "no", text: "Not pipelined. Every transfer takes at least two cycles.", source: "IHI0024D §1.1" },
      bursts: { support: "no", text: "Single transfers only; the specification defines no bursts.", source: "IHI0024D §3.1, §3.3" },
      outstanding: { support: "no", text: "One transfer at a time and no transaction IDs.", source: "IHI0024D §4.1" },
      ordering: { support: "no", text: "Transfers complete one by one, in issue order.", source: "IHI0024D §4.1" },
      strobes: {
        support: "optional",
        text: "PSTRB, one bit per byte lane (APB4 onwards, optional). It must be LOW for reads.",
        source: "IHI0024D §3.2",
      },
      errors: {
        support: "optional",
        text: "PSLVERR (APB3 onwards, optional), valid only in the last ACCESS cycle. A write that errors may still have changed the register.",
        source: "IHI0024D §3.4",
      },
      coherency: { support: "no", text: "None.", source: "not defined in IHI0024D" },
    },
    typicalUse: "UART, GPIO, timer and other low-bandwidth configuration registers behind an AXI-to-APB or AHB-to-APB bridge.",
    capabilities: caps(["addressed"]),
  },
  {
    id: "ahb",
    name: "AHB",
    fullName: "Advanced High-performance Bus (AHB-Lite / AHB5)",
    spec: "Arm IHI0033B.b",
    tagline: "a pipelined bus with bursts but only one transfer in each phase",
    summary:
      "Address and data phases overlap: the next transfer's address phase runs during the current transfer's data phase. A single master needs only a decoder and a multiplexor.",
    lanes: [
      { name: "Address phase", dir: "out", carries: "HADDR, HTRANS, HWRITE, HSIZE, HBURST" },
      { name: "HWDATA", dir: "out", carries: "write data in the data phase" },
      { name: "HRDATA / HREADY / HRESP", dir: "in", carries: "read data, wait states and the response in the data phase" },
    ],
    facts: {
      channels: {
        text: "One address/control phase and one data phase per transfer, with separate write (HWDATA) and read (HRDATA) data buses.",
        source: "IHI0033B.b §3.1, §6.1",
      },
      pipelining: {
        support: "yes",
        text: "The next transfer's address phase overlaps the current data phase. HREADY low extends the data phase.",
        source: "IHI0033B.b §3.1",
      },
      bursts: {
        support: "yes",
        text: "SINGLE, INCR (undefined length), INCR4/8/16 and WRAP4/8/16. An incrementing burst must not cross a 1KB boundary.",
        source: "IHI0033B.b §3.5, Table 3-3",
      },
      outstanding: {
        support: "limited",
        text: "Only the pipeline overlap: one transfer in its data phase while the next waits in its address phase. No transaction IDs.",
        source: "IHI0033B.b §3.1",
      },
      ordering: { support: "no", text: "Transfers complete in the order they were issued.", source: "IHI0033B.b §3.1" },
      strobes: {
        support: "no",
        text: "No byte strobes in this issue. HSIZE and HADDR select the active byte lanes of a narrow transfer.",
        source: "IHI0033B.b §6.1.1",
      },
      errors: {
        support: "yes",
        text: "HRESP OKAY, or ERROR, which takes two cycles so the master can cancel the transfer already in its address phase. AHB5 exclusive transfers add HEXOKAY.",
        source: "IHI0033B.b §5.1, Chapter 8",
      },
      coherency: { support: "no", text: "None.", source: "not defined in IHI0033B.b" },
    },
    typicalUse: "Microcontroller-class systems: on-chip memories, external memory interfaces and high-bandwidth peripherals, with a bridge down to APB.",
    caveat:
      "A multi-master AHB system needs an interconnect that arbitrates, for example a multi-layer interconnect; IHI0033B.b leaves its design out of scope (§1.1.3). The older AMBA 2 AHB (IHI0011A) put request/grant arbitration and SPLIT/RETRY responses inside the protocol; that issue was not checked here.",
    capabilities: caps(["addressed", "backToBack", "bursts"]),
  },
  {
    id: "axi3",
    name: "AXI3",
    fullName: "Advanced eXtensible Interface, version 3",
    spec: "Arm IHI0022E (Part A)",
    tagline: "five independent channels, bursts of up to 16 beats and write interleaving",
    summary:
      "Five independent channels, each with its own VALID/READY handshake. Many transactions can be in flight, tagged with IDs. AXI3 alone allows write-data interleaving (WID) and locked transactions.",
    lanes: AXI_LANES,
    facts: {
      channels: {
        text: "Five independent channels: AW, W and B for writes, AR and R for reads. Each has its own VALID/READY handshake.",
        source: "IHI0022E §A1.3, §A3.2.1",
      },
      pipelining: {
        support: "yes",
        text: "Addresses can be issued ahead of data, and write data may even arrive before its address.",
        source: "IHI0022E §A1.3, §A3.3",
      },
      bursts: {
        support: "yes",
        text: "1 to 16 beats for FIXED, INCR and WRAP (WRAP length 2, 4, 8 or 16). No burst may cross a 4KB boundary.",
        source: "IHI0022E §A3.4.1",
      },
      outstanding: {
        support: "yes",
        text: "Many transactions in flight, tagged with AWID or ARID. AXI3 also tags write data with WID.",
        source: "IHI0022E §A5.1, §A5.2",
      },
      ordering: {
        support: "yes",
        text: "Different IDs may complete in any order; the same ID stays in order. Write data with different IDs may be interleaved.",
        source: "IHI0022E §A5.3",
      },
      strobes: { support: "yes", text: "WSTRB, one bit per byte lane of WDATA.", source: "IHI0022E §A3.4.3" },
      errors: {
        support: "yes",
        text: "OKAY, EXOKAY, SLVERR, DECERR: per beat on RRESP, once per burst on BRESP.",
        source: "IHI0022E §A3.4.4",
      },
      coherency: { support: "no", text: "None. Coherency is added by ACE (Part C).", source: "IHI0022E §C1.2.1" },
    },
    typicalUse: "Legacy high-performance IP and older SoCs.",
    caveat: "AXI3 must support locked transactions; AXI4 removed them (§A7.3).",
    capabilities: caps(AXI4_FAMILY_CAPS),
  },
  {
    id: "axi4",
    name: "AXI4",
    fullName: "Advanced eXtensible Interface, version 4",
    spec: "Arm IHI0022E (Part A)",
    tagline: "five independent channels, long INCR bursts, IDs and many outstanding transactions",
    summary:
      "The high-performance memory-mapped protocol. Independent read and write channels, INCR bursts of up to 256 beats, and many outstanding transactions that can complete out of order across IDs.",
    lanes: AXI_LANES,
    facts: {
      channels: {
        text: "Five independent channels: AW, W and B for writes, AR and R for reads. Each has its own VALID/READY handshake.",
        source: "IHI0022E §A1.3, §A3.2.1",
      },
      pipelining: {
        support: "yes",
        text: "Addresses can be issued ahead of data, and write data may even arrive before its address.",
        source: "IHI0022E §A1.3, §A3.3",
      },
      bursts: {
        support: "yes",
        text: "INCR 1 to 256 beats; FIXED and WRAP 1 to 16 (WRAP length 2, 4, 8 or 16). No burst may cross a 4KB boundary.",
        source: "IHI0022E §A3.4.1",
      },
      outstanding: {
        support: "yes",
        text: "Many transactions in flight, tagged with AWID or ARID; BID and RID return the tag.",
        source: "IHI0022E §A5.1, §A5.2",
      },
      ordering: {
        support: "yes",
        text: "Different IDs may complete in any order; the same ID stays in order. No write interleaving: WID is gone, so write data follows address order.",
        source: "IHI0022E §A5.3, §A5.4",
      },
      strobes: { support: "yes", text: "WSTRB, one bit per byte lane of WDATA.", source: "IHI0022E §A3.4.3" },
      errors: {
        support: "yes",
        text: "OKAY, EXOKAY, SLVERR, DECERR: per beat on RRESP, once per burst on BRESP.",
        source: "IHI0022E §A3.4.4",
      },
      coherency: { support: "no", text: "None. Coherency is added by ACE (Part C).", source: "IHI0022E §C1.2.1" },
    },
    typicalUse: "DMA engines, memory controllers, high-bandwidth accelerators and the main SoC interconnect.",
    capabilities: caps(AXI4_FAMILY_CAPS),
  },
  {
    id: "axi4-lite",
    name: "AXI4-Lite",
    fullName: "AXI4-Lite",
    spec: "Arm IHI0022E (Chapter B1)",
    tagline: "AXI4 channels with single-beat accesses and no IDs",
    summary:
      "A subset of AXI4 for control-register interfaces. Same five channels and handshakes, but every access is one beat of the full bus width (32 or 64 bits) and there are no IDs.",
    lanes: AXI_LANES,
    facts: {
      channels: {
        text: "The same five channels and handshakes, without the ID, LEN, SIZE, BURST, LOCK and CACHE signals.",
        source: "IHI0022E §B1.1.1",
      },
      pipelining: {
        support: "yes",
        text: "Channels stay independent, so a master may issue the next address before the previous response returns.",
        source: "IHI0022E §B1.1.4",
      },
      bursts: { support: "no", text: "Every transaction is one beat using the full data width (32 or 64 bits).", source: "IHI0022E §B1.1, §B1.1.2" },
      outstanding: {
        support: "limited",
        text: "Multiple outstanding transactions are allowed, but a slave may throttle them, and there are no IDs.",
        source: "IHI0022E §B1.1.4",
      },
      ordering: { support: "no", text: "No IDs, so every transaction completes in order.", source: "IHI0022E §B1.1.4" },
      strobes: {
        support: "yes",
        text: "WSTRB is supported. A slave may use the strobes, ignore them, or return an error for patterns it does not support.",
        source: "IHI0022E §B1.1.3",
      },
      errors: {
        support: "limited",
        text: "OKAY, SLVERR, DECERR. EXOKAY is not supported because exclusive accesses are not.",
        source: "IHI0022E §B1.1, §B1.1.1",
      },
      coherency: { support: "no", text: "None.", source: "IHI0022E §B1.1" },
    },
    typicalUse: "Control and status registers of IP that already sits on an AXI interconnect.",
    capabilities: caps(["addressed", "backToBack", "outstanding", "concurrentReadWrite"]),
  },
  {
    id: "axi4-stream",
    name: "AXI4-Stream",
    fullName: "AXI4-Stream",
    spec: "Arm IHI0051A",
    tagline: "one unidirectional data channel with no addresses",
    summary:
      "Moves a stream of data in one direction with a VALID/READY handshake. There are no addresses, reads, writes or responses. TLAST groups transfers into packets.",
    lanes: [
      { name: "T", dir: "out", carries: "TVALID, TDATA, TSTRB, TKEEP, TLAST, TID, TDEST, TUSER" },
      { name: "TREADY", dir: "in", carries: "back-pressure from the receiver" },
    ],
    facts: {
      channels: {
        text: "One transfer channel: TVALID/TREADY with TDATA and optional TSTRB, TKEEP, TLAST, TID, TDEST and TUSER.",
        source: "IHI0051A §2.1, §2.2.1",
      },
      pipelining: {
        support: "n/a",
        text: "No address phase. A transfer completes on every cycle in which TVALID and TREADY are both high.",
        source: "IHI0051A §2.2.1",
      },
      bursts: { support: "no", text: "No address bursts. TLAST marks packet boundaries instead.", source: "IHI0051A §2.5" },
      outstanding: { support: "n/a", text: "No requests and no responses, so nothing is outstanding.", source: "IHI0051A §2.1" },
      ordering: {
        support: "no",
        text: "Transfers are never reordered. Transfers of different streams (TID/TDEST) may be interleaved.",
        source: "IHI0051A §4.2, §2.6",
      },
      strobes: {
        support: "optional",
        text: "TKEEP marks bytes to transport; TSTRB marks data bytes versus position bytes.",
        source: "IHI0051A §2.4",
      },
      errors: { support: "no", text: "No response channel, so no error response.", source: "IHI0051A §2.1" },
      coherency: { support: "no", text: "None.", source: "not defined in IHI0051A" },
    },
    typicalUse: "Video, DSP and packet pipelines between processing blocks; DMA engines use it on their streaming side.",
    capabilities: caps(["backToBack"]),
  },
  {
    id: "ace",
    name: "ACE",
    fullName: "AXI Coherency Extensions",
    spec: "Arm IHI0022E (Part C)",
    tagline: "AXI4 plus snoop channels, so a cached master stays hardware-coherent",
    summary:
      "Extends AXI4 for masters with hardware-coherent caches. The interconnect can snoop the master's cache over three extra channels, and the protocol defines a five-state cache model.",
    lanes: [
      ...AXI_LANES,
      { name: "AC", dir: "in", carries: "snoop address from the interconnect" },
      { name: "CR", dir: "out", carries: "snoop response" },
      { name: "CD", dir: "out", carries: "snoop data (optional channel)" },
    ],
    facts: {
      channels: {
        text: "AXI4's five channels with extra coherency signals, plus snoop channels AC (into the master), CR and CD (out of it), and RACK/WACK acknowledges.",
        source: "IHI0022E §C1.3.1 to §C1.3.3",
      },
      pipelining: { support: "yes", text: "As AXI4: ACE extends the AXI4 protocol.", source: "IHI0022E §C1.2.1" },
      bursts: { support: "yes", text: "As AXI4.", source: "IHI0022E §C1.2.1" },
      outstanding: { support: "yes", text: "As AXI4.", source: "IHI0022E §C1.2.1" },
      ordering: { support: "yes", text: "As AXI4 for each ID.", source: "IHI0022E §C1.2.1" },
      strobes: { support: "yes", text: "As AXI4 (WSTRB).", source: "IHI0022E §C1.3.1" },
      errors: {
        support: "yes",
        text: "AXI4 responses, plus RRESP[2] PassDirty and RRESP[3] IsShared to report the cache-line state.",
        source: "IHI0022E §C1.3.1, §C3.2.1",
      },
      coherency: {
        support: "yes",
        text: "Full: the master's cache is snooped over AC/CR/CD, using a five-state cache model.",
        source: "IHI0022E §C1.2.1, §C1.3.2",
      },
    },
    typicalUse: "Cache-coherent CPU clusters connected to a coherent interconnect.",
    capabilities: caps([...AXI4_FAMILY_CAPS, "ioCoherent", "snooped"]),
  },
  {
    id: "ace-lite",
    name: "ACE-Lite",
    fullName: "ACE-Lite",
    spec: "Arm IHI0022E (Chapter C11)",
    tagline: "AXI4 plus coherent request types, but no cache to snoop",
    summary:
      "For masters without hardware-coherent caches that still need coherent access to shared data. Extra signals on AR and AW only; no snoop channels.",
    lanes: AXI_LANES,
    facts: {
      channels: {
        text: "AXI4's five channels with extra signals on AR and AW only. No snoop channels and no RACK/WACK.",
        source: "IHI0022E §C11.1",
      },
      pipelining: { support: "yes", text: "As AXI4.", source: "IHI0022E §C11.1" },
      bursts: { support: "yes", text: "As AXI4.", source: "IHI0022E §C11.1" },
      outstanding: { support: "yes", text: "As AXI4.", source: "IHI0022E §C11.1" },
      ordering: { support: "yes", text: "As AXI4 for each ID.", source: "IHI0022E §C11.1" },
      strobes: { support: "yes", text: "As AXI4 (WSTRB).", source: "IHI0022E §C11.1" },
      errors: { support: "yes", text: "As AXI4, with no additional read response bits.", source: "IHI0022E §C11.1" },
      coherency: {
        support: "limited",
        text: "I/O (one-way) coherency: it can issue Shareable requests such as ReadOnce and WriteUnique, but it has no cache to be snooped.",
        source: "IHI0022E §C11.1, §C11.2",
      },
    },
    typicalUse: "GPUs, DMA engines and accelerators without coherent caches that must see, and update, data held in CPU caches.",
    capabilities: caps([...AXI4_FAMILY_CAPS, "ioCoherent"]),
  },
  {
    id: "chi",
    name: "CHI",
    fullName: "Coherent Hub Interface",
    spec: "Arm IHI0050E.b (AMBA 5 CHI)",
    tagline: "a packetized, credit-based coherent protocol for large networks",
    summary:
      "Layered into protocol, network and link layers. Messages travel as flits on REQ, RSP, SNP and DAT channels between request, home and subordinate nodes, so the interconnect can be a ring or a mesh.",
    lanes: [
      { name: "TXREQ", dir: "out", carries: "requests" },
      { name: "TXRSP", dir: "out", carries: "snoop responses and completion acknowledge" },
      { name: "TXDAT", dir: "out", carries: "write, atomic, snoop and forwarded data" },
      { name: "RXRSP", dir: "in", carries: "responses from the completer" },
      { name: "RXDAT", dir: "in", carries: "read and atomic data" },
      { name: "RXSNP", dir: "in", carries: "snoop requests (fully coherent requesters)" },
    ],
    facts: {
      channels: {
        text: "Packetized channels REQ, RSP, SNP and DAT, carried as flits over links, and layered into protocol, network and link layers.",
        source: "IHI0050E.b §2.1, §1.1.2",
      },
      pipelining: {
        support: "yes",
        text: "Many requests in flight across the network. Each flit needs a link-layer credit; a receiver grants 1 to 15 per channel.",
        source: "IHI0050E.b §14.2",
      },
      bursts: {
        support: "no",
        text: "No AXI-style bursts. A transaction moves at most 64 bytes, one cache line, split into data flits.",
        source: "IHI0050E.b §2.10.1, Table 2-14",
      },
      outstanding: { support: "yes", text: "Transactions are tracked by TxnID together with source and target node IDs.", source: "IHI0050E.b §2.4" },
      ordering: {
        support: "yes",
        text: "No ordering between transactions unless the Order field requests request or endpoint ordering.",
        source: "IHI0050E.b §2.8",
      },
      strobes: { support: "yes", text: "BE byte enables on write data and snoop data.", source: "IHI0050E.b §2.10.3" },
      errors: {
        support: "yes",
        text: "RespErr: OK, EXOK, DERR (data error) or NDERR (non-data error).",
        source: "IHI0050E.b §9.2, Table 9-1",
      },
      coherency: {
        support: "yes",
        text: "Full: RN-F nodes hold snoopable caches, RN-I and RN-D are I/O coherent, and HN-F home nodes manage coherence.",
        source: "IHI0050E.b §1.6",
      },
    },
    typicalUse: "Large coherent systems: many CPU clusters, home nodes and memory controllers on a ring or mesh.",
    caveat: "Flow control has two levels: link-layer credits for every hop (§14.2) and protocol retry, RetryAck then PCrdGrant (§2.11).",
    capabilities: caps(["addressed", "backToBack", "outstanding", "outOfOrder", "concurrentReadWrite", "ioCoherent", "snooped", "networkLayer"]),
  },
];

export function getProtocol(id: AmbaProtocolId): AmbaProtocol {
  const found = AMBA_PROTOCOLS.find((p) => p.id === id);
  if (!found) throw new Error(`Unknown AMBA protocol ${id}`);
  return found;
}

// ---------------------------------------------------------------------------
// "Which protocol fits this block?"
// ---------------------------------------------------------------------------

export interface FitOption {
  protocol: AmbaProtocolId;
  /** Diagnoses the reasoning behind choosing this protocol. */
  feedback: string;
}

export interface FitScenario {
  id: string;
  /** Short name for the scenario selector. */
  label: string;
  block: string;
  /** Capabilities the block cannot work without. */
  needs: Capability[];
  /** Capabilities that would only add wires, gates or verification effort here. */
  avoid: Capability[];
  options: FitOption[];
  why: string;
}

export interface FitAssessment {
  protocol: AmbaProtocolId;
  missing: Capability[];
  extras: Capability[];
}

export function assessFit(protocolId: AmbaProtocolId, scenario: Pick<FitScenario, "needs" | "avoid">): FitAssessment {
  const { capabilities } = getProtocol(protocolId);
  return {
    protocol: protocolId,
    missing: scenario.needs.filter((c) => !capabilities[c]),
    extras: scenario.avoid.filter((c) => capabilities[c]),
  };
}

/**
 * Best fit among the scenario's options: nothing the block needs is missing,
 * and the fewest unneeded extras. Returns null when there is no unique best.
 */
export function bestFit(scenario: FitScenario): AmbaProtocolId | null {
  const viable = scenario.options.map((o) => assessFit(o.protocol, scenario)).filter((a) => a.missing.length === 0);
  if (viable.length === 0) return null;
  const fewest = Math.min(...viable.map((a) => a.extras.length));
  const winners = viable.filter((a) => a.extras.length === fewest);
  return winners.length === 1 ? winners[0].protocol : null;
}

export const FIT_SCENARIOS: FitScenario[] = [
  {
    id: "uart",
    label: "UART registers",
    block:
      "A UART's configuration and status registers. The CPU writes the baud rate once and polls a status register now and then. Gate count and power matter more than speed.",
    needs: ["addressed"],
    avoid: ["bursts", "outstanding", "outOfOrder", "concurrentReadWrite", "ioCoherent", "snooped", "networkLayer"],
    options: [
      {
        protocol: "apb",
        feedback:
          "APB was designed for exactly this: programmable control registers behind a bridge (IHI0024D §1.1). Two cycles per access is irrelevant at polling rates, and the interface is the smallest in the family.",
      },
      {
        protocol: "axi4-lite",
        feedback:
          "AXI4-Lite works and is common when the peripheral sits directly on an AXI interconnect. But it brings five channels and outstanding-transaction handling that occasional register accesses never use; behind a bridge, APB is cheaper.",
      },
      {
        protocol: "axi4",
        feedback:
          "Bursts, IDs and out-of-order completion buy nothing for occasional single-register accesses, and every one of them costs gates and verification effort.",
      },
      {
        protocol: "ace",
        feedback: "Coherency keeps caches in agreement. A UART register is not cached, so the snoop channels would be dead weight.",
      },
    ],
    why: "The block only needs addresses. APB provides them with nothing extra to pay for.",
  },
  {
    id: "dma",
    label: "DMA engine",
    block:
      "A DMA engine that copies 4KB buffers from DDR to a peripheral. DDR latency is long, so it wants many reads in flight while earlier data is still being written out.",
    needs: ["addressed", "bursts", "outstanding", "concurrentReadWrite"],
    avoid: ["snooped", "networkLayer"],
    options: [
      {
        protocol: "apb",
        feedback:
          "APB has no bursts, no pipelining and only one transfer at a time (IHI0024D §1.1, §4.1). Each word would pay the full DDR latency.",
      },
      {
        protocol: "ahb",
        feedback:
          "AHB has bursts, but only one transfer can be in its data phase while the next waits in its address phase (IHI0033B.b §3.1). It cannot keep many DDR reads in flight, and reads and writes share one pipeline.",
      },
      {
        protocol: "axi4",
        feedback:
          "AXI4 gives INCR bursts of up to 256 beats (§A3.4.1), many outstanding transactions with IDs (§A5.1), and independent read and write channels, so reads stream in while writes drain.",
      },
      {
        protocol: "axi4-stream",
        feedback:
          "AXI4-Stream has no addresses (IHI0051A §2.1), and a DMA must address DDR. It may still use AXI4-Stream on its peripheral side.",
      },
    ],
    why: "The block needs addresses, bursts, many transactions in flight, and reads and writes in parallel. AXI4 is the smallest option that has all four.",
  },
  {
    id: "cpu-cluster",
    label: "Coherent CPU cluster",
    block:
      "A cluster of four CPU cores with private caches. Their caches, and the rest of the system, must see one consistent value for every shared line without software cache flushes.",
    needs: ["addressed", "outstanding", "snooped"],
    avoid: ["networkLayer"],
    options: [
      {
        protocol: "ahb",
        feedback: "AHB has no coherency signalling at all, and only one transfer in each pipeline phase.",
      },
      {
        protocol: "axi4",
        feedback:
          "AXI4 cannot snoop a cache: there are no snoop channels. Software would have to clean and invalidate caches by hand.",
      },
      {
        protocol: "ace-lite",
        feedback:
          "ACE-Lite has no snoop address, response or data channels (IHI0022E §C11.1). Its requests can be coherent with other caches, but nothing can snoop the cluster's own caches.",
      },
      {
        protocol: "ace",
        feedback:
          "ACE adds snoop channels AC, CR and CD so the interconnect can query and update each cached master (IHI0022E §C1.3.2). CHI would also be coherent; it pays off on larger ring or mesh interconnects (next scenario).",
      },
    ],
    why: "Cached masters must be snoopable. Of these options only ACE has snoop channels.",
  },
  {
    id: "gpu",
    label: "I/O-coherent accelerator",
    block:
      "A GPU-style accelerator with no hardware-coherent cache. It reads buffers that CPUs may still hold dirty in their caches, and it must not need software flushes.",
    needs: ["addressed", "bursts", "outstanding", "ioCoherent"],
    avoid: ["snooped", "networkLayer"],
    options: [
      {
        protocol: "axi4",
        feedback:
          "AXI4 reads go straight past the CPU caches, so the accelerator could read stale memory unless software cleans the caches first.",
      },
      {
        protocol: "ace-lite",
        feedback:
          "ACE-Lite lets a master without a coherent cache issue Shareable requests such as ReadOnce and WriteUnique, which the interconnect makes coherent with the CPU caches (IHI0022E §C11.1, §C11.2).",
      },
      {
        protocol: "ace",
        feedback:
          "Full ACE also requires the master to answer snoops for a cache it does not have. That is snoop logic and verification with no benefit.",
      },
      {
        protocol: "axi4-stream",
        feedback: "AXI4-Stream has no addresses, so it cannot read a buffer in memory, coherent or not.",
      },
    ],
    why: "The block needs coherent requests but has no cache to snoop: I/O (one-way) coherency, which is what ACE-Lite provides.",
  },
  {
    id: "video",
    label: "Video pipeline",
    block:
      "A scaler that hands pixels to an encoder, one pixel group per clock, with end-of-line markers. Neither block has an address map.",
    needs: ["backToBack"],
    avoid: ["addressed", "bursts", "outstanding", "outOfOrder", "concurrentReadWrite", "ioCoherent", "snooped", "networkLayer"],
    options: [
      {
        protocol: "apb",
        feedback: "APB needs at least two cycles per transfer (IHI0024D §1.1), so it cannot move a pixel group every clock.",
      },
      {
        protocol: "axi4-lite",
        feedback: "AXI4-Lite would invent addresses and responses for data that has neither, and still carries five channels.",
      },
      {
        protocol: "axi4",
        feedback: "AXI4 adds addresses, bursts and IDs that a point-to-point pixel stream never uses.",
      },
      {
        protocol: "axi4-stream",
        feedback:
          "AXI4-Stream moves data in one direction with VALID/READY back-pressure and no addresses; TLAST can mark the end of each line (IHI0051A §2.2.1, §2.5).",
      },
    ],
    why: "The block needs one transfer per clock and nothing else. AXI4-Stream is the only option without unused address machinery.",
  },
  {
    id: "mesh",
    label: "Many-core mesh",
    block:
      "A server SoC with 64 coherent cores, many home nodes and several memory controllers, connected by a mesh network.",
    needs: ["addressed", "outstanding", "snooped", "networkLayer"],
    avoid: [],
    options: [
      {
        protocol: "axi4",
        feedback: "AXI4 has neither coherency nor a network layer.",
      },
      {
        protocol: "ace-lite",
        feedback: "ACE-Lite cannot be snooped, so the cores' caches could not be kept coherent, and it has no network layer.",
      },
      {
        protocol: "ace",
        feedback:
          "ACE is coherent, but it defines point-to-point channels between one master and the interconnect: no packets, node IDs or link credits for routing across a mesh.",
      },
      {
        protocol: "chi",
        feedback:
          "CHI separates protocol, network and link layers (IHI0050E.b §1.1.2): messages are packets with node IDs, carried as flits under link-layer credits, which is what a mesh with many home nodes needs.",
      },
    ],
    why: "The cores must be snoopable and the interconnect is a routed network. Only CHI has both coherency and a network layer.",
  },
];

export function getFitScenario(id: string): FitScenario {
  const found = FIT_SCENARIOS.find((s) => s.id === id);
  if (!found) throw new Error(`Unknown fit scenario ${id}`);
  return found;
}
