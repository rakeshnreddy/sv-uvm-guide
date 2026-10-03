> **Provenance.** Area report produced during the 2026-10-03 learning-outcome audit by a read-only review agent, then reviewed by the lead auditor. Key claims were spot-checked against source, the running site, IEEE 1800-2023 (repo `system_verilog_lrm.pdf`), and Arm IHI0033 text. Line numbers refer to commit `488f7f43`. Items fixed in the same session are listed in [../audit-report.md](../audit-report.md) §9; everything else is open.

# Platform and learning-support integration audit (re-verification)

- Repo: `/Users/Rakesh/Projects/sv-uvm-guide`, `main @ 488f7f43d2523840efebb0c4d1f87e9087807c2d` (verified with `git rev-parse HEAD`).
- Date: 2026-10-03. Read-only audit. No repository file was edited. Scratch scripts and logs live in `scratchpad/audit/` (listed at the end).
- Working-tree caveat: while this audit ran, another session created untracked files (`src/lib/sv-scheduler-model.ts`, `src/lib/sv-scheduler-scenarios.ts`, `tests/lib/sv-scheduler-model.test.ts`, `src/components/visual-system/*`). They are not part of the commit. All counts below are for the committed tree unless stated otherwise.
- Method: every count was recomputed from source with shell/node commands, shown inline. For the two most important defects (quiz answer keys and the interview playground) I rendered the real components in jsdom with the exact data shapes the MDX passes (`probe/pg-entry.tsx`).

---

## 0. Headline results (new findings not in the prior audit)

| ID | Sev | Finding | Confidence |
|---|---|---|---|
| PLAT-01 | **S1** | **32 quiz questions in 10 lessons (T3/T4) grade a wrong answer as correct.** These questions use numeric `correctAnswer: 1` or `correctIndex: n`. `Quiz` only accepts string keys, so it falls back to `options[0]`. In the probe, choosing the intended answer showed "Incorrect." and choosing the distractor showed "Correct!". | High (rendered) |
| PLAT-02 | **S2** | **All 21 `InterviewQuestionPlayground` uses in MDX are broken.** The MDX passes `{text,isCorrect,feedback}`, but the component reads `{id,label,isCorrect,explanation}`. The probe showed empty option buttons and a Submit button that stays disabled after a click, so feedback never appears. The 21 uses are in I-SV-1, 2A, 2B, 3A, 3B, 4A, 4B and 5. | High (rendered) |
| PLAT-03 | S2 | **Lesson completion is never recorded anywhere.** `completeLesson()` has no caller. All curriculum progress bars stay at 0%, and the "in-progress" and "completed" filters never match. No code writes Prisma `LessonProgress`. The only `Activity` writer is `AI_REQUEST`, and the engagement endpoint excludes that type. | High |
| PLAT-04 | S2 | **Navigation order is alphabetical, and authored `order:` frontmatter is ignored.** AHB comes before the AMBA introduction. Bridges, ACE/CHI and the Interview Clinic come before AXI-1. E-AI-1 opens T4 even though it lists E-PYUVM-1 as a prerequisite. I-UVM-3B opens with "coordinated-attack-lab" and puts sequencer-driver-handshake 6th of 9. | High |
| PLAT-05 | S2 | **The 59-question interview banks are not shown anywhere in the UI.** Only tests import them. | High |
| PLAT-06 | S2 | **Quiz feedback does not diagnose mistakes.** Each question has one explanation whichever option is chosen. The correct option is not revealed after a wrong pick. There is no score, no retry, and nothing is persisted. | High |
| PLAT-07 | S2 | **Lab prerequisite metadata is wrong and never enforced.** 7 available labs require `simple-dut-1`, which is coming soon. `modulePrerequisites` contains lab IDs and modules that do not exist. A self-attested lab can be "completed" in 2–4 clicks, which unlocks the solution with no code evidence. | High |
| PLAT-08 | S3 | **"Teach it back" (Feynman) fails silently** on every lesson for anonymous or unconfigured users, because the client never checks `response.ok`. | High (source) |
| PLAT-09 | S3 | **Homepage and placement copy promise features that do not exist with default flags:** a 404 "Live Code Editor" link, a leaderboard and badges, a 24/7 AI tutor, and a personalized dashboard. | High |
| PLAT-10 | S3 | **Placeholder pages are routable:** `/learning-strategies`, `/history`, `/resources`, and `/practice/lab/mock-lab` (which shows fake test results). | High |
| PLAT-11 | S3 | **The Playwright web server forces every flag on**, so the default-flag spec skips itself. The surface learners actually see by default is not browser-tested by the release command. | High |

Prior-audit findings A–H were re-verified (section 1). Flashcard gaps, the storage split and prototype mocks are confirmed with exact lists.

---

## 1. Prior-audit claim verification (`docs/project-analysis-2026-10-03.md`)

| Prior claim | Verdict | Evidence / new value |
|---|---|---|
| T1 13 modules / 16 MDX | CONFIRMED | `find content/curriculum/T1_Foundational -mindepth 2 -maxdepth 2 -name index.mdx \| wc -l` → 13; `find … -name '*.mdx' \| wc -l` → 16 |
| T2 24 / 51 (13 SV + 11 UVM) | CONFIRMED | 24 / 51. I-SV-1..9 (incl. 2A/2B/3A/3B/4A/4B/4C) = 13; I-UVM-1A..6 = 11 |
| T3 20 / 23 (6 UVM + 14 AMBA) | CONFIRMED | 20 / 23 |
| T4 12 / 15 | CONFIRMED | 12 / 15 |
| 69 modules / 105 MDX | CONFIRMED | 69 / 105 (also `src/lib/curriculum-data.tsx` linearizes to 105 topics) |
| 29 lab manifests; 21 available, 8 coming soon | CONFIRMED | `node labs.js` → `{"labs":29,"avail":21,"cs":8}` |
| 63 steps; 61 self-attested, 2 graded | CONFIRMED | `{"steps":63,"pol":{"self_attested":61,"graded":2}}` (only `basics-1`, graderId `sv-basics-v1`) |
| 64 flashcard files / 412 cards | CONFIRMED | `ls content/flashcards \| wc -l` → 64; card sum → 412 |
| 53 registered keys / 363 cards | CONFIRMED | `fc.js` → 53 keys, 363 cards in registered files |
| 32 unregistered refs, 29 in module indexes | CONFIRMED | `fc.js` → `total refs 70 unregistered 32 unregistered in index.mdx 29` (full list in §2.3) |
| Interview banks 6 / 59 questions | CONFIRMED | 13+6+7+6+17+10 = 59 |
| visualizers 20 TSX, visuals 25 TSX, components 194 TSX | CONFIRMED (committed tree) | `git ls-files src/components \| grep -c '\.tsx$'` → 194. The working tree now has 201 because of the concurrent untracked `visual-system/` files. |
| 43 page files, 15 API routes | CONFIRMED | `find src/app -name page.tsx \| wc -l` → 43; `find src/app/api -name route.ts \| wc -l` → 15 |
| Vitest 120 files, 795 tests, 5 skipped; ordinary run 1 failure | CONFIRMED | Full run today: `Test Files 1 failed \| 120 passed (121)`, `Tests 1 failed \| 808 passed \| 5 skipped (814)`. Subtracting the concurrent untracked `tests/lib/sv-scheduler-model.test.ts` (19 tests) gives 120 files and 795 tests (789 pass / 1 fail / 5 skip). The failure is the same: `security-config.test.ts > throws an error if both secrets are missing in production`. |
| Playwright 31 spec files | CONFIRMED | `find tests/e2e -name '*.spec.ts' \| wc -l` → 31 |
| 27 generated redirects | CONFIRMED | `curriculumRedirects.length` → 27; `redirects.json` → 27 |
| Five optional checks skipped; enabling all gives 14 pass / 1 fail; link audit reports 41 | CONFIRMED | `QA_STRICT_LINK_AUDIT=1 QA_STRICT_ANCHOR_AUDIT=1 QA_STRICT_IUVM3_AUDIT=1 QA_STRICT_A11Y_AUDIT=1 npx vitest run tests/qa/curriculumCoverageAudit.spec.ts tests/qa/iuvm3SplitMergeAudit.spec.ts tests/components/TLMPortConnector.test.tsx` → `Tests 1 failed \| 14 passed (15)`, 41 entries. Correction: the "TLM control naming" check is gated by `QA_STRICT_A11Y_AUDIT` (accessible name of the connect button). |
| All five flags default false | CONFIRMED | `src/tools/featureFlags.ts:1-7` |
| Release browser tests force flags on | CONFIRMED | `playwright.config.ts:15-20` sets all `NEXT_PUBLIC_FEATURE_FLAG_*=true` and `FEATURE_FLAGS_FORCE_ON=true` |
| Assessment → disabled notice; community/settings → 404; projects → holding text | CONFIRMED | `assessment/page.tsx:5-16`, `community/page.tsx:5-6`, `settings/page.tsx:15-16`, `projects/page.tsx:5-13` |
| `useCurriculumProgress` / `LessonVisitTracker` / `useExerciseProgress` write only localStorage; no Prisma LessonProgress writer | CONFIRMED, and worse | `grep -rn lessonProgress src` → only `engagement.ts:199` (a read). Also, `completeLesson` has no production caller (PLAT-03). |
| Legacy Firestore remains (community, TopicPage) | CONFIRMED | Files: `src/app/(learning)/community/CommunityPageClient.tsx`, `community/post/[postId]/PostClientPage.tsx`, `community/post/[postId]/page.tsx`, `src/components/templates/TopicPage.tsx`, `src/lib/firebase.ts`, `src/lib/firebaseAuth.mock.ts` (plus `firestore.mock.ts`, `firebaseConfig.mock.ts`) |
| `FlashcardWidget` shows "No flashcards available or component loading..." | CONFIRMED | `src/components/widgets/FlashcardWidget.tsx:62-66` |
| `getMdxComponents` ignores the requested list | CONFIRMED | `src/generated/mdx-component-registry.tsx:112-114` |
| Dashboard hard-codes 65% / badges / rank | CONFIRMED | `dashboard/DashboardPageClient.tsx:12` `const overallProgress = 65;`, `:101` "5 badges earned", `:124` "Top 10% of learners" (gated by `tracking`, 404 by default) |
| `ProjectBasedEvaluator` random scores | CONFIRMED | `ProjectBasedEvaluator.tsx:37-40` `70 + Math.floor(Math.random() * 25)` etc. Reachable only via `/assessment` with `tracking` on. |
| Notebook create is a placeholder; `createFlashcard` writes placeholder content | CONFIRMED, with a correction | `actions/notebook.ts:10-13`, `actions/srs.ts:12-15`. Correction: neither action has any caller in `src`, so both are dead code rather than a learner-facing flow. |
| Interview spec shape (`question/difficulty/answer_type/key_points`) incompatible with the bank test | CONFIRMED | `docs/planning/foundational-upgrade-spec.md:90-104` vs `tests/interview-questions/bank-schema.test.ts:19-36, 81-90` |
| Six spec visuals absent; no foundational bank; no Kata headings in T1 | CONFIRMED at commit 488f7f43 | Late in this audit a concurrent session created an untracked `src/components/visuals/RaceConditionDebugger.tsx` and modified `src/components/ui/InteractiveCode.tsx`; neither is committed. At the time of the check, `grep -rl <Name> src content` was empty for all six; no `content/interview-questions/foundational_systemverilog.json`; `grep -rn -i '^#.*kata' content/curriculum/T1_Foundational` empty |
| `PROJECT_GUIDE.md` still says Firebase is authoritative | CONFIRMED | `PROJECT_GUIDE.md:94` "User documents are keyed by Firebase Auth UID…"; `:117` cites `/api/engagement/:userId`, which does not exist (the route is `/api/me/engagement`) |
| Concept linking and knowledge graph presented as a real system | CONFIRMED (more specific) | `knowledge-graph-engine.ts:40` "Expanded placeholder data": 15 hard-coded nodes / 19 edges, used for concept links on every lesson (PLAT-13) |

