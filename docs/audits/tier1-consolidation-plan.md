# Tier-1 Curriculum Consolidation Plan

_Last updated: 2025-09-22_

Goal: eliminate duplicate Tier-1 modules left over from the migration by folding unique insights into the new "SystemVerilog Basics" and "Procedural Constructs" lessons, then retiring stale directories so navigation and analytics stay in sync.

## Targeted Modules
| Legacy Module | Action | Destination |
| --- | --- | --- |
| `F2_Data_Types/index` + `arrays`/`user-defined` | Merge any remaining callouts into `F2_SystemVerilog_Basics/index` and supporting cards. | `content/curriculum/T1_Foundational/F2_SystemVerilog_Basics` |
| `F2_SystemVerilog_Primer` | Verify overlap vs. Basics; keep only if SME insists on separate primer. | Potential appendix in `F2_SystemVerilog_Basics` |
| `F3_SystemVerilog_Intro` | Fold mnemonics/examples into `F2_SystemVerilog_Basics` intro section. | Same |
| `F3_Behavioral_RTL_Modeling` | Move any RTL diagrams to `F4_RTL_and_Testbench_Constructs`. | `F4_RTL_and_Testbench_Constructs` |
| `F4_Verification_Basics_without_UVM` | Promote reusable checklists into `F1_Why_Verification`; drop rest. | `F1_Why_Verification` |
| `F4_Your_First_Testbench` | Relocate lab to `labs/` with step-by-step instructions. | `labs/` |
| `F5_Intro_to_OOP_in_SV` | Integrate memory hooks into `I-SV-1_OOP` Tier-2 module. | `content/curriculum/T2_Intermediate/I-SV-1_OOP` |

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
- [ ] Diff `F2_Data_Types` against `F2_SystemVerilog_Basics`; log missing snippets.
- [ ] Draft lab relocation plan for `F4_Your_First_Testbench` (ensure Playwright tests updated).
- [ ] Schedule SME checkpoint for OOP migration (`F5` → `I-SV-1`).

Keep this plan updated as each bullet is addressed so the cleanup task in `TODO.md` can be closed confidently.
