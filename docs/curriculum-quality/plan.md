# Curriculum quality program: master plan

**Status (2026-10-04).**
- **Done:** phase 0 (spine) and the navigation foundation (the manifest and generator), the diagram kit and the per-file checker.
- **Phase 1–2:** analysis and verification are about one third done; usage limits interrupted the first run, and the runs resumed.
- **Phase 3b:** navigation builders are in progress.
- **Phase 4:** implementation starts wave by wave, as soon as a wave's analyses are verified and the navigation components exist.

Read with:
- [README.md](README.md): the brief (quality requirements, target lesson, depth ladder, completeness checklist, visuals, navigation, rubric, ownership);
- [curriculum-spine.md](curriculum-spine.md): intent cards, plus the §5 standards;
- `analysis/<group>.md` and `analysis/<group>.verify.md`.

---

## 1. Lead decisions (binding for every agent)

### 1.1 Order and navigation

- **Order is data.** [`content/curriculum/curriculum.manifest.json`](../../content/curriculum/curriculum.manifest.json) orders tiers, modules and sub-lessons, and holds prerequisites, track and milestones. The generator fails if a folder or lesson is missing from it.
  - Authors never edit the manifest and never add `order:` frontmatter.
  - A new lesson file needs a manifest entry. The author requests it under "Requests for the lead", and the lead adds it before regenerating.
- **Core path and electives.**
  - Electives: I-SV-8 (end of T2), and E-EMU-1, E-PYUVM-1, E-UVM-ML-1, E-RISCV-1 and E-AI-1 (after the T4 core path).
  - Next and Previous on core lessons skip electives; electives return to the path.
  - T3 UVM order follows the milestones: A-UVM-6 → 7 → 5 → 8 → 4A → 4B.
  - The T4 core path is E-DBG-1 → E-CUST-1 → E-PERF-1 → E-INT-1 → E-PSS-1 → E-PWR-1 → E-SOC-1 (capstone).
- **Orientation components** (built in phase 3b by NB1):
  - Every lesson uses `<BeforeYouStart />` at the end of Quick Take, which shows the manifest prerequisites.
  - Every lesson uses `<NextLesson />` in References & Next Topics, replacing any hand-written "Next:" line.
  - Cross-links go under a "Related" list.
- **Links.** Absolute canonical URLs only: `/curriculum/<Tier_Folder>/<Module_Folder>/<lesson>`, with `#anchor` only for headings that exist. `scripts/check-mdx.mjs` rejects relative links.
- **Expert headings.** `### Expert: <topic>` under Push Further. The expert index and the table of contents link to them, so keep the heading text stable.

### 1.2 Page standard

Apply the README target lesson, and spine §5 in full: §5.1 terminology, §5.2 code style (including `// compile` and `// snippet` tags and an "Expected output" block), §5.3 structure and legacy-heading mapping, §5.4 objectives, §5.5 quiz format. In addition:

- **Exact template structure, including sub-lessons.**
  - Six H2s in order, frontmatter `title`, `description` and `flashcards`.
  - No H1, no `export const metadata`, no `<InfoPage>`.
- **Depth ladder on every page.**
  - The core path reads cleanly on its own.
  - Practitioner depth appears in Build Your Mental Model and Make It Work.
  - The expert layer is the `### Expert:` items, each with a verified source or labelled "tool-dependent".
