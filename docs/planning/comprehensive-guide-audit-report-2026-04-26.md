# Comprehensive Guide Audit Report

Produced: 2026-04-26  
Audit mode: read-only external audit, converted into the active backlog on 2026-04-26  
Execution plan: `docs/planning/comprehensive-guide-enhancement-plan.md`  
Task tracker: `TASKS.md` rows 61-75

## Executive Summary

Overall readiness score: 61/100.

| Dimension | Score | Rationale |
| --- | ---: | --- |
| Technical accuracy | 58/100 | Protocol content has several P0-P1 risks; SV scheduling is oversimplified; UVM content is broadly sound but under-cited. |
| Interview readiness | 55/100 | AMBA has one reusable question bank; SV, UVM, SVA/Formal, Debug, and SoC banks are missing rubrics/model answers. |
| Learning progression | 65/100 | T1->T2 scaffold is reasonable; staff/senior-staff progression is shallow. |
| Labs/projects | 52/100 | Multiple labs exist, but capstones and schema-level acceptance checks are missing. |
| Visualizers | 60/100 | Good AMBA visualizers; scheduling, RAL mirror, ACE/CHI, and accessibility loops need work. |
| Flashcards | 62/100 | Broad deck coverage exists, but several protocol/staff decks are thin. |
| QA/testing | 48/100 | Vitest coverage exists; source metadata, interview-bank schema, lab schema, and broad E2E gates are missing. |

## Top Findings

1. P0: Correct AXI 4KB boundary wording and examples.
2. P0: Correct AHB `HREADY` vs `HREADYOUT` framing.
3. P0: Add accurate SV scheduling region coverage, especially Observed and Reactive regions.
4. P1: Create interview banks for SV, UVM, SVA/Formal, Debug, SoC, and AMBA with rubrics/model answers.
5. P1: Correct UVM phase concurrency explanation around `run_phase` and runtime sub-phases.
6. P1: Add senior-level AXI deadlock lab if existing lab does not meet broken-RTL/SVA acceptance criteria.
7. P1: Deepen bridge split-transaction lab acceptance criteria.
8. P1: Add staff-level SoC verification strategy capstone.
9. P1: Reframe ACE/CHI as current AMBA 4/5 coherency protocols rather than "future" protocols.
10. P1/P2: Add source metadata gates, deeper flashcards, visualizer accessibility, and stronger Playwright coverage.

## Accuracy Findings

| Severity | Surface | Issue | Required Fix | Source |
| --- | --- | --- | --- | --- |
| P0 | AXI burst curriculum and flashcards | "AXI bursts cannot cross a 4KB boundary" may be too informal for checker/interview use. | State that every beat address in a burst must remain in the same 4KB page as the first transfer; separate WRAP natural alignment. | Arm IHI0022H, AXI burst rules |
| P0 | AHB design/timing curriculum | `HREADY` and `HREADYOUT` can be conflated. | Teach selected slave drives `HREADYOUT`; bus/interconnect produces `HREADY`; slaves sample `HREADY` for pipeline timing. | Arm IHI0033B, AHB-Lite ready signaling |
| P0 | SV scheduling and clocking-block content | Observed/Reactive regions are missing or too shallow. | Add region timeline and examples showing clocking-block sampling/driving and race avoidance. | IEEE 1800-2023 scheduling semantics |
| P1 | AXI ordering flashcards | Same-ID ordering is covered, but different-ID out-of-order completion needs stronger emphasis. | Add different-ID ordering cards and interview prompts. | Arm IHI0022H ordering rules |
| P1 | AXI deadlock content/cards | Buffer exhaustion and circular dependency can be blurred. | Separate starvation/buffer-full cases from true circular channel dependency deadlock. | Arm IHI0022H channel dependency rules |
| P1 | UVM phasing content | `run_phase` concurrency with runtime sub-phases is not prominent enough. | Add swimlane explanation and trap interview question. | IEEE 1800.2-2020 UVM phases |
| P1 | ACE/CHI module and deck | "Future Protocols" framing is misleading. | Reframe as AMBA 4 ACE and AMBA 5 CHI; describe current coherent interconnect context carefully. | Arm IHI0022H, Arm IHI0050F |
| P1 | SVA fundamentals | `$past(expr)` explanation can omit full signature/gating use. | Add `$past(expr, n, gating_expr, clock_event)` and valid/ready gated example. | IEEE 1800-2023 SVA sampled value functions |
| P2 | RAL flashcards/content | Mirror staleness under hardware-updated fields is undercovered. | Add `mirror(status, UVM_CHECK)` and `set_compare(UVM_NO_CHECK)` scenarios. | IEEE 1800.2-2020 UVM RAL |
| P2 | TLM connections | `uvm_tlm_fifo` and `uvm_tlm_analysis_fifo` blocking semantics need clearer contrast. | Add comparison table and peek/get double-processing warning. | IEEE 1800.2-2020 TLM |
| P2 | Advanced constraints | `solve...before` can be described without distribution warning. | Explain it changes distribution, not feasibility; avoid using it to "fix" unsatisfiable constraints. | IEEE 1800-2023 constraints |
| P3 | AI-driven verification | Coverage-closure claims may be overstated. | Use careful "accelerates closure" wording and require source labeling. | Vendor docs as secondary sources |

