# Tier-1 Curriculum Consolidation Plan

_Last updated: 2025-09-24_

Goal: eliminate duplicate Tier-1 modules left over from the migration by folding unique insights into the new "SystemVerilog Basics" and "Procedural Constructs" lessons, then retiring stale directories so navigation and analytics stay in sync.

## Targeted Modules
| Legacy Module | Action | Destination |
| --- | --- | --- |
| `F2_Data_Types/index` + `arrays`/`user-defined` | ✅ Merged into `F2_SystemVerilog_Basics` with quick take, advanced notes, and quiz updates. | `content/curriculum/T1_Foundational/F2_SystemVerilog_Basics` |
| `F2_SystemVerilog_Primer` | ✅ Primer content merged into new "Digital Logic & HDL" spotlight; legacy module archived. | `content/curriculum/T1_Foundational/F2_SystemVerilog_Basics` |
| `F3_SystemVerilog_Intro` | ✅ Mnemonics/examples merged into `F2_SystemVerilog_Basics` intro section. | `content/curriculum/T1_Foundational/F2_SystemVerilog_Basics` |
| `F3_Behavioral_RTL_Modeling` | ✅ Behavioral-to-RTL workflow captured inside `F4_RTL_and_Testbench_Constructs`; interface/package example added. | `F4_RTL_and_Testbench_Constructs` |
| `F4_Verification_Basics_without_UVM` | ✅ Verification essentials moved into `F1_Why_Verification`; module redirects. | `content/curriculum/T1_Foundational/F1_Why_Verification` |
| `F4_Your_First_Testbench` | ✅ Lab walkthrough relocated to `labs/simple_dut/lab1_first_tb`; module redirects. | `labs/simple_dut/lab1_first_tb` |
| `F5_Intro_to_OOP_in_SV` | ✅ Memory hooks merged into `I-SV-1_OOP`; module redirects. | `content/curriculum/T2_Intermediate/I-SV-1_OOP` |

## Work Breakdown
1. **Content Diff Review** – Compare each legacy module against its modern counterpart; note any unique diagrams, checklists, or exercises.
2. **Migration PRs** – For modules with retained content, append the missing pieces to the destination MDX files (use callouts to highlight migrated tips).
3. **Update Navigation Data** – Remove retired modules from `curriculum-data.tsx` once content lands in the canonical locations.
4. **Archive Proof** – Record the move in `docs/archive/legacy-curriculum/README.md` with links to replacements (similar to the Tier-2 cleanup).
5. **Delete Legacy Directories** – After confirming nav + tests pass, delete the old folders to keep the repo tidy.
6. **Status Update** – Mark the affected topics as `complete` in `src/lib/curriculum-status.ts` (or add overrides) once SMEs sign off.

## Dependencies
- SME availability for Tier-1 review rotation (see `docs/operations/sme-review-rotation.md`).
- Sign-off from curriculum lead before deleting learner-facing URLs (legacy redirects may be required).

## Next Steps (Sprint Backlog)
- [x] Diff `F2_Data_Types` against `F2_SystemVerilog_Basics`; log missing snippets and merge unique guidance.
- [x] Draft lab relocation plan for `F4_Your_First_Testbench` (ensure Playwright tests updated).
- [x] Schedule SME checkpoint for OOP migration (`F5` → `I-SV-1`).
- [ ] Close the loop on verification essentials cleanup once SME review signs off on the combined `F1` + `F2` accuracy sweep.

### SME Follow-up Checklist
- Confirm redirect ledger: `F4_Verification_Basics_without_UVM` → `F1_Why_Verification`, `F3_SystemVerilog_Intro` → `F2_SystemVerilog_Basics`, `F4_Your_First_Testbench` → `labs/simple_dut/lab1_first_tb` (see `docs/archive/legacy-curriculum/README.md`).
- Circulate merged `F1`/`F2` draft to Tier-1 SMEs (Owens, Priya) with focus on the verification essentials + language intro accuracy hooks.
- Capture SME comments in `docs/audits/redundant-content.md` and update status to ✅ when redirects can be fully retired from nav.

Keep this plan updated as each bullet is addressed so the cleanup task in `TODO.md` can be closed confidently.
