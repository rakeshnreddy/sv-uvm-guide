# Curriculum Content Audit – Redundancy Pass

_Date: 2025-09-19 (update as you run)_

## Canonical references consulted
- `MASTER_PLAN.md`
- `COMPREHENSIVE_CURRICULUM_MODULE_MAP.md`
- `SYSTEMVERILOG_UVM_BLUEPRINT.md`
- `TODO.md` – Content Operations section

These documents define the Tier 1–4 structure. Anything outside those lanes should either map cleanly into a module or be archived.

## Findings

### Top-level collections not in the canonical tree
| Path | Notes | Recommendation |
| --- | --- | --- |
| `content/curriculum/uvm-core` | Duplicates Tier-2 UVM content (base classes, factory, phasing) now covered in `T2_Intermediate/I-UVM-*`. | Merge key callouts into Tier-2 pages, then archive or delete folder. |
| `content/curriculum/uvm-building` | High-level agent/env articles; overlaps with new sequencing/phasing modules. | Fold unique diagrams into the Tier-2/3 lessons and drop the extra folder. |
| `content/curriculum/interactive-tools` | Old static descriptions of labs replaced by live exercise routes. | Convert any remaining instructions into the Exercises hub and remove folder. |

### Tier-1 legacy modules
| Module | Overlap | Recommendation |
| --- | --- | --- |
| `F3_SystemVerilog_Intro` | Introductory SV primer largely covered by `F2_SystemVerilog_Basics` + `F3_Procedural_Constructs`. | Integrate any missing clarity notes into F2/F3 and retire module. |
| `F3_Behavioral_RTL_Modeling` | Repeats RTL modeling guidance now in `F4_RTL_and_Testbench_Constructs`. | Capture unique lab call-outs in `F4` and delete duplicate page. |
| `F4_Verification_Basics_without_UVM` | Overlaps with Tier-2 intro and new Tier-1 verification overview. | Promote reusable checklists into `F1` and drop standalone page. |
| `F4_Your_First_Testbench` | Detailed lab that should live in `labs/` with walkthrough rather than curriculum nav. | Migrate to `labs/` (or link from `F4_RTL_and_Testbench_Constructs`) and remove module. |
| `F5_Intro_to_OOP_in_SV` | Tier transition topic mirrored in `I-SV-1_OOP`. | Combine "memory hooks" into Tier-2 lesson; archive this stub. |

### Data references
- `src/lib/curriculum-data.tsx` still exposes every legacy module. Navigation therefore surfaces redundant entries.
- `TODO.md` calls for real migration-status dashboard; we should track the cleanup there once files move.

## Next actions for cleanup sprint
1. Move any unique diagrams or quizzes from the legacy folders into their modern counterparts.
2. Update `src/lib/curriculum-data.tsx` to drop archived modules so navigation stays in sync.
3. Remove the redundant directories/files once content has a new home.
4. Update `TODO.md` migration checklist with progress markers for the removals.

> **Note:** run content diff reviews with SMEs before deleting derivations that still hold examples not present elsewhere.

### 2025-09-22 Update
- Tier-2 UVM fundamentals (base classes, phasing, agent wiring) have been merged into the canonical `I-UVM-2` and `I-UVM-5` lessons. The redundant `uvm-core/fundamentals` and `uvm-building/essentials` folders are now documented in `docs/archive/legacy-curriculum/README.md`.
- `interactive-tools/uvm-visualizers/interactive-testbench.mdx` has been retired in favour of embedding the visualizer directly in `I-UVM-2_Building_TB`.
- Remaining cleanup focus: Verify merged Tier-1 materials with SMEs before removing the final redirect stubs from navigation.

### 2025-09-23 Update
- `F2_SystemVerilog_Primer` retired; a "Digital Logic & HDL Primer" spotlight now lives inside `F2_SystemVerilog_Basics` and the archive ledger documents the move.
- `F3_SystemVerilog_Intro` copy merged into `F2_SystemVerilog_Basics` so newcomers land on a single intro flow with the original quiz migrated over.
- Curriculum navigation no longer surfaces the legacy Tier-1 stubs (`F2_SystemVerilog_Primer`, verification lab redirects, OOP intro); `curriculum-data.tsx` reflects the streamlined structure.
- New `labs/simple_dut/lab1_first_tb/README.md` carries the relocated lab walkthrough referenced from Tier-1 and the Labs hub.
- Behavioral-to-RTL guidance from `F3_Behavioral_RTL_Modeling` now lives in `F4_RTL_and_Testbench_Constructs`, including a package + interface bridge example.
- Verification playbook/checklist content from `F4_Verification_Basics_without_UVM` is embedded directly in `F1_Why_Verification`, closing the Tier-1 loop and preserving accuracy guidance.

### 2025-09-24 Update
- F3 intro consolidation confirmed; archive ledger updated with the relocation and redundant files removed from the workspace.
- Added accuracy instrumentation guidance to the Tier-3 factory lesson so the cleanup effort now ties back to measurable sign-off artifacts.
- Outstanding cleanup: final SME double-check on the merged F1/F2 flow plus pruning any stale nav links surfaced by `check-titles`.
- Ran `check-titles` audit on 2025-09-24; no mismatches reported after the Tier-1 archive sweep.

### 2025-10-03 Update
- Verified repository no longer contains `content/curriculum/uvm-core`, `uvm-building`, or `interactive-tools`; nav data aligned with canonical structure.
- Linked SME follow-up to the new content QA plan (`docs/audits/content-qa-plan.md`) to collect sign-off notes.
- Scheduled final navigation audit after QA completion to determine when TODO cleanup item can close.
