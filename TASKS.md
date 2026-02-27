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

### Sub-Task 1: Deprecate `F3` and Consolidate Basics
| ID | Status | Summary | Agent Instructions |
|---|---|---|---|
| `W5-F3-MERGE` | `complete` | Deprecate F3 and merge into F2C/F2D | Move `ProceduralBlocksSimulator.tsx` to `F2C`. Move unique `F3` concepts to `F2C` (procedural code) or `F2D` (fork-join). Delete the `F3_Procedural_Constructs` directory. Update `next.config.mjs` to redirect the old F3 path to F2C. Redirect `F3_Behavioral_RTL_Modeling` to F2C. |

### Sub-Task 2: Ship Remaining I-SV Structural Splits
| ID | Status | Summary | Agent Instructions |
|---|---|---|---|
| `W5-ISV2-SPLIT` | `complete` | Split `I-SV-2` (Randomization) into A & B | Create `I-SV-2A_Randomization_Fundamentals` and `I-SV-2B_Advanced_Constraint_Techniques`. Build `ConstraintSolverExplorer.tsx` for 2B. Build "Dependent Fields Challenge" lab for 2B. |
| `W5-ISV3-SPLIT` | `complete` | Split `I-SV-3` (Coverage) into A & B | Create `I-SV-3A_Coverage_Fundamentals` and `I-SV-3B_Advanced_Coverage_Modeling`. Remove sync/IPC content (mailboxes/semaphores) from here. Build `CovergroupBuilder.tsx` for 3A. Build "State Machine Bug Hunt" lab for 3B. |
| `W5-ISV4-SPLIT` | `todo` | Split `I-SV-4` (Assertions) into A & B | Create `I-SV-4A_SVA_Fundamentals` and `I-SV-4B_Advanced_Temporal_Logic`. Build `TemporalLogicExplorer.tsx` for 4B. Build "Data Integrity Challenge" lab for 4B. |

### Sub-Task 3: Ship Remaining I-UVM Structural Splits & Merges
| ID | Status | Summary | Agent Instructions |
|---|---|---|---|
| `W5-IUVM1-SPLIT-MERGE` | `todo` | Spilt `I-UVM-1` (Intro) and merge `I-UVM-4`/`I-UVM-5`/`A-UVM-2` | Create `I-UVM-1A_Components_and_Objects`, `I-UVM-1B_The_UVM_Factory`, and `I-UVM-1C_UVM_Phasing`. Merge contents of `I-UVM-4` and `A-UVM-2` into `I-UVM-1B` and delete them. Merge `I-UVM-5` into `I-UVM-1C` and delete it. Set up redirects. Build `UVMTreeExplorer.tsx` (1A) and `FactoryOverrideVisualizer.tsx` (1B). Create "Error Injection Override" lab (1B). |
| `W5-IUVM2-SPLIT` | `todo` | Split `I-UVM-2` (TB) into A & B | Create `I-UVM-2A_Component_Roles` and `I-UVM-2B_Connecting_with_TLM`. Build `TLMPortConnector.tsx` (2B). Create "Wire It Up!" lab (2B). |
| `W5-IUVM3-SPLIT-MERGE` | `todo` | Split `I-UVM-3` (Sequences) and merge `A-UVM-1` | Create `I-UVM-3A_Sequence_Fundamentals` and `I-UVM-3B_Advanced_Sequencing_and_Layering`. Merge `A-UVM-1` into `3B` and delete it. Relocate `config_db` out of sequencing. Build `VirtualSequencerExplorer.tsx` (3B). Create "Coordinated Attack" lab (3B). |

### Sub-Task 4: Advanced UVM Deprecations & Splits
| ID | Status | Summary | Agent Instructions |
|---|---|---|---|
| `W5-AUVM4-SPLIT` | `todo` | Split `A-UVM-4` (RAL) into A & B | Create `A-UVM-4A_RAL_Fundamentals` and `A-UVM-4B_Advanced_RAL_Techniques`. Build `RALHierarchy.tsx` (4A) and `RALPredictorVisualizer.tsx` (4B). Create "Mirror Bug Lab" (4B). |
| `W5-AUVM3-DEPRECATE` | `todo` | Deprecate `A-UVM-3` and create Callbacks lesson | Delete `A-UVM-3`. Create `A-UVM-5_UVM_Callbacks`. |

### Sub-Task 5: DPI Boundary Inspector
| ID | Status | Summary | Agent Instructions |
|---|---|---|---|
| `W5-EINT1-DPI` | `complete` | Build DPI Interactive for `E-INT-1` | Build `DPIBoundaryInspector.tsx` and embed it in `E-INT-1`. |

---

## Agent Handoff Protocol (How to Resume Work)

Because this guide is too large to modernize in a single chat session, use the following `Agent Handoff Protocol` to safely yield work and allow a future agent to resume:

**If you are starting a new session or resuming an existing one:**
1. **Always read this file (`TASKS.md`) FIRST.** This is your sole source of truth for repository state. Do *not* rely on `curriculum_modernization_tasks.md` anymore (it's kept for historical context but is superseded by this unified tracker).
2. Look at the `Wave 5 Priority Backlog` above. Find the first Sub-Task containing items marked as `todo`.
3. Read the `Agent Instructions` for that specific task ID.
4. Call standard repository tools (`grep_search`, `list_dir`) to verify the file state before and after you modify anything.
5. Create you structural files, rewrite MDX, author React components, and build the labs.
6. **Testing:** Before marking any task as complete, you MUST verify the build. Run `npx tsx scripts/generate-curriculum-data.ts`. Then run `npm run lint` and `npx vitest --run`. If tests fail, FIX THEM before updating `TASKS.md`.
7. **Updating State:** Once a task is complete and tests pass, change its status in this file (`TASKS.md`) from `todo` to `complete`. 
8. **Handoff:** If you are nearing the end of your token/time limit, ensure the codebase compiles cleanly (tests pass). Commit your work. Update `TASKS.md` so the next agent knows exactly where you stopped. Instruct the user to open a new session and tell the new agent to "Read TASKS.md and continue execution".