No prior claim failed to reproduce.

---

## 2. Section A — Inventories (recounted)

### 2.1 Modules, MDX and sub-lessons

```
for t in content/curriculum/T*; do echo "$t modules=$(find $t -mindepth 2 -maxdepth 2 -name index.mdx | wc -l) mdx=$(find $t -name '*.mdx' | wc -l)"; done
T1_Foundational modules=13 mdx=16 | T2_Intermediate 24/51 | T3_Advanced 20/23 | T4_Expert 12/15  → 69 / 105
```

Modules with sub-lessons (`#n` is the position in the global prev/next order):
- F2C: index#6, flow-control#7
- F2D: index#8, ipc#9, tasks-functions#10
- I-SV-1: index#17, constructors#18, copying-and-cloning#19, parameterized-classes#20, polymorphism-pitfalls#21
- I-SV-2A: index#22, constraint-blocks#23
- I-SV-2B: index#24, advanced-constraints#25, controlling-randomization#26, randomization-methods#27, solver-debug#28
- I-SV-3A: index#29, coverage-options#30
- I-SV-3B: index#31, closure-workflow#32, coverage-apis#33, linking-coverage#34
- I-SV-4A: index#35, immediate-vs-concurrent#36
- I-SV-4B: index#37, local-variables#38, multi-clocking#39
- I-SV-5: index#41, events#42, mailboxes#43, semaphores#44
- I-UVM-3B: index#56, coordinated-attack-lab#57, interrupt-handling#58, layered-sequences#59, sequence-arbitration#60, sequence-libraries#61, sequencer-driver-handshake#62, uvm-virtual-sequencer#63, virtual-sequences#64
- A-UVM-4B: index#69, built-in-ral-sequences#70, explicit-vs-implicit#71, frontdoor-vs-backdoor#72
- E-DBG-1: index#93, effective-debug#94, hang-lab#95
- E-SOC-1: index#103, pss#104

The other 55 modules are single `index.mdx` files. The full linear order is in `scratchpad/audit/linear.json`, and per-file prev/next is in `inventory.json`.

### 2.2 Labs

Command: `node scratchpad/audit/labs.js` → `{"labs":29,"avail":21,"cs":8,"steps":63,"pol":{"self_attested":61,"graded":2}}`

| Lab | Status | Owner | Steps / policy | labPrereq | modulePrereq | Linked from MDX |
|---|---|---|---|---|---|---|
| ahb-axi-bridge-debug | available | B-AMBA-F1 | 3 SA | – | **ahb-checker-lab, axi-scoreboard-lab (lab IDs in module field)** | B-AMBA-F1 |
| ahb-checker-lab | available | B-AHB-3 | 3 SA | – | B-AHB-1, B-AHB-2 | B-AHB-3 |
| arbiter-1 | coming_soon | I-UVM-2A | 0 | simple-dut-1 | – | none |
| assertions-1 | coming_soon | I-SV-4A | 0 | – | – | none |
| axi-deadlock-hunt-lab | available | B-AXI-5 | 3 SA | – | **axi-scoreboard-lab (lab ID)** | B-AXI-5 |
| axi-scoreboard-lab | available | B-AXI-6 | 3 SA | – | B-AXI-1, B-AXI-3 | B-AXI-6 |
| basics-1 | available | F2D | 2 **graded** (`sv-basics-v1` token check) | – | – | F2D index |
| common-1 | coming_soon | F2C | 0 | basics-1 | – | none |
| config-debug | available | I-UVM-2C | 3 SA | **simple-dut-1 (coming_soon)** | – | I-UVM-2C |
| constructs-1 | coming_soon | F2B | 0 | – | – | none |
| coverage-advanced-1 | available | I-SV-3B | 3 SA | – | – | I-SV-3B/closure-workflow |
| dma-1 | coming_soon | I-UVM-3B | 0 | arbiter-1 | – | none |
| fifo-1 | coming_soon | I-SV-1 | 0 | common-1 | – | none |
| formal-harness | available | E-INT-1 | 3 SA | – | – | E-INT-1 |
| ipc-deadlock | available | I-SV-5 | 3 SA | – | **systemverilog-basics (nonexistent)** | I-SV-5 |
| methodology-custom-phase | available | E-CUST-1 | 3 SA | **simple-dut-1** | – | E-CUST-1 |
| power-aware-retention | available | E-PWR-1 | 2 SA | – | – | E-PWR-1 |
| pss-portable-intent | available | E-PSS-1 | 3 SA | – | **A-UVM-1 (nonexistent)**, E-PSS-1 | E-PSS-1 |
| ral-mirror-bug | available | A-UVM-4B | 3 SA | **simple-dut-1** | – | A-UVM-4B |
| randomization-advanced-1 | available | I-SV-2B | 3 SA | – | – | I-SV-2B/solver-debug |
| scoreboard-reference-model | available | A-UVM-6 | 3 SA | scoreboard-decoupling | – | A-UVM-6 |
| scoreboard-decoupling | available | I-UVM-2B | 3 SA | **simple-dut-1** | – | I-UVM-2B |
| simple-dut-1 | coming_soon | **F4 (nonexistent module)** | 0 | – | – | none |
| soc-vip-reuse | available | E-SOC-1 | 3 SA | **simple-dut-1** | – | E-SOC-1 |
| soc-strategy-capstone | available | E-SOC-1 | 4 SA | soc-vip-reuse, uvm-mini-capstone | – | E-SOC-1 |
| callbacks-driver-behavior | available | A-UVM-5 | 3 SA | **simple-dut-1** | – | A-UVM-5 |
| uvm-mini-capstone | available | A-UVM-6 | 4 SA | scoreboard-reference-model, scoreboard-decoupling | – | I-UVM-1B, I-UVM-2A, I-UVM-2B, I-UVM-3A, A-UVM-6 |
| debug-waveform-trigger | available | E-DBG-1 | 3 SA | config-debug | – | E-DBG-1 |
| uvm-performance-1 | coming_soon | E-PERF-1 | 0 | – | – | none |

