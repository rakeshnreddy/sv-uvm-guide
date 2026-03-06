# SV-UVM Guide Modernization Tracker

This is the single source of truth for the curriculum modernization effort.

## Current Repository Status

The repository has passed through Waves 1-4 of the modernization plan defined in `comprehensive_lrm_audit_report.md`. 

**The following modules are 100% COMPLETE, with structural splits, LRM anchoring, and 3D/2D interactives integrated:**
- All 6 deep 3D visualizations (`VIS-3D-MAILBOX`, `VIS-3D-COVERAGE`, `VIS-3D-ANALYSIS`, `VIS-3D-DATAFLOW`, `VIS-3D-CONSTRAINT`, `VIS-3D-PHASE-TIMELINE`).
- `F1: Why Verification` & `F2: SV Language Basics` (Fully modernized & split into F2A-F2D).
- `F4: RTL and Testbench Constructs` (Fully modernized & split into F4A-F4C).
- `I-SV-1: Object-Oriented Programming` (Rewritten, interview-focused, IEEE 1800-2023 backed).
- `E-PERF-1: UVM Performance` (Modernized with `SVEventScheduler` and Bottleneck Lab).
- Standards Closure: Stale 1800-2017 references removed globally.

---

## Wave 5 Priority Backlog (Pending Execution)

Below are the remaining requirements from the `comprehensive_lrm_audit_report.md` and `curriculum_modernization_tasks.md` that must be executed to achieve 100% modernization.

### Sub-Task 4: Advanced UVM Deprecations & Splits
| ID | Status | Summary | Agent Instructions |
|---|---|---|---|
| `W5-AUVM4-SPLIT` | `todo` | Split `A-UVM-4` (RAL) into A & B | Create `A-UVM-4A_RAL_Fundamentals` and `A-UVM-4B_Advanced_RAL_Techniques`. Build `RALHierarchy.tsx` (4A) and `RALPredictorVisualizer.tsx` (4B). Create "Mirror Bug Lab" (4B). |
| `W5-AUVM3-DEPRECATE` | `todo` | Deprecate `A-UVM-3` and create Callbacks lesson | Delete `A-UVM-3`. Create `A-UVM-5_UVM_Callbacks`. |

---

## Wave 6: Final Curriculum Audit Gaps (Pending Execution)

Below are the final tasks generated from the independent Tier 2 and Tier 4 curriculum audit. These modules contain content but miss the rigorous "Definition of Done" (LRM anchoring, interactives, gamified labs) established in Waves 1-4.

### Sub-Task 1: Intermediate Fill-Ins
| ID | Status | Summary | Agent Instructions |
|---|---|---|---|
| `W6-ISV5-MOD` | `todo` | Modernize `I-SV-5` (Sync & IPC) | The content exists, but lacks a dedicated interactive. `MailboxSemaphoreGame.tsx` is currently embedded in `F2D/ipc.mdx` (which is the wrong difficulty tier). Move the game component to `I-SV-5` and create a proper "Dining Philosophers" or similar IPC deadlock lab. |
| `W6-IUVM2C-MOD` | `todo` | Modernize `I-UVM-2C` (Config) | Add rigorous UVM LRM Clause 23 anchoring to the frontmatter. Create a `ConfigDbExplorer.tsx` visualizer showing the top-down resolution of `set` vs `get`. Add a "Null Virtual Interface" debug lab. |

### Sub-Task 2: Expert Modernization
| ID | Status | Summary | Agent Instructions |
|---|---|---|---|
| `W6-ECUST1-MOD` | `todo` | Modernize `E-CUST-1` (Methodology) | Add a `MethodologyPhaseVisualizer.tsx` interactive component. Create a lab focusing on injecting a custom UVM phase into the simulation schedule. |
| `W6-EDBG1-MOD` | `todo` | Modernize `E-DBG-1` (Debug) | Add a `TelemetryEventBusVisualizer.tsx` interactive component showing how structured logs map to a timeline. Create a lab on trigging waveform capture from an event bus. |
| `W6-EINT1-MOD` | `todo` | Modernize `E-INT-1` (Formal) | Add a `FormalVsSimulationVisualizer.tsx` interactive showing the difference between a simulation wave and a formal counter-example. Create a lab that translates a UVM constrained-random sequence into a Formal `assume` property. |
| `W6-ESOC1-MOD` | `todo` | Modernize `E-SOC-1` (SoC Verification) | Add a `VIPReuseVisualizer.tsx` interactive component demonstrating active vs passive topology toggling. Create an SoC bring-up lab. |

