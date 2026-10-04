# NB4 practice linkage: review, round 1 (2026-10-04)

**Reviewer:** NB4 reviewer (read-only). **Branch:** `curriculum-quality-program`. **Build log:** [`NB4-practice-linkage.build.md`](NB4-practice-linkage.build.md).

**Verdict: pass.** There are no S1 or S2 findings, and validation is green for NB4's files. There are 4 S3 findings: 3 are for the builder, and 1 is a lead decision that does not count against this build. There are 11 S4 findings.

## Validation (run by the reviewer)

| Check | Result |
|---|---|
| `npx tsc --noEmit -p .` | exit 0, no output |
| `npx eslint --max-warnings=0` on all 26 owned source files, the 6 owned unit specs, `tests/e2e/practice-linkage.spec.ts` and `tests/qa/curriculumCoverageAudit.spec.ts` | exit 0 |
| `NODE_OPTIONS='--require @prisma/client' npx vitest run` on the builder's 7 spec files | 7 files pass: 231 tests pass, 2 are skipped |
| Existing specs that touch these files (`amba-flashcards`, `InteractiveUvmArchitectureDiagram`, `Navbar`, `bank-schema`, `curriculum-overview`, `learning-paths`, `waveform-studio`, `labsPlatformAudit`, `scheduling-semantics-lint`) | 9 files, 382 tests pass |
| Full `npx vitest run` | 232 of 233 files pass. The only failures are 2 tests in `tests/components/Breadcrumbs.test.tsx`. `src/components/layout/Breadcrumbs.tsx` is another builder's file and is being rewritten, so these failures are not NB4's. |
| `npx playwright test --list tests/e2e/practice-linkage.spec.ts` | collects 21 tests; not run, because this role may not start a server |

## What I checked

**1. Correctness against G30 and the task.**

*Practice map (G30-PRAC-02, PRAC-06).*
- I read `src/lib/practice-links.ts` in full.
- All 18 practice routes are mapped. Every target resolves to a canonical 3-segment URL with the `index` slug and exact folder case, which matches `src/lib/curriculum/lesson-urls.ts`.
- I checked each teaching lesson against the spine cards:
  - F2C teaches fork/join and FSM coding.
  - I-SV-9 maps the testbench layers onto UVM base classes.
  - The other mappings follow the G30 practice-linkage map.
- I checked the 3 descriptions I could test against their components: the data-types animation, the FSM designer and the phase sorter. Each matches its component, including the "Check Order" and "Shuffle Again" labels and the claim that the best score is stored in `localStorage`.

*Lab back link (G30-PRAC-04).* I ran `getLabBackLink`, `getLabLessons` and `getLabPrerequisites` against all 29 registry labs:
- All 21 available labs return to a lesson that contains their `LabLink` or `/practice/lab/<id>` link. None falls back to `/curriculum`.
- The 2 sub-lesson labs (`randomization-advanced-1`, `coverage-advanced-1`) say "Back to lesson".
- `simple-dut-1` (owning module "F4") falls back to `/practice#labs`, and the hub renders that anchor.

*Prerequisites (G30-PRAC-05, PRAC-V04).*
- `axi-deadlock-hunt-lab` is the only forward dependency in the data, and it gets "Do this lab after B-AXI-6".
- `pss-portable-intent` skips its own module.
- `systemverilog-basics` is unresolved and hidden.
- The lab ids in `modulePrerequisites` (on the bridge lab) are tried as labs first.

*Practice Hub (G30-PRAC-03, PRAC-06, PRAC-10).*
- Labs are listed in manifest order, with T3 in spine order (A-UVM-6, 7, 5, 8, 4A, 4B).
- Every card names and links its lesson.
- Coming-soon labs are `<h4>` text; only their "Planned for" lesson is a link.
- `/exercises` uses the same registry.

*Mock lab (G30-PATH-V16).* The page is deleted, and nothing references it. `[labId]` calls `notFound()` before the session check, so the route returns 404 without sign-in.

*Interview prep (G30-PRAC-07).*
- All 6 banks and all 59 questions load as-is.
- Questions are grouped by bank and level, junior first.
- `INTERVIEW_QUESTION_LESSONS` has 59 keys and no stale or missing ids. Each question's lessons agree with G29's module column or are a defensible choice.
- Every model-answer fence parses. Only `sva-repetition-operators` and `amba-bridge-4kb-split` have fences.

