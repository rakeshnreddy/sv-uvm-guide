# NB4 practice linkage: build log (2026-10-04)

**Builder:** NB4-practice-linkage. **Branch:** `curriculum-quality-program`. This run resumed a partial run that stopped at a usage limit. The partial work was reviewed, corrected and finished.

## What changed

- **One practice map**, in `src/lib/practice-links.ts`.
  - It maps every exercise, practice visualization and tool page (18 routes), every lab and every interview question to the lessons that teach them. Lessons resolve through the generated curriculum, so URLs are canonical and the order follows `curriculum.manifest.json`.
  - Labs follow their registry `moduleHref`, or else their `owningModule` index. `LAB_LESSON_OVERRIDES` covers labs launched from a sub-lesson and the capstone checkpoints.
  - It also provides `getLabBackLink`, `getLabPrerequisites` (with forward-dependency detection), `getPracticeForLesson` and `getPracticeForModule` (for a future lesson Practice panel).
- **Back links.** Each practice page renders `<LearnInLesson item={requirePracticePage(href)} />`, which shows "Learn this in" and "Related lessons". `requirePracticePage` throws for an unmapped route, so a page cannot ship without its lessons.
  - `LearnInLesson.tsx` takes plain data only, so client components can use it without bundling the curriculum.
- **Lab page.**
  - "Back to module: CODE Title" (or "Back to lesson" for a sub-lesson) comes from the map. It never falls back to `/curriculum`; before this change, 17 of 21 labs did.
  - The guide column lists "Learn it in", "Related lessons", "Before you start" (lessons and labs as links; a planned lab is plain text) and "Do this lab after X" for a forward prerequisite. For example, B-AXI-5's deadlock lab now says to do it after B-AXI-6 (G30-PRAC-V04).
  - At phone width the layout stacks. The page's nested `<main>` is now a named section, the current step has `aria-current="step"`, and grader output wraps.
- **Practice Hub.**
  - It lists labs, exercises, interactive models, diagrams, charts, tools and the interview banks, each section in manifest order. Every card names and links its lesson.
  - Lab cards show prerequisites and a sign-in note. Coming-soon labs are plain text, with only their "Planned for" lesson linked.
  - It uses theme tokens instead of the blueprint gradient. `/exercises` uses the same map and cards.
- **`/interview-prep`** (new). It renders the 6 banks read-only: grouped by bank and level, attempt-first ("Reveal model answer" is a real button with `aria-expanded`), with per-question and per-bank lesson links. The JSON is used as-is.
  - The loader also accepts the optional fields G29 proposes (`modules`, `code`, `follow_ups`, `common_mistakes`, structured `sources`), so the bank rewrite cannot break the build.
  - A question's own `modules` list overrides the map.
- **Mock lab deleted** (G30-PATH-V16). `/practice/lab/mock-lab` now returns 404 through `[labId]`.
  - I also removed the stale generated stub `.next/types/app/(learning)/practice/lab/mock-lab/`, because `tsconfig` includes `.next/types` and `tsc` would fail for every builder. `next build` regenerates the folder.

## Files

- Changed: `src/components/practice/PracticeHub.tsx`; `src/app/(learning)/practice/page.tsx`; `src/app/(learning)/exercises/page.tsx` and the 4 exercise pages; the 12 `src/app/(learning)/practice/visualizations/*/page.tsx`; `src/app/(learning)/practice/waveform-studio/page.tsx`; `src/app/(learning)/practice/lab/[labId]/{page,LabClientPage}.tsx`.
- New: `src/lib/practice-links.ts`; `src/components/practice/LearnInLesson.tsx`; `src/app/(learning)/practice/lab/[labId]/LabNavigation.tsx`; `src/app/(learning)/interview-prep/{page.tsx,RevealAnswer.tsx,interview-banks.ts}`.
- Deleted: `src/app/(learning)/practice/lab/mock-lab/page.tsx`.

## G30 IDs addressed

