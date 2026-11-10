# 6a page:assessment — author log

## What I built

`/assessment` is rebuilt as a self-assessment read only from the learner store. The old page rendered the mock `ComprehensiveAssessmentSystem` (sample scores, certifications, a skill matrix); none of that is imported any more.

- `src/app/(learning)/assessment/page.tsx` (server, `dynamic = 'error'`): builds the static inputs (curriculum totals, available labs with owning module and lab prerequisites, the placement plan for each tier, placement area titles and versions). It still answers 404 while `SITE_FEATURES.assessmentCenter` is off. See the shared-file requests below.
- `src/app/(learning)/assessment/assessment-model.ts` (pure, testable): `TRACKS`, `trackForModule` (module folder, code or deck id to track), `nextLessonInTrack`, `buildAssessmentSummary`, `isStalePlacement`, `placementPlanFor`. Tracks:
  - SystemVerilog: F*, I-SV-* except 3/4/9.
  - UVM: I-SV-9, I-UVM-*, A-UVM-*.
  - Assertions and coverage: I-SV-3*, I-SV-4*.
  - AMBA: B-*.
  - Expert topics: E-*.

  A test checks that every curriculum module falls in a track.
- `src/app/(learning)/assessment/AssessmentPageClient.tsx` (client). It shows:
  - "Lessons by track": a figure. Done is drawn solid and opened-but-not-done is striped, so the bars do not rely on colour. The bars are `aria-hidden`, and each one has visible text with the same numbers.
  - "Placement result": the latest attempt, the score per area with text and a bar, the placement starting lesson, and a note when the quiz version has changed since the attempt.
  - One section per track with five stats: lessons done/opened/total; quizzes at 75% or more, with the average best score; labs completed/in progress; flashcards well known, rated and due; and the placement area. AMBA and the expert topics say the placement quiz does not cover them.
  - Up to three "Next steps" per track, each with its reason taken from the learner's own record. In order: retake the weakest quiz under 75%, finish the lab in progress, continue with or start the next lesson not marked done (skipped when the retake already links that lesson), review due cards, then start a lab whose prerequisites are done and whose module the learner has started.
  - A `<details>` block per track listing the modules, labs and weak quizzes behind the numbers.
- States:
  - Server render and hydration show a neutral line only.
  - Empty state when nothing is recorded: placement, Junior route, import a backup.
  - An account notice while the persistence target is `server`.
  - The page never writes and makes no request.
- Honesty rules:
  - "Well known" is defined on the page as a next review 21 or more days away. It is a page rule and is not attributed to any source.
  - The header says the page is a self-check, not a grade or a certificate.
  - Quiz results for lessons that no longer exist, lab records for labs that are not available, and decks without a module-code id are left out, so no stored string becomes a link.
- Layout at 390 px:
  - Grids are one column at the base breakpoint.
  - Rows use `flex-wrap`; long names use `[overflow-wrap:anywhere]`; link buttons use `max-w-full`.
  - No tables, so nothing scrolls sideways.
  - Not checked in a browser, because this step does not allow dev servers.

## Sources verified

- The page makes no standard, clause, API or historical claims, so I read no primary source.
- Data contracts were read in place:
  - `src/lib/learner-store/repositories/*`
  - `src/lib/learner-stats.ts`
  - `src/lib/learning-paths.ts` (`resolvePlacementPlan`, `MILESTONES`)
  - `src/components/assessment/placementQuizData.ts`
  - `src/generated/lab-registry.ts`
- Visual rules came from `docs/visual-learning/visual-language.md` §2, §4 and §7: a non-colour cue, a text equivalent, and the 390 px rule.

## Verilator

`verilator --version` gives Verilator 5.052. This item ships no SystemVerilog files, so there was nothing to compile.

## Validation

- `NODE_OPTIONS='--require @prisma/client' npx vitest run tests/app/assessment-page.test.tsx`: 13 of 13 pass.
- `tests/app/feature-gating.spec.tsx`: the assessment cases pass. One unrelated case fails: the projects draft page cannot find its "Practical Projects & Case Studies" heading. That page belongs to another item's files.
- `tests/app/sitemap.test.ts` and `tests/placement-links.spec.ts` pass.
- `npx tsc --noEmit -p .` is clean.
- `npx eslint "src/app/(learning)/assessment" tests/app/assessment-page.test.tsx` is clean.
- No MDX was touched, so `check-mdx` does not apply.

## Shared-file requests

1. `src/lib/site-features.ts`: set `assessmentCenter: true` and change its comment to "The self-assessment at /assessment, built from data in this browser". The page no longer has mock content.
2. `tests/lib/site-features.test.ts`: expect `assessmentCenter: true`.
3. `tests/app/feature-gating.spec.tsx`: replace the "tracking means draft preview only" block with an always-renders check.
4. `tests/components/Navbar.test.tsx` and `tests/components/KeyboardShortcuts.test.tsx`: update the mocked `assessmentCenter` if a navigation link is added.
5. `src/app/sitemap.ts`: move `/assessment` from "hidden pages" to the learner-pages comment (keep it out of the sitemap, like `/dashboard`).
6. `tests/app/sitemap.test.ts`: drop `/assessment` from `HIDDEN_PAGES`, but keep it out of `PUBLIC_PAGES`.
7. `src/app/robots.ts`: add `/assessment` to `disallow`, as for `/dashboard` and `/settings`.
8. `src/components/learner/LearnerSectionNav.tsx`: add `{ id: "assessment", label: "Self-assessment", href: "/assessment" }` to the section union and links. The page then renders `<LearnerSectionNav current="assessment" />`. It is left out for now because the union has no `assessment` member.
9. `tests/placement-links.spec.ts` (lines 117 and 127): it asserts there is no `href="/assessment"` and no "assessment center". Update it if the placement result or the dashboard starts linking the self-assessment. A link from the dashboard's Placement card and from the placement result is recommended.
10. `src/components/assessment/`: `ComprehensiveAssessmentSystem.tsx`, `CompetencyCertification.tsx`, `ProgressAnalytics.tsx`, `SkillMatrixVisualizer.tsx` and `ProjectBasedEvaluator.tsx` are now unused. Delete them; only the old page imported them. Keep `AdaptiveTestEngine.tsx`: `tests/components/AdaptiveTestEngine.reducer.test.ts` and `tests/server/assessment-question-bank.test.ts` import it.