*Lab README links (G30-PRAC-V15).* All 7 README lines in lead request 1 are exact: I checked the line numbers and the old text. No other lab README links a lesson.

*Edge cases.*
- Electives say "(elective)" in text.
- Sub-lessons get "Back to lesson".
- Labs with no prerequisites render nothing.
- `resolveLessonRef` does not accept pretty slugs, but the banks test fails on any `modules` entry that does not resolve.
- First and last lessons: the reverse lookup handles F1A and E-AI-1.

**2. Accessibility and UX.**
- Landmarks have names: "Lessons for X", "Practice sections", "Interview banks", "Lab guide", "Lab workspace", and one region per bank and per hub section.
- The nested `<main>` on the lab page is gone, and the current step has `aria-current="step"`.
- Reveal is a real button with `aria-expanded` and `aria-controls`.
- Status is shown as text, not colour alone.
- The card transition is `motion-reduce:transition-none`.
- Grids use `minmax(min(100%,…),1fr)`, and long text uses `[overflow-wrap:anywhere]`. I found no 390 px overflow risk in the classes. Code panels are dark slate, per visual-language §4.
- Contrast with the theme tokens:
  - In default light and dark, every new text and link pairing passes AA. The lowest is primary on secondary at 4.70:1.
  - Forest-dark fails; see S4-9.

**3. Pinned behaviour (spine §3.5 and `tests/e2e`).**
- `learner-flow` clicks `getByRole('link', { name: 'Back to module' })`. Playwright matches a substring, and the link's name is now "Back to module: E-PSS-1 Portable Stimulus Standard", so it still matches. It is the only such link, and the arrow is `aria-hidden`.
- `labs` still finds one H1, the "Check solution" button, and one `pre[aria-live]` that is not `simulation-output`.
- These specs are unaffected:
  - `exercise-feedback`, `visualizations` and `uvm-architecture-visual` scope by test id;
  - `regression-gates` and `navigation` only visit lesson pages or `/practice`.
- No spec or snapshot pins the old visualization H1s ("Coverage Cross Explorer", "Randomization Explorer", "Concurrency: fork…").
- Saying that no existing spec needed an update is correct.

**4. Tests.**
- The tests fail on the defects they target:
  - a `/curriculum` back link;
  - an unmapped practice route;
  - a missing back-link component;
  - a coming-soon lab rendered as a link;
  - an answer visible before reveal;
  - a bank file that is not imported;
  - a stale map key;
  - a lost forward dependency.
- The gaps are S4-5, S4-10 and S4-11.

## Findings

### S3

1. **S3 `src/lib/practice-links.ts:655-671` (`addLab`), rendered at `src/components/practice/LearnInLesson.tsx:101-104`: a coming-soon lab is shown as "Before you start".**
   - **Problem.** Six available labs (config-debug, scoreboard-decoupling, ral-mirror-bug, callbacks-driver-behavior, methodology-custom-phase and soc-vip-reuse) show "Before you start: Lab: Simple DUT Verification (planned, not available yet)", on both the lab page and the hub card.
   - **Why it matters.**
     - The learner is told to finish a prerequisite that cannot be opened.
     - Spine Appendix B says that prerequisite is wrong data anyway: it is a non-UVM first testbench, to be re-pointed to LAB-T2-ENV.
     - G30-PRAC-05's acceptance is "every `labPrerequisites` entry is available".
   - **Fix.**
     - Until lead request 3 lands, do not add `coming_soon` labs to `items`. Report them in `unresolved`, or in a separate `planned` list rendered as "Planned warm-up lab (not required yet)".
     - Update `tests/components/LearnInLesson.test.tsx:53-63` and `tests/lib/practice-links.test.ts:292-302`.

