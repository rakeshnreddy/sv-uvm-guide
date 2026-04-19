# AHB / AXI Protocol Curriculum Expansion Plan

## Objective
Build an exhaustive, intuitive, and visually memorable AMBA protocol workstream that teaches AHB and AXI end to end: protocol intent, intuitive analogies, signal timing, micro-architectural tradeoffs, expert-level features (QoS, Atomics, Security), real-world pitfalls, UVM/SVA-based verification strategy, debug methodology, and interview readiness. The target outcome is a permanent mental model of how these protocols work, how they fail, and how to verify them, acting as a base for understanding any future protocol.

## Why This Workstream Exists
- The current curriculum mentions protocols in examples, but there is no focused AHB/AXI path.
- Protocol learning requires an intuitive foundation (analogies/memory hooks) before diving into signal-level diagrams.
- Learners need both protocol-design understanding and verification methodology, not just one or the other.
- Advanced features (Atomics, QoS, Security) and pitfalls (Deadlocks) are often undocumented tribal knowledge.
- AHB and AXI are common interview surfaces, especially for SoC, fabric, bridge, and VIP roles.

## Placement In The Current Curriculum
- `T3_Advanced` carries the main protocol teaching sequence so it lands after interfaces, SVA, checkers, sequencing, VIP, and scoreboards.
- `T4_Expert` holds the bridge, system integration, future protocols (ACE/CHI), and debug/interview material.
- Recommended future directory slugs:
  - `content/curriculum/T3_Advanced/B-AMBA-1_Protocol_Families_and_Tradeoffs`
  - `content/curriculum/T3_Advanced/B-AMBA-2_Protocol_Intuition_and_Memory_Hooks`
  - `content/curriculum/T3_Advanced/B-AHB-1_AHB_Design_Timing_Mechanics`
  - `content/curriculum/T3_Advanced/B-AHB-2_AHB_Pitfalls_and_Failures`
  - `content/curriculum/T3_Advanced/B-AHB-3_AHB_Verification_and_Debug`
  - `content/curriculum/T3_Advanced/B-AXI-1_AXI_Channel_Architecture_Contract`
  - `content/curriculum/T3_Advanced/B-AXI-2_AXI_Bursts_Addressing_Math`
  - `content/curriculum/T3_Advanced/B-AXI-3_AXI_Ordering_IDs_Outstanding_Tx`
  - `content/curriculum/T3_Advanced/B-AXI-4_AXI_Expert_Features_Cache_Atomics`
  - `content/curriculum/T3_Advanced/B-AXI-5_AXI_Pitfalls_Interconnect_Deadlocks`
  - `content/curriculum/T3_Advanced/B-AXI-6_AXI_Verification_Performance`
  - `content/curriculum/T4_Expert/F-AMBA-1_Bridges_Formal_System_Integration`
  - `content/curriculum/T4_Expert/F-AMBA-2_Future_Protocols_ACE_CHI`
  - `content/curriculum/T4_Expert/F-AMBA-3_Interview_and_Debug_Clinic`

## Module Map

| Module | Focus | Lessons / Sub-lessons | Visuals / Labs |
| --- | --- | --- | --- |
| `B-AMBA-1` | AMBA family overview | 1. Why on-chip buses exist. 2. AHB vs AHB-Lite vs AXI4 vs AXI4-Lite vs AXI4-Stream. 3. Terminology: beat, burst, outstanding, backpressure. 4. Design Tradeoffs. | `AmbaFamilyExplorer`, quick interview drill |
| `B-AMBA-2` | Protocol Intuition & Memory Hooks | 1. Visual analogies for shared bus vs. point-to-point interconnect. 2. AXI Channels as a "Mail Delivery System". 3. Decoupling principles. | `ProtocolAnalogyExplorer` |
| `B-AHB-1` | AHB protocol design and mechanics | 1. Signal taxonomy (`HADDR`, `HTRANS`, `HWRITE`, `HSIZE`, `HBURST`). 2. Address/data phase pipelining. 3. Wait-state insertion. 4. Burst types and alignment rules. | `AhbPipelineBurstVisualizer`, waveform diagrams |
| `B-AHB-2` | AHB Pitfalls & Real-World Failures | 1. Mishandling `HREADY`. 2. Slave `ERROR` responses and 2-cycle mechanics. 3. Arbitration deadlocks (full AHB vs AHB-Lite). 4. Boundary cross failures. | Annotated failure waveforms |
| `B-AHB-3` | AHB verification and debug | 1. Transaction abstraction and sequence items. 2. VIP architecture. 3. Assertions for stable controls. 4. Coverage model. 5. Debug diary. | AHB checker lab, reuse `SvaSequenceWaveformVisualizer` |
| `B-AXI-1` | AXI channel architecture | 1. Five independent channels. 2. VALID/READY handshake contract. 3. End-to-end write/read flow. 4. Avoiding combinatorial loops. | `AxiChannelHandshakeVisualizer`, channel swimlanes |
| `B-AXI-2` | AXI bursts and data math | 1. Burst math (`LEN`, `SIZE`, `BURST`). 2. Address wrap behavior. 3. `WSTRB` and partial/sparse writes. 4. 4 KB boundary rule. | `AxiMemoryMathVisualizer` |
| `B-AXI-3` | AXI Ordering and IDs | 1. Outstanding transactions. 2. ID-based routing. 3. In-order vs Out-of-order completion. 4. Interconnect reordering limits. | `AxiIdOrderingVisualizer` |
| `B-AXI-4` | AXI Expert Features | 1. `AxCACHE` (Bufferable/Cacheable). 2. `AxPROT` (Secure/Privilege). 3. `AxQOS` for fabric routing. 4. Exclusive Accesses (`LDREX`/`STREX` and `EXOKAY`). | `ExclusiveAccessVisualizer` |
| `B-AXI-5` | AXI Pitfalls & Deadlocks | 1. Channel dependency deadlocks (e.g., WAITING on WVALID before AWREADY). 2. Cyclic interconnect deadlocks. 3. Cross-page boundary violations. 4. Misaligned strobes. | `AxiDeadlockSimulator` |
| `B-AXI-6` | AXI verification & performance | 1. Channel-level monitor reconstruction. 2. Scoreboards for in-order and per-ID flows. 3. Protocol assertions (`LAST`, stability). 4. Latency measurement. | AXI scoreboard lab, reuse `CoverageCrossExplorerVisualizer` |
| `F-AMBA-1` | Bridges, formal, system integration | 1. AHB↔AXI translations. 2. Burst splitting/merging hazards. 3. Formal/property strategy. 4. Reset and Clock Domain Crossing (CDC). | `BridgeTranslationExplorer`, bridge debug lab |
| `F-AMBA-2` | Future Protocols: ACE & CHI | 1. Cache coherency problems in multi-core SoCs. 2. ACE snooping channels. 3. AMBA 5 CHI ring/mesh networks preview. | System-level architecture diagrams |
| `F-AMBA-3` | Interview and debug clinic | 1. Whiteboard design questions. 2. Waveform triage drills. 3. Verification test-plan prompts. 4. Common trick questions. | `InterviewQuestionPlayground`, debug waveform sets |