---

## Wave 7: Deep Standards Closure (Pending Execution)

Below are the final tasks to address the explicitly missing SV and UVM LRM sections identified in sections 1.2 and 1.3 of the `comprehensive_lrm_audit_report.md`.

### Sub-Task 1: SystemVerilog Missing Clauses
| ID | Status | Summary | Agent Instructions |
|---|---|---|---|
| `W7-ISV-CHECKERS` | `todo` | Create `I-SV-4C` (Checkers) | Provide a dedicated treatment of SV LRM Clause 17 (Checkers) as a first-class topic, explaining integration with SVA. |
| `W7-ISV-DIRECTIVES` | `todo` | Create `I-SV-6` (Compiler Directives & Generates) | Address SV LRM Clauses 22 and 27. Build an interactive component showing the semantic difference between `generate` blocks and runtime `if`. |
| `W7-ISV-API` | `todo` | Expand DPI/VPI coverage | Address SV LRM Clauses 35-41. Expand the existing brief DPI page into a robust production-grade guide with C++ boundary marshaling examples. |

### Sub-Task 2: UVM Missing Clauses
| ID | Status | Summary | Agent Instructions |
|---|---|---|---|
| `W7-IUVM-POLICY` | `todo` | Create Policy Classes Lesson | Teach UVM LRM Clause 16 (printer, comparer, packer, recorder, copier). Build an interactive `UvmPolicyVisualizer.tsx` showing how a single object behaves differently under different policies. |
| `W7-IUVM-CONTAINER` | `todo` | Create Container Classes Lesson | Teach UVM LRM Clause 11 (`uvm_pool`, `uvm_queue`). Contrast them against native SV queues/associative arrays. |
| `W7-IUVM-RECORDING` | `todo` | Create Recording Classes Lesson | Teach UVM LRM Clause 7, demonstrating how to integrate `uvm_recorder` with vendor-specific transaction viewing databases using the `debug_event_bus` architecture from `E-DBG-1`. |

---

## Context File References
The modernization tasks in this document are derived from two foundational audits. Future coding agents should refer to these files if additional context is needed:
1. `comprehensive_lrm_audit_report.md`: Contains the system-wide LRM deficiency analysis and the original blueprint for the 3D interactives.
2. `curriculum_modernization_tasks.md`: An older tracker file that contains highly detailed, step-by-step acceptance criteria for some of the earlier tasks. **Note:** Active status tracking has been moved entirely to *this* `TASKS.md` file.

---

## Agent Handoff Protocol (How to Resume Work)

Because this guide is too large to modernize in a single chat session, use the following `Agent Handoff Protocol` to safely yield work and allow a future agent to resume.

### 📋 THE GENERIC PROMPT TO RESUME WORK
**Users: Copy and paste the block below into your AI chat when starting a new session or handing off work.**

> Read and execute the instructions in the file `prompt_to_resume_modernization.txt` located in the root of the repository.

### Agent Workflow (Internal Guidelines)
**If you (the agent) are reading this file:**
1. **Always read this file (`TASKS.md`) FIRST.** Do *not* rely on `curriculum_modernization_tasks.md` for active status tracking.
2. Find the first `todo` in the Priority Backlog.
3. Call standard repository tools (`grep_search`, `list_dir`) to verify the file state before and after you modify anything.
4. **Testing is Mandatory:** Before marking any task as complete, you MUST verify the build. Run `npx tsx scripts/generate-curriculum-data.ts`. Then run `npm run lint` and `npx vitest --run`. If tests fail, FIX THEM. Do not rely on the QA agent to fix your bugs.
5. **QA Support:** Ensure your component structure is modular and testable, because a parallel QA agent will be writing comprehensive automated tests for all features you build. 
6. **Updating State:** Once a task is complete and tests pass, change its status in this file (`TASKS.md`) from `todo` to `complete`. 
7. **Handoff:** If you are nearing the end of your token limit, update `TASKS.md`, commit your work, and provide the user with the "📋 THE GENERIC PROMPT TO RESUME WORK" above.