| ID | Status |
|---|---|
| G30-PRAC-02 | Done for 17 of 18 pages. The 3D sandbox page is not owned by NB4 (lead request 2). |
| G30-PRAC-03 | Done: hub lab cards link the lesson. |
| G30-PRAC-04 | Done in the UI: the back link is derived for all 21 labs. Registry derivation is optional (lead request 9). |
| G30-PRAC-05 | The UI part is done: prerequisites appear on lab pages and hub cards, and unknown ids are hidden. The manifest data fixes are lead request 3. |
| G30-PRAC-06 | Done: one registry for the hub and `/exercises`. The hub lists the Sequencer Arbitration Sandbox and links `/exercises`. |
| G30-PRAC-07 | Done: `/interview-prep`, linked from the hub. |
| G30-PRAC-10 | Hub part done. The LabLink part is lead request 4. |
| G30-PRAC-V04 | Done: "Do this lab after B-AXI-6". |
| G30-PATH-V16 | Done: the page is deleted. |
| G30-PRAC-01, G30-PRAC-V05, G30-PAGE-13 | Data API ready (`getPracticeForModule`). The lesson Practice panel belongs to the lesson-page builder (lead request 5). |
| G30-PRAC-V15 | Listed for the lead (lead request 1). The lab page already shows clickable lesson links. |

## Tests

- New (Vitest):
  - `tests/lib/practice-links.test.ts` (188 tests):
    - canonical targets;
    - every practice route mapped;
    - every page renders its back link;
    - every available lab's launching lesson links it;
    - back-link derivation for all 21 labs;
    - prerequisites and forward dependencies;
    - reverse lookups.
  - `tests/app/interview-prep-banks.test.ts` (15)
  - `tests/app/interview-prep-page.test.tsx` (4)
  - `tests/components/LearnInLesson.test.tsx` (6)
  - `tests/components/LabNavigation.test.tsx` (6)
- New (Playwright), not run here because this role may not start a dev server: `tests/e2e/practice-linkage.spec.ts` (21 tests).
  - Every practice page's "Learn this in" link returns 200.
  - Hub coming-soon labs are not links.
  - Interview answers stay hidden until revealed.
  - No horizontal scroll at 390 px on `/practice` and `/interview-prep`.
  - The mock lab returns 404.
- Updated:
  - `tests/components/PracticeHub.test.tsx`: lab links no longer contain "Available"; the test now checks the registry status, and adds lesson and ordering checks.
  - `tests/qa/curriculumCoverageAudit.spec.ts`: practice routes now live in the map, not in `PracticeHub.tsx`.
- E2E specs updated: none needed.
  - `learner-flow` still finds "Back to module": its accessible name is now "Back to module: E-PSS-1 Portable Stimulus Standard", and Playwright matches the substring.
  - `labs` still sees exactly one H1.

**Validation:** `npx tsc --noEmit -p .` exits 0 on the whole tree. ESLint with `--max-warnings=0` on every owned file exits 0.

The final full Vitest run: 224 of 225 files pass, 2,690 tests pass and 4 are skipped.
- The 2 failures are in `tests/components/Sidebar.test.tsx`: "React is not defined" at `src/components/layout/Sidebar.tsx:423`.
- `Sidebar.tsx` is another builder's file that was mid-rewrite. Vitest compiles JSX to `React.createElement`, so any rendered component needs `import React from 'react'`.
- An earlier full run, before that rewrite, passed all 223 files.

## Deferred

| Item | Reason |
|---|---|
| Back link on `/visualizations/systemverilog-3d` | The page is outside NB4 ownership. Tests track it in `PENDING_BACK_LINKS`. |
| LabLink coming-soon and sign-in states | `src/components/mdx/LabLink.tsx` is not owned. |
| Lab manifest data and README links | `content/` is not owned. |
| Lesson Practice panel; navbar, sidebar and search entries | Other builders' files. |
| Rendering `waveform` (WaveJSON) in bank questions | Not in the banks yet. The loader ignores it until G29's schema change is approved. |

## Lead requests

