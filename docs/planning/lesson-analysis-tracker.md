# Lesson Analysis Sweep — Persistent Progress Tracker

Last Updated: 2026-05-05
Status: In Progress — Phase 1 (T1 Foundational)

## Overview

Systematic 7-dimension fresh-eyes analysis of all 69 curriculum modules.
Dimensions: Content Completeness, Technical Accuracy, Pedagogical Presentation, Lab Coverage, Interview Readiness, Real-World Corner Cases, Depth of Understanding.

**Approach rules (per user direction):**
- Heavy treatment for technical modules; light for intro/conceptual modules
- Enrich both inline interview content AND centralized JSON banks
- Expand labs to full simulation-ready code for proficiency
- Add LRM citations (IEEE 1800-2023, IEEE 1800.2-2020, Arm AMBA specs) wherever possible

---

## Phase 1: T1 Foundational (13 modules)

| # | Module | Status | Session | Changes Made | Notes |
|---|--------|--------|---------|--------------|-------|
| 1 | F1A — The Cost of Bugs | ✅ complete | 2026-05-05 | Added Quick Take, ECO vs respin table, verification lifecycle table, team roles, pattern analysis of famous bugs, 3 new interview Qs, expanded flashcards 3→8 | Light treatment (intro) |
| 2 | F1B — The Verification Mindset | ✅ complete | 2026-05-05 | Added Quick Take, systematic checklist, methodology comparison table, coverage closure curve, bug taxonomy, one-hot FSM war story, 3 new interview Qs, expanded flashcards 3→6 | Light treatment (intro) |
| 3 | F1C — Why SystemVerilog | ✅ complete | 2026-05-05 | Added Quick Take, LRM clause refs on superpowers, enhanced logic explanation with multi-driver limitation, 1 new interview Q, expanded flashcards 3→4 | Light treatment (intro) |
| 4 | F2A — Core Data Types | ✅ complete | 2026-05-05 | Added complete type family table, logic/wire/reg decision tree, packed vs unpacked with code, X-propagation trap, signedness trap, X-pessimism/optimism table, $cast rules, 4 corner cases, 5 interview Qs, expanded flashcards 6→10, added 3 Qs to centralized SV interview bank | Heavy treatment |
| 5 | F2B — Dynamic Structures | ✅ complete | 2026-05-05 | Added decision matrix, 4 production code patterns (resize, backpressure, scoreboard tracking, array methods), performance table, 5 corner cases, 4 interview Qs with LRM citations | Heavy treatment |
| 6 | F2C — Procedural Code and Flow Control | ✅ complete | 2026-05-05 | Added disable fork trap pitfall, expanded 2 interview Qs to index.mdx, created 6-card flashcard deck | Heavy treatment |
| 7 | F2D — Reusable Code and Parallelism | ✅ complete | 2026-05-05 | Added tasks-functions.mdx, created F2D_IPC and F2D_Tasks_Functions flashcards, updated index.mdx | Heavy treatment |
| 8 | F3A — Simulation Semantics | ✅ complete | 2026-05-05 | Rewrote to match standard template, added LRM citations, created F3A flashcard deck | Moderate treatment |
| 9 | F3B — Scheduling Regions | ✅ complete | 2026-05-05 | Rewrote to standard template, added LRM citations, enhanced interview Qs | Heavy treatment |
| 10 | F3C — Delta Cycles and Race Conditions | ✅ complete | 2026-05-05 | Rewrote to standard template, added LRM citations, enhanced interview Qs, created flashcard deck | Heavy treatment |
| 11 | F4A — Modules and Packages | pending | — | — | — |
| 12 | F4B — Interfaces and Modports | pending | — | — | — |
| 13 | F4C — Clocking Blocks | pending | — | — | — |

## Phase 2: T2 Intermediate — SystemVerilog (13 modules)

| # | Module | Status | Session | Changes Made | Notes |
|---|--------|--------|---------|--------------|-------|
| 14 | I-SV-1 — OOP | pending | — | — | — |
| 15 | I-SV-2A — Constrained Randomization Fundamentals | pending | — | — | — |
| 16 | I-SV-2B — Advanced Constrained Randomization | pending | — | — | — |
| 17 | I-SV-3A — Functional Coverage Fundamentals | pending | — | — | — |
| 18 | I-SV-3B — Advanced Functional Coverage | pending | — | — | — |
| 19 | I-SV-4A — SVA Fundamentals | pending | — | — | — |
| 20 | I-SV-4B — Advanced Temporal Logic | pending | — | — | — |
| 21 | I-SV-4C — Checkers | pending | — | — | — |
| 22 | I-SV-5 — Synchronization and IPC | pending | — | — | — |
| 23 | I-SV-6 — Compiler Directives and Generates | pending | — | — | — |
| 24 | I-SV-7 — DPI and Foreign Language Interfaces | pending | — | — | — |
| 25 | I-SV-8 — Power Intent and UPF | pending | — | — | — |
| 26 | I-SV-9 — Why UVM | pending | — | — | — |

## Phase 3: T2 Intermediate — UVM (11 modules)