## Learning Path Gaps

| Level | Expected Competency | Current Gap |
| --- | --- | --- |
| Junior | SV syntax, basic testbench, simple assertions | Needs first-testbench guided project and waveform-reading practice. |
| Mid-level | UVM agents, sequences, scoreboards, coverage | Needs a full mini-UVM environment capstone. |
| Senior | Protocol VIP, RAL, debug, SVA/formal strategy | Needs AXI monitor/scoreboard, deadlock, RAL mirror, and formal/debug labs. |
| Staff | Methodology ownership, SoC coverage strategy, coherency | Needs SoC verification strategy and coherency verification modules/capstones. |
| Senior staff | System-design review, methodology architecture, interview fluency | Needs dedicated senior-staff methodology and system-design interview content. |

## Interview Preparation Gaps

Required question-bank categories for each major topic:
- concept
- waveform/debug
- coding prompt
- verification-plan prompt
- trick question
- staff system-design
- scoring rubric
- model answer
- source references

Missing banks:
- SystemVerilog semantics
- UVM
- SVA/Formal
- Debug
- SoC/System Design
- Senior Staff Methodology

Existing partial bank:
- AMBA protocol interview bank exists but should be expanded with rubrics/model answers and source references.

## Lab and Capstone Roadmap

| Lab ID | Level | Priority | Goal |
| --- | --- | --- | --- |
| LAB-CAP-1 | Mid/Senior | P1 | Build mini UVM environment with FIFO DUT, coverage, factory override, and scoreboard bug catch. |
| LAB-AXI-1 | Senior | P1 | Build AXI monitor/scoreboard across all five channels with per-ID ordering. |
| LAB-AXI-2 | Senior | P1 | Debug AXI deadlock with broken RTL and SVA/watchdog. |
| LAB-BRIDGE-1 | Senior | P1 | Verify AHB-to-AXI bridge split logic, ordering, and backpressure. |
| LAB-CAP-2 | Staff | P1 | Create SoC AXI interconnect verification strategy and coverage/signoff plan. |
| LAB-COH-1 | Staff | P2 | Build ACE/CHI snoop/coherency checker exercise. |
| LAB-RAL-1 | Senior | P2 | Debug RAL mirror staleness and compare policy failures. |

## Visualizer Improvement Targets

| Visualizer Area | Required Improvement |
| --- | --- |
| AHB timing | Show or explicitly label `HREADYOUT` versus `HREADY`. |
| SV scheduling | Add all-major-region timeline with clocking-block overlay. |
| UVM phases | Show `run_phase` concurrent with runtime sub-phases. |
| AXI burst math | Strengthen 4KB page overlay and boundary formula. |
| SVA | Add `$past` gating visualization. |
| RAL | Add desired vs mirror divergence/resync visualization. |
| ACE/CHI | Add cache state/snoop transition visualization. |
| Accessibility | Add aria labels, color-independent state indicators, and reduced-motion step-through paths. |

## QA Automation Targets

Recommended tests to add during the workstream:

| Test Area | Proposed Files |
| --- | --- |
| Source metadata | `tests/curriculum/source-metadata.test.ts` |
| Flashcard schema/registration | `tests/flashcards/deck-schema.test.ts`, `tests/flashcards/deck-registration.test.ts` |
| Interview bank schema/coverage | `tests/interview-questions/bank-schema.test.ts`, `tests/interview-questions/coverage-matrix.test.ts` |
| Lab schema/solutions | `tests/labs/lab-schema.test.ts`, `tests/labs/solution-present.test.ts` |
| Visualizer accessibility | `tests/visualizers/accessibility.test.ts` |
| E2E navigation/link gates | `tests/e2e/navigation/*.spec.ts`, `tests/e2e/broken-links/internal-links.spec.ts` |

## Backlog Mapping

The audit findings are tracked as:

- `BACK-01-HREADY-HREADYOUT-CORRECTION`
- `BACK-02-AXI-4KB-RULE-CORRECTION`
- `BACK-03-SV-SCHEDULING-REGIONS`
- `BACK-04-INTERVIEW-BANKS-RUBRICS`
- `BACK-05-UVM-PHASING-CONCURRENCY`
- `BACK-06-AXI-DEADLOCK-LAB`
- `BACK-07-BRIDGE-SPLIT-TRANSACTION-LAB`
- `BACK-08-MINI-UVM-CAPSTONE`
- `BACK-09-SOC-VERIFICATION-STRATEGY`
- `BACK-10-ACE-CHI-COHERENCY-DEEPENING`
- `BACK-11-SOURCE-METADATA-GATE`
- `BACK-12-VISUALIZER-ACCURACY-A11Y`
- `BACK-13-FLASHCARD-DEPTH-ALIGNMENT`
- `BACK-14-E2E-REGRESSION-GATES`
- `BACK-15-AI-CONTENT-CLAIM-TIGHTENING`
