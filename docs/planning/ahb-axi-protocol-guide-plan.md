# AHB / AXI Protocol Curriculum Expansion Plan

## Objective
Build a dedicated AMBA protocol workstream that teaches AHB and AXI end to end: protocol intent, signal timing, micro-architectural tradeoffs, UVM/SVA-based verification strategy, debug methodology, and interview readiness. The target outcome is that a learner can read a waveform, explain the protocol contract, model transactions correctly, write meaningful assertions and coverage, and defend verification choices in an interview.

## Why This Workstream Exists
- The current curriculum mentions protocols in examples, but there is no focused AHB/AXI path.
- Protocol learning is waveform-heavy; text alone is not enough.
- Learners need both protocol-design understanding and verification methodology, not just one or the other.
- AHB and AXI are common interview surfaces, especially for SoC, fabric, bridge, and VIP roles.

## Placement In The Current Curriculum
- `T3_Advanced` should carry the main protocol teaching sequence so it lands after interfaces, SVA, checkers, sequencing, VIP, and scoreboards.
- `T4_Expert` should hold the bridge/performance/formal/debug/interview material.
- Recommended future directory slugs:
  - `content/curriculum/T3_Advanced/B-AMBA-1_Protocol_Families_and_Tradeoffs`
  - `content/curriculum/T3_Advanced/B-AHB-1_AHB_Design_and_Timing`
  - `content/curriculum/T3_Advanced/B-AHB-2_AHB_Verification_and_Debug`
  - `content/curriculum/T3_Advanced/B-AXI-1_AXI_Channel_Architecture`
  - `content/curriculum/T3_Advanced/B-AXI-2_AXI_Bursts_Ordering_and_Backpressure`
  - `content/curriculum/T3_Advanced/B-AXI-3_AXI_Verification_and_Performance`
  - `content/curriculum/T4_Expert/F-AMBA-1_Bridges_Formal_and_System_Integration`
  - `content/curriculum/T4_Expert/F-AMBA-2_Interview_and_Debug_Clinic`

## Module Map

| Module | Focus | Lessons / Sub-lessons | Visuals / Labs |
| --- | --- | --- | --- |
| `B-AMBA-1` | AMBA family overview | 1. Why on-chip buses exist. 2. AHB vs AHB-Lite vs AXI4 vs AXI4-Lite vs AXI4-Stream. 3. Terminology: beat, burst, outstanding, backpressure, ordering, response. 4. When a design should choose AHB or AXI. 5. End-to-end example: simple register write over both buses. | `AmbaFamilyExplorer`, comparison tables, quick interview drill |
| `B-AHB-1` | AHB protocol design and timing | 1. Signal taxonomy (`HADDR`, `HTRANS`, `HWRITE`, `HSIZE`, `HBURST`, `HREADY`, `HRESP`). 2. Address/data phase pipelining. 3. Single transfers and wait-state insertion. 4. Burst types and alignment rules. 5. Arbitration, locking, and full-AHB vs AHB-Lite scope note. | `AhbPipelineBurstVisualizer`, waveform diagrams |
| `B-AHB-2` | AHB verification and debug | 1. Transaction abstraction and sequence items. 2. Driver/monitor/checker architecture. 3. Assertions for stable controls, legal `HTRANS`, response timing. 4. Coverage model and corner-case plan. 5. Debug diary and interview questions. | AHB checker lab, reuse `SvaSequenceWaveformVisualizer`, interview playground |
| `B-AXI-1` | AXI channel architecture | 1. Five independent channels. 2. VALID/READY contract. 3. End-to-end write flow (`AW/W/B`). 4. End-to-end read flow (`AR/R`). 5. AXI4-Lite and AXI4-Stream deltas. 6. Sideband fields (`PROT`, `CACHE`, `QOS`, `LOCK`). | `AxiChannelHandshakeVisualizer`, channel swimlanes |
| `B-AXI-2` | AXI advanced transactions | 1. Burst math (`LEN`, `SIZE`, `BURST`). 2. Address generation and wrap behavior. 3. `WSTRB` and partial writes. 4. 4 KB boundary rule. 5. Outstanding transactions, IDs, ordering, reordering. 6. Backpressure and slave acceptance limits. 7. Interconnect behavior and response propagation. | `AxiBurstAddressExplorer`, `AxiIdOrderingVisualizer` |
| `B-AXI-3` | AXI verification and performance | 1. Channel-level monitor reconstruction. 2. Scoreboards for in-order and per-ID flows. 3. Assertions for VALID hold, payload stability, `LAST`, and response legality. 4. Coverage plan. 5. Latency/performance measurement. 6. Debug and interview prompts. | AXI scoreboard lab, reuse `CoverageCrossExplorerVisualizer` |
| `F-AMBA-1` | Bridges, formal, system integration | 1. AHB↔AXI bridge translation model. 2. Burst splitting/merging hazards. 3. Response mapping and backpressure propagation. 4. Formal/property strategy for protocol fabrics. 5. Reset, CDC, and low-power integration notes. 6. Fabric performance bottlenecks. | `BridgeTranslationExplorer`, bridge debug lab |
| `F-AMBA-2` | Interview and debug clinic | 1. Whiteboard design questions. 2. Waveform triage drills. 3. Verification test-plan prompts. 4. Common trick questions and answer patterns. 5. Post-silicon style debug narratives. | `InterviewQuestionPlayground`, debug waveform sets |

