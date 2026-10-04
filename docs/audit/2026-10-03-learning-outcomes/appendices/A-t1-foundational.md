> **Provenance.** Area report produced during the 2026-10-03 learning-outcome audit by a read-only review agent, then reviewed by the lead auditor. Key claims were spot-checked against source, the running site, IEEE 1800-2023 (repo `system_verilog_lrm.pdf`), and Arm IHI0033 text. Line numbers refer to commit `488f7f43`. Items fixed in the same session are listed in [../audit-report.md](../audit-report.md) §9; everything else is open.

# T1 Foundational: Deep Educational and Technical Audit

Audit date 2026-10-03. Repo `/Users/Rakesh/Projects/sv-uvm-guide` at main @ 488f7f43. Read-only: no repository file was edited.
Scope: all 16 `.mdx` files under `content/curriculum/T1_Foundational` (13 modules, including sub-lessons `F2C/flow-control.mdx`, `F2D/tasks-functions.mdx`, `F2D/ipc.mdx`). I also checked the interactives, flashcards, quiz data, interview banks and lab these lessons depend on. F2A through F4C get the deep treatment; F1A through F1C get a lighter one.

## 0. Method and what was verified

- **Normative source.** The repo root contains `system_verilog_lrm.pdf`, which is **IEEE 1800-2023**. Its text came out with a zlib stream extractor (scratch scripts `t1_pdf_extract.py` and `t1_find.py`). Every clause number marked **[LRM-verified]** below was matched against that text. Clause numbers not marked that way are labeled "clause unverified".
- **Secondary check.** The clocking-drive region was cross-checked against the Accellera sv-ec Mantis 890 thread (accellera.org/images/eda/sv-ec/4153.html). That thread is where the change "clocking drives go to Re-NBA" originated.
- **No simulator.** No SV tool is installed (no verilator, iverilog, slang, vcs, xrun or questa). The compile assessments below are expert judgment plus LRM text (Medium confidence) unless the LRM states the rule outright, as with the illegal static initializer.
- **Rendering probe.** I compiled a sample containing GFM constructs with the repo's own `@mdx-js/mdx` (the version used by next-mdx-remote 4.4.1) and the same plugin set the lesson page passes (`remarkConceptLinks` only). Result: **no `<table>`, no task-list checkbox, and a literal `[!WARNING]`**. The probe script is `t1_gfm_probe.mjs`.
- **Concurrent edits.** Other agents changed the working tree during this audit. New untracked files appeared: `src/lib/sv-scheduler-model.ts`, `src/components/visual-system/`, and others. They are not part of this audit, which covers the committed T1 content.

Rating scale for the competency tables: 0 = absent, 1 = shallow or mentioned only, 2 = solid with evidence.
Columns: E = Explain, P = Predict, A = Apply-in-code, D = Debug-misuse, T = Transfer.

---

## 1. Executive summary

1. **A beginner cannot get from "why verification" to a race-aware, interface-based testbench using T1 alone.** No lesson ever assembles the following into one complete or runnable example:
   - an interface instance
   - a clocking block plus `default clocking`
   - a driver that drives through the clocking block
   - a monitor that samples through the clocking block
   - virtual-interface binding

   There is no T1 lab for any of the F3/F4 skills. The only T1 lab, `basics-1`, grades whether the tokens `int myVar ;` appear, which has nothing to do with its own README.
2. **Scheduling semantics, the core of F2C, F3 and F4C, contradict each other across surfaces, and several of those surfaces are wrong per 1800-2023.**
   - F3B is mostly right.
   - The graded `EventRegionGame` embedded in F2C rewards *wrong* answers: `final` and `assert property` are graded as "Postponed".
   - F4C and its flashcards say module-originated clocking drives mature in **NBA**. That is wrong: they mature in **Re-NBA** (§14.16).
   - The interview bank says assertions and clocking inputs *sample in Observed*. That is wrong: they sample in Preponed, i.e. #1step.
3. **Several canonical examples teach the wrong mental model:**
   - F3A's "delta cycle" NBA example (S1).
   - F3C's simulation/synthesis-mismatch answer (S2).
   - F4C's "race-prone testbench", which is not actually a race (S2).
   - F2A's "variables are single driver" text plus a data-type quiz question that grades "two procedural blocks drive → X" as correct (S2).
   - F2C's advice to `disable` named blocks, which kills every activation of the block (S2).
4. **Rendering defect affects about 90 markdown table rows in T1.** This includes the F3B region table, which is the module's core content. Without `remark-gfm`, these render as pipe-delimited paragraphs, and `> [!WARNING]` callouts render literally. Confidence is High at the compile level; I did not check it in a browser.
5. **Assessment is recall-only.** Quizzes have 2–3 MCQs per lesson (none in F1A, F1B, F1C, F2A, F2B or F2D/index; F2A uses a 5-question widget). No question asks the learner to predict printed output or waveform values, and none asks them to find a bug in code. There are zero katas, against a spec minimum of 14.
6. **The T1-FOUNDATIONAL-UPGRADE spec is entirely unimplemented:**
   - 0 of 6 visuals exist.
   - 0 katas exist.
   - There is no `foundational_systemverilog.json`.
   - There is no code-style note.

   The spec itself contains wrong clause numbers and an incomplete region model. Fix the spec before executing it.

### Module summary

| Module | Depth (1-5) | Strongest competency | Biggest gap | Severity |
|---|---|---|---|---|
| F1A Cost of Bugs | 3 | Explaining verification economics and ECO vs respin (F1A:37-59) | No practice or assessment; ECO vs metal-spin rows conflated (F1A:54-56) | S4 |
| F1B Verification Mindset | 3 | Method trade-offs; code vs functional coverage (F1B:53-109, 133-141) | `one_hot(state)` assertion is not a real construct (F1B:139); no quiz | S4 |
| F1C Why SystemVerilog | 2 | Feature overview with LRM clause pointers (F1C:32-61) | Historical inaccuracies; imprecise `logic` multi-driver rule (F1C:11, 21, 87) | S4 |
| F2A Core Data Types | 3 | Explaining 4-state vs 2-state and X masking (F2A:26-38, 229-235) | Wrong net/variable driver rule in text and quiz; no expression sizing rules; no struct/union; no operators | S2 |
| F2B Dynamic Structures | 3 | Associative-array scoreboard and memory-leak debugging (F2B:134-164, 270-279) | Wrong semantics: `new[]` default and bounded-queue overflow; no deletion-while-iterating trap | S3 |
| F2C Procedural & Flow | 2 | Blocking vs NBA explanation; `always_*` FSM pattern (F2C:37-64, 160-211) | Graded game rewards wrong region answers; race-prone TB code is unlabeled; named-`disable` advice | S1 |
| F2D Reusable/Parallel (3 files) | 2 | Static vs automatic lifetime (tasks-functions:44-87) | Events, `wait fork` and fork-in-loop capture absent; illegal code; lab mismatch; topic ordering | S2 |
| F3A Simulation Semantics | 2 | Timescale and precision prediction (F3A:104-131) | Delta-cycle NBA demo is wrong (F3A:62-69); `$time` output wrong (F3A:47) | S1 |
| F3B Scheduling Regions | 2 | NBA RHS/LHS regions; assertion sampling vs evaluation (F3B:26-29, 73-78) | No code or prediction exercise; claims regions "prevent races"; reactive set incomplete; table does not render | S2 |
| F3C Delta Cycles & Races | 2 | Classic two-`always` blocking race and the NBA fix (F3C:22-57) | TB↔DUT and derived-clock delta races not shown; mismatch interview answer is wrong (F3C:99) | S2 |
| F4A Modules & Packages | 2 | Using a package for shared types (F4A:31-110) | Import/include semantics: type identity, wildcard rule, `export`; mis-taught collision rule | S3 |
| F4B Interfaces & Modports | 2 | Modport direction views (F4B:38-53, ModportExplorer) | Virtual-interface binding never shown; example handshake deadlocks; no clocking block in the modport | S2 |
| F4C Clocking Blocks | 2 | Default input skew #1step (F4C:88, 120-125) | Wrong drive region; `##` needs `default clocking` (never taught); `@(cb)` timing; no driver/monitor pattern | S1 |

---

## 2. Adjudication: scheduling regions, assertion sampling, clocking blocks

### What IEEE 1800-2023 says (all LRM-verified from the local PDF)

**Concurrent assertions** (§16.5 and §16.5.1)
- They are *evaluated in the Observed region*.
- In most cases the sampled value of an expression is its value in the *Preponed* region.
- Action blocks are scheduled in the Reactive region (§4.4.2.x and §16.14.1).

**#1step** (§4.4.2.1)
- #1step sampling is identical to sampling in the Preponed region of the current time slot.
- That is equivalent to the previous time slot's Postponed region.

**Clocking-block input skews** (§14.3, §14.4, §14.13)
- Default input skew is `1step`; default output skew is `0`.
- A non-#0 input skew samples at the Postponed region of the time step `skew` time units before the clocking event.
- An **explicit `#0`** input skew samples in the **Observed** region.