- **Concept completeness checklist** for every core concept (README §Concept completeness checklist).
- **A picture for every core concept** (README §Visuals):
  - prefer an existing model-backed visualizer (introduce it, predict, debrief);
  - otherwise the diagram kit: `<ArchitectureDiagram>`, `<TimingDiagram>`, `<SequenceDiagram>` (syntax in [visual-language.md §9](../visual-learning/visual-language.md#9-mdx-diagram-kit-static-diagrams-written-as-data));
  - request a new visualizer only for a core concept nothing covers.
- **Practice.**
  - A quiz of at least 4 questions in the canonical `<Quiz questions={[…]}/>` format, each with `objective: <n>`, misconception-based distractors and an explanation.
  - A flashcard deck in the canonical `{id, question, answer}` format, at least 10 cards per module, aligned with the page.
  - One hands-on element (kata with a worked solution in a `<details>` block, exercise, debug challenge or lab link).
- **Pinned elements.** Preserve every e2e-pinned element in spine §3.5. Changing one requires updating its spec, which the lead does.
- **Validation.**
  - `node scripts/check-mdx.mjs <your module folders>` reports 0 errors and 0 template warnings for every page you touch.
  - `npm run -s validate:flashcards` passes.

### 1.3 Topic ownership (no duplication; spiral with links)

| Topic | Owner (full depth) | Elsewhere |
|---|---|---|
| IPC (events, mailboxes, semaphores) | I-SV-5 | F2D/ipc is a labelled core-level introduction that links forward |
| fork/join, `disable fork`, `wait fork` | F2C | I-SV-5 links back |
| sequencer–driver handshake | I-UVM-3A (core), I-UVM-3B (depth) | others link |
| virtual sequences | I-UVM-3B | A-UVM-8 applies them |
| 4KB rule (AXI), 1KB rule (AHB) | B-AXI-2, B-AHB-1 | bridges link back |
| PSS | E-PSS-1 | E-SOC-1/pss is a short bridge page |
| UVM reporting and pass/fail | new I-UVM-1D | E-DBG-1 goes deeper |

### 1.4 New content (P0 gaps from spine §4)

| New | Where | Owner group |
|---|---|---|
| F2E First Self-Checking Testbench (M0) | new module after F2D | N01 |
| F2A `structs-unions-enums.mdx` and `operators-and-expressions.mdx` | F2A sub-lessons | N02 |
| I-UVM-1D Reporting, Run Control and Pass/Fail | new module after I-UVM-1C | N03 |
| I-UVM-3C First Complete Testbench | new module after I-UVM-3A | N04 |
| A-UVM-9 Reset Handling and Error Injection | new module after A-UVM-8 | N05 |
| B-APB-1 APB Protocol and Verification | new module after B-AMBA-2 | N06 |

P1 gaps are assigned to the owning module's group as extra must-cover items: streaming operators and `case inside` (N02); plusargs, `$readmemh` and VCD (F2D); objections from sequences (I-UVM-3A); responder agents (A-UVM-7); and the rest per spine §4. P2 gaps stay in the backlog.

### 1.5 Labs, flashcards, quizzes, banks

- **Labs.** No simulator is available locally, so new runnable labs wait until one is approved: Verilator via Homebrew, which needs the user's OK. Groups fix their existing labs (README, steps, starter and solution coherence) by careful reading, and add in-lesson katas with worked solutions.
- **Flashcards.** One deck per module, in the canonical format. New decks are named `<ModuleShortId>_<Topic>.json`; the lead registers them in `src/lib/flashcard-decks.ts`.
- **Quizzes.** Migrate to the canonical format whenever a page is touched. Keep the release-pinned questions (B-AXI-4 Q1, E-PSS-1) word for word.
- **Interview banks.** G29's report drives a bank group: rewrite `uvm.json`, apply major fixes to the other five, and add coverage gaps from junior to staff level.

---

## 2. Verdicts

Scores R1–R9 (0–3) and S1/S2/S3/S4 counts come from the analyst. Verifier changes are applied as they arrive.

| Group | Module | Verdict | R1 R2 R3 R4 R5 R6 R7 R8 R9 | S1/S2/S3/S4 | Effort | Verified |
|---|---|---|---|---|---|---|
| L01 | F1A_The_Cost_of_Bugs | **major** | 1 2 1 2 2 1 1 2 1 | 0/4/8/8 | M | ✓ |
| L01 | F1B_The_Verification_Mindset | **major** | 1 2 1 2 2 2 2 2 1 | 0/7/13/4 | L | ✓ |
| L01 | F1C_Why_SystemVerilog | **major** | 1 2 1 2 1 1 1 1 1 | 0/4/9/5 | M | ✓ |
| L02 | F2A_Core_Data_Types | **major** | 1 1 1 2 2 1 2 1 1 | 3/12/19/6 | XL (index L; new `structs-unions-enums.mdx` L; `operators-and-expressions.mdx` M, P1) | ✓ |
| L03 | F2B_Dynamic_Structures | **major** | 1 2 1 2 2 1 2 1 1 | 1/12/17/11 | L | ✓ |
| L04 | F2C_Procedural_Code_and_Flow_Control | **major** | 1 1 1 2 1 1 2 1 1 | 1/11/22/6 | L | ✓ |
| L05 | F2D_Reusable_Code_and_Parallelism | **rewrite** | 1 1 1 1 1 1 1 1 1 | 0/14/23/7 (lab `basics-1` adds 0/3/4/2) | L | ✓ |
| L06 | F3A_Simulation_Semantics | **rewrite** | 1 2 1 1 0 1 1 1 1 | 0/6/11/1 | L | ✓ |
| L06 | F3B_Scheduling_Regions | **rewrite** | 1 2 1 1 2 1 1 1 1 | 0/4/8/5 | L | ✓ |
| L06 | F3C_Delta_Cycles_and_Race_Conditions | **major** | 1 2 2 2 3 2 2 2 2 | 0/3/7/7 | M | ✓ |
| L07 | F4A_Modules_and_Packages | **rewrite** | 1 1 1 1 0 1 1 1 0 | 1/10/14/3 | L | pending |
| L07 | F4B_Interfaces_and_Modports | **major** | 1 2 1 2 2 1 2 2 1 | 0/5/13/4 | L | pending |
| L08 | F4C_Clocking_Blocks | **major** | 1 2 1 2 2 1 2 1 1 | 0/9/11/9 | L | ✓ |
| L09 | I-SV-1_OOP/index.mdx (with deck `I-SV-1_OOP`) | **major** | 1 2 2 2 2 2 2 1 1 | 0/5/19/7 | L | pending |
| L09 | I-SV-1_OOP/constructors.mdx | **major** | 1 2 0 2 0 1 1 1 1 | 0/3/8/1 | M | pending |
| L09 | I-SV-1_OOP/copying-and-cloning.mdx | **major** | 1 2 0 2 2 1 2 1 1 | 0/3/7/3 | M | pending |
| L10 | I-SV-1_OOP (scope: polymorphism-pitfalls.mdx, parameterized-classes.mdx) | **major** | 1 2 0 2 1 1 1 1 1 | 0/10/14/7 | L | ✓ |
| L10 | ↳ polymorphism-pitfalls.mdx | major | 1 2 0 2 2 1 1 1 1 | 0/5/8/4 | M | ✓ |
| L10 | ↳ parameterized-classes.mdx | major | 1 2 0 2 0 1 1 1 1 | 0/5/6/3 | M | ✓ |
| L11 | I-SV-2A_Constrained_Randomization_Fundamentals | major | 1 2 1 2 2 1 1 1 1 | 0/9/17/17 | L | pending |
| L12 | I-SV-2B_Advanced_Constrained_Randomization | **rewrite** | 1 2 1 1 1 1 1 1 1 | 0/14/21/8 | XL | pending |
| L13 | I-SV-3A_Functional_Coverage_Fundamentals | major | 1 2 1 2 2 1 1 1 1 | 0/8/18/17 | L | pending |
| L14 | I-SV-3B_Advanced_Functional_Coverage | rewrite | 1 2 1 2 1 1 1 1 1 | 1/15/20/14 | XL | pending |
| L15 | I-SV-4A_SVA_Fundamentals | **major** | 1 2 1 2 2 1 1 1 1 | 0/15/18/11 | L | pending |
| L16 | I-SV-4B_Advanced_Temporal_Logic | **major** | 1 2 1 2 1 1 1 1 1 | 0/12/14/3 | L | pending |
| L16 | I-SV-4C_Checkers | **major** | 1 2 1 2 1 0 1 2 1 | 0/9/7/7 | L | pending |
| L17 | I-SV-5_Synchronization_and_IPC | **rewrite** (verifier: major → rewrite) | 1 2 1 2 2 1 1 1 1 | 0/11/17/8 | L | ✓ |
| L18 | I-SV-6_Compiler_Directives_and_Generates | major | 1 2 1 2 1 1 1 2 1 | 0/8/9/10 | L | ✓ |
| L18 | I-SV-7_DPI_and_Foreign_Language_Interfaces | major | 1 2 1 2 2 1 2 2 1 | 0/7/11/11 | L | ✓ |
| L19 | I-SV-9_Why_UVM | rewrite | 1 1 1 1 1 1 1 1 1 | 1/9/12/4 | L | ✓ |
| L19 | I-UVM-1A_Components | major | 1 2 2 2 1 1 2 1 1 | 0/6/10/3 | L | ✓ |
| L20 | I-UVM-1B_The_UVM_Factory | **major** | 1 2 1 2 2 1 2 1 1 | 1/5/10/4 | L | pending |
| L20 | I-UVM-1C_UVM_Phasing | **major** | 1 2 1 2 2 1 2 1 1 | 0/7/9/2 | L | pending |
| L21 | I-UVM-2A_Component_Roles | **major** | 1 2 1 2 2 1 2 1 1 | 0/6/11/5 | L | pending |
| L21 | I-UVM-2B_TLM_Connections | **major** | 1 2 1 2 2 2 2 2 1 | 0/5/15/4 | L | pending |
| L22 | I-UVM-2C_Configuration_and_Resources | **major** | 1 2 1 2 2 1 2 1 1 | 0/7/12/5 | L | pending |
| L22 | I-UVM-3A_Fundamentals | **major** | 1 2 1 2 2 1 2 2 1 | 1/6/9/4 | L | pending |
| L23 | I-UVM-3B_Advanced_Sequencing_and_Layering (L23 scope: `index.mdx`, `sequencer-driver-handshake.mdx`, `sequence-arbitration.mdx`, `sequence-libraries.mdx`) | **major** | 1 2 1 2 2 1 2 1 1 | 1/8/22/8 | L | pending |
| L24 | I-UVM-3B_Advanced_Sequencing_and_Layering (L24 scope: 5 sub-lessons) | **major** | 1 2 1 2 1 1 2 1 1 | 1/10/20/5 | XL | pending |
| L25 | I-UVM-4_UVM_Policy_Classes | **major** | 1 2 2 2 2 1 2 2 1 | 0/5/10/4 | L | pending |
| L25 | I-UVM-5_UVM_Container_Classes | **major** | 1 2 2 2 2 1 2 2 1 | 0/2/7/8 | M | pending |
| L25 | I-UVM-6_UVM_Recording_Classes | **major** | 1 2 1 2 2 1 2 1 1 | 0/7/7/4 | L | pending |
| L26 | A-UVM-4A_RAL_Fundamentals | **major** | 1 2 2 2 1 1 1 2 1 | 0/10/17/6 | L | pending |
| L27 | A-UVM-4B_Advanced_RAL_Techniques (index + 3 sub-lessons) | **major** | 1 2 1 2 1 1 2 1 1 | 1/11/26/7 | XL | pending |
| L28 | A-UVM-5_UVM_Callbacks | **major** | 1 2 1 2 2 1 2 1 1 | 0/5/16/9 | L | pending |
| L29 | A-UVM-6_Scoreboards_and_Reference_Models | **major** | 1 2 1 2 2 1 2 2 1 | 1/9/19/10 | L | pending |
| L30 | A-UVM-7_VIP_Construction | **rewrite** | 1 2 1 2 1 1 1 1 1 | 0/11/20/11 | L | pending |
| L31 | A-UVM-8_Multi_Agent_Topologies | rewrite | 1 2 1 1 1 1 1 1 1 | 0/13/14/2 | L | pending |
| L32 | B-AMBA-1_Protocol_Families_and_Tradeoffs | major | 1 2 1 2 1 1 1 1 1 | 0/7/13/4 | L | pending |
| L32 | B-AMBA-2_Protocol_Intuition_and_Memory_Hooks | major | 1 2 1 2 1 1 1 1 1 | 0/8/9/6 | L | pending |
| L33 | B-AHB-1_AHB_Design_Timing_Mechanics | major | 1 2 1 2 2 2 1 1 1 | 0/9/7/3 | L | pending |
| L33 | B-AHB-2_AHB_Pitfalls_and_Deadlocks | major | 1 2 1 2 1 1 2 1 1 | 0/7/6/6 | L | pending |
| L34 | B-AHB-3_AHB_Verification | **major** | 1 2 1 2 0 1 2 1 1 | 0/6/18/6 | L | pending |
| L35 | B-AXI-1_AXI_Channel_Architecture | **major** | 1 2 1 2 2 1 1 1 1 | 1/4/16/6 | L | pending |
| L36 | B-AXI-2_AXI_Burst_Math | **major** | 1 2 1 2 2 1 1 1 1 | 1/6/15/4 | L | pending |
| L37 | B-AXI-3_AXI_Ordering_and_IDs | **major** | 1 2 1 2 2 1 2 1 1 | 0/6/15/3 | L | pending |
| L37 | B-AXI-4_AXI_Expert_Features_Cache_Atomics | **major** | 1 2 1 2 1 1 2 1 1 | 0/6/17/3 | L | pending |
| L38 | B-AXI-5_AXI_Pitfalls_Interconnect_Deadlocks | **major** | 1 1 1 2 1 1 1 1 1 | 1/3/10/2 | L (page L, lab S) | pending |
| L38 | B-AXI-6_AXI_Verification_Performance | **rewrite** | 1 1 1 1 0 1 1 0 1 | 1/10/11/3 | XL (page L, lab L) | pending |
| L38 | Lab `axi-deadlock-hunt-lab | **major** (small) |          | 0/1/4/2 | S | pending |
| L38 | Lab `axi-scoreboard-lab | **major** |          | 1/4/5/1 | L | pending |
| G29 | Interview banks (6) | 5 major, 1 rewrite (`uvm.json`) | — | 7 S1 | L | ✓ |
| G30 | Navigation (8 units) | 6 major, 2 rewrite | — | 0 S1, 23 S2 | L | ✓ |

Pending analysis: L39–L48. Pending verification: L07, L09, L11–L16, L20–L38.

**What the first 30 verdicts show.**
- R1 (objectives) and R9 (completeness and depth) score 1 on every page: no lesson states measurable objectives, and none has an expert layer.
- R3 (structure) is 1 almost everywhere.
- The program therefore does more than fix errors. It brings every page to the target standard: objectives, the depth ladder, a picture for every core concept, practice aligned with the objectives, and orientation.

---

## 3. Implementation waves

Each wave runs the implementation workflow:
1. One author per group.
2. Three independent reviewers: (a) accuracy against the primary sources; (b) completeness, depth and pedagogy against the spine card, the checklist and the depth ladder; (c) visuals, navigation and accessibility.
3. Fix rounds until all three pass, at most 3 rounds, then the group escalates to the lead.
4. The lead integrates: manifest entries, deck registration, `generate:curriculum`, full validation, then commit and push.

| Wave | Groups | Starts when | Status |
|---|---|---|---|
| W1a | L01 (F1A–F1C), L02 (F2A index), L03 (F2B), N01 (F2E), N02 (F2A sub-lessons) | L01–L03 verified; the lead adds placeholders, manifest entries and registered decks for N01/N02 first | running |
| W1b | L04 (F2C), L05a/b/c (F2D index + basics-1, tasks-functions, ipc), L06a/b/c (F3A, F3B, F3C), L08 (F4C) | L04–L06 and L08 verified | running |
| W1c | L07 (F4A rewrite, F4B) | L07 verified | waiting |
| W2 | L09–L18 | L09–L18 verified | waiting |
| W3 | L19–L25, N03 (I-UVM-1D), N04 (I-UVM-3C) | L19–L25 verified | waiting |
| W4 | L26–L31, N05 (A-UVM-9) | L26–L31 verified | waiting |
| W5 | L32–L40, N06 (B-APB-1) | L32–L40 verified | waiting |
| W6 | L41–L48, G29 bank fixes | L41–L48 verified | waiting |

Waves overlap when usage allows. A group whose verifier could not run still proceeds; its accuracy reviewer then also re-checks the analyst's S1/S2 claims.

**Group sizing.** A rewrite of a multi-page module is split into one group per page (for example L05a/b/c) when the pages have separate decks. Each split author owns one page and its deck, and links to its siblings. Modules whose pages share one deck stay in one group.

**New lessons.** Before a wave creates a new module or sub-lesson, the lead adds a placeholder page, a one-card registered deck and the manifest entry. The generator, routes and tests then stay consistent while authors and other workflows run in parallel.

## 4. Definition of done (per lesson)

1. All S1 and S2 issues from the analysis and the verification are resolved. Each S3 is resolved or explicitly deferred with a reason.
2. Every must-cover item on the spine card is covered.
3. Every core concept passes the completeness checklist.
4. The core, practitioner and expert layers are all present.
5. 3–5 objectives, each exercised. The quiz has at least 4 questions mapped to objectives. The flashcards are aligned. There is one hands-on element.
6. Every core concept has an accurate, accessible picture.
7. `<BeforeYouStart/>` and `<NextLesson/>` are used. Links are canonical. The template structure is exact. No H1.
8. `check-mdx` reports 0 errors and 0 template warnings. Flashcards validate. Pinned elements are intact.
9. All three reviewers pass.

## 5. Closure (phase 6)

After all waves:
- **Curriculum-wide completeness critic and accuracy sweep**, in rounds, until two consecutive rounds find nothing new.
- **Junior, practitioner and expert route walk-throughs** (agents follow each route and report gaps).
- **Full build, the 390 px and contrast sweeps, the e2e suite** (including the flags-off project and the next-chain walk), the bundle check, and a final review of the PROJECT_GUIDE §3 table, generated from the manifest.

## 6. Risks and open questions

- **No local simulator.** Lesson code is verified by reading and against the standards' text. Installing Verilator (Homebrew) would let reviewers compile `// compile` snippets and labs; this needs the user's approval.
- **Usage limits** interrupted the first analysis run. Workflows resume from their caches, so finished work is never repeated.
- **One analysis (E-DBG-1) was blocked by a content filter.** It was retried; if it recurs, it will run with a narrower prompt.
- **Release e2e specs** need `AUTH_TEST_MODE` and a test database (see CONTRIBUTING.md); they run in CI.
