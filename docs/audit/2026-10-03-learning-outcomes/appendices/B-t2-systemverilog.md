> **Provenance.** Area report produced during the 2026-10-03 learning-outcome audit by a read-only review agent, then reviewed by the lead auditor. Key claims were spot-checked against source, the running site, IEEE 1800-2023 (repo `system_verilog_lrm.pdf`), and Arm IHI0033 text. Line numbers refer to commit `488f7f43`. Items fixed in the same session are listed in [../audit-report.md](../audit-report.md) §9; everything else is open.

# T2 SystemVerilog modules (I-SV-1 … I-SV-9): educational and technical audit

Repo `main @ 488f7f43`. Read-only audit, 2026-10-03.
Scope: all 32 `.mdx` files under `content/curriculum/T2_Intermediate/I-SV-*` (3,645 lines), plus the interactives, flashcard decks and labs they use.

**Method.**
- Read every MDX line by line.
- Grepped the concept keywords across T1, T2, T3 and T4.
- Read the source of every interactive and lab used here.
- Checked rendering on the already-running local production server (`http://localhost:3100`, from `test-results/learning-audit/server.log`). I only read pages and ran JS inspection. The one click was on an answer button, which saves nothing.
- Ran an MDX 2.3 compile probe that copies the `InteractiveCode` extraction logic. To resolve `node_modules` I put a copy of the probe script in the repo root for a few seconds and then deleted it; `git status` shows nothing left behind. The original is at `scratchpad/audit/probe/ic.mjs`.
- No repository file was changed.

**What I could not check.**
- I do not have the IEEE PDFs. My clause-number comments come from memory of the IEEE 1800-2017 numbering, which 1800-2023 mostly keeps. They are marked **"clause unverified"**.
- Statements about normative semantics are rated High or Medium confidence from expert knowledge.

**Rating key for the concept tables:** 0 = absent, 1 = present but shallow, flawed or unassessed, 2 = substantive and correct.
- **E** (Explain): the mechanism is explained.
- **P** (Predict): the learner is asked to predict an outcome and gets feedback.
- **A** (Apply-in-code): the learner must write or modify code.
- **D** (Debug-misuse): the learner diagnoses broken code.
- **T** (Transfer): the learner uses the concept in an unfamiliar context.

> **Global modifier.** The tables rate what is *authored*. On the live site, any evidence that sits in an `<InteractiveCode>` block or an MDX `<InterviewQuestionPlayground>` currently delivers nothing (findings X-01 and X-02). Treat those cells as **0 effective** until X-01 and X-02 are fixed.

---

## 0. Executive summary

The T2 SV track is a set of short concept pages with name-level coverage of most topics. Learners cannot currently become independently competent from it, for three reasons.