- Prerequisite enforcement: `grep -rn -e labPrerequisites -e modulePrerequisites src scripts` matches only the Zod schemas (`src/lib/lab-manifest.ts:38-39`, `scripts/generate-lab-registry.mjs:35-36`) and an existence check for lab IDs (`generate-lab-registry.mjs:101-103`). `modulePrerequisites` and `owningModule` are never validated against real module IDs. Neither prerequisite list is enforced or shown to learners.
- Coverage: **47 of 69 modules link no lab.** Only F2D in T1 has one, and it is `basics-1`. 50 modules own no available lab.
- Self-attested completion: `LabClientPage.tsx:328-331` shows a "Mark step complete & continue" button. Completion requires only that the previous step is complete (`:274`). After completion the solution files are revealed (prior audit, `src/server/labs.ts`). Simulation output is never used as evidence.

### 2.3 Flashcards

Command: `NODE_PATH=$PWD/node_modules node scratchpad/audit/fc.js scratchpad/audit/fc.json`

- 64 JSON files, 412 cards. Shapes: 44 use `{id,question,answer}`, 19 use `{front,back}`, 1 uses `{front,back,id}`. All are handled by `FlashcardWidget.tsx:37-41`.
- Registry: `src/lib/flashcard-decks.ts` has **53 keys** covering 363 cards. One alias: key `A-UVM-5_Callbacks` → file `A-UVM-5_UVM_Callbacks.json`. Every other key equals its file basename.
- **11 files not registered** (69 cards): F2C_Procedural_Constructs, F2D_IPC, F2D_System_Tasks, F2D_Tasks_Functions, F3A_Simulation_Semantics, F3C_Delta_Cycles, F4A_Modules_and_Packages, F4B_Interfaces_and_Modports, I-UVM-4_Policy_Classes, I-UVM-5_Container_Classes, I-UVM-6_UVM_Recording_Classes.
- **16 registered keys never referenced by any lesson** (legacy decks): F2C_Operators, F3A_Procedural_Blocks_and_Flow_Control, F4_RTL_and_Testbench_Constructs, F2_HDL_Primer, I-SV-2_Constrained_Randomization, I-SV-3_Functional_Coverage, I-SV-4_Assertions_SVA, I-UVM-1_UVM_Intro, I-UVM-2_Building_TB, I-UVM-3_Sequences, I-UVM-4_Factory_and_Overrides, I-UVM-5_Phasing_and_Synchronization, A-UVM-1_Advanced_Sequencing, A-UVM-2_The_UVM_Factory, A-UVM-3_Advanced_UVM_Techniques, A-UVM-4_RAL.
- References: 70 frontmatter refs (69 `flashcards:`, 1 `flashcardId:`). There are no `<FlashcardWidget>` or `deckId=` tags in MDX bodies (`grep -rn -i 'flashcard\|deckId' content/curriculum --include='*.mdx'` finds only prose mentions). **32 refs are unregistered:**

| File | id | Status |
|---|---|---|
| T1/F2C/index.mdx, T1/F2C/flow-control.mdx | F2C_Procedural_Constructs | JSON exists, not imported |
| T1/F2D/index.mdx | F2D_System_Tasks | JSON exists, not imported |
| T1/F2D/ipc.mdx | F2D_IPC | JSON exists, not imported |
| T1/F2D/tasks-functions.mdx | F2D_Tasks_Functions | JSON exists, not imported |
| T1/F3A/index.mdx | F3A_Simulation_Semantics | JSON exists, not imported |
| T1/F3C/index.mdx | F3C_Delta_Cycles | JSON exists, not imported |
| T1/F4A/index.mdx | F4A_Modules_and_Packages | JSON exists, not imported |
| T1/F4B/index.mdx | F4B_Interfaces_and_Modports | JSON exists, not imported |
| T2/I-SV-2A/index.mdx | I-SV-2A_Constrained_Randomization_Fundamentals | no JSON |
| T2/I-SV-2B/index.mdx | I-SV-2B_Advanced_Constrained_Randomization | no JSON |
| T2/I-SV-3A/index.mdx | I-SV-3A_Functional_Coverage_Fundamentals | no JSON |
| T2/I-SV-3B/index.mdx | I-SV-3B_Advanced_Functional_Coverage | no JSON |
| T2/I-SV-4A/index.mdx | I-SV-4A_Assertions_SVA_Fundamentals | no JSON |
| T2/I-SV-4B/index.mdx | I-SV-4B_Advanced_SVA | no JSON |
| T2/I-SV-4C/index.mdx | I-SV-4C_Checkers_and_Bind | no JSON |
| T2/I-SV-5/index.mdx | I-SV-5_Synchronization_and_IPC | no JSON |
| T2/I-SV-6/index.mdx | I-SV-6_Compiler_Directives_and_Generates | no JSON |
| T2/I-SV-7/index.mdx | I-SV-7_DPI_and_Foreign_Language_Interfaces | no JSON |
| T2/I-UVM-1A/index.mdx | I-UVM-1A_Components | no JSON |
| T2/I-UVM-1B/index.mdx | I-UVM-1B_The_UVM_Factory | no JSON |
| T2/I-UVM-1C/index.mdx | I-UVM-1C_UVM_Phasing | no JSON |
| T2/I-UVM-2A/index.mdx | I-UVM-2A_Component_Roles | no JSON |
| T2/I-UVM-2B/index.mdx | I-UVM-2B_TLM_Connections | no JSON |
| T2/I-UVM-2C/index.mdx | I-UVM-2C_Configuration_and_Resources | no JSON |
| T2/I-UVM-3A/index.mdx | I-UVM-3A_Fundamentals | no JSON |
| T2/I-UVM-3B/index.mdx | I-UVM-3B_Advanced_Sequencing | no JSON |
| T2/I-UVM-4/index.mdx | I-UVM-4_Policy_Classes | JSON exists, not imported |
| T2/I-UVM-5/index.mdx | I-UVM-5_Container_Classes | JSON exists, not imported |
| T2/I-UVM-6/index.mdx | I-UVM-6_UVM_Recording_Classes (`flashcardId`) | JSON exists, not imported |
| T3/A-UVM-4A/index.mdx | A-UVM-4A_RAL_Fundamentals | no JSON |
| T3/A-UVM-4B/index.mdx | A-UVM-4B_Advanced_RAL | no JSON |

- Totals: 11 refs point to an existing JSON file that was never imported, and 21 refs have no JSON at all. 35 MDX files (mostly sub-lessons, plus I-SV-8 and I-SV-9) have no flashcard ref. **Per tier, modules with working flashcards:** T1 7/13, **T2 1/24 (only I-SV-1)**, T3 18/20, T4 12/12. Overall, 31 of 69 modules have no working deck.
- What the learner sees for an unregistered id: `curriculum/[...slug]/page.tsx:106-115` still renders the "Reinforce the essentials" section, because it is gated only on the frontmatter id existing. Inside it, `FlashcardWidget.tsx:35` gets `undefined` from the registry, `loadedCards` stays `[]`, and `:62-66` permanently shows **"No flashcards available or component loading..."**. A missing deck is indistinguishable from one that is still loading. No error is logged, and no test covers T1/T2/A-UVM-4 registration: `tests/amba-flashcards.spec.ts` and `tests/expert-flashcards.spec.ts` cover only B-* and E-*.
- Flashcard review is not persisted. `onProgressUpdate` is never passed (`page.tsx:113`), and there is no "I knew it / I didn't" input. The deck is flip-through only, with no active recall scoring.

### 2.4 Interview banks

```
for f in content/interview-questions/*.json; do node -e "…keys, count, levels…"; done
amba-protocols 13 (mid3 senior3 staff6 senior-staff1) | debug 6 | soc-system-design 7 | sva-formal 6 | systemverilog 17 (junior5 mid8 senior2 staff1 ss1) | uvm 10  → 59
shape: {id,title,description,topic,questions:[{id,topic,level,category,prompt,rubric,model_answer,sources}]}
```