## Visualizer Roadmap

| Component | Purpose | Used In |
| --- | --- | --- |
| `ProtocolWaveform` | MDX-friendly timing diagram wrapper. | All protocol modules |
| `AmbaFamilyExplorer` | Compare bus families, topologies, and common use cases. | `B-AMBA-1` |
| `ProtocolAnalogyExplorer` | Interactive analogy (e.g., mail delivery or highway) mapping to AXI channels and decoupling. | `B-AMBA-2` |
| `AhbPipelineBurstVisualizer` | Step through AHB pipelining, wait states, and burst progression. | `B-AHB-1` |
| `AxiChannelHandshakeVisualizer` | Show independent channel handshakes and backpressure placement. | `B-AXI-1` |
| `AxiMemoryMathVisualizer` | Drag-and-drop tool to visualize 4KB boundaries, unaligned starts, and WSTRB generation. | `B-AXI-2` |
| `AxiIdOrderingVisualizer` | Show outstanding reads/writes, same-ID ordering, and interconnect reordering. | `B-AXI-3` |
| `ExclusiveAccessVisualizer` | Visualize success/failure of LDREX/STREX atomic operations across an interconnect. | `B-AXI-4` |
| `AxiDeadlockSimulator` | Visual graph of channel dependencies showing how improper stalling causes interconnect deadlock. | `B-AXI-5` |
| `BridgeTranslationExplorer` | Visualize AHB requests splitting/merging into AXI transactions. | `F-AMBA-1` |

## Required Corner Case Matrix

### AHB / AHB-Lite
- `IDLE`, `BUSY`, `NONSEQ`, and `SEQ` legality.
- Control-signal stability while `HREADY` is low.
- Single-cycle and multi-cycle wait-state insertion.
- Two-cycle `ERROR` response timing and recovery.
- Burst transitions: `SINGLE`, `INCR`, `WRAP4/8/16`, `INCR4/8/16`.
- Boundary cross failures and alignment.

### AXI
- Combinatorial loop prevention and valid channel dependencies.
- Payload stability when `VALID && !READY`.
- `WLAST` / `RLAST` placement.
- 4 KB boundary rule limits and splitting.
- `WSTRB` patterns, including sparse and unaligned partial writes.
- Out-of-order completion rules by ID.
- `EXOKAY` response rules for Exclusive Access.
- Interconnect cyclic deadlocks.

## Lab Plan

### `LAB-3-AHB-CHECKER-LAB`
- Learner builds an AHB-Lite monitor/checker from starter code.
- Required deliverables: assertion set, transaction log, failing waveform triage for `HREADY` violations.

### `LAB-4-AXI-SCOREBOARD-LAB`
- Learner reconstructs AXI traffic from decoupled channels into transaction objects.
- Required deliverables: per-ID scoreboard, outstanding queue tracking, latency stats.

### `LAB-5-AXI-DEADLOCK-HUNT` (NEW)
- Learner is given a pre-compiled interconnect with a subtle cyclic or channel-dependency deadlock.
- Required deliverables: Analyze the waveform, identify the cyclic dependency, and write a protocol assertion that catches the illegal dependency.

### `LAB-6-AHB-AXI-BRIDGE-DEBUG`
- Learner debugs a bridge bug involving burst translation and 4KB boundary splitting across an AHB-to-AXI adapter.

## Interview Coverage Plan
- Every protocol module ends with 4-6 interview questions (concept, debug, test-plan, tradeoff).
- `F-AMBA-3` adds 15-20 consolidated prompts: Foundational recall, Timing reasoning, Verification architecture, Debug triage, Whiteboard design.

## Phased Delivery
1. Shared waveform foundation and AMBA overview/intuition (AMBA-1, AMBA-2).
2. AHB Deep Dive (Design, Pitfalls, Verification) + Lab 3.
3. AXI Architecture & Mechanics (AXI-1, AXI-2, AXI-3) + Lab 4.
4. AXI Expert Features & Pitfalls (AXI-4, AXI-5, AXI-6) + Lab 5.
5. Integration, Future Protocols, and Interview Clinic (AMBA-1, AMBA-2, AMBA-3) + Lab 6.
6. Flashcards, question bank, and automated QA.
