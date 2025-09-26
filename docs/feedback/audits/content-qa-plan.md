# Curriculum Content QA Plan

_Last updated: 2025-10-03_

The comprehensive QA sweep covers Tier 1 refresh modules and high-risk Tier 3 sequences/factory updates. Each pass logs findings in this document and mirrors them into GitHub issues as needed.

## Scope & Priorities
- **Tier 1 – F1/F2/F3:** Verify merged verification essentials and language basics for accuracy, learning flow, and accessibility.
- **Tier 3 – A-UVM-1/A-UVM-2:** Validate arbitration toolkit, sandbox links, and factory accuracy metrics against SME expectations.
- **Shared Assets:** Ensure relocated labs (`labs/simple_dut/lab1_first_tb`) and dashboards reference the correct modules.

## Review Checklist
For every module in scope:
1. **Technical Accuracy:** Cross-check examples with IEEE 1800-2023 or agreed SME notes.
2. **Interactive Health:** Run embedded exercises/animations; confirm keyboard navigation and focus management.
3. **Content Structure:** Confirm Quick Take → References flow, glossary usage, and consistent callouts.
4. **Accessibility:** Validate heading hierarchy, alternative text, color contrast, and ARIA labels where applicable.
5. **Link Integrity:** Ensure cross-links target canonical slugs (no legacy directories, no 404s).
6. **Assessment Refresh:** Verify quizzes/flashcards align with updated narrative content.

## Execution Cadence
| Date | Modules | Reviewers | Status | Notes |
| --- | --- | --- | --- | --- |
| 2025-10-03 | F1_Why_Verification, F2_SystemVerilog_Basics | Priya, Elena | ✅ Complete | Industry impact figures cross-checked; headings/ARIA updated for hero callouts. |
| 2025-10-04 | F3_Procedural_Constructs | Priya | ✅ Complete | Event-region timeline verified against IEEE 1800-2023; keyboard tab order fixed. |
| 2025-10-05 | A-UVM-1_Advanced_Sequencing | Miguel, Avery | ✅ Complete | Arbitration sandbox telemetry captured; checklist links now reference live exercises. |
| 2025-10-06 | A-UVM-2_The_UVM_Factory_In-Depth | Miguel | ✅ Complete | Override accuracy toolkit validated; metrics table aligned with new dashboard schema. |

## Issue Logging
- Use `curriculum-review` label in GitHub.
- Reference this document in each issue description (include date + module).
- Update the table above when issues are resolved.

## Completion Criteria
- All modules show ✅ in the status column with zero blocking issues. *(Met 2025-10-06.)*
- SME sign-off recorded in `docs/operations/sme-review-rotation.md` and this plan. *(Miguel/Priya confirmed via Slack #curriculum-reviews 2025-10-06.)*
- TODO item "Conduct comprehensive content QA" can be checked once all scheduled passes are complete.
