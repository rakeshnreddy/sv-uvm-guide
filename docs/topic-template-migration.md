# Topic Template Migration Tracker

| Tier | Module | File Path | Status |
| --- | --- | --- | --- |
| T1 | F2C | `content/curriculum/T1_Foundational/F2C_Procedural_Code_and_Flow_Control/index.mdx` | ✅ |
| T1 | F2D | `content/curriculum/T1_Foundational/F2D_Reusable_Code_and_Parallelism/index.mdx` | ✅ |
| T1 | F3A | `content/curriculum/T1_Foundational/F3A_Simulation_Semantics/index.mdx` | ✅ |
| T1 | F3B | `content/curriculum/T1_Foundational/F3B_Scheduling_Regions/index.mdx` | ✅ |
| T1 | F3C | `content/curriculum/T1_Foundational/F3C_Delta_Cycles_and_Race_Conditions/index.mdx` | ✅ |
| T1 | F4A | `content/curriculum/T1_Foundational/F4A_Modules_and_Packages/index.mdx` | ✅ |
| T1 | F4B | `content/curriculum/T1_Foundational/F4B_Interfaces_and_Modports/index.mdx` | ✅ |
| T1 | F4C | `content/curriculum/T1_Foundational/F4C_Clocking_Blocks/index.mdx` | ✅ |

## Visual-first template (2026-10-03)

F3C (`content/curriculum/T1_Foundational/F3C_Delta_Cycles_and_Race_Conditions/index.mdx`) is the reference lesson for the visual-first section sequence inside the standard H2 order: picture → synchronized animation → experiment → comparison → `VisualRecap` → debugging challenge → retrieval quiz → guided and independent katas. The recipe and conventions are in [`docs/visual-learning/visual-language.md`](visual-learning/visual-language.md) §8; per-concept rollout status is in [`docs/visual-learning/concept-visual-map.md`](visual-learning/concept-visual-map.md).

Related corrections in the same session (template unchanged): F2C region table, F3A delta and `$time` examples, F3B race and region-set wording, and F4C clocking-block timing.

## Visual component rebuild (2026-10-03)

Every lesson and sub-lesson visual now follows the F3C pattern inside the unchanged H2 template: a `VisualFrame` with a fidelity label, a prediction gate where the learner can reason about the result, a tested model in `src/lib/*-model.ts`, and a debug mode where natural. Lesson structure and section order did not change; only the embedded visuals, their surrounding sentences, and factual corrections did. Decisions per component are in [`docs/visual-learning/rebuild-plan.md`](visual-learning/rebuild-plan.md), and per-concept coverage is in [`docs/visual-learning/concept-visual-map.md`](visual-learning/concept-visual-map.md).