- `tests/interview-questions/bank-schema.test.ts` **matches** the files and `src/types/interview-question.ts`. It enforces the field set (`:81-90`), levels and categories (`:8-17`), ≥3 questions per bank, ≥30 overall, and global ID uniqueness. It checks shape and counts only, not correctness.
- The spec's proposed shape (`foundational-upgrade-spec.md:90-104`, fields `module, topic, difficulty, question, answer_type, key_points`) is incompatible. It has no `prompt`, `level`, `category`, `rubric`, `model_answer` or `sources`, and it targets a file that does not exist. A bare-array file would fail `bank.questions` at `:66`.
- **UI surfacing: none.** `grep -rn "interview-questions" src scripts` returns nothing. Only `tests/interview-questions/bank-schema.test.ts:6` and `tests/amba-flashcards.spec.ts:58` read the banks. No route or component loads them. `InterviewQuestionPlayground` is unrelated: it takes inline props and is broken in MDX (PLAT-02).
- Inline MDX interview items per module (`<details>` inside an H2 containing "Interview", plus bold Q/pitfall items in such sections):
  - T1 `<details>` "Ready for the Interview?" cards: F1A 5, F1B 5, F1C 3, F2A 5, F2B 4, F2C 6 (index+flow-control), F2D 7 (3 files), F3A 2, F3B 2, F3C 2, F4A 2, F4B 2, F4C 3. Total **48**. Five modules have fewer than the spec's 3 per module (F3A, F3B, F3C, F4A, F4B).
  - T2 markdown "Interview Pitfalls": 2 each in I-UVM-1A, 1B, 1C, 2B, 2C, 3A (12).
  - T3: B-AHB-3 "Interview Questions & Answers" has 4. B-AMBA-F3 is an interview clinic built with an H1 and other structure, so it is not counted.
  - T4: 0.
  - 20 of 69 modules contain any inline interview item. Every item is a static reveal: there is no attempt-first prompt, rubric or self-grading.

### 2.5 Quizzes and other assessment widgets

Command: `node scratchpad/audit/mdxscan.mjs` parses every MDX file with `mdast-util-from-markdown` + `micromark-extension-mdxjs` and evaluates the `questions={…}` expressions.

- **65 `<Quiz>` components with 152 questions.** 52 use the `questions` prop and 13 use `<QuizQuestion>` children. Per tier: T1 20 questions in 8 modules, T2 56 in 19, T3 56 in 17, T4 20 in 6. Modules with no `<Quiz>`: F1A, F1B, F1C, F2A, F2B, I-SV-4C, I-SV-6, I-SV-7, I-SV-8, I-UVM-6, A-UVM-4A, A-UVM-4B, A-UVM-5, E-CUST-1, E-DBG-1, E-INT-1, E-PERF-1, E-PWR-1, E-SOC-1. F1A and F2A instead have `FirstBugHuntGame` and `CurriculumDataTypeQuiz`.
- Other widgets used: `InterviewQuestionPlayground` ×21, `CurriculumDataTypeQuiz` ×1, `FirstBugHuntGame`, `PacketSorterGame`, `EventRegionGame`, `MailboxSemaphoreGame` ×2.
- **Answer-key defect (PLAT-01).** `node scratchpad/audit/quizidx.mjs` → `wrong 32 coincident 2`. Evidence with file:line:
  - `T3_Advanced/A-UVM-6…/index.mdx:316,327,338,349` (`correctAnswer: 1` ×4)
  - `T3_Advanced/A-UVM-7…/index.mdx:279,290,301`
  - `T3_Advanced/A-UVM-8…/index.mdx:337,348,370` (`:359` is index 0, coincidentally correct)
  - `T3_Advanced/B-AMBA-1…/index.mdx:92,114` (`correctIndex`; `:103` is index 0)
  - `T4_Expert/E-AI-1…/index.mdx:209,220,231`
  - `E-EMU-1…:272,283,294`
  - `E-PSS-1…:307,318,329,340`
  - `E-PYUVM-1…:269,280,291`
  - `E-RISCV-1…:301,312,323,334`
  - `E-UVM-ML-1…:208,219,230`

  Mechanism: `mdx-component-registry.tsx:72-73` passes the `questions` prop straight to `ui/Quiz.tsx`. There, `:40-53` takes `correctAnswer` only if `typeof === 'string'`, otherwise uses `options[0]`. Example rendered as correct: A-UVM-6 Q1 marks "uvm_analysis_imp" correct instead of "uvm_tlm_analysis_fifo". B-AMBA-1 Q1 marks "AHB" correct for "five independent channels". Probe output:
  ```
  QUIZ verdict after choosing intended answer uvm_tlm_analysis_fifo: Incorrect.
  QUIZ verdict after choosing distractor uvm_analysis_imp: Correct!
  ```
  `tests/amba-curriculum-content.spec.ts:47-52` only counts `question:` occurrences, so it cannot catch this.
- **Diagnostic quality (PLAT-06).** `ui/Quiz.tsx`:
  - `:111-116` grades on click with no confirm step.
  - `:154-163` shows "Correct!/Incorrect." plus the same `explanation` for every option, never naming or highlighting the correct option.
  - `:129-134` shows "Quiz Complete!" with no score or review, and there is no retry.
  - The component has no storage or fetch calls.

  `InterviewQuestionPlayground` supports per-option explanations, but every MDX use is broken. `PlacementQuiz` gives a per-question `rationale`, not per option, and POSTs to `/api/me/assessments` only if signed in, failing silently otherwise (`PlacementQuiz.tsx:48-57`).
- **Results recorded:** only the placement quiz (when authenticated) and the gated adaptive test (`/api/me/assessments` → `assessmentAttempt.create`). Lesson quizzes, playgrounds, games and flashcards record nothing, not even in localStorage.
- **PLAT-02 mechanism.** `InterviewQuestionPlayground.tsx:7-12` declares props `{id,label,isCorrect,explanation}`. All 21 MDX uses pass `{text,isCorrect,feedback}`; `node scratchpad/audit/pg.mjs` → `{ 'feedback,isCorrect,text': 21 }`. The lazy loader does no adaptation (`LazyMdxInteractive.tsx:81`). Consequences:
  - `option.label` is undefined, so the buttons are blank.
  - `option.id` is undefined, so a click sets `selectedId` to `undefined` and every option looks selected (`undefined === undefined`).
  - `!selectedId` keeps Submit disabled (`:145`), and `explanation` is never shown.

  Probe output:
  ```
  PLAYGROUND option button texts: ["","","","","Submit Answer"]
  PLAYGROUND submit disabled after clicking an option: true
  PLAYGROUND feedback text visible (fbC): false
  ```
  Affected (file:line): `I-SV-1/constructors.mdx:110`, `copying-and-cloning.mdx:96`, `index.mdx:173`, `parameterized-classes.mdx:92`, `polymorphism-pitfalls.mdx:86`; `I-SV-2A/constraint-blocks.mdx:73`, `index.mdx:161`; `I-SV-2B/controlling-randomization.mdx:67`, `randomization-methods.mdx:97`, `solver-debug.mdx:102`; `I-SV-3A/coverage-options.mdx:92`, `index.mdx:160`; `I-SV-3B/coverage-apis.mdx:87`, `linking-coverage.mdx:88`; `I-SV-4A/immediate-vs-concurrent.mdx:106`, `index.mdx:99`; `I-SV-4B/local-variables.mdx:61`, `multi-clocking.mdx:71`; `I-SV-5/events.mdx:90`, `mailboxes.mdx:92`, `semaphores.mdx:76`. The four visualizers that import the playground internally (`FactoryOverrideVisualizer`, `TemporalLogicExplorer`, `UVMTreeExplorer`, `ConstraintSolverVisualizer`) were not probed. No test renders the playground: `grep -rn InterviewQuestionPlayground tests` is empty.

### 2.6 Prerequisites and ordering