| # | Module | Status | Session | Changes Made | Notes |
|---|--------|--------|---------|--------------|-------|
| 27 | I-UVM-1A — Components | pending | — | — | — |
| 28 | I-UVM-1B — The UVM Factory | pending | — | — | — |
| 29 | I-UVM-1C — UVM Phasing | pending | — | — | — |
| 30 | I-UVM-2A — Component Roles | pending | — | — | — |
| 31 | I-UVM-2B — TLM Connections | pending | — | — | — |
| 32 | I-UVM-2C — Configuration and Resources | pending | — | — | — |
| 33 | I-UVM-3A — Sequence Fundamentals | pending | — | — | — |
| 34 | I-UVM-3B — Advanced Sequencing and Layering | pending | — | — | — |
| 35 | I-UVM-4 — UVM Policy Classes | pending | — | — | — |
| 36 | I-UVM-5 — UVM Container Classes | pending | — | — | — |
| 37 | I-UVM-6 — UVM Recording Classes | pending | — | — | — |

## Phase 4: T3 Advanced — UVM (6 modules)

| # | Module | Status | Session | Changes Made | Notes |
|---|--------|--------|---------|--------------|-------|
| 38 | A-UVM-4A — RAL Fundamentals | pending | — | — | — |
| 39 | A-UVM-4B — Advanced RAL Techniques | pending | — | — | — |
| 40 | A-UVM-5 — UVM Callbacks | pending | — | — | — |
| 41 | A-UVM-6 — Scoreboards and Reference Models | pending | — | — | — |
| 42 | A-UVM-7 — VIP Construction | pending | — | — | — |
| 43 | A-UVM-8 — Multi-Agent Topologies | pending | — | — | — |

## Phase 5: T3 Advanced — AMBA (14 modules)

| # | Module | Status | Session | Changes Made | Notes |
|---|--------|--------|---------|--------------|-------|
| 44 | B-AMBA-1 — Protocol Families and Tradeoffs | pending | — | — | — |
| 45 | B-AMBA-2 — Protocol Intuition and Memory Hooks | pending | — | — | — |
| 46 | B-AHB-1 — AHB Design Timing Mechanics | pending | — | — | — |
| 47 | B-AHB-2 — AHB Pitfalls and Deadlocks | pending | — | — | — |
| 48 | B-AHB-3 — AHB Verification | pending | — | — | — |
| 49 | B-AXI-1 — AXI Channel Architecture | pending | — | — | — |
| 50 | B-AXI-2 — AXI Burst Math | pending | — | — | — |
| 51 | B-AXI-3 — AXI Ordering and IDs | pending | — | — | — |
| 52 | B-AXI-4 — AXI Expert Features | pending | — | — | — |
| 53 | B-AXI-5 — AXI Pitfalls and Deadlocks | pending | — | — | — |
| 54 | B-AXI-6 — AXI Verification Performance | pending | — | — | — |
| 55 | B-AMBA-F1 — Bridges and System Integration | pending | — | — | — |
| 56 | B-AMBA-F2 — Future Protocols ACE/CHI | pending | — | — | — |
| 57 | B-AMBA-F3 — Interview Debug Clinic | pending | — | — | — |

## Phase 6: T4 Expert (12 modules)

| # | Module | Status | Session | Changes Made | Notes |
|---|--------|--------|---------|--------------|-------|
| 58 | E-AI-1 — AI-Driven Verification | pending | — | — | — |
| 59 | E-CUST-1 — UVM Methodology Customization | pending | — | — | — |
| 60 | E-DBG-1 — Advanced UVM Debug | pending | — | — | — |
| 61 | E-EMU-1 — Emulation-Aware Verification | pending | — | — | — |
| 62 | E-INT-1 — UVM with Formal | pending | — | — | — |
| 63 | E-PERF-1 — UVM Performance | pending | — | — | — |
| 64 | E-PSS-1 — Portable Stimulus Standard | pending | — | — | — |
| 65 | E-PWR-1 — Power-Aware Verification | pending | — | — | — |
| 66 | E-PYUVM-1 — Python-Based Verification | pending | — | — | — |
| 67 | E-RISCV-1 — RISC-V Verification Methodology | pending | — | — | — |
| 68 | E-SOC-1 — SoC-Level Verification | pending | — | — | — |
| 69 | E-UVM-ML-1 — Multi-Language Verification | pending | — | — | — |

---

## Cross-Module Follow-Up Items

| Item | Source Module | Target Module | Status |
|------|-------------|---------------|--------|
| Add dynamic structure interview Qs to centralized SV bank | F2B | systemverilog.json | todo — next session |

---

## Session Log

### Session 1 — 2026-05-05
- **Scope:** F1A, F1B, F1C (light), F2A, F2B (heavy)
- **Completed:** 5 modules (F1A → F2B)
- **Validation:** ✅ generate:curriculum PASS, ✅ type-check PASS, ✅ vitest 107 files / 720 tests PASS
- **Files modified:**
  - `content/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index.mdx`
  - `content/curriculum/T1_Foundational/F1B_The_Verification_Mindset/index.mdx`
  - `content/curriculum/T1_Foundational/F1C_Why_SystemVerilog/index.mdx`
  - `content/curriculum/T1_Foundational/F2A_Core_Data_Types/index.mdx`
  - `content/curriculum/T1_Foundational/F2B_Dynamic_Structures/index.mdx`
  - `content/flashcards/F1A_Cost_of_Bugs.json` (3→8 cards)
  - `content/flashcards/F1B_Verification_Mindset.json` (3→6 cards)
  - `content/flashcards/F1C_Why_SystemVerilog.json` (3→4 cards)
  - `content/flashcards/F2_Data_Types.json` (6→10 cards)
  - `content/interview-questions/systemverilog.json` (+3 data-type questions)
  - `TASKS.md` (added DEEP-ANALYSIS-SWEEP umbrella task)
  - `docs/planning/lesson-analysis-tracker.md` (this file — created)
- **Next session:** F2C (Procedural Code and Flow Control)