1. **Lab README links (G30-PRAC-V15).** Replace the repository paths with canonical site URLs:
   - `labs/uvm_callbacks/lab1_driver_behavior/README.md:47`: `../../../T3_Advanced/A-UVM-5_UVM_Callbacks/index.mdx` → `/curriculum/T3_Advanced/A-UVM-5_UVM_Callbacks/index`
   - `labs/uvm_debug/lab1_waveform_trigger/README.md:32`: `../../../T4_Expert/E-DBG-1_Advanced_UVM_Debug_Methodologies/index.mdx` → `/curriculum/T4_Expert/E-DBG-1_Advanced_UVM_Debug_Methodologies/index`
   - `labs/scoreboard/lab1_reference_model/README.md:45`: `../../../T3_Advanced/A-UVM-6_Scoreboards_and_Reference_Models/index.mdx` → `/curriculum/T3_Advanced/A-UVM-6_Scoreboards_and_Reference_Models/index`
   - `labs/ahb_checker/lab1_monitor_checker/README.md:81`: `../../../T3_Advanced/B-AHB-3_AHB_Verification/index.mdx` → `/curriculum/T3_Advanced/B-AHB-3_AHB_Verification/index`
   - `labs/pss/lab1_portable_intent/README.md:90`: `../../../T4_Expert/E-PSS-1_Portable_Stimulus_Standard/index.mdx` → `/curriculum/T4_Expert/E-PSS-1_Portable_Stimulus_Standard/index`
   - `labs/methodology_customization/lab1_custom_phase/README.md:62`: `/curriculum/T4_Expert/E-CUST-1_UVM_Methodology_Customization` → `/curriculum/T4_Expert/E-CUST-1_UVM_Methodology_Customization/index`
   - `labs/soc_level/lab1_vip_reuse/README.md:45`: `/curriculum/T4_Expert/E-SOC-1_SoC-Level_Verification_Strategies` → `/curriculum/T4_Expert/E-SOC-1_SoC-Level_Verification_Strategies/index`

   All paths are under `content/curriculum/`.
2. **3D sandbox back link.** In `src/app/(learning)/visualizations/systemverilog-3d/page.tsx`, render `<LearnInLesson item={requirePracticePage('/visualizations/systemverilog-3d')} />` under the intro. Then remove the route from `PENDING_BACK_LINKS` in `tests/lib/practice-links.test.ts` and `tests/e2e/practice-linkage.spec.ts`.
3. **Lab manifests (G30-PRAC-05).**
   - Drop the coming-soon `simple-dut-1` from `labPrerequisites` of six labs: config-debug, methodology-custom-phase, ral-mirror-bug, scoreboard-decoupling, soc-vip-reuse and callbacks-driver-behavior. Re-point them to LAB-T2-ENV when it exists.
   - Change `simple-dut-1`'s `owningModule` from "F4" to a real module: F4C until F2E exists.
   - `ipc-deadlock`: change `modulePrerequisites` from `["systemverilog-basics"]` to `["F2D"]`.
   - `ahb-axi-bridge-debug`: move `ahb-checker-lab` and `axi-scoreboard-lab` from `modulePrerequisites` to `labPrerequisites`.
   - `axi-deadlock-hunt-lab`: move `axi-scoreboard-lab` to `labPrerequisites`, or drop it if the lab does not need it. The UI shows "Do this lab after B-AXI-6" either way.
   - `pss-portable-intent`: drop its own module, `E-PSS-1`, from `modulePrerequisites`.
4. **`src/components/mdx/LabLink.tsx`.** Render `coming_soon` labs as a non-link "Coming soon" (G30-PRAC-09). Add "Sign in required" (G30-PRAC-10). Optionally show `getLabPrerequisites(lab).doAfter` as "after X".
5. **Lesson Practice panel (G30-PAGE-13, PRAC-01, PRAC-V05).** Use `getPracticeForModule(moduleSlug, lessonRef, getAllLabs())` from the lesson page, and show `after` as "after <lesson>".
6. **Navigation.**
   - Add Interview prep (`/interview-prep`) and Labs (`/practice#labs`) to the navbar and sidebar (G30-SIDE-04/05).
   - The B-AMBA-F3 lesson should link `/interview-prep#amba-protocol-interview-question-bank` (G29 request 1).
7. **Interview banks.**
   - When the bank group rewrites or adds questions, each new id needs a `modules` array in the bank JSON or an `INTERVIEW_QUESTION_LESSONS` entry. Renamed ids leave stale map keys. `tests/app/interview-prep-banks.test.ts` names both.
   - The loader already accepts G29's proposed fields. Update `src/types/interview-question.ts` and `tests/interview-questions/bank-schema.test.ts` if you approve them.
8. **Other builders.**
   - `src/lib/learning-paths.ts` hard-codes practice titles and hrefs: read them from `getPracticePage(href)` so they cannot drift.
   - The search index could include `PRACTICE_PAGES` and the interview questions (G30-SRCH-01).
   - `src/components/exercises/ExerciseList.tsx` is now unused and can be deleted.
9. **Optional (G30-PRAC-04 data side).** `scripts/generate-lab-registry.mjs` could derive `moduleHref` from `owningModule` and fail when it does not resolve. The tests already check that any registry `moduleHref` agrees with the map.