## Visualizer Roadmap

| Component | Purpose | Used In |
| --- | --- | --- |
| `ProtocolWaveform` shared primitive | MDX-friendly timing diagram wrapper, ideally backed by `wavedrom` with project styling and accessible captions. | All protocol modules |
| `AmbaFamilyExplorer` | Compare bus families, topology assumptions, transaction shape, and common use cases. | `B-AMBA-1` |
| `AhbPipelineBurstVisualizer` | Step through address/data overlap, wait-state stretching, `HTRANS` transitions, and burst progression. | `B-AHB-1`, `B-AHB-2` |
| `AxiChannelHandshakeVisualizer` | Show independent channel handshakes, write/read lifecycles, and backpressure placement. | `B-AXI-1` |
| `AxiBurstAddressExplorer` | Compute beat addresses from `AxLEN`, `AxSIZE`, `AxBURST`, alignment, and wrap constraints. | `B-AXI-2` |
| `AxiIdOrderingVisualizer` | Show outstanding reads/writes, same-ID ordering, different-ID completion, and interconnect reordering. | `B-AXI-2`, `B-AXI-3` |
| `BridgeTranslationExplorer` | Visualize an AHB request becoming one or more AXI transactions, including responses and stalls. | `F-AMBA-1` |

## Reuse Instead Of Rebuilding
- Reuse `Quiz` for knowledge checks at the end of each index lesson.
- Reuse `InterviewQuestionPlayground` for waveform/debug interview drills.
- Reuse `SvaSequenceWaveformVisualizer` where assertion timing can be expressed as temporal intent instead of building a new one.
- Reuse `CoverageCrossExplorerVisualizer` for coverage-plan discussions when the goal is cross-product reasoning rather than protocol timing.
- Reuse `LabLink` for every module that points to a hands-on exercise.

## Required Corner Case Matrix

### AHB / AHB-Lite
- `IDLE`, `BUSY`, `NONSEQ`, and `SEQ` legality.
- Control-signal stability while `HREADY` is low.
- Single-cycle and multi-cycle wait-state insertion.
- `ERROR` response timing and recovery.
- Burst transitions: `SINGLE`, `INCR`, `WRAP4/8/16`, `INCR4/8/16`.
- Alignment vs `HSIZE` and address incrementing.
- Reset during in-flight transfer.
- Arbitration/lock behavior for full AHB, with explicit note on what AHB-Lite removes.

### AXI
- VALID before READY, READY before VALID, and prolonged backpressure.
- Payload stability when `VALID && !READY`.
- `WLAST` / `RLAST` placement.
- Burst types `FIXED`, `INCR`, and `WRAP`.
- Address alignment and 4 KB boundary rule.
- `WSTRB` patterns, including sparse and partial writes.
- Multiple outstanding transactions with same and different IDs.
- Ordering guarantees vs allowed reordering.
- `OKAY`, `EXOKAY`, `SLVERR`, `DECERR` response handling.
- Reset mid-flight and post-reset cleanup.

## Lab Plan

### `LAB-3-AHB-CHECKER-LAB`
- Learner builds an AHB-Lite monitor/checker from starter code.
- Required deliverables: assertion set, transaction log, coverage samples, failing waveform triage.
- Main lesson objective: move from signal observation to protocol contract enforcement.

### `LAB-4-AXI-SCOREBOARD-LAB`
- Learner reconstructs AXI traffic from decoupled channels into transaction objects.
- Required deliverables: per-ID scoreboard, outstanding queue tracking, response checking, latency stats.
- Main lesson objective: understand why AXI verification is not just a one-channel monitor problem.

### `LAB-5-AHB-AXI-BRIDGE-DEBUG`
- Learner debugs a bridge bug involving burst translation, response propagation, or backpressure deadlock.
- Main lesson objective: connect protocol theory to the sort of bugs senior engineers actually debug.

## Interview Coverage Plan
- Every protocol module should end with 4-6 interview questions: concept, waveform-debug, verification-plan, and tradeoff styles.
- `F-AMBA-2` should add 15-20 consolidated prompts grouped by difficulty:
  - Foundational recall
  - Timing/waveform reasoning
  - Verification architecture
  - Debug triage
  - Whiteboard design decisions
- Preferred answer format in content:
  - What the protocol guarantees
  - What can still go wrong
  - How verification proves it

## QA And Done Criteria
- Every new module has `Quick Take`, at least one annotated code block, one timing diagram, a quiz, flashcards, and interview prompts.
- Every interactive visualizer has a Vitest file.
- The curriculum generator must succeed and expose the new modules in navigation.
- Playwright should cover at least one navigation path through the AHB sequence and one through the AXI sequence.
- All links between lessons, labs, and flashcards must resolve.

## Phased Delivery
1. Shared waveform foundation and AMBA overview.
2. AHB content + AHB timing visualizer + AHB verification lab.
3. AXI content + AXI visualization suite + AXI scoreboard lab.
4. Bridge/formal/debug/interview expert modules.
5. Flashcards, question bank, and automated QA.