**Clocking-block drives** (§14.16 Synchronous drives)
- A zero-skew drive with no cycle delay is scheduled in the **Re-NBA region** of the clocking-event time step.
- A nonzero skew or cycle delay schedules the change in the Re-NBA region of a future time step.
- The rule makes **no distinction between drives from module/class code and drives from program code**.
- The NBA-vs-Re-NBA split by origin is pre-2009 behavior. Mantis 890 made all synchronous drives Re-NBA (secondary source: Accellera sv-ec thread).

**Clocking-block event** (§14.10)
- `@(cb)` is triggered **in the Observed region**.
- That is later than `@(posedge clk)`, which runs in the Active region set.

**Cycle delay** (§14.11)
- `##N` uses the default clocking. If no default clocking exists, *the compiler shall issue an error*.

### Verdict per artifact

| Artifact | Claim | Verdict |
|---|---|---|
| F3B:25, F3B:29, F3B:77 | Assertions and clocking inputs sample in Preponed; assertions evaluate in Observed | **Correct** (High) |
| F3B:47 | "Inputs are sampled in the Preponed region, and outputs are driven in the Re-NBA region" | Correct for the default #1step input skew and #0 output skew. Oversimplified for explicit `#0` input skew (Observed) and nonzero skews. Calling Re-NBA "a subset of the Reactive region" is imprecise: Re-NBA is a separate region in the *reactive region set*. (S4) |
| F4C:37 | Sampling just before the edge in Preponed | Correct for the default skew (#1step) |
| **F4C:38** | Drives go to "NBA or Re-NBA region (depending on whether the drive originated from an Active or Reactive region block)" | **Wrong** per §14.16: always Re-NBA. (S1, High) |
| **F4C:134** (interview answer) | "If driven from a standard module (Active region), the update is scheduled in the NBA region" | **Wrong**, same reason. The claim of "guarantees it will not race" is also overstated. (S1, High) |
| `content/flashcards/F4C_Clocking_Blocks.json:5, :15` | NBA/Re-NBA split by origin | **Wrong** (S2, High) |
| **`content/interview-questions/systemverilog.json:39-40`** (`sv-scheduling-regions`) | "Observed (assertion sampling, clocking-block input)"; "Assertions evaluate in Observed, seeing post-NBA settled values" | **Wrong.** Evaluation is in Observed, but values come from Preponed, i.e. pre-edge. Clocking inputs with default skew sample in Preponed. The rubric bakes in the error. (S1, High) |
| **`systemverilog.json:52-53`** (`sv-clocking-block-race`) | "inputs sample in Observed (post-NBA, stable values), outputs drive in Re-Active" | **Wrong on both counts:** inputs sample in Preponed (#1step), and outputs mature in Re-NBA (there is no "Re-Active" region). The premise is also overstated: `@(posedge clk)` *reading* NBA-driven DUT outputs is deterministic. The race is TB *driving* with blocking assignments, or DUT logic built from blocking assignments. (S1, High) |
| `content/interview-questions/sva-formal.json:14` | Concurrent assertions "sample in the Observed region" | **Wrong** (S2, High) |
| **`sva-formal.json:33-34`** (`sva-past-sampling`) | "assertions sample in Observed (post-NBA)… If ack is driven by NBA in the same cycle, it will be visible" | **Wrong, and the conclusion flips.** At the edge where the DUT NBA-drives `req` and `ack`, the assertion samples their pre-edge values. The overlapping implication is checked on the *next* edge's sampled values. (S1, High) |
| `src/components/visuals/EventRegionGame.tsx:44-53` (embedded in F2C:35) | `final` → Postponed; `assert property` → Postponed, both graded correct | **Wrong.** `final` runs once at end of simulation (§9.2.3). Concurrent assertions evaluate in Observed. The game *penalizes* the right answer. (S1, High) |
| F2C:27-32 region table | "Postponed: `final`, `$strobe`, assertions" | **Wrong** for `final` and assertions; correct for `$strobe` (S1, High) |
| `src/components/visualizers/SVSchedulerRegionVisualizer.tsx:52` | In the race scenario, "Observed: Assertions evaluated. Race condition may cause failures depending on execution order." | Misleading: assertions use Preponed values and are immune to an Active-region ordering race (S4) |

**Bottom line.** F3B (and F3B's flashcards) are right. F4C, its flashcards, the two SV interview-bank entries, the SVA bank entries, F2C's table and `EventRegionGame` are wrong.

**Confidence.** High. Every normative point was read in the 1800-2023 text bundled in the repo.

**Fix order.**
1. `EventRegionGame` and the F2C table, because they are graded and shown before F3B.
2. F4C:38 and F4C:134, plus F4C flashcards 5 and 15.
3. The interview banks `sv-scheduling-regions`, `sv-clocking-block-race`, `sva-formal` (Q at line 14) and `sva-past-sampling`.
4. Add a regression test that string-matches forbidden phrases across `content/**`, for example `sample in Observed`, `NBA region (or Re-NBA`, and `final.*Postponed`.

---

## 3. Cross-cutting findings

Each finding lists: ID, category, evidence, learner consequence, severity and confidence, correction, and acceptance criteria.

### T1-001: GFM markdown does not render
- **Category:** Confirmed defect (compile-level).
- **Evidence:**
  - `src/app/(learning)/curriculum/[...slug]/page.tsx:92-101` passes only `remarkConceptLinks`.
  - `package.json` has `next-mdx-remote ^4.4.1` and no `remark-gfm`.
  - The probe compile produced no table element and a literal `[!WARNING]`.
  - Table rows per file: F1A 19, F1B 14, F2A 26, F2B 16, F2C 6, F3B 9.
  - Callouts: 14. Task-list items in F2C:219-221: 3.
  - The `mermaid` fence in F4B:104-120 renders as plain code; there is no mermaid dependency.
- **Learner consequence:** The core F3B region table and the F2A type and X-behavior tables show as run-on pipe text. Warnings appear with a literal `[!WARNING]` marker.
- **Severity / confidence:** S2. High at the compile level; not checked in a browser.
- **Fix:** Add `remark-gfm` (v3.x for MDX 2) to `mdxOptions.remarkPlugins`. Add a callout plugin, or rewrite callouts as `<Alert>`. Replace the mermaid block with an SVG or component.
- **Acceptance:** A Playwright test on `/curriculum/T1_Foundational/F3B_Scheduling_Regions/index` asserts a `<table>` with ≥7 body rows. No page contains the literal text `[!WARNING]`.

### T1-002: Scheduling contradictions across lessons, game, flashcards and banks
- **Category:** Confirmed defect.
- **Evidence:** See §2.
- **Learner consequence:** Learners are drilled into wrong answers before F3B, then told the opposite in F3B, then told a different wrong thing in F4C. Interview prep reinforces the wrong model.
- **Severity / confidence:** S1. High.
- **Fix:** As in §2.
- **Acceptance:** A single source of truth: a region facts table in a shared TS module consumed by the game, the visualizer and the flashcards. A unit test checks that `final` is never mapped to Postponed and that a clocking drive maps to Re-NBA. A content lint fails on the forbidden phrases.

### T1-003: Assessment is recall-only, with no Predict or Debug items
- **Category:** Interaction/design weakness.
- **Evidence:**
  - Quiz counts: F2C index 3, flow-control 2, tasks-functions 2, F3A 2, F3B 3, F3C 2, F4A 2, F4B 2, F4C 2.
  - F1A, F1B, F1C, F2B, F2D/index and ipc have none.
  - F2A has a 5-question widget (`src/content/f2/dataTypeQuizQuestions.ts`).
  - All items are single-answer recall, such as "which region…".
  - `<details>` interview Q&As show the answer on click, so there is no attempt step.
- **Learner consequence:** Competencies P, D and T go unexercised. Learners can recite region names but cannot predict `$display` output.
- **Severity / confidence:** S2. High.
- **Fix:** Add 2–4 "what prints?" or "what value at t=…?" items per technical module, built from code. Add one "find the bug" item per module.
- **Acceptance:** Each F2A–F4C lesson has ≥2 Predict items whose answer key was produced by actually simulating the snippet. Store the snippet, simulator log and answer under `tests/sv_examples/` (the directory already exists).

### T1-004: Labs do not support T1 outcomes
- **Category:** Confirmed defect plus missing coverage.
- **Evidence:**
  - F2D:14 links `basics-1`.
  - `content/curriculum/labs/basics/lab1_refactoring/lab.json` has steps "declare `int myVar`" and "assign 10". The grader `src/lib/lab-graders.ts:47-64` checks only the token sequences `int myVar ;` and `myVar = 10 ;`.
  - The lab's README asks for a `task automatic drive_sequence` refactor.
  - The starter `work/tb_counter_unrefactored.sv` mixes `data = 8'h01` with `data <= data + 1` on the same signal. It also drives `enable = 1` with a blocking assignment right after `@(posedge clk)`, which races the DUT's `always_ff`. That is exactly what F2C:138 and F3C:65 say never to do, and it is unlabeled.
  - F4B:149 promises a refactor lab and F4C:108 promises "The Race Condition Lab". Neither exists among the lab.json files. The owning modules seen are F2B, F2C, F2D, F4, I-SV-*.
- **Learner consequence:** Completing the lab proves nothing about the stated objective, and the starter code models the anti-pattern.
- **Severity / confidence:** S2. High.
- **Fix:**
  - Re-author the `basics-1` steps to match the README.
  - Label the starter's races as the bug to fix.
  - Create an F3C/F4C race lab with a buggy TB and a clocking-block fix, checked by a compile-and-run grader or at least by a structured self-check.
- **Acceptance:** The lab steps match the README. The grader rejects a solution that keeps blocking drives at the clock edge. The F4C page links to an existing lab id.

### T1-005: Prerequisite and ordering breaks
- **Category:** Interaction/design weakness.
- **Evidence:**
  - F2B:138-160 uses `class … extends uvm_component`, `` `uvm_error`` and `report_phase` before OOP (T2 I-SV-1) or UVM.
  - F2D/index:33-43 uses class downcasting before OOP.
  - F2C/index:96-135 teaches fork/join and `disable` before tasks.
  - The F2D section order is `index` (System Tasks) → `ipc` → `tasks-functions` (`src/lib/curriculum-data.tsx:100-118`). IPC comes before tasks, and the section folder "Reusable_Code_and_Parallelism" is titled "System Tasks and File I/O".
  - F4B:164 relies on `config_db`.
- **Learner consequence:** Beginners meet unexplained UVM and OOP syntax. Parallelism is split between F2C and F2D.
- **Severity / confidence:** S3. High.
- **Fix:** Use plain-SV class or module examples in F2B. Move fork/join into F2D. Reorder F2D to index → tasks-functions → ipc.
- **Acceptance:** No T1 code references `uvm_*`, or each such reference carries an explicit "preview, covered in I-UVM-x" note.

### T1-006: Missing foundational coverage
- **Category:** Missing coverage.
- **Evidence (grep across T1):**
  - **Operators.** There is no lesson on reduction, shift (`>>>`), `inside`, concatenation/replication, `**`, wildcard equality, or expression bit-length and sign rules (context-determined sizing). `OperatorDrill` is registered in `src/components/mdx/lazy-mdx-interactives.ts` but used by no MDX. The flashcard deck `F2C_Operators.json` exists with no lesson.
  - **Structs, unions, typedef** are used (F2B:113, F4A:40) but never taught.
  - **Named events** (`->`, `->>`, `.triggered`), **`wait fork`**, and the **fork/join_none in a loop** capture bug: absent. LRM §9.3.2 says spawned processes do not start until the parent blocks or terminates.
  - `process` class appears only by name (F2C:120).
  - `default_nettype none`, port kind rules (an `input logic` port is a net), `parameter`/`generate`, `bind`, and `timeunit`/`timeprecision`: absent.
- **Learner consequence:** TB authors miss the most common thread and width bugs.
- **Severity / confidence:** S2. High.
- **Fix:** Add an operators/expressions lesson (F2A-2), an events/`wait fork` section (F2D), and a structs/unions section (F2A).
- **Acceptance:** Each item has a lesson section with a runnable snippet, one Predict question and a flashcard.

### T1-007: Spec is unimplemented and partly wrong
- **Category:** Unverified concern / spec quality. See §6.
- **Severity:** S3.

---

## 4. Per-module audits

### F1A: The Cost of Bugs (light)

**Inventory**
- File: `F1A_The_Cost_of_Bugs/index.mdx` (202 lines).
- H2 sections: Quick Take, Multi-Million Dollar Question, Design Gap, Cost of Finding a Bug, Cautionary Tales, Shift Left, Deeper Understanding, Interview Questions, References.
- Interactives: `DesignGapChart`, `InteractiveCostOfBugGraph`, `HallOfShameCarousel`, Card.
- Assessment: 5 `<details>` interview Q&As; 0 quiz questions.
- Flashcards: `F1A_Cost_of_Bugs` (8 cards).
- Labs: none. Next link → F1B (relative `../F1B…/`, which works from the canonical `/…/index` URL). Code blocks: 0.

**Coverage**

| Concept | E | P | A | D | T | Evidence |
|---|---|---|---|---|---|---|
| Bug-cost escalation and respin economics | 2 | 0 | 0 | 0 | 1 | F1A:37-57, 189-195 |
| Verification lifecycle / shift-left | 2 | 0 | 0 | 0 | 0 | F1A:100-119 |

**Accuracy**
- F1A:54-56: the "ECO: only metal layers" and "Metal Spin: metal layers only" rows overlap and are not distinguished. A post-silicon ECO *is* realized as a metal spin. (S4)
- F1A:18, "two verification engineers for every design engineer": industry surveys report roughly parity to modestly higher. Present it as a range with the source. (S4)
- Ariane 5 is a software failure. That is fine as a reuse cautionary tale, but label it as software.

**Journey:** An adequate motivator. It needs at least one short self-check, such as the spec's cost-escalation kata.

### F1B: The Verification Mindset (light)

**Inventory**
- 224 lines.
- Interactives: `VerificationMethodologiesDiagram`, `FirstBugHuntGame` (an off-by-one counter hunt, `src/components/curriculum/f1/FirstBugHuntGame.tsx`).
- Assessment: 5 interview Q&As; 0 quiz questions.
- Flashcards: `F1B_Verification_Mindset` (6). Code: 0 fences (one inline assertion).

**Coverage**

| Concept | E | P | A | D | T | Evidence |
|---|---|---|---|---|---|---|
| Destructive mindset / feature checklist | 2 | 0 | 1 | 1 | 1 | F1B:39-51, FirstBugHuntGame, 192-206 |
| Directed / CRV / formal trade-offs | 2 | 0 | 0 | 0 | 1 | F1B:59-88, 175-187 |
| Code vs functional coverage | 2 | 0 | 0 | 1 | 0 | F1B:90-109, 133-141, 164-170 |

**Accuracy**
- F1B:139 `assert property (one_hot(state))`: there is no built-in `one_hot`; the system function is `$onehot`. A concurrent assertion also needs a clock or default clocking. Should be `assert property (@(posedge clk) $onehot(state));`. (S4, High)
- F1B:158, "Verification is pre-silicon … Validation is post-silicon": an oversimplification. Pre-silicon validation (emulation running software) is standard. (S4)

### F1C: Why SystemVerilog? (light)

**Inventory**
- 110 lines. Interactive: `VerilogVsSystemVerilog`.
- 3 interview Q&As; 0 quiz. Flashcards `F1C_Why_SystemVerilog` (4).
- 2 code fences: a class snippet and a covergroup snippet with no sampling event and an out-of-scope `length`.

**Coverage**

| Concept | E | P | A | D | T | Evidence |
|---|---|---|---|---|---|---|
| SV verification features (OOP, CRV, coverage, SVA) | 1 | 0 | 0 | 0 | 0 | F1C:32-61 |
| reg / wire / logic | 1 | 0 | 0 | 0 | 0 | F1C:82-88 |

**Accuracy**
- F1C:11 says SV unified Verilog "with verification features from Vera and e". `e` was not donated to SV; it became IEEE 1647. Donations were Superlog, OpenVera, OVA, DirectC and others. (S4)
- F1C:21 "Classes, Assertions, Coverage (from Vera)": SVA derives from OVA/PSL lineage, not Vera alone. (S4)
- F1C:87: "`logic` … cannot have multiple drivers — use `wire` for that."
  - Per §6.5 [LRM-verified], a variable can be written by **multiple procedural statements** (last write wins) **or** by one continuous assignment or port.
  - The precise rule: no multiple *continuous* drivers, and no mixing of continuous and procedural drivers.
  - The same imprecision recurs in F2A (see F2A-03).
  - (S3, High)

### F2A: Core Data Types (deep)

**Inventory**
- 281 lines.
- H2 sections: Quick Take, Build Your Mental Model, Deeper Understanding, Make It Work, Practice & Reinforce, Interview Questions, References.
- Interactives: `LogicStateDiagram`, `SignednessVisualizer`, `StringMethodExplorer`, `EnumMethodVisualizer`, `CurriculumDataTypeExplorer` (static lookup; F2A:196 calls it testing "against the simulator", which it is not), and `CurriculumDataTypeQuiz` (5 MCQs in `src/content/f2/dataTypeQuizQuestions.ts`).
- 5 interview Q&As. Flashcards `F2_Data_Types` (10, shared with F2B). Labs: none.
- 3 code fences, all snippets (no module wrapper), plus 1 ASCII decision tree.

**Coverage**

| Concept | E | P | A | D | T | Evidence |
|---|---|---|---|---|---|---|
| 4-state vs 2-state; X/Z → 0 on conversion | 2 | 1 | 0 | 1 | 0 | F2A:26-38, 229-235; the result is told, not predicted |
| `==` vs `===`, `$isunknown` | 2 | 1 | 0 | 1 | 0 | F2A:193, 251-262 (contains error F2A-04) |
| Nets vs variables; driver rules | 1 | 0 | 0 | 0 | 0 | F2A:44-65 (error F2A-03); no code |
| Net resolution (wire/wand/wor/trireg, strengths) | 1 | 0 | 0 | 0 | 0 | F2A:50-52, 187; no truth table or strength discussion |
| logic/wire/reg selection | 2 | 0 | 1 | 0 | 0 | F2A:67-82, 218-224 |
| Signedness and casting | 2 | 1 | 0 | 0 | 0 | F2A:96-108, 265-274 |
| Expression sizing / width extension / truncation | 0 | 0 | 0 | 0 | 0 | Absent: no context-determined width rules, no `'` sizing traps |
| Packed vs unpacked | 2 | 1 | 0 | 0 | 0 | F2A:110-130, 240-247 |
| Enums and `$cast` | 2 | 1 | 0 | 1 | 0 | F2A:138-147, 168-183 |
| X-optimism in `if`/`case` | 1 | 0 | 0 | 0 | 0 | F2A:151-166 table only (contains error F2A-05) |
| struct / union / typedef | 0 | 0 | 0 | 0 | 0 | Absent |
| Operators | 0 | 0 | 0 | 0 | 0 | Absent in all of T1 |

**Accuracy findings**

- **F2A-01 (S4, High).** Line 28 lists `shortreal` and `real` as 2-state types. Real types are not integral 2-state types; they default to 0.0 and are outside the 2/4-state classification of §6.11.2 [LRM-verified heading].
- **F2A-02 (S4, Medium).** Line 34 calls the initializer `8'hxx` "Uninitialized". It is explicitly initialized to X. Use an undriven DUT output instead.
- **F2A-03 (S2, High).** Line 60 says variables are "Written in `always_comb`/`always_ff` or class methods. Single driver, default to `'x`."
  - Per §6.5 [LRM-verified], variables can be written by one or more procedural statements, with the last write determining the value, or by one continuous assignment or port.
  - The single-writer restriction applies only to continuous assignment and to `always_comb`/`always_ff`/`always_latch`.
  - Default `'x` applies only to 4-state variables.
  - **Reinforced wrongly by quiz Q3** (`src/content/f2/dataTypeQuizQuestions.ts`, the third question). It grades "Two procedural blocks are driving the same signal with different values" as the cause of a signal stuck at X. Its explanation then recommends converting "to a net with deterministic arbitration".
  - Procedural multi-writes never produce X. Nets do not arbitrate deterministically; conflicts resolve to X.
  - **Correct statement:** a variable stuck at X after reset usually means a missing reset or assignment, X propagating from an input, or a net with conflicting continuous drivers.
- **F2A-04 (S3, High).** Line 256 says "any X/Z in either operand makes the entire comparison result X". Per §11.4.5 [LRM-verified], `==` yields X only when the relation is *ambiguous* because of X/Z; `4'b1x00 == 4'b0000` is 0. Line 193 says "always returns X"; same error. The conclusion that `if (sig == 'x)` is never true still holds.
- **F2A-05 (S3, High).** Line 159 labels `casex` as "X treated as don't-care (X-pessimistic in matching)". `casex` is **X-optimistic**: an X in the case expression matches any item. Also line 158, "`case (x_signal)` falls to default", is incomplete: `case` uses `===`-style matching, so an item containing a literal X matches.
- **F2A-06 (S3, Medium).** Line 130 says unpacked arrays "Cannot (without streaming `<<`)" be cast. §6.24.3, bit-stream casting [LRM-verified heading], explicitly applies type casting to unpacked arrays and structs.
- **F2A-07 (S4, High).** Wrong clause citations:
  - Line 170 cites `$cast` as §6.24.3; it is **§6.24.2**.
  - Line 96 cites "§6.8.1" for signedness; there is no variable subclause 6.8.1. Signedness is **§6.11.3**.
  - Line 280 lists "§6.11 (Type compatibility)"; type compatibility is **§6.22**.
  - Line 82's §6.11.2 for `logic` and line 32's §6.11 for X→0 are acceptable: §6.11.2 ends with the X/Z→0 rule.
- **F2A-08 (S4, Medium).** Lines 143-147, the enum base-type gotcha, is vague. The real trap is that the default base `int` is **2-state**, so an un-reset state variable initializes to the first literal and masks reset bugs.
- **F2A-09 (S2, High; quiz).** Quiz Q2 recommends `bit [15:0] count;` for a *synthesizable counter* "to keep the toolchain in the fast 2-state value system". This contradicts F2A's own decision tree (line 75: use `logic` in RTL). 2-state RTL hides missing-reset X. The quiz explanations' clause cites (§6.4, §6.10, §6.1) are also off.

**Code quality.** All F2A snippets are fragments. The `$cast` snippet is fine. Nothing here is a complete runnable example.

**Journey.** Strong on "why X matters". Weak on the rules a TB author applies daily: widths, signs, the expression evaluation context, and struct packing. The learner gets no chance to predict.

### F2B: Dynamic Data Structures (deep)

**Inventory**
- 300 lines.
- Interactives: `DynamicStructureVisualizer`, `QueueOperationLab`, `PackedUnpackedPlayground`, `SystemVerilog3DVisualizer` with deep links, `ArrayMethodExplorer`, `PacketSorterGame`.
- 4 interview Q&As; 0 quiz questions. Flashcards `F2_Data_Types` (shared).
- Lab `constructs-1` has `owningModule: F2B` but is not linked from the lesson.
- 4 code fences, all fragments. The scoreboard is a UVM class.

**Coverage**

| Concept | E | P | A | D | T | Evidence |
|---|---|---|---|---|---|---|
| Dynamic array alloc / resize / copy | 2 | 1 | 1 | 1 | 0 | F2B:86-107 (contains error F2B-01) |
| Queue ops and bounded queues | 2 | 0 | 1 | 0 | 0 | F2B:109-132, 222-223 (contains error F2B-02) |
| Associative array, scoreboard pattern, leak | 2 | 0 | 2 | 2 | 1 | F2B:134-164, 270-279 |
| Array methods (`with`, reductions, ordering) | 2 | 1 | 1 | 0 | 0 | F2B:166-190 |
| Structure selection | 2 | 0 | 0 | 0 | 1 | F2B:50-58, PacketSorterGame |
| Iteration and deletion traps (`foreach` + `delete`, handle aliasing in queues) | 0 | 0 | 0 | 0 | 0 | Absent; the spec asks for it |

**Accuracy findings**

- **F2B-01 (S3, High).** Line 97: `buffer = new[8](buffer); // buffer[4..7] = {0, 0, 0, 0}`. `buffer` is `logic [7:0] buffer[]`. Per §7.5.1 [LRM-verified text], new elements get the type's default value, which is **8'hxx** for a 4-state type.
- **F2B-02 (S3, High).** Line 223: "Pushing beyond the bound is implementation-defined". §7.10.5 [LRM-verified] defines it: any elements beyond the bound are discarded and a warning is issued. The trap to teach: `push_front` on a full bounded queue discards the *last* element.
- **F2B-03 (S4, High).** Line 211 says popping an empty queue is "not defined in the LRM". §7.10.2.x [LRM-verified] defines it: it returns the nonexistent-entry value, has no effect, and may warn.
- **F2B-04 (S4, Medium).** Line 287 says array methods apply to "all unpacked arrays". Ordering methods (`sort`, `rsort`, `shuffle`, `reverse`) are not allowed on associative arrays. Clause unverified for the exact wording.

**Code quality**
- F2B:138: `class scoreboard extends uvm_component;` has no constructor `new(string name, uvm_component parent)`. The implicit `new()` calling `super.new()` with no arguments will not compile against UVM 1800.2.
- F2B:142-144 logs DUPE and then overwrites the entry anyway.
- F2B:168-190: declarations with initializers (line 189 `int uniq[$] = …`) placed after statements in what reads as a procedural context. They are illegal inside a block (declarations must come first) and, if in a block, need `static`/`automatic` (§6.21). At module scope, `if` and method-call statements are illegal.
- F2B:119 uses `` `uvm_warning`` inside a free task.

None of this is labeled as pseudo-code. (S4)

### F2C: Procedural Code and Flow Control (deep; 2 files)

**Inventory**
- `index.mdx` (328 lines):
  - H2 sections: Quick Take, Build Your Mental Model, Forbidden Fruit `always_latch`, Make It Work, Push Further, Practice & Reinforce, Interview Questions, References.
  - Interactives: `ProceduralBlocksSimulator`, `EventRegionGame` (graded), `InteractiveCode`×2 (procedural constructs; sequence detector).
  - Quiz: 3 questions. 4 interview Q&As. 2 fences.
- `flow-control.mdx` (240 lines): `InteractiveCode` (traffic light), Quiz with 2 questions, 2 interview Q&As, 3 fences.
- Flashcards `F2C_Procedural_Constructs` (6) for both files.
- Labs: none linked. `common-1` has owningModule F2C but is not linked.
- Links: index → flow-control (absolute).

**Coverage**

| Concept | E | P | A | D | T | Evidence |
|---|---|---|---|---|---|---|
| initial / always / final semantics | 1 | 0 | 1 | 0 | 0 | index:12-32 (table wrong), 108-116 |
| Blocking vs NBA | 2 | 0 | 1 | 1 | 0 | index:37-64, 251-258 |
| `always_comb` / `always_ff` / `always_latch` | 2 | 0 | 2 | 1 | 0 | index:143-211, 317-326 |
| fork / join / join_any / join_none, `disable fork` | 2 | 0 | 1 | 1 | 0 | index:96-141, 261-281 (contains error F2C-03) |
| if / case / unique / priority / casez / casex | 2 | 0 | 1 | 1 | 0 | flow-control:14-73, 187-207 |
| Loops (`foreach`, `repeat`, `forever`) | 1 | 0 | 1 | 0 | 0 | flow-control:75-107 |
| X-optimism in control flow | 0 | 0 | 0 | 0 | 0 | Not in F2C (spec 2.4 asks for it; only the F2A table covers it) |

**Accuracy findings**

- **F2C-01 (S1, High).** index:27-32 region table:
  - "Postponed | `final`, `$strobe`, assertions" is wrong. `final` runs at end of simulation (§9.2.3), and concurrent assertions evaluate in Observed (§16.5).
  - The table also omits Preponed, Observed and Reactive without saying it is simplified.
  - The embedded `EventRegionGame` grades the same wrong answers (§2).
- **F2C-02 (S3, High).** Quiz Q1 (index:295-303) marks "Inside `initial` blocks for stimulus" as an incorrect place for `<=`. index:60 says to use NBA for "clock-driven stimulus", and F3C:66 recommends exactly NBA from an `initial` block. The quiz contradicts the race-avoidance technique.
- **F2C-03 (S2, High).** index:141 says "Always wrap targeted forks in a named `begin...end` block and disable the block name". index:280 says "explicitly disable named blocks".
  - Per §9.6.2 [LRM-verified], disabling a task or block disables **all activations**.
  - In class-based or reentrant code (UVM drivers, per-transaction timeouts), that kills other threads' instances.
  - The safe idiom is the isolation fork `fork begin fork … join_any; disable fork; end join`, which the answer at index:280 half-mentions.
  - index:134 `#100 disable stimulus;` is legal for a module-level static block but carries no caveat.
- **F2C-04 (S3, High).** flow-control:72-73, "`priority case`: Assumes sequential evaluation… First match wins". Plain `case` is also first-match. What `priority` *adds* is a violation report when no item matches (§12.5.3 [LRM-verified]). The lesson also never notes that a `default` item suppresses unique/priority no-match violations, though both examples include one (flow-control:64, 132), and it never mentions `unique0`.
- **F2C-05 (S3, High).** The join_none description (index:269) omits that spawned processes do not start until the parent blocks or terminates (§9.3.2 [LRM-verified]). This is the root of the classic `for (int i…) fork … join_none` capture bug, which is not taught anywhere in T1.
- **F2C-06 (S4).**
  - Quiz Q2 says "runs exactly once after time zero". `initial` starts *at* time zero, and `final` also runs exactly once.
  - index:215 suggests "Add assertions that fail if a sequential block uses `=`". Coding style is a lint concern, not an assertion.

**Code quality: race-prone TB code that is not labeled**
- index:92-106 (InteractiveCode): `clk` is declared but never toggled, so the monitor never prints. The stimulus uses `#5 d_in = $random;` with blocking assignment on a fixed delay grid. With any 10-unit clock, these coincide with posedges and race the `always_ff`.
- flow-control:103-106:
  ```
  task drive_bus;
    repeat (10) @(posedge clk); // Wait 10 cycles
    enable = 1;
  ```
  This blocking drive right after the edge races any DUT `always_ff @(posedge clk)` reading `enable`. (S2, High) It is the exact TB race F3C and F4C warn about, presented as a clean pattern.
- flow-control:100 says `forever #5 clk = ~clk; // 100MHz clock`. That holds only under a 1ns timescale, and none is declared. (S4)
- The sequence detector (index:167-204) is correct: an overlapping 101 Mealy detector with good default assignments.
- The traffic light is fine, but `priority case` with `default` demonstrates nothing about `priority`.
- The `explanationSteps` line ranges may be offset by the leading blank line in the code template. Unverified; visual check needed.

### F2D: Reusable Code and Parallelism (deep; 3 files)

**Inventory**
- `index.mdx` "System Tasks and File I/O" (159 lines): `LabLink basics-1`, `InteractiveCode` (file I/O), 2 interview Q&As, 0 quiz, 3 fences.
- `tasks-functions.mdx` (172 lines): 3 interview Q&As, Quiz with 2 questions, 3 fences.
- `ipc.mdx` (123 lines): `MailboxSemaphoreGame`, `Mailbox3D`, 2 interview Q&As, 0 quiz, 2 fences.
- Flashcards: `F2D_System_Tasks` (4), `F2D_Tasks_Functions` (3), `F2D_IPC` (4).
- Next links: index → tasks-functions and ipc; ipc → T2 I-SV-5.

**Coverage**

| Concept | E | P | A | D | T | Evidence |
|---|---|---|---|---|---|---|
| `$display` / `$strobe` / `$monitor` | 2 | 0 | 1 | 0 | 0 | index:18-31, 133-140 |
| File I/O | 1 | 0 | 1 | 1 | 0 | index:57-114 |
| `$urandom` / seeding / random stability | 1 | 0 | 0 | 0 | 0 | index:45-55; no seeding or stability |
| Task vs function | 2 | 0 | 1 | 0 | 0 | tf:9-42, 110-118 |
| static vs automatic lifetime | 2 | 1 | 0 | 1 | 0 | tf:44-87, 120-128 |
| Argument passing (ref, const ref, inout copy-out) | 2 | 0 | 1 | 0 | 0 | tf:89-101; inout copy semantics and default arguments absent |
| Mailbox / semaphore | 2 | 0 | 1 | 1 | 0 | ipc:26-88 |
| Named events, `wait fork`, `process` | 0 | 0 | 0 | 0 | 0 | Absent (T2 I-SV-5/events.mdx has events) |

**Accuracy and code findings**

- **F2D-01 (S3, High).** index:26 has `int val = 42;` inside `initial begin`. **Illegal:** §6.21 [LRM-verified] requires an explicit `static` or `automatic` keyword when a static block-local variable has an initializer. The LRM's own `top_illegal` example is this exact pattern. This is the very lifetime topic the module teaches.
- **F2D-02 (S4, High).** index:78 `$fatal("Could not open file!");` does not match the grammar `$fatal [ ( finish_number [, args] ) ]` (§20.10 grammar [LRM-verified]). Use `$fatal(1, "…")`.
- **F2D-03 (S4, Medium).** ipc:113 says `try_get()` "returns 1 (success) or 0". For a mailbox, it returns a positive integer on success, 0 if empty, and a negative value on type mismatch (clause unverified). That is correct for semaphores only.
- **F2D-04 (S4).** ipc:62-82: a `fork … join` with a `forever` consumer never completes. Fine for a demo, but unlabeled. It is also a missed Predict exercise: interleaving with bound 2.
- **F2D-05 (S3).** tf:12 and tf:47, "Always use automatic", lack nuance. `module automatic`/`program automatic`, explicitly static variables, and loop-variable automaticity go unmentioned. Ironically, the `drive_packet` example (tf:35-41) is itself a static task.
- **Structure (S3).** The folder is named "Reusable Code and Parallelism", but the parallelism (fork/join) lives in F2C. The index lesson is about system tasks. Ordering is index → ipc → tasks-functions (§3, T1-005).
- **Lab (S2).** See T1-004.

### F3A: Simulation Semantics (deep)

**Inventory**
- 145 lines. No interactives beyond Quiz (2 questions) and 2 interview Q&As.
- 3 fences: complete small modules.
- Flashcards `F3A_Simulation_Semantics` (4). Next → F3B (absolute `/index`).

**Coverage**

| Concept | E | P | A | D | T | Evidence |
|---|---|---|---|---|---|---|
| Event-driven simulation | 2 | 0 | 0 | 0 | 0 | F3A:16-35 |
| timescale, precision, rounding | 2 | 2 | 0 | 0 | 0 | F3A:37-50, 102-111, quiz 123-131 (the best Predict items in T1) |
| Delta cycles / time-slot iteration | 1 | 0 | 0 | 0 | 0 | F3A:52-71 (contains error F3A-01) |
| `#0` / Inactive | 1 | 0 | 0 | 0 | 0 | F3A:75 |

**Accuracy findings**

- **F3A-01 (S1, High).** Lines 62-69:
  ```
  q1 <= d;  // Delta cycle 1 (NBA region update)
  q2 <= q1; // Delta cycle 2 (subsequent evaluation triggered by q1 change)
  ```
  Both NBAs execute sequentially in the same process in one Active pass. The RHS `q1` is evaluated *before* any update, giving the old value (X), and both LHS updates land in the **same** NBA region. Nothing is "triggered by q1 change". The example teaches the opposite of NBA semantics in the lesson whose job is to define delta cycles.
  **Correct:** after the edge, `q1 == 1` and `q2 == x` (old `q1`). A delta-cycle example should use a chain such as `assign b = a; always @(b) c = b;`, or a gated or derived clock.
- **F3A-02 (S3, High).** Line 47: `$display("Time is %0t", $time); // 5500 (ps resolution)`. Per §20.3.1 [LRM-verified], `$time` returns an integer scaled to the module's time unit, so 5.5 becomes **6**. `%t` then prints it in the `$timeformat` units: 6000 with ps default units. To show 5500 you need `$realtime`. The LRM example shows exactly this rounding.
- **F3A-03 (S3, High).** Line 74: "use `$timeformat` and pass timescales via compiler directives to avoid compilation order bugs". `$timeformat` only affects `%t` display. The fix for timescale-order bugs is the `timeunit`/`timeprecision` declarations (§3.14.2.2 [LRM-verified]) or a tool-level default.
- **F3A-04 (S4).** Lines 23-33: `always @(a)` and `initial a = 0` at time 0 is a time-0 race (whether the `always` is waiting yet). This is unlabeled, and is a good Predict/Debug opportunity.

### F3B: Scheduling Regions (deep)

**Inventory**
- 121 lines. Interactive `SVSchedulerRegionVisualizer` (7 regions; normal and race scenarios).
- Quiz: 3 questions. 2 interview Q&As. **0 code fences.**
- Flashcards `F3B_Scheduling_Regions` (5), which are correct.
- Frontmatter `sources: IEEE 1800-2023`.

**Coverage**

| Concept | E | P | A | D | T | Evidence |
|---|---|---|---|---|---|---|
| Region order and purpose | 2 | 0 | 0 | 0 | 0 | F3B:21-31 (table does not render, T1-001) |
| NBA RHS/LHS regions | 2 | 1 | 0 | 0 | 0 | F3B:26-28, 61-69, quiz |
| Assertion sampling vs evaluation | 2 | 1 | 0 | 0 | 0 | F3B:25, 29, 71-79 |
| Reactive set (Reactive, Re-Inactive, Re-NBA); program code | 1 | 0 | 0 | 0 | 0 | F3B:30-34, 47 |
| Intra-region nondeterminism (§4.7) | 0 | 0 | 0 | 0 | 0 | Absent; contradicted at F3B:21 |
| Where class/UVM code actually runs (Active, started from a module `initial`) | 0 | 0 | 0 | 0 | 0 | Absent |

**Accuracy findings**

- **F3B-01 (S2, High).** Line 21: "SystemVerilog defines a strict order of execution within a single time step to prevent race conditions".
  - Region order is fixed, but per §4.7 [LRM-verified] events within a region are processed in any order, and statements may interleave.
  - That nondeterminism is *why* races exist.
  - Regions remove races only for disciplined patterns (NBA for sequential logic, Preponed sampling, Re-NBA drives).
- **F3B-02 (S3, High).** Line 15 lists 7 regions as "the" regions. Line 47 then mentions Re-NBA without defining it. The reactive set (Reactive, Re-Inactive, Re-NBA) per §4.4.1 [LRM-verified] is needed to explain clocking drives and program blocks.
- **F3B-03 (S3, Medium).** Line 34:
  - "guarantee zero race conditions" overclaims. Program code can still race with other program code, and a TB that drives without clocking blocks still races.
  - "this isolation is achieved purely via clocking block semantics and phasing" is wrong in part: phasing is coarse ordering and does nothing for same-time-step races.
  - It should state that UVM class code runs in the **Active** region set, because it is called from module `initial`.
- **F3B-04 (S4).** Line 47's Re-NBA is "a subset of the Reactive region". It is a separate region in the reactive region set.
- **F3B-05 (S4, design).** No code, no "what prints" exercise. The visualizer is a fixed animation; the learner cannot vary the code.

### F3C: Delta Cycles and Race Conditions (deep)

**Inventory**
- 133 lines. `Alert`, Quiz with 2 questions, 2 interview Q&As.
- 2 fences: complete modules, race and fixed versions.
- Flashcards `F3C_Delta_Cycles` (4).

**Coverage**

| Concept | E | P | A | D | T | Evidence |
|---|---|---|---|---|---|---|
| Two-`always` blocking race and the NBA fix | 2 | 1 | 1 | 1 | 0 | F3C:19-58 |
| TB↔DUT races (driving and sampling at the edge) | 1 | 0 | 0 | 0 | 0 | F3C:66 one sentence; no code |
| Derived/gated-clock delta races; continuous-assign chains | 0 | 0 | 0 | 0 | 0 | Absent |
| Write-write races, multiple NBAs to the same variable | 1 | 0 | 0 | 0 | 0 | F3C:69 (mislabelled) |
| Simulation/synthesis mismatch | 1 | 0 | 0 | 0 | 0 | F3C:95-101 (contains error F3C-01) |

**Accuracy findings**

- **F3C-01 (S2, High).** Line 99: `always @(posedge clk) begin q1=d; q2=q1; end` "might simulate as a single flop … or two flops (if execution order is reversed)".
  - Statements inside one sequential block **never** reorder (§9.3.1).
  - This always simulates as `q2 = d`, and synthesis infers the same: q2 is fed from d. There is no mismatch.
  - Real mismatch examples to use instead:
    - blocking assignments in *separate* `always` blocks (synthesis gives two flops; simulation is order-dependent)
    - incomplete sensitivity lists
    - `full_case`/`parallel_case` pragmas
    - X-optimism
    - delays and `initial` values
- **F3C-02 (S3, Medium).** Line 69 calls two `always` blocks NBA-writing one variable "a multiple-driver conflict". For variables, that is a last-write-wins race, not net resolution. With `always_ff` it is a compile error.
- **F3C-03 (S3).** Line 20 defines a race narrowly as two `always` blocks using blocking assignments. That omits TB↔DUT, write-write, time-0 initialization, `#0`, and derived-clock races.
- **F3C-04 (S4).** The Alert at line 61, "Using blocking assignments in `always_ff` … creates races", overgeneralizes. Block-local temporaries are fine.

### F4A: Modules and Packages (deep)

**Inventory**
- 222 lines.
- `Image` (`/visuals/rtl-testbench-blueprint.svg`), `InteractiveCode` (package + dut + tb_top, a near-complete program), Quiz with 2 questions, 2 interview Q&As.
- 3 more fences: macro, `ifdef`, scope snippets.
- Flashcards `F4A_Modules_and_Packages` (4).

**Coverage**

| Concept | E | P | A | D | T | Evidence |
|---|---|---|---|---|---|---|
| Packages for shared types/functions; import | 2 | 0 | 1 | 0 | 0 | F4A:31-115 |
| Wildcard vs explicit import and collision rules | 1 | 0 | 0 | 1 | 0 | F4A:179-187 (contains error F4A-01) |
| `` `include`` vs import; class-in-package type identity | 1 | 0 | 0 | 0 | 0 | F4A:168-177 (gap F4A-02) |
| Module ports, parameters, hierarchy | 1 | 0 | 1 | 0 | 0 | F4A:97-102 |
| Macros / `ifdef` / `$unit` / compile order | 1 | 0 | 0 | 0 | 0 | F4A:116-148 |
| `export`, package dependencies, `default_nettype`, `.*` connections, `generate` | 0 | 0 | 0 | 0 | 0 | Absent |

**Accuracy findings**

- **F4A-01 (S3, High).** Line 185: "If two packages define the same type name … and you wildcard import both, you get a collision."
  - Per §26.3 [LRM-verified], a wildcard import only makes names *potentially locally visible*.
  - It is an error only if an ambiguous name is actually *referenced* and no local or explicit-import binding exists.
  - Explicit imports and local declarations take precedence.
  - Learners will mis-diagnose real errors, and miss the subtler trap: referencing a wildcard-visible name and then declaring it locally is an error.
- **F4A-02 (S2, High).** Lines 174-175 describe `` `include`` as "used for macros and sometimes for splitting large modules". That misses the dominant TB use, `` `include``-ing class files *inside a package*. It also misses the classic bug: including the same class into two packages creates two distinct, incompatible types. Also missing: imports are not transitive (`export`).
- **F4A-03 (S4).**
  - The quiz option "allows you to use the struct in a clocking block" is a strange distractor.
  - Line 107: in a package, `parameter` behaves as `localparam`. Not mentioned.

**Code quality.** The InteractiveCode example is reasonable, but `ready` is never driven, so it stays X.

### F4B: Interfaces and Modports (deep)

**Inventory**
- 210 lines.
- `ModportExplorer` (static direction table for master/slave/monitor), `InteractiveCode` (interface + 2 modules), a mermaid fence (renders as code, T1-001), a virtual-interface class snippet.
- Quiz with 2 questions. 2 interview Q&As. Flashcards `F4B_Interfaces_and_Modports` (4).
- "Lab: Refactor a legacy testbench" (line 149) does not exist.

**Coverage**

| Concept | E | P | A | D | T | Evidence |
|---|---|---|---|---|---|---|
| Interface as a signal bundle (params, tasks, assertions) | 2 | 0 | 1 | 0 | 0 | F4B:29-54, 85-89 |
| Modport directions | 2 | 0 | 1 | 1 | 0 | F4B:38-53, 61, 91-95, ModportExplorer |
| Virtual interface: concept | 2 | 0 | 1 | 0 | 0 | F4B:97-135, 160-166 |
| Virtual interface: binding (`vif = top.if_inst`; config_db set/get), null-handle debug | 0 | 0 | 0 | 0 | 0 | Absent: handle is declared, never assigned |
| Clocking block in modport; interface instantiation and connection in top | 0 | 0 | 0 | 0 | 0 | Absent (step 3-4 text only, F4B:140-141) |

**Accuracy and code findings**

- **F4B-01 (S3, High). Deadlocked handshake taught as the example.** The master asserts `valid` only `if (bus.ready)` (lines 57-60). The slave asserts `ready` only `if (bus.valid)` (lines 67-70). `ready` starts at X, which evaluates false, so nothing ever happens. This is also the AXI/ready-valid anti-pattern: VALID must not wait for READY. It is unlabeled.
- **F4B-02 (S4, Medium).** Line 93, modports "Prevent accidental multiple drivers": modports restrict access through that port. Two modules on the same `master` modport can still both drive, and hierarchical access bypasses modports entirely.
- **F4B-03 (S2, High; gap).** The driver class (lines 122-134) drives `vif.valid <= 1` directly at `@(posedge vif.clk)`, with no clocking block. The lesson never shows how `vif` gets a value, so a null `vif` gives a run-time fatal. This is the bridge to F4C and UVM, and it is missing.
- §25.5 (modports) and §25.9 (virtual interfaces) are LRM-verified clause numbers. F4B cites 25.5 correctly.

### F4C: Synchronizing with Clocking and Program Blocks (deep)

**Inventory**
- 181 lines.
- One race-prone fence and one `InteractiveCode` (interface with `drv_cb`/`mon_cb` plus a module TB).
- Quiz with 2 questions. 3 interview Q&As. Flashcards `F4C_Clocking_Blocks` (4; 2 wrong).
- "The Race Condition Lab" (line 108) does not exist. Next → T2 I-SV-1.

**Coverage**

| Concept | E | P | A | D | T | Evidence |
|---|---|---|---|---|---|---|
| TB↔DUT race motivation | 1 | 0 | 0 | 0 | 0 | F4C:20-34 (contains error F4C-02) |
| Input skew / #1step sampling | 2 | 0 | 1 | 0 | 0 | F4C:37, 52, 81, 88, 120-125, 159-167 |
| Explicit `#0` input skew (Observed); nonzero skews | 0 | 0 | 0 | 0 | 0 | Absent |
| Output skew / drive maturation region | 1 | 0 | 1 | 0 | 0 | F4C:38, 89, 128-136 (contains error F4C-01) |
| `##N`, `default clocking`, `cb.sig <= ##N v` | 1 | 0 | 0 | 0 | 0 | F4C:90, 104; `default clocking` never shown |
| `@(cb)` vs `@(posedge clk)` timing (cb event in Observed) | 1 | 0 | 0 | 0 | 0 | F4C:101 only |
| Driver/monitor patterns through the clocking block (class + vif + cb) | 0 | 0 | 0 | 0 | 0 | Absent (the spec kata asks for it) |
| Program block semantics | 1 | 0 | 0 | 0 | 0 | F4C:92-95, 138-146 |

**Accuracy findings**

- **F4C-01 (S1, High).** Lines 38 and 134 (and flashcards 5 and 15) say drives go to NBA or Re-NBA "depending on whether the drive originated from an Active or Reactive region block". Per §14.16 [LRM-verified], synchronous drives always mature in **Re-NBA**. See §2.
- **F4C-02 (S2, High). The "race-prone testbench" at lines 25-33 is not racy.**
  - The DUT updates `q` with `q <= d`, so the update lands in the NBA region.
  - The TB's `always @(posedge clk)` runs in the Active region of the same time step and *deterministically* reads the old `q`.
  - The genuine races are TB **driving** DUT inputs with blocking assignments at the edge, DUT logic written with blocking assignments, and derived-clock delta skew.
  - Teaching a non-race as "the race" leaves learners unable to diagnose the real one. The bank entry `sv-clocking-block-race` repeats the misdiagnosis.
- **F4C-03 (S2, High).** Line 90, "`##N` waits for N clocking block events", and line 104. Per §14.11 [LRM-verified], `##` requires a default clocking or the compiler issues an error. `default clocking` is never taught or shown, so learners following this will hit compile errors.
- **F4C-04 (S2, High; gap).** Per §14.10 [LRM-verified], the clocking-block event `@(cb)` is triggered in the **Observed** region. Waiting on `@(posedge clk)` and then reading `cb` inputs, or mixing the two styles, is a classic bug. Line 101 says "Use `@(vif.cb)`" but never explains why.
- **F4C-05 (S3, Medium).**
  - Lines 93-95 and quiz Q2 (lines 170-178) say "UVM uses phases and clocking blocks to achieve the same isolation", and the quiz rewards "phasing handle[s] the race avoidance". Phasing is not a same-time-step race mechanism.
  - Line 14 calls program blocks a "legacy construct". They are not deprecated in IEEE; the recommendation is community practice.
- **F4C-06 (S3, Medium). Example code.**
  - `module testbench (memory_if vif)` names a *real* interface port `vif`, which blurs the virtual-interface concept just taught in F4B.
  - The drives at time 0 are issued before any clocking event. Per §14.16 they mature at the next clocking event plus skew. That subtlety goes unexplained.
  - The explanation (line 80) says the drive happens "2ns after clock". That is correct only after the first edge.
  - `output #2ns` uses a time literal and depends on time precision, which is not discussed.

**Journey.** This is where T1 should deliver "race-aware interface-based TB". It doesn't. There is no `default clocking`, no driver class using `vif.cb`, no monitor using `@(vif.cb)`, and no reset handling (asynchronous reset should not go through the cb). There is also no lab.

---

## 5. Learner-journey assessment

**Arc (F1 → F4C).** The arc is sensible: motivation, types, procedures, scheduling, structure, interfaces, timing.

**Where it breaks**

1. **F2C before F3.** F2C presents a wrong region table and a graded game that reinforces the error before F3B corrects it. F2C also teaches fork/join and `disable` before tasks are introduced (F2D). See T1-005.
2. **F2B, F2D and F4B lean on OOP/UVM syntax** (`uvm_component`, `` `uvm_error``, `$cast` on classes, `config_db`) that T1 never teaches.
3. **F3 is explanation-only.** F3B has no code at all. F3A's one delta example is wrong. F3C's one interview "mismatch" example is wrong. A learner cannot *predict* outcomes after F3. The scheduler visualizer is a fixed animation, not a sandbox.
4. **F4B → F4C bridge is missing.** Virtual-interface binding, clocking blocks in modports, and a driver/monitor written against `vif.cb` never appear. F4C's single example is a module TB with a real interface port.
5. **Depth hidden by simplified demos.**
   - The handshake demo deadlocks (F4B).
   - TB stimulus examples use blocking drives at the clock edge (F2C flow-control:103-106; basics-1 starter).
   - `$time` output is wrong (F3A).
   - `new[]` defaults are wrong (F2B).

   A learner who copies these patterns produces race-prone, X-hiding testbenches.
6. **No practice loop.** There are no katas and no T1 lab beyond `basics-1`, which is mis-graded. The quizzes are recall MCQs. Progress cannot be measured against outcomes 2–5 (predict, apply, debug, transfer).

**What a beginner can do after T1.** Explain why verification matters. Pick a data structure. Explain blocking vs NBA. Name the regions. Describe a clocking block.

**What they cannot do reliably.**
- Predict same-time-step behavior.
- Diagnose a real TB↔DUT race.
- Write `default clocking` / `##` / `@(cb)` code that compiles.
- Bind a virtual interface.
- Reason about widths, signs and operators.

---

## 6. T1-FOUNDATIONAL-UPGRADE spec status

Spec: `docs/planning/foundational-upgrade-spec.md`. `TASKS.md:14` lists it as P0 with status `todo`.

| Spec item | Status | Evidence |
|---|---|---|
| 6 visuals: FabRespinsVisualizer, NetResolutionSimulator, DynamicMemoryVisualizer, DeltaQueue3DVisualizer, RaceConditionDebugger, ClockingBlockSkewVisualizer | **0 / 6** | No files under `src/` and no references in `content/` |
| Katas (minimum 14: F1A 1, F2A 2, F2B 2, others 1 each) | **0** | No "Kata" heading in T1. F2C:232 and F2D:122 mention a "Code kata" in one line with no template |
| `content/interview-questions/foundational_systemverilog.json` (≥3 senior questions per module) | **Absent** | File does not exist. 42 `<details>` Q&As remain inline |
| LRM citation discipline (§1.1) | **Partial** | F2A, F2B, F2C/flow-control and F2D cite subclauses (some wrong, see F2A-07). F3A–F4C cite only clause level or §4. F1A and F1B have none. No technical subsection carries a per-statement citation in the spec's `_(IEEE 1800-2023 §x)_` format |
| Code-style normalization (§1.2) | **Mostly already true** | No `reg` declarations in T1 code; `always_ff`/`always_comb` are used in RTL examples; fences are `systemverilog`. Gaps: `always @(posedge clk)` in F3A, F3C and F4B (acceptable for TB/race demos but unlabeled); no "Code Style Note" block; one illegal initializer (F2D-01) |
| Module content enhancements | Mostly absent | F2A trireg/wand/wor mention exists (F2A:50-52, 187) but without a resolution table. F2A force/release kata absent. F2C X-optimism subsection absent. F2D tasks-vs-functions table absent. F4A collision example absent (and the existing answer is wrong). F4B modport pitfalls section absent |

**Problems in the spec itself** (fix before executing; S3)

Wrong clause numbers (checked against 1800-2023):

| Spec location | Cites | Correct clause |
|---|---|---|
| §2.2 | $cast at §6.24.3 | §6.24.2 |
| §2.2 | trireg at §6.7.3 | §6.6.4 |
| §2.4 | `if(x)` behavior at §11.4.5 | §12.4 (11.4.5 is equality operators) |
| §2.6 | delta queue at §9.3 | §4.4 (9.3 is block statements) |
| §2.7 | "Preponed vs Postponed" at §14.8 | §4.4.2 / §14.13 (14.8 is "Multiple clocking blocks example", LRM-verified) |

Other spec issues:
- §2.6's `DeltaQueue3DVisualizer` region list (Preponed, Active, Inactive, NBA, Postponed) omits Observed, Reactive and Re-NBA. That would ship another incomplete model.
- §7 gotcha "Delta cycle and region ordering (Preponed, Active, Inactive, NBA, Postponed)" has the same omission.
- The spec does not address any of the correctness defects in this report. It is additive only.

**§7 Senior-Level Gotcha checklist: actually taught?**

| Gotcha | Taught? | Evidence / quality |
|---|---|---|
| 2-state vs 4-state masking; `$isunknown`, `===` | **Yes (explain-level)** | F2A:31-38, 229-235; contains the `==` overstatement (F2A-04) |
| Net resolution wire/wand/wor; trireg | **Mention only** | F2A:50-52, 187; no truth table, strengths or example |
| `$cast` vs static cast; illegal enum values | **Yes** | F2A:168-183; F2D index:33-43 (wrong clause cite) |
| X-optimism in if/case; `unique case`, X-prop | **Shallow; contains error** | F2A:151-166 (casex mislabeled); nothing in F2C |
| Delta cycle and region ordering | **Present but defective** | F3A delta demo wrong; F2C table and game wrong; F3B mostly right |
| Races from mixing blocking/NBA; single-driver guidelines | **Present** | F2C:137-141, F3C:19-66; F3C:99 wrong; F2A:60 single-driver rule wrong |
| Clocking skew and race-free TB driver/monitor patterns | **Skew yes; patterns no** | F4C:37-90; drive region wrong; no driver/monitor pattern |
| Modport direction semantics and misuse | **Minimal** | F4B:61 one comment; F4B:93 overclaims |
| Array performance and iteration/deletion traps | **Performance yes; deletion traps no** | F2B:194-206; no `foreach`+`delete` or handle-aliasing trap |

---

## 7. Code-example quality register

| Location | Would it compile / run? | Issue | Labeled? | Severity |
|---|---|---|---|---|
| F1B:139 | No | `one_hot()` is undefined (`$onehot`); no clock | No | S4 |
| F1C:49-55 | Fragment | Covergroup has no sample event; `length` is out of scope | No | S4 |
| F2A:34-36, 97-100, 172-183 | Fragments | Fine as snippets | n/a | — |
| F2B:96-97 | Yes | Comment shows `0` where the value is X | — | S3 |
| F2B:117-128 | Needs `uvm_pkg` | `` `uvm_warning`` in a free task; acceptable | No | S4 |
| F2B:138-160 | **No** | No `new(name, parent)`; DUPE check then overwrite | No | S4 |
| F2B:170-189 | **No as written** | Declarations after statements; static initializers in a block need `static`/`automatic` | No | S4 |
| F2C index:71-110 | Compiles (as module items) | `clk` never toggles; blocking `$random` stimulus can race the FF | No | S3 |
| F2C index:122-135 | Yes | Named-block disable; safe only for static module code | Partly | S2 (advice) |
| F2C flow-control:103-106 | Yes | **Blocking drive right after `@(posedge clk)`**: TB race | No | S2 |
| F2C flow-control:116-166 | Yes | Pointless `priority case` + `default` | — | S4 |
| F2D index:25-30 | **No (LRM-illegal)** | `int val = 42;` inside `initial` (§6.21) | No | S3 |
| F2D index:70-98 | Yes (most tools) | `$fatal` without finish_number; `%s` into `int` hack (labeled) | Partly | S4 |
| F2D tf:35-41 | Yes | Static task in a lesson that says "always automatic"; uses NBA correctly | No | S4 |
| F2D ipc:62-82 | Yes | `join` never completes (forever consumer) | No | S4 |
| F3A:43-49 | Yes | Wrong expected output (`$time`) | — | S3 |
| F3A:56-70 | Yes | Wrong explanatory comments (NBA/delta) | — | S1 |
| F3C:23-57 | Yes | Correct race/fix pair | Yes | — |
| F4A:36-86 | Yes | `ready` undriven; otherwise a good small example | — | S4 |
| F4B:30-72 | Yes | **Deadlocked handshake**; VALID depends on READY | No | S3 |
| F4B:123-134 | Yes (needs the interface) | `vif` never assigned, giving a null-handle fatal at run time | No | S2 (gap) |
| F4C:26-33 | Yes | Labeled a race, but deterministic | Mislabeled | S2 |
| F4C:45-75 | Yes | Real interface port named `vif`; time-0 drives; no `default clocking` | No | S3 |
| labs/basics starter `tb_counter_unrefactored.sv` | Yes | Mixes `=`/`<=` on `data`; blocking drives at the edge | No | S2 |

Other notes:
- No T1 example declares `timescale` except F3A.
- None uses `` `default_nettype none``.

---

## 8. Recommended correction order with validation

1. **S1 scheduling cluster** (T1-002, F2C-01, F3A-01, F4C-01).
   - Fix `EventRegionGame` data, the F2C table, F3A:62-69, F4C:38 and F4C:134, F4C flashcards 5 and 15, the interview banks (`sv-scheduling-regions`, `sv-clocking-block-race`) and the SVA bank (line 14, `sva-past-sampling`).
   - **Validation:**
     - Add a vitest that loads EventRegionGame QUESTIONS and asserts `final` ∉ Postponed and assert ∈ Observed.
     - Add a content lint over `content/**` and `src/content/**` for the forbidden phrases.
     - Have a reviewer with a simulator run the F3A snippet and confirm `q2 === 1'bx` at the first edge.
2. **Rendering** (T1-001). Add `remark-gfm`. Run a Playwright check for `<table>` in F3B and F2A.
3. **S2 semantic defects**: F2A-03 plus quiz Q2/Q3, F2C-03, flow-control:103-106, F3C-01, F4C-02, F4C-03, F4A-02, F4B-03. Each fix needs a runnable snippet whose simulated log is checked in under `tests/sv_examples/` (the directory exists) and referenced from the lesson.
4. **Practice layer**: add Predict items, the "Race-free driver/monitor" kata (spec §2.11), and a real race lab replacing or fixing `basics-1`. Acceptance: the grader rejects blocking drives at the clock edge and requires `default clocking` plus `@(cb)`.
5. **Coverage gaps**: operators and expressions (wire up the existing `OperatorDrill`), structs and unions, events/`wait fork`/fork-in-loop, and `default_nettype`/port kinds.
6. **Then** execute the spec, after correcting its clause numbers and region model.
