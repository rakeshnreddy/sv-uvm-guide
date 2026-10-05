# Curriculum spine (2026-10-03)

The reference that every analyst, verifier and author in the [curriculum quality program](README.md) uses to judge whether a lesson achieves its intent. One intent card per module (69), the learner journey, sequencing problems, coverage gaps and cross-cutting standards.

**Branch / snapshot:** `curriculum-quality-program`, 105 MDX files in 69 modules, 29 lab manifests, 67 flashcard decks.

---

## 0. How to use this spine

**Analysts (phase 1).**
- **R1 (intent and objectives):** compare the page's objectives with the card's *Objectives*. The page's "You will be able to" block (§5.4) should restate them at the same level.
- **R2 / S2 (omissions):** a *Must cover* item that is missing or wrong is at least S2.
- **Duplication:** an *Out of scope* item that the page teaches in depth is a duplication finding. Name the owner given here.
- **R6 (practice):** use *Hands-on* and *Assessment focus*. The quiz must target the listed misconceptions.
- **R8 (navigation):** check prerequisite and "Next" links against *Tier / position* and *Prerequisites*.

**Conventions.**
- **nav #k** is the lesson's position in today's generated navigation (`src/lib/curriculum-data.tsx`). It is alphabetical within each tier, because `scripts/generate-curriculum-data.ts` sorts folder names.
- **after / before** in a card give the **intended** order (the spine order, §3.4). Where they differ from nav, the card says so. Proposed new modules (§4.2) are noted in brackets but are not counted as neighbours.
- Every IEEE 1800-2023, IEEE 1800.2-2020, IHI0022E and IHI0033B.b number in this file was checked against the primary text. The index is in Appendix A.
- A bare **§** number means IEEE 1800-2023 in T1, T2-SV and AMBA cards, and IEEE 1800.2-2020 in UVM cards (I-UVM-*, A-UVM-*, the UVM parts of E-*). Annexes B–G are 1800.2; Annexes H–I are 1800-2023. Where a card mixes the two (for example A-UVM-7's §25.8), the SystemVerilog construct makes the source clear.
- **"Verify"** marks a claim the analyst must check before relying on it.
- Kata ids **P1–P8** refer to [audit appendix B §4](../audit/2026-10-03-learning-outcomes/appendices/B-t2-systemverilog.md). Defect ids (D-xx, X-xx, LAB-xx, TRUST-x, PLAT-x, LAB-Mx) refer to the [audit report](../audit/2026-10-03-learning-outcomes/audit-report.md), its appendices and the [improvement plan](../audit/2026-10-03-learning-outcomes/improvement-plan.md). "Appendix A/B" without "audit" means this file.
- **"uvm-core impl."** marks behaviour that exists in the uvm-core 2020.3.1 reference implementation but not in IEEE 1800.2-2020 (for example `+UVM_TIMEOUT`, `+UVM_OBJECTION_TRACE`, `+UVM_PHASE_TRACE`, `+UVM_CONFIG_DB_TRACE`, `check_config_usage()`, `print_config()`). Lessons may teach these, labelled as implementation features.

**Snapshot counts** (measured on this branch; detail in §3 and §5):

| Item | Count |
|---|---|
| Modules / MDX files / sub-lessons | 69 / 105 / 36 (in 14 multi-file modules) |
| Files with all six template H2s in order | 23 of 105 |
| Files with an explicit `#` H1 (forbidden) | 16 (13 of the 14 AMBA-track files, I-SV-8, E-PWR-1, `uvm-virtual-sequencer.mdx`) |
| Files with a "You will be able to" objectives block | 0 |
| Quiz blocks: `questions` prop with `answers[{text,correct}]` / with `options` + numeric index / `<QuizQuestion>` children | 56 / 10 / 13 files (43 questions) |
| Files with no quiz / with 1–3 questions | 27 / 52 |
| Flashcard decks: `{id,question,answer}` / `{front,back}` / orphan JSON (no lesson) | 47 / 20 / 7 |
| Lesson files with no deck reference | 35 (33 sub-lessons, I-SV-8, I-SV-9) |
| Sub-lessons using `export const metadata` + `<InfoPage>` instead of YAML frontmatter | 30 of 36 |
| Labs: available / coming soon / lesson files that link a lab | 21 / 8 / 22 |

---

## 1. Learner journey

Milestones M0–M8 are defined in [`tb-mastery-progression.md`](../audit/2026-10-03-learning-outcomes/tb-mastery-progression.md).

### T1 Foundational (13 modules; proposed F2E)

- **Entry skills:**
  - digital logic (gates, flops, clocks, reset, FSMs);
  - any programming language (variables, loops, functions).
  - No HDL or verification background is assumed.
- **Exit competencies:**
  1. Explain why verification exists, choose among directed, constrained-random and formal methods, and distinguish code coverage from functional coverage (F1A–F1C).
  2. Declare and manipulate SystemVerilog data correctly: 4-state values, nets vs variables, widths and signedness, structs and enums, dynamic arrays, queues and associative arrays (F2A–F2B).
  3. Write procedural testbench code with tasks, functions, system tasks, threads and timeouts that behaves predictably (F2C–F2D).
  4. Predict what happens inside one time slot, and find and fix races (F3A–F3C).
  5. Structure a bench with modules, packages, interfaces, modports and clocking blocks, and drive and sample a DUT race-free (F4A–F4C).
- **Milestones prepared:**
  - **M0**, a self-checking directed TB: F1B, F2A–F2D, proposed F2E.
  - **M1**, a race-aware interface TB with clocking blocks: F3A–F3C, F4A–F4C.
- **Hands to T2:** *a race-free, self-checking, interface-and-clocking-block directed testbench for a small clocked DUT, where the learner can explain every printed value in terms of the scheduler.*

### T2 Intermediate (24 modules; proposed I-UVM-1D and I-UVM-3C)

- **Entry skills:** T1 exit (M0 and M1 demonstrated).
- **Exit competencies, SystemVerilog half (I-SV-1 … I-SV-9).** Build a **class-based layered testbench** with:
  - transaction classes with correct copy semantics;
  - constrained-random stimulus;
  - functional coverage tied to a plan;
  - SVA bound to the DUT;
  - threads synchronized with mailboxes, events and semaphores;
  - an optional DPI reference model.

  Then map that bench onto UVM roles.
- **Exit competencies, UVM half (I-UVM-1A … I-UVM-6):**
  - Build, compile, run and debug a **complete single-agent UVM environment**: top, interface, `uvm_config_db` virtual interface, test, env, agent, driver, monitor, sequencer, sequence, and a scoreboard fed by an analysis FIFO.
  - Choose the test with `+UVM_TESTNAME`, end the test with objections, and decide pass or fail from the report summary.
  - Use factory overrides and configuration objects.
  - Write sequences, including virtual sequences.
- **Milestones prepared:**
  - **M2** starts: first env and active/passive agent.
  - **M4** instruction is complete in I-SV-3A/3B.
  - Groundwork for **M3** (TLM, `compare`) and **M5** (virtual sequences in I-UVM-3B).
- **Hands to T3:** *a runnable single-agent UVM environment that the learner can modify, rerun with a different test and a factory override from the command line, and debug from its log.*

### T3 Advanced (20 modules; proposed A-UVM-9 and B-APB-1)

- **Entry skills:** T2 exit (first runnable UVM env).
- **Exit competencies:**
  1. **M3:** a reference-model scoreboard, in order and keyed out of order, with end-of-test accounting (A-UVM-6).
  2. **M2 complete:** a reusable VIP agent with a config object, reused active and passive (A-UVM-7).
  3. Extend VIP behaviour with callbacks (A-UVM-5); handle mid-test reset and deliberate error injection with expected-error accounting (proposed A-UVM-9).
  4. **M5:** a multi-agent environment with virtual sequences and cross-agent synchronization (A-UVM-8).
  5. **M7:** a RAL-integrated environment with explicit prediction (A-UVM-4A/4B).
  6. **M6:** AMBA protocol knowledge (APB, AHB, AXI) turned into protocol checkers, coverage and an ID-aware out-of-order scoreboard (B-* track).
- **Milestones prepared:** M2 (completion), M3, M5, M6, M7.
- **Hands to T4:** *an independently built, multi-agent, RAL-integrated block environment with protocol checkers, a reference-model scoreboard and a coverage model, which survives a mid-test reset and injected errors without false passes.*

### T4 Expert (12 modules)

- **Entry skills:** T3 exit.
- **Exit competencies:**
  1. Debug at scale: honest pass/fail, catchers, tracing, seeds, triage (E-DBG-1).
  2. Customize methodology for a team (E-CUST-1).
  3. Measure and improve performance (E-PERF-1).
  4. Combine formal and simulation (E-INT-1).
  5. Verify power intent (E-PWR-1, with I-SV-8).
  6. Plan for emulation (E-EMU-1).
  7. Use portable stimulus (E-PSS-1), Python (E-PYUVM-1), multi-language (E-UVM-ML-1), AI-assisted (E-AI-1) and processor (E-RISCV-1) methods with judgement.
  8. Write and defend a subsystem/SoC verification strategy and deliver the code capstone (E-SOC-1).
- **Milestone prepared:** **M8**, the subsystem/SoC capstone (reset, errors, concurrency, closure).
- **Hands to practice:** *staff-level verification ownership: a defended strategy plus an unscaffolded, runner-graded capstone.*

---

## 2. Module intent cards

Cards follow today's **nav order** (#1–#69). Neighbours in *Tier / position* are the intended order (§3.4).

### Tier 1: Foundational

### F1A_The_Cost_of_Bugs — F1A: The Cost of Bugs
- **Tier / position:** T1 · after — (course start) · before F1B · nav #1
- **Purpose (one sentence):** Explain why verification takes a large share of chip-project effort by tracing how a bug's cost and schedule impact grow from RTL to silicon to the field.
- **Objectives (learner will be able to):**
  - Explain how the cost of a bug escalates when it is found at RTL, after tape-out, or in the field.
  - Compare a metal-layer ECO with a full respin: cost, schedule, and which bugs each can fix.
  - Explain "shift left" and name the activities that move bug discovery earlier: planning, simulation, formal, emulation.
  - Describe verification team roles and how verification effort relates to design effort. Figures must be sourced or labelled as illustrative.
- **Must cover:**
  - the design/verification productivity gap;
  - stage-by-stage cost escalation (no unsourced dollar figures);
  - respin types (all-layer vs metal-only ECO) and time-to-market impact;
  - 2–3 cautionary tales with verified facts, and what they had in common (a missing scenario, plan or check);
  - the verification lifecycle (spec → plan → bench → regression → sign-off);
  - industry roles (DV, design, architecture, formal, emulation).
- **Out of scope here (covered in):** methodologies and coverage (F1B); language features (F1C).
- **Prerequisites:** none.
- **Feeds milestone:** — (orientation; motivates M0).
- **Hands-on that should exist:** an estimation exercise: for 4 bug scenarios, choose ECO vs respin and rank the discovery stages by cost and delay. No lab.
- **Assessment focus:** quiz on ECO-vs-respin choice, stage ranking, and why a named bug escaped. Misconceptions:
  1. every silicon fix needs a full respin;
  2. verification is overhead that can be cut when the schedule slips;
  3. passing simulation means correct silicon.
- **Sub-lessons:** — (single file). E2E pins: H1 title, "The Multi-Million Dollar Question", "Design vs. Verification", and the Hall of Shame carousel (Intel Pentium FDIV bug (1994), Ariane 5 Flight 501). See §3.5.

### F1B_The_Verification_Mindset — F1B: The Verification Mindset
- **Tier / position:** T1 · after F1A · before F1C · nav #2
- **Purpose (one sentence):** Think like a verifier: plan to break the design, choose among directed, constrained-random and formal methods, and measure progress honestly with coverage.
- **Objectives (learner will be able to):**
  - Explain why a self-checking test must be able to fail, and show how to prove it by injecting a bug.
  - Compare directed testing, constrained-random verification and formal verification by strength, cost and when each fits.
  - Distinguish code coverage (statement/line, branch, condition/expression, toggle, FSM) from functional coverage, and explain why neither alone means "done".
  - Write a feature-level test-plan table (scenario, check, coverage item) for a small block from a spec excerpt.
- **Must cover:**
  - constructive vs destructive thinking;
  - verification-plan basics, as the entry point to plan → coverage traceability (I-SV-3B);
  - the three methods and how they combine;
  - code vs functional coverage and the "coverage closure trap";
  - self-checking benches, and testbench bugs that make tests unable to fail;
  - bug taxonomy;
  - terms: DUT, testbench, stimulus, checker, scoreboard, coverage;
  - use `$onehot` (IEEE 1800-2023 §20.9), never an invented `one_hot()`.
- **Out of scope here (covered in):** covergroup syntax (I-SV-3A); SVA syntax (I-SV-4A); formal flows (E-INT-1); SV syntax (F2*).
- **Prerequisites:** F1A.
- **Feeds milestone:** M0 (a self-checking bench that fails loudly); M4 framing.
- **Hands-on that should exist:**
  - the "First Bug Hunt" interactive (e2e-pinned test id `first-bug-hunt-game`);
  - a kata: a test plan for a 4-bit counter, reused by M0 (proposed F2E).
- **Assessment focus:** classify scenarios by best method; judge "100% code coverage" claims; spot a checker that can never fail. Misconceptions:
  1. 100% code coverage means verified;
  2. random testing replaces directed tests and formal;
  3. a passing test proves the feature works.
- **Sub-lessons:** — (single file).

### F1C_Why_SystemVerilog — F1C: Why SystemVerilog?
- **Tier / position:** T1 · after F1B · before F2A · nav #3
- **Purpose (one sentence):** Explain what SystemVerilog adds to Verilog for verification and how IEEE 1800, IEEE 1800.2 (UVM) and the Accellera uvm-core library relate.
- **Objectives (learner will be able to):**
  - Explain the relationship between Verilog (IEEE 1364), SystemVerilog (IEEE 1800-2023) and UVM (IEEE 1800.2-2020 plus the uvm-core reference implementation).
  - Match each verification feature to its clause and to the testbench problem it solves:
    - classes (Clause 8) → reuse;
    - constrained randomization (Clause 18) → stimulus breadth;
    - functional coverage (Clause 19) → measurement;
    - assertions (Clause 16) → temporal checking.
  - Explain why some legacy Verilog needs `` `begin_keywords `` (§22.14) to compile as SystemVerilog.
- **Must cover:**
  - standard lineage, with dates and donors verified: IEEE 1800 absorbed IEEE 1364 in 1800-2009;
  - SV as a unified design and verification language;
  - UVM as a separate standard and library;
  - tiny previews of the four features;
  - (P2) awareness of 1800-2023 additions: triple-quoted strings §5.9, weak references §8.30, `:initial/:extends/:final` method specifiers §8.20, array `map()` §7.12.5.
- **Out of scope here (covered in):** every feature's syntax (F2A onward); UVM (I-SV-9 onward).
- **Prerequisites:** F1B.
- **Feeds milestone:** — (orientation).
- **Hands-on that should exist:**
  - a problem → feature matching drill;
  - a "will this Verilog-2001 file compile as SV?" exercise (identifiers that are now keywords).
  - The `verilog-vs-sv` visual is e2e-pinned.
- **Assessment focus:** misconceptions:
  1. SystemVerilog is only a verification language (or only a design language);
  2. UVM is part of IEEE 1800;
  3. Verilog code cannot run in a SystemVerilog simulator.
- **Sub-lessons:** — (single file). Today it has no quiz.

### F2A_Core_Data_Types — F2A: Core Data Types
- **Tier / position:** T1 · after F1C · before F2B · nav #4
- **Purpose (one sentence):** Choose the right SystemVerilog data type by predicting how 4-state values, nets vs variables, aggregate types, widths and signedness behave in testbench and RTL code.
- **Objectives (learner will be able to):**
  - Predict results of operations on `x`/`z`, including `==` vs `===`, `!=` vs `!==`, `==?`, and X in `if`/`case` conditions.
  - Choose a net or a variable for a signal from its drivers. Explain the variable rule (one continuous driver, or any number of procedural writers; §6.5) against net resolution (§6.6).
  - Predict the width, signedness and stored value of an expression after extension or truncation (§11.6, §11.8, §11.7).
  - Write declarations with `logic`, 2-state types, enums, `typedef`, packed/unpacked structs and packed arrays, and cast safely (`type'(…)` §6.24.1; `$cast` for enums §6.24.2).
  - Debug a reset bug hidden by a 2-state type.
- **Must cover:**
  - 0/1/x/z and 2-state vs 4-state conversion;
  - net types and strengths (awareness) vs variables, and the driver rules (§6.5–§6.8);
  - integer types and signedness (§6.11);
  - literals and fill literals `'0 '1 'x 'z` (§5.7);
  - operators: equality and wildcard equality (§11.4.5, §11.4.6), set membership `inside` (§11.4.13);
  - expression sizing and signedness (§11.6–§11.8);
  - packed vs unpacked fixed-size arrays (§7.4);
  - `typedef` (§6.18); enums and their methods (§6.19);
  - structs (§7.2) and packed unions (§7.3; tagged awareness) — **missing today**;
  - strings (§6.16); casting (§6.24); X-optimism and X-pessimism.
  - The model-backed visuals (NetResolutionSimulator, OperatorExplorer, SignednessVisualizer) must be used for prediction.
- **Out of scope here (covered in):** dynamic arrays, queues, associative arrays (F2B); class handles and class `$cast` (I-SV-1); procedural statements (F2C); streaming operators and bit-stream casting (proposed F2A `operators-and-expressions.mdx` sub-lesson, §4).
- **Prerequisites:** F1C.
- **Feeds milestone:** M0.
- **Hands-on that should exist:**
  - predict tasks on the three visuals;
  - a kata: a packed-struct bus transaction printed with `%p`;
  - an "X masked by 2-state" debug challenge (not built).
  - Lab `common-1` (coming soon; structs, enums, arrays) belongs here, not to F2C.
- **Assessment focus:** quiz must include `4'b10x1 == 4'b10x1` vs `===`; the result width of `a + b` assigned to a narrower and to a wider target; which declaration accepts two continuous drivers. Misconceptions:
  1. a `logic` variable can take two `assign` drivers and resolve like a wire;
  2. `bit`/`int` show X before reset;
  3. an expression's width is its widest operand regardless of context, or one unsigned operand cannot change signed arithmetic.
- **Sub-lessons:** — (single file). Proposed (§4): `structs-unions-enums.mdx` (P0) and `operators-and-expressions.mdx` (P1; reuse the orphan deck `F2C_Operators.json`). E2E pins: Quick Take, `curriculum-data-type-explorer`, `data-type-quiz` (§3.5).

### F2B_Dynamic_Structures — F2B: Dynamic Data Structures
- **Tier / position:** T1 · after F2A · before F2C · nav #5
- **Purpose (one sentence):** Choose and use dynamic arrays, queues and associative arrays for testbench data, predicting the result of every manipulation method.
- **Objectives (learner will be able to):**
  - Choose fixed array, dynamic array, queue or associative array for a TB use: stimulus list, FIFO model, sparse memory, expected-by-ID table.
  - Predict contents after:
    - `new[N]` with and without `(old)`;
    - queue `push_*`/`pop_*`/`insert`/`delete` and slicing;
    - a write past a bounded queue's bound (§7.10.5: excess discarded, warning);
    - associative `exists/delete/first/next`.
  - Write a sparse memory model and an expected-transaction tracker (associative array of queues) with a leftover check at the end.
  - Use array methods (`find*`, `sort`, `unique`, `sum() with`, `item.index`; 2023 `map()` awareness) and predict their result types (§7.12).
  - Debug silent bugs: a wiped dynamic array, a missing-key read (default value plus warning, §7.8.6), deleting while iterating.
- **Must cover:**
  - dynamic arrays (§7.5); associative arrays and methods (§7.8, §7.9); queues (§7.10, §7.10.5);
  - array querying functions (§7.11); manipulation methods (§7.12.1–§7.12.5);
  - arrays as subroutine arguments, by value vs `ref` (§7.7);
  - performance trade-offs, labelled as implementation-dependent.
  - Use the model-backed visuals (DynamicStructureVisualizer, QueueOperationLab, ArrayMethodExplorer, SystemVerilog3DVisualizer).
- **Out of scope here (covered in):** fixed packed/unpacked arrays (F2A); classes and handles (I-SV-1); UVM scoreboards (A-UVM-6). **Today the scoreboard example is a `uvm_component`** with `` `uvm_error ``/`check_phase`; rewrite it in plain SV.
- **Prerequisites:** F2A.
- **Feeds milestone:** M0 (expected-value queue); M3 precursor (keyed matching).
- **Hands-on that should exist:**
  - predict tasks on the visuals;
  - a kata: plain-SV in-order and by-ID expected trackers with an end-of-test leftover report.
- **Assessment focus:** predict a queue after a sequence of operations; the overflow in `sum()` of a byte array (the result has the element type unless `with (int'(item))`, §7.12.3). Misconceptions:
  1. `new[N]` resizes and keeps the contents;
  2. reading a missing associative key is an error or returns X;
  3. `sum()` returns a wide integer.
- **Sub-lessons:** — (single file). E2E pins: the bounded-queue and container labs, ArrayMethodExplorer, and a 3D canvas (§3.5).

### F2C_Procedural_Code_and_Flow_Control — F2C: Procedural Code and Flow Control
- **Tier / position:** T1 · after F2B · before F2D · nav #6
- **Purpose (one sentence):** Write procedures, assignments, flow control and fork/join threads whose behavior you can predict, including race-safe timeouts.
- **Objectives (learner will be able to):**
  - Choose `initial`, `always_comb`, `always_ff`, `always_latch` or `final` and the matching assignment (`=` vs `<=`), and justify the choice for RTL and TB code.
  - Predict values and printed output for code that mixes blocking and nonblocking assignments in one time slot. This is at the "NBA updates after all active evaluation" level; the region detail belongs to F3B.
  - Predict when the parent resumes for `fork…join/join_any/join_none`, and write an isolated per-transaction timeout (`fork begin fork … join_any; disable fork; end join`).
  - Debug the fork-in-loop capture bug and a `disable fork` that kills a long-lived monitor.
  - Write flow control (flow-control page):
    - `if` and `case`/`casez`;
    - `unique`/`unique0`/`priority` with their runtime violation semantics;
    - `case inside`;
    - loops with `break`/`continue`.
- **Must cover:**
  - structured procedures (§9.2, §9.2.1–§9.2.3) and `always_comb` vs `always @*`;
  - blocking vs nonblocking (§10.4.1, §10.4.2);
  - block statements and named blocks (§9.3);
  - parallel blocks (§9.3.2): spawned processes start when the parent blocks;
  - `wait fork` (§9.6.1), `disable` and its static-name hazard (§9.6.2), `disable fork` (§9.6.3);
  - timing controls `#`, `@`, `wait` (§9.4);
  - FSM coding (the sequence-detector case study);
  - flow control (§12.4, §12.4.2, §12.5, §12.5.3, §12.5.4, §12.7, §12.8);
  - X in conditions takes the `else` branch; `casex` hazards.
- **Out of scope here (covered in):**
  - the full region model (F3B). "Timeline of a Simulation Tick" and the Scheduler Game stay only as a labelled preview; both are e2e-pinned, §3.5.
  - delta cycles and races (F3C); `process` class and IPC (I-SV-5); tasks and functions (F2D).
- **Prerequisites:** F2A.
- **Feeds milestone:** M0 (TB control flow, timeouts); M1 (NBA discipline).
- **Hands-on that should exist:**
  - the ForkJoinVisualizer debug mode ("monitor that went silent");
  - a kata: convert a racy blocking `always` into `always_ff` and predict the outputs;
  - a kata: `wait_for_response(timeout)` with isolation.
  - No lab fits today; `common-1` belongs to F2A.
- **Assessment focus:** the swap with `=` vs `<=`; when the parent prints under `join_none`; fork-in-loop output; which threads `disable fork` kills; an unmatched `unique case`. Misconceptions:
  1. a nonblocking assignment updates later in simulated time;
  2. `join_none` children start running immediately;
  3. `disable fork` kills only the most recent fork's children;
  4. `unique` is only a synthesis hint.
- **Sub-lessons:**
  - `index.mdx`: procedures, assignments, fork/join.
  - `flow-control.mdx`: decisions and loops. It is missing `Build Your Mental Model`, `Make It Work`, `Push Further` and the full References H2.

  Order index → flow-control is correct.

### F2D_Reusable_Code_and_Parallelism — F2D: System Tasks and File I/O
- **Tier / position:** T1 · after F2C · before F3A (proposed F2E between) · nav #7
- **Purpose (one sentence):** Package reusable bench behavior into tasks and functions, and use system tasks to observe, report, end and feed a simulation.
- **Objectives (learner will be able to):**
  - Write tasks and functions with the right lifetime: module subroutines are static unless `automatic` (§13.3.1). Use argument directions including `ref`/`const ref` (§13.5.2), defaults (§13.5.3) and named binding (§13.5.4), and explain why a function cannot consume time.
  - Choose among `$display/$write/$strobe/$monitor` and `$info/$warning/$error/$fatal` (§21.2, §20.10), and predict what each prints and when.
  - Write file-driven and command-line-driven tests:
    - `$fopen/$fdisplay/$fscanf/$fclose` with return checks (§21.3);
    - `$readmemh` (§21.4);
    - `$value$plusargs`/`$test$plusargs` (§21.6).
  - Control the end of simulation and visibility: `$finish/$stop` (§20.2), `$time/$realtime` (§20.3), `$timeformat` (§20.4), `$dumpfile/$dumpvars` (§21.7).
  - Debug a static task shared by two concurrent callers.
- **Must cover:**
  - tasks (§13.3) and functions (§13.4, §13.4.1);
  - argument passing (§13.5);
  - format specifiers (`%0d %h %b %t %s %p`);
  - `$strobe/$monitor` timing, with region detail in F3B;
  - `$error` continues and `$fatal` ends;
  - `$urandom/$urandom_range` basics (§18.13);
  - no initializers on static procedural variables (audit X-06).
- **Out of scope here (covered in):** class `$cast` (I-SV-1; enum casting is F2A's). Today the index shows `BaseClass`/`DerivedClass` downcasting before OOP; remove it. Also out of scope: IPC (I-SV-5); constrained randomization (I-SV-2A); UVM reporting (proposed I-UVM-1D).
- **Prerequisites:** F2C.
- **Feeds milestone:** M0. If proposed F2E is rejected, the M0 bench assembly lands in this module's Make It Work.
- **Hands-on that should exist:**
  - Lab `basics-1` fits `tasks-functions.mdx`: refactor a counter TB into `task automatic drive_sequence`. Its grader matches the tokens `int myVar ;` and must be replaced (D-13, LAB-M0).
  - a kata: a plusarg-selected, file-driven test with an expected-value check.
- **Assessment focus:** `$display` vs `$strobe` at an NBA update; what `$error` does; what `$fscanf` returns; a static task with two callers. Misconceptions:
  1. `$error` stops the simulation;
  2. module tasks and functions are automatic by default;
  3. a function can wait for a clock edge.
- **Sub-lessons:** intended order index → tasks-functions → ipc (nav today: index → ipc → tasks-functions).
  - `index.mdx`: module overview, system tasks, reporting, file and command-line I/O, simulation control, waveform dumping.
  - `tasks-functions.mdx`: subroutines, lifetime, argument passing; owns `basics-1`. It lacks `Make It Work`, `Practice & Reinforce` and the full References H2.
  - `ipc.mdx`: a labelled foundation-level first look at events, semaphores and mailboxes that links forward to I-SV-5 for depth (lead decision, plan.md §1 topic ownership; this supersedes the earlier "merge into I-SV-5 and redirect" proposal). Keep its e2e pins: the "Interprocess Communication" heading, one default-mode `<MailboxSemaphoreGame />` region, and the link from the index.

### F3A_Simulation_Semantics — F3A: Simulation Semantics
- **Tier / position:** T1 · after F2D (proposed F2E between) · before F3B · nav #8
- **Purpose (one sentence):** Explain how an event-driven simulator advances time, how time units and precision shape delays, and why zero-time iterations exist.
- **Objectives (learner will be able to):**
  - Explain event-driven simulation: what wakes a process, and that time advances only when no events remain in the current time slot.
  - Calculate the effective delay of `#d` under `` `timescale `` or `timeunit`/`timeprecision`, including rounding (§3.14, §22.7).
  - Predict `$time`, `$stime` and `$realtime` output for fractional delays in modules with different time units, and format it with `$timeformat` (§20.3, §20.4).
  - Distinguish simulation time from zero-time iterations (delta cycles), and predict which statements execute at the same simulation time.
- **Must cover:**
  - event-driven vs cycle-based simulation;
  - update vs evaluation events, at concept level;
  - time units and precision across modules; `$printtimescale` (§20.4.2);
  - a preview of `#0` and delta cycles, with detail in F3B/F3C;
  - why simulator-independent behavior matters.
- **Out of scope here (covered in):** the region list (F3B); races and fixes (F3C); clocking blocks (F4C).
- **Prerequisites:** F2C, F2D.
- **Feeds milestone:** M1.
- **Hands-on that should exist:**
  - timescale prediction items (two modules, different units);
  - a kata: print `$time` vs `$realtime` and explain the rounding.
  - F3A has no interactive; add PredictionPrompt-style items.
- **Assessment focus:** `#1.55` under 1ns/100ps; `$time` after `#1.5` in a 1ns-unit module; whether delta cycles advance time. Misconceptions:
  1. time advances after every statement;
  2. delta cycles take simulated time;
  3. `$time` reports in the precision unit.
- **Sub-lessons:** — (single file).

### F3B_Scheduling_Regions — F3B: Scheduling Regions
- **Tier / position:** T1 · after F3A · before F3C · nav #9
- **Purpose (one sentence):** Place any statement or construct in the correct scheduling region of a time slot, and use the model to explain sampling and drive timing.
- **Objectives (learner will be able to):**
  - Name the regions in order: Preponed, Active, Inactive, NBA, Observed, Reactive, Re-Inactive, Re-NBA, Postponed. Name the active and reactive region sets (§4.4.1, §4.4.2.1–§4.4.2.9).
  - Predict where each construct executes:
    - `#0` (Inactive);
    - NBA updates;
    - concurrent-assertion evaluation (Observed) using Preponed samples (§16.5.1);
    - program-block code and blocking assignments in checkers (Reactive; §4.4.2.6);
    - clocking-block drives (Re-NBA, §14.16);
    - `$strobe`/`$monitor` (Postponed).
  - Trace the reference algorithm's iteration back to Active (§4.5).
  - Explain what the LRM guarantees (§4.6) and leaves nondeterministic (§4.7), and why program and clocking blocks were introduced (§24.4).
- **Must cover:**
  - §4.4 and its subclauses, PLI regions (awareness, §4.4.3), §4.5, §4.6, §4.7, §4.9;
  - `#1step` equals Preponed sampling;
  - assertion action blocks run in Reactive;
  - `final` runs at end of simulation, not in a region (§9.2.3);
  - SVSchedulerRegionVisualizer;
  - the EventRegionGame belongs here (§3.1).
- **Out of scope here (covered in):** races and fixes (F3C); clocking-block syntax (F4C); SVA syntax (I-SV-4A).
- **Prerequisites:** F3A.
- **Feeds milestone:** M1.
- **Hands-on that should exist:**
  - visualizer predictions;
  - the EventRegionGame (model-generated);
  - a kata: label the region of each update in a 6-line snippet, then confirm with `$display` vs `$strobe` on a simulator.
- **Assessment focus:** misconceptions:
  1. concurrent assertions sample in Observed (they sample Preponed and evaluate in Observed);
  2. `final` runs in Postponed;
  3. clocking-block drives land in NBA, or depend on the caller's region (they mature in Re-NBA);
  4. Re-NBA is part of the Reactive region (it is a separate region of the reactive set).
- **Sub-lessons:** — (single file). Keep the `sources:` frontmatter (QA-pinned, §5.7).

### F3C_Delta_Cycles_and_Race_Conditions — F3C: Delta Cycles and Race Conditions
- **Tier / position:** T1 · after F3B · before F4A · nav #10
- **Purpose (one sentence):** Predict, reproduce and fix race conditions by reasoning about delta cycles and the LRM's ordering freedom.
- **Objectives (learner will be able to):**
  - Trace one clock edge through the time slot's iterations and predict every variable's final value.
  - Identify a race: two processes on the same event whose result depends on their order (§4.7, §4.8). Prove it by exploring all legal orders.
  - Debug TB races:
    - blocking drives at the active edge;
    - `#0` workarounds;
    - reads of signals driven by blocking RTL.

    Choose a hardware-faithful fix.
  - Write race-free code: flops with `<=`; TB drives with NBA or, from F4C, through a clocking block (Re-NBA writes, Preponed reads).
- **Must cover:**
  - time slot vs delta cycle;
  - Active-region ordering freedom;
  - NBA as the flop-to-flop cure;
  - which TB patterns race and which are deterministic: reading NBA-driven outputs at `@(posedge clk)` is deterministic;
  - `#0` (Inactive) as a fragile non-fix;
  - `$display` vs `$strobe`;
  - the race-free checklist;
  - the five model-driven visuals and two katas.
- **Out of scope here (covered in):** clocking-block skews (F4C); region definitions (F3B); SVA sampling (I-SV-4A).
- **Prerequisites:** F3B.
- **Feeds milestone:** M1.
- **Hands-on that should exist:**
  - RaceDebugChallenge (model-graded; pre-lab gate for LAB-M1);
  - Kata 1 (guided) and Kata 2 (independent).
  - LAB-M1 is owned by F4C (§2 F4C, Appendix B).
- **Assessment focus:** misconceptions:
  1. `<=` everywhere removes all races;
  2. simulators run same-event processes in source order;
  3. `#0` reliably fixes a race.
- **Sub-lessons:** — (single file). This is the reference lesson for the target pattern.

### F4A_Modules_and_Packages — F4A: Structuring Designs with Modules and Packages
- **Tier / position:** T1 · after F3C · before F4B · nav #11
- **Purpose (one sentence):** Structure designs and benches with parameterized modules and shared packages while avoiding port-kind, import and compile-order traps.
- **Objectives (learner will be able to):**
  - Write a parameterized module with ANSI ports and instantiate it with named, `.name` and `.*` connections and parameter overrides (§23.2, §23.3.2.2–§23.3.2.4, §23.10).
  - Explain why an `input logic` port defaults to a net and an `output logic` port to a variable (§23.2.2.3), and the multi-driver consequence.
  - Write a package of types, constants and functions. Choose explicit import, wildcard import or `pkg::item`, and predict name resolution and collisions (§26.2, §26.3, §26.5).
  - Debug compile-order errors and the "same `` `include `` in two packages makes two incompatible types" trap.
- **Must cover:**
  - port declarations (§23.2.2);
  - parameters, `localparam` and type parameters (§6.20.2–§6.20.4);
  - hierarchical names and `$root` (§23.6), discouraged in reusable code;
  - scope rules (§23.9);
  - package export (§26.6) and the `std` package (§26.7);
  - `` `include `` vs `import`;
  - `` `default_nettype none `` as a practice (owned by I-SV-6).
- **Out of scope here (covered in):**
  - `` `define ``/`` `ifdef ``/macro hygiene (I-SV-6). Today F4A's "Compiler Directives & Scope" duplicates it; reduce to a link.
  - interfaces (F4B); class scope `::` (I-SV-1); `bind` (I-SV-4C); generate (I-SV-6).
- **Prerequisites:** F2A, F2D.
- **Feeds milestone:** M1 (bench = package + interface + top).
- **Hands-on that should exist:**
  - a kata: refactor a bench into `tb_pkg` (transaction struct plus checker function);
  - a predict-the-compile-error drill: two wildcard imports of one name, and local shadowing.
- **Assessment focus:** misconceptions:
  1. importing two packages that define the same name is always an error (only when the name is referenced; explicit imports and local declarations win);
  2. `include`-ing a typedef into two packages gives one shared type;
  3. an `input logic` port can be driven procedurally inside the module.
- **Sub-lessons:** — (single file). E2E pins: H1 title text and the text "The fundamental building blocks of SystemVerilog".

### F4B_Interfaces_and_Modports — F4B: Bundling Signals with Interfaces and Modports
- **Tier / position:** T1 · after F4A · before F4C · nav #12
- **Purpose (one sentence):** Bundle DUT signals into interfaces with modports and tasks, and connect class-based bench code to them through virtual interfaces.
- **Objectives (learner will be able to):**
  - Write an interface with ports, signals and master, slave and monitor modports, and connect it to a DUT and a bench (§25.3–§25.5).
  - Explain what a modport restricts and what it does not (it is a direction view, not storage), and debug a modport-direction violation.
  - Explain a virtual interface as a handle to an interface instance (§25.9, §25.9.1). Bind it from the top module and debug the null-virtual-interface run-time failure.
  - Write a valid/ready handshake task inside an interface that cannot deadlock (VALID never waits on READY).
- **Must cover:**
  - ports in interfaces (§25.4);
  - clocking blocks in modports (§25.5.5);
  - tasks in interfaces (§25.7);
  - parameterized interfaces (§25.8);
  - access rules (§25.10);
  - modport-typed virtual interfaces;
  - ModportExplorer and the InterfaceSignalFlow practice route.
- **Out of scope here (covered in):**
  - clocking-block timing (F4C); class syntax (I-SV-1);
  - `uvm_config_db` virtual-interface passing (I-UVM-2C). Today F4B shows `config_db` code; keep only a labelled forward link.
  - SVA in interfaces (I-SV-4A, A-UVM-7).
- **Prerequisites:** F4A. Uses minimal class syntax; label it as a preview of I-SV-1.
- **Feeds milestone:** M1.
- **Hands-on that should exist:**
  - InterfaceSignalFlow debug cases (null vif, modport direction);
  - a kata: replace 12 port connections with one interface plus modports.
  - The refactor lab promised on the page does not exist.
- **Assessment focus:** misconceptions:
  1. a modport copies the signals or creates storage;
  2. a virtual interface is a copy of the interface;
  3. a null virtual interface is caught at elaboration.
- **Sub-lessons:** — (single file). E2E pins: H1 title text and "Modport Explorer".

### F4C_Clocking_Blocks — F4C: Synchronizing with Clocking and Program Blocks
- **Tier / position:** T1 · after F4B · before I-SV-1 (end of T1) · nav #13
- **Purpose (one sentence):** Drive and sample DUT signals race-free with clocking blocks, understand program blocks, and complete the M1 race-aware interface testbench.
- **Objectives (learner will be able to):**
  - Write a clocking block with input and output skews. Predict when inputs are sampled (`#1step` is Preponed; explicit `#0` input skew samples in Observed) and when outputs change (Re-NBA, §14.16).
  - Predict when `@(cb)` resumes (Observed, §14.10) relative to `@(posedge clk)`, and use `##N` with a default clocking (§14.11, §14.12).
  - Write a driver and a monitor that touch DUT signals only through `vif.cb`/`vif.mon_cb`. Use the task form for M1; a class form is labelled as a preview.
  - Convert a racy bench (blocking drives at `@(posedge clk)`) into a clocking-block bench, and explain why results no longer depend on simulator or source order.
  - Explain program blocks (§24.3, §24.4): they are not deprecated, and modern UVM benches use modules or classes with clocking blocks instead.
- **Must cover:**
  - clocking-block declaration and skews (§14.3, §14.4);
  - hierarchical expressions, multiple and interface clocking blocks (§14.5–§14.9);
  - input sampling (§14.13);
  - global clocking (§14.14, awareness);
  - several synchronous drives to one signal in a cycle;
  - asynchronous reset driven outside the clocking block;
  - ClockingBlockSkewVisualizer.
- **Out of scope here (covered in):** region definitions (F3B); race theory (F3C); UVM agents (I-UVM-2A); SVA clocking (I-SV-4A).
- **Prerequisites:** F3C, F4B.
- **Feeds milestone:** M1 (gate).
- **Hands-on that should exist:** **LAB-M1 "Race-Free Pipeline TB"** (not built). Lab `constructs-1` (coming soon; it already has `lab1_race_condition`) should be re-owned here; F3C's RaceDebugChallenge is the pre-lab gate. Also the skew-visualizer predictions.
- **Assessment focus:** misconceptions:
  1. clocking-block outputs change in Active or NBA;
  2. `@(cb)` and `@(posedge clk)` resume at the same point;
  3. `##N` works without a default clocking (it is a compile error);
  4. program blocks are deprecated.
- **Sub-lessons:** — (single file). E2E pins: H1 title text and "The Race Condition Problem".

### Tier 2: Intermediate

### I-SV-1_OOP — I-SV-1: Object-Oriented Programming for Verification
- **Tier / position:** T2 · after F4C · before I-SV-2A · nav #14
- **Purpose (one sentence):** Model verification data and components as classes, reasoning precisely about handles, lifetime, copying, inheritance and polymorphic dispatch.
- **Objectives (learner will be able to):**
  - Predict the effect of handle assignment, `new`, shallow copy (`new obj`) and a deep `copy()` on nested objects (§8.12).
  - Write a class hierarchy with:
    - `virtual` methods (§8.20);
    - constructors chaining `super.new` (§8.17);
    - `local`/`protected` members (§8.18);
    - static members (§8.9, §8.10).
  - Predict which method a base-handle call runs, and write a checked downcast with `$cast` as a function (§6.24.2, §8.16).
  - Write polymorphic `copy()`/`clone()` and a parameterized class, and explain per-specialization statics (§8.25).
  - Debug a scoreboard whose stored expected items change because the producer reuses one object.
- **Must cover:**
  - class, object and handle (§8.2–§8.6); constructors (§8.7); `this` (§8.11); inheritance (§8.13); overridden members (§8.14); `super` (§8.15);
  - `const` properties (§8.19);
  - abstract classes and `pure virtual` (§8.21); polymorphism (§8.22);
  - class scope `::` (§8.23); `extern` methods (§8.24);
  - interface classes (§8.26); `typedef class` (§8.27); classes vs structs (§8.28);
  - memory management (§8.29);
  - 1800-2023 additions (awareness): weak references (§8.30) and `:initial/:extends/:final` (§8.20);
  - the default-argument trap on virtual methods (verify the claim against the LRM; audit U-02);
  - a virtual-interface handle inside a class (links to F4B);
  - ObjectHandleVisualizer and PolymorphismDispatchVisualizer.
- **Out of scope here (covered in):** randomization (I-SV-2A); covergroups in classes (I-SV-3A); UVM object methods and the factory (I-UVM-1A/1B); threads and mailboxes (I-SV-5).
- **Prerequisites:** F2B, F2D, F4B.
- **Feeds milestone:** M2 (components as classes); M3 (copy before store).
- **Hands-on that should exist:**
  - predict tasks on both visuals;
  - the existing "Debug it" scoreboard-aliasing exercise;
  - a kata: a transaction with `copy/clone/compare/convert2string` and a generator that clones before storing.
- **Assessment focus:** misconceptions:
  1. assigning a handle copies the object;
  2. `new obj` copies nested objects;
  3. a non-virtual method called through a base handle runs the derived version;
  4. `$cast` as a task returns 0 on failure (the task form raises a run-time error).
- **Sub-lessons:** intended order constructors → polymorphism-pitfalls → copying-and-cloning → parameterized-classes. Nav today puts copying-and-cloning before polymorphism-pitfalls, although `clone()` needs virtual dispatch and `$cast`.
  - `constructors.mdx`: `new`, initialization order, `this`, `super`, chaining.
  - `polymorphism-pitfalls.mdx`: virtual vs non-virtual, up and down casts, `$cast`, the default-argument trap.
  - `copying-and-cloning.mdx`: handle copy, shallow and deep, polymorphic `clone()`.
  - `parameterized-classes.mdx`: generic classes, default specialization, per-specialization statics, abstract classes.

  All four use `export const metadata` plus `<InfoPage>` (a duplicate H1) and have no flashcards (§5.3).

### I-SV-2A_Constrained_Randomization_Fundamentals — I-SV-2A: Constrained Randomization Fundamentals
- **Tier / position:** T2 · after I-SV-1 · before I-SV-2B · nav #15
- **Purpose (one sentence):** Describe legal stimulus with random variables and constraint blocks, and shape value distributions without changing what is legal.
- **Objectives (learner will be able to):**
  - Write a transaction class with:
    - `rand`/`randc` fields (§18.4.1, §18.4.2);
    - constraint blocks with `inside` ranges and relations (§18.5);
    - bounded array sizes.
  - Predict frequencies for `dist` with `:=` vs `:/` (§18.5.3) and under `solve…before` (§18.5.9), and explain why neither changes the legal set.
  - Use `soft` constraints (§18.5.13) and inline `randomize() with {…}` with `local::` (§18.7), predicting when a soft constraint is dropped.
  - Handle randomization failure: check the return value with `if (!obj.randomize()) …`. Avoid `assert(obj.randomize())`: assertion control (§20.11, which covers simple immediate assertions) or a tool switch can disable the assertion together with its side effect, and a failure becomes an assertion message instead of a test error.
- **Must cover:**
  - concepts (§18.3); external constraint blocks (§18.5.1);
  - the `randomize()` return value (§18.6.1);
  - the solution-space view (ConstraintSolverExplorer, exact enumeration);
  - patterns: alignment, legal opcode sets, weighted modes.
- **Out of scope here (covered in):** implication, `if/else`, `foreach`, `unique`, functions in constraints, `rand_mode`/`constraint_mode`, `pre/post_randomize`, `std::randomize`, randcase/randsequence and seeding (I-SV-2B); UVM item randomization (I-UVM-3A).
- **Prerequisites:** I-SV-1.
- **Feeds milestone:** M2 (sequence items); M4 (stimulus shaping).
- **Hands-on that should exist:**
  - solver-visual predictions;
  - kata P1/P2 from audit appendix B §4: an `axi_txn` with `dist`/`soft`, then predict the distribution.
- **Assessment focus:** misconceptions:
  1. `soft` means "usually", as a probability;
  2. `:=` and `:/` are the same for ranges;
  3. `solve a before b` changes which combinations are legal;
  4. `randc` cycles across different objects.
- **Sub-lessons:** `constraint-blocks.mdx` covers constraint blocks, `soft`, array-size bounds and `solve…before`. It uses Level 1/2/3 structure, the InfoPage wrapper and has 1 quiz question. Order index → constraint-blocks is correct.

### I-SV-2B_Advanced_Constrained_Randomization — I-SV-2B: Advanced Constrained Randomization
- **Tier / position:** T2 · after I-SV-2A · before I-SV-3A · nav #16
- **Purpose (one sentence):** Express conditional, iterative and inherited constraints, control randomization at run time, and diagnose solver failures and seed irreproducibility.
- **Objectives (learner will be able to):**
  - Write conditional constraints with `->` and `if/else` (§18.5.5, §18.5.6), and predict them as bidirectional logic rather than procedural order.
  - Write array constraints with `foreach`, `size()`, `sum() with`, and `unique` (§18.5.7, §18.5.4).
  - Control randomization with:
    - `rand_mode`/`constraint_mode` (§18.8, §18.9);
    - `pre_randomize`/`post_randomize` (§18.6.2);
    - constraint override in subclasses (§18.5.2);
    - inline random-variable control and `randomize(null)` (§18.11).
  - Use `std::randomize` (§18.12), `randcase` (§18.16) and `randsequence` (§18.17).
  - Debug a failing `randomize()` by isolating conflicts, checking signedness and overridden constraints. Reproduce a failure from its seed, explaining random stability (§18.14) and manual seeding (§18.15).
- **Must cover:**
  - global constraints (§18.5.8); static constraint blocks (§18.5.10);
  - functions in constraints (§18.5.11); constraint guards (§18.5.12);
  - dynamic constraint modification (§18.10);
  - why adding one `randomize()` call can change later values;
  - seed plusargs are simulator-specific (label them).
- **Out of scope here (covered in):** `dist`/`soft`/`solve before` basics (I-SV-2A); coverage feedback (I-SV-3B); UVM sequences (I-UVM-3A).
- **Prerequisites:** I-SV-2A.
- **Feeds milestone:** M2; M4.
- **Hands-on that should exist:**
  - Lab `randomization-advanced-1` (owned; its premise must be fixed);
  - the solver-debug conflict drill;
  - a kata: a burst transaction with implication and `foreach` rules.
- **Assessment focus:** misconceptions:
  1. `A -> B` evaluates A first and only forces B (the solver may make A false);
  2. `rand` variables are unsigned;
  3. `post_randomize` can change this call's constraints;
  4. a seed reproduces a run even after the code changes.
- **Sub-lessons:** order is correct.
  - `index.mdx`: a 25-line hub with no Make It Work. Give it the module objectives, an integrating example and the quiz.
  - `advanced-constraints.mdx`: implication, `if/else`, `foreach`, `unique`, `sum() with`.
  - `controlling-randomization.mdx`: `rand_mode`/`constraint_mode` plus `pre/post_randomize`. Retitle if it gains the modes.
  - `randomization-methods.mdx`: `std::randomize`, randcase, randsequence, seeds and stability.
  - `solver-debug.mdx`: failure triage; owns the lab link.

### I-SV-3A_Functional_Coverage_Fundamentals — I-SV-3A: Functional Coverage Fundamentals
- **Tier / position:** T2 · after I-SV-2B · before I-SV-3B · nav #17
- **Purpose (one sentence):** Turn verification-plan items into covergroups whose bins, crosses and sampling you can predict and justify.
- **Objectives (learner will be able to):**
  - Write coverpoints with explicit, automatic, array, transition and wildcard bins (§19.5.1–§19.5.4), and predict the bin count and coverage for a given sample stream (§19.11).
  - Write crosses with `binsof`/`intersect`, exclude combinations with `ignore_bins`/`illegal_bins` (§19.6, §19.6.1, §19.5.5, §19.5.6), and predict the cross-bin count.
  - Choose the sampling method and predict when samples happen:
    - a clocking event;
    - `sample()`;
    - an overridden `sample(…)` with arguments (§19.8.1);
    - `iff`.
  - Configure `at_least`, `auto_bin_max`, `weight`, `goal`, `per_instance` and `comment`, and explain `option` vs `type_option` (§19.7, §19.7.1, §19.10).
- **Must cover:**
  - covergroup definition (§19.3); embedded covergroups in classes, constructed in `new` (§19.4);
  - value resolution (§19.5.7);
  - values outside every bin are not counted, and `default`, ignore and illegal bins do not count toward coverage;
  - sampling-timing pitfalls (sample stable values: monitor or clocking-block samples);
  - CoverageCrossExplorer and CovergroupBuilder.
- **Out of scope here (covered in):** run-time query and closure (I-SV-3B); UVM coverage subscribers (I-UVM-2A/2B); code coverage (F1B).
- **Prerequisites:** I-SV-2A, I-SV-1.
- **Feeds milestone:** M4.
- **Hands-on that should exist:**
  - predict-the-count tasks on the visuals;
  - kata P3: a covergroup from a 6-row plan excerpt with plan IDs in `option.comment`.
- **Assessment focus:** misconceptions:
  1. values outside every bin count as holes;
  2. ignore and illegal bins count toward the percentage;
  3. a covergroup samples whenever its variables change;
  4. `per_instance` is on by default.
- **Sub-lessons:** `coverage-options.mdx` covers options and sampling. It uses Level 1/2/3 structure, InfoPage and has 2 questions.

### I-SV-3B_Advanced_Functional_Coverage — I-SV-3B: Advanced Functional Coverage
- **Tier / position:** T2 · after I-SV-3A · before I-SV-4A · nav #18
- **Purpose (one sentence):** Close coverage against a verification plan by linking coverage to plan rows, querying it at run time, analyzing holes and steering stimulus within a budget.
- **Objectives (learner will be able to):**
  - Map plan rows to covergroups, coverpoints and crosses with traceable IDs.
  - Query coverage with `get_coverage()`/`get_inst_coverage()` and the coverage system tasks (§19.8, §19.9), and choose type vs instance coverage.
  - Classify each hole and choose an action:
    - unreachable → exclude or waive, with justification;
    - under-stimulated → bias constraints or add a directed test;
    - unobserved → fix sampling or the checker.
  - Plan a closure loop within a seed or run budget, and explain merging coverage across a regression (tool-specific database).
- **Must cover:**
  - plan → coverage traceability;
  - `per_instance` and `set_inst_name`; `start()`/`stop()`;
  - goals and weights; exclusions vs waivers;
  - code coverage as a complement (types and sign-off role, P2);
  - stimulus steering;
  - "coverage without checks proves nothing".
- **Out of scope here (covered in):** bins and syntax (I-SV-3A); ML-driven closure (E-AI-1); SoC closure strategy (E-SOC-1).
- **Prerequisites:** I-SV-3A.
- **Feeds milestone:** M4 (gate).
- **Hands-on that should exist:** Lab `coverage-advanced-1` (owned). It cannot close as written; it must close in ≤K seeds and be graded on the parsed report. Also a kata: given a report and the constraints, propose the minimum change that closes a hole.
- **Assessment focus:** misconceptions:
  1. 100% functional coverage means the design is verified;
  2. `get_coverage()` returns this instance's coverage (it returns type coverage);
  3. closure means running more seeds;
  4. excluding a bin is equivalent to covering it.
- **Sub-lessons:** intended order linking-coverage → coverage-apis → closure-workflow (nav today is the reverse).
  - `index.mdx`: a 16-line hub with no objectives or practice.
  - `linking-coverage.mdx`: plan traceability. It mentions `uvm_subscriber` as a forward reference only.
  - `coverage-apis.mdx`: run-time query and control.
  - `closure-workflow.mdx`: holes, steering, budget; owns the lab.

### I-SV-4A_SVA_Fundamentals — I-SV-4A: SVA Fundamentals
- **Tier / position:** T2 · after I-SV-3B · before I-SV-4B · nav #19
- **Purpose (one sentence):** Write and debug immediate and concurrent assertions whose outcome you can predict cycle by cycle from sampled values.
- **Objectives (learner will be able to):**
  - Choose immediate, deferred immediate (`assert #0`, `assert final`) or concurrent assertions for a check (§16.3, §16.4, §16.5).
  - Predict, on a waveform, each attempt's start, its Preponed samples and its outcome (pass, fail, vacuous success, disabled) for `|->` vs `|=>`, `##N` and `##[m:n]` (§16.5.1, §16.12.7, §16.14.5).
  - Write handshake checks with `$rose/$fell/$stable/$past/$changed` (§16.9.3) and `disable iff` reset handling (§16.15). The disable condition uses current, not sampled, values (§16.5, §16.12).
  - Use `assert`, `assume` and `cover property` correctly (§16.14.1–§16.14.3), and explain vacuity and why a cover proves a property was exercised.
  - Route failures through action blocks and severity tasks, and control assertions with `$assertoff/$asserton/$assertkill` (§20.11).
- **Must cover:**
  - deferred-assertion reporting (§16.4.1);
  - boolean expressions (§16.6); sequences and declarations (§16.7, §16.8);
  - clock resolution and default clocking (§16.16);
  - assertions in modules and interfaces vs procedural code (§16.14.6);
  - a bare sequence used as a property must match from each attempt;
  - SvaSequenceWaveformVisualizer and TemporalLogicExplorer.
- **Out of scope here (covered in):** repetition, `throughout/within/intersect/first_match`, local variables, multiclock, `until/s_eventually`, strong/weak (I-SV-4B); checkers and bind (I-SV-4C); formal (E-INT-1); routing SVA into UVM reports (A-UVM-7, proposed I-UVM-1D).
- **Prerequisites:** F3B, F4C.
- **Feeds milestone:** M6 (protocol checks); M1 and M2 (interface and VIP assertions).
- **Hands-on that should exist:** kata P5 (audit appendix B §4): a valid/ready SVA with `disable iff`, `$stable` payload, bounded `##[1:N]` and a cover, then debug 4 failing traces. Lab `assertions-1` (coming soon) fits I-SV-4B.
- **Assessment focus:** misconceptions:
  1. concurrent assertions see values updated at the edge;
  2. `|->` and `|=>` differ only in style;
  3. a vacuous pass proves the behaviour was checked;
  4. `disable iff` is sampled and acts only at clock ticks.
- **Sub-lessons:** `immediate-vs-concurrent.mdx`, a deep dive on immediate, deferred and concurrent assertions. It uses Elevator Pitch structure and 2 quiz blocks. Make the index's matching section a one-paragraph summary that links here.

### I-SV-4B_Advanced_Temporal_Logic — I-SV-4B: Advanced Temporal Logic
- **Tier / position:** T2 · after I-SV-4A · before I-SV-4C · nav #20
- **Purpose (one sentence):** Specify variable-latency, interval and data-integrity properties with repetition, sequence composition, local variables and multiple clocks.
- **Objectives (learner will be able to):**
  - Choose and predict consecutive `[*n]`, goto `[->n]` and nonconsecutive `[=n]` repetition on a trace (§16.9.2).
  - Write interval conditions and predict their matches:
    - `throughout` (§16.9.9);
    - `within` (§16.9.10);
    - `and`/`intersect`/`or` (§16.9.5–§16.9.7);
    - `first_match` (§16.9.8).
  - Write data-integrity properties with per-attempt local variables (§16.10).
  - Write multiclock sequences and properties (§16.13), and explain clock flow and `disable iff` across clocks.
  - Choose property operators (`not`, `implies`, `until`/`s_until`, `s_eventually`, `always`) and explain weak vs strong (§16.12.8, §16.12.11–§16.12.13).
- **Must cover:**
  - calling subroutines on match (§16.11);
  - abort properties (§16.12.14, awareness);
  - `##0` fusion;
  - safety vs liveness, and the cost of unbounded ranges in simulation.
- **Out of scope here (covered in):** basics and `disable iff` semantics (I-SV-4A); checkers and bind (I-SV-4C); proof strategy (E-INT-1).
- **Prerequisites:** I-SV-4A.
- **Feeds milestone:** M6.
- **Hands-on that should exist:**
  - TemporalLogicExplorer ("compare operators on one trace");
  - Lab `assertions-1` (coming soon; pipeline data-integrity, which needs local variables) re-owned here from I-SV-4A;
  - a kata: bounded-latency valid/ready with a data check.
- **Assessment focus:** misconceptions:
  1. local variables are shared across attempts;
  2. `[->n]` and `[=n]` are interchangeable;
  3. `##0` delays one cycle;
  4. a bare sequence in `assert property` passes vacuously when it does not match.
- **Sub-lessons:**
  - `local-variables.mdx`: per-attempt variables and data integrity.
  - `multi-clocking.mdx`: multiclock and `default disable iff` interplay only; the basics stay in I-SV-4A.

  The index description says "binding checkers"; that is wrong (bind is I-SV-4C).

### I-SV-4C_Checkers — I-SV-4C: SystemVerilog Checkers & Bind
- **Tier / position:** T2 · after I-SV-4B · before I-SV-5 · nav #21
- **Purpose (one sentence):** Package assertions and coverage into reusable checkers and attach them to RTL without editing it, using `bind`.
- **Objectives (learner will be able to):**
  - Write a `checker` with formal arguments, assertions, covers and checker variables, and instantiate it (§17.2, §17.3, §17.7).
  - Write `bind` targeting a module type, a specific instance, or an instance list, and predict which instances receive the checker (§23.11).
  - Choose among a checker, a bound module or interface, and inline assertions for a reuse scenario.
  - Debug bind failures: scope names, connections to internal signals, parameterized targets.
- **Must cover:**
  - checker restrictions per Clause 17 (verify the list; the audit found it misstated);
  - default clocking and disable inheritance in checkers;
  - binding into generate scopes (awareness);
  - assertion libraries (awareness);
  - BindDirectiveVisualizer.
- **Out of scope here (covered in):** SVA operators (I-SV-4A/4B); formal (E-INT-1); UVM reporting of assertion failures (A-UVM-7).
- **Prerequisites:** I-SV-4A, F4A.
- **Feeds milestone:** M6; M8.
- **Hands-on that should exist:** a kata: bind a handshake checker to every FIFO instance and to one specific instance. **Today it has no Practice section and no quiz.**
- **Assessment focus:** misconceptions:
  1. `bind` edits or recompiles the target source;
  2. a checker can contain anything a module can;
  3. binding to a module type affects only one instance.
- **Sub-lessons:** — (single file).

### I-SV-5_Synchronization_and_IPC — I-SV-5: Synchronization and IPC
- **Tier / position:** T2 · after I-SV-4C · before I-SV-6 · nav #22
- **Purpose (one sentence):** Coordinate concurrent bench threads with events, mailboxes, semaphores and process handles, and diagnose the hangs, lost triggers and leaks they cause.
- **Objectives (learner will be able to):**
  - Predict whether a waiter wakes for `->` vs `->>`, and for `@ev` vs `wait(ev.triggered)` when trigger and wait share a time slot (§15.5.1–§15.5.3).
  - Write a generator → bounded typed mailbox → driver pipeline (§15.4, §15.4.9), and predict blocking with `put/get/try_put/try_get/peek`.
  - Write resource arbitration with semaphores (§15.3), and debug a key leaked on an early return.
  - Control threads with `process` (`self`, `status`, `kill`, `await`) (§9.7), building on F2C's fork/join.
  - Diagnose a circular-wait deadlock and a lost-event race from symptoms.
- **Must cover:**
  - named events and the triggered state (§15.5, §6.17); `wait_order` (§15.5.4);
  - `->>` triggers through an NBA-region update;
  - multi-key semaphores;
  - the layered class-based bench plumbing (generator, driver, monitor, scoreboard over mailboxes);
  - MailboxSemaphoreGame.
- **Out of scope here (covered in):** fork/join, `disable fork`, `wait fork` (F2C owns them; recap in one paragraph and link); `uvm_event`/`uvm_barrier`/objections (I-UVM-1C); TLM FIFOs (I-UVM-2B).
- **Prerequisites:** F2C, I-SV-1.
- **Feeds milestone:** M2 (driver and monitor threads); M5 (cross-agent synchronization).
- **Hands-on that should exist:**
  - Lab `ipc-deadlock` (owned; its `modulePrerequisites: ['systemverilog-basics']` is not a module id);
  - kata P6: bounded mailbox with a `join_any` timeout and handle-aliasing exposure.
- **Assessment focus:** misconceptions:
  1. `->>` makes the event persistent;
  2. `@(ev)` catches a trigger earlier in the same time slot;
  3. `put` into a full bounded mailbox overwrites;
  4. skipping `put()` on an early return is harmless.
- **Sub-lessons:** `events.mdx`, `mailboxes.mdx`, `semaphores.mdx` (order is correct), each with 1 quiz question. The index section "Threads first: join_any, disable fork, wait fork" re-teaches F2C; reduce it to a recap. F2D/`ipc.mdx` stays as a foundation-level first look that links here; I-SV-5 owns the depth (plan.md §1).

### I-SV-6_Compiler_Directives_and_Generates — I-SV-6: Compiler Directives & Generate Constructs
- **Tier / position:** T2 · after I-SV-5 · before I-SV-7 · nav #23
- **Purpose (one sentence):** Configure and scale bench and checker code at compile and elaboration time with directives, macros and generate constructs.
- **Objectives (learner will be able to):**
  - Write argument macros that avoid the classic pitfalls (missing parentheses, double evaluation, token pasting with the double-backtick operator, `` `" `` string quoting), and predict their expansion (§22.5, §22.5.1).
  - Use these correctly:
    - `` `ifdef/`ifndef/`elsif `` (§22.6);
    - include guards with `` `include `` (§22.4);
    - `` `default_nettype none `` (§22.8);
    - `` `timescale `` (§22.7);
    - `` `resetall `` (§22.3);
    - `` `begin_keywords `` (§22.14).
  - Write loop and conditional generate blocks with named scopes (§27.3–§27.5), and reference generated hierarchy (`gen_blk[2].u_chk`).
  - Choose compile-time (directive, generate, parameter) vs run-time (plusarg, config) configuration and justify the trade-off.
- **Must cover:**
  - `` `undef/`undefineall ``;
  - `` `__FILE__ ``/`` `__LINE__ `` (verify subclause);
  - macro hygiene, using the UVM macros as examples;
  - genvar rules;
  - generate vs run time;
  - GenerateElaborationVisualizer.
- **Out of scope here (covered in):** packages and parameters basics (F4A); `bind` (I-SV-4C); UVM macro semantics (I-UVM-1A, I-UVM-4).
- **Prerequisites:** F4A.
- **Feeds milestone:** M2 (parameterized, N-instance VIP); M8 (scaling).
- **Hands-on that should exist:**
  - a kata: generate N checkers for N ports;
  - a macro-expansion predict drill.
  - **Today there is no quiz and no Practice section.**
- **Assessment focus:** misconceptions:
  1. macro arguments are evaluated once, like function arguments;
  2. generate loops run at simulation time;
  3. a `genvar` cannot appear inside an `always` block in a generate loop (it can, as a constant).
- **Sub-lessons:** — (single file).

### I-SV-7_DPI_and_Foreign_Language_Interfaces — I-SV-7: DPI & Foreign Language Interfaces
- **Tier / position:** T2 · after I-SV-6 · before I-SV-9 (I-SV-8 sits between in nav; see its card) · nav #24
- **Purpose (one sentence):** Connect SystemVerilog to C/C++ models through DPI with correct type mapping, memory ownership and time semantics.
- **Objectives (learner will be able to):**
  - Write `import "DPI-C"` and `export "DPI-C"` functions and tasks with correct SV↔C type mappings, including 4-state `svLogicVecVal` and open arrays (§35.5, §35.7, Annex H).
  - Choose `pure`, `context` or default imports, and explain what each permits (§35.5.2, §35.5.3).
  - Predict time behaviour: imported functions are zero-time. Time passes inside an imported task only through exported SV tasks it calls; there is no concurrent C thread.
  - Debug unsupported or mismatched types, C retaining pointers to SV-owned memory, a missing `context`, and link errors.
  - Build and link a C reference model and call it from a checker.
- **Must cover:**
  - the global name space (§35.4); import declarations (§35.5.4); calling imported functions (§35.6);
  - `svdpi.h` (Annex I) and the open-array API;
  - scope (`svSetScope`/`svGetScope`);
  - a tool-neutral compile and link flow;
  - VPI and PLI awareness;
  - DPIBoundaryInspector.
- **Out of scope here (covered in):** SystemC and TLM-2 integration (E-UVM-ML-1); Python co-simulation (E-PYUVM-1); scoreboard architecture (A-UVM-6).
- **Prerequisites:** F2D, I-SV-1.
- **Feeds milestone:** M3 (C reference models); M8.
- **Hands-on that should exist:** kata P7: a `pure` C reference model, plus a `context` import that calls an exported SV task to wait N clocks. **Today there is no quiz.**
- **Assessment focus:** misconceptions:
  1. an imported task runs in parallel with the simulator;
  2. C may keep a pointer to an SV array after returning;
  3. `bit` and `logic` vectors map to the same C type;
  4. invented helpers exist (audit: `svGetIntElement`).
- **Sub-lessons:** — (single file).

### I-SV-8_Power_Intent_and_UPF — Power Intent and UPF Fundamentals
- **Tier / position:** T2 · after I-SV-7 · before I-SV-9 · nav #25. Elective in T2 and a **hard prerequisite of E-PWR-1**. Keeping the folder in T2 avoids URL churn; moving it into T4 before E-PWR-1 is an optional P2 (§3.3).
- **Purpose (one sentence):** Read and write basic IEEE 1801 (UPF) power intent and predict how a simulator corrupts and isolates powered-down logic.
- **Objectives (learner will be able to):**
  - Explain why power intent lives in a UPF side file applied to the RTL in simulation and implementation.
  - Write UPF for a two-domain design: domains, supply ports, nets and sets, a power switch, and isolation, retention and level-shifter strategies.
  - Predict simulation behaviour at power-down: non-retained state corrupts to X, isolation clamps, retention save and restore order.
  - Define power states and legal transitions, and derive the verification scenarios they imply.
- **Must cover:**
  - UPF command families (`create_power_domain`, `create_supply_*`, `create_power_switch`, `set_isolation`, `set_retention`, `set_level_shifter`, `add_power_state`/PST);
  - always-on logic;
  - control sequencing: isolation before power-off, restore before isolation release;
  - the IEEE 1801 edition used (state it; command names verified against it; clause numbers marked unverified unless checked).
- **Out of scope here (covered in):** power-aware UVM verification, PMU sequences, power SVA and coverage (E-PWR-1).
- **Prerequisites:** F2A, F4A.
- **Feeds milestone:** M8 (power-aware scenarios).
- **Hands-on that should exist:**
  - a kata: annotate a waveform with expected corruption and clamp values across power-down and power-up;
  - a kata: write UPF for the 2-domain example.
- **Assessment focus:** misconceptions:
  1. UPF changes the RTL source;
  2. powered-down outputs read as 0;
  3. isolation and retention are interchangeable.
- **Sub-lessons:** — (single file). Today it has no frontmatter `flashcards`, a `#` H1, no template H2s, a stray `order: 8`, and no Next link.

### I-SV-9_Why_UVM — Why UVM? The Bridge from SystemVerilog to Verification Methodology
- **Tier / position:** T2 · after I-SV-7 (I-SV-8 between in nav) · before I-UVM-1A · nav #26
- **Purpose (one sentence):** Map a layered class-based SystemVerilog testbench onto UVM and explain which scaling and reuse problems each UVM mechanism removes.
- **Objectives (learner will be able to):**
  - Draw a layered class-based bench (transaction, generator, driver, monitor, scoreboard, coverage, environment, test) with each layer's responsibility and interface.
  - Explain the pain each UVM mechanism removes:
    - factory → substitution;
    - phasing → ordered build, connect, run and check;
    - configuration database → decoupled settings and virtual interfaces;
    - TLM → decoupled communication;
    - sequences → reusable stimulus;
    - reporting → controlled messages and pass/fail.
  - Map each layer to its UVM base class (`uvm_sequence_item`, `uvm_sequence`, `uvm_sequencer`, `uvm_driver`, `uvm_monitor`, `uvm_agent`, `uvm_scoreboard`, `uvm_env`, `uvm_test`).
  - Decide when UVM is, and is not, worth its overhead.
- **Must cover:**
  - the layered bench and its limits: hard-coded construction, ad-hoc config, ad-hoc end-of-test, copy-paste reuse;
  - UVM history (verify dates): OVM/VMM → Accellera UVM 1.x → IEEE 1800.2-2017 → IEEE 1800.2-2020 (approved 4 June 2020) plus the uvm-core reference implementation;
  - a readiness check: handles, virtual interfaces, randomization, mailboxes and threads, coverage.
- **Out of scope here (covered in):** UVM APIs (I-UVM-1A onward); running a test (proposed I-UVM-1D, I-UVM-3C).
- **Prerequisites:** I-SV-1, I-SV-2A, I-SV-3A, I-SV-5, F4C.
- **Feeds milestone:** M2 (bridge).
- **Hands-on that should exist:** the **bridge capstone** (kata P8): a class-based layered SV bench for a FIFO with 0 mismatches over 1k random transactions, coverage ≥90%, and bound assertions. Re-scope lab `fifo-1` (coming soon) for it. Add a readiness self-check quiz.
- **Assessment focus:** misconceptions:
  1. UVM is a language or a simulator feature;
  2. UVM makes simulation faster;
  3. every bench needs UVM.
- **Sub-lessons:** — (single file). It promises "a fully functioning UVM testbench by the end of T2"; point that promise at proposed I-UVM-3C and LAB-T2-ENV. Today it has no flashcards.

### I-UVM-1A_Components — I-UVM-1A: UVM Objects and Components
- **Tier / position:** T2 · after I-SV-9 · before I-UVM-1B · nav #27
- **Purpose (one sentence):** Distinguish UVM objects from components and write correctly registered, named and constructed classes of each kind, using the core `uvm_object` methods.
- **Objectives (learner will be able to):**
  - Choose `uvm_object`, `uvm_sequence_item` or `uvm_component` for a class (data vs structure, lifetime, hierarchy, phases).
  - Write registered classes:
    - `` `uvm_object_utils ``/`` `uvm_component_utils `` (Annex B.2);
    - the correct constructors (`new(string name="…")` vs `new(string name, uvm_component parent)`);
    - children built with `::type_id::create(name, this)` (§8.2.2) in `build_phase`.
  - Predict hierarchical names (`get_name`, `get_full_name`) and the topology from build code (`print_topology`, F.7.4.2).
  - Use `print/sprint/convert2string/copy/clone/compare` and the `do_*` hooks (§5.3.5–§5.3.9), and contrast field macros with hand-written `do_*` at overview level.
  - Explain what `super.build_phase` does: it calls `apply_config_settings` when `use_automatic_config()` returns 1 (§13.1.4.1.1, §13.1.5.1, §13.1.5.2). It does not construct children.
- **Must cover:**
  - class taxonomy: `uvm_void` → `uvm_object` → `uvm_report_object` → `uvm_component` (§5.2, §5.3, §13.1); `uvm_transaction`/`uvm_sequence_item` (§5.4, §14.1);
  - `uvm_root`/`uvm_top` (F.7);
  - the hierarchy API (`get_parent`, `get_children`, `lookup`);
  - components can be created only during build (uvm-core reports a fatal ILLCRT for later creation; verify);
  - build and connect phases introduced at preview depth (owner I-UVM-1C);
  - UVMTreeExplorer.
- **Out of scope here (covered in):** overrides (I-UVM-1B); phasing and objections (I-UVM-1C); reporting (proposed I-UVM-1D); policy customization (I-UVM-4); sequences (I-UVM-3A).
- **Prerequisites:** I-SV-9, I-SV-1.
- **Feeds milestone:** M2.
- **Hands-on that should exist:**
  - a kata: a `bus_item` with `do_copy/do_compare/convert2string` and a 3-level hierarchy, with the `print_topology` output predicted;
  - a UVMTreeExplorer debug (missing parent → orphan).
- **Assessment focus:** misconceptions:
  1. skipping `super.build_phase` stops child construction;
  2. objects have parents and run phases;
  3. components can be created with `new` at any time;
  4. the name string is cosmetic.
- **Sub-lessons:** — (single file). Today it has 3 quiz questions and no `Push Further`.

### I-UVM-1B_The_UVM_Factory — I-UVM-1B: The UVM Factory
- **Tier / position:** T2 · after I-UVM-1A · before I-UVM-1C · nav #28
- **Purpose (one sentence):** Create objects and components through the factory so a test can substitute types or instances without editing the environment.
- **Objectives (learner will be able to):**
  - Explain register → override → create, and why `new()` bypasses the factory.
  - Write type and instance overrides from a test's `build_phase`: `set_type_override_by_type` and `set_inst_override_by_type` (§8.3.1.4.2, §8.3.1.4.1), and the `type_id::set_*_override` shortcuts.
  - Predict the class `create()` returns:
    - instance overrides before type overrides;
    - path matching;
    - chained overrides;
    - an override registered after the object was created.
  - Debug an override that does nothing:
    - wrong or relative-vs-absolute path;
    - missing registration macro;
    - `new` instead of `create`;
    - override set too late;
    - incompatible type.
  - Use `factory.print()` and the command-line overrides `+uvm_set_type_override`/`+uvm_set_inst_override` (G.2.7).
- **Must cover:**
  - factory wrappers (§8.2), the factory API (§8.3.1), the object wrapper (§8.3.2);
  - parameterized-class registration (`uvm_component_param_utils`) and name vs type lookup;
  - `uvm_coreservice_t` access;
  - FactoryOverrideVisualizer/Explorer (one tested resolver).
- **Out of scope here (covered in):** `config_db` (I-UVM-2C); callbacks vs factory (A-UVM-5); error-injection strategy (proposed A-UVM-9).
- **Prerequisites:** I-UVM-1A.
- **Feeds milestone:** M2; M8 (error-injection overrides).
- **Hands-on that should exist:**
  - "Predict the factory" items;
  - a kata: override one agent's driver with an error-injecting subclass by instance path.
  - The `uvm-mini-capstone` LabLink belongs to proposed I-UVM-3C.
- **Assessment focus:** misconceptions:
  1. type overrides beat instance overrides;
  2. an override changes objects already created;
  3. `new()` honours overrides;
  4. instance paths are always relative to the test.
- **Sub-lessons:** — (single file). Its "uvm_root and uvm_report_server Interplay" section belongs to proposed I-UVM-1D.

### I-UVM-1C_UVM_Phasing — I-UVM-1C: UVM Phasing and Synchronization
- **Tier / position:** T2 · after I-UVM-1B · before I-UVM-2A (proposed I-UVM-1D between) · nav #29
- **Purpose (one sentence):** Predict the order and concurrency of UVM phases and end a test deliberately with objections, drain time and timeouts.
- **Objectives (learner will be able to):**
  - Order the common phases (§9.8.1) and classify each:
    - `build` and `final` run top-down;
    - `connect`, `end_of_elaboration`, `start_of_simulation`, `extract`, `check` and `report` run bottom-up;
    - `run` is a task phase.
  - Explain that `run_phase` runs in parallel with the twelve run-time phases (§9.8.2), and predict when each ends.
  - Write objection handling in the test or a top sequence, and predict when the run phase ends. Use `set_drain_time` (§10.5.1.3.7) and `phase_ready_to_end` (§13.1.4.3.2) correctly.
  - Bound a hang with `uvm_root::set_timeout` (F.7.3.3) or `+UVM_TIMEOUT` (uvm-core impl.). Diagnose a never-dropped objection with `+UVM_OBJECTION_TRACE` (uvm-core impl.) and `display_objections`.
  - Use `uvm_event` and `uvm_barrier` (§10.1, §10.3) for synchronization independent of phases. Explain domains and phase jumping as advanced and hazardous (§9.4).
- **Must cover:**
  - the phasing interface (§13.1.4);
  - `uvm_objection` (§10.5.1) and objections on `uvm_phase`;
  - drain semantics: drain applies after the count reaches zero;
  - `+UVM_PHASE_TRACE` (uvm-core impl.);
  - UvmPhaseTimelineVisualizer.
- **Out of scope here (covered in):**
  - reporting and pass/fail (proposed I-UVM-1D). Today 1B and 1C carry fragments.
  - custom phases (E-CUST-1); reset strategy (proposed A-UVM-9); sequence-level objections (I-UVM-3A).
- **Prerequisites:** I-UVM-1A.
- **Feeds milestone:** M2; M3 (end-of-test).
- **Hands-on that should exist:**
  - `/exercises/uvm-phase-sorter` (confirm it uses the corrected model);
  - the DebuggingSimulator hang scenario;
  - a kata: fix a test that hangs because a driver raises an objection inside its `forever` loop.
- **Assessment focus:** misconceptions:
  1. `connect_phase` runs top-down;
  2. `run_phase` and `main_phase` run one after the other;
  3. drain time fixes hangs;
  4. the test ends when `run_phase` code returns.
- **Sub-lessons:** — (single file). Today it has no `Make It Work` H2.

### I-UVM-2A_Component_Roles — I-UVM-2A: Component Roles and the Testbench Hierarchy
- **Tier / position:** T2 · after I-UVM-1C (proposed I-UVM-1D between) · before I-UVM-2B · nav #30
- **Purpose (one sentence):** Assign bench responsibilities to the standard UVM roles and write the agent, driver, monitor and environment skeletons that implement them.
- **Objectives (learner will be able to):**
  - Assign each responsibility (stimulus, pin driving, observation, checking, coverage, configuration, orchestration) to sequence, sequencer, driver, monitor, agent, scoreboard, subscriber, env or test.
  - Write an agent that always builds its monitor and builds driver and sequencer only when `get_is_active() == UVM_ACTIVE` (§13.4.2.2, F.2.1.7). It connects `drv.seq_item_port` to `sqr.seq_item_export`.
  - Write a monitor that samples through a clocking block, assembles a transaction, and publishes a new object per transaction on an analysis port.
  - Write an env that instantiates agents and a scoreboard and connects them. Predict the topology for active vs passive configurations.
- **Must cover:**
  - the base classes (§13.2–§13.9) and `uvm_sequencer` (§15.5);
  - the driver loop shape (owner I-UVM-3A);
  - monitors never drive;
  - agent config object at preview depth (owners I-UVM-2C, A-UVM-7);
  - AnimatedUvmTestbenchDiagram.
- **Out of scope here (covered in):** TLM details (I-UVM-2B); `config_db` mechanics (I-UVM-2C); the handshake (I-UVM-3A); VIP packaging (A-UVM-7); multi-agent (A-UVM-8). Analysis ports and `config_db` may appear only as labelled previews.
- **Prerequisites:** I-UVM-1B, I-UVM-1C, F4C.
- **Feeds milestone:** M2.
- **Hands-on that should exist:**
  - `/exercises/uvm-agent-builder`;
  - a kata: active and passive instances of one agent, with `print_topology` compared.
  - Lab `arbiter-1` (coming soon) fits as the independent variant of proposed I-UVM-3C.
- **Assessment focus:** misconceptions:
  1. a passive agent still needs a sequencer, or has an idle driver;
  2. a monitor may reuse one object for every sample;
  3. the scoreboard belongs inside the agent.
- **Sub-lessons:** — (single file). Today it has no quiz questions and no `Push Further`.

### I-UVM-2B_TLM_Connections — I-UVM-2B: TLM Connections and Analysis Fabric
- **Tier / position:** T2 · after I-UVM-2A · before I-UVM-2C · nav #31
- **Purpose (one sentence):** Connect components with TLM ports, exports, imps and FIFOs, choosing the right interface and predicting data flow and blocking.
- **Objectives (learner will be able to):**
  - Explain the roles of port, export and imp, and write legal `connect()` calls: port→port up the hierarchy, port→export/imp down, export→export (§12.2, §12.2.4).
  - Explain analysis ports: `write()` is a zero-time function broadcast to 0..N subscribers with no back-pressure (§12.2.10). Choose among a direct imp, `` `uvm_analysis_imp_decl `` (Annex B.5) and `uvm_tlm_analysis_fifo` (§12.2.8.3).
  - Write a two-input scoreboard (two imps or two FIFOs plus a `get` thread).
  - Use blocking and nonblocking put/get/peek ports and `uvm_tlm_fifo` (§12.2.8.2) between producer and consumer, and predict blocking.
  - Debug unconnected ports (end-of-elaboration errors), wrong direction, and objects mutated after `write()`.
- **Must cover:**
  - `uvm_subscriber` (§13.9);
  - the seq-item pull port as a special TLM case (§15.2.2.1; owner I-UVM-3A);
  - copy-before-modify;
  - TLM-2 awareness only (§12.3; P2 gap);
  - AnalysisBroadcastVisualizer and TLMPortConnector.
- **Out of scope here (covered in):** matching algorithms (A-UVM-6); the handshake (I-UVM-3A; today 2B has a duplicate section); TLM-2 sockets and payloads (E-UVM-ML-1, §4).
- **Prerequisites:** I-UVM-2A.
- **Feeds milestone:** M3.
- **Hands-on that should exist:**
  - Lab `scoreboard-decoupling` (owned). Its starter is already solved and its README teaches the false back-pressure premise.
  - `/exercises/scoreboard-connector`;
  - a kata: a two-input scoreboard with `` `uvm_analysis_imp_decl ``.
- **Assessment focus:** misconceptions:
  1. `write()` blocks the monitor until the subscriber finishes;
  2. an analysis port needs exactly one subscriber;
  3. connection direction is arbitrary;
  4. each subscriber gets its own copy.
- **Sub-lessons:** — (single file). Today it has no quiz questions.

### I-UVM-2C_Configuration_and_Resources — I-UVM-2C: Configuration and Resources
- **Tier / position:** T2 · after I-UVM-2B · before I-UVM-3A · nav #32
- **Purpose (one sentence):** Pass settings, configuration objects and virtual interfaces through the hierarchy with `uvm_config_db`, predicting which `set()` a `get()` sees.
- **Objectives (learner will be able to):**
  - Write `uvm_config_db#(T)::set/get` with the correct context, instance path (wildcards) and field name, and pass a virtual interface from the top module (C.4.2).
  - Predict which value a `get()` returns when several `set()` calls match: hierarchy precedence during build, last-set-wins afterwards, exact type match required.
  - Write a configuration object (`vif`, `is_active`, `coverage_enable`) set once per agent instead of many scalars.
  - Debug a silent `get()` miss:
    - type mismatch (`virtual bus_if` vs `virtual bus_if.drv`);
    - path typo;
    - `get` before `set`.

    Use `uvm_fatal` on failure, `+UVM_CONFIG_DB_TRACE` and `check_config_usage()`/`print_config()` (all uvm-core impl.).
- **Must cover:**
  - resources vs the config database (C.2, C.3, C.4);
  - `exists`/`wait_modified`;
  - scope globs;
  - a `null` context from the top module;
  - `+uvm_set_config_int/_string` (G.2.8);
  - automatic field configuration caveats;
  - ConfigDbExplorer.
- **Out of scope here (covered in):** the factory (I-UVM-1B); VIP config hierarchies (A-UVM-7); multi-agent topology config (A-UVM-8).
- **Prerequisites:** I-UVM-2A, F4B.
- **Feeds milestone:** M2.
- **Hands-on that should exist:**
  - Lab `config-debug` (owned). The bug is labelled in the starter ("DELIBERATE STARTER BUG"); remove the giveaway.
  - ConfigDbExplorer debug cases;
  - a kata: replace 6 scalar sets with one config object.
- **Assessment focus:** misconceptions:
  1. a `get()` matches on name regardless of type;
  2. the last `set()` always wins;
  3. config precedence works like factory precedence;
  4. a failed `get()` raises an error by itself.
- **Sub-lessons:** — (single file). Today it has no quiz questions and no `Push Further`.

### I-UVM-3A_Fundamentals — I-UVM-3A: Basic UVM Sequences and Items
- **Tier / position:** T2 · after I-UVM-2C · before I-UVM-3B (proposed I-UVM-3C between) · nav #33
- **Purpose (one sentence):** Write sequence items and sequences, run them from a test, and implement the driver side of the sequence–sequencer–driver handshake including responses.
- **Objectives (learner will be able to):**
  - Write a `uvm_sequence_item` with `rand` fields, constraints and `do_copy/do_compare/convert2string` (§14.1).
  - Write a `body()` with `start_item` → `randomize` → `finish_item`, and say what each call blocks on (§14.2.6). Expand `` `uvm_do ``/`` `uvm_do_with `` into those calls (Annex B.3).
  - Write a driver loop with `get_next_item/item_done` (and `try_next_item`, `get`/`put`), and predict the hang when `item_done` is missing (§15.2.1).
  - Return responses with `set_id_info` (§14.1.2.4) plus `put_response` or `item_done(rsp)`, and collect them with `get_response` (§14.3).
  - Start a sequence from a test with objections handled, either at test level or with `set_automatic_phase_objection` (§14.2.4.4), and give it a sequencer handle.
- **Must cover:**
  - `start(sqr, parent, priority, call_pre_post)` and the hooks `pre/post_start`, `pre/post_body` (§14.2.3);
  - `get_starting_phase` (§14.2.4.1);
  - nested sequences;
  - `uvm_sequencer #(REQ,RSP)` (§15.5) and `uvm_driver #(REQ,RSP)` (§13.7);
  - response-queue basics;
  - checked randomization;
  - AnimatedUvmSequenceDriverHandshakeDiagram.
- **Out of scope here (covered in):** arbitration, lock and grab, virtual sequences, layering, libraries, response handlers, hang triage (I-UVM-3B); policy customization (I-UVM-4).
- **Prerequisites:** I-UVM-2A, I-UVM-2B, I-SV-2A.
- **Feeds milestone:** M2.
- **Hands-on that should exist:**
  - a kata: a sequence of N randomized items with response checking;
  - a handshake-visual debug (missing `item_done`).
  - Move the `uvm-mini-capstone` LabLink to proposed I-UVM-3C.
- **Assessment focus:** misconceptions:
  1. `finish_item` returns when the item is queued (it returns after `item_done`);
  2. `start_item` randomizes the item;
  3. a cloned item shares its queue fields with the original;
  4. drivers should raise objections.
- **Sub-lessons:** — (single file).

### I-UVM-3B_Advanced_Sequencing_and_Layering — I-UVM-3B: Advanced Sequencing and Layering
- **Tier / position:** T2 · after I-UVM-3A (proposed I-UVM-3C between) · before I-UVM-4 · nav #34
- **Purpose (one sentence):** Coordinate stimulus across sequencers and agents (virtual sequences, arbitration, locking, layering, libraries, interrupts), and debug the hangs and starvation they cause.
- **Objectives (learner will be able to):**
  - Write a virtual sequence that starts sub-sequences on several agents and enforces an ordering rule (config before data). Provide the handles either through a virtual sequencer (`p_sequencer`, `` `uvm_declare_p_sequencer ``) or from the test.
  - Predict dispatch timing for sequential `start()`, `fork…join` and `fork…join_none` in a virtual sequence, including the end-of-test risk of `join_none`.
  - Predict grants under each arbitration mode and priority, and with `lock()`/`grab()` and `is_relevant` (§15.3.2.19, §14.2.5.5, §14.2.5.6, §14.2.5.3).
  - Write layered stimulus (a high-level sequence translated into lower-level items) and a sequence library (§14.4).
  - Debug hangs from symptoms:
    - missing `item_done`;
    - a double `get_next_item`;
    - uncollected responses;
    - a response without `set_id_info`.

    Use `use_response_handler` (§14.2.7.1) for out-of-order responses.
- **Must cover:**
  - interrupt-driven stimulus (events plus `grab`);
  - protocol layering (translator sequence or layering agent);
  - library selection modes;
  - VirtualSequencerExplorer and SequencerArbitrationSandbox (`SEQ_ARB_WEIGHTED` is not strict priority).
- **Out of scope here (covered in):** multi-agent environment architecture and cross-agent checking (A-UVM-8); the basic handshake (I-UVM-3A); PSS (E-PSS-1).
- **Prerequisites:** I-UVM-3A (and proposed I-UVM-3C).
- **Feeds milestone:** M5.
- **Hands-on that should exist:**
  - `coordinated-attack-lab.mdx` as the guided M5 pre-lab; make it self-checking;
  - `/exercises/sequencer-arbitration`;
  - the handshake page's hang scenarios.
- **Assessment focus:** misconceptions:
  1. the virtual sequencer decides sub-sequence order;
  2. `SEQ_ARB_WEIGHTED` is strict priority;
  3. `grab()` and `lock()` are identical (a lock is arbitrated like any request; a grab goes to the front of the arbitration queue, §14.2.5.5–§14.2.5.6);
  4. `fork…join_none` keeps the test alive.
- **Sub-lessons:** intended order (nav today is alphabetical: lab first, handshake sixth):

  | # | File | Role |
  |---|---|---|
  | 1 | `sequencer-driver-handshake.mdx` | what blocks where, responses, hang signatures |
  | 2 | `virtual-sequences.mdx` | owns virtual sequence and virtual sequencer mechanics; e2e loads it and expects a Monaco editor |
  | 3 | `uvm-virtual-sequencer.mdx` | dispatch order; QA requires `<VirtualSequencerExplorer />`; remove its `#` H1 |
  | 4 | `layered-sequences.mdx` | layers, `p_sequencer`, protocol layering |
  | 5 | `sequence-arbitration.mdx` | owns arbitration, priority, `lock`/`grab` |
  | 6 | `sequence-libraries.mdx` | `uvm_sequence_library`; drop the duplicate `grab/ungrab` section |
  | 7 | `interrupt-handling.mdx` | asynchronous recovery stimulus |
  | 8 | `coordinated-attack-lab.mdx` | lab page; QA requires the route |

  This order keeps arbitration → libraries adjacent, which `tests/e2e/navigation.spec.ts` pins. Update the index's "Track Contents" to match. Several sub-pages print "(correct)" next to answers; convert them to `<Quiz>`.

### I-UVM-4_UVM_Policy_Classes — I-UVM-4: UVM Policy Classes
- **Tier / position:** T2 · after I-UVM-3B · before I-UVM-5 · nav #35
- **Purpose (one sentence):** Control how UVM objects print, compare, pack, record and copy by customizing `do_*` methods and policy objects, and choose between field macros and hand-written hooks.
- **Objectives (learner will be able to):**
  - Explain how `print/compare/pack/record/copy` delegate to `uvm_printer`, `uvm_comparer`, `uvm_packer`, `uvm_recorder` and `uvm_copier` and the `do_*` hooks (§16.1–§16.6, §5.3).
  - Write `do_compare` and `do_print`/`convert2string` using the policy API, and predict `compare()` results and how miscompares are reported.
  - Configure comparer and printer knobs for a scoreboard or a log: `show_max`, miscompare severity and verbosity, table/tree/line printers.
  - Choose field macros (with flags such as `UVM_NOCOMPARE`) or manual `do_*` by performance, control and debuggability.
- **Must cover:**
  - `uvm_field_op`/`do_execute_op` (§5.7, §5.3.13, awareness);
  - pack/unpack symmetry;
  - in uvm-core 2020.3.1 the default comparer has `show_max = 1`, `sev = UVM_INFO`, `verbosity = UVM_LOW`, and the comparer counts all miscompares while limiting printing. Verify whether field-macro compares return early. **The current Quick Take says the comparer "stops counting after the first miscompare"; check it.**
  - UvmPolicyVisualizer.
- **Out of scope here (covered in):** recording flow and databases (I-UVM-6); scoreboard design (A-UVM-6).
- **Prerequisites:** I-UVM-1A, I-UVM-3A.
- **Feeds milestone:** M3 (correct comparisons).
- **Hands-on that should exist:** kata: a tolerance comparer, and a `do_compare` with field exclusions; the Policy Explorer.
- **Assessment focus:** misconceptions:
  1. a miscompare raises `UVM_ERROR` automatically (the caller must check the return value);
  2. field macros and `do_*` cannot coexist;
  3. `copy()` is always deep.

  The audit found a wrong quiz key here; re-key the quiz against uvm-core.
- **Sub-lessons:** — (single file). Today it has no quiz questions.

### I-UVM-5_UVM_Container_Classes — I-UVM-5: UVM Container Classes
- **Tier / position:** T2 · after I-UVM-4 · before I-UVM-6 · nav #36
- **Purpose (one sentence):** Decide when `uvm_pool`/`uvm_queue` and pools of events or barriers add value over native SystemVerilog containers, and use them without their traps.
- **Objectives (learner will be able to):**
  - Choose native containers or `uvm_pool`/`uvm_queue` (§11.2, §11.3) for a sharing scenario: passing by handle, a global singleton, factory creation.
  - Predict `uvm_pool` behaviour: `get()` of a missing key inserts a default entry; `exists/delete/num`; the global pool.
  - Share named synchronization objects with `uvm_event_pool`/`uvm_barrier_pool` (§10.4, §10.4.1).
  - Explain the limits: no meaningful compare or deep copy by default, and when native SV is simpler.
- **Must cover:** UvmContainerVisualizer.
- **Out of scope here (covered in):** `uvm_event` semantics (I-UVM-1C); cross-agent synchronization design (A-UVM-8).
- **Prerequisites:** I-UVM-1A, F2B.
- **Feeds milestone:** M5 (named synchronization objects); M3 (shared tables).
- **Hands-on that should exist:** a kata: share an "end of configuration" event between two agents through `uvm_event_pool::get_global`.
- **Assessment focus:** misconceptions:
  1. `uvm_pool::get()` of a missing key has no side effect;
  2. UVM containers are faster than native arrays;
  3. two containers with equal contents compare equal.
- **Sub-lessons:** — (single file). Today it has no quiz questions.

### I-UVM-6_UVM_Recording_Classes — UVM Recording Classes
- **Tier / position:** T2 · after I-UVM-5 · before A-UVM-6 (intended first T3 module; nav today goes to A-UVM-4A) · nav #37
- **Purpose (one sentence):** Record transactions into a transaction database for viewing alongside waveforms, and know when recording is and is not active.
- **Objectives (learner will be able to):**
  - Explain the recording architecture: `uvm_tr_database` (§7.1), `uvm_tr_stream` (§7.2), links (§7.3), `uvm_recorder` (§16.4), and `begin_tr`/`end_tr`.
  - Enable recording for a component (off by default; `recording_detail` in uvm-core impl.), and predict when nothing is recorded.
  - Write `do_record` (or use field macros) so records carry useful fields, and add parent/child links.
  - Choose what to record in long regressions, trading cost against debug value.
- **Must cover:**
  - the uvm-core default text database vs simulator databases (tool-specific);
  - `record_error_tr`/`record_event_tr`;
  - TransactionRecordingVisualizer.
- **Out of scope here (covered in):** debug methodology and catchers (E-DBG-1); policy internals (I-UVM-4).
- **Prerequisites:** I-UVM-4, I-UVM-2A.
- **Feeds milestone:** M8 (debug); supports M3 debugging.
- **Hands-on that should exist:** a kata: record monitor transactions with a parent-sequence link and inspect the text database.
- **Assessment focus:** misconceptions:
  1. recording is on by default;
  2. recording replaces logging;
  3. only the transaction itself may call `begin_tr`.
- **Sub-lessons:** — (single file). It uses `flashcardId:`; switch to `flashcards:`. Its Next link jumps to T4 E-DBG-1; it should go to the first T3 module.

### Tier 3: Advanced

### A-UVM-4A_RAL_Fundamentals — A-UVM-4A: RAL Fundamentals
- **Tier / position:** T3 · after A-UVM-8 (proposed A-UVM-9 between) · before A-UVM-4B · nav #38. Today it is the first T3 module; move it after the env-building block (§3.4).
- **Purpose (one sentence):** Build a register model, connect it to a bus agent through an adapter, and reason about desired, mirrored and DUT values.
- **Objectives (learner will be able to):**
  - Write a register model for a small spec with RW, RO, W1C and reserved fields, reset values and one memory, using `uvm_reg_field::configure`, `uvm_reg`, `uvm_reg_block`, `uvm_reg_map` and `lock_model` (§18.1–§18.6, §18.1.2.6).
  - Write an adapter (`reg2bus`/`bus2reg`, §19.2.1) and integrate the model into an env (`default_map.set_sequencer`, base address).
  - Predict desired, mirrored and DUT values after each of these (§18.1.5.5, §18.1.5.6, §18.4.4):
    - `set` and `update`;
    - `write` and `read`;
    - `mirror` and `predict`;
    - `peek` and `poke`;
    - `reset`.
  - Explain frontdoor vs backdoor paths, and attach HDL paths (`add_hdl_path`, §18.1.6.5).
- **Must cover:**
  - generator flows (IP-XACT, awareness);
  - field access-policy semantics;
  - volatile fields; reset kinds; maps, offsets and endianness;
  - `uvm_reg_sequence` (§19.4.1);
  - status and check arguments;
  - RalRegisterMapVisualizer (desired/mirrored/DUT).
  - The audit found `configure()`'s second argument mislabelled as an HDL path.
- **Out of scope here (covered in):** prediction strategy, built-in sequences, memories in depth, multi-map, user frontdoors (A-UVM-4B).
- **Prerequisites:** I-UVM-3A, I-UVM-2B, A-UVM-6.
- **Feeds milestone:** M7.
- **Hands-on that should exist:** M7 part 1 kata: a 4-register spec (RW, RO, W1C, volatile counter) → register block plus adapter, with a predict-the-mirror table.
- **Assessment focus:** misconceptions:
  1. `set()` writes the DUT (only `update()` or `write()` does);
  2. the mirror tracks the DUT by itself;
  3. `configure()`'s second argument is the HDL path.
- **Sub-lessons:** — (single file).

### A-UVM-4B_Advanced_RAL_Techniques — A-UVM-4B: Advanced RAL Techniques
- **Tier / position:** T3 · after A-UVM-4A · before B-AMBA-1 · nav #39 (today followed by A-UVM-5)
- **Purpose (one sentence):** Keep the register mirror correct under real traffic (prediction modes, access paths, built-in tests, memories and multiple maps) and debug mirror mismatches.
- **Objectives (learner will be able to):**
  - Choose between:
    - implicit (auto) prediction: `map.set_auto_predict(1)` (§18.2.5.2);
    - explicit prediction: `uvm_reg_predictor` fed by a bus monitor (§19.3).

    Wire the explicit predictor: map, adapter, `bus_in` connection.
  - Predict mirror updates for frontdoor and backdoor accesses, volatile fields and side-effect accesses (W1C, RC). uvm-core 2020.3.1 `peek`/`poke` call `do_predict` unconditionally, so the mirror follows. The IEEE 1800.2-2020 text of §18.4.4.11–§18.4.4.12 says they are "affected by the auto-prediction configuration". Teach the implementation behaviour and note the LRM wording.
  - Run the built-in sequences (`uvm_reg_hw_reset_seq`, bit-bash, access, memory walk; Annex E). Exclude registers with `NO_REG_TESTS`/`NO_REG_HW_RESET_TEST` resources in the `REG::` namespace.
  - Debug a mirror mismatch with a checklist:
    - predictor connected?
    - `bus2reg` correct?
    - `provides_responses` (§19.2.1.2.3)?
    - double prediction?
  - Model memories (§18.6) and multiple maps, and use `uvm_reg_frontdoor` (§19.4.2) and `uvm_reg_cbs` (§18.11) when needed.
- **Must cover:**
  - `supports_byte_enable` (§19.2.1.2.2);
  - `uvm_mem_mam` (§18.12, awareness);
  - RAL coverage (`build_coverage`, awareness, P2);
  - RALPredictorVisualizer.
- **Out of scope here (covered in):** model building (A-UVM-4A); SoC register strategy (E-SOC-1).
- **Prerequisites:** A-UVM-4A.
- **Feeds milestone:** M7 (gate).
- **Hands-on that should exist:**
  - Lab `ral-mirror-bug` (owned). The bug and its fix are printed in comments; remove them. It lists `simple-dut-1` as a lab prerequisite.
  - a kata: an explicit predictor plus a W1C test.
- **Assessment focus:** misconceptions:
  1. "explicit prediction" means calling `predict()` by hand; the implicit/explicit terms are inverted today;
  2. `poke()` needs a manual `predict()` (not in uvm-core 2020.3.1);
  3. auto-predict sees other masters' (firmware) accesses;
  4. the built-in sequences know which registers are unsafe.
- **Sub-lessons:** intended order explicit-vs-implicit → frontdoor-vs-backdoor → built-in-ral-sequences (nav today starts with built-in).
  - `explicit-vs-implicit.mdx`: owns prediction terminology and wiring. The index summarizes in one paragraph.
  - `frontdoor-vs-backdoor.mdx`: access paths and mirror effects.
  - `built-in-ral-sequences.mdx`: Annex E sequences and exclusions. Today it shows invented APIs and answers inline.

### A-UVM-5_UVM_Callbacks — A-UVM-5: UVM Callbacks
- **Tier / position:** T3 · after A-UVM-7 · before A-UVM-8 · nav #40 (today after A-UVM-4B, before A-UVM-6)
- **Purpose (one sentence):** Add optional, stackable behaviour to components at run time with callbacks, and choose callbacks or factory overrides for a given extension.
- **Objectives (learner will be able to):**
  - Write the three parts:
    - a callback base class (`uvm_callback`, §10.7.1);
    - `` `uvm_register_cb `` plus `` `uvm_do_callbacks `` hooks (Annex B.4);
    - a concrete callback added with `uvm_callbacks#(T,CB)::add` (§10.7.2).
  - Predict execution order with `UVM_APPEND`/`UVM_PREPEND`, and type-wide vs per-instance registration (`add(null, cb)` is type-wide).
  - Choose callbacks or factory overrides for a scenario: per-instance toggles, stacked concerns, vendor extension points.
  - Debug a callback that never fires:
    - added on a null handle;
    - added before the component exists;
    - missing `` `uvm_register_cb ``;
    - `callback_mode(0)`.
- **Must cover:**
  - `delete`, `display`;
  - `uvm_callback_iter` (Annex D.1);
  - passing data by `ref`;
  - register after build (`connect_phase` or `end_of_elaboration_phase`);
  - CallbackTimingVisualizer.
- **Out of scope here (covered in):** factory mechanics (I-UVM-1B); `uvm_reg_cbs` (A-UVM-4B); error-injection strategy and expected-error accounting (proposed A-UVM-9).
- **Prerequisites:** I-UVM-1B, I-UVM-2A, A-UVM-7.
- **Feeds milestone:** M8 (error injection).
- **Hands-on that should exist:**
  - Lab `callbacks-driver-behavior` (owned). Its solution registers on a null handle; fix it. It lists `simple-dut-1` as a prerequisite.
  - a kata: stack delay and corrupt callbacks and toggle them at run time.
- **Assessment focus:** misconceptions:
  1. `add(env.agent.drv, cb)` in the test's `build_phase` attaches to that driver (the handle is null, so it becomes type-wide);
  2. callbacks always replace overrides;
  3. registration order ignores `UVM_PREPEND`.
- **Sub-lessons:** — (single file). Today it has no quiz.

### A-UVM-6_Scoreboards_and_Reference_Models — A-UVM-6: Scoreboards and Reference Models
- **Tier / position:** T3 · after I-UVM-6 (end of T2) · before A-UVM-7 · nav #41 (today after A-UVM-5). Intended **first T3 module**.
- **Purpose (one sentence):** Build self-checking scoreboards that predict expected results with a reference model, match them in order or out of order, and account for every transaction at end of test.
- **Objectives (learner will be able to):**
  - Design the architecture: monitors → predictor/reference model → comparator, with analysis FIFOs or imps. Justify where prediction happens.
  - Write an in-order scoreboard and a keyed out-of-order scoreboard (per-key queues, safe under ID reuse) that compare by value with `compare()`, not by handle.
  - Implement end-of-test accounting:
    - report unmatched expected and actual items in `check_phase`;
    - fail on zero observed transactions;
    - keep the test alive until outstanding items drain, using an objection or `phase_ready_to_end` with a drain condition, never a fixed delay.
  - Debug false passes and false failures: aliasing (copy before mutate), monitor sampling time, reset flush, expected errors.
  - Choose a reference-model style: SV transaction model, DPI C model, or predictor component.
- **Must cover:**
  - `uvm_scoreboard` (§13.6), `uvm_tlm_analysis_fifo` (§12.2.8.3), `` `uvm_analysis_imp_decl ``;
  - latency and timeouts for outstanding items;
  - summary statistics, with the M3 log signature `SCB_SUMMARY matches=N mismatches=0 pending=0`;
  - DUT reordering vs protocol reordering (link B-AXI-6);
  - ScoreboardMatchingVisualizer (in-order, per-ID, end-of-test).
- **Out of scope here (covered in):** AXI per-ID application (B-AXI-6); coverage (I-SV-3A/3B); register prediction (A-UVM-4B); expected-error strategy (proposed A-UVM-9; only the basic version here).
- **Prerequisites:** I-UVM-2B, I-UVM-4, I-UVM-3A (and proposed I-UVM-3C).
- **Feeds milestone:** M3 (gate).
- **Hands-on that should exist:** Lab `scoreboard-reference-model` (owned; fix the accounting, LAB-S1) with the M3 mutants: dropped output, wrong opcode, extra output, zero-transaction run. `axi-scoreboard-lab` is linked as the out-of-order application. Move `uvm-mini-capstone` to proposed I-UVM-3C.
- **Assessment focus:** misconceptions:
  1. `==` on handles compares transactions;
  2. zero mismatches means pass (it ignores zero transactions and leftovers);
  3. a fixed `#100ns` drain is safe;
  4. one map slot per ID suffices.
- **Sub-lessons:** — (single file). E2E pins its H1 title text.

### A-UVM-7_VIP_Construction — A-UVM-7: VIP Construction
- **Tier / position:** T3 · after A-UVM-6 · before A-UVM-5 · nav #42 (today before A-UVM-8)
- **Purpose (one sentence):** Package a protocol agent as reusable verification IP (driver, monitor, sequencer, config object, interface with assertions, coverage, sequences) that works active or passive at block and SoC level.
- **Objectives (learner will be able to):**
  - Write a VIP configuration object (`vif`, `is_active`, `has_coverage`/`checks_enable`, protocol parameters) and an agent built from it (§13.4).
  - Write a driver and a monitor that:
    - use clocking blocks through the virtual interface;
    - handle reset: stop, flush, resume;
    - publish a new object per observed transaction.
  - Package the VIP: package file, interface outside the package, include order, parameterized interfaces and virtual-interface typedefs (§25.8). Integrate it into a new env through `config_db`.
  - Route interface-assertion failures into UVM reporting instead of bare `$error`, and gate checks and coverage by configuration.
  - Evaluate third-party VIP integration: virtual-interface type, config paths, sequence compatibility.
- **Must cover:**
  - responder (slave) agents and reactive sequences (P1 gap);
  - VIP self-tests; versioning; documentation;
  - passive reuse at SoC level.
- **Out of scope here (covered in):** multi-agent coordination (A-UVM-8); callbacks (A-UVM-5); reset and error-injection strategy (proposed A-UVM-9); SoC reuse strategy (E-SOC-1).
- **Prerequisites:** I-UVM-2A, I-UVM-2C, I-UVM-3A, A-UVM-6, F4C, I-SV-4A.
- **Feeds milestone:** M2 (gate: reusable active and passive agent).
- **Hands-on that should exist:**
  - **LAB-M2** (not built): a valid/ready stream agent reused active and passive, checked with a `print_topology` signature.
  - `soc-vip-reuse` (E-SOC-1) is the SoC application.
  - a kata: make an `$error` interface assertion UVM-visible.
- **Assessment focus:** misconceptions:
  1. `$error` in an interface assertion increments `UVM_ERROR`;
  2. a passive agent is an active agent with an idle driver;
  3. VIP settings should be many scalar `config_db` fields.
- **Sub-lessons:** — (single file). E2E pins its H1 title text.

### A-UVM-8_Multi_Agent_Topologies — A-UVM-8: Multi-Agent Topologies
- **Tier / position:** T3 · after A-UVM-5 · before A-UVM-4A (proposed A-UVM-9 between) · nav #43 (today followed by B-AHB-1)
- **Purpose (one sentence):** Architect environments with several agents and sub-environments, and coordinate their stimulus and checking with virtual sequences and synchronization objects without hangs.
- **Objectives (learner will be able to):**
  - Design a multi-agent env (env of envs, per-agent config objects, virtual-sequencer handles) for a DUT with configuration and data interfaces.
  - Write a virtual sequence that enforces cross-agent ordering (config before data, mid-stream reconfiguration) and runs background traffic without blocking the end of test.
  - Synchronize agents with `uvm_event`, `uvm_barrier` and semaphores, and predict trigger/wait races.
  - Debug multi-agent hangs:
    - `forever` inside `fork…join`;
    - starting on a passive agent's null sequencer;
    - objections in background threads.
  - Configure the topology (active or passive per agent, agent count) from the test through config objects.
- **Must cover:**
  - cross-agent scoreboards;
  - block → subsystem reuse;
  - `grab`/`lock` in multi-agent stimulus;
  - MultiAgentCoordinationVisualizer (including reset modes).
- **Out of scope here (covered in):** virtual-sequence mechanics (I-UVM-3B owns them; link instead of re-teaching); VIP construction (A-UVM-7); SoC strategy (E-SOC-1); reset strategy (proposed A-UVM-9).
- **Prerequisites:** I-UVM-3B, A-UVM-7, I-SV-5.
- **Feeds milestone:** M5 (gate).
- **Hands-on that should exist:** **LAB-M5** (not built): config agent plus data agent, with an ordering assertion and a hidden mutant virtual sequence. `I-UVM-3B/coordinated-attack-lab` is the pre-lab.
- **Assessment focus:** misconceptions:
  1. `fork…join` with a `forever` background sequence lets the virtual sequence finish;
  2. a passive agent's sequencer can run sequences;
  3. the virtual sequencer controls ordering.
- **Sub-lessons:** — (single file). E2E pins its H1 title text.

### B-AHB-1_AHB_Design_Timing_Mechanics — AHB Protocol Design & Timing
- **Tier / position:** T3 · after B-AMBA-2 (proposed B-APB-1 between) · before B-AHB-2 · nav #44 (today right after A-UVM-8, before the AMBA intro)
- **Purpose (one sentence):** Read and predict AHB transfers: pipelined address and data phases, wait states, transfer types and bursts.
- **Objectives (learner will be able to):**
  - Predict the address and data phases of back-to-back transfers and the effect of `HREADY` low on both (IHI0033B.b §3.1, §3.6).
  - Decode `HTRANS` (IDLE, BUSY, NONSEQ, SEQ) and `HBURST`, and compute burst addresses for a given `HSIZE` (§3.2, §3.4, §3.5).
  - Explain `HSEL` with `HREADY` sampling, `HREADYOUT` vs `HREADY`, and the 1KB rule for incrementing bursts (§3.5).
  - Explain OKAY vs the two-cycle ERROR response at timing level (§5.1).
- **Must cover:**
  - signal taxonomy (§2.1); AHB-Lite vs AHB5 signals (awareness);
  - locked transfers (§3.3, awareness); BUSY rules; early burst termination (awareness);
  - interconnect (§4.1);
  - AhbPipelineBurstVisualizer (e2e test id `ahb-pipeline-burst-visualizer`).
- **Out of scope here (covered in):** pitfalls (B-AHB-2); verification environment (B-AHB-3); bridges (B-AMBA-F1).
- **Prerequisites:** B-AMBA-1, B-AMBA-2, F4C.
- **Feeds milestone:** M6.
- **Hands-on that should exist:** visualizer predictions; a kata: WRAP8 addresses for word size starting at 0x34.
- **Assessment focus:** misconceptions:
  1. address and data of one transfer occur in the same cycle;
  2. a wait state stalls only the data phase (it also holds the next address phase);
  3. AHB INCR bursts have no boundary rule.
- **Sub-lessons:** — (single file). Today it has a `#` H1, no `## Quick Take` (uses `<QuickTake>`) and no template H2s. Keep `sources:` (QA-pinned).

### B-AHB-2_AHB_Pitfalls_and_Deadlocks — AHB Pitfalls & Real-World Failures
- **Tier / position:** T3 · after B-AHB-1 · before B-AHB-3 · nav #45
- **Purpose (one sentence):** Recognize AHB design and integration failures and write checks that catch them without flagging legal behaviour.
- **Objectives (learner will be able to):**
  - Diagnose from a waveform:
    - a slave stuck with `HREADYOUT` low;
    - data used on the wrong edge;
    - control changing during a wait state except where §3.6 allows it.
  - Explain the two-cycle ERROR response (§5.1), and write an assertion that also catches a single-cycle ERROR.
  - Tag each check as protocol rule ([Protocol §x]) or integration policy (wait-state bounds, lock length).
  - Write 1KB-boundary and alignment checks that apply only to incrementing bursts and accept legal WRAP bursts.
  - Diagnose reset faults: `HTRANS` not IDLE in reset, a grant during reset (§7.1).
- **Must cover:**
  - the §3.6 exceptions (IDLE→NONSEQ, BUSY handling, cancel after ERROR);
  - lock starvation as policy.
- **Out of scope here (covered in):** the full environment (B-AHB-3); bridges (B-AMBA-F1).
- **Prerequisites:** B-AHB-1, I-SV-4A.
- **Feeds milestone:** M6.
- **Hands-on that should exist:** buggy-vs-fixed RTL drills; a kata: the ERROR-pair assertion run against legal and illegal traces.
- **Assessment focus:** misconceptions:
  1. `(HRESP && !HREADY) |=> (HRESP && HREADY)` catches a one-cycle ERROR;
  2. control may never change in a wait state;
  3. an `HREADY` timeout is a protocol rule.
- **Sub-lessons:** — (single file). Same structural defects as B-AHB-1. Keep `sources:` (QA-pinned).

### B-AHB-3_AHB_Verification — AHB Verification Methodology
- **Tier / position:** T3 · after B-AHB-2 · before B-AXI-1 · nav #46 (today followed by B-AMBA-1)
- **Purpose (one sentence):** Build an AHB verification environment (pipelined monitor, protocol checker, coverage model, scoreboard, debug patterns) that accepts every legal transfer and flags illegal ones.
- **Objectives (learner will be able to):**
  - Write an AHB transaction class and a monitor that pairs each address phase with its possibly waited data phase.
  - Write a checker with correct assertions (ERROR pair, §3.6 stability exceptions, burst and boundary rules), each tagged protocol or policy.
  - Write a compiling coverage model over transfer type × burst × size × wait states × response, mapped to a plan.
  - Choose checker vs scoreboard responsibilities, and design the scoreboard for a slave or interconnect.
  - Apply the debug patterns: HREADY trace, transaction-boundary finder, ERROR forensics, starvation detector.
- **Must cover:**
  - master and slave driver awareness: random waits, BUSY insertion, two-cycle ERROR responder;
  - reset behaviour.
- **Out of scope here (covered in):** AXI (B-AXI-*); bridges (B-AMBA-F1).
- **Prerequisites:** B-AHB-2, A-UVM-6, I-SV-3A.
- **Feeds milestone:** M6.
- **Hands-on that should exist:** Lab `ahb-checker-lab` (owned). Its BROKEN_MODE success criterion cannot be met with the supplied assertions (audit X5); fix it.
- **Assessment focus:** misconceptions:
  1. the monitor can sample address and data on the same edge;
  2. `HTRANS` must be stable through every wait state;
  3. checker and scoreboard both own data ordering.
- **Sub-lessons:** — (single file). Today it has a `#` H1 and its "Interview Questions & Answers" reveal answers.

### B-AMBA-1_Protocol_Families_and_Tradeoffs — AMBA Protocol Families & Tradeoffs
- **Tier / position:** T3 · after A-UVM-4B · before B-AMBA-2 · nav #47 (today after B-AHB-3). Frontmatter `order: 1`.
- **Purpose (one sentence):** Choose an AMBA protocol for a block by comparing APB, AHB-Lite, AXI4, AXI4-Lite, AXI4-Stream and the coherent protocols on architecture and verification cost.
- **Objectives (learner will be able to):**
  - Compare the families on topology, channels or phases, bursts, outstanding transactions, ordering and typical use.
  - Choose a protocol for a described IP and justify it.
  - Explain the role of an interconnect, and why standard protocols enable VIP reuse.
  - Place ACE and CHI, and say what changes for verification.
- **Must cover:**
  - AHB is a pipelined shared bus with separate read and write data buses, not one multiplexed channel;
  - AXI4-Lite (IHI0022E §B1.1);
  - AXI4-Stream and APB (cite documents; mark section numbers unverified);
  - terminology: master/slave as in the cited issues (§5.1);
  - AMBA family explorer (e2e test id `amba-family-explorer`).
- **Out of scope here (covered in):** protocol details (proposed B-APB-1, B-AHB-*, B-AXI-*); coherency (B-AMBA-F2).
- **Prerequisites:** I-UVM-2A (T2 complete).
- **Feeds milestone:** M6 (context).
- **Hands-on that should exist:** a protocol-selection exercise (5 IP descriptions).
- **Assessment focus:** misconceptions:
  1. AHB has a single multiplexed channel;
  2. AXI4-Lite supports bursts;
  3. AXI4-Stream carries addresses.
- **Sub-lessons:** — (single file). Today it has no `## Quick Take` H2 and no template H2s.

### B-AMBA-2_Protocol_Intuition_and_Memory_Hooks — AMBA Protocol Intuition & Memory Hooks
- **Tier / position:** T3 · after B-AMBA-1 · before B-AHB-1 (proposed B-APB-1 between) · nav #48 (today followed by B-AMBA-F1). Frontmatter `order: 2`.
- **Purpose (one sentence):** Build durable intuition for AMBA channel roles and the VALID/READY handshake with analogies whose limits are stated.
- **Objectives (learner will be able to):**
  - Explain shared-bus (AHB) vs point-to-point channels (AXI) with an analogy, and state where each analogy breaks.
  - Recall the five AXI channels, their directions, and who drives VALID and READY.
  - Predict whether a described handshake is legal, applying the rule:
    - a source must not wait for READY before asserting VALID;
    - VALID and its payload hold until the handshake;
    - only the required cross-channel dependencies exist (IHI0022E §A3.2.1, §A3.3.1).
- **Must cover:**
  - the mail-delivery hook with its limits: write data may precede the address; the write response follows both the AW handshake and the last W handshake;
  - AHB pipeline intuition;
  - the analogy explorer (e2e test id `protocol-analogy-explorer`).
- **Out of scope here (covered in):** normative AXI rules (B-AXI-1); AHB timing (B-AHB-1).
- **Prerequisites:** B-AMBA-1.
- **Feeds milestone:** M6.
- **Hands-on that should exist:** a recall drill and "is this handshake legal?" predictions.
- **Assessment focus:** misconceptions:
  1. write data must follow the write address;
  2. the three write actions are independent;
  3. READY must wait for VALID, or VALID may wait for READY.
- **Sub-lessons:** — (single file). Its text says the next module is AHB while nav goes to F1 today.

### B-AMBA-F1_Bridges_and_System_Integration — AHB↔AXI Bridges & System Integration
- **Tier / position:** T3 · after B-AXI-6 · before B-AMBA-F2 · nav #49 (today after B-AMBA-2, before any AXI lesson). Frontmatter `order: 12`.
- **Purpose (one sentence):** Verify protocol bridges by deriving their translation rules (splitting, response mapping, width and clock conversion) from both specifications, and planning stimulus, checks and formal properties.
- **Objectives (learner will be able to):**
  - Derive when each direction must split:
    - **AHB→AXI:** for the AXI 256-beat INCR limit and for width conversion. Never because of 4KB: legal AHB INCR bursts cannot cross 1KB (IHI0033B.b §3.5).
    - **AXI→AHB:** at 1KB (IHI0022E §A3.4.1).
  - Map responses and errors across the protocols, and explain the posted vs non-posted write problem.
  - Write a bridge verification plan: functional scenarios, error injection, CDC scenarios, formal properties and assumptions.
  - Debug common bridge bugs: split off-by-one, write-data misalignment, response ordering on split bursts, WRAP→INCR conversion, outstanding overflow.
- **Must cover:**
  - synchronous vs asynchronous bridges (CDC awareness);
  - formal for bridges;
  - BridgeTranslationExplorer (e2e test id `bridge-translation-explorer`, scenario-pinned).
- **Out of scope here (covered in):** protocol basics (B-AHB-*, B-AXI-*); formal methodology (E-INT-1); CDC tooling.
- **Prerequisites:** B-AHB-3, B-AXI-6.
- **Feeds milestone:** M6; M8.
- **Hands-on that should exist:** Lab `ahb-axi-bridge-debug` (owned). Its README premise ("an AHB master may legally issue a burst that crosses a 4KB page boundary") is false; its `modulePrerequisites` lists lab ids.
- **Assessment focus:** misconceptions:
  1. AHB bursts can cross 4KB, so AHB→AXI must split at 4KB;
  2. every legal AXI burst is legal on AHB;
  3. write errors map per beat.
- **Sub-lessons:** — (single file). Today it has a `#` H1 and no References & Next Topics.

### B-AMBA-F2_Future_Protocols_ACE_CHI — AMBA Coherency Protocols: ACE and CHI
- **Tier / position:** T3 · after B-AMBA-F1 · before B-AMBA-F3 · nav #50. Frontmatter `order: 13`.
- **Purpose (one sentence):** Explain why coherent interconnects exist, what ACE adds to AXI and how CHI differs, and how coherency changes the verification problem.
- **Objectives (learner will be able to):**
  - Explain the coherency problem (stale and dirty copies) and the role of snoops.
  - Trace a read and a write through ACE cache-line states and snoops (snoop channels, domain and snoop signalling) at concept level. Verify against IHI0022E Part C.
  - Compare CHI with ACE: node types, channel families and credit-based flow control at concept level. Cite IHI0050 with the issue verified, or mark the claim unverified.
  - Design the outline of a coherency scoreboard and its global properties (single writer, multiple readers).
- **Must cover:** every claim verified or marked unverified (audit X11). Keep `sources:` (QA-pinned) naming the issues actually checked.
- **Out of scope here (covered in):** coherency VIP implementation; detailed transaction flows beyond awareness.
- **Prerequisites:** B-AXI-3, B-AXI-6.
- **Feeds milestone:** M8 (awareness).
- **Hands-on that should exist:** a kata: trace a 2-cache read and write through line states; a coherency checklist.
- **Assessment focus:** misconceptions:
  1. ACE and CHI are future protocols;
  2. CHI is AXI with more signals (it is packetized and credit-based);
  3. coherency can be checked per interface.
- **Sub-lessons:** — (single file). The folder name says "Future_Protocols"; keep the URL and fix only the text.

### B-AMBA-F3_Interview_Debug_Clinic — AMBA Interview & Debug Clinic
- **Tier / position:** T3 · after B-AMBA-F2 · before E-DBG-1 (start of T4) · nav #51. Frontmatter `order: 14`.
- **Purpose (one sentence):** Transfer AMBA knowledge to unfamiliar problems (whiteboard designs, waveform triage, verification plans, trick questions) answered from the specification.
- **Objectives (learner will be able to):**
  - Triage a protocol failure by checking handshakes, phases and dependencies first.
  - Produce a verification plan with stimulus, checks and coverage for an AXI interconnect, an AHB-to-AXI bridge, or a coherent subsystem.
  - Answer trick questions with the governing rule. For example:
    - WVALID must not wait for AWREADY (§A3.3.1);
    - `AWLEN = 0` means one beat;
    - BVALID needs both the AW handshake and the last W handshake.
  - Size interconnect resources (outstanding IDs, buffers) and spot deadlock risks.
- **Must cover:** consistency with B-AXI-*/B-AHB-* (no contradicting answers); spec citations; the answer-quality rubric.
- **Out of scope here (covered in):** new normative content (B-AHB-*, B-AXI-*).
- **Prerequisites:** B-AXI-6, B-AHB-3, B-AMBA-F1.
- **Feeds milestone:** M6 (transfer).
- **Hands-on that should exist:** attempt-first drills (InterviewQuestionPlayground); a timed waveform-triage set.
- **Assessment focus:** misconceptions:
  1. a master may wait for AWREADY before asserting WVALID;
  2. WRAP and FIXED bursts fall under the INCR 4KB-crossing math;
  3. cross-ID read reordering is a scoreboard failure.
- **Sub-lessons:** — (single file). Today it has a `#` H1 and no References & Next Topics.

### B-AXI-1_AXI_Channel_Architecture — AXI4 Channel Architecture & Handshake Protocol
- **Tier / position:** T3 · after B-AHB-3 · before B-AXI-2 · nav #52 (today after B-AMBA-F3). Frontmatter `order: 6`.
- **Purpose (one sentence):** Apply the AXI4 five-channel architecture and the VALID/READY rules to predict legal transfers, dependencies, backpressure and reset behaviour.
- **Objectives (learner will be able to):**
  - Predict when a transfer occurs from VALID and READY waveforms, and spot violations: VALID dropped before the handshake, payload changed while `VALID && !READY` (§A3.2.1, §A3.2.2).
  - List the required dependencies, and accept the permitted orderings (§A3.3.1):
    - R after the AR handshake;
    - in AXI4, B after both the AW handshake and the last W handshake;
    - W may precede AW.
  - Explain why VALID must not depend combinationally on READY.
  - Trace end-to-end write and read flows with backpressure, and the reset requirements (§A3.1).
- **Must cover:**
  - channel signals;
  - channel independence;
  - AxiChannelHandshakeVisualizer (e2e test id `axi-channel-handshake-visualizer`).
- **Out of scope here (covered in):** burst math (B-AXI-2); IDs (B-AXI-3); attributes (B-AXI-4); deadlocks (B-AXI-5); VIP (B-AXI-6).
- **Prerequisites:** B-AMBA-2.
- **Feeds milestone:** M6.
- **Hands-on that should exist:** visual predictions; a kata: VALID-stability and BVALID-dependency assertions run on legal W-before-AW traffic.
- **Assessment focus:** misconceptions:
  1. write data must not arrive before the write address;
  2. BVALID may follow the last W beat before AW handshakes;
  3. READY must wait for VALID.
- **Sub-lessons:** — (single file). Keep `sources:` (QA-pinned). Today it names IHI0022H while the verified text is IHI0022E (§5.7).

### B-AXI-2_AXI_Burst_Math — AXI Burst Math & Address Calculation
- **Tier / position:** T3 · after B-AXI-1 · before B-AXI-3 · nav #53. Frontmatter `order: 7`.
- **Purpose (one sentence):** Compute AXI burst addresses, byte lanes and strobes for FIXED, INCR and WRAP bursts, including unaligned and narrow transfers, and check the 4KB rule correctly.
- **Objectives (learner will be able to):**
  - Calculate every beat address from AxADDR, AxLEN, AxSIZE and AxBURST with the specification equations (§A3.4.1).
  - Calculate active byte lanes per beat (unaligned first beat, narrow transfers), and state the legal WSTRB set: any subset of the active lanes (§A3.4.3).
  - Decide burst legality:
    - AXI4 INCR up to 256 beats;
    - WRAP of 2, 4, 8 or 16 beats with an aligned start;
    - FIXED up to 16 beats;
    - 4KB crossing is possible only for INCR.
  - Write a 4KB assertion that uses the aligned start address and checks INCR only.
- **Must cover:**
  - masters' 4KB handling;
  - AxiMemoryMathVisualizer (e2e test id `axi-memory-math-visualizer`).
- **Out of scope here (covered in):** ordering (B-AXI-3); bridges (B-AMBA-F1); 4KB pitfalls in context (B-AXI-5 links here).
- **Prerequisites:** B-AXI-1.
- **Feeds milestone:** M6.
- **Hands-on that should exist:** calculation quizzes (predict); a kata: `calc_lanes()` compared against the visualizer's model.
- **Assessment focus:** misconceptions:
  1. every beat address is start + i×size even when unaligned;
  2. WRAP or FIXED bursts can break the 4KB rule;
  3. WSTRB must equal all active lanes.
- **Sub-lessons:** — (single file). Keep `sources:` (QA-pinned).

### B-AXI-3_AXI_Ordering_and_IDs — AXI Transaction Ordering & IDs
- **Tier / position:** T3 · after B-AXI-2 · before B-AXI-4 · nav #54. Frontmatter `order: 8`.
- **Purpose (one sentence):** Predict which response orders AXI ID rules allow and design ID-aware checking.
- **Objectives (learner will be able to):**
  - Predict legal response orders for outstanding transactions with the same and with different IDs (§A5.1–§A5.3, §A5.3.1).
  - Explain cross-ID read-data interleaving, and the removal of write-data interleaving (WID) in AXI4.
  - Explain that AXI gives no ordering between reads and writes, even with the same ID, and what that means for read-after-write checks (§A6.1).
  - Explain how an interconnect extends IDs and routes responses back.
  - Split ordering checks between assertions and the scoreboard.
- **Must cover:** outstanding depth as a design parameter; AxiIdOrderingVisualizer (e2e test id `axi-id-ordering-visualizer`).
- **Out of scope here (covered in):** scoreboard implementation (B-AXI-6); generic keyed matching (A-UVM-6).
- **Prerequisites:** B-AXI-2, A-UVM-6.
- **Feeds milestone:** M6.
- **Hands-on that should exist:** ordering prediction drills; a kata: a per-ID expected-queue model in plain SV.
- **Assessment focus:** misconceptions:
  1. responses with different IDs return in request order;
  2. a same-ID read and write are ordered;
  3. AXI4 write data can interleave across IDs.
- **Sub-lessons:** — (single file). Keep `sources:` (QA-pinned).

### B-AXI-4_AXI_Expert_Features_Cache_Atomics — AXI Expert Features: Cache, Prot, QoS & Atomics
- **Tier / position:** T3 · after B-AXI-3 · before B-AXI-5 · nav #55. Frontmatter `order: 9`.
- **Purpose (one sentence):** Interpret AXI attribute signals (AxCACHE, AxPROT, AxQOS, exclusive AxLOCK) and verify their effect on interconnects, caches and memory controllers.
- **Objectives (learner will be able to):**
  - Decode AxCACHE (bufferable, modifiable, allocate hints; AXI4 changes in §A4.3) and predict what an interconnect may do to a transaction.
  - Decode AxPROT (privileged; bit 1 = 1 is non-secure; instruction) and choose values for a scenario (§A4.7).
  - Explain the exclusive-access flow and monitors, EXOKAY vs OKAY, and the restrictions on exclusives (§A7.2). Note that AXI4 removed locked transfers (§A7.3).
  - Explain QoS (§A8.1) as an arbitration hint, not a guarantee.
  - Plan coverage and sequences for these attributes.
- **Must cover:**
  - AXI5 atomics as awareness only (not in IHI0022E; P2 gap);
  - ExclusiveAccessVisualizer (e2e test id `exclusive-access-visualizer`).
- **Out of scope here (covered in):** coherency (B-AMBA-F2); AXI5 atomics in depth (§4).
- **Prerequisites:** B-AXI-3.
- **Feeds milestone:** M6.
- **Hands-on that should exist:** exclusive-access predictions; a kata: exclusive read/write pair sequences with expected responses.
- **Assessment focus:** misconceptions:
  1. AxPROT[1] = 1 means secure;
  2. an exclusive write without a prior exclusive read is a protocol violation (it is legal and fails with OKAY);
  3. QoS guarantees latency.

  **Keep quiz Q1 and its answer exactly** (release test, §3.5).
- **Sub-lessons:** — (single file). Uses `<QuizQuestion>` children (§5.5).

### B-AXI-5_AXI_Pitfalls_Interconnect_Deadlocks — AXI Pitfalls & Interconnect Deadlocks
- **Tier / position:** T3 · after B-AXI-4 · before B-AXI-6 · nav #56. Frontmatter `order: 10`.
- **Purpose (one sentence):** Diagnose channel-dependency and cyclic interconnect deadlocks and boundary or strobe bugs, separating protocol violations from design policy.
- **Objectives (learner will be able to):**
  - Build the dependency graph for a master/slave pair and find a deadlocking cycle, such as WVALID waiting on AWREADY while the slave waits on WVALID (§A3.3.1).
  - Distinguish protocol violations (a source waiting on READY) from legal but risky destination policies.
  - Explain cyclic interconnect deadlocks and their mitigations.
  - Write VALID-stability checks, and liveness checks labelled as integration contracts.
  - Diagnose 4KB and WSTRB bugs using B-AXI-2's model.
- **Must cover:** the QoS/liveness contract framing; AxiDeadlockSimulator (e2e test id `axi-deadlock-simulator`).
- **Out of scope here (covered in):** burst math (B-AXI-2); VIP (B-AXI-6).
- **Prerequisites:** B-AXI-1, B-AXI-2.
- **Feeds milestone:** M6.
- **Hands-on that should exist:** Lab `axi-deadlock-hunt-lab` (owned; its `modulePrerequisites` lists a lab id); a kata: classify 6 scenarios as violation, policy or legal.
- **Assessment focus:** misconceptions:
  1. a slave waiting for WVALID before AWREADY violates the protocol;
  2. bounded READY latency is an AXI rule;
  3. 2 bytes at 0x1 with AxSIZE=1 → WSTRB `4'b0110`.
- **Sub-lessons:** — (single file).

### B-AXI-6_AXI_Verification_Performance — AXI Verification & Performance
- **Tier / position:** T3 · after B-AXI-5 · before B-AMBA-F1 · nav #57 (today followed by E-AI-1). Frontmatter `order: 11`.
- **Purpose (one sentence):** Build AXI verification components (channel-level monitor, per-ID scoreboard, protocol assertions, coverage, latency and bandwidth measurement) that accept all legal reordering and reject illegal behaviour.
- **Objectives (learner will be able to):**
  - Write a monitor with per-channel threads that reassembles transactions (W in AW order, multi-beat R with RLAST) without overwriting same-ID outstanding transactions.
  - Write a per-ID read scoreboard for M6. It accepts legal cross-ID reordering and rejects:
    - same-ID reordering;
    - a missing RLAST;
    - extra beats;
    - a wrong RID.
  - Write protocol assertions (stability, X on valid lanes, burst and LAST consistency) and a coverage model over burst × length × size × alignment × ID reuse × outstanding depth × response × backpressure.
  - Measure latency and bandwidth from monitor timestamps, and explain random-READY backpressure stimulus.
  - State a checker-vs-scoreboard responsibility matrix.
- **Must cover:** error-response policy (SLVERR/DECERR are not monitor errors by default); a slave responder model (P1 gap).
- **Out of scope here (covered in):** generic scoreboards (A-UVM-6); interconnect deadlock (B-AXI-5); bridges (B-AMBA-F1).
- **Prerequisites:** B-AXI-3, B-AXI-5, A-UVM-6, A-UVM-7.
- **Feeds milestone:** M6 (gate).
- **Hands-on that should exist:** Lab `axi-scoreboard-lab` (owned). Its starter does not compile. Extend it per LAB-M6: write path, interleaving, random READY, errors.
- **Assessment focus:** misconceptions:
  1. one outstanding entry per ID suffices in the monitor;
  2. a single FIFO scoreboard works for AXI reads;
  3. SLVERR is always a protocol error to flag in the monitor.
- **Sub-lessons:** — (single file).

### Tier 4: Expert

### E-AI-1_AI_Driven_Verification — E-AI-1: AI-Driven Verification
- **Tier / position:** T4 · after E-UVM-ML-1 · before E-RISCV-1 · nav #58 (today the first T4 module, although it lists E-PYUVM-1 as a prerequisite)
- **Purpose (one sentence):** Evaluate machine-learning and LLM techniques for stimulus, coverage closure and assertion writing, and review AI output with the rigor applied to human-written verification code.
- **Objectives (learner will be able to):**
  - Explain why constrained-random coverage curves flatten, and how ML-guided approaches (RL, evolutionary search, learned test selection) target the remaining holes.
  - Evaluate a vendor or research claim: what is measured, on which designs, against which baseline. Identify unsupported ROI figures.
  - Review LLM-generated SVA or sequences for semantic errors (sampling, vacuity, cycle off-by-one, wrong implication) using the I-SV-4A/4B rules.
  - Decide where AI fits in a flow and which human sign-off remains mandatory.
- **Must cover:**
  - tool descriptions verified; the audit found an implementation tool presented as a verification ML tool;
  - data, privacy and reproducibility concerns.
- **Out of scope here (covered in):** coverage fundamentals (I-SV-3A/3B); Python tooling (E-PYUVM-1).
- **Prerequisites:** I-SV-3B, I-SV-4B, E-PYUVM-1.
- **Feeds milestone:** M4 (awareness).
- **Hands-on that should exist:** a review exercise: 5 LLM-generated assertions with seeded semantic bugs to find and fix.
- **Assessment focus:** misconceptions:
  1. AI-generated assertions are correct if they compile;
  2. ML closure replaces the coverage model;
  3. vendor speed-ups transfer to your design.
- **Sub-lessons:** — (single file). E2E pins its H1 title text.

### E-CUST-1_UVM_Methodology_Customization — E-CUST-1: UVM Methodology Customization
- **Tier / position:** T4 · after E-DBG-1 · before E-PERF-1 · nav #59 (today after E-AI-1, before E-DBG-1)
- **Purpose (one sentence):** Extend UVM for a team (base classes, conventions, custom phases when justified, governance) without forking the methodology.
- **Objectives (learner will be able to):**
  - Design a project base-class layer (component, object and sequence bases, reporting conventions, config helpers) and justify each addition.
  - Implement a custom run-time phase correctly:
    - a `uvm_task_phase` subclass implementing `exec_task`;
    - inserted into a schedule through `uvm_domain` and the phase scheduling API (§9.3, §9.4, §9.6).

    Explain why most teams avoid custom phases.
  - Define governance: guidelines, lint, CI gates (`UVM_ERROR : 0` plus assertion and exit status), pinned uvm-core version.
  - Diagnose methodology drift: phase misordering, bypassed bases, version drift.
- **Must cover:** MethodologyPhaseVisualizer.
- **Out of scope here (covered in):** debug (E-DBG-1); performance (E-PERF-1); standard phasing (I-UVM-1C).
- **Prerequisites:** I-UVM-1C, I-UVM-1B, A-UVM-5.
- **Feeds milestone:** M8.
- **Hands-on that should exist:**
  - Lab `methodology-custom-phase` (owned). It must include `exec_task`. It lists `simple-dut-1` as a prerequisite.
  - a kata: a base driver with reset hooks.
- **Assessment focus:** misconceptions:
  1. a custom phase runs without `exec_task`/`exec_func`;
  2. custom phases are the standard way to add reset or configuration steps;
  3. forking uvm-core is acceptable for team conventions.
- **Sub-lessons:** — (single file). Today it has no quiz.

### E-DBG-1_Advanced_UVM_Debug_Methodologies — E-DBG-1: Advanced UVM Debug Methodologies
- **Tier / position:** T4 · after B-AMBA-F3 · before E-CUST-1 · nav #60. Intended **first T4 module**.
- **Purpose (one sentence):** Debug large UVM environments systematically: honest pass/fail, report control and catchers, tracing, recording, selective waveforms, seed reproduction and regression triage.
- **Objectives (learner will be able to):**
  - Decide whether a verdict is honest. Check report actions (`UVM_COUNT`), catchers, `$error` outside UVM, and zero-activity runs.
  - Write a narrow `uvm_report_catcher` (§6.6; CAUGHT vs THROW, §6.6.5). Use `+uvm_set_verbosity/+uvm_set_action/+uvm_set_severity` (G.2.3–G.2.5) and `+UVM_MAX_QUIT_COUNT` (G.2.6).
  - Triage a hang with objection and phase tracing (uvm-core impl.), timeouts, and `uvm_heartbeat` (§10.6).
  - Reproduce a failing regression seed (same seed, same build, minimal plusargs), shrink it, and bucket failures by signature.
  - Plan selective waveform capture and transaction recording for long runs.
- **Must cover:**
  - config tracing; factory and topology prints;
  - first-failure discipline;
  - the debug event-bus pattern;
  - DebuggingSimulator hang scenarios (scenario-accurate; audit D-20).
- **Out of scope here (covered in):** reporting basics (proposed I-UVM-1D); recording basics (I-UVM-6); seed semantics (I-SV-2B).
- **Prerequisites:** I-UVM-6, I-UVM-1C, A-UVM-6 (and proposed I-UVM-1D).
- **Feeds milestone:** M8.
- **Hands-on that should exist:**
  - Lab `debug-waveform-trigger` (owned);
  - `hang-lab.mdx` with DebuggingSimulator;
  - a kata: bucket 3 failing logs and find the first failure.
- **Assessment focus:** misconceptions:
  1. `UVM_ERROR : 0` proves the test passed;
  2. a catcher that demotes every error is a fix;
  3. the same seed reproduces a failure after a rebuild with changed code.
- **Sub-lessons:**
  - `effective-debug.mdx`: a 43-line stub (first failure, visibility, reproduce/compare/shrink). Fold it into the index or expand it.
  - `hang-lab.mdx`: guided hang triage.

  Both lack frontmatter and the template.

### E-EMU-1_Emulation_Aware_Verification — E-EMU-1: Emulation-Aware Verification
- **Tier / position:** T4 · after E-INT-1 · before E-PSS-1 · nav #61 (today after E-DBG-1, before E-INT-1)
- **Purpose (one sentence):** Adapt UVM benches for hardware emulation by splitting them into synthesizable HDL-side transactors and HVL-side transaction-level code, and judge the speed and visibility trade-offs.
- **Objectives (learner will be able to):**
  - Explain why pin-level TB/DUT synchronization limits emulation speed, and how transaction-level transactors remove it: split HVL/HDL BFMs and SCE-MI-style interfaces.
  - Partition an agent into an HDL BFM (synthesizable, in the interface) and an HVL proxy class communicating by function and task calls.
  - List emulation-safe coding rules and debug-visibility options (probes, triggers, in-emulation assertions) and their costs.
  - Compare simulation, emulation and FPGA prototyping for a goal, with vendor claims sourced.
- **Must cover:** Accellera SCE-MI (awareness); vendor platform architectures verified (the audit found ZeBu and Veloce swapped).
- **Out of scope here (covered in):** simulation performance (E-PERF-1); PSS (E-PSS-1).
- **Prerequisites:** A-UVM-8, I-SV-7, E-PERF-1.
- **Feeds milestone:** M8 (awareness).
- **Hands-on that should exist:** a kata: refactor a pin-level driver into an interface task (HDL BFM) plus a class proxy.
- **Assessment focus:** misconceptions:
  1. a standard UVM bench runs unmodified on an emulator;
  2. emulation gives full waveform visibility for free;
  3. vendor architectures are interchangeable.
- **Sub-lessons:** — (single file). E2E pins its H1 title text.

### E-INT-1_Integrating_UVM_with_Formal_Verification — E-INT-1: Integrating UVM with Formal Verification
- **Tier / position:** T4 · after E-PERF-1 · before E-EMU-1 · nav #62
- **Purpose (one sentence):** Combine formal and simulation by sharing assertions, aligning assumptions with stimulus constraints, and replaying counterexamples.
- **Objectives (learner will be able to):**
  - Build a formal harness around a block that reuses the env's interface assertions (bound checkers), with `assume` on inputs and `assert`/`cover` on outputs.
  - Explain how assumptions relate to constraints without being equivalent, and diagnose over-constraint (masked bugs, vacuity) and under-constraint (spurious counterexamples).
  - Replay a counterexample in simulation and decide whether it is a bug or an assumption gap.
  - Plan a hybrid flow: which properties go to formal and which to simulation, and how results are reported.
- **Must cover:**
  - `assert/assume/cover/restrict` (§16.14.1–§16.14.4);
  - covers to detect vacuity;
  - bounded vs full proofs;
  - formal apps (awareness);
  - FormalVsSimulationVisualizer.
- **Out of scope here (covered in):** SVA syntax (I-SV-4A/4B); checkers and bind (I-SV-4C).
- **Prerequisites:** I-SV-4B, I-SV-4C, A-UVM-6.
- **Feeds milestone:** M8; M6 (protocol properties).
- **Hands-on that should exist:** Lab `formal-harness` (owned); a kata: turn a sequence's constraints into assumptions and check for vacuity with covers.
- **Assessment focus:** misconceptions:
  1. every counterexample is a design bug;
  2. a proof under over-constrained assumptions proves the design;
  3. constraints and assumptions are interchangeable.
- **Sub-lessons:** — (single file). Today it has no quiz.

### E-PERF-1_UVM_Performance — E-PERF-1: UVM Performance
- **Tier / position:** T4 · after E-CUST-1 · before E-INT-1 · nav #63
- **Purpose (one sentence):** Measure and improve simulation and regression throughput of UVM environments using profiles, not folklore.
- **Objectives (learner will be able to):**
  - Read a profile and attribute time to TB vs DUT and to UVM hotspots: `config_db` lookups in loops, message construction outside the `` `uvm_info `` guard, objection churn per item, recording, creation in loops, coverage sampling.
  - Apply targeted fixes and measure the gain: cache lookups, raise and drop once, disable recording and waves in regressions, compile once and run many.
  - Plan regression throughput: selection, parallelism, licence and queue limits.
  - Explain which scheduler behaviours cost time (polling vs event waits, `#0`, excess iterations) without re-teaching scheduling.
- **Must cover:** measurement discipline; an illustrative-data label on every number.
- **Out of scope here (covered in):** scheduling semantics (F3B/F3C). Today its "Clause 4: The Event Scheduler" section re-teaches them with false claims; link instead. Also out of scope: emulation (E-EMU-1).
- **Prerequisites:** I-UVM-1C, A-UVM-6 (and proposed I-UVM-1D).
- **Feeds milestone:** M8.
- **Hands-on that should exist:** Lab `uvm-performance-1` (coming soon; owned); a kata: a profile-guided fix of a verbose monitor.
- **Assessment focus:** misconceptions:
  1. mixing `=` and `<=` causes infinite delta loops;
  2. TLM FIFOs add parallelism;
  3. a direct `uvm_report_info(…, $sformatf(…))` is as cheap as the guarded macro when filtered.
- **Sub-lessons:** — (single file). Today it has no quiz and its Next has no link.

### E-PSS-1_Portable_Stimulus_Standard — E-PSS-1: Portable Stimulus Standard
- **Tier / position:** T4 · after E-EMU-1 · before E-PWR-1 · nav #64. The E-PSS-1 → E-PWR-1 adjacency is e2e-pinned by `learner-flow.spec.ts`.
- **Purpose (one sentence):** Write portable test intent in Accellera PSS and explain how tools map it to UVM sequences and bare-metal C.
- **Objectives (learner will be able to):**
  - Model a scenario with components, actions, activities (sequence, parallel, select, repeat) and data constraints.
  - Use flow objects (buffers, streams, states) and resource objects (lock, share) correctly as inputs, outputs and claims.
  - Explain how a tool generates a UVM virtual sequence and a C test from one model, and what must still be hand-written (realization and exec blocks).
  - Decide when PSS adds value over UVM virtual sequences.
- **Must cover:**
  - PSS is an **Accellera** standard: cite version 2.1 or 3.0 and verify each feature against it. Do not cite an IEEE number.
  - syntax validated against the specification;
  - the tool landscape, verified.
- **Out of scope here (covered in):** virtual sequences (I-UVM-3B); SoC strategy (E-SOC-1).
- **Prerequisites:** A-UVM-8, I-UVM-3B.
- **Feeds milestone:** M8 (awareness).
- **Hands-on that should exist:** Lab `pss-portable-intent` (owned; its route, LabLink and step flow are e2e-pinned).
- **Assessment focus:** misconceptions:
  1. PSS has an IEEE number such as 2401 or P2851;
  2. resources are passed as action inputs;
  3. PSS replaces UVM.

  **Keep the release-tested quiz question, the LabLink and the H1 title.**
- **Sub-lessons:** — (single file). E-SOC-1/`pss.mdx` duplicates it (§3.2).

### E-PWR-1_Power_Aware_Verification — Power-Aware UVM Verification Strategy
- **Tier / position:** T4 · after E-PSS-1 · before E-PYUVM-1 · nav #65. Must keep both a Previous and a Next link (release test).
- **Purpose (one sentence):** Verify designs under power intent (corruption and isolation, PMU handshakes, shutdown and wake-up sequences, power-aware assertions, power-state coverage) inside a UVM environment.
- **Objectives (learner will be able to):**
  - Predict TB-visible behaviour during power transitions (corruption, clamps, retention restore), and adapt monitors and scoreboards: pause checks, flush, expect reset values.
  - Write a power-cycle virtual sequence: quiesce traffic, sequence isolation, retention and power through the PMU, resume, and handle in-flight transactions.
  - Write power-aware SVA (isolation before power-down; restore before isolation release) and power-state and transition coverage.
  - Diagnose power bugs from symptoms: X leakage, lost retention, wake-up before reset completes.
- **Must cover:**
  - objections and phases across power events;
  - stopping stimulus safely (`stop_sequences`/`kill` §14.2.5.11, or flags; callbacks do not abort sequences).
- **Out of scope here (covered in):** UPF syntax (I-SV-8); reset strategy basics (proposed A-UVM-9).
- **Prerequisites:** I-SV-8, A-UVM-8, I-SV-4A.
- **Feeds milestone:** M8.
- **Hands-on that should exist:** Lab `power-aware-retention` (owned). Keep its title and its `/practice/lab/` LabLink (release test).
- **Assessment focus:** misconceptions:
  1. callbacks can abort a running sequence;
  2. powered-down outputs read as 0;
  3. scoreboards keep comparing through a power cycle.
- **Sub-lessons:** — (single file). Today it has a `#` H1, no `## Quick Take`, no quiz, and a stray `order: 2`. **Do not change the title** "Power-Aware UVM Verification Strategy".

### E-PYUVM-1_Python_Based_Verification — E-PYUVM-1: Python-Based Verification
- **Tier / position:** T4 · after E-PWR-1 · before E-UVM-ML-1 · nav #66
- **Purpose (one sentence):** Build testbenches in Python with cocotb and pyuvm, map them to SV/UVM concepts, and decide when Python is the better tool.
- **Objectives (learner will be able to):**
  - Write a cocotb test with coroutines and triggers (`await RisingEdge(…)`, `Timer`), a clock, and a protocol-correct driver and monitor. VALID drops after its handshake.
  - Map pyuvm classes, phases, `ConfigDB` and TLM to SV UVM, and name the differences.
  - Explain the execution model (Python scheduled through VPI, VHPI or FLI callbacks) and its performance implications.
  - Choose Python or SV UVM for a project: skills, ecosystem, performance, tool support.
- **Must cover:** state the cocotb and pyuvm versions (APIs changed in cocotb 2.0; verify); examples that obey the protocol.
- **Out of scope here (covered in):** DPI (I-SV-7); multi-language UVM (E-UVM-ML-1); AI (E-AI-1).
- **Prerequisites:** I-UVM-3A, I-UVM-2B.
- **Feeds milestone:** — (transfer of M2 to Python).
- **Hands-on that should exist:** a kata: port the T2 first-env agent to cocotb/pyuvm for the same DUT.
- **Assessment focus:** misconceptions:
  1. cocotb runs the DUT in Python;
  2. pyuvm is source-compatible with SV UVM;
  3. holding AWVALID/ARVALID until the response is fine.
- **Sub-lessons:** — (single file). E2E pins its H1 title text.

### E-RISCV-1_RISC_V_Verification_Methodology — E-RISCV-1: RISC-V Verification Methodology
- **Tier / position:** T4 · after E-AI-1 · before E-SOC-1 · nav #67
- **Purpose (one sentence):** Verify a RISC-V core with random instruction generation, ISA coverage, step-and-compare against an ISS and formal ISA checks.
- **Objectives (learner will be able to):**
  - Explain what makes processor verification differ from peripheral verification: architectural state, privilege, exceptions and interrupts, nondeterminism.
  - Configure an instruction generator (RISCV-DV, verified options only) and an ISA coverage model (riscv-isac).
  - Implement a robust trace compare against an ISS: length checks, handling of asynchronous events.
  - Explain RVFI and riscv-formal, and where formal complements simulation.
- **Must cover:** verified tool facts only (the audit found invented RISCV-DV YAML).
- **Out of scope here (covered in):** generic formal (E-INT-1); generic constrained-random (I-SV-2A/2B).
- **Prerequisites:** I-SV-2B, E-INT-1, A-UVM-6.
- **Feeds milestone:** M3 (reference-model comparison, transferred).
- **Hands-on that should exist:** a kata: a trace compare that detects truncation and mismatch; an interrupt-injection test plan.
- **Assessment focus:** misconceptions:
  1. `zip()`-style trace compares are sufficient;
  2. random instruction streams need no constraints;
  3. ISS compare handles asynchronous interrupts automatically.
- **Sub-lessons:** — (single file). E2E pins its H1 title text.

### E-SOC-1_SoC-Level_Verification_Strategies — E-SOC-1: SoC-Level Verification Strategies
- **Tier / position:** T4 · after E-RISCV-1 · before — (course end; capstone) · nav #68
- **Purpose (one sentence):** Plan and run subsystem/SoC verification (VIP reuse, firmware-driven tests, interconnect observability, resets, errors, power, closure, regression and sign-off) and deliver the capstone.
- **Objectives (learner will be able to):**
  - Write a staff-level SoC strategy: scope, reuse plan, test layers, checkers, coverage, regression, sign-off criteria and risk register.
  - Reconfigure block agents for SoC (passive where an embedded processor drives, active where the bench drives) and keep their checks useful.
  - Plan firmware and TB co-operation: mailbox registers, backdoor loads, SoC-level RAL and its prediction limits (auto-predict does not see other masters).
  - Plan system-level reset, error, power and concurrency scenarios, and the coverage and regression evidence for sign-off.
  - Define regression tiers, the triage flow and closure gates.
- **Must cover:**
  - env of envs;
  - interconnect monitors and liveness properties;
  - CDC/RDC awareness (P2);
  - the M8 capstone link.
- **Out of scope here (covered in):** PSS language (E-PSS-1); emulation (E-EMU-1); power details (E-PWR-1); reset and error mechanics (proposed A-UVM-9).
- **Prerequisites:** A-UVM-8, A-UVM-4B, E-DBG-1 (and proposed A-UVM-9).
- **Feeds milestone:** M8 (gate).
- **Hands-on that should exist:**
  - Labs `soc-vip-reuse` and `soc-strategy-capstone` (owned; `soc-vip-reuse` lists `simple-dut-1`);
  - **LAB-M8**, the DMA code capstone: re-own `dma-1` (coming soon) here.
- **Assessment focus:** misconceptions:
  1. auto-predict keeps the mirror right when firmware writes;
  2. block scoreboards transfer to SoC unchanged;
  3. SoC closure is the union of block coverage.
- **Sub-lessons:** `pss.mdx` duplicates E-PSS-1 and cites a wrong standard number; merge it into E-PSS-1 and redirect (P2). Today the index has no quiz.

### E-UVM-ML-1_Multi_Language_Verification — E-UVM-ML-1: Multi-Language Verification
- **Tier / position:** T4 · after E-PYUVM-1 · before E-AI-1 · nav #69 (today last)
- **Purpose (one sentence):** Connect SystemVerilog UVM with SystemC/C++ models at transaction level, and choose among DPI, multi-language frameworks and other bridges.
- **Objectives (learner will be able to):**
  - Choose DPI, a TLM-level multi-language bridge, or co-simulation for integrating a C++/SystemC reference model.
  - Explain the UVM TLM-2 concepts used at language boundaries (§12.3): generic payload (§12.3.4.2), `b_transport`/`nb_transport`, sockets (§12.3.5), phases.
  - Describe how a multi-language framework synchronizes phases and passes transactions, and state its limitations and support status from sources.
  - Plan a mixed-language environment and its debug implications.
- **Must cover:** verified origins and status of UVM-ML OA and UVM Connect (the audit found UVM Connect misattributed); SystemC TLM-2.0 (IEEE 1666, awareness).
- **Out of scope here (covered in):** DPI basics (I-SV-7); Python (E-PYUVM-1).
- **Prerequisites:** I-SV-7, I-UVM-2B.
- **Feeds milestone:** M3 (reference models); M8.
- **Hands-on that should exist:** a kata: wrap one C++ model via DPI and sketch the TLM-2 alternative; compare.
- **Assessment focus:** misconceptions:
  1. attributions such as "UVM Connect is a Synopsys product";
  2. frameworks are supported identically by all simulators;
  3. DPI is always sufficient.
- **Sub-lessons:** — (single file). E2E pins its H1 title text.

---

## 3. Sequencing problems

### 3.1 Concepts used before they are taught

| Where | Used before taught | Taught in | Fix |
|---|---|---|---|
| F2B index (scoreboard example) | `uvm_component`, `` `uvm_component_utils ``, `` `uvm_error ``, `check_phase` | I-UVM-1A/1C | Rewrite in plain SV |
| F2C index ("Timeline of a Simulation Tick", Scheduler Game) | full region model | F3B | Label as preview. Moving the game to F3B needs the lead to update `F2_F3_lessons`/`f2-revamp`/`phase9-visuals` specs |
| F2D index (`$cast` example) | class downcasting | I-SV-1 polymorphism-pitfalls | Use an enum (F2A) or drop it |
| F2D/`ipc.mdx` | built-in `mailbox`/`semaphore` classes, handles, `new` | I-SV-1, I-SV-5 | Keep as a labelled first look; link forward to I-SV-5 (plan.md §1) |
| F2D nav order (ipc before tasks-functions) | tasks | tasks-functions | Order index → tasks-functions → ipc |
| F4B "The Bridge to Classes" | classes; `uvm_config_db` set/get code | I-SV-1; I-UVM-2C | Minimal class syntax labelled as preview; replace config_db code with a forward link |
| F4C driver/monitor classes ("both classes get vif from `uvm_config_db`") | classes, config_db | I-SV-1; I-UVM-2C | Task form first (M1); class form as preview |
| I-SV-1 nav order (copying-and-cloning before polymorphism-pitfalls) | virtual dispatch and `$cast` used by `clone()` | polymorphism-pitfalls | Reorder |
| I-SV-3B nav order (closure → apis → linking) | plan linkage, query APIs | linking-coverage, coverage-apis | Reverse |
| I-UVM-1A/1B (`build_phase`, `connect_phase`) | phase semantics | I-UVM-1C | 1A introduces both at preview depth; 1C owns them |
| I-UVM-2A (agent and monitor code) | analysis ports; `config_db` get | I-UVM-2B; I-UVM-2C | Labelled previews; assembled in proposed I-UVM-3C |
| I-UVM-3A (field macros, `do_copy/do_compare`) | object methods and policies | I-UVM-4 (after 3B) | I-UVM-1A owns object-method basics |
| All T2 UVM lessons (`uvm_info/uvm_error`, `run_test`, log reading) | reporting and run control | E-DBG-1 (T4) only | Proposed I-UVM-1D (P0) |
| T2 links to `uvm-mini-capstone` as a "Capstone Checkpoint" (I-UVM-1B, 2A, 2B, 3A) | full env including scoreboard; the lab is owned by A-UVM-6 with T3 lab prerequisites | A-UVM-6 | Re-own under proposed I-UVM-3C and drop the T3 prerequisites |
| I-UVM-3B nav order (lab first, handshake sixth) | handshake, virtual sequences | sub-lessons 1–2 | Authored order (I-UVM-3B card) |
| I-SV-9 ("a fully functioning UVM testbench by the end of T2") | complete env | none in T2 | Proposed I-UVM-3C |
| A-UVM-4A/4B as the first T3 modules | scoreboard-style prediction; callbacks (`uvm_reg_cbs`) | A-UVM-6, A-UVM-5 | Move RAL after A-UVM-8 |
| A-UVM-7, A-UVM-8 (and I-UVM-2A) use APB examples | APB protocol | none | Proposed B-APB-1, or define the APB subset inline |
| B-AHB-1..3 before B-AMBA-1/2; B-AMBA-F1/F2/F3 before any B-AXI | family intro; AXI | B-AMBA-1/2; B-AXI-* | Honour frontmatter `order` (PLAT-2) |
| E-AI-1 (nav first in T4) requires E-PYUVM-1; E-EMU-1 (nav before E-PERF-1) says to optimize simulation first | — | — | Intended T4 order (§3.4) |
| Six available UVM labs list `simple-dut-1` (coming soon; owner "F4", not a module id; README is a non-UVM first TB) as a lab prerequisite | — | — | Lead: re-scope `simple-dut-1` as the M0 lab under proposed F2E; UVM labs depend on the T2 first-env lab instead (Appendix B) |

### 3.2 Duplicated coverage and owners

| Topic | Appears in | Owner | Others do |
|---|---|---|---|
| Events, mailboxes, semaphores | F2D/ipc, I-SV-5 (index + 3) | I-SV-5 | F2D/ipc is the first look and links forward |
| fork/join, `disable fork`, `wait fork`, fork-in-loop | F2C, I-SV-5 index | F2C | I-SV-5 recaps and owns `process` (§9.7) |
| `$cast` | F2A, F2D, I-SV-1 polymorphism-pitfalls | F2A (enum, static cast); I-SV-1 (class downcast) | F2D drops it |
| Scheduling regions | F2C (table, game), F3A, F3B, F3C, E-PERF-1 | F3B (regions); F3C (deltas, races); F3A (time) | F2C preview only; E-PERF-1 links |
| `` `define/`ifdef `` | F4A, I-SV-6 | I-SV-6 | F4A keeps package scope `::` and `` `include `` of packages |
| Packed vs unpacked arrays | F2A, F2B | F2A | F2B links |
| Immediate vs concurrent | I-SV-4A index, I-SV-4A/immediate-vs-concurrent | the sub-lesson | Index summarizes |
| `disable iff` | I-SV-4A, I-SV-4B/multi-clocking | I-SV-4A | 4B covers multiclock interplay only |
| Sequencer–driver handshake | I-UVM-2B, I-UVM-3A, I-UVM-3B/handshake | I-UVM-3A (protocol, basic responses); I-UVM-3B (hangs, response handler) | 2B mentions the pull port only |
| Virtual sequences and sequencers | I-UVM-3B (index, 2 pages), A-UVM-8 | I-UVM-3B | A-UVM-8 applies them to multi-agent architecture |
| Arbitration, `lock`/`grab` | sequence-arbitration, sequence-libraries | sequence-arbitration | Libraries drops `grab/ungrab` |
| Active/passive | I-UVM-2A, A-UVM-7, E-SOC-1 | I-UVM-2A (mechanism); A-UVM-7 (VIP config); E-SOC-1 (reuse strategy) | — |
| Analysis FIFO decoupling | I-UVM-2B, A-UVM-6 | I-UVM-2B (TLM mechanics) | A-UVM-6 owns scoreboard architecture |
| Out-of-order / per-ID matching | A-UVM-6, B-AXI-3, B-AXI-6 | A-UVM-6 (generic keyed matching); B-AXI-6 (AXI application) | B-AXI-3 keeps the ordering rules |
| RAL adapter | A-UVM-4A, A-UVM-4B ("The Adapter Bridge" in both) | A-UVM-4A | 4B covers adapter edge cases |
| RAL prediction | A-UVM-4B index, explicit-vs-implicit | explicit-vs-implicit | Index summarizes |
| 4KB boundary | B-AXI-2, B-AXI-5, B-AMBA-F1, B-AMBA-F3 | B-AXI-2 | Others link and apply |
| VALID/READY handshake | B-AMBA-2, B-AXI-1 | B-AXI-1 (normative) | B-AMBA-2 intuition only |
| PSS | E-PSS-1, E-SOC-1/pss | E-PSS-1 | Merge and redirect |
| UPF | I-SV-8, E-PWR-1 | I-SV-8 (language); E-PWR-1 (verification) | — |
| `uvm_event`/`uvm_barrier` | I-SV-5/events, I-UVM-1C, I-UVM-5, A-UVM-8 | I-UVM-1C (semantics) | I-UVM-5 owns pools; A-UVM-8 applies |
| Debug switches and hang triage | I-UVM-1C, I-UVM-3B handshake, E-DBG-1 | proposed I-UVM-1D (basics); I-UVM-1C (objections, timeouts); E-DBG-1 (methodology) | — |
| Recording | I-UVM-6, I-UVM-4, E-DBG-1 | I-UVM-6 | I-UVM-4 covers `uvm_recorder` as a policy |
| Seeds and reproducibility | I-SV-2B/randomization-methods, E-DBG-1, E-SOC-1 | I-SV-2B (semantics); E-DBG-1 (workflow) | E-SOC-1 strategy |
| Coverage closure | I-SV-3B, E-AI-1, E-SOC-1 | I-SV-3B | Others apply |
| Error injection | I-UVM-1B, A-UVM-5, A-UVM-7 | proposed A-UVM-9 (strategy) | 1B and A-UVM-5 own the mechanisms |

### 3.3 Navigation-order and "Next"-link problems

1. **The generator ignores authored order.** `scripts/generate-curriculum-data.ts` sorts folders and files alphabetically and ignores frontmatter `order` (D-10/PLAT-2). The resulting Prev/Next buttons:
   - **AMBA:** AHB-1..3 → AMBA-1 → AMBA-2 → F1 → F2 → F3 → AXI-1..6. The authored `order` 1–14 says AMBA-1, AMBA-2, AHB-1..3, AXI-1..6, F1..F3.
   - **T4:** alphabetical, so E-AI-1 comes first.
   - **T3:** RAL first.
   - **Sub-lessons:** I-UVM-3B, F2D, I-SV-1, I-SV-3B and A-UVM-4B are in the wrong order (cards above).
2. **Stray or ignored `order` values:** I-SV-8 `order: 8`, E-PWR-1 `order: 2`.
3. **Authored "Next" links that skip or leave the path:**
   - I-UVM-6 → E-DBG-1 (skips all of T3);
   - A-UVM-4B → "Move to Tier-4…" (no link);
   - A-UVM-8 → E-SOC-1 (skips AMBA);
   - E-SOC-1 and E-PERF-1 have vague or no links;
   - I-SV-8 has no Next;
   - B-AMBA-2's text says "next module… AHB" while nav goes to F1;
   - AMBA-F1/F2/F3 and AHB-1/2/3 have no References & Next Topics section;
   - prerequisite claims in E-AI-1 (E-PYUVM-1) and E-EMU-1 (E-PERF-1) contradict today's nav.
4. **Three link styles coexist:** relative `../X/`, absolute `/curriculum/T…/…/index`, and lowercase pretty slugs (`/curriculum/t2-intermediate/…`). Standardize per §5.9.
5. **Frontmatter defects:**
   - I-UVM-6 uses `flashcardId`;
   - I-SV-8 and I-SV-9 have no deck;
   - 30 of the 36 sub-lessons use `export const metadata` (titles carry " | Series" suffixes) and an `<InfoPage>` that renders a second H1; 33 sub-lessons have no deck;
   - B-AXI-1/2/3 and B-AMBA-F2 `sources:` cite IHI0022H while the verified text is IHI0022E.
6. **I-SV-8 placement.** It stays in T2 as an elective and hard prerequisite of E-PWR-1; fix its Next link to I-SV-9. Moving the folder into T4 before E-PWR-1 (P2) would need a redirect and would break the `learner-flow` E-PSS-1 → E-PWR-1 adjacency unless placed elsewhere.

### 3.4 Intended order (spine order)

Proposed modules are in *italics*. "nav #" is today's position.

| # | Module | nav # | Note |
|---|---|---|---|
| **T1** | | | |
| 1–7 | F1A, F1B, F1C, F2A, F2B, F2C, F2D | 1–7 | unchanged |
| 8 | *F2E First Self-Checking Testbench* | — | proposed (M0 gate) |
| 9–14 | F3A, F3B, F3C, F4A, F4B, F4C | 8–13 | unchanged |
| **T2** | | | |
| 15–25 | I-SV-1, I-SV-2A, I-SV-2B, I-SV-3A, I-SV-3B, I-SV-4A, I-SV-4B, I-SV-4C, I-SV-5, I-SV-6, I-SV-7 | 14–24 | unchanged |
| 26 | I-SV-8 | 25 | elective; prerequisite of E-PWR-1 |
| 27–30 | I-SV-9, I-UVM-1A, I-UVM-1B, I-UVM-1C | 26–29 | unchanged |
| 31 | *I-UVM-1D Reporting, Run Control and Pass/Fail* | — | proposed |
| 32–35 | I-UVM-2A, I-UVM-2B, I-UVM-2C, I-UVM-3A | 30–33 | unchanged |
| 36 | *I-UVM-3C First Complete Testbench* | — | proposed (M2 gate for T2); folder sorts after 3B if PLAT-2 is not done |
| 37–40 | I-UVM-3B, I-UVM-4, I-UVM-5, I-UVM-6 | 34–37 | unchanged |
| **T3** | | | |
| 41 | A-UVM-6 | 41 | moved first |
| 42 | A-UVM-7 | 42 | |
| 43 | A-UVM-5 | 40 | after VIP |
| 44 | A-UVM-8 | 43 | |
| 45 | *A-UVM-9 Reset Handling and Error Injection* | — | proposed |
| 46–47 | A-UVM-4A, A-UVM-4B | 38–39 | RAL after the env block |
| 48–49 | B-AMBA-1, B-AMBA-2 | 47–48 | authored `order` 1–2 |
| 50 | *B-APB-1 APB Protocol & Verification* | — | proposed |
| 51–53 | B-AHB-1, B-AHB-2, B-AHB-3 | 44–46 | |
| 54–59 | B-AXI-1 … B-AXI-6 | 52–57 | |
| 60–62 | B-AMBA-F1, B-AMBA-F2, B-AMBA-F3 | 49–51 | authored `order` 12–14 |
| **T4** | | | |
| 63 | E-DBG-1 | 60 | first: debug at scale |
| 64 | E-CUST-1 | 59 | |
| 65 | E-PERF-1 | 63 | |
| 66 | E-INT-1 | 62 | |
| 67 | E-EMU-1 | 61 | |
| 68 | E-PSS-1 | 64 | keeps the e2e-pinned E-PSS-1 → E-PWR-1 adjacency |
| 69 | E-PWR-1 | 65 | |
| 70 | E-PYUVM-1 | 66 | |
| 71 | E-UVM-ML-1 | 69 | |
| 72 | E-AI-1 | 58 | needs E-PYUVM-1 |
| 73 | E-RISCV-1 | 67 | |
| 74 | E-SOC-1 | 68 | capstone (M8) |

Implementation is the lead's (PLAT-2): give every index an `order`, give sub-lessons an `order`, and make the generator honour it.

### 3.5 E2E- and QA-pinned lesson content

Authors must preserve these elements, or ask the lead to update the named spec in the same wave.

| Lesson | Pinned element | Spec |
|---|---|---|
| F1A | H1; "The Multi-Million Dollar Question"; "Design vs. Verification"; Hall of Shame carousel with "Intel Pentium FDIV bug (1994)" and "Ariane 5 Flight 501" | `f1-revamp` |
| F1B / F1C | H1s; `verification-methodologies-diagram`, `first-bug-hunt-game`; `verilog-vs-sv` visual text | `f1-revamp` |
| F2A | "Core Data Types" heading; "Quick Take"; `curriculum-data-type-explorer`; `data-type-quiz` (5/5 flow) | `f2-revamp`, `f2-lessons`, `F2_F3_lessons` |
| F2B | "Quick Take"; "Bounded queue comparison", "Container lab" and "Array method explorer" regions; 3D canvas | `f2-revamp`, `f2-lessons`, `phase9-visuals`, `canvas-health-check` |
| F2C | "Procedural Code and Flow Control"; "Quick Take"; "Timeline of a Simulation Tick"; link "Procedural Flow Control"; "Event Region Scheduler" / "Start Challenge" | `f2-revamp`, `F2_F3_lessons`, `phase9-visuals` |
| F2C/flow-control | "Procedural Flow Control" heading | `F2_F3_lessons` |
| F2D | "System Tasks and File I/O"; "Interactive Example: The Logger"; link "Interprocess Communication" to `/ipc` | `F2_F3_lessons`, `f2-revamp` |
| F2D/ipc | "Interprocess Communication" heading; "Mailbox and semaphore lab" | `F2_F3_lessons`, `phase9-visuals` |
| F4A / F4B / F4C | H1 title text; "The fundamental building blocks of SystemVerilog"; "Modport Explorer"; "The Race Condition Problem" | `F4_lessons` |
| F3B, B-AHB-1, B-AHB-2, B-AXI-1, B-AXI-2, B-AXI-3, B-AMBA-F2 | `sources:` frontmatter with a `standard` entry | `tests/qa/sourceMetadataAudit` |
| I-UVM-3B | arbitration → libraries Next adjacency; `virtual-sequences` has a Monaco editor; `uvm-virtual-sequencer.mdx` contains `<VirtualSequencerExplorer />`; `coordinated-attack-lab` route exists | `navigation`, `module5`, `theming`, `tests/qa/iuvm3SplitMergeAudit` |
| A-UVM-6/7/8, E-AI-1, E-EMU-1, E-PSS-1, E-PYUVM-1, E-RISCV-1, E-UVM-ML-1 | H1 contains the current title | `t3_t4_new_modules` |
| AMBA (14) | H1 contains the frontmatter title; "Reinforce the essentials" deck section; per-module visualizer test ids; bridge scenario and analogy-explorer steps | `amba-curriculum` |
| B-AXI-4 | flashcard section; quiz Q1 "If a master wants to poll a hardware status register…" with answer "4'b0000 (Non-bufferable, Non-cacheable) to ensure strict ordering" as the first question | `regression-gates` |
| E-PSS-1 | H1; "Launch Lab" → `pss-portable-intent`; flashcards; quiz; Next → E-PWR-1 | `learner-flow` |
| E-PWR-1 | H1 "Power-Aware UVM Verification Strategy"; `/practice/lab/` LabLink; Prev and Next links | `learner-flow`, `regression-gates` |
| all | every curriculum link resolves; H1 visible | `curriculum-integrity`, `curriculum-links`, `curriculum-navigation-comprehensive` |

---

## 4. Coverage gaps

Priority definitions:
- **P0:** blocks a milestone (M0–M8) or a tier exit competency, or the concept is used by later modules without ever being taught.
- **P1:** expected of a complete industry-grade path (daily practice, interviews) but not blocking a milestone.
- **P2:** specialist or advanced; nice to have.

### 4.1 Gap list

| # | Missing or thin concept | Proposed home | Pri | Why |
|---|---|---|---|---|
| G1 | UVM reporting and run control:<br>• severities, verbosity, actions and IDs; macros (B.1)<br>• report summary and pass/fail from severity counts (§6.5)<br>• `+UVM_TESTNAME`, `+UVM_VERBOSITY`, `+uvm_set_*`, `+UVM_MAX_QUIT_COUNT` (G.2)<br>• `run_test`, `set_timeout` (F.7.3.3)<br>• why `$display`/`$error` don't count | **New I-UVM-1D** (T2, after I-UVM-1C) | P0 | Every M2–M8 acceptance is a UVM report signature; today taught only in T4 E-DBG-1 (verbosity appears in no T2 lesson) |
| G2 | First complete, runnable UVM testbench: top, interface, vif via `config_db`, test/env/agent/driver/monitor/sequencer/sequence, analysis-FIFO scoreboard with `check_phase`, objections, expected log | **New I-UVM-3C** (T2, after I-UVM-3A) | P0 | I-SV-9 promises it; T3 assumes it; M2 starts here; audit appendix C §3 verdict "No" |
| G3 | Testbench reset handling (reset-aware driver, monitor and scoreboard flush; mid-test reset) and error injection with expected-error accounting | **New A-UVM-9** (T3, after A-UVM-8) | P0 | M8 acceptance (reset mid-transfer, error injection); coverage-matrix row "Reset and error injection" is 0/0/0/0/0 |
| G4 | Self-checking directed bench assembly: clock/reset generation, stimulus and checker tasks, `!==` compares, summary line, timeout, fails on a mutant | **New F2E** (T1, after F2D) | P0 | M0 has no lesson that assembles the pieces; the `simple-dut-1` README refers to a non-existent "F4: Your First Testbench" |
| G5 | Structs (packed/unpacked), packed unions, `typedef` of aggregates | F2A, new sub-lesson `structs-unions-enums.mdx` (or a section) | P0 | Used in F2B, F4A and I-SV-* code; never taught (`struct` does not occur in F2A) |
| G6 | Operators depth: `inside`, `==?`, `case inside`, reduction, shift and replication (§11.4.9–§11.4.12), **streaming operators** (§11.4.14) and bit-stream casting (§6.24.3), `$bits` (§20.6.2) | F2A, new sub-lesson `operators-and-expressions.mdx` (reuse orphan deck `F2C_Operators`) | P1 | Packing and unpacking protocol payloads; streaming operators, `==?`, `case inside` and `$bits` occur in no lesson |
| G7 | Plusargs (`$value$plusargs/$test$plusargs` §21.6), `$readmemh` (§21.4), `$finish/$stop` (§20.2), VCD dumping (§21.7) | F2D index | P1 | Every runnable bench needs them; 0–2 occurrences today |
| G8 | Layered class-based SV testbench (pre-UVM architecture) | I-SV-9 Make It Work (+ re-scoped lab `fifo-1`); plumbing in I-SV-5 | P1 | T2-SV exit competency and the bridge to UVM (audit appendix B §4, P8) |
| G9 | Sequence-started objections, `get_starting_phase`, `set_automatic_phase_objection` (§14.2.4) | I-UVM-3A | P1 | Correct end-of-test practice; 0 occurrences |
| G10 | APB protocol (setup/access phases, PREADY waits, PSLVERR, APB4/5 signals) | **New B-APB-1** (T3, AMBA order 3) | P1 | The most common register bus; used in A-UVM-7/8 and I-UVM-2A examples; the simplest first protocol agent |
| G11 | Responder (slave) agents and reactive sequences; AXI/AHB stimulus agents with random READY and error injection | A-UVM-7 (pattern) + B-AXI-6 / B-AHB-3 (application) | P1 | M6 needs a reordering slave and backpressure (audit appendix E, X10) |
| G12 | Routing SVA failures into UVM reporting; `$assertoff` control from tests | A-UVM-7 (VIP interfaces); pointer from I-UVM-1D | P1 | False passes (audit F-VIP-01) |
| G13 | Regression management, seed-based reproduction, failure bucketing, CI gates | E-DBG-1 (workflow) + I-SV-2B/randomization-methods (random stability) | P1 | Coverage-matrix row "seeds, regression, triage, CI" is explain-only |
| G14 | Verification planning (features → scenarios → checks → coverage, traceability) | F1B (intro) + I-SV-3B/linking-coverage + E-SOC-1 | P1 | Practitioners plan before coding; today it is scattered |
| G15 | Compile and run recipes and tool portability (SV and UVM; open-source options and their limits) | Proposed F2E (SV) and I-UVM-1D (UVM) + the "Run it" standard (§5.2) | P1 | Audit: "no compile/run instructions"; tool portability is never taught |
| G16 | UVM object API basics (`copy/clone/compare/print/convert2string`, `do_*`, field macros) before sequences | I-UVM-1A | P1 | Used from I-UVM-3A; policy depth arrives only in I-UVM-4 |
| G17 | Code coverage types (statement, branch, condition, toggle, FSM), exclusions and merging | F1B (types) + I-SV-3B/closure-workflow | P2 | Sign-off uses both; 0 occurrences of the types |
| G18 | `uvm_heartbeat` (§10.6) | E-DBG-1 | P2 | Hang detection; 0 occurrences |
| G19 | UVM TLM-2 (generic payload, `b_transport`/`nb_transport`, sockets; §12.3) | E-UVM-ML-1 (+ I-UVM-2B Push Further) | P2 | SystemC model integration; 0 occurrences of payload or sockets |
| G20 | RAL coverage (`build_coverage`/`UVM_CVR_*`), user frontdoor (§19.4.2), `uvm_reg_cbs` (§18.11) | A-UVM-4B | P2 | 0 occurrences |
| G21 | `use_response_handler` and response-queue depth (§14.2.7.1) | I-UVM-3B/sequencer-driver-handshake | P2 | Out-of-order responses |
| G22 | `uvm_cmdline_processor` and custom plusargs in UVM (G.1); `+uvm_set_default_sequence` (G.2.9) | Proposed I-UVM-1D; I-UVM-3A Push Further | P2 | 0 occurrences |
| G23 | SVA `first_match` (§16.9.8), `until`/`s_eventually`/strong-weak (§16.12.12–13), `expect` (§16.17), abort properties | I-SV-4B | P2 | `first_match` and `expect` occur in no lesson |
| G24 | Constraint features: `unique` (§18.5.4), functions in constraints (§18.5.11), `randomize(null)`/inline control (§18.11), static constraints | I-SV-2B | P2 | `unique` and `randomize(null)` occur in no lesson |
| G25 | Parameterized interfaces and virtual-interface typedefs for VIP (§25.8) | A-UVM-7 (+ F4B awareness) | P2 | 0 occurrences |
| G26 | AXI4-Lite rules, AXI4-Stream, AXI5 atomics | B-AMBA-1 (Lite, Stream) + B-AXI-4 (atomics awareness) | P2 | Mentioned only in passing |
| G27 | CDC/RDC verification awareness | E-SOC-1 (B-AMBA-F1 has bridge CDC) | P2 | SoC sign-off topic |
| G28 | IEEE 1800-2023 additions (triple-quoted strings §5.9, weak references §8.30, `:initial/:extends/:final` §8.20, array `map()` §7.12.5) | F1C overview + owning modules | P2 | Currency with the 2023 revision |
| G29 | Gate-level simulation and X-propagation in GLS | F2A Push Further + E-PWR-1 | P2 | Practitioner awareness |

### 4.2 Intent cards for proposed modules

### F2E_First_Self_Checking_Testbench (proposed) — F2E: Your First Self-Checking Testbench
- **Tier / position:** T1 · after F2D · before F3A
- **Purpose (one sentence):** Assemble a complete directed, self-checking testbench for a small clocked DUT that prints `PASS=<n> FAIL=<m>` and fails loudly when the DUT is wrong.
- **Objectives (learner will be able to):**
  - Write a top module with timescale, clock and reset generation, and a DUT instance.
  - Write stimulus and checker tasks with an expected-value model and error counting, comparing with `!==` so X cannot slip through.
  - Prove the bench can fail by injecting a DUT bug (stuck bit, off-by-one), and end deterministically: summary line, `$fatal` on timeout, `$finish`.
  - Explain why drives at the active edge must be nonblocking (or on the opposite edge) until clocking blocks (F4C).
- **Must cover:**
  - bench anatomy;
  - a directed plan from F1B's kata;
  - an expected-value function or queue;
  - `$error` vs `$fatal`;
  - a `fork…join_any` timeout;
  - a plusarg-selected test;
  - VCD dump;
  - the M0 signature;
  - a tool-neutral compile and run recipe.
- **Out of scope here (covered in):** interfaces and clocking blocks (F4B/F4C); classes (I-SV-1); randomization (I-SV-2A).
- **Prerequisites:** F1B, F2A, F2B, F2C, F2D.
- **Feeds milestone:** M0 (gate).
- **Hands-on that should exist:** Lab `simple-dut-1` re-scoped to M0, runner-graded with a stuck-bit mutant (LAB-M0).
- **Assessment focus:** misconceptions:
  1. a bench that prints PASS is correct;
  2. `$error` ends the test;
  3. `if (actual != expected)` catches X outputs (it evaluates to x, so the branch is not taken).
- **Sub-lessons:** —

### I-UVM-1D_Reporting_and_Run_Control (proposed) — I-UVM-1D: Reporting, Run Control and Pass/Fail
- **Tier / position:** T2 · after I-UVM-1C · before I-UVM-2A
- **Purpose (one sentence):** Run a UVM test from the command line and decide from its log whether it passed, controlling message severity, verbosity and actions.
- **Objectives (learner will be able to):**
  - Write `` `uvm_info/warning/error/fatal `` with IDs (B.1), and predict which INFO messages print at a verbosity (`uvm_report_enabled`, §6.3.3.2).
  - Read the report summary and decide pass or fail from severity counts (`get_severity_count`, §6.5.1.2.6), and recognize zero-activity runs.
  - Select a test with `+UVM_TESTNAME` (G.2.1; per F.7.3.1 the plusarg wins over the `run_test()` argument), and set verbosity, actions and severities from the command line (G.2.2–G.2.6) and in code (`set_report_*`, §6.3.4.3, §6.3.5.2, §6.3.7).
  - Bound runs with `set_timeout` (F.7.3.3), `+UVM_TIMEOUT` (uvm-core impl.) and `+UVM_MAX_QUIT_COUNT`.
  - Explain why `$display`, `$error` and SVA `$error` do not change UVM counts, and how to route them.
- **Must cover:**
  - report object, handler, server and message (§6.2–§6.5);
  - actions `UVM_DISPLAY/LOG/COUNT/EXIT/STOP`;
  - file logging;
  - command-line processing (G.1);
  - compiling uvm-core into a run, with tool-specific switches labelled;
  - catchers previewed only (E-DBG-1).
- **Out of scope here (covered in):** catchers and triage (E-DBG-1); recording (I-UVM-6); phasing (I-UVM-1C).
- **Prerequisites:** I-UVM-1A, I-UVM-1C.
- **Feeds milestone:** M2–M8 (signature `UVM_ERROR : 0`, `UVM_FATAL : 0`).
- **Hands-on that should exist:** log-reading drills (3 logs → verdict plus first failure); a kata: per-ID verbosity, and demoting a known warning with `+uvm_set_severity`.
- **Assessment focus:** misconceptions:
  1. verbosity filters warnings and errors;
  2. `UVM_ERROR : 0` proves something was checked;
  3. `$error` in a component counts as a UVM error;
  4. `run_test("x")` wins over `+UVM_TESTNAME`.
- **Sub-lessons:** —

### I-UVM-3C_First_Complete_Testbench (proposed) — I-UVM-3C: Your First Complete UVM Testbench
- **Tier / position:** T2 · after I-UVM-3A · before I-UVM-3B (needs PLAT-2; without it the folder sorts after I-UVM-3B, an acceptable fallback)
- **Purpose (one sentence):** Assemble, compile, run and debug a complete single-agent UVM testbench for a small DUT, ending with an analysis-FIFO scoreboard and a clean report.
- **Objectives (learner will be able to):**
  - Write the top module: clock and reset, DUT, interface with clocking blocks, a `uvm_config_db` vif set, and `run_test()`.
  - Write test → env → agent (config object, active/passive) → driver, monitor and sequencer; a sequence; and a scoreboard through `uvm_tlm_analysis_fifo` with `check_phase` accounting.
  - Run two tests from the command line, one of them with a factory override.
  - Diagnose the four classic bring-up failures from logs: null vif, objection never raised or dropped, unconnected analysis port, missing `item_done`.
  - Reuse the agent passively in a second env (M2 seed).
- **Must cover:**
  - package and file organization (package with `include`s; interface outside it);
  - compile order;
  - the expected log;
  - scoreboard summary;
  - an optional coverage subscriber.
- **Out of scope here (covered in):** virtual sequences (I-UVM-3B); reference models and out-of-order matching (A-UVM-6); VIP packaging (A-UVM-7).
- **Prerequisites:** I-UVM-2A, I-UVM-2B, I-UVM-2C, I-UVM-3A, proposed I-UVM-1D.
- **Feeds milestone:** M2 (T2 gate); M3 seed.
- **Hands-on that should exist:** **LAB-T2-ENV**: re-own `uvm-mini-capstone` (fix the LAB-C1/C2 monitor sampling, drop the T3 lab prerequisites, gate the solution). Independent variant: `arbiter-1` built from spec without TODOs.
- **Assessment focus:** misconceptions:
  1. the run ends when the sequence ends, without objections;
  2. a scoreboard that saw zero transactions passed;
  3. setting the vif from the test by hierarchical reference is equivalent to setting it in the top module.
- **Sub-lessons:** —

### A-UVM-9_Reset_and_Error_Injection (proposed) — A-UVM-9: Reset Handling and Error Injection
- **Tier / position:** T3 · after A-UVM-8 · before A-UVM-4A
- **Purpose (one sentence):** Make agents, scoreboards and tests behave correctly when reset is asserted mid-traffic and when errors are injected on purpose, while real failures are still caught.
- **Objectives (learner will be able to):**
  - Write reset-aware drivers (stop, release the current item safely, wait for deassertion) and monitors (discard partial transactions), and flush scoreboard expectations on reset.
  - Choose a reset strategy: reset-aware `run_phase` threads, or run-time phase jumping with its hazards (§9.3). Write a mid-test reset virtual sequence (`stop_sequences`, `kill` §14.2.5.11).
  - Inject errors with callbacks (A-UVM-5), factory overrides and error sequences, and account for expected errors in scoreboards and checkers.
  - Demote expected errors safely with a narrow catcher by ID and count (§6.6), and prove unexpected errors still fail.
  - Plan coverage of reset × state and error × response.
- **Must cover:**
  - asynchronous reset outside clocking blocks;
  - objections across reset;
  - MultiAgentCoordinationVisualizer reset modes (none, flush, restart).
- **Out of scope here (covered in):** callback mechanics (A-UVM-5); power sequencing (E-PWR-1); SoC reset strategy (E-SOC-1).
- **Prerequisites:** A-UVM-5, A-UVM-6, A-UVM-8, proposed I-UVM-1D.
- **Feeds milestone:** M8.
- **Hands-on that should exist:** a lab: reset mid-transfer plus error injection on the T2 env, with hidden mutants (scoreboard not flushed; catcher too broad).
- **Assessment focus:** misconceptions:
  1. pending expectations survive reset;
  2. demoting all errors during injection is fine;
  3. phase jumping is the standard reset technique.
- **Sub-lessons:** —

### B-APB-1_APB_Protocol_and_Verification (proposed) — APB Protocol & Verification
- **Tier / position:** T3 · after B-AMBA-2 · before B-AHB-1 (AMBA `order: 3`; shift AHB onward by one)
- **Purpose (one sentence):** Read, drive and check APB transfers and build the simplest complete protocol agent, the canonical RAL bus.
- **Objectives (learner will be able to):**
  - Predict the setup and access phases (`PSEL`, `PENABLE`, `PREADY` wait states) and the error response (`PSLVERR`) on a waveform.
  - Write an APB master driver, monitor and protocol assertions (stable address and control through the access phase).
  - Explain APB4/APB5 additions (`PPROT`, `PSTRB`, wake-up and user signals, awareness).
  - Connect the agent as a RAL bus with an adapter (link A-UVM-4A).
- **Must cover:** Arm IHI0024. Cite the issue used; mark section numbers unverified until checked.
- **Out of scope here (covered in):** AHB and AXI (B-AHB-*, B-AXI-*); RAL (A-UVM-4A/4B).
- **Prerequisites:** B-AMBA-2, A-UVM-7.
- **Feeds milestone:** M7 (bus for RAL); M5 (configuration agent).
- **Hands-on that should exist:** a kata: an APB agent with random `PREADY` waits, checked by assertions.
- **Assessment focus:** misconceptions:
  1. `PENABLE` is asserted in the first cycle;
  2. a transfer completes when `PENABLE` rises (it completes when `PREADY` is high in the access phase);
  3. APB supports bursts.
- **Sub-lessons:** —

---

## 5. Cross-cutting standards

These are enforceable rules. Every analyst scores R3, R4, R6 and R8 against them, and every author applies them.

### 5.1 Canonical terminology

| Use | Not | Notes |
|---|---|---|
| design under test (DUT) | DUV, "the design" alone | Define once per page |
| testbench (TB after first use) | test bench, test-bench | LRM spelling |
| transaction | packet (unless protocol-specific) | The data concept, including monitor output |
| sequence item (item) | transaction object, seq item | The `uvm_sequence_item` passed sequencer → driver |
| analysis port, analysis export, analysis imp | analysis_port, AP (in prose) | Code font only for class or handle names: `uvm_analysis_port`, `ap` |
| virtual interface (`vif` in code) | virtual if, VIF | |
| clocking block (`cb` in code) | clock block | |
| configuration database (first use), then `uvm_config_db` | config DB, ConfigDB | `ConfigDB` only in E-PYUVM-1 (pyuvm) |
| type override, instance override | factory replace | |
| objection; raise / drop | "vote", "hold" | |
| run-time phases | runtime sub-phases | 1800.2 §9.8.2 wording |
| active agent / passive agent; `UVM_ACTIVE`/`UVM_PASSIVE` | master/slave agent | |
| reference model; predictor (scoreboard); **register** predictor (`uvm_reg_predictor`) | "golden model" without definition | Always qualify the RAL predictor |
| register model; RAL; desired value; mirrored value; frontdoor; backdoor | shadow register, front-door, back door | |
| explicit prediction = `uvm_reg_predictor` on a bus monitor; implicit (auto) prediction = `set_auto_predict(1)` | inverted use | Audit D-17 |
| time slot | tick, time step (as a synonym) | LRM §4.4 |
| region names exactly: Preponed, Active, Inactive, NBA, Observed, Reactive, Re-Inactive, Re-NBA, Postponed | "Re-Active" region, "NBA queue" | |
| delta cycle | delta, micro-step | F3C definition |
| blocking assignment; nonblocking assignment (NBA) | non-blocking | LRM spelling, §10.4.2 |
| 4-state, 2-state | four state, 2 state | |
| handle, object, class | "pointer", "instance" for an object | |
| SystemVerilog Assertions (SVA); concurrent assertion; immediate / deferred immediate assertion; vacuous success | "assertion passes vacuously" without the term | |
| SVA sequence vs UVM sequence | bare "sequence" where ambiguous | |
| covergroup, coverpoint, cross, bin | cover group | |
| constrained-random (adjective) | constraint random | |
| verification plan (vplan after first use) | V-Plan, test plan (for the coverage-linked plan) | |
| end of test (noun); end-of-test (adjective); drain time | EOT without expansion | |
| AMBA: master/slave as in IHI0022E and IHI0033B.b | — | Say once per track that later Arm issues use manager/subordinate |
| transaction, transfer or beat, burst (AXI) | "packet" | |
| 4KB, 1KB | 4 KB, 4k | As in the cited specifications |
| IEEE 1800-2023; IEEE 1800.2-2020; uvm-core 2020.3.1 | "the LRM" without a number on first use; "UVM 1.2" except for legacy | |

### 5.2 Snippet code style

Consistent with the [README](README.md#the-target-lesson):

1. **Tagging.** Each fenced `systemverilog` block, and each `InteractiveCode` body, starts with `// compile` (a complete unit CI can compile, per TRUST-1) or `// snippet` (a fragment). Today 0 blocks use `// snippet` and 2 use `// compile`.
2. **Fences.** Use `systemverilog` (not `sv`/`verilog`), `c` for DPI C, `tcl` for UPF, `pss`, `python`, `bash` for shell, `text` for logs.
3. **Legality.**
   - Code must be IEEE 1800-2023 legal and use only APIs in uvm-core 2020.3.1.
   - Implementation-only features are labelled "uvm-core impl.".
   - No invented methods, macros or plusargs.
   - Vendor switches appear only labelled with the tool name.
4. **Basics.**
   - 2-space indent.
   - `logic` for 4-state; `always_ff` with `<=`; `always_comb` with `=`; `always_latch` only when intended.
   - Lines ≤ 90 columns (phones).
5. **Complete units.**
   - Units with delays declare `timeunit`/`timeprecision` or `` `timescale ``.
   - The top module is `tb_top`.
   - UVM files show `import uvm_pkg::*;` and `` `include "uvm_macros.svh" ``.
   - The vif is set in `tb_top` before `run_test()`.
6. **Driving the DUT.** From F4C onward, drive DUT inputs only through a clocking block. Before F4C, drive with `<=` (or on the opposite edge) and say why in a comment. Never use a blocking assignment to a DUT input at the active edge.
7. **Subroutines.** Module and interface subroutines are `automatic`. No initializers on static procedural variables.
8. **Randomization.** Check the result: `` if (!req.randomize() with {…}) `uvm_fatal("RAND", "…") `` (or `$fatal` outside UVM). Never `assert(x.randomize())`.
9. **UVM practice.**
   - Create through `::type_id::create`; construct TLM ports, exports and FIFOs with `new`.
   - Register with the `uvm_*_utils` macros.
   - Raise objections in tests or top sequences only.
   - No `#delay` for synchronization or end of test.
10. **Reporting.**
    - `` `uvm_* `` macros in UVM code; `$display` and severity tasks only in non-UVM code.
    - Interface assertions in VIP report through UVM, or say why not.
11. **Objects.** Monitors publish a new object per transaction. Scoreboards copy before storing. Compare by value.
12. **Names.** `_if`, `vif`, `_cfg`, `_item`, `_seq`, `_sqr`, `_drv`, `_mon`, `_agent`, `_env`, `_test`, `_sb`, `_pkg`, `clk`, `rst_n`. Parameters in UPPER_CASE.
13. **Comments** explain *why*, not *what*.
14. **Expected output.** Every Make It Work example shows its log in a `text` block titled "Expected output". Say whether it came from a real run (name the simulator and version) or is illustrative. Milestone signatures:
    - non-UVM bench: `PASS=<n> FAIL=0`;
    - UVM: report summary with `UVM_ERROR :    0` and `UVM_FATAL :    0`;
    - scoreboard: `SCB_SUMMARY matches=N mismatches=0 pending=0`.
15. **"Run it" box.** Make It Work names the compile and run steps tool-neutrally, plus the open-source option only where it is verified to work (the CI uses Verilator; UVM support is limited).
16. **MDX safety** (README): backtick bare `<` and `<=` in prose; write literal `[x](y)` inside JSX text as `{"…"}`; use only registered MDX components (`tests/qa/curriculumCoverageAudit`).

### 5.3 Page structure

- **H2s:** exactly these six, in order, on every file including sub-lessons: `## Quick Take`, `## Build Your Mental Model`, `## Make It Work`, `## Push Further`, `## Practice & Reinforce`, `## References & Next Topics`. Today 23 of 105 files comply.
- **No `#` H1** (16 files today). Use the `## Quick Take` heading, not the `<QuickTake>` component alone.
- **Legacy H2s become H3s:**

  | Legacy H2 | Goes to |
  |---|---|
  | "Deeper Understanding", "Key Concepts", "Advanced Mechanics", numbered protocol sections | H3 under Build Your Mental Model |
  | "Common Pitfalls", "Interview Pitfalls", "Failure Modes" | H3 under Build Your Mental Model (or Make It Work for debug how-tos) |
  | "Interview Questions" | H3 "Interview angles" under Push Further, attempt-first: `InterviewQuestionPlayground` or quiz, not `<details>` that reveals immediately |
  | "Knowledge Check", "Quiz", "Quiz Yourself", "Check Your Understanding", "Hands-On Lab", "Capstone Checkpoint", "Practice Prompts" | H3 under Practice & Reinforce |
  | "Summary" | a recap at the end of Build Your Mental Model |
  | InfoPage "Elevator Pitch / Level 1 / Level 2 / Level 3" | Quick Take / Mental Model / Make It Work / Push Further |

- **Sub-lessons:**
  - Use YAML frontmatter (`title` without a " | Series" suffix, `description`, `flashcards`), not `export const metadata`.
  - No `<InfoPage>` wrapper (it renders a second H1).
  - Headings start at column 0.
  - The generator already reads frontmatter first.
- **Frontmatter:**
  - `title`; `description` (one sentence on what the learner can do afterwards, derived from the card's Purpose); `flashcards` (never `flashcardId`).
  - `order` on every module index and sub-lesson once PLAT-2 lands.
  - `sources:` on every page that makes normative protocol or language claims; required on the 7 QA-pinned pages.
- **Make It Work:** a complete example (§5.2), "Expected output", a numbered how-to, and a bold **Checklist before moving on:** with `- [ ]` items.
- **Visuals:** each model-backed visual is introduced, used for a prediction, and debriefed where the concept is taught (R5). Do not rewrite visual components.

### 5.4 Objectives block

Inside `## Quick Take`, after the analogy:

```mdx
- **What it is:** …
- **Why it matters:** …
- **The Analogy:** … *Where it breaks:* …

**You will be able to:**
1. Predict …
2. Write …
3. Debug …
```

- **Count:** 3–5 numbered items, taken from the module card (same intent, same tier level). Sub-lessons list the subset they deliver.
- **Verbs:** observable actions only.
  - Core: explain, predict, calculate, trace, write, configure, choose, compare, debug, diagnose, decide, design, implement, refactor, plan, evaluate, justify.
  - Recall-level verbs (name, list, state, recall, identify, describe) are allowed for at most one objective per page. They are mostly for T1 orientation and the AMBA intuition lesson.
- **Banned verbs:** understand, learn, know, master, explore, appreciate, be familiar with.
- **Coverage:** every objective is exercised on the page, in Make It Work, a kata or a quiz item. Add `objective: <n>` to each quiz question. The `Quiz` renderer ignores unknown fields, and the field makes R1/R6 traceability lintable.

### 5.5 Quiz format (decision)

**Canonical format** (the existing majority: 56 blocks, and the `MdxQuestion` shape in `Quiz.tsx`):

```mdx
<Quiz questions={[
  {
    question: "…",
    answers: [
      { text: "…", correct: false, feedback: "…" },
      { text: "…", correct: true,  feedback: "…" },
      { text: "…", correct: false, feedback: "…" },
      { text: "…", correct: false, feedback: "…" }
    ],
    explanation: "Why the key is right and why each distractor is wrong.",
    objective: 2
  }
]} />
```

- **Why this format.** The correct flag sits on the option, so reordering options cannot break the key. That rules out the inverted-index class of bug (D-03) and the string-mismatch class.
- **Why not `<QuizQuestion>` children.** The children path (`mdx-component-registry.tsx`) silently drops any question whose `correctAnswer` is not a string.
- **Optional fields.** `feedback` and `objective` are ignored by today's renderer. `feedback` is forward-compatible with ASSESS-3 per-option feedback. Until then, `explanation` must address every distractor.
- **Key style.** Unquoted JS keys are preferred (53 files vs 12); both parse.
- **Rules:**
  - at least 4 questions per page;
  - exactly one `correct: true` per question;
  - at least 1 predict item (output, waveform or count) and 1 debug item on every technical page;
  - distractors come from the card's misconceptions;
  - no "all of the above";
  - the answer must not be guessable from the stem.
- **Migration:** convert the 13 AMBA files that use `<Quiz><QuizQuestion/></Quiz>` and the 10 `options` + numeric-index blocks (A-UVM-6/7/8, B-AMBA-1, E-AI-1, E-EMU-1, E-PSS-1, E-PYUVM-1, E-RISCV-1, E-UVM-ML-1).
  - **When:** when each page is touched in its wave. No standalone sweep, because the rendered output is identical.
  - **Preserve:** B-AXI-4 Q1's question text, answer text and position; the E-PSS-1 release-tested question.
  - **Remove:** inline "(correct)" answer markers.

### 5.6 Flashcard format (decision)

**Canonical format:** `[{ "id": "<module-prefix>-<n>", "question": "…", "answer": "…" }]` (47 decks already).

- **Why.** Both `scripts/validate-flashcards.cjs` and `FlashcardWidget.tsx` accept `question ?? front`. But without `id` both fall back to `<deck>-<index>`, which changes whenever a card is inserted or reordered. That breaks any per-card progress or spaced repetition, and the validator's global-uniqueness check.
- **Migration:**
  - Convert the 20 `{front, back}` decks (A-UVM-1…8, E-*) when their group touches them. This is mechanical.
  - E-PWR-1 has `{id, front, back}`; rename the keys.
  - Afterwards the lead tightens the validator to require `id/question/answer`.
- **ID scheme:**
  - Lowercase module id plus a running number (`f3c-11`, `i-uvm-2c-4`, `b-axi-2-12`).
  - Keep existing ids; never reuse a retired id.
- **One deck per module, named by the module id.**
  - The 17 alias mappings share decks today (for example I-SV-4A/4B/4C share 5 cards); split them.
  - A sub-lesson either uses the module deck or a sub-deck `<module>_<slug>` when its objectives differ.
  - Registry edits in `src/lib/flashcard-decks.ts` are the lead's; authors file "Requests for the lead".
- **Content:**
  - 8–15 cards per module;
  - each card maps to an objective, a must-cover item or a misconception;
  - answers of at most 3 sentences, with code in backticks;
  - no card contradicts the page.
- **Orphan decks.** The lead decides delete or reuse for `A-UVM-1_Advanced_Sequencing`, `A-UVM-2_The_UVM_Factory`, `A-UVM-3_Advanced_UVM_Techniques`, `F2_HDL_Primer`, `F3A_Procedural_Blocks_and_Flow_Control` and `F4_RTL_and_Testbench_Constructs`. Reuse `F2C_Operators` for G6.

### 5.7 Citation style

- **Format:**
  - first use on a page: "IEEE 1800-2023 §16.5.1", then "§16.5.1";
  - UVM: "IEEE 1800.2-2020 §14.2.6" or "Annex G.2.1";
  - implementation-only behaviour: "uvm-core 2020.3.1 (`uvm_root.svh`)";
  - Arm: "IHI0022E §A3.3.1", "IHI0033B.b §3.5".
- **Unverified numbers.** Use only numbers in Appendix A or newly verified ones. Otherwise write "section unverified".
- **Other standards:**
  - APB (IHI0024), CHI (IHI0050) and IEEE 1801: name the document and issue, and verify sections before citing them.
  - PSS: the Accellera version.
- **`sources:` frontmatter** names the issue actually used. AXI pages that cite IHI0022H must either verify against H or switch to IHI0022E.

### 5.8 Practice and assessment conventions

- **Practice & Reinforce** on every page holds:
  - the quiz (§5.5);
  - flashcards (§5.6);
  - at least one hands-on item: a kata, a debug challenge, or a lab link with an existing lab id;
  - where the module has one, the model-backed visual's prediction or debug mode.
- **Interview angles are attempt-first.** Never use a `<details>` that reveals the answer immediately.
- **Labs.** Link only existing lab ids with `<LabLink labId="…" />`. For coming-soon labs, say "planned" without linking a 404 (D-09). Ownership follows Appendix B.

### 5.9 Navigation and links

- **Link format.** In-content links are absolute and canonical: `/curriculum/<TierFolder>/<ModuleFolder>/<topic>` with exact folder case and `index` for module pages. These are the paths `findPrevNextTopics` emits. No relative links, no lowercase pretty slugs.
- **References & Next Topics** has, in this order:
  1. primary sources;
  2. `**Prerequisites:**` (module links);
  3. `**Next:**`, the next lesson in the spine order (§3.4), including the next sub-lesson inside a module.
- A sub-lesson's Next for its module's last page is the next module's index.

---

## Appendix A. Verified citation index

Checked against the IEEE 1800-2023 text, the IEEE 1800.2-2020 PDF (`uvm_lrm.pdf`), uvm-core 2020.3.1 sources (GitHub), IHI0022E and IHI0033B.b.

**IEEE 1800-2023:**

| Area | Verified clauses |
|---|---|
| Scheduling | 3.14 time units/precision · 4.4 stratified scheduler · 4.4.1 region sets · 4.4.2.1–4.4.2.9 Preponed…Postponed · 4.4.3 PLI regions · 4.5 reference algorithm · 4.6 determinism · 4.7 nondeterminism · 4.8 race conditions · 4.9 scheduling implication of assignments |
| Literals | 5.7 numbers · 5.7.1 integer literal constants · 5.8 time literals · 5.9 string literals (incl. triple-quoted) |
| Data types | 6.5 nets and variables · 6.6 net types · 6.7 net declarations · 6.8 variable declarations · 6.11 integer types · 6.16 string · 6.17 event · 6.18 user-defined types · 6.19 enumerations · 6.20 constants (6.20.2 value, 6.20.3 type, 6.20.4 local parameters, 6.20.6 const) · 6.21 scope and lifetime · 6.22 type compatibility · 6.23 type operator · 6.24 casting (6.24.1 cast operator, 6.24.2 `$cast`, 6.24.3 bit-stream casting) |
| Aggregates | 7.2 structures · 7.3 unions · 7.4 packed/unpacked (7.4.1, 7.4.2, 7.4.6) · 7.5 dynamic arrays · 7.6 array assignments · 7.7 arrays as arguments · 7.8 associative arrays (7.8.6 invalid index → warning + default) · 7.9 associative array methods · 7.10 queues (7.10.1–7.10.5, bounded: excess discarded with warning) · 7.11 array querying · 7.12 methods (7.12.1 locator, 7.12.2 ordering, 7.12.3 reduction returns element type, 7.12.4 iterator index, 7.12.5 `map`) |
| Classes | 8.7 constructors · 8.9 static properties · 8.10 static methods · 8.11 this · 8.12 assignment/copying · 8.13 inheritance · 8.14 overridden members · 8.15 super · 8.16 casting · 8.17 chaining constructors · 8.18 data hiding · 8.19 constant properties · 8.20 virtual methods (incl. `:initial/:extends/:final`) · 8.21 abstract/pure virtual · 8.22 polymorphism · 8.23 class scope `::` · 8.24 out-of-block · 8.25 parameterized classes · 8.26 interface classes · 8.27 typedef class · 8.28 classes vs structures · 8.29 memory management · 8.30 weak references |
| Processes | 9.2 structured procedures (9.2.1 initial, 9.2.2 always, 9.2.3 final) · 9.3 blocks (9.3.2 fork/join) · 9.4 timing controls (9.4.2 event control, 9.4.3 wait) · 9.6 process control (9.6.1 wait fork, 9.6.2 disable, 9.6.3 disable fork) · 9.7 fine-grain process control |
| Assignments | 10.3 continuous · 10.4 procedural (10.4.1 blocking, 10.4.2 nonblocking) · 10.6 procedural continuous (10.6.2 force/release) |
| Operators | 11.4.5 equality · 11.4.6 wildcard equality · 11.4.9 reduction · 11.4.10 shift · 11.4.11 conditional · 11.4.12 concatenation (11.4.12.1 replication) · 11.4.13 set membership · 11.4.14 streaming · 11.5.1 bit/part select · 11.6 expression bit lengths (11.6.1 rules) · 11.7 signed expressions · 11.8 evaluation rules · 11.12 let |
| Statements | 12.4 if (12.4.2 unique/unique0/priority-if) · 12.5 case (12.5.3 unique/priority-case, 12.5.4 case inside) · 12.7 loops · 12.8 jumps |
| Subroutines | 13.3 tasks (13.3.1 static/automatic) · 13.4 functions (13.4.1 return/void) · 13.5 argument passing (13.5.2 ref, 13.5.3 defaults, 13.5.4 by name) |
| Clocking | 14.3 declaration · 14.4 skews · 14.5 hierarchical expressions · 14.6–14.8 multiple blocks · 14.9 interfaces · 14.10 clocking-block events · 14.11 cycle delay · 14.12 default clocking · 14.13 input sampling · 14.14 global clocking · 14.16 synchronous drives |
| IPC | 15.3 semaphores · 15.4 mailboxes (15.4.9 parameterized) · 15.5 named events (15.5.1 trigger incl. `->>` NBA-region update, 15.5.2 waiting, 15.5.3 triggered persists through the time step, 15.5.4 wait_order) |
| Assertions | 16.3 immediate · 16.4 deferred (16.4.1 reporting) · 16.5 concurrent overview (disable conditions and clocking events are not sampled) · 16.5.1 sampling · 16.6 booleans · 16.7 sequences · 16.8 declaring sequences · 16.9 sequence operations (16.9.2 repetition, 16.9.3 sampled-value functions, 16.9.4 global-clocking past/future, 16.9.5 and, 16.9.6 intersect, 16.9.7 or, 16.9.8 first_match, 16.9.9 throughout, 16.9.10 within, 16.9.11 composing) · 16.10 local variables · 16.11 subroutines on match · 16.12 properties (16.12.2 sequence property, 16.12.6 if-else, 16.12.7 implication, 16.12.8 implies/iff, 16.12.11 always, 16.12.12 until, 16.12.13 eventually, 16.12.14 abort) · 16.13 multiclock · 16.14 concurrent assertions (16.14.1 assert, 16.14.2 assume, 16.14.3 cover, 16.14.4 restrict, 16.14.5 outside procedural code, 16.14.6 in procedural code) · 16.15 disable iff resolution · 16.16 clock resolution · 16.17 expect · 16.18 clocking blocks and assertions |
| Checkers | 17.1 overview · 17.2 declaration · 17.3 instantiation · 17.7 checker variables |
| Randomization | 18.3 concepts · 18.4 random variables (18.4.1 rand, 18.4.2 randc) · 18.5 constraint blocks (18.5.1 external, 18.5.2 inheritance, 18.5.3 dist, 18.5.4 unique, 18.5.5 implication, 18.5.6 if-else, 18.5.7 iterative, 18.5.8 global, 18.5.9 variable ordering, 18.5.10 static, 18.5.11 functions, 18.5.12 guards, 18.5.13 soft) · 18.6 methods (18.6.1 randomize, 18.6.2 pre/post, 18.6.3 behavior) · 18.7 inline · 18.8 rand_mode · 18.9 constraint_mode · 18.10 dynamic modification · 18.11 inline random-variable control · 18.12 scope randomize · 18.13 random number functions · 18.14 random stability · 18.15 manual seeding · 18.16 randcase · 18.17 randsequence |
| Coverage | 19.3 covergroup · 19.4 in classes · 19.5 coverpoints (19.5.1 value bins, 19.5.2 transitions, 19.5.3 automatic, 19.5.4 wildcard, 19.5.5 ignore, 19.5.6 illegal, 19.5.7 value resolution) · 19.6 cross (19.6.1 cross bins) · 19.7 options (19.7.1 type options) · 19.8 methods (19.8.1 overriding sample) · 19.9 coverage system tasks · 19.10 option/type_option · 19.11 computation |
| System tasks | 20.2 simulation control · 20.3 time functions · 20.4 timescale tasks (20.4.1 retrieval, 20.4.2 `$printtimescale`) · 20.5 conversion · 20.6 data query (20.6.1 `$typename`, 20.6.2 `$bits`) · 20.8 math · 20.9 bit-vector functions · 20.10 severity tasks · 20.11 assertion control (Table 20-6: applies to concurrent, simple immediate, deferred, expect, unique, priority) · 20.12 sampled-value system functions · 20.13 coverage functions · 20.14 probabilistic distribution · 20.15 stochastic analysis |
| I/O tasks | 21.2 display (21.2.1 display/write) · 21.3 file I/O (21.3.1 open/close) · 21.4 `$readmem` · 21.6 command-line input · 21.7 VCD |
| Directives | 22.2 overview · 22.3 `` `resetall `` · 22.4 `` `include `` · 22.5 `` `define/`undef/`undefineall `` (22.5.1 `` `define ``) · 22.6 `` `ifdef `` family · 22.7 `` `timescale `` · 22.8 `` `default_nettype `` · 22.14 `` `begin_keywords `` |
| Modules | 23.2 module definitions (23.2.2 ports, 23.2.2.3 port kind/type/direction rules) · 23.3 instances (23.3.2 syntax, 23.3.2.2 by name, 23.3.2.3 `.name`, 23.3.2.4 `.*`) · 23.6 hierarchical names · 23.9 scope rules · 23.10 parameter overrides · 23.11 bind |
| Programs, interfaces, packages, generate | 24.3 program construct · 24.4 eliminating TB races · 25.3 syntax · 25.4 ports · 25.5 modports (25.5.4 expressions, 25.5.5 clocking blocks) · 25.7 tasks/functions · 25.8 parameterized · 25.9 virtual interfaces (25.9.1 with clocking blocks) · 25.10 access · 26.2 package declarations · 26.3 referencing · 26.4 in module headers · 26.5 search order · 26.6 export · 26.7 std package · 27.3 generate syntax · 27.4 loop generate · 27.5 conditional generate |
| DPI | 35.4 name space · 35.5 imported tasks/functions (35.5.2 pure, 35.5.3 context, 35.5.4 import declarations) · 35.6 calling imports · 35.7 exported functions · Annex H DPI C layer · Annex I svdpi.h |

**IEEE 1800.2-2020:**

| Area | Verified clauses |
|---|---|
| Base | 5.3 uvm_object (5.3.5 creation, 5.3.6 printing, 5.3.6.4 convert2string, 5.3.7 recording, 5.3.8 copying, 5.3.9 comparing, 5.3.10 packing, 5.3.11 unpacking, 5.3.13 field operations) · 5.4 uvm_transaction · 5.7 uvm_field_op |
| Reporting | 6.2 uvm_report_message · 6.3 uvm_report_object (6.3.3.2 uvm_report_enabled, 6.3.4.3 set_report_verbosity_level, 6.3.5.2 set_report_*_action, 6.3.7 severity overrides) · 6.4 handler · 6.5 server (6.5.1.2.3 set_max_quit_count, 6.5.1.2.6 get_severity_count) · 6.6 uvm_report_catcher (6.6.5 CAUGHT/THROW) |
| Recording, factory | 7.1 uvm_tr_database · 7.2 uvm_tr_stream · 7.3 links · 8.2 wrappers (8.2.2 type_id, 8.2.3 component registry) · 8.3 factory (8.3.1 uvm_factory, 8.3.1.4.1 set_inst_override_by_type, 8.3.1.4.2 set_type_override_by_type, 8.3.2 object wrapper) |
| Phasing | 9.3 phasing definition classes · 9.4 uvm_domain · 9.5–9.7 bottom-up/task/top-down phase classes · 9.8 predefined phases (9.8.1 common: build top-down, connect, end_of_elaboration, start_of_simulation, extract, check, report bottom-up, run task, final top-down; 9.8.2 run-time phases) |
| Synchronization | 10.1 events (10.1.1 uvm_event_base, 10.1.2 uvm_event) · 10.3 uvm_barrier · 10.4 pools (10.4.1 uvm_event_pool) · 10.5 objections (10.5.1 uvm_objection, 10.5.1.3.7 set_drain_time) · 10.6 uvm_heartbeat · 10.7 callbacks (10.7.1 uvm_callback, 10.7.2 uvm_callbacks) |
| Containers, TLM | 11.2 uvm_pool · 11.3 uvm_queue · 12.2 TLM 1 (12.2.4 uvm_tlm_if_base, 12.2.8.2 uvm_tlm_fifo, 12.2.8.3 uvm_tlm_analysis_fifo, 12.2.10 analysis ports: 12.2.10.1 port, 12.2.10.2 imp) · 12.3 TLM 2 (12.3.4.2 generic payload, 12.3.5 sockets) |
| Components | 13.1 uvm_component (13.1.4 phasing interface, 13.1.4.1.1 build_phase calls `apply_config_settings` when automatic configuration is on, 13.1.4.3.2 phase_ready_to_end, 13.1.5 configuration interface: 13.1.5.1 apply_config_settings, 13.1.5.2 use_automatic_config) · 13.2 test · 13.3 env · 13.4 agent (13.4.2.2 get_is_active) · 13.5 monitor · 13.6 scoreboard · 13.7 driver · 13.8 push driver · 13.9 subscriber |
| Sequences | 14.1 uvm_sequence_item (14.1.2.4 set_id_info) · 14.2 uvm_sequence_base (14.2.3 execution, 14.2.4 run-time phasing: 14.2.4.1 get_starting_phase, 14.2.4.4 set_automatic_phase_objection; 14.2.5 control: 14.2.5.3 is_relevant, 14.2.5.5 lock, 14.2.5.6 grab, 14.2.5.11 kill, 14.2.5.12 do_kill; 14.2.6 item execution; 14.2.7.1 use_response_handler) · 14.3 uvm_sequence · 14.4 uvm_sequence_library |
| Sequencers, policies | 15.2.1 uvm_sqr_if_base · 15.2.2.1 seq_item_pull_port · 15.3 uvm_sequencer_base (15.3.2.19 set_arbitration) · 15.4 common API · 15.5 uvm_sequencer · 16.1 uvm_policy · 16.2 printer · 16.3 comparer · 16.4 recorder · 16.5 packer · 16.6 copier |
| Register layer | 18.1 uvm_reg_block (18.1.2.6 lock_model, 18.1.5.5 update, 18.1.5.6 mirror, 18.1.6.5 add_hdl_path) · 18.2 uvm_reg_map (18.2.5.2 set_auto_predict) · 18.3 reg file · 18.4 uvm_reg (18.4.4.3 get_mirrored_value, 18.4.4.11 poke and 18.4.4.12 peek: LRM says "affected by the auto-prediction configuration", while uvm-core 2020.3.1 calls `do_predict` unconditionally; 18.4.4.15 predict) · 18.5 field · 18.6 uvm_mem · 18.11 uvm_reg_cbs · 18.12 uvm_mem_mam · 19.1 operation descriptors · 19.2.1 uvm_reg_adapter (19.2.1.2.2 supports_byte_enable, 19.2.1.2.3 provides_responses) · 19.3 uvm_reg_predictor · 19.4.1 uvm_reg_sequence · 19.4.2 uvm_reg_frontdoor · 19.5 uvm_reg_backdoor |
| Annexes | B.1 report macros · B.2 utility/field macros · B.3 sequence macros · B.4 callback macros · B.5 TLM imp declaration macros · C.3 resource db · C.4 config db (C.4.2 uvm_config_db) · D.1 uvm_callback_iter · E.1 uvm_reg_hw_reset_seq · E.2 bit-bash · E.3 register access · E.5 memory access · E.6 memory walk · F.2.1.7 uvm_active_passive_enum · F.4 core service · F.7 uvm_root (F.7.3.1 run_test: `+UVM_TESTNAME` wins over the argument, F.7.3.3 set_timeout, F.7.4.2 print_topology) · G.1 command-line processing · G.2.1 +UVM_TESTNAME · G.2.2 +UVM_VERBOSITY · G.2.3 +uvm_set_verbosity · G.2.4 +uvm_set_action · G.2.5 +uvm_set_severity · G.2.6 +UVM_MAX_QUIT_COUNT · G.2.7 +uvm_set_inst_override / +uvm_set_type_override · G.2.8 +uvm_set_config_int/_string · G.2.9 +uvm_set_default_sequence |
| RAL test exclusions | bit resources `NO_REG_TESTS`, `NO_REG_HW_RESET_TEST` in the `REG::` namespace |

**Not in 1800.2-2020 (uvm-core 2020.3.1 implementation, verified in the source):**
- `+UVM_TIMEOUT` (`uvm_root`);
- `+UVM_OBJECTION_TRACE` (`uvm_objection`);
- `+UVM_PHASE_TRACE` (`uvm_phase`);
- `+UVM_CONFIG_DB_TRACE` (`uvm_config_db`);
- `+UVM_DUMP_CMDLINE_ARGS`;
- `uvm_component::check_config_usage`, `print_config`, `recording_detail`;
- `uvm_comparer` defaults `show_max = 1`, `sev = UVM_INFO`, `verbosity = UVM_LOW` (counts all miscompares; limits printing).

**Arm:**
- **IHI0022E:**
  - A3.1 clock and reset;
  - A3.2.1 handshake process; A3.2.2 channel signaling requirements;
  - A3.3 channel relationships; A3.3.1 dependencies between channel handshake signals;
  - A3.4.1 address structure (4KB); A3.4.3 data read/write structure; A3.4.4 responses;
  - A4.3 AXI4 memory-attribute changes; A4.7 access permissions (AxPROT);
  - A5.1–A5.3 IDs and ordering (A5.3.1 read ordering); A6.1 ordering model;
  - A7.2 exclusive accesses; A7.3 locked accesses;
  - A8.1 QoS;
  - B1.1 AXI4-Lite.
- **IHI0033B.b:**
  - 2.1 global signals;
  - 3.1 basic transfers; 3.2 transfer types; 3.3 locked transfers; 3.4 transfer size; 3.5 burst operation ("must not … cross a 1KB address boundary"); 3.6 waited transfers;
  - 4.1 interconnect;
  - 5.1 slave transfer responses;
  - 6.1 data buses;
  - 7.1 clock and reset requirements.

---

## Appendix B. Lab ownership map

| Lab id | Status | Manifest owner | Recommended owner | Notes |
|---|---|---|---|---|
| `basics-1` | available | F2D | F2D/tasks-functions | Steps and grader do not match the README (token match); LAB-M0 |
| `simple-dut-1` | coming soon | "F4" (not a module) | proposed F2E (M0) | README is a non-UVM first TB; manifest says UVM; it is a prerequisite of 6 UVM labs (re-point them to LAB-T2-ENV) |
| `common-1` | coming soon | F2C | F2A | structs, enums, arrays |
| `constructs-1` | coming soon | F2B | F4C (LAB-M1) | Contains `lab1_race_condition` |
| `fifo-1` | coming soon | I-SV-1 | I-SV-9 (bridge capstone P8) | Layered class-based SV TB |
| `assertions-1` | coming soon | I-SV-4A | I-SV-4B | Pipeline data integrity needs local variables |
| `randomization-advanced-1` | available | I-SV-2B | I-SV-2B | Premise to fix |
| `coverage-advanced-1` | available | I-SV-3B | I-SV-3B | Cannot close as written |
| `ipc-deadlock` | available | I-SV-5 | I-SV-5 | `modulePrerequisites: ['systemverilog-basics']` is not a module id |
| `scoreboard-decoupling` | available | I-UVM-2B | I-UVM-2B | Starter already solved; false premise |
| `config-debug` | available | I-UVM-2C | I-UVM-2C | Bug labelled in the starter |
| `arbiter-1` | coming soon | I-UVM-2A | proposed I-UVM-3C (independent variant) | |
| `uvm-mini-capstone` | available | A-UVM-6 | proposed I-UVM-3C (LAB-T2-ENV) | Fix the monitor sampling (LAB-C1/C2); drop the T3 prerequisites |
| `dma-1` | coming soon | I-UVM-3B | E-SOC-1 (LAB-M8) | M8 DMA capstone |
| `scoreboard-reference-model` | available | A-UVM-6 | A-UVM-6 (M3) | Accounting fix (LAB-S1) |
| `callbacks-driver-behavior` | available | A-UVM-5 | A-UVM-5 | Null-handle registration in the solution |
| `ral-mirror-bug` | available | A-UVM-4B | A-UVM-4B | Fix printed in comments |
| `ahb-checker-lab` | available | B-AHB-3 | B-AHB-3 | BROKEN_MODE criterion unachievable |
| `axi-deadlock-hunt-lab` | available | B-AXI-5 | B-AXI-5 | `modulePrerequisites` lists a lab id |
| `axi-scoreboard-lab` | available | B-AXI-6 | B-AXI-6 (M6) | Starter does not compile |
| `ahb-axi-bridge-debug` | available | B-AMBA-F1 | B-AMBA-F1 | False 4KB premise; `modulePrerequisites` lists lab ids |
| `formal-harness` | available | E-INT-1 | E-INT-1 | |
| `methodology-custom-phase` | available | E-CUST-1 | E-CUST-1 | Needs `exec_task` |
| `debug-waveform-trigger` | available | E-DBG-1 | E-DBG-1 | |
| `uvm-performance-1` | coming soon | E-PERF-1 | E-PERF-1 | |
| `pss-portable-intent` | available | E-PSS-1 | E-PSS-1 | Release-tested flow |
| `power-aware-retention` | available | E-PWR-1 | E-PWR-1 | Release-tested LabLink |
| `soc-vip-reuse` | available | E-SOC-1 | E-SOC-1 | Prerequisite `simple-dut-1` |
| `soc-strategy-capstone` | available | E-SOC-1 | E-SOC-1 | Document capstone; M8 code capstone is `dma-1` |

Milestone labs that do not exist yet: LAB-M1 (`constructs-1`), LAB-T2-ENV, LAB-M2, LAB-M3 mutants, LAB-M5, LAB-M6 extension, LAB-M7 (Build-a-RAL), LAB-M8. See [`improvement-plan.md`](../audit/2026-10-03-learning-outcomes/improvement-plan.md).