2. **S3 `src/lib/practice-links.ts:270-276`, `:612-616` and `:794-799`: capstone checkpoints are treated as forward work.**
   - **Problem.** `uvm-mini-capstone` is launched from four T2 "## Capstone Checkpoint" sections: I-UVM-1B:254, I-UVM-2A:236, I-UVM-2B:294 and I-UVM-3A:275.
     - **(a) Lab page.**
       - "Back to module" goes to A-UVM-6, a T3 lesson.
       - "Before you start" lists the A-UVM-6 reference-model lab with no "after" note.
     - **(b) Reverse lookup.** It returns `after: A-UVM-6` for all four T2 lessons. I confirmed this by running it.
       - Lead request 5 says to render `after` as "after <lesson>", so the Practice panel would contradict the checkpoint each lesson asks for now.
       - `tests/lib/practice-links.test.ts:336-338` pins this behaviour.
   - **Fix.** Mark checkpoint lessons explicitly, for example `LAB_CHECKPOINTS: { 'uvm-mini-capstone': [...] }` or `{ ref, role: 'checkpoint' }` override entries.
     - For those lessons, return `teaches: true` and no `after`.
     - Keep `after` for real forward links such as A-UVM-6 → `axi-scoreboard-lab` (after B-AXI-6).
     - Update the test.
     - For the back link, add a lead request: let `LabLink` pass `?from=<lessonRef>`, and have `getLabBackLink` honour it when it names one of the lab's lessons.

3. **S3 `src/components/practice/PracticeHub.tsx:22`, used at `:141-143` and `:263-265`: inline links are marked by colour only.**
   - **Problem.** The `textLink` links inside the muted intro paragraphs ("exercises page" and "interview prep page") have no underline until hover.
     - Primary against muted-foreground is 1.19:1 in light and 1.04:1 in dark.
     - So only hue and weight 500 against 400 mark them as links. This fails the brief's "no colour-only cues" rule (WCAG 1.4.1).
   - **Fix.** Make `textLink` underlined by default: `underline underline-offset-4` (optionally `hover:no-underline`). Do the same for the copy in `LearnInLesson.tsx:17` if it is ever used inside running text.

4. **S3 (lead decision, not a builder defect) `src/app/(learning)/interview-prep/page.tsx:180-183`: the new route exposes known S1 errors.**
   - **Problem.** `/interview-prep` makes reachable the 7 S1 errors G29 lists:
     - packed-array slicing rubric;
     - analysis-port "copy";
     - drain time as a "safety net";
     - reversed DMA agent roles;
     - the SVA "exactly 2 cycles" property;
     - the UniqueDirty invariant.

     It also exposes every IEEE 1800.2 clause number in the banks, which G29 says are all wrong. The page carries a general disclaimer but does not say which answers are wrong. The task said to render the JSON as-is, so the builder did what was asked.
   - **Fix (lead).** Before release, either:
     - land G29's bank fixes first; or
     - gate the route, or ask NB4 for a per-question "Under review" note keyed by the G29 S1 question ids.

### S4

1. **S4 `src/components/practice/PracticeHub.tsx:190-194` and `:215-216`: jump-link counts lack context.**
   - **Problem.**
     - The counts have no unit, so the link reads as "Labs 29" or "Labs29".
     - The Labs count includes the 8 coming-soon labs, although only 21 can be opened.
   - **Fix.** Add a visually hidden unit ("29 items"), or show "Labs (21 + 8 planned)".

2. **S4 `src/app/(learning)/practice/lab/[labId]/LabNavigation.tsx:55-59`, rendered at `LabClientPage.tsx:276-282`: the same link appears twice.**
   - **Problem.** The lab guide shows "Back to module: X" and, right below it, "Learn it in: X". Both go to the same place.
   - **Fix.** Skip "Learn it in" when `lessons[0].ref === backLink.lesson?.ref`, or keep only "Related lessons".

3. **S4 `LearnInLesson.tsx:145` against `PracticeHub.tsx:76` and `LabNavigation.tsx:59`: the label differs between pages.**
   - **Problem.**
     - Practice pages say "Learn this in", while hub cards and lab pages say "Learn it in".
     - On the interview-bank cards, "Learn it in F2A Core Data Types" over-claims for a bank that spans many modules.
   - **Fix.** Use one label everywhere. For banks, use "Start with" or "Related lessons".