1. **The two main teaching devices are broken on the live site. Confirmed in the browser.**
   - Every `<InteractiveCode>` block (37 of the curriculum's 55; 21 of the 32 T2 SV files) shows either the literal text `[object Object]` or an empty editor. As a result, the OOP, randomization, coverage, SVA and IPC lessons show almost no code.
   - All 21 MDX `<InterviewQuestionPlayground>` questions in the curriculum (all of them in T2 SV) show blank answer buttons, and Submit stays disabled.
   - 10 of the 11 flashcard deck IDs in the T2 SV frontmatter do not resolve. Learners see "No flashcards available…". Only `I-SV-1_OOP` works.
2. **Several normative errors would teach wrong mental models (S1/S2).** The main ones:
   - `->>` described as making an event "persist".
   - SVA local variables "can be declared `static`".
   - Assertion examples that assert a bare sequence, so they fail on every cycle where the trigger is low.
   - Imported DPI tasks described as able to "block on I/O while the simulator schedules other SV processes".
   - Constraint implication "evaluates A first".
   - Rand variables "unsigned by default".
   - `storage s;` called a syntax error.
   - `type_option.auto_bin_max`, which does not compile.
   - An invented covergroup `find()` method.
   - The C API `svGetIntElement`, which does not exist.
   - "genvar is illegal inside an always block".
3. **No graded practice anywhere in T2 SV.**
   - Three labs are linked (2B, 3B, 5). All are `self_attested`.
   - The 2B lab's premise is wrong: `randomize()` never fails, IPV6 is just never generated.
   - The 3B lab's instructions cannot reach the stated 100%.
   - The 5 lab's bug triggers only on some seeds, and its source is read-only.
   - The I-SV-1 and I-SV-4A labs are `coming_soon`.
   - There is no exercise to write a constrained transaction, write a covergroup tied to a plan, or write and debug a handshake SVA with reset.

Coverage gaps a working verification engineer would hit at once:
- Static class members, object lifetime and null handles, `typedef class`, interface classes.
- `dist :=` vs `:/` (used but never explained), `unique`, array `sum()` width pitfalls, `srandom` and random-stability APIs.
- Coverage: auto / wildcard / transition bins, sampling-time semantics.
- SVA: sampled-value functions (`$rose/$fell/$stable/$past`), repetition operators, `throughout/within/intersect`, vacuity, `disable iff` semantics, `assume`.
- `fork/join_any/wait fork/disable fork/process`.
- DPI `svScope`, `extern "C"`, output-argument pointers.

### Module summary

| Module | Depth (1-5) | Strongest competency | Biggest gap | Severity |
|---|---|---|---|---|
| I-SV-1 OOP | 2 | Explaining virtual vs non-virtual dispatch and `$cast` (polymorphism-pitfalls.mdx:17-77) | No static members, object lifetime, `typedef class` or interface classes; no polymorphic `copy`/`clone` pattern; wrong answer on default specialization; no code-writing practice | S2 |
| I-SV-2A Rand fundamentals | 2 | Soft constraint vs inline hard override (constraint-blocks.mdx:30-45; index.mdx:162-167) | `dist :=` vs `:/` never explained; solve-before described three contradictory ways | S2 |
| I-SV-2B Advanced rand | 2.5 | Randomize-failure triage (solver-debug.mdx:15-73) | Implication "evaluates A first" is wrong; "rand unsigned by default" is wrong; random-stability model is misleading; lab premise is wrong | S2 |
| I-SV-3A Coverage fundamentals | 2 | Covergroup anatomy and `iff` gating (index.mdx:33-64) | Bin semantics (auto, array, wildcard, transition, default) and sampling semantics absent; `type_option.auto_bin_max` does not compile; invented `find()` | S2 |
| I-SV-3B Advanced coverage | 2 | Closure-loop narrative (closure-workflow.mdx:22-32) | `per_instance=1` never presented as required for per-instance data; UVM code before UVM is taught; lab cannot close as instructed | S3 |
| I-SV-4A SVA fundamentals | 1.5 | `|->` vs `|=>` (index.mdx:46; working TemporalLogicExplorer) | No sampled-value functions, repetition, vacuity, `disable iff` semantics or deferred assertions (except inside a broken widget); lab is coming_soon | S1 |
| I-SV-4B Advanced temporal | 1.5 | Concept of per-attempt local variables (local-variables.mdx:17-38) | Both main examples assert a bare sequence (fail every idle cycle); "static local variables" is false; `##0` "without advancing time" is false | S1 |
| I-SV-4C Checkers & bind | 2 | Bind mechanics and scope resolution (index.mdx:55-111) | Checker restrictions misstated (always_ff/assign); no assessment or exercise; Next link goes back to I-SV-3A | S2 |
| I-SV-5 Sync & IPC | 2.5 | Semaphore key-leak and deadlock reasoning (semaphores.mdx:48-56 plus lab) | `->>` "persistence" is wrong (events.mdx:25,45,66); no fork/join_any/wait fork/process; no mailbox handle-aliasing pitfall | S1 |
| I-SV-6 Directives & generate | 3 | Macro hygiene; generate vs runtime (index.mdx:88-160) | "genvar illegal in always" is wrong; bind-in-generate example is broken; `` `timescale `` "for the file"; no assessment | S2 |
| I-SV-7 DPI | 2.5 | Import/export, type table, `svLogicVecVal` encoding (index.mdx:16-143) | DPI task timing semantics wrong (index.mdx:170-183,218); nonexistent `svGetIntElement`; no `svScope` or `extern "C"`; no assessment | S1 |
| I-SV-8 UPF | 1.5 | UPF vocabulary: domains, isolation, retention, switch (index.mdx:27-188) | No SV-side power-aware verification, no exercise or quiz; PST mixes UPF 1.0 nets with 2.x supply-set states; odd placement in the tier | S3 |
| I-SV-9 Why UVM | 2 (intro) | Motivation for UVM's four pillars (index.mdx:134-183) | No bridging build (a class-based layered SV testbench); readiness for I-UVM-1A never checked; UVM's first IEEE date wrong | S3 |

---

## 1. Cross-cutting findings

### X-01 — `<InteractiveCode>` shows `[object Object]` or nothing. Every T2 SV code example is invisible.
- **Category:** Confirmed defect. **Severity:** S1. **Confidence:** High (verified on the live site and in the compile probe).
- **Evidence.**
  - `src/components/ui/InteractiveCode.tsx:318-334` pulls code out of `children` only when `child.props.mdxType === 'pre'`. MDX 2 (here `@mdx-js/mdx` 2.3.0 via `next-mdx-remote` 4.4.1) no longer sets `mdxType`. The `else` branch then joins a React element into a string, which gives `"[object Object]"`.
  - The component has no `code` prop (`InteractiveCodeProps`, lines 122-131). The 11 `code={`…`}` usages therefore render an empty editor.
  - Live checks:
    - `/curriculum/T2_Intermediate/I-SV-1_OOP/index`: 3 editors, each showing `[object Object]`.
    - `…/I-SV-2A…/constraint-blocks`: 3 empty editors.
    - `…/I-SV-4B…/local-variables`: `[object Object]` (screenshot taken).
    - `…/I-SV-2B…/advanced-constraints`: the article text has no code at all, only a "Metrics / Timing: 0 ns estimated latency" panel.
  - Affected T2 SV files and block counts:
    - I-SV-1: index ×3, constructors ×2, copying-and-cloning ×3, parameterized-classes ×2, polymorphism-pitfalls ×2.
    - I-SV-2A: index ×2, constraint-blocks ×3 (code prop).
    - I-SV-2B: advanced-constraints ×2, controlling-randomization ×1, randomization-methods ×2, solver-debug ×1 (all code prop).
    - I-SV-3A: index ×2, coverage-options ×1.
    - I-SV-3B: coverage-apis ×1 (code prop), linking-coverage ×1.
    - I-SV-4A: index ×1, immediate-vs-concurrent ×2.
    - I-SV-4B: local-variables ×1, multi-clocking ×2.
    - I-SV-5: events, mailboxes, semaphores ×1 each.
    - Total: 37 blocks.
  - The component also attaches unrelated "analysis" (`InteractiveCode.tsx:240-296`): "Avoid using # delays for synthesizable code", "fork...join detected", "Timing: N ns estimated latency". Every testbench example triggers it.
- **Learner consequence:** the core lessons have no readable code. I-SV-2B advanced-constraints, controlling-randomization and constraint-blocks show only prose. The heuristic panel adds misleading RTL-style warnings.
- **Fix:**
  - Extract code by walking to the innermost `code` element's string children, without relying on `mdxType`.
  - Add a `code` prop.
  - Remove or gate the pseudo-metrics.
- **Status note (end of audit).** `git status` now shows uncommitted changes I did not make, from another session or the user:
  - `src/components/ui/InteractiveCode.tsx` has a new recursive `extractCodeText`, a `code` prop, and the heuristic panel turned off by default (`showHeuristicAnalysis = false`).
  - `page.tsx`, `globals.css`, `package.json` and new visual files are also modified or added.
  - The defect is confirmed for HEAD `488f7f43` and for the running `:3100` build. Re-check after that work lands.
- **Acceptance:** every `<InteractiveCode>` in `content/curriculum/**` renders its source verbatim.
- **Validation:**
  - A Vitest component test renders an MDX-compiled fenced block and a `code=` block and asserts the Monaco value equals the source.
  - A Playwright check over all lesson routes asserts no `[object Object]` and no empty `.view-lines` inside `[data-testid=interactive-code]`.

### X-02 — Every MDX `<InterviewQuestionPlayground>` has blank options and cannot be submitted
- **Category:** Confirmed defect. **Severity:** S1. **Confidence:** High (live).
- **Evidence.**
  - The component expects `options: {id, label, isCorrect, explanation}` (`src/components/curriculum/interactives/InterviewQuestionPlayground.tsx:7-12`).
  - All 21 MDX call sites pass `{text, isCorrect, feedback}` with no `id`. Example: `I-SV-1_OOP/polymorphism-pitfalls.mdx:88-93`.
  - Live on `polymorphism-pitfalls`: four buttons with empty text. After clicking one, `Submit Answer` stays `disabled`, because `selectedId` is `undefined`.
  - The two playgrounds embedded *inside* components (ConstraintSolverVisualizer, TemporalLogicExplorer) use the right schema and work.
- **Learner consequence:** the "Interview Pitfall" questions carry most of the module's predict and debug content (defaults on virtual methods, missing `virtual`, deferred assertions, the `->` race, lost semaphore key, silent randomize failure, and more). None of it can be reached.
- **Fix:** normalise the props in the MDX registry with a wrapper that maps `text→label`, `feedback→explanation` and an index to `id`, or migrate the content. Add a schema check to `scripts/` validation.
- **Acceptance:** all 21 instances show their option text, accept a submission and show feedback.
- **Validation:** a Playwright test per T2 SV page picks the correct option and asserts the success state. A unit test covers the prop mapper.

### X-03 — 10 of 11 T2 SV flashcard deck IDs do not resolve; the existing decks are thin
- **Category:** Confirmed defect. **Severity:** S3. **Confidence:** High.
- **Evidence.**
  - `src/lib/flashcard-decks.ts:76-79` registers only `I-SV-1_OOP`, `I-SV-2_Constrained_Randomization`, `I-SV-3_Functional_Coverage` and `I-SV-4_Assertions_SVA`.
  - Frontmatter asks for `I-SV-2A_…`, `I-SV-2B_…`, `I-SV-3A_…`, `I-SV-3B_…`, `I-SV-4A_Assertions_SVA_Fundamentals`, `I-SV-4B_Advanced_SVA`, `I-SV-4C_Checkers_and_Bind`, `I-SV-5_…`, `I-SV-6_…` and `I-SV-7_…`. The widget then shows "No flashcards available or component loading..." (`FlashcardWidget.tsx:62-66`).
  - I-SV-8 and I-SV-9 declare no deck.
  - The four existing decks hold 17 cards in total, all recall-level.
  - `I-SV-4_Assertions_SVA.json` says assertions live in "checker classes", which is misleading: checkers are not classes.
- **Fix:** add the alias mappings or rename the frontmatter. Add predict and debug cards (for example "What prints?" or "Why does this assertion fail every cycle?").
- **Acceptance:** each T2 SV module resolves to a deck of 8 or more cards that includes at least 3 predict/debug cards.
- **Validation:** a script asserts every `flashcards:` frontmatter ID exists in `flashcardDecks`.

### X-04 — In-content "Next" links contradict the canonical order and skip modules
- **Category:** Confirmed defect. **Severity:** S2. **Confidence:** High.
- **Evidence.** The generated navigation (`src/lib/curriculum-data.tsx:193-430`) runs linearly I-SV-1 → … → I-SV-9 → I-UVM-1A. The authored "Next" links say otherwise:
  - `I-SV-4B/index.mdx:23` → I-UVM-1A, skipping 4C and 5-9.
  - `I-SV-4C/index.mdx:117` → "I-SV-3A … or I-UVM-1A", backwards.
  - `I-SV-5/index.mdx:28` → I-SV-4A, backwards.
  - `I-SV-6/index.mdx:261` → I-SV-4A or I-UVM-1A, skipping 7-9.
  - `I-SV-7/index.mdx:259` → T4 `E-INT-1`, skipping 8-9.
  - `I-SV-8/index.mdx` has no Next link.
  - `I-SV-3B/index.mdx` lists sub-lessons as linking → APIs → closure, but the nav order is closure → APIs → linking.
- **Fix:** generate the Next links from `curriculum-data`, or correct them by hand.
- **Acceptance:** every module's Next link matches `findPrevNextTopics`.
- **Validation:** a Vitest test parses the "Next:" links in each `index.mdx` and compares them with the navigation.

### X-05 — No graded practice; the labs are self-attested and partly unsound
- **Category:** Missing coverage plus Interaction/design weakness. **Severity:** S1 for the outcome "independently build testbenches". **Confidence:** High.
- **Evidence.**
  - Only three labs are linked from T2 SV, and every step is `"completion": "self_attested"`:
    - `labs/randomization_advanced/lab1_dependent_fields/lab.json`
    - `labs/coverage_advanced/lab1_closure_loop/lab.json`
    - `labs/ipc_deadlock/lab.json`
  - `fifo-1` (owner I-SV-1) and `assertions-1` (owner I-SV-4A) are `coming_soon`.
  - These "Mini-lab" / "Lab prompt" / "Micro-lab" lines are text only, with nothing behind them:
    - I-SV-1 index.mdx:130
    - I-SV-2A index.mdx:121
    - I-SV-3A index.mdx:122
    - I-SV-4A index.mdx:70
  - No lab exists for I-SV-4B, 4C, 6, 7, 8 or 9.
  - The quizzes total 29 MCQs, almost all recall.
  - The "Teach it back" widget needs sign-in and a configured AI backend (`src/app/api/ai/feynman-feedback/route.ts` returns 401/503 otherwise). It is a prototype or gated, not a dependable feedback loop.
- **Learner consequence:** nobody writes a constrained transaction, a covergroup tied to a plan, or a reset-aware handshake SVA, and nobody gets machine feedback. Progress from guided to independent work does not exist.
- **Fix:** see section 4.

### X-06 — Example code relies on implicitly static variable initializers in procedural blocks
- **Category:** Confirmed defect (portability). **Severity:** S3. **Confidence:** Medium-High.
- **Evidence:**
  - `I-SV-1/index.mdx:51` `BasePacket pkt1 = new();` inside `initial begin` of a non-automatic `program`.
  - The same pattern appears at `constructors.mdx:37,82`, `2A/index.mdx:61`, `solver-debug.mdx:35`, `coverage-options.mdx:58` and `labs/coverage_advanced/lab1_closure_loop/testbench.sv:3`.
  - IEEE 1800 requires an explicit `static` or `automatic` on a static variable declared with an initializer inside a procedural block (clause unverified). Questa warns (vlog-2244) and some flows treat it as an error.
- **Learner consequence:** copying the examples gives warnings or errors, and the static-vs-automatic lifetime rule is never taught.
- **Fix:** declare the handle and then `pkt1 = new();`, or use `program automatic`. Add one paragraph on lifetimes.

### X-07 — `assert(obj.randomize())` used as an idiom with no warning
- **Category:** Unverified concern (good-practice gap). **Severity:** S3. **Confidence:** Medium-High.
- **Evidence:** `advanced-constraints.mdx:36`, `controlling-randomization.mdx:43`, `I-SV-9/index.mdx:178`.
- **Learner consequence:** when assertions are turned off (`$assertoff`, or the tool's assertion-disable switch), the immediate assertion is not evaluated, so `randomize()` never runs. This is a well-known silent-stimulus bug and it contradicts the solver-debug lesson.
- **Fix:** use `if (!obj.randomize()) \`uvm_fatal/…` or `$fatal`, and add a pitfall note.

### X-08 — Clause citations are inconsistent and several look wrong
- **Category:** Unverified concern. **Severity:** S4. **Confidence:** Medium (clause numbers unverified against 1800-2023).
- **Evidence.** Under 1800-2017 numbering:
  - `constructors.mdx:16` "8.15: Object initialization": 8.15 is *super*; constructors are 8.7.
  - `copying-and-cloning.mdx:15` "8.16: Object assignment and copying": copying is 8.12; 8.16 is casting.
  - `parameterized-classes.mdx:40` cites "8.20 Virtual methods" for abstract classes, which are 8.21.
  - `controlling-randomization.mdx:17` "18.11 pre/post_randomize": these are 18.6.2.
  - `randomization-methods.mdx:17` "18.16 randcase/randsequence": randsequence is 18.17.
  - `immediate-vs-concurrent.mdx:16` "16.4 Concurrent": 16.4 is deferred assertions.
  - `multi-clocking.mdx:15` "16.12 Disable iff": 16.12 is declaring properties.
  - The interactive `ConstraintSolverExplorer.tsx:161-162` labels soft constraints "18.5.10" and solve-before "18.5.11". Those are variable ordering (18.5.10) and static constraint blocks (18.5.11); soft constraints are 18.5.14.
  - I-SV-4C, 6 and 7 cite 1800-2017; the other modules cite 1800-2023.
- **Fix:** check every citation against the 1800-2023 PDF, or drop the sub-clause numbers.

### X-09 — Lesson metadata and titles are mislabeled
- **Severity:** S4. **Confidence:** High.
- **Evidence:**
  - Sub-lesson titles carry an "| Advanced SystemVerilog for Verification" or "| Advanced UVM Techniques & Strategy" suffix (coverage-options.mdx:5, linking-coverage.mdx:5). The suffix shows in navigation (curriculum-data.tsx:280,307).
  - `coverage-options.mdx:11` and `linking-coverage.mdx:11` use `uvm_concept_tags`.
  - `I-SV-1/index.mdx:137` misspells "Typesasting".
  - `I-SV-1/index.mdx:21` points to the non-existent `F2A_Data_Types_and_Arrays`; the T1 folder is `F2A_Core_Data_Types`.
  - `I-SV-8` has `order: 8` and a duplicate H1 (line 7).

---

## 2. Per-module audit

### I-SV-1 OOP (5 files, 610 lines)

**Inventory**

| File | H2 structure | Components | Assessment | Code |
|---|---|---|---|---|
| index.mdx | Quick Take(9) · Build Your Mental Model(23) · Make It Work(111) · Push Further(122) · Practice & Reinforce(127) · Deep Dives(133) · References & Next(139) | Image(26), InteractiveCode ×3 (37, 61, 80) | Quiz 2 Q (145-170, recall); IQP missing-`virtual` (173-181) | 38-56 complete program; 62-75 and 81-106 class-only snippets |
| constructors.mdx | Constructors(15) · Using `this`(44) · Calling the Parent with `super`(50) · Common Pitfalls(89) · Quiz(94) | InfoPage; IC ×2 (22, 56) | Quiz 1 Q (96); IQP implicit `super.new` (110-118) | 2 complete programs |
| copying-and-cloning.mdx | Assignment vs Copying(14) · Shallow(33) · Deep/`copy()`(57) · `clone()`(83) · Interview Pitfall(94) | IC ×3 (19, 37, 60); plain fence 86 | IQP shared mailbox (96-104) | Snippets only (top-level statements outside a module) |
| parameterized-classes.mdx | Parameterized(16) · Abstract(39) · Common Pitfalls(69) · Quiz(76) | IC ×2 (22, 46) | Quiz 1 Q (78); IQP default specialization (92-100) — **wrong key** | 1 snippet, 1 program |
| polymorphism-pitfalls.mdx | Method Resolution(14) · Up/Downcasting(46) · Interview Pitfall: Default Virtual Arguments(80) | IC ×2 (21, 60); fence 51 | IQP default args (86-94) | 1 program, snippets |

- Flashcards `I-SV-1_OOP` resolves (4 cards).
- Labs: none. `fifo-1` is coming_soon and covers FIFO RTL, not OOP.
- Prev: T1 F4C. Next: I-SV-2A (index.mdx:143).

**Concept coverage**

| Concept | E | P | A | D | T | Justification |
|---|---|---|---|---|---|---|
| Class / object / handle | 1 | 0 | 0 | 0 | 0 | index.mdx:18 claims a T1 refresh that T1 never taught (T1 has only a preview class at F1C:40). The handle model appears only in copying-and-cloning.mdx:17-29 |
| Handle assignment vs object copy | 2 | 1 | 0 | 1 | 1 | copying-and-cloning.mdx:17-29 (prints 20); IQP 96-104 (shared mailbox, a good transfer case, but broken by X-02) |
| Shallow / deep copy | 2 | 1 | 0 | 1 | 0 | copying-and-cloning.mdx:33-81 |
| `clone()` / polymorphic copy | 1 | 0 | 0 | 0 | 0 | copying-and-cloning.mdx:83-92 says clone "ensure[s] the correct derived type is instantiated", but the snippet does `Packet p = new();` (base type). No virtual `copy` with `$cast`, no `do_copy` |
| Object lifetime / GC / null handle | 0 | 0 | 0 | 0 | 0 | Only constructors.mdx:92 ("Using `this` on a null handle", which is itself wrong) |
| Static properties / methods | 0 | 0 | 0 | 0 | 0 | No occurrence. UVM `type_id::create` and the singleton depend on this |
| Inheritance / `super` | 2 | 1 | 0 | 1 | 0 | constructors.mdx:50-87; IQP 110-118; pitfall 91 contradicts it (M1-03) |
| Virtual methods / polymorphism | 2 | 1 | 0 | 1 | 0 | polymorphism-pitfalls.mdx:17-44 (comments give outputs); index IQP 173-181 |
| Abstract / pure virtual | 1 | 0 | 0 | 0 | 0 | parameterized-classes.mdx:39-74 (M1-02) |
| `$cast` downcast | 2 | 1 | 0 | 0 | 0 | polymorphism-pitfalls.mdx:55-77 |
| Parameterized classes / specialization | 1 | 1✗ | 0 | 0 | 0 | parameterized-classes.mdx:19-36. The predict item (92-99) has the wrong answer key (M1-01). Static-per-specialization and `#()` with `::` not covered |
| `typedef class` / forward declaration | 0 | 0 | 0 | 0 | 0 | — |
| Interface classes (`implements`) | 0 | 0 | 0 | 0 | 0 | — |
| Encapsulation `local` / `protected` | 1 | 0 | 0 | 0 | 0 | index.mdx:60-77 (`protected` named, never shown); quiz 147-157 |

**Technical accuracy**

- **M1-01 (S2, High) — wrong answer key.**
  - Location: `parameterized-classes.mdx:97-98`.
  - Quoted text: *"It fails to compile. To use default parameters, you must write `storage #() s;`"* (marked correct) and *"Writing `storage s;` is a syntax error."*
  - Correction: a parameterized class name used without a parameter list refers to the **default specialization**, so `storage s;` declares a `storage#(int)` handle. The LRM's own example is `typedef vector my_vector; // use default size of 1` (clause unverified). The explicit `#()` is needed only with the scope operator (`C#()::member`) to name the default specialization from outside the class.
  - Option 4 ("compiles and `s` is `storage #(int)`") is the correct one.
- **M1-02 (S3, High) — what makes a class abstract.**
  - Location: `parameterized-classes.mdx:42` *"A class with a `pure virtual` method or declared with the `virtual` keyword is abstract"* and line 49 `pure virtual task run(); // makes the class abstract`.
  - Correction: only `virtual class` makes a class abstract. A `pure virtual` prototype is *only legal inside* a `virtual class`, so a non-virtual class with one is a compile error.
- **M1-03 (S2, High) — the lesson contradicts itself on `super.new()`.**
  - Location: `constructors.mdx:91` *"Forgetting to call `super.new()` leaves base-class members uninitialized."* The page's own IQP (line 115) correctly says the compiler inserts an implicit `super.new()`.
  - Correction: an implicit argument-less `super.new()` runs first. The real pitfall is that this fails to compile when the base constructor has required arguments, or that you silently get the base defaults.
  - Line 92 *"Using `this` on a null handle causes a runtime error"*: `this` is never null inside a method. The actual pitfall is calling a method or accessing a member through a null handle.
- **M1-04 (S3, Medium) — default arguments on virtual methods.**
  - Location: `polymorphism-pitfalls.mdx:84` *"SystemVerilog resolves default arguments based on the **handle type**, even for virtual methods!"* and feedback line 90 *"default arguments are evaluated at compile time"*.
  - Correction: IEEE 1800 says overrides need not have matching default expressions, but the presence of a default must match (clause unverified). Default expressions are evaluated **at each call**, in the declaring scope, not "at compile time". Which override's default applies in a polymorphic call is, to my knowledge, not clearly specified, and tools may differ. This is C++ semantics presented as normative SV.
  - Recommendation: reframe as "avoid differing defaults; behaviour is tool-dependent", or cite and verify.
- **M1-05 (S2, High) — clone pattern contradicts its own claim.** `copying-and-cloning.mdx:84-91`. The prose promises derived-type-correct cloning, but the code builds a base object and `copy()` is non-virtual. Missing:
  - a virtual `copy(Base rhs)` with `$cast` in the derived class;
  - the derived class calling `super.copy`;
  - null-handle guarding (`this.hdr.copy(rhs.hdr)` crashes if `hdr` is null).
  - This is exactly the pattern I-UVM `do_copy` relies on.

**Practice progression.** Reading only. No exercise asks the learner to write a class, override a method, or implement `copy`/`compare`. The Practice section (index.mdx:127-131) promises a "Mini-lab" that does not exist.

**Journey.**
- index.mdx:17-21 "Foundation Refresh (from Tier 1)" assumes T1 taught classes, handles, constructors, `rand` and `constraint`. T1 only previews a class (F1C_Why_SystemVerilog/index.mdx:40) and mentions `obj.randomize()` in passing (F2D/index.mdx:149). The handle/object model is first taught here, and only incidentally.
- UVM later depends on static members, parameterized-class static registries (`uvm_component_registry #(T,"name")`), `typedef class` and `$cast` in `do_copy`. Only `$cast` is covered.

---

### I-SV-2A Constrained randomization fundamentals (2 files, 254 lines)

**Inventory**
- **index.mdx.**
  - H2: Quick Take(12), Build Your Mental Model(20), Make It Work(102), Push Further(113), Practice & Reinforce(118), Deep Dives(124), References(127).
  - Components: Image(23), IC ×2 (34, 85), ConstraintSolverHeatmapVisualizer(74), ConstraintSolverVisualizer(76), Constraint3D(78).
  - Quiz 2 Q (133-158): randc, contradiction. IQP soft vs inline (161-169).
  - Code: 35-69 is a complete program; 86-98 is a class only.
- **constraint-blocks.mdx.**
  - Levels 1-3 (16, 21, 55).
  - IC `code=` ×3 (25, 32, 49), which render empty.
  - Quiz 1 Q (60); IQP solve-before (73-81).
- Flashcards `I-SV-2A_…`: missing (X-03). No lab. Next: 2B (index.mdx:131).
- The interactives work (ConstraintSolverVisualizer has a working predict question with P(A=0)=1/3).

**Concept coverage (2A plus 2B combined)**

| Concept | E | P | A | D | T | Justification |
|---|---|---|---|---|---|---|
| `randomize()` / return value | 2 | 1 | 1 | 1 | 0 | 2A index.mdx:63-67; solver-debug.mdx:15-42; lab step 1 (self-attested) |
| `rand` vs `randc` | 1 | 0 | 0 | 0 | 0 | Only quiz 2A index.mdx:136-144 and checklist 109. Cycle restart, constraint interaction and the ban on `randc` in `solve before` are not covered |
| Constraint blocks / inheritance / override by name | 1 | 0 | 0 | 0 | 0 | 2A index.mdx:42-52. Overriding or extending constraints in a derived class is not covered |
| `dist :=` vs `:/` | 0 | 1 | 1 | 0 | 0 | Used at 2A index.mdx:48 with no explanation anywhere. ConstraintSolverExplorer dist mode only. Coverage lab step 3 asks for a `dist` |
| Implication / if-else | 1 | 2 | 0 | 0 | 0 | advanced-constraints.mdx:21-31 (with a wrong claim, M2B-01); ConstraintSolverVisualizer predict works |
| `solve…before` | 1 | 2 | 0 | 0 | 0 | Contradictory text (M2A-02); the visualizer's 1/13 vs 25% scenario is good |
| `foreach` constraints | 1 | 1 | 0 | 0 | 0 | advanced-constraints.mdx:43-48; quiz 66-73 |
| Soft constraints | 2 | 1 | 0 | 0 | 0 | constraint-blocks.mdx:30-45; 2A IQP 162-167. Priority order, `disable soft` and soft-vs-soft conflicts not covered |
| Inline `with` | 1 | 1 | 0 | 0 | 0 | 2A index.mdx:67; randomization-methods.mdx:32. `local::` and name-resolution pitfalls not covered |
| `pre_`/`post_randomize` | 1 | 1 | 0 | 0 | 1 | controlling-randomization.mdx:23-47 (an anti-pattern, M2B-05); IQP CRC 68-75 (broken) |
| `rand_mode` / `constraint_mode` | 1 | 0 | 1 | 1 | 0 | solver-debug.mdx:60-73; lab step 2 |
| Failure handling | 2 | 1 | 1 | 1 | 0 | solver-debug.mdx:15-42 |
| `unique`, array `sum()` width, overconstraint, distribution skew | 1 | 1 | 0 | 1 | 0 | Overconstraint covered (solver-debug); skew in the visualizer; `unique` and `sum()` width absent (grep) |
| Seeds / random stability | 1 | 1 | 0 | 0 | 0 | randomization-methods.mdx:72-82 (partly misleading, M2B-03); no `srandom`, `get_randstate` or hierarchical seeding |
| `std::randomize`, randcase, randsequence | 1 | 1 | 0 | 0 | 0 | randomization-methods.mdx:23-70 |

**Technical accuracy**

- **M2A-01 (S2, High) — `dist` operators never explained.**
  - Location: `index.mdx:48` `opcode dist { 4'h0 := 10, [4'h1:4'h3] :/ 70, [4'h8:4'hF] :/ 20 };`.
  - The difference between `:=` (weight per value) and `:/` (weight split across the range) is never explained. The learner is not told that values 4-7 become *impossible*, because `dist` also implies membership, or how the weights work out per value (0 → 10%, each of 1-3 → about 23.3%, each of 8-F → 2.5%).
  - This is the most common interview and debug topic in randomization.
- **M2A-02 (S2, High) — solve-before described three incompatible ways.**
  - `index.mdx:82` *"`solve addr before data;` ensures solver picks address first."*
  - `constraint-blocks.mdx:58` *"use it only when a variable's legal range depends on another's value."*
  - `constraint-blocks.mdx:78` (the IQP feedback, which is correct) *"The solver handles bidirectional dependencies automatically; `solve...before` is strictly about changing the probability distribution."*
  - Correction: solve-before never changes the solution set. It only changes the probability distribution, and it is not needed for correctness. Lines 82 and 58 should be removed or rewritten.
- **M2A-03 (S3, High) — unbounded array size.** `constraint-blocks.mdx:50-52` `rand int size; … data.size() == size;` puts no upper bound on `size`, so the solver may pick very large sizes, causing memory blow-up or timeouts. This is a canonical pitfall, presented as the example.
- **M2A-04 (S4, Medium).** `index.mdx:64` `$fatal("Randomization failed")`: the first argument of `$fatal` is the finish number. Use `$fatal(1, "...")`.

**Practice progression.** No writing task. "Lab prompt – Build a transaction with soft defaults…" (index.mdx:121) has no lab behind it.

---

### I-SV-2B Advanced constrained randomization (5 files, 400 lines)

**Inventory**
- **index.mdx:** Quick Take(10), Deep Dives(18), References(24). ConstraintSolverExplorer(15). No quiz.
- **advanced-constraints.mdx:** IC `code=` ×2 (23, 43), empty; quiz 2 Q.
- **controlling-randomization.mdx:** IC `code=` (23); quiz 1 Q; IQP CRC (67-75).
- **randomization-methods.mdx:** IC `code=` ×2 (26, 46); plain fence 59-70; quiz 1 Q; IQP seed (97-105).
- **solver-debug.mdx:** IC `code=` (22); fences 50-57, 63-74; lab card linking `/practice/lab/randomization-advanced-1` (92-97); IQP silent failure (102-110).
- Flashcards: missing. Next: 3A.

**Technical accuracy**

- **M2B-01 (S2, High) — implication is not one-directional.**
  - Location: `advanced-constraints.mdx:52` *"In `A -> B`, the solver evaluates `A` first. If it is false, `B` is ignored, keeping solving efficient."*
  - Correction: `A -> B` is the boolean constraint `!A || B`. The solver treats it as bidirectional. If `B` cannot be satisfied, the solver forces `A` false, and the presence of `B` changes the probability of `A`. The page's own example (lines 29-30) shows this: `is_write=1` has 16 `addr` solutions against 256 for `is_write=0`, so P(is_write)≈5.9%. That skew is never mentioned.
- **M2B-02 (S2, High) — rand variables are not unsigned by default.**
  - Location: `solver-debug.mdx:77` *"Random variables are `unsigned` by default unless explicitly declared `signed`."*
  - Correction: a rand variable's signedness is its data type's. `int`, `byte`, `shortint`, `longint` and `integer` are **signed**; `bit` and `logic` vectors are unsigned. `rand int x;` produces negative values, which is the usual source of "negative length" bugs.
- **M2B-03 (S2, Medium-High) — random-stability model is misleading.**
  - `randomization-methods.mdx:82` and the IQP at lines 98-103 (*"If the order of threads changes… Thread A gets the random number Thread B originally got"*).
  - SV random stability is hierarchical. Each thread and each object has its own RNG, seeded from its parent when it is *created*. Interleaving already-created threads does not swap their sequences. What breaks reproducibility:
    - changing the *order of creation* of objects or threads (e.g. inserting a new `new()` or `fork`);
    - two threads randomizing one shared object;
    - external entropy such as DPI `rand()`, `$system`, or wall-clock time;
    - a different build, tool version or plusargs.
  - With the same seed, build and inputs, simulation is deterministic, so the "race" answer misattributes the cause.
- **M2B-04 (S4, Medium-High).** `randomization-methods.mdx:77` "`-sv_seed 1234` in Xcelium": Xcelium `xrun` uses `-svseed`; `-sv_seed` is Questa's.
- **M2B-05 (S3, High) — the `pre_`/`post_randomize` example is an anti-pattern.**
  - Location: `controlling-randomization.mdx:23-37`. `rand bit [7:0] payload[]` is emptied in `pre_randomize` and then filled deterministically in `post_randomize` (`payload[i] = i`).
  - This presents defeating randomization as the canonical use. The right approach is to constrain `payload.size()==len` and let the solver fill it, keeping `post_randomize` for derived non-rand fields such as CRC.
  - Also missing: overrides must call `super.pre_randomize()`, and `post_randomize` is not called when randomization fails.
- **M2B-06 (S2, High) — lab premise is incorrect.**
  - Files: `labs/randomization_advanced/lab1_dependent_fields/packet.sv:8-24` and `README.md:3-9`.
  - Constraints: IPV6 ⇒ length==40; size==length; size ∈ {16,32,64,128,256}. This is *not* a contradiction for the class. The solver simply never picks IPV6, so `randomize()` returns 1 every time and nothing is "entirely zero". The steps (lab.json step 1: "packets… will all look identical (zeros)") and the README describe a failure that never happens.
  - The real lesson ("constraints silently remove a protocol mode: a coverage hole, not a failure") is valuable but goes untaught.
  - `packet_buggy.sv` and `packet_solution.sv` are a different exercise (CRC via `sum()`) that does not match the steps. `packet_buggy.sv:14-15` claims solvers "cannot process complex mathematical reductions", which is false.
  - Fix: either force `proto==IPV6` inline (`randomize() with {proto==IPV6;}`) so the failure is real, or reframe the lab around coverage. Align the asset files.
- **M2B-07 (S4).** `solver-debug.mdx:61` "The last constraint you turned off is part of the contradiction" is roughly right but ignores multi-constraint cores. Point to the tool's unsat-core report.

**Practice progression.** One self-attested debug lab, flawed as above. There is no "write constraints from a spec" task, which is the key apply step.

---

### I-SV-3A Functional coverage fundamentals (2 files, 272 lines)

**Inventory**
- **index.mdx.**
  - H2: Quick Take(9), Build Your Mental Model(17), Make It Work(103), Push Further(114), Practice & Reinforce(119), Deep Dives(125), References(128).
  - Components: Image(20), IC ×2 (31, 78), CoverageCrossExplorerVisualizer(71).
  - Quiz 2 Q (132-157); IQP coverage hole (160-168).
  - Code: an interface with a covergroup (33-64); a class with a `sample()` covergroup (80-99).
- **coverage-options.mdx:** options table (30-38); IC (40-63); quiz 1 Q; IQP option vs type_option (92-100).
- Flashcards: missing. Lab: none. Next: 3B.

**Concept coverage (3A plus 3B)**

| Concept | E | P | A | D | T | Justification |
|---|---|---|---|---|---|---|
| Covergroup / coverpoint | 1 | 0 | 0 | 0 | 0 | 3A index.mdx:39-63 |
| Auto bins / `auto_bin_max` | 0 | 0 | 0 | 0 | 0 | Only in the options table (wrong scope, M3A-01) and an IQP distractor |
| Explicit and array bins (`mid[]`) | 1 | 0 | 0 | 0 | 0 | 3A index.mdx:42-44; `[]` semantics not explained |
| `default` bin | 0 | 0 | 0 | 0 | 0 | Used at 3A index.mdx:51 and in the lab; exclusion from crosses and coverage never explained |
| Wildcard bins | 0 | 0 | 0 | 0 | 0 | — |
| Transition bins (`=>`, `[*n]`) | 0 | 0 | 0 | 0 | 0 | — |
| `illegal_bins` / `ignore_bins` | 1 | 1 | 0 | 0 | 0 | 3A index.mdx:59, 74-75, 91-92; quiz 135-144 (explanation wrong, M3A-03) |
| Cross, `binsof`, `intersect` | 1 | 1 | 0 | 0 | 0 | 3A index.mdx:58-60, 90-93; no explanation of auto cross bins or `binsof` selection; CoverageCrossExplorer is interactive |
| Sampling event / `sample()` / `with function sample` | 1 | 0 | 0 | 0 | 0 | coverage-options.mdx:23-26; 3A index.mdx:86. Sampling *timing* (race with NBA, using a clocking block) absent |
| `option` vs `type_option` | 1 | 0 | 0 | 0 | 0 | coverage-options.mdx:30-38 (errors); IQP broken |
| Per-instance | 1 | 0 | 0 | 0 | 0 | coverage-options.mdx:32,70; coverage-apis.mdx:25-49 |
| Exclusions / closure planning | 2 | 0 | 1 | 1 | 0 | closure-workflow.mdx:22-32; linking-coverage.mdx:23-70; coverage lab |
| Runtime coverage APIs | 1 | 0 | 0 | 0 | 0 | coverage-apis.mdx:25-69 |

**Technical accuracy**

- **M3A-01 (S2, High) — `type_option.auto_bin_max` does not compile.**
  - Location: `coverage-options.mdx:37` (table, "`type_option.auto_bin_max` | Coverpoint") and line 47 `type_option.auto_bin_max = 16;`.
  - `auto_bin_max` is an *instance* option (`option.auto_bin_max`). The type options are weight, goal, comment, strobe and merge_instances (plus a few others), and `auto_bin_max` is not among them. The code is a compile error.
- **M3A-02 (S3, High) — `find()` does not exist and the `type_option` syntax is wrong.**
  - `coverage-options.mdx:72` "Query `cov.get_inst_coverage()` or `cov.find()`": covergroups have no `find()` method. The built-ins are `sample`, `get_coverage`, `get_inst_coverage`, `set_inst_name`, `start` and `stop`.
  - Line 70 `cg_pkt.type_option.merge_instances = 1;` "during reporting": type options are set procedurally through the type scope, `cg_pkt::type_option.merge_instances`. They affect how type coverage is computed during simulation, not something toggled "during reporting".
- **M3A-03 (S3, Medium-High) — illegal bins do not terminate.** `index.mdx:143` *"Illegal bins terminate simulation if sampled"*. Hitting an illegal bin raises a run-time *error*; whether simulation stops depends on tool and error-limit settings. The quiz option itself (line 138) is right; the explanation is not.
- **M3A-04 (S4).**
  - `index.mdx:75` "**Soft bins:** `ignore_bins`" is not SV terminology and clashes with `soft` constraints.
  - `index.mdx:116` "weighted coverage (`option.goal`)": weighting is `option.weight`; `goal` is the target.
- **M3A-05 (S3, Medium) — sampling semantics untaught.**
  - Neither page explains *which value* a clock-triggered covergroup samples. It is the value at the moment the event fires in the Active region, so it races with procedural drivers.
  - Neither page explains why sampling through a clocking block or a monitor's `sample(tr)` is the robust pattern.
  - coverage-options.mdx:57-62 combines `@(posedge clk)` auto-sampling with a manual `cov.sample()` on the same edge, which double-counts.

**Practice progression.** None in 3A. "Mini-lab – Build a covergroup for a custom protocol" (index.mdx:122) does not exist.

---

### I-SV-3B Advanced functional coverage (4 files, 283 lines)

**Inventory**
- **index.mdx:** 20 lines (Quick Take and links only).
- **coverage-apis.mdx:** IC `code=` (28), empty; fence 59-64; quiz 1 Q; IQP (87-94).
- **linking-coverage.mdx:** IC (27); UVM fence (36-56); quiz; IQP (88-96).
- **closure-workflow.mdx:** lab card `/practice/lab/coverage-advanced-1` (40-53); quiz 1 Q.
- Flashcards: missing.

**Technical accuracy and design**

- **M3B-01 (S3, Medium-High) — per-instance data needs `option.per_instance = 1`.**
  - The interview items present `set_inst_name()` (linking-coverage.mdx:92) or `get_inst_coverage()` (coverage-apis.mdx:92) as the key step for per-channel visibility. Neither mentions that **`option.per_instance = 1`** is what makes per-instance data get tracked and saved.
  - `coverage-apis.mdx:53` says `get_coverage()` returns "merged coverage across all instances". By default (`merge_instances = 0`) type coverage is a weighted *average* of instances, not a union.
- **M3B-02 (S3, High) — UVM code before UVM is taught.** `linking-coverage.mdx:36-58`:
  - Uses `uvm_component`, `get_full_name()` and `type_id::create` without `` `uvm_component_utils ``, so `type_id` does not exist.
  - Constructs a covergroup whose event is `@(posedge vif.clk)` in `new()`, before `vif` is assigned (a likely null dereference).
  - Also exposes a manual `sample()` while auto-sampling.
  - Points to an internal repo script (line 66, `scripts/check-titles.*`).
- **M3B-03 (S4).** `coverage-apis.mdx:69` `cg.cp_state.get_coverage()`, but the example's coverpoint is unlabeled (`coverpoint state;`), so the name would be `state`.
- **M3B-04 (S3, Medium) — coverage lab cannot reach 100% as instructed.**
  - Files: `labs/coverage_advanced/lab1_closure_loop`. The cross is `cp_op × cp_a` (alu_cov_mon.sv:26); `default` bins are excluded from crosses, so 7 ops × {zero, max} = 14 cross bins.
  - Steps 2-3 only add DIV and weight `8'hFF`. `a == 0` stays at about 1/256 per sample, so with 500 samples about 0.28 hits per op×zero cell are expected, and most "zero" cross bins stay empty.
  - All steps are self-attested; nothing checks coverage.
  - The lab is still the best "close the loop" artifact in T2 SV.

---

### I-SV-4A SVA fundamentals (2 files, 232 lines)

**Inventory**
- **index.mdx.**
  - H2: Quick Take(9), Build Your Mental Model(17), Make It Work(51), Push Further(62), Practice & Reinforce(68), Deep Dives(110), References(113).
  - IC (24), SvaSequenceWaveformVisualizer(49).
  - Quiz 2 Q (73-96); IQP `$assertoff` (99-107).
- **immediate-vs-concurrent.mdx:** fence (24-35); IC ×2 (58, 70); the **same quiz question twice** (47, 94); IQP deferred assertion (106-114).
- Flashcards `I-SV-4A_Assertions_SVA_Fundamentals`: missing.
- Lab `assertions-1` is `coming_soon`.

**Concept coverage (4A, 4B, 4C)**

| Concept | E | P | A | D | T | Justification |
|---|---|---|---|---|---|---|
| Immediate vs concurrent | 2 | 1 | 0 | 0 | 0 | immediate-vs-concurrent.mdx:18-43; 4A index.mdx:21-23 |
| Deferred `#0` / `final` | 0* | 0 | 0 | 0 | 0 | *Only inside the broken IQP (immediate-vs-concurrent.mdx:110) |
| Sampled values in Preponed | 0 | 0 | 0 | 0 | 0 | Not mentioned in T2. Taught in T1 F3B_Scheduling_Regions/index.mdx:25-29,77 and not reinforced here |
| Sequences, `##`, `##[m:n]` | 1 | 2 | 0 | 0 | 0 | 4A index.mdx:26-29,45; quiz 86-94; SvaSequenceWaveformVisualizer and TemporalLogicExplorer |
| `|->` vs `|=>` | 2 | 2 | 0 | 0 | 0 | 4A index.mdx:46; TemporalLogicExplorer:68-69 plus a working IQP |
| Repetition `[*]`, `[->]`, `[=]` | 0 | 0 | 0 | 0 | 0 | Only a visualizer preset (`SvaSequenceWaveformVisualizer.tsx:18`) |
| `throughout` / `within` / `intersect` / `first_match` | 0 | 0 | 0 | 0 | 0 | 4A index.mdx:47 name-drop only |
| `$rose` / `$fell` / `$stable` / `$past` | 0 | 0 | 0 | 0 | 0 | Absent from T2 SV text (`$stable` only in an I-SV-6 macro) |
| `disable iff` and reset | 1 | 1 | 0 | 0 | 0 | multi-clocking.mdx:36-46; quiz 57-67. Abort semantics, asynchronous evaluation and current (not sampled) values not covered |
| Vacuity | 0 | 0 | 0 | 0 | 0 | Only the visualizer's "VACUOUS" label, which is wrong for bare sequences (M4A-03) |
| Local variables | 1✗ | 0 | 0 | 1 | 0 | local-variables.mdx (M4B-01, M4B-02) |
| Multiclock | 1 | 1 | 0 | 0 | 0 | multi-clocking.mdx:17-34, 51-53 (M4B-03) |
| `assume` / `cover` | 1 | 0 | 0 | 0 | 0 | `cover` only at 4A index.mdx:40, covering an implication (M4A-02); no `assume` |
| Checkers | 1 | 0 | 0 | 0 | 0 | 4C index.mdx:16-53 (M4C-01) |
| `bind` | 2 | 0 | 0 | 0 | 0 | 4C index.mdx:55-111 |
| Assertion control (`$assertoff`) | 1 | 0 | 0 | 0 | 0 | IQP 4A index.mdx:100-106 (broken) |

**Technical accuracy**

- **M4A-01 (S3, High) — examples that do not compile or do not match their messages.**
  - `immediate-vs-concurrent.mdx:31-34`: `property hold_until_ack; req |-> ##[1:3] ack; endproperty assert property (hold_until_ack);` has no clocking event and no `default clocking`, so it is a compile error. The name "hold_until_ack" also claims a check (that `req` is held) the property does not make.
  - Lines 26-28: `assert (req == 0) else $error("Req high during reset");` has no reset condition at all.
- **M4A-02 (S3, Medium) — covering an implication.**
  - Location: `index.mdx:40` `cover_req_ack: cover property (p_req_implies_ack);` and line 63 *"every property can double as a coverage point"*.
  - Covering an implication property reports vacuous attempts separately, and tools differ in what counts as "covered". Practice is to `cover` the **sequence** (`req ##1 ack`). Vacuity is never introduced, which is a foundational gap for reading assertion reports.
- **M4A-03 (S2, High) — the visualizer calls a failing bare sequence "vacuous".**
  - `SvaSequenceWaveformVisualizer.tsx:110-121`: for a bare sequence such as Preset 1 `req ##2 ack`, the evaluator returns `VACUOUS` when `req` is false.
  - A sequence used as a property has no antecedent. Every attempt where `req` is low **fails**. The interactive therefore reinforces the same misconception as M4B-01 and M4B-03.
- **M4A-04 (S4).**
  - Feedback at line 110 says deferred `#0` assertions "wait until the end of the time step". Observed-deferred assertions mature in the Observed region, and `final` assertions run in Postponed.
  - Line 88 "Concurrent assertions can be reused … by placing them in … packages": sequences and properties can be declared in packages, but concurrent assertion *statements* cannot be placed there.

**Practice progression.**
- Micro-lab (index.mdx:70) is not implemented. `labs/assertions/lab.json` is `coming_soon`, although `lab1_data_integrity/` contains a DUT, testbench and solution that could be enabled.
- There is no "write and debug a handshake SVA with reset" exercise anywhere in T2.

---

### I-SV-4B Advanced temporal logic (3 files, 177 lines)

**Inventory**
- **index.mdx** (23 lines): TemporalLogicExplorer(14), which works and includes a working `|=>` IQP. Next → **I-UVM-1A** (line 23; X-04).
- **local-variables.mdx:** IC (19); quiz 1 Q; IQP (61-69).
- **multi-clocking.mdx:** IC ×2 (19, 40); quiz 1 Q; IQP (71-79).
- The description promises "binding checkers into your design", but there is no bind content in 4B.

**Technical accuracy**

- **M4B-01 (S1, High) — the local-variable example fails on every idle cycle.**
  - `local-variables.mdx:21-31`: `sequence s_store_then_compare; logic [7:0] first_data; (req, first_data = data) ##1 (ack && data == first_data); endsequence` is asserted as `@(posedge clk) s_store_then_compare`.
  - With no implication, a new attempt starts every clock and **fails whenever `req` is 0**.
  - Correct form: `(req, v = data) |=> (ack && data == v)`, with a reset-aware `disable iff`.
- **M4B-02 (S1, High) — SVA local variables cannot be static.**
  - `local-variables.mdx:42` *"Local variables can be declared `static` if multiple threads must share the same value."* IQP feedback line 67: *"`static` is the keyword used if you actually want them shared."*
  - Assertion local variables have no lifetime qualifier and are always private to each attempt, as the grammar for assertion variable declarations shows (clause unverified). There is no way to make them shared. Sharing state across attempts needs module-level variables or auxiliary code.
- **M4B-03 (S2, High) — the multiclock example has the same bare-sequence bug.** `multi-clocking.mdx:22-32`: `@(posedge wr_clk) wr_en ##1 @(posedge rd_clk) rd_en` is asserted directly, so it fails on every `wr_clk` edge where `wr_en` is 0. It should be `@(posedge wr_clk) wr_en |=> @(posedge rd_clk) rd_en` (or `|-> ##1`).
- **M4B-04 (S3, High) — `##0` does not mean "no time passes".**
  - `multi-clocking.mdx:52` *"A `##0` delay switches clocks without advancing time."*
  - In multiclock concatenation, `##0` means "at the nearest tick of the new clock at or after the end of the previous subsequence". Time advances unless the clocks coincide.
  - The IQP (line 75) says `##1` misses a clkB edge that is "extremely close" to clkA. Only a *coincident* edge is skipped.
- **M4B-05 (S2) — missing semantics.** No `disable iff` semantics: it aborts in-flight attempts, is evaluated with current rather than sampled values, and should not use `$past` or other sampled-value functions in its expression. These are exactly the reset-handling concepts the brief lists.

---

### I-SV-4C Checkers & bind (1 file, 117 lines)

**Inventory.** H2: Quick Take(7), Build Your Mental Model(14), Make It Work(96), Push Further(107), References(113). BindDirectiveVisualizer(63). **No quiz, no IQP, no exercise.** The flashcard ID is missing.

**Technical accuracy**

- **M4C-01 (S2, Medium-High) — checker body rules misstated.**
  - Location: `index.mdx:43-46` *"You CANNOT write general procedural code! ILLEGAL in a checker: `always_ff @(posedge hclk) …` `assign out_port = data;`"*.
  - Since IEEE 1800-2012, checkers may contain `initial`, `always_comb`, `always_latch`, `always_ff` and `final` procedures (the general `always` is not allowed). They may also declare output ports and assign checker variables, including by continuous assignment (clause unverified).
  - The example itself uses `assign in_transaction = …` at line 30, which contradicts line 46.
- **M4C-02 (S4, Medium).**
  - Line 52 "If coverage is turned off, the tool knows it can safely drop the entire checker" has no normative basis.
  - Line 53 says checkers can be instantiated "inside … loops". Procedural checker instances exist, but restrictions apply (clause unverified, Low confidence).
  - Line 99 "Compile [bind file] after the RTL but before the testbench" is not required, because bind resolves at elaboration.
  - Line 109 "AST injection" is speculative implementation detail.
  - Line 88 binds an AHB checker to `spi_ctrl_0`, which is confusing.

**Practice.** None. The checklist (102-105) is self-report only.

---

### I-SV-5 Synchronization & IPC (4 files, 320 lines)

**Inventory**
- **index.mdx:** MailboxSemaphoreGame(20); `<LabLink labId="ipc-deadlock" />`(24); Next → **I-SV-4A** (line 28, backwards).
- **events.mdx:** IC (28); quiz 1 Q; IQP (90-98).
- **mailboxes.mdx:** table (23-30); IC (32); quiz; IQP (92-100).
- **semaphores.mdx:** IC (28); quiz; IQP (76-84).
- Flashcards: missing.

**Concept coverage**

| Concept | E | P | A | D | T | Justification |
|---|---|---|---|---|---|---|
| Mailbox: bounded, `put`/`get`/`try_*`/`peek`/`num` | 2 | 1 | 0 | 1 | 0 | mailboxes.mdx:21-30, 64-74. `peek` blocking and `try_peek` not covered |
| Mailbox of class handles (aliasing) | 0 | 0 | 0 | 0 | 0 | Absent. Putting one handle repeatedly makes the consumer see overwritten data, a top real-world IPC bug |
| Semaphores | 2 | 1 | 0 | 1 | 0 | semaphores.mdx:17-56; ipc-deadlock lab (self-attested, read-only source) |
| Events: `->`, `->>`, `@`, `wait(.triggered)` | 1✗ | 1 | 0 | 1 | 0 | events.mdx:21-72 (M5-01) |
| `wait_order` | 1 | 0 | 0 | 0 | 0 | events.mdx:68 |
| fork/join, join_any, join_none | 0 | 0 | 0 | 0 | 0 | Not in I-SV-5. T1 F2C/index.mdx:91-140 covers join_none and zombie threads |
| `disable fork` pitfalls / `wait fork` / `process` class | 0 | 0 | 0 | 0 | 0 | Only a mention at semaphores.mdx:51; T1 F2C:120 names `process::kill()` |
| Deadlock | 2 | 1 | 1 | 1 | 0 | semaphores.mdx:53-56; lab |

**Technical accuracy**

- **M5-01 (S1, High) — `->>` does not make an event persistent.**
  - `events.mdx:25` *"Trigger with persistence: `->> done;` (waiters that start later in the same timestep still wake up)."*
  - `events.mdx:45` `#2 ->> done; // acknowledge with persistence`.
  - `events.mdx:66` *"Use the Nonblocking Trigger `->>` which persists the event state through the *entire* Reactive region of the current time step."*
  - Correction: `->>` is a *nonblocking* trigger. It schedules the trigger in the NBA region (or after a delay), which often avoids the zero-delay race because waiters reach `@e` first. **Persistence** is the separate `.triggered` property. It is set by either `->` or `->>` and stays true for the rest of the time step. That is why `wait(e.triggered)` (not `@e`) catches a trigger that happened earlier in the same step.
  - The lesson conflates the two, and this is a common interview topic.
- **M5-02 (S3, Medium-High) — the real `triggered` trap is not the one described.**
  - `events.mdx:64` claims `wait(done.triggered)` "might miss the event entirely or evaluate to true erroneously".
  - The real trap is the reverse: inside a `forever` loop with no time advance, `wait(e.triggered)` stays true for the whole time step and causes a zero-delay infinite loop.
  - Line 49-53 labels a waiter that starts at time 0 as a "late listener", which demonstrates nothing.
- **M5-03 (S2, Medium) — the backpressure example may hang.**
  - `mailboxes.mdx:39-43`: `if (!mbx.try_put(p)) begin wait (mbx.num() < 4); mbx.put(p); end`.
  - A level-sensitive `wait` on a method-call expression generally does not re-evaluate when the mailbox's internal state changes (its operands, the handle `mbx`, never change). It can block forever; tool behaviour varies.
  - It is also redundant, because `put()` already blocks when the mailbox is full. It teaches the wrong backpressure idiom. Use `mbx.put(p)`.
- **M5-04 (S3, High) — concurrent calls to a static task.**
  - `semaphores.mdx:32-44`: `task master(string name);` at module scope is static by default and is called concurrently from `fork`. Both calls share the `name` storage.
  - The printed output happens to look right because each call prints before blocking, but this is a latent bug pattern. The mailbox example correctly uses `task automatic`.
- **M5-05 (S4).** `semaphores.mdx:51,82` mention "throws a fatal exception" and "unhandled exception". SystemVerilog has no exceptions.
  - `MailboxSemaphoreGame.tsx:42-47` caps `put` at the initial key count. Real semaphores allow `put` beyond the initial count, which is a common bug source in its own right.
- **M5-06 (S3) — the IPC lab's bug is seed-dependent.**
  - `labs/ipc_deadlock/src/testbench.sv:25-33`: the bug fires only when `$urandom_range(0,10)==5` in one of 5 iterations (about 37% chance). Step 1 promises the watchdog "fires at 500ns" on every run.
  - Step 3 claims both threads "complete all 5 iterations" after the fix, but the early `return` still ends the producer early.
  - The asset is `"editable": false` (lab.json), so the learner cannot apply the fix in-app.

---

### I-SV-6 Compiler directives & generates (1 file, 261 lines)

**Inventory.** H2: Quick Take(7), Build Your Mental Model(14), Generate Constructs(107), Make It Work(164), Push Further: Common Pitfalls(210), References(257). GenerateElaborationVisualizer(154). 14 plain fenced blocks, which render correctly. **No quiz or IQP; flashcard ID missing.**

**Coverage:**
- `` `define `` and parameterized macros: E2 (20-43).
- `` `ifdef ``/`` `elsif `` and include guards: E2 (45-77).
- Macro hygiene: E2 (88-108).
- generate for/if/case: E2 (110-160), P1 (visualizer), D1 (pitfalls 212-255).
- Missing: `` `` `` token pasting, `` `" `` escapes beyond one use, `` `__FILE__ ``/`` `__LINE__ ``, macros persisting across files in a compilation unit (order-dependent), default macro arguments, hierarchical references into generate scopes (`gen_mon[0].u_chk`), unnamed `genblkN` names.

**Technical accuracy**

- **M6-01 (S2, High) — genvars are legal inside procedural blocks.**
  - Location: `index.mdx:241-245` *"genvar is NOT a runtime variable … ILLEGAL inside an always block: `always_ff @(posedge clk) x <= data[i];  // 'i' is a genvar!`"*.
  - Inside a generate loop, a genvar acts as a constant in each generated scope and is legal in procedural code. `always_ff … q[i] <= d[i];` is idiomatic RTL. (The shown code would cause multiple drivers on `x`, but that is a separate issue.)
- **M6-02 (S3, Medium-High) — the bind-in-generate example is broken.**
  - Location: `index.mdx:181-188`. `bind router_port protocol_checker chk_inst (.data(port_data[i]))` inside `for (genvar i…)`:
    - binds every `router_port` N times with the same instance name, causing duplicate-instance errors;
    - `port_data[i]` is resolved in the target scope, where the genvar `i` does not exist.
  - Use instance-specific binds, or a generate loop inside a wrapper module that is itself bound.
- **M6-03 (S4, High) — `` `timescale `` scope.** `index.mdx:83` "`` `timescale `` sets the time unit and precision for the file." It stays in effect for all following design elements in compilation order, across files, until the next `` `timescale `` or `` `resetall ``. This is a classic pitfall.
- **M6-04 (S4).** `index.mdx:216-221`: the trailing-semicolon example `#`CLK_PERIOD;` expands to `#10;;`, which is legal (a null statement) inside `begin…end`. Show `x = `CLK_PERIOD * 2;` instead.

---

### I-SV-7 DPI (1 file, 259 lines)

**Inventory.** H2: Quick Take(7), Build Your Mental Model(14), Type Marshaling(112), Memory Ownership(147), Blocking Behavior(170), Build & Link(187), Common Failure Modes(212), Make It Work(225), Push Further: VPI/PLI(240), References(254). DPIBoundaryInspector(87). 9 fenced blocks. **No quiz, IQP or lab.** Flashcard ID missing. Next → T4 E-INT-1 (X-04).

**Coverage:**
- import/export: E2 (16-83).
- `pure`/`context`: E1 (85-108). The `context` requirement is not tied to the export example.
- Open arrays: E1 (22-57; nonexistent API).
- Type mapping: E1 (112-143). Missing: output and inout arguments are passed as pointers; scalar `bit`/`logic` map to `svBit`/`svLogic`; `chandle` maps to `void*`.
- 4-state encoding: E2 (128-141); the aval/bval table is correct.
- Memory ownership: E2 (147-166).
- Missing: `svScope`/`svSetScope`/`svGetScope`, `extern "C"` for C++, disabling an imported task (`svIsDisabledState`), the deprecated `"DPI"` vs `"DPI-C"`.

**Technical accuracy**

- **M7-01 (S1, High) — DPI time semantics are wrong.**
  - `index.mdx:172-173`: *"`import "DPI-C" task` — Can consume simulation time. The task is allowed to call `tf_dofinish` or block on I/O, and the simulator can schedule other SV processes while waiting."*
  - Line 183: *"If your C code does I/O, networking, or heavy computation, use a task instead."*
  - Failure table line 218: "Simulation hang | Long-running function (not task) | Convert to import task".
  - Correction: an imported DPI **task** consumes simulation time *only* by calling an **exported SV task** that contains timing controls. Such an import must be `context`. C code that blocks on I/O or computes for a long time blocks the whole simulator whether it is imported as a function or a task, because the simulator is single-threaded with respect to DPI. `tf_dofinish` is a PLI 1.0 TF routine and is irrelevant here.
  - `DPIBoundaryInspector.tsx` hazard text ("Because it is **not** exported as an SV task…") repeats the same framing.
- **M7-02 (S2, High) — `svGetIntElement` does not exist.**
  - `index.mdx:46-50` uses `svGetIntElement(data, i, &val);`. svdpi.h provides `svGetArrElemPtr1(h, i)` (index in SV numbering from `svLow`), `svSize`, `svLow`/`svHigh`, `svGetBitArrElem1` and similar.
  - The CRC loop processes 8 bits of a 32-bit XOR and is algorithmically wrong for 32-bit words (S4).
  - `uint32_t` is used without `<stdint.h>`.
- **M7-03 (S3, High) — the export example omits `context`.**
  - `index.mdx:64-81`: C `my_c_checker` calls exported `sv_get_sim_time()`. Calling an export is only legal from inside a `context` import, and the lesson never shows the import.
  - The failure table (line 217) blames segfaults on "passing `logic` to `int` parameter". SV converts that on the SV side. Segfaults typically come from C prototypes that do not match the import, open-array misuse, or a missing scope.
- **M7-04 (S4).**
  - Line 108 "Always mark pure functions as `pure`" needs a caution: a function with side effects marked `pure` may have calls eliminated.
  - Line 193 `-I${VCS_HOME}/include/svdpi.h` passes a file to `-I`.
  - Line 28 uses a UVM sequence with an unchecked `pkt.randomize()` before UVM is taught.

---

### I-SV-8 Power intent & UPF (1 file, 200 lines)

**Inventory.** No imports, quiz, IQP, flashcards or lab. 6 fenced blocks (Tcl and SV). `labs/power_aware/lab1_retention_bug` exists but is not linked here. Next: none. It refers to "power-aware SVA" at I-SV-4A (line 199), which has no such content, and to "E-PWR-1, coming soon".

**Coverage:**
- Domains, supply nets/ports/sets, isolation, retention, level shifters, power switch, PST: E1 each.
- Verification strategy: two prompts at lines 193-197.
- No SV-side verification (UPF supply functions, power-aware assertions for isolation and retention sequencing, corruption checks).

**Technical accuracy**

- **M8-01 (S3, Medium) — UPF version styles mixed.**
  - `index.mdx:105-117`: `add_power_state` on supply sets (UPF 2.x) is combined with `create_pst -supplies {SS_TOP SS_CPU}` and `add_pst_state … -state {ON ON}`. PSTs (UPF 1.0) are built over supply *ports/nets* with `add_port_state`, not over supply-set power states.
  - `` `{FULL_ON, 1.2V} `` likely should be a unitless value (`1.2`).
  - `set_isolation`/`set_isolation_control` with `-isolation_power_net` are UPF 1.0-style, but the file declares `upf_version 2.1`.
  - The comment "Isolate outputs" has no `-applies_to outputs`.
- **M8-02 (S3) — placement.** UPF sits between DPI and Why-UVM with no prerequisite or follow-on in T2. The learner is told to verify "pwr_en before iso_en" (line 196) without being shown how (SVA, or the power-aware simulation mode). Consider moving it to T3/T4, or linking the existing `power_aware` lab and adding a minimal isolation-sequencing SVA exercise.

---

### I-SV-9 Why UVM (1 file, 260 lines)

**Inventory.** H2: Quick Take(8), The Testbench Scaling Problem(17), Reuse Problem(78), Standardization Solution(116), Four Pillars(134), Naive vs UVM(187), What You'll Build(202), Practice & Reinforce(222), References(257). InteractiveUvmArchitectureDiagram(206). Quiz 3 Q (recall). No flashcards. Next → I-UVM-1A/index (line 260), which matches the navigation.

**Technical accuracy**

- **M9-01 (S3, High) — UVM's first IEEE standard was 2017.** `index.mdx:128` *"2020 — IEEE 1800.2-2020: UVM was elevated to a full IEEE standard"*. The first IEEE UVM standard was **IEEE 1800.2-2017**; 1800.2-2020 is a revision. Line 128 also cites "SystemVerilog itself (IEEE 1800-2017)", while other modules cite 1800-2023.
- **M9-02 (S4, Medium-High) — AVM was open source.** Line 122 says AVM "was proprietary". Mentor released AVM in 2006 under the Apache 2.0 open-source licence.
- **M9-03 (S3) — the bridge assumes work that never happened.**
  - Line 19 says "Throughout T1 and the SystemVerilog modules of T2, you've been writing testbenches like this". No T2 SV lab had the learner build any testbench.
  - The classic bridge is missing: a class-based layered testbench in plain SV (generator → mailbox → driver → monitor → scoreboard, with a covergroup and an assertion). It would make UVM's factory, phasing and TLM concrete by contrast.
  - Line 178 repeats the `assert(txn.randomize() …)` idiom (X-07).

---

## 3. Learner journey: T1 → T2 SV → UVM

1. **T1 → I-SV-1.**
   - I-SV-1 assumes T1 taught classes and randomization (index.mdx:17-21, with a stale folder name). T1 only previews them (F1C:40; F2D:149).
   - T1 does teach scheduling regions, including Preponed sampling for assertions (F3B:25-29,77), clocking blocks (F4C), and fork/join_none and mailboxes (F2C:91-140; F2D/ipc.mdx).
   - T2 SV does not **build on** this foundation:
     - I-SV-4A never revisits Preponed sampling.
     - I-SV-3A never addresses covergroup sampling timing or clocking blocks.
     - I-SV-5 repeats mailbox basics but skips the fork/join_any/disable fork/wait fork/process material that is the natural advanced step.
2. **Inside T2 SV.**
   - The in-content Next links are inconsistent (X-04): 4B jumps to UVM, 4C and 5 go backwards, 7 jumps to T4.
   - A learner who follows content links skips 4C-9.
3. **I-SV-9 → I-UVM-1A.** UVM depends on several things T2 SV does not deliver:
   - static members and parameterized-class registries (`type_id`);
   - polymorphic `copy`/`clone` with `$cast` (`do_copy`);
   - `typedef class` forward declarations;
   - virtual interfaces (only implicit in T1 F4B);
   - mailbox/TLM handle aliasing;
   - process control (`fork/join_any` with `disable fork` in drivers);
   - `rand` transaction design with `dist` and soft defaults.
   - Without these, I-UVM-1A's `type_id::create`, `clone()` and sequence-item randomization are unanchored. I-SV-9 has no readiness check.
4. **Sequencing.** UVM code appears early at I-SV-3B linking-coverage.mdx:36-58, I-SV-5 events.mdx:72 and mailboxes.mdx:72, and I-SV-7 index.mdx:28. That is before I-SV-9 introduces UVM.
5. **Placement.** I-SV-8 UPF is an orphan in the T2 sequence and its forward link points to a non-existent module.

---

## 4. Practice: what is needed for guided → independent progression

None of the following exists today. Each item states its acceptance and validation.

| # | Exercise | Kind | Acceptance and validation |
|---|---|---|---|
| P1 | Write `class axi_txn` with `rand` fields, a `dist` with `:=` and `:/`, `soft` defaults, implication, and a `foreach` on burst data. | Guided, then independent | Run the learner's class through a reference harness: 10k `randomize()` calls. Check legality (protocol rules), the distribution within tolerance, and that the soft default can be overridden inline. Graded by a real simulator (Verilator ≥5 has constrained randomization, or a hosted vendor sim). A token-match grader is not enough. |
| P2 | Predict-the-distribution items on solve-before and implication skew (reuse the ConstraintSolverVisualizer pattern). | Predict | Numeric answer within ±2%; feedback shows the solution-space count. |
| P3 | Write a covergroup from a 6-row plan excerpt: coverpoints, transition bins, a cross with `binsof`/`intersect` exclusions, `illegal_bins`, `per_instance`. | Apply | The grader samples a fixed transaction stream and compares bin hit counts with expected counts. Plan IDs must appear in `option.comment`. |
| P4 | Fix the coverage closure lab so it is solvable and checked: auto-grade `get_inst_coverage()==100` within N samples, without changing the covergroup. | Debug and transfer | Pass when coverage reaches 100% and the constraints remain legal (illegal_bins never hit). |
| P5 | Write a valid/ready handshake SVA with `disable iff`, `$stable` payload while `valid && !ready`, bounded liveness `##[1:N]`, and a cover sequence. Then debug 4 provided failing traces (a bare-sequence bug, a wrong `|->`/`|=>`, a reset mis-handled with `$past`, a vacuous pass). | Apply and debug | Pass or fail against golden waveforms (pass traces must pass, fail traces must fail at the expected cycle). Enable `labs/assertions` (currently coming_soon). |
| P6 | IPC: build a generator → bounded mailbox → driver with `fork/join_any` timeout and `disable fork`, and expose the handle-aliasing bug. | Apply and debug | Deterministic seed; the grader checks transaction ordering and uniqueness, and that no thread is left alive (`wait fork` completes). |
| P7 | DPI: an imported C reference model (pure function) and a `context` import that calls an exported SV task to wait N clocks. | Apply and transfer | Builds and runs in the lab sandbox; an output compare. |
| P8 | Bridge capstone before I-UVM-1A: a class-based layered SV testbench for a FIFO (reusing `labs/fifo`). | Independent | A scoreboard reports 0 mismatches over 1k random transactions, coverage ≥ 90%, and the assertions bind cleanly. |

The interview and quiz items should also include predict-the-output questions on code shown on the page, once X-01 is fixed. For example: what does `b.print()` print; how many cross bins does this declaration create; on which cycle does this property fail.

---

## 5. Consolidated findings register

| ID | Module | Category | Sev | Conf | One-line |
|---|---|---|---|---|---|
| X-01 | all | Confirmed defect | S1 | High | InteractiveCode renders `[object Object]` or empty (37 blocks) |
| X-02 | all | Confirmed defect | S1 | High | All 21 MDX InterviewQuestionPlaygrounds are blank and unsubmittable |
| X-05 | all | Missing coverage | S1 | High | No graded practice; labs self-attested or coming_soon |
| M4B-01 | 4B | Confirmed defect | S1 | High | Local-variable example asserts a bare sequence and fails every idle cycle |
| M4B-02 | 4B | Confirmed defect | S1 | High | "Local variables can be declared static" is false |
| M5-01 | 5 | Confirmed defect | S1 | High | `->>` described as persistent; persistence is `.triggered` |
| M7-01 | 7 | Confirmed defect | S1 | High | DPI task "blocks on I/O while other SV processes run" is false |
| X-04 | all | Confirmed defect | S2 | High | In-content Next links skip or go backwards |
| M1-01 | 1 | Confirmed defect | S2 | High | `storage s;` marked a syntax error; it is the default specialization |
| M1-03 | 1 | Confirmed defect | S2 | High | Contradictory `super.new()` pitfall |
| M1-05 | 1 | Missing coverage | S2 | High | `clone` claims polymorphic correctness but builds the base type; no virtual `copy` with `$cast` |
| M2A-01 | 2A | Missing coverage | S2 | High | `dist :=` vs `:/` never explained |
| M2A-02 | 2A | Confirmed defect | S2 | High | solve-before described three contradictory ways |
| M2B-01 | 2B | Confirmed defect | S2 | High | "A -> B evaluates A first; B ignored" |
| M2B-02 | 2B | Confirmed defect | S2 | High | "Rand variables unsigned by default" |
| M2B-03 | 2B | Confirmed defect | S2 | Med-High | Random-stability explanation misattributes the cause |
| M2B-06 | 2B lab | Confirmed defect | S2 | High | Lab's "randomize fails" premise is false; assets mismatched |
| M3A-01 | 3A | Confirmed defect | S2 | High | `type_option.auto_bin_max` does not compile |
| M4A-03 | 4A | Confirmed defect | S2 | High | Waveform visualizer calls failing bare sequences "VACUOUS" |
| M4B-03 | 4B | Confirmed defect | S2 | High | Multiclock example asserts a bare sequence |
| M4B-05 | 4A/4B | Missing coverage | S2 | High | No sampled-value functions, repetition, vacuity, `disable iff` semantics |
| M4C-01 | 4C | Confirmed defect | S2 | Med-High | Checker procedural restrictions misstated |
| M5-03 | 5 | Unverified concern | S2 | Medium | `wait(mbx.num()<4)` may never re-evaluate (hang) |
| M5 (gap) | 5 | Missing coverage | S2 | High | No fork/join_any/disable fork/wait fork/process; no mailbox handle aliasing |
| M6-01 | 6 | Confirmed defect | S2 | High | "genvar illegal inside always" is false |
| M7-02 | 7 | Confirmed defect | S2 | High | `svGetIntElement` does not exist |
| M1 (gap) | 1 | Missing coverage | S2 | High | Static members, lifetime/null, `typedef class`, interface classes absent |
| M3A (gap) | 3A | Missing coverage | S2 | High | Auto/wildcard/transition/default bin semantics absent |
| X-03 | all | Confirmed defect | S3 | High | 10 of 11 flashcard IDs unresolved |
| X-06 | many | Confirmed defect | S3 | Med-High | Implicitly static initializers in procedural blocks |
| X-07 | 2B, 9 | Unverified concern | S3 | Med-High | `assert(randomize())` idiom unflagged |
| M1-02 | 1 | Confirmed defect | S3 | High | "pure virtual makes class abstract" |
| M1-04 | 1 | Unverified concern | S3 | Medium | Default arguments on virtual methods presented as normative and "compile-time" |
| M2A-03 | 2A | Confirmed defect | S3 | High | Unbounded `int size` drives array size |
| M2B-05 | 2B | Interaction/design weakness | S3 | High | post_randomize anti-pattern fills a rand array deterministically |
| M3A-02 | 3A | Confirmed defect | S3 | High | Invented `find()`; wrong `type_option` access syntax |
| M3A-03 | 3A | Confirmed defect | S3 | Med-High | "Illegal bins terminate simulation" |
| M3A-05 | 3A | Missing coverage | S3 | Medium | Covergroup sampling-time semantics untaught; double sampling |
| M3B-01 | 3B | Confirmed defect | S3 | Med-High | per_instance requirement omitted; `get_coverage` "merged" wrong by default |
| M3B-02 | 3B | Confirmed defect | S3 | High | UVM coverage example missing utils macro; null vif at construction |
| M3B-04 | 3B lab | Interaction/design weakness | S3 | Medium | Lab cannot reach 100% as instructed |
| M4A-01 | 4A | Confirmed defect | S3 | High | Unclocked property; message mismatch |
| M4A-02 | 4A | Unverified concern | S3 | Medium | Covering an implication; vacuity untaught |
| M4B-04 | 4B | Confirmed defect | S3 | High | `##0` "without advancing time" |
| M5-02 | 5 | Confirmed defect | S3 | Med-High | Wrong `triggered` pitfall; the real zero-delay loop is missing |
| M5-04 | 5 | Confirmed defect | S3 | High | Static task called concurrently in the semaphore example |
| M5-06 | 5 lab | Interaction/design weakness | S3 | High | Seed-dependent bug; read-only asset; wrong post-fix claim |
| M6-02 | 6 | Confirmed defect | S3 | Med-High | bind-in-generate example is broken |
| M7-03 | 7 | Confirmed defect | S3 | High | Export example omits the `context` import; wrong segfault cause |
| M8-01 | 8 | Confirmed defect | S3 | Medium | UPF 1.0 PST mixed with 2.x supply-set states |
| M8-02 | 8 | Interaction/design weakness | S3 | High | UPF orphaned; no SV-side verification or exercise |
| M9-01 | 9 | Confirmed defect | S3 | High | First IEEE UVM was 1800.2-2017 |
| M9-03 | 9 | Missing coverage | S3 | High | No layered-SV-testbench bridge |
| X-08, X-09, M2A-04, M2B-04, M2B-07, M3A-04, M3B-03, M4A-04, M4C-02, M5-05, M6-03, M6-04, M7-04, M9-02 | various | polish / unverified | S4 | Med-High | See module sections |

## 6. Suggested fix order

1. X-01 and X-02 (rendering). Without them, no other content change is visible.
2. The S1 and S2 normative corrections: M4B-01, M4B-02, M4B-03, M5-01, M7-01, M2B-01, M2B-02, M1-01, M3A-01, M6-01, M7-02, M4C-01, M2A-02, plus the M4A-03 visualizer.
3. X-04 (navigation) and X-03 (flashcard IDs).
4. Content gaps:
   - SVA operator lesson (sampled-value functions, repetition, `throughout`/`within`/`intersect`, vacuity, `disable iff` semantics, `assume`);
   - coverage bin semantics (auto, wildcard, transition, default, sampling timing);
   - OOP statics, lifetime, `typedef class`, interface classes, polymorphic copy;
   - process control (fork variants, `disable fork`, `wait fork`, `process`);
   - `dist` semantics.
5. Graded exercises P1, P3, P5 and P8, and repair the 2B, 3B and 5 labs.
6. Clause-citation verification against IEEE 1800-2023 (X-08).