- Frontmatter: no `prerequisites` field exists, and the schema is `.strict()` (`lesson-frontmatter.ts:10-20`), so one cannot be added without a schema change. Key frequency over the 105 files: title 75, description 75, flashcards 69, order 16, sources 10, tier 3, conceptLinking 1, flashcardId 1. The 30 sub-lessons use `export const metadata`, which the MDX renderer strips.
- **Ordering source.** `scripts/generate-curriculum-data.ts:115,123,128` uses plain `.sort()` on directory and file names. `grep -n order scripts/generate-curriculum-data.ts` finds nothing, so **`order:` is ignored**. `findPrevNextTopics` walks that list (`curriculum-data.tsx:1081-1101`). Every lesson has prev/next except #1 (F1A, no prev) and #105 (E-UVM-ML-1, no next); tier boundaries chain T1→T2→T3→T4.
- **Broken or suspicious ordering (generated nav):**
  1. **AMBA block** (#77–#90): authored `order` AMBA-1=1, AMBA-2=2, AHB-1..3=3–5, AXI-1..6=6–11, F1=12, F2=13, F3=14. Actual nav: AHB-1, AHB-2, AHB-3, AMBA-1, AMBA-2, **AMBA-F1 (AHB↔AXI bridges), F2 (ACE/CHI), F3 (Interview & Debug Clinic)**, then AXI-1..6. Bridges and coherency are taught before AXI channels, and the protocol-family overview comes after AHB verification.
  2. **I-UVM-3B sub-lessons** (#57–#64) run alphabetically: coordinated-attack-lab (a capstone-style lab) first, sequencer-driver-handshake at #62 after layering, arbitration and libraries, and uvm-virtual-sequencer (#63) after the layered-sequence material. Meanwhile `get_next_item` is already used in code at #53 (I-UVM-2B `:39`).
  3. **I-SV-2B**: randomization-methods (pre/post_randomize, #27) comes after controlling-randomization (#26).
  4. **T4**: E-AI-1 is first (#91) but declares `**Prerequisite:** E-PYUVM-1` (#101) (`E-AI-1/index.mdx:243`). E-PYUVM-1 says `**Next:** E-AI-1` (`:303`), which points backwards.
  5. **A-UVM-5** says `**Next:** A-UVM-4A RAL` (`:222`), but RAL is #68, before Callbacks (#73).
  6. Authored Next links contradict the nav: I-SV-6 `:261` → I-SV-4A (backwards); I-SV-4C `:117` → I-SV-3A (backwards); I-SV-7 `:259` → E-INT-1 (T4); I-UVM-6 `:106` → E-DBG-1 (T4); E-PSS-1 `:352` → E-PYUVM-1 (nav next is E-PWR-1).
  7. **Forward use of untaught constructs** (first code-block occurrence vs teaching module):
     - UVM classes, `` `uvm_error ``, `extends uvm_component` and `report_phase` appear in **F2B (#5)** (`F2B/index.mdx:119-158`), before OOP (#17) and UVM (#49).
     - `uvm_sequence`, `type_id::create` and `start_item` appear in **I-SV-7 DPI (#46)** (`:28-34`), before Why-UVM (#48) and sequences (#55).
     - `covergroup` and `randomize` appear in F1C (#3). This is a motivational preview and acceptable if labelled.
  8. Dependency checks:
     - OOP (I-SV-1 #17) comes before UVM (#49): OK.
     - Interfaces/virtual interface (F4B #15) and clocking blocks (F4C #16) come before UVM driver material (I-UVM-2A #52): OK.
     - `uvm_config_db` is first used in I-UVM-2C (#54), its teaching module: OK.
     - SVA (#35) before coverage-driven sequences: n/a.
  9. Duplicated topic: IPC (events/mailboxes/semaphores) appears in both F2D/ipc (#9) and I-SV-5 (#41–#44). This is acknowledged in `F2D/ipc.mdx:123`.
  10. I-SV-8 Power Intent/UPF sits in T2 between DPI and Why-UVM, and its text calls E-PWR-1 "coming soon" (`I-SV-8/index.mdx:200`), but E-PWR-1 exists at #100.

### 2.7 Interactives

Command: `node scratchpad/audit/tags.js` strips fenced and inline code, extracts `<Capitalized` tags, and compares them with `lazyMdxInteractiveNames` (94 names) and the base map in `mdx-component-registry.tsx:88-110`.

- **Unregistered tags used in MDX: 0.** No MDX tag would hit MDX's "missing component" runtime error.
- **Used and registered (76 lazy names):** AhbPipelineBurstVisualizer, AmbaFamilyExplorer, Analysis3D, AnimatedUvmSequenceDriverHandshakeDiagram(3), AnimatedUvmTestbenchDiagram, ArrayMethodExplorer, AxiChannelHandshakeVisualizer, AxiDeadlockSimulator, AxiIdOrderingVisualizer, AxiMemoryMathVisualizer, BindDirectiveVisualizer, BridgeTranslationExplorer, ConfigDbExplorer, Constraint3D, ConstraintSolverExplorer, ConstraintSolverHeatmapVisualizer, ConstraintSolverVisualizer, CoverageCrossExplorerVisualizer, CurriculumDataTypeExplorer, CurriculumDataTypeQuiz, DPIBoundaryInspector, Dataflow3D, DebuggingSimulator, DesignGapChart, DynamicStructureVisualizer, EnumMethodVisualizer, EventRegionGame, EventSchedulerVisualizer, ExclusiveAccessVisualizer, FactoryOverrideExplorerVisualizer, FactoryOverrideVisualizer, FirstBugHuntGame, FormalVsSimulationVisualizer, GenerateElaborationVisualizer, HallOfShameCarousel, InteractiveCode(55), InteractiveCostOfBugGraph, InteractiveUvmArchitectureDiagram, **InterviewQuestionPlayground(21, broken)**, LogicStateDiagram, Mailbox3D, MailboxSemaphoreGame(2), MethodologyPhaseVisualizer, ModportExplorer, PackedUnpackedPlayground, PacketSorterGame, PhaseTimeline3D, PowerDomainVisualizer, ProceduralBlocksSimulator, ProtocolAnalogyExplorer, ProtocolWaveform(7), PssIntentMapVisualizer, QueueOperationLab, RALPredictorVisualizer, RalRegisterMapVisualizer, SVSchedulerRegionVisualizer, SignednessVisualizer, StringMethodExplorer, SvaSequenceWaveformVisualizer, SystemVerilog3DVisualizer, TLMPortConnector, TelemetryEventBusVisualizer, TemporalLogicExplorer, TlmConnectionBuilderVisualizer, TransactionRecordingVisualizer, UVMTreeExplorer, UvmContainerVisualizer, UvmPhaseTimelineVisualizer, UvmPhasingDiagram, UvmPolicyVisualizer, UvmSequenceHierarchyVisualizer, UvmVirtualSequencerDiagram, VIPReuseVisualizer, VerificationMethodologiesDiagram, VerilogVsSystemVerilog, VirtualSequencerExplorer.
- **Base components used:** Alert, Card×27 (+Content/Header/Title), Image 8, InfoPage 30, InteractiveWrapper 8, LabLink 22, Link 1, QuickTake 14, Quiz 65, QuizQuestion 42.
- **Registered but never used in MDX (18):** DataTypeComparisonChart, UvmHierarchySunburstChart, UvmTestbenchVisualizer, UvmComponentRelationshipVisualizer, UvmPhasingInteractiveTimeline, UvmFactoryWorkflowVisualizer, SystemVerilogDataTypesAnimation, CoverageAnalyzer, RandomizationExplorer, InterfaceSignalFlow, AssertionBuilder, DataTypeExplorer, BlockingSimulator, OperatorDrill, OperatorVisualizer, Coverage3D, CovergroupBuilder, RALHierarchy. Some are used by `/practice/visualizations/*` pages directly.
- **Modules with no registered interactive (16):** F3A, F3C, I-SV-8, A-UVM-5, A-UVM-6, A-UVM-7, A-UVM-8, B-AHB-3, B-AMBA-F2, B-AMBA-F3, B-AXI-6, E-AI-1, E-EMU-1, E-PYUVM-1, E-RISCV-1, E-UVM-ML-1. F3A (simulation semantics) and F3C (delta cycles and races) are core scheduler topics that have no model a learner can manipulate.

---

## 3. Section B — Progress and persistence

| Producer | Storage | Evidence |
|---|---|---|
| Lesson visit (`LessonVisitTracker`, every lesson) | localStorage `curriculumProgress` | `LessonVisitTracker.tsx:12-16` → `useCurriculumProgress.ts:100-102,43` |
| Lesson completion | **none**: `completeLesson` has no production caller (`grep -rn completeLesson src tests` → only the hook definition and unit tests) | `useCurriculumProgress.ts:104-106`. Consequences: `getModuleProgress` (`:50-58`) is always 0, the curriculum page's "in-progress/completed" filters (`curriculum/page.tsx:52-57`) never match, and the active tier auto-open always picks T1. |
| Exercises (4 routes) | localStorage only | `useExerciseProgress.ts:25,42,51,64` |
| Lesson quizzes, playgrounds, games, flashcards | nothing | `ui/Quiz.tsx`, `FlashcardWidget.tsx:51` comment "Potential: Load last viewed index…" |
| Placement quiz | Prisma `AssessmentAttempt` (signed in only; silent failure otherwise) | `PlacementQuiz.tsx:48-57`, `api/me/assessments/route.ts` |
| Labs | Prisma `LabAttempt` | `src/server/labs.ts` (`labAttempt.create/update`) |
| AI requests | Prisma `Activity(AI_REQUEST)` | `src/server/ai/rate-limit.ts:37` |
| Goals, preferences, reviews, SRS cards, simulation jobs | Prisma | `api/me/goals`, `api/me/preferences`, `server/reviews.ts`, `actions/srs.ts`, `server/simulation/index.ts` |

- Full list of Prisma write call sites (`grep -rnoE "(prisma|tx)\.[a-zA-Z]+\.(create|upsert|update…)" src` plus model-name grep): user.upsert, user.update, goal.create, flashcard.create/update, review.create, simulationJob.create/update/updateMany, activity.create (AI_REQUEST only), assessmentAttempt.create, labAttempt.create/update. **There is no `lessonProgress` writer and no `LESSON_VIEWED`/`LESSON_COMPLETED`/`CHALLENGE_ATTEMPTED` activity writer.**
- Readers: `engagement.ts:193-200` reads `activity.findMany` with `type: { not: "AI_REQUEST" }` and `lessonProgress.count`, so for every real user the result is **0 lessons and no activity**. `/api/me/engagement` and `/api/me/notifications` (derived from engagement) are consumed by `settings/SettingsPageClient.tsx` and `notifications/page.tsx`, both `accountUI`-gated. `/dashboard` is `tracking`-gated and uses hard-coded constants instead of engagement.
- Legacy Firestore files are listed in §1. `src/components/templates/TopicPage.tsx`, which writes Firestore, has **no importer**: `grep -rn "templates/TopicPage\|from.*TopicPage" src` is empty, and the other mentions are a comment and the name `CurriculumTopicPage`. It is dead code, so the only live Firestore path is the community feature, which is 404 by default.

---

## 4. Section C — Feature flags, routes and sample data

`src/tools/featureFlags.ts:1-7`: `community, tracking, personalization, fakeComments, accountUI` all default `false`. Overrides come from `NEXT_PUBLIC_FEATURE_FLAG_*`, and `FEATURE_FLAGS_FORCE_ON=true` forces every flag on.

### 4.1 Routes (43 `page.tsx`) with default flags, anonymous learner

| Route | Default behavior | Evidence |
|---|---|---|
| `/` | Renders Hero, LearningPaths, InteractiveFeatures | `(public)/page.tsx` |
| `/privacy-policy`, `/terms-of-service` | Render | – |
| `/curriculum` | Renders; progress always 0% (PLAT-03) | `curriculum/page.tsx` |
| `/curriculum/[...slug]` (105 lessons) | Renders; 404 for unknown slug | `[...slug]/page.tsx:36` |
| `/practice` | Renders hub; lab status from registry; curated "completed" labels for 15 tools | `PracticeHub.tsx:10-129,172` |
| `/practice/lab/[labId]` | 404 if not `available`; **sign-in redirect** if anonymous | `[labId]/page.tsx:29,48` |
| **`/practice/lab`** | **404 (no index page)**, yet linked from the homepage "Live Code Editor" card | `ls practice/lab` → `[labId]`, `mock-lab`; `InteractiveFeaturesSection.tsx:14` |
| `/practice/lab/mock-lab` | Renders an ungated **fake runner** ("Test 'test_initial_state' passed.") with an empty editor div; not linked anywhere | `mock-lab/page.tsx:9-13` |
| `/practice/visualizations/*` (12), `/practice/waveform-studio`, `/visualizations/systemverilog-3d` | Render | – |
| `/exercises` + 4 exercises | Render; localStorage progress | – |
| `/quiz/placement` | Renders, **ungated**; client grading; POST silently 401s if anonymous; copy promises dashboard and assessment features that are off (§6) | `quiz/placement/page.tsx:22-26,65-69` |
| `/knowledge-hub` | Renders, ungated; 15 hard-coded placeholder nodes | `knowledge-graph-engine.ts:40` |
| `/learning-strategies` | Renders, ungated; **body is `[Placeholder: …]` text** | `learning-strategies/page.tsx:21-60` |
| `/history` | Renders, ungated; **body is `[Placeholder: …]` text**; chart hidden (tracking off) | `history/page.tsx:21-23,75-99` |
| `/resources` | Renders "Links and categorized resources will be listed here soon." | `resources/page.tsx:18` |
| `/assessment` | Disabled notice | `assessment/page.tsx:5-16` |
| `/projects` | Holding message | `projects/page.tsx:5-13` |
| `/notifications` | Placeholder copy | `notifications/page.tsx:86-88` |
| `/settings` | 404 | `settings/page.tsx:15-16` |
| `/dashboard`, `/dashboard/coverage` | 404 (tracking) | `dashboard/page.tsx:5-6`, `coverage/page.tsx:5-6` |
| `/dashboard/memory-hub`, `/dashboard/notebook` | 404 (personalization) | – |
| `/community`, `/community/post/[id]`, `/community/test-page` | 404 | – |

The navbar correctly hides Dashboard and Community when flags are off (`Navbar.tsx:29-30`). `/history`, `/learning-strategies`, `/resources`, `/knowledge-hub` and `/practice/lab/mock-lab` are not in the nav but are routable and statically generated.

### 4.2 Mock, sample and random data reachability

| Component | Data | Reachable by default? |
|---|---|---|
| `DashboardPageClient` | `overallProgress = 65`, fixed modules, activities, badges, "Top 10%" | No (`tracking`) |
| `ComprehensiveAssessmentSystem` → `ProjectBasedEvaluator` (random scores), `CompetencyCertification`, `SkillMatrixVisualizer`, `ProgressAnalytics` (mocks) | random/fixed | No (`tracking`) |
| `projects/page.tsx` placeholder body | `[Placeholder…]` | No (`personalization`) |
| `NotebookPageClient` sample entries | fixed | No (`personalization`) |
| `gamification/*` (Achievement, ChallengeQuest, Leaderboard, RewardRecognition, SocialLearningNetwork), `multimedia/ImmersiveLabEnvironment` | mock collections | **Never**: no importer anywhere (`grep` for imports returns none) |
| `learning-strategies`, `history`, `resources`, `mock-lab` | placeholders / fake test output | **Yes** (by URL) |
| `knowledge-graph-engine` placeholder graph → `remarkConceptLinks` on every lesson + `/knowledge-hub` | 15 hard-coded nodes; e.g. "UVM Phasing" tier "Advanced" although it is taught in T2 | **Yes** |
| `Math.random` in learner-reachable interactives: `CoverageCrossExplorerVisualizer:49-50`, `CovergroupBuilder:32`, `TransactionRecordingVisualizer:39,61-63`, `MailboxSemaphoreGame:54`, `ArrayMethodExplorer:46` (`sort(()=>Math.random()-0.5)` "shuffle"), `DPIBoundaryInspector:22` (a non-pure function randomly flags a "hazard" 30% of the time), `SequencerArbitrationSandbox:228`, `UvmPhaseSorterExercise:64`, `RandomizationExplorer:250` (rejection sampling, not a solver), `StateMachineDesigner:193`, `Coverage3D:51`, `SystemVerilogDataTypesAnimation` | demo stimulus | Yes. Mostly legitimate stimulus. `DPIBoundaryInspector` teaches that non-pure DPI calls fail randomly, which is a questionable mental model (Unverified concern, Medium confidence). |

---

## 5. Section D — Optional, skipped and forced tests

- The 5 default-skipped Vitest checks:
  1. `tests/qa/curriculumCoverageAudit.spec.ts:343` link audit, `QA_STRICT_LINK_AUDIT=1`
  2. `:348` anchor audit, `QA_STRICT_ANCHOR_AUDIT=1`
  3. `tests/qa/iuvm3SplitMergeAudit.spec.ts:78` coordinated-attack-lab discoverable, `QA_STRICT_IUVM3_AUDIT=1`
  4. `:89` config_db not taught in I-UVM-3, `QA_STRICT_IUVM3_AUDIT=1`
  5. `tests/components/TLMPortConnector.test.tsx:74` accessible name of the connect button, `QA_STRICT_A11Y_AUDIT=1`
- With all four env flags set: 14 pass, 1 fail. The failure is the link audit with 41 entries (log: `scratchpad/audit/strict-tests.log`). Every reported entry is a matcher false positive of the kinds the prior audit described: `(learning)` route-group paths such as `/practice/lab/<id>`, `/exercises/...`, `/visualizations/systemverilog-3d`, and pretty-slug curriculum links. **The anchor audit passes.**
- E2E: `playwright.config.ts:9-20` sets every `NEXT_PUBLIC_FEATURE_FLAG_*=true` and `FEATURE_FLAGS_FORCE_ON=true` on the **web server**. The runner-side check in `tests/e2e/feature-flags.spec.ts:3-10` does not see those env vars, so the describe block runs, but `beforeAll` (`:15-21`) queries `/api/feature-flags`, finds flags on, and **every default-flag test calls `test.skip(serverFlagsForceOn …)`**. `account-preferences.spec.ts:4-7` runs only when flags are on.
- Implication: neither `npm run test:e2e` nor `test:e2e:release` (`package.json:22`; CI at `.github/workflows/*.yml:77`) ever exercises the default learner surface. That surface includes the disabled assessment notice, the placeholder pages, the 404s, and the unregistered-flashcard fallback. None of the release specs render a lesson with a `<Quiz>` from T3/T4 or an `InterviewQuestionPlayground`.

---

## 6. Section E — Documentation and site-messaging drift

Quotes are from the repo's own site copy and documents.

| Claim (file:line) | Reality with default flags |
|---|---|
| Homepage "Live Code Editor: *Write, compile, and run SystemVerilog code directly in your browser. Get instant feedback on your solutions.*" → `href: '/practice/lab'` (`InteractiveFeaturesSection.tsx:11-14`) | `/practice/lab` has no page, so the link is a **404**. Labs require sign-in. Simulation requires a configured queue or Docker (`CodeExecutionEnvironment.tsx:40-49`). Only 1 of 21 available labs gives automated feedback, and that feedback is a token-sequence check. |
| "Gamified Exercises: *Earn points, badges, and climb the leaderboard*" (`:25-28`) | `/exercises` has no points, badges or leaderboard (`grep -rniE "badge\|leaderboard\|points" src/components/exercises` is empty). The gamification components are orphaned. |
| "AI Tutor Chat: *…instant, personalized help from our AI assistant, available 24/7.*" `href: '#ai-tutor'` (`:32-35`) | No `#ai-tutor` anchor exists. The AI widget is mounted only in the `(learning)` layout, not on `/`. It requires sign-in plus `GEMINI_API_KEY` (`AIAssistantDialog.tsx:38` "Sign in to use the AI tutor."). |
| Hero: "*Pair every concept with labs, flashcards, and quizzes so the knowledge sticks*" (`HeroSection.tsx:22-23`) | 47/69 modules link no lab, 31/69 modules have no working flashcards, 19/69 have no `<Quiz>`, and 32 quiz questions grade wrongly. |
| Hero CTA "*Start with a quick skills check… Calibrate the roadmap to your baseline*" (`HeroSection.tsx:~92-96`) → `/quiz/placement` | The quiz works client-side, but nothing calibrates the roadmap: no recommendations persist for anonymous users and curriculum progress ignores it. |
| Placement page "*Suggested labs and exercises aligned with your weakest scoring rubric.*" / "*Baseline telemetry that feeds the personalized dashboard and daily streak goals.*" (`quiz/placement/page.tsx:22-26`); "*head straight to the assessment center to explore practice tabs, analytics, and project-style evaluations*" (`:65-69`) | The dashboard returns 404 and the assessment center shows "currently disabled" by default. Telemetry is recorded only for signed-in users. |
| LearningPaths "Mastering UVM… skills: 'Register Layer (RAL)'… slug I-UVM-3B" (`LearningPathsSection.tsx:33-39`) | The card links into T2 sequencing. RAL is in T3. |
| PROJECT_GUIDE §1 "*Every learner finishes each tier with runnable labs, self-assessment artifacts*" (`:8`) | T1 has one available lab. Self-assessment results are never stored for lessons. |
| PROJECT_GUIDE §7 "*User documents are keyed by Firebase Auth UID…*" (`:94-97`); changelog "*Homepage personalization sourced from `/api/engagement/:userId`*" (`:117`) | Identity is NextAuth plus Prisma. The route is `/api/me/engagement`. The homepage has no personalization section (`PersonalizationSection.tsx` exists but `(public)/page.tsx` does not import it). |
| PROJECT_GUIDE §8 lists `tests/e2e/exercise-feedback.spec.ts` as a focused suite (`:102`) | The file exists, but the release command does not include it (`package.json:22`). |
| README "*`.env.example` documents all supported variables*" (README `:45`) | It omits `DATABASE_URL` (prior audit; not re-checked here). |
| `I-SV-8/index.mdx:200` "*the specialized expert power module (E-PWR-1, coming soon)*" | E-PWR-1 exists (#100) with an available lab. |

---

## 7. Section F — TODO, FIXME, placeholder and "coming soon" in learner-facing surfaces

Commands: `grep -rn -iE "TODO|FIXME|coming soon|\[placeholder|lorem|TBD|under construction" content/curriculum --include='*.mdx'` and the same pattern over `src`.

- Curriculum MDX: one hit, `I-SV-8/index.mdx:200` ("E-PWR-1, coming soon"), which is stale. No TODO or FIXME.
- Learner-reachable components and pages:
  - `learning-strategies/page.tsx:21-60`: 12 `[Placeholder: …]` paragraphs.
  - `history/page.tsx:75-99`: 9 placeholders.
  - `resources/page.tsx:18`: "will be listed here soon".
  - `PracticeHub.tsx:172`: "Coming Soon" badges for 8 labs. This is legitimate.
- Gated: `projects/page.tsx:21-86` has 11 placeholders behind `personalization`.
- Internal: `src/lib/challenges/index.ts:55` `// TODO: return the nth fibonacci number`. This is challenge starter text, not a defect.

---

## 8. Findings (brief format)

### PLAT-01 — Quiz answer keys silently invert for 32 questions (Confirmed defect, **S1**, High)
- **Evidence:** `src/components/ui/Quiz.tsx:40-53`; `src/generated/mdx-component-registry.tsx:72-73`; MDX lines listed in §2.5; jsdom probe output in §2.5.
- **Learner consequence:** In 10 T3/T4 lessons a learner who picks the right answer is told "Incorrect.", and one who picks the distractor is told "Correct!". Examples: "uvm_analysis_imp" accepted as the buffer between monitor and scoreboard; "AHB" accepted as the five-channel protocol; "== is not valid for class types" accepted. Each wrong verdict is followed by an explanation that contradicts it. This actively miscalibrates the "predict" and "debug misuse" outcomes.
- **Correction:**
  1. Normalize the data. Either convert every key to the string option, or support `correctIndex` / a numeric `correctAnswer` explicitly in `toFormatted`.
  2. Make `toFormatted` throw or render an authoring error when no option matches, instead of defaulting to `options[0]`.
  3. Add a content test that parses every `<Quiz>` (as `mdxscan.mjs` does) and asserts exactly one resolvable correct option per question.
- **Acceptance:** A Vitest content check iterates all 152 questions and passes. A deliberate numeric-key fixture fails the build. A component test confirms the intended option yields "Correct!" for an index-keyed question.

### PLAT-02 — `InterviewQuestionPlayground` unusable in all 21 MDX uses (Confirmed defect, S2, High)
- **Evidence:** `InterviewQuestionPlayground.tsx:7-12,74-114,142-153`; MDX shape `{text,isCorrect,feedback}` (§2.5); `LazyMdxInteractive.tsx:81` has no adapter; probe output in §2.5.
- **Learner consequence:** The only option-specific, misconception-targeted feedback in T2 SV (OOP, randomization, coverage, SVA, IPC) cannot be used. The learner sees 4 blank buttons and a disabled Submit button.
- **Correction:** Pick one prop contract. Either accept `text→label`, `feedback→explanation` and a generated `id` in the component or a lazy-loader adapter, or rewrite the 21 MDX blocks. Make the props type-checked at render time, for example with a Zod parse that renders an authoring error on mismatch.
- **Acceptance:** A component test renders each of the 21 MDX option arrays: labels are visible, Submit enables after selection, and the selected option's feedback appears. An e2e test on `/curriculum/T2_Intermediate/I-SV-1_OOP/constructors` clicks through one playground.

### PLAT-03 — No lesson completion signal anywhere (Confirmed defect, S2, High)
- **Evidence:** `useCurriculumProgress.ts:104-106` has no caller; `curriculum/page.tsx:52-57`; `engagement.ts:193-200`; the Prisma write list in §3.
- **Learner consequence:** Progress always reads 0%, "Continue learning" never appears, the completed and in-progress filters are inert, and engagement metrics stay empty. Learners cannot see what they have mastered, and the platform cannot gate or recommend based on evidence.
- **Correction:** Define a completion contract, for example: quiz passed with a valid key, the playground attempted, or an explicit "I can explain/apply this" check. Write it through one service that updates localStorage for anonymous users and `LessonProgress` plus an `Activity(LESSON_COMPLETED)` row for signed-in users.
- **Acceptance:** E2E: complete a lesson, then `/curriculum` shows more than 0% for that module. Signed in: `/api/me/engagement` returns `lessonsCompleted` ≥ 1. A unit test covers the writer.

### PLAT-04 — Navigation order alphabetical; authored order and prerequisites contradicted (Interaction/design weakness, S2, High)
- **Evidence:** `generate-curriculum-data.ts:115,123,128`; the AMBA `order:` values; the I-UVM-3B sequence; E-AI-1 and E-PYUVM-1 prerequisite text; forward-reference lines (§2.6).
- **Learner consequence:** "Next lesson" leads learners into AHB↔AXI bridges and ACE/CHI before AXI basics, into a sequencing "attack lab" before the sequencer-driver handshake, and into AI-driven verification before its declared Python prerequisite. The F2B and I-SV-7 code samples use UVM and OOP that has not been taught.
- **Correction:** Have the generator honor an explicit `order` (module and sub-lesson) or a curated sequence file. Add an optional `prerequisites` frontmatter field validated against module IDs. Rewrite or flag forward-reference snippets ("preview: you'll learn this in I-SV-1").
- **Acceptance:** A generator test asserts AMBA order 1..14 and I-UVM-3B handshake before layering. A test asserts every authored `**Prerequisite:**` link targets an earlier lesson in the nav order, and every `**Next:**` link equals the nav next or is labelled as optional.

### PLAT-05 — Interview banks invisible to learners (Missing coverage, S2, High)
- **Evidence:** No `src` importer of `content/interview-questions` (§2.4).
- **Learner consequence:** 59 rubric-backed questions, including all staff/system-design items, are unavailable. Inline interview items are static reveals in 20 of 69 modules (0 in T4).
- **Correction:** Add a route (for example `/practice/interview`) or a per-module embed that loads banks by topic and level, with attempt-first and rubric self-scoring. Map bank questions to modules.
- **Acceptance:** A route test renders all 6 banks. Each question shows its prompt before the answer, and the rubric is visible after an attempt. A module mapping test confirms every T2–T4 module has ≥1 linked bank question.

### PLAT-06 — Quiz feedback is not diagnostic and results are not recorded (Interaction weakness, S2, High)
- **Evidence:** `ui/Quiz.tsx:111-116,129-134,154-163`.
- **Learner consequence:** A wrong answer is not explained against the misconception that produced it, the correct answer is not shown, and there is no score, retry or spaced revisit. The quizzes check recognition, not prediction or debugging.
- **Correction:** Add per-option rationale to the schema, reveal the correct option, show a score with retry, and record attempts (local plus Prisma when signed in). Prefer predict-the-output and find-the-bug item types.
- **Acceptance:** Schema validation requires a rationale per option for new items. A component test shows the correct option highlighted after a wrong pick. An attempt is persisted and visible in progress.

### PLAT-07 — Lab metadata invalid; prerequisites unenforced; self-attest reveals solutions (Confirmed defect + design weakness, S2, High)
- **Evidence:** §2.2 table; `generate-lab-registry.mjs:101-103`; `LabClientPage.tsx:274,328-331`.
- **Learner consequence:** Learners can open labs whose stated prerequisite lab does not exist yet (`simple-dut-1`). Completion signals no competence. 47 modules, including all T1 scheduler, interface and clocking modules, have no hands-on lab.
- **Correction:** Validate `owningModule` and `modulePrerequisites` against module IDs in the generator, and separate lab prerequisites from module prerequisites. Either ship `simple-dut-1` or remove it as a prerequisite. Require evidence before solution reveal (a simulation pass or a graded check) or label self-attested completion explicitly.
- **Acceptance:** `generate-lab-registry --check` fails on unknown module IDs. No available lab lists a non-available prerequisite. An e2e test confirms the solution stays hidden until evidence or an explicit "reveal solution" action that is recorded separately from completion.

### PLAT-08 — Feynman "Teach it back" fails silently (Confirmed defect, S3, High)
- **Evidence:** `FeynmanPromptWidget.tsx:29-39` never checks `response.ok` and sets `feedback` to `data.feedback`, which is undefined on a 401/503. `api/ai/feynman-feedback/route.ts:23-37`.
- **Learner consequence:** On every lesson, an anonymous learner or an instance without Gemini submits an explanation and gets nothing back.
- **Correction:** Handle error codes the way `AIAssistantDialog.tsx:38` does ("Sign in to use…", "AI not configured"). Hide or disable the widget when unauthenticated.
- **Acceptance:** A component test with a mocked 401 shows the sign-in message, and a mocked 503 shows the unavailable message.

### PLAT-09 — Marketing and placement copy overstates default capabilities (Documentation drift, S3, High)
- **Evidence:** §6.
- **Learner consequence:** Learners expect in-browser compile and run, gamification, a 24/7 tutor, and roadmap calibration. They hit a 404, missing features, or a sign-in wall.
- **Correction:** Tie the copy to feature flags and real routes. Point the code editor card to `/practice` or an available lab. Remove the leaderboard and badge claims until they ship.
- **Acceptance:** A test asserts every homepage card `href` returns 200 or the sign-in redirect. A copy review checklist is attached to the PR.

### PLAT-10 — Placeholder pages and fake runner are publicly routable (Prototype/gated, S3, High)
- **Evidence:** §4.1 and §7.
- **Learner consequence:** Search or direct visits land on "[Placeholder: …]" pages, or on a fake "test passed" runner.
- **Correction:** Gate them behind a flag or `notFound()`, or write the content. Delete `mock-lab` or move it under a test-only route.
- **Acceptance:** `/learning-strategies`, `/history`, `/resources` and `/practice/lab/mock-lab` return 404 (or real content without "[Placeholder") with default flags, verified by a default-flag e2e.

### PLAT-11 — Default learner surface not browser-tested; strict audits optional (Unverified-quality gap, S3, High)
- **Evidence:** §5.
- **Correction:** Add a second Playwright project or webServer with default flags. Make the default-flag spec run in CI. Fix the link-audit matcher (strip route groups, normalize pretty slugs), then enable `QA_STRICT_LINK_AUDIT` in CI.
- **Acceptance:** A CI job runs `feature-flags.spec.ts` against default flags with zero skips. The strict link audit passes and is required.

### PLAT-12 — Flashcard deck wiring broken for 32 references (Confirmed defect, S2, High; confirms prior finding A with full list)
- **Evidence:** §2.3.
- **Learner consequence:** In T2, 23 of 24 modules show "No flashcards available or component loading..." permanently, so the retrieval-practice loop is missing from the SV/UVM core.
- **Correction:** Import the 11 existing files under the referenced IDs. Author decks, or alias to the legacy decks, for the 21 missing IDs. Keep the `A-UVM-5_Callbacks` alias. Add a test that every frontmatter `flashcards`/`flashcardId` resolves in the registry. Render nothing, or an authoring error in development, for an unknown id.
- **Acceptance:** A new Vitest check reports 0 unresolved refs across all 105 MDX files. The 16 orphan legacy keys are either mapped or removed.

### PLAT-13 — Placeholder knowledge graph drives concept links; ConceptLink not keyboard-accessible (Prototype + a11y, S4, High)
- **Evidence:** `knowledge-graph-engine.ts:36-60` ("Expanded placeholder data", 15 nodes, tier labels such as "UVM Phasing"→Advanced); `ConceptLink.tsx:24-31` is a `<span onClick>` with no role or tabIndex.
- **Correction:** Derive nodes from curriculum metadata and render ConceptLink as a button or link.
- **Acceptance:** Node tiers match the module tiers. axe or a keyboard test can activate a concept link.

### PLAT-14 — Incidental content concern in F2A interview answer (Unverified concern, S3, Medium)
- **Evidence:** `T1_Foundational/F2A_Core_Data_Types/index.mdx` (Interview Questions card, packed vs unpacked) says that `logic [3:0][7:0] data` "is 32 contiguous bits you can part-select as `data[31:0]`".
- **Reasoning:** For a multidimensional packed array, a part-select on the first index applies to the `[3:0]` dimension, so `data[31:0]` is out of range. The whole vector is `data` or `data[3:0]`; bit-level access needs a cast or `{>>{data}}`. Clause unverified; confidence Medium.
- **Hand-off:** Forwarded to the content-accuracy reviewers rather than treated as a platform defect.

---

## 9. Artifacts (all under `scratchpad/audit/`)

- `inventory.json`: machine-readable per-module inventory (tier, files with order/prev/next/words/codeBlocks, interactives used, flashcard refs with registered flag and card count, labs owned and linked, quiz components/questions/wrong-key counts, playground counts, inline interview counts), plus lab list, flashcard registry and totals.
- Scripts: `labs.js`, `fc.js` (+`fc.json`), `tags.js` (+`tags.json`), `mdxscan.mjs` (+`mdxscan.json`), `quizidx.mjs`, `pg.mjs`, `inventory.js`, `probe/pg-entry.tsx` + `probe/build.cjs` (jsdom component probe).
- Logs: `strict-tests.log` (optional audits enabled), `vitest-full.log` (full suite, working tree incl. concurrent untracked test), `linear.json` (105-lesson nav order), `md-interview.json`.