4. **S4 `src/app/(learning)/interview-prep/interview-banks.ts:200-208`: anchors are not stable.**
   - **Problem.**
     - Bank anchors are slugs of the bank title, for example `#soc--system-design-interview-question-bank`.
     - Level anchors depend on page order (`junior-1`, `mid-level-3` and so on).
     - Lead request 6 asks B-AMBA-F3 to deep-link `#amba-protocol-interview-question-bank`. If G29 renames the bank, that link breaks silently.
   - **Fix.**
     - Derive the bank anchor from the stable `bank.id` or `topic`, and give levels `<bankAnchor>-<level>` ids.
     - Add a test that the anchor named in lead request 6 exists.

5. **S4 `tests/lib/practice-links.test.ts:127-137`: the back-link check is a source-text heuristic.**
   - **Problem.** It passes when the href string appears anywhere in the page, even if `requirePracticePage` is given a different route.
   - **Fix.** Assert `requirePracticePage('<href>')`, or `const HREF = '<href>'` together with `requirePracticePage(HREF)`. Or render each page's default export and look for the "Lessons for <title>" nav.

6. **S4 `src/app/(learning)/interview-prep/RevealAnswer.tsx:22-30`: the reveal buttons all have the same name.**
   - **Problem.** All 59 buttons are named "Reveal model answer", so a screen reader's list of buttons loses context.
   - **Fix.** Pass the prompt's heading id and set `aria-describedby`.

7. **S4 `src/components/practice/PracticeHub.tsx:4`: a shared component imports from a route folder.**
   - **Problem.** A shared component imports its data from `@/app/(learning)/interview-prep/interview-banks`. The builder's ownership forced this placement.
   - **Fix (lead).** Move the loader to `src/lib/interview-banks.ts`.

8. **S4 `src/app/(learning)/practice/lab/[labId]/LabClientPage.tsx:272-282`: the lab title sits inside the aside.**
   - **Problem.** The page's H1 and back link sit inside `<aside aria-label="Lab guide">`, a complementary landmark. This structure was already there.
   - **Fix.** Move the back link, code, H1 and description into a header above the two columns, and keep the steps and files in the aside.

9. **S4 `src/app/globals.css:194-197` (forest-dark), affecting `LabClientPage.tsx:276-282`: links in the lab guide fail contrast in one theme.**
   - **Problem.**
     - In forest-dark, `text-primary` on `bg-secondary` is 3.80:1, so the lab guide's back link and lesson links fall below AA.
     - The old back link sat on `bg-card`, where it is 5.2:1.
     - Default light and dark pass.
   - **Fix.** Either the lead raises forest-dark `--primary` lightness, or the link block goes on `bg-card`.

10. **S4 `tests/e2e/practice-linkage.spec.ts:45-53`: the reveal test never checks the hidden state.**
    - **Problem.** The test named "hidden until revealed" never asserts that the answer is hidden before the click.
    - **Fix.** Add `await expect(page.getByText('Model answer', { exact: true }).first()).toBeHidden()` before the click.

11. **S4 `src/app/(learning)/practice/lab/[labId]/LabClientPage.tsx:276-282`: no test covers the lab page's wiring.**
    - **Problem.**
      - No unit test renders `LabClientPage`. Only the `LabNavigation` parts are tested.
      - The e2e checks only the E-PSS-1 back link; no e2e checks "Do this lab after" on a real lab page.
    - **Fix.** Either:
      - add a Vitest render of `LabClientPage` with `next/dynamic` and Monaco mocked; or
      - extend an authenticated e2e to `/practice/lab/axi-deadlock-hunt-lab` and assert "Do this lab after".

## Notes for the lead

- **Generated files.** The builder removed the stale generated folder `.next/types/app/(learning)/practice/lab/mock-lab/` so that `tsc` passes. It is gitignored build output, and `next build` regenerates it.
- **Sidebar and Breadcrumbs failures.** The build log reports 2 failures in `Sidebar.test.tsx`. In my run, Sidebar passes and `Breadcrumbs.test.tsx` fails instead. Both come from other builders' work in progress.
- **Lead requests.** Lead requests 1–9 in the build log are accurate and still needed, especially:
  - 2: the 3D sandbox back link;
  - 3: the lab manifest data, which also resolves S3-1;
  - 5: the lesson Practice panel; fix S3-2 first.
