> **Provenance.** Area report produced during the 2026-10-03 learning-outcome audit by a read-only review agent, then reviewed by the lead auditor. Key claims were spot-checked against source, the running site, IEEE 1800-2023 (repo `system_verilog_lrm.pdf`), and Arm IHI0033 text. Line numbers refer to commit `488f7f43`. Items fixed in the same session are listed in [../audit-report.md](../audit-report.md) §9; everything else is open.

# T2 UVM audit (I-UVM-1A … I-UVM-6): education and technical accuracy

Repo: /Users/Rakesh/Projects/sv-uvm-guide @ 488f7f43. This was a read-only audit. Scope: `content/curriculum/T2_Intermediate/I-UVM-*` (19 MDX files, 2,319 lines), the interactives and flashcards they reference, and the labs they link to (uvm-mini-capstone, scoreboard-decoupling, config-debug). I read the labs only far enough to judge the transition from lessons to labs.

Paths are relative to `content/curriculum/T2_Intermediate/` unless they start with `src/` or `content/`.

Scoring used in the coverage tables: **0** = absent or wrong. **1** = stated, or tested by a single recall MCQ or snippet. **2** = taught with a worked example plus practice that needs reasoning (prediction, writing code, a debug scenario).
E = Explain, P = Predict, A = Apply in code, D = Debug misuse, T = Transfer.

Clause numbers: the lessons cite IEEE 1800.2 clauses that contradict each other (see G-03). From memory, with **Medium confidence and no PDF to check against**, the 1800.2-2017/2020 layout is: 5 base classes, 6 reporting, 7 recording, 8 factory, 9 phasing, 10 synchronization, 11 containers, 12 TLM, 13 predefined components, 14 sequences, 15 sequencers, 16 policy classes, and Annex C configuration/resources. Every clause number in this report should be read as "clause unverified".

---

## 0. Executive summary

* **The T2 UVM path does not produce a learner who can build and run a first UVM environment on their own.** I-SV-9 promises one: "By the end of T2, you'll have a fully functioning, reusable UVM testbench" (`I-SV-9_Why_UVM/index.mdx:218`). No T2 lesson shows an agent class, a monitor that samples an interface, a sequencer declaration plus agent wiring, or compile/run instructions. Most snippets would not compile as written. The only assembled environment is the `uvm-mini-capstone` starter. It is owned by **A-UVM-6 (T3)**, its lab prerequisites are T3 scoreboard labs, it is self-attested, and it ships with its solution.
* **Several core-semantics errors are presented confidently and reinforced by quizzes or interactives:**
  * Phase direction (connect/end_of_elaboration described as top-down).
  * The `super.build_phase` mechanism.
  * Factory instance-override precedence. The lesson text, a quiz and two visualizers give three different, wrong rules.
  * Analysis `write()` described as able to stall the monitor.
  * "analysis_port cannot connect to analysis_export".
  * Queue/dynamic-array "shallow copy" in clones.
  * Field macros plus `do_compare`: the quiz marks the correct answer wrong.
  * Drain time presented as a hang safety net.
* **3B (Advanced Sequencing) contains invented UVM APIs:**
  * `uvm_sequence_library_utils_begin/_add/_end`, `type_id::set_priority`, `pick_sequence`, `next_sequence_name`
  * `uvm_semaphore`, `set_sequence_id_info`, `can_get_next_item`, `seq_item_export.analysis_export`
  * `+UVM_SEQ_ITEM_TRACE`, `uvm_report_sequences`, `print_seq_info`
  * a `bit`-returning `mid_do` that "vetoes" grants

  It also has code that deadlocks or fails at time 0: `start_item(req)` with a null `req`, and waiting on an event nobody triggers while holding a lock. It contains the classic `randomize() with { addr == addr; }` bug with no `local::`.
* **Practical skills that are missing entirely across all of T2 (and mostly the whole curriculum):**
  * UVM reporting and pass/fail (`uvm_error`, verbosity, `+UVM_VERBOSITY`, `+UVM_TESTNAME`)
  * Timeouts (`+UVM_TIMEOUT`, `set_timeout`), `phase_ready_to_end`
  * `` `uvm_analysis_imp_decl `` (it appears nowhere in the curriculum)
  * `check_config_usage` and `+UVM_CONFIG_DB_TRACE`
  * Silent `config_db` type mismatches
  * `put_response`/`get_response` and response-queue overflow
  * Objections raised from sequences
  * `get_is_active()`
* **Plumbing and navigation:**
  * All 11 lessons point to flashcard deck IDs that are not in the registry, so every module shows "No flashcards available".
  * The in-lesson "Next" links skip I-UVM-4/5/6: 3B goes to A-UVM-4A RAL, and 6 goes to T4 E-DBG-1.
  * The 3B sub-lessons are ordered alphabetically, so "Lab: Coordinated Attack" comes before Virtual Sequences.
  * The scoreboard-decoupling lab starter is already the finished solution.
  * The config-debug lab labels its bug in a code comment and checks for an output string that the code never prints.

### Module summary

| Module | Depth (1-5) | Strongest competency | Biggest gap | Severity |
|---|---|---|---|---|
| I-UVM-1A Objects & Components | 2 | E: object vs component constructors and registration macros | Wrong `super.build_phase` mechanism (1A:23, 1A:67). No field macros, `do_*`/`convert2string`, naming/`get_full_name`, or parent/ownership. | S1 |
| I-UVM-1B Factory | 3 | E/A: register → `type_id::create` → type override (snippets plus a guided override exercise) | Wrong instance-override precedence (1B:88, quiz 1B:123-129), contradicted by two visualizers. Wrong "unregistered override → fatal" claim (1B:99). | S2 |
| I-UVM-1C Phasing | 3 | E: `run_phase` runs in parallel with the runtime sub-phase schedule (1C:58-102) | connect/end_of_elaboration called top-down (1C:21). Drain time sold as hang safety net (1C:54). Driver-owned objection anti-pattern (1C:36-50). No timeouts, `phase_ready_to_end` or traces. | S1 |
| I-UVM-2A Component Roles | 2 | E: role vocabulary, active/passive | No agent, monitor or sequencer code. No `get_is_active()`. No assembled hierarchy. | S2 |
| I-UVM-2B TLM | 2 | E: analysis fan-out 0..N, `seq_item_port` ↔ `seq_item_export` | Wrong `write()` back-pressure rationale (2B:86) and wrong port→export rule (2B:57). No TLM 1.0 put/get code, no `` `uvm_analysis_imp_decl ``, no analysis-FIFO code. | S1 |
| I-UVM-2C Config & Resources | 3 | E/A: `set` from top / `get`+`uvm_fatal` in a component; vif via `config_db` | Precedence only half right (2C:80-81). No type-mismatch silent failure, `config_db` tracing, `check_config_usage`, resource_db usage, or sequence-side `get`. | S2 |
| I-UVM-3A Sequences & Items | 3 | E: `` `uvm_do `` expansion and the `get_next_item`/`item_done` handshake | False "queues are shared pointers after clone" (3A:45-46, 3A:107-108). Typedef used before declaration (3A:28/31). "Start from run phase" with no objection (3A:94). No responses. | S1 |
| I-UVM-3B Advanced Sequencing (8 pages) | 2 | E: virtual sequence vs virtual sequencer; lock vs grab (concept) | Fabricated APIs, compile-breaking and deadlocking exemplars, protocol layering never taught, "lab" is reading a solution | S1 |
| I-UVM-4 Policy Classes | 3 | E: field macros vs manual `do_*` trade-off | Quiz marks the correct answer wrong (macros + `do_compare` both run; 4:169-177). "Macros auto-generate all five `do_*`" (4:66). Buggy tolerant comparer. | S2 |
| I-UVM-5 Container Classes | 2 | E: choosing native SV vs UVM containers | Overstates `uvm_queue`/`uvm_pool` policy support (5:18, 5:61, quiz 3). `sort()` assigned (compile error). `uvm_pool::get` auto-insert not mentioned. | S3 |
| I-UVM-6 Recording Classes | 2 | E: `begin_tr`/`end_tr`/`do_record` workflow | Flashcard key mismatch. Does not say recording must be enabled. No practice beyond 2 self-answered Qs. Clause conflict with module 5. | S3 |

---

## 1. Per-module inventory, coverage and accuracy

### I-UVM-1A: UVM Objects and Components (`I-UVM-1A_Components/index.mdx`, 98 lines)

**Inventory**
* H2 sections: Quick Take, Build Your Mental Model, Make It Work, Interview Pitfalls, Practice & Reinforce, References & Next Topics.
* Interactive: `UVMTreeExplorer` (1A:21). Build/connect/run phase propagation animation; its directions are correct.
* Quiz: 2 MCQs (1A:74-94).
* Flashcards: `I-UVM-1A_Components`. **No such deck in the registry.**
* Labs: none.
* Code: one snippet (1A:29-55) of an object and a component, each with a constructor and macro. It compiles as a fragment and is the best-formed code in the T2 UVM set.
* Links: Prev is I-SV-9. Next is 1B, via a relative link `../I-UVM-1B_The_UVM_Factory/index`.

**Coverage**

| Concept | E | P | A | D | T | Evidence |
|---|---|---|---|---|---|---|
| uvm_object vs uvm_component | 2 | 1 | 1 | 0 | 0 | 1A:17-25, snippet 1A:29-55, quiz 1A:76-84 |
| Hierarchy / parent ownership | 1 | 0 | 0 | 0 | 0 | 1A:24 ("must have a name and a parent"). `get_full_name`, null parent → uvm_top, and name uniqueness are not taught. |
| Naming (instance name vs type name, full name) | 0 | 0 | 0 | 0 | 0 | — |
| `uvm_component_utils`/`object_utils` | 1 | 0 | 1 | 0 | 0 | 1A:63 |
| Field macros pros/cons | 0 | 0 | 0 | 0 | 0 | Deferred to module 4 (after sequences, where 3A already uses them) |
| do_copy/do_compare/do_print/convert2string | 0 | 0 | 0 | 0 | 0 | `convert2string` appears nowhere in T2 UVM |
| clone vs copy, component cloning | 1 | 0 | 0 | 0 | 0 | 1A:25, 1A:69-70 |

**Technical accuracy**
* **T2U-01 (S1, High). Wrong mechanism for `super.build_phase`.**
  * 1A:23: "If you forget to call `super.build_phase`, child components never instantiate."
  * 1A:67: "the base class `build_phase` propagates the tree construction via the factory. If you override it without calling `super`, construction stops."
  * In UVM 1.2 and 1800.2, `uvm_component::build_phase` does not create children. Children are created by the user's own `build_phase` code (`type_id::create`). The phasing engine calls each child's `build_phase` by walking the hierarchy.
  * What skipping `super.build_phase` actually loses is automatic configuration (`apply_config_settings` for `` `uvm_field_* ``-registered fields). For `uvm_agent` it also loses the base-class lookup of `is_active` from config.
  * This is taught as the "interview answer", so it actively plants a wrong model.
  * Fix: rewrite both passages as "children are created by your own `create` calls; `super.build_phase` performs auto-config of registered fields (and `is_active` for `uvm_agent`)". Add a predict-the-output exercise where a field set through `config_db` is ignored because `super.build_phase` was skipped.
* **T2U-02 (S3, High). Quiz 1A:86-92 is ambiguous.** "Omit the parent argument → compilation fails" is only true in some forms. A constructor `new(string name)` that calls `super.new(name, null)` compiles, and the component then attaches under `uvm_top`. That is exactly the distractor marked wrong. Also, a missing `(name, parent)` signature breaks the factory's generated `create`, not every compile.
* S4: 1A:70 says "Components are built during the elaboration phase". This conflates SV elaboration with UVM `build_phase`.

### I-UVM-1B: The UVM Factory (`I-UVM-1B_The_UVM_Factory/index.mdx`, 192 lines)

**Inventory**
* H2 sections: Quick Take, Build Your Mental Model, Make It Work, Advanced Factory Dynamics, Interview Pitfalls, Practice & Reinforce, Capstone Checkpoint, References.
* Interactives:
  * `FactoryOverrideVisualizer` (1B:76), imported.
  * `FactoryOverrideExplorerVisualizer` (1B:82). Not imported, but registered in `src/components/mdx/lazy-mdx-interactives.ts:78`, so it renders.
* Quiz: 3 MCQs (1B:103-131).
* Inline "Lab: Error Injection Override" with a hidden solution (1B:133-184).
* LabLink to `uvm-mini-capstone` (1B:188).
* Flashcards: `I-UVM-1B_The_UVM_Factory`, **not registered**.
* Code: 3 snippets. None compiles as written: `base_driver`, `mock_driver`, `my_test`, `error_test` and `bad_crc_driver`'s parent have no constructors, and `uvm_driver`/`uvm_test` constructors take `(name, parent)` with no defaults.

**Coverage**

| Concept | E | P | A | D | T | Evidence |
|---|---|---|---|---|---|---|
| Registration + `type_id::create` | 2 | 1 | 1 | 1 | 0 | 1B:18-44, quiz 1B:114-120, pitfall 1B:95-96 |
| Type vs instance override | 2 | 1 | 2 | 0 | 1 | 1B:46-69, inline lab 1B:139-181 (solution visible one click away; nothing checks it) |
| Override path strings | 1 | 0 | 1 | 0 | 0 | 1B:63 `"*.env.drv"`. Absolute vs `parent`-relative paths not explained. |
| Override precedence | 1 (wrong) | 1 (wrong) | 0 | 0 | 0 | 1B:85-89, quiz 1B:123-129 |
| Debug (`print`, topology) | 1 | 0 | 0 | 0 | 0 | 1B:74. No sample output, no `debug_create_by_type`/`find_override_by_type`. |
| Override chaining, `*_by_name`, `+uvm_set_type_override` | 0/1 | 0 | 0 | 0 | 0 | 1B:73 mentions `by_name` only |

**Technical accuracy**
* **T2U-03 (S2, High). Instance-override precedence is wrong, and three artifacts disagree.**
  * 1B:88: "Among instance overrides, **the highest component in the hierarchy wins** (e.g., `uvm_test` beats `uvm_env`)." The quiz (1B:123-129) reinforces this.
  * That is the `config_db` build-time rule, not the factory rule. The UVM factory checks instance overrides in **registration order, and the first matching override wins**. The UVM reference documentation says more specific overrides should be registered first.
  * Tests usually register first only because build runs top-down, so the outcome often looks the same. The stated rule still fails in cases such as a general `"*"` override registered before a specific one in the same test, or an override set from an env constructor called before the test registers its own.
  * The two visualizers implement two more rules:
    * `src/components/curriculum/interactives/FactoryOverrideVisualizer.tsx:43-60` uses "Longest matching path wins".
    * `src/components/visualizers/FactoryOverrideExplorerVisualizer.tsx:89-100`: the tree view applies the *last* matching instance override, while `simulateCreate` (:118-122) uses the *first* (`find`).
  * Fix: state "instance before type; among instance overrides, the first registered match wins; type overrides with `replace=1` replace earlier ones; overrides chain (A→B, B→C ⇒ C)". Make both visualizers use first-registered-match ordering. Add a predict-the-type exercise with two overlapping instance overrides registered in different orders.
* **T2U-04 (S2, Medium-High). 1B:98-99 "Base Class Fallback" is wrong.** It says a missing `uvm_component_utils` on the override type gives a "runtime UVM fatal error". In practice:
  * If `mock_driver` extends a registered class but lacks its own macro, `mock_driver::get_type()` resolves through inheritance to the **base class's** `get_type()`. The override silently becomes base→base, a no-op apart from a warning about identical types. This is the real, subtle trap.
  * If the class is not derived from a registered class at all, `get_type()` does not exist and compilation fails.
  * With `*_by_name` and an unregistered name, the factory reports an error or warning and the override does not apply. It is not a fatal.
* S4, Medium: 1B:74 `factory.print()`. The `factory` global is legacy. The 1800.2-style call is `uvm_factory::get().print()` (or via `uvm_coreservice_t`).
* S3, High: none of the 1B snippets compiles (no constructors), and nothing tells the learner they are fragments.

### I-UVM-1C: Phasing and Synchronization (`I-UVM-1C_UVM_Phasing/index.mdx`, 176 lines)

**Inventory**
* H2 sections: Quick Take, Build Your Mental Model, Advanced Mechanics, Interview Pitfalls, Practice & Reinforce, References.
* Interactives:
  * `UvmPhasingDiagram` (1C:25). **A placeholder.** It renders `DiagramPlaceholder` with "Next iteration adds phasing cues…" and a CTA linking back to this same page (`src/components/diagrams/UvmPhasingDiagram.tsx:6-11`).
  * `PhaseTimeline3D` (1C:27).
  * `UvmPhaseTimelineVisualizer` (1C:29). Its directions are correct (`src/components/visualizers/UvmPhaseTimelineVisualizer.tsx:35-55`), which contradicts the lesson text.
* Quiz: 4 MCQs.
* Flashcards: `I-UVM-1C_UVM_Phasing`, **not registered**.
* Labs: none.
* Code: 3 snippets (driver objection, run_phase plus main_phase test, jump). Undeclared `drive_one_transaction`, `my_seq`, `env`.

**Coverage**

| Concept | E | P | A | D | T | Evidence |
|---|---|---|---|---|---|---|
| Build top-down; connect/EoE/SoS bottom-up | 1 (wrong) | 1 | 0 | 0 | 0 | 1C:21 vs 1C:123; quiz 1C:134-141 (build only). start_of_simulation and final are never named. |
| run_phase in parallel with runtime sub-phases | 2 | 1 | 1 | 1 | 0 | 1C:58-102, quiz 1C:163-171 |
| Objections raise/drop | 2 | 1 | 1 | 1 | 0 | 1C:31-54, 1C:125-128 |
| Drain time / set_drain_time | 1 (misleading) | 0 | 0 | 0 | 0 | 1C:54 |
| phase_ready_to_end | 0 | 0 | 0 | 0 | 0 | absent from T2 (only in A-UVM-6) |
| Timeouts (+UVM_TIMEOUT, set_timeout) | 0 | 0 | 0 | 0 | 0 | absent from the whole curriculum |
| Phase jumping / reset handling | 1 | 0 | 0 | 0 | 0 | 1C:104-114 (questionable example) |
| Domains | 1 | 0 | 0 | 0 | 0 | 1C:104-105 |
| uvm_event / uvm_barrier | 1 | 1 | 0 | 0 | 0 | 1C:116-119, quiz 1C:154-160 |
| Debug traces (+UVM_PHASE_TRACE / +UVM_OBJECTION_TRACE) | 0 | 0 | 0 | 0 | 0 | absent |

**Technical accuracy**
* **T2U-05 (S1, High). Phase directions are wrong.** 1C:21 says "**Build-time (functions, top-down):** `build` …, `connect` …, `end_of_elaboration`". Only `build_phase` (and `final_phase`) run top-down. `connect`, `end_of_elaboration`, `start_of_simulation`, `extract`, `check` and `report` run bottom-up.
  * The same page later says connect "resolves bottom-up" (1C:123), and the page's own visualizer shows bottom-up. The page contradicts itself, and the Quick Take version is the one learners memorise.
  * Fix: 1C:21 should read "build (top-down); connect, end_of_elaboration, start_of_simulation (bottom-up)". Add a predict-the-print-order exercise for a 3-level hierarchy that logs in build and connect.
* **T2U-06 (S2, High). Drain time is presented as a hang safety net.** 1C:54: "If you forget to drop an objection, your simulation hangs. Automate safety nets with `uvm_objection::set_drain_time`".
  * Drain time only delays the phase end *after* the count reaches zero. It does nothing for a dropped-objection leak.
  * The safety net is the global timeout: `+UVM_TIMEOUT` or `uvm_root::set_timeout()`, default 9200s in the reference implementation.
  * `set_drain_time` is not static. It is called on the phase's objection: `phase.get_objection().set_drain_time(this, t)` in 1800.2, or `phase.phase_done.set_drain_time` in 1.2.
  * The unregistered deck `I-UVM-5_Phasing_and_Synchronization.json` repeats a non-existent `uvm_phase::set_drain_time`.
* **T2U-07 (S2, High). Driver-owned objections are taught as the pattern.**
  * 1C:36-50 shows a driver raising/dropping in `run_phase` around `repeat(10) drive_one_transaction()`. Production drivers run `forever` and normally do not object. The test (or the sequence, via starting-phase objection) owns the objections.
  * 3A:94 then says "Call `seq.start(sequencer)` from your test's run phase" with no objection. A learner who combines these gets either a test that ends at time 0 or a forever-driver that never drops.
  * Fix: the canonical exemplar should be `phase.raise_objection(this); seq.start(env.agt.sqr); phase.drop_objection(this);` in the test. Explain why drivers do not object.
* **T2U-08 (S3, Medium). Questionable jump example.** 1C:109-114 jumps from `run_phase` (common domain) to `uvm_shutdown_phase` (uvm domain schedule). Jumps target a phase in the current schedule. The canonical use is jumping from a run-time sub-phase back to `reset_phase` on mid-test reset. The example also conflicts with the page's own "Option A: use only run_phase" advice (1C:100).
  * 1C:107 "Skipping cleanup phases…" does not apply to a forward jump to shutdown. Reset handling (the canonical reason for jumping) is not taught.
* T2U-09 (S4): 1C:105 says "The default *common* domain runs all components together". Runtime sub-phases are in the `uvm` domain, so this is imprecise.

### I-UVM-2A: Component Roles (`I-UVM-2A_Component_Roles/index.mdx`, 120 lines)

**Inventory**
* H2 sections: Quick Take, Build Your Mental Model, Make It Work, Practice & Reinforce, Capstone Checkpoint, References.
* Interactive: `AnimatedUvmTestbenchDiagram` (2A:22). A prose pointer sends learners to Practice → Visualizations.
* Quiz: 2 recall MCQs.
* LabLink: capstone.
* Flashcards: `I-UVM-2A_Component_Roles`, **not registered**.
* Code: one env snippet (2A:59-81). It has no constructor, and the agent's `analysis_port` and the scoreboard's `exp_export` are never declared.
* Reference: "Clause 14 (Predefined component classes)" (2A:119). This conflicts with 1A:97, which cites Clause 13.1 for uvm_component.

**Coverage**

| Concept | E | P | A | D | T | Evidence |
|---|---|---|---|---|---|---|
| Test/env/agent/monitor/scoreboard/subscriber roles | 2 | 1 | 0 | 0 | 0 | 2A:35-55, quiz |
| Active/passive, `is_active`, `get_is_active()` | 1 | 1 | 0 | 0 | 0 | 2A:46-48. `get_is_active` absent. Agent build/connect code absent. |
| Env build/connect | 1 | 0 | 1 | 0 | 0 | 2A:59-81 |
| Agent internals (create drv/sqr/mon; connect `seq_item_port`) | 0 | 0 | 0 | 0 | 0 | **no agent class anywhere in T2 lessons** |
| Monitor implementation (vif sampling, create per txn, `ap.write`) | 1 | 0 | 0 | 0 | 0 | 2A:49-51 prose only |

**Accuracy**
* Mostly correct.
* 2A:87 "Rely on `iff valid && ready` sample conditions" is fine as a hint.
* Main finding is **T2U-10 (S2, High) Missing coverage**: the module that "is" the testbench hierarchy never shows an agent or a monitor in code. This is the central gap in the practical path (§3).

### I-UVM-2B: TLM Connections (`I-UVM-2B_TLM_Connections/index.mdx`, 164 lines)

**Inventory**
* H2 sections: Quick Take, Build Your Mental Model, Decoupling the Scoreboard, Make It Work, Interview Pitfalls, Practice & Reinforce, Capstone Checkpoint, References.
* Interactives:
  * `AnimatedUvmSequenceDriverHandshakeDiagram`, `Dataflow3D`, `Analysis3D`.
  * `TlmConnectionBuilderVisualizer` (2B:133). Its compatibility rule is `src/components/visualizers/TlmConnectionBuilderVisualizer.tsx:44-50`.
  * `TLMPortConnector` (2B:142).
* Quiz: 2 MCQs.
* Links: `/practice/lab/scoreboard-decoupling`, capstone LabLink.
* Flashcards: `I-UVM-2B_TLM_Connections`, **not registered**.
* Code: driver loop and connect snippet; monitor/scoreboard skeleton with the `write` call commented out (2B:61-83).
* **No code for `uvm_tlm_analysis_fifo`**, despite a whole section on it (2B:85-91).

**Coverage**

| Concept | E | P | A | D | T | Evidence |
|---|---|---|---|---|---|---|
| TLM 1.0 port/export/imp | 1 | 0 | 0 | 0 | 0 | 2B:17, 2B:23. No put/get/peek code, no imp class, no min/max size. |
| Analysis port broadcast, 0..N | 2 | 1 | 1 | 0 | 0 | 2B:54-83, quiz 2B:119-125 |
| `write` is a function / no back-pressure | 0 (wrong) | 0 | 0 | 0 | 0 | 2B:86 |
| uvm_tlm_analysis_fifo | 1 | 0 | 0 (prose) | 0 | 0 | 2B:85-91 (lab starter already solved, §3) |
| `uvm_analysis_imp_decl` (multi-input scoreboard) | 0 | 0 | 0 | 0 | 0 | absent from the entire curriculum |
| Hierarchical connection rules | 1 (muddled) | 0 | 0 | 0 | 0 | 2B:100-101 |
| Clone before write | 1 | 1 | 0 | 0 | 0 | 2B:97, quiz 3A:126-132 |

**Technical accuracy**
* **T2U-11 (S1, High). False `write()` back-pressure rationale.** 2B:86: "Because `write()` is a blocking function call … a slow scoreboard will artificially prevent the monitor from capturing the next bus cycle!"
  * `write()` is a `function`. It executes in zero simulation time and cannot consume time, so it cannot stall the monitor in simulated time. A time-consuming check cannot be put in `write()` at all; that would be a compile error.
  * The real reasons for an analysis FIFO:
    * the subscriber needs task context (to wait, or to pair expected with actual from two streams), or
    * the work must be deferred or synchronized across streams.
  * The scoreboard-decoupling lab README repeats the false premise: "Because `write()` is a blocking function call … the slow Scoreboard is blocking the Monitor" (`content/curriculum/labs/scoreboard_decoupling/README.md`).
  * This is precisely the "analysis write semantics" misconception the audit brief asked about.
  * Fix: "`write()` is a zero-time function; analysis ports have no back-pressure. Use `uvm_tlm_analysis_fifo` when the consumer needs task context (waiting, pairing, timing)". Add a Predict question: "a subscriber's `write()` contains `#10` — what happens?" (answer: compile error).
* **T2U-12 (S2, High). Wrong connection rule.** 2B:57 "Correction on Hierarchy": "A common mistake is thinking an `analysis_port` connects directly to an `analysis_export`. It does *not*."
  * `ap.connect(x.analysis_export)` is legal and ubiquitous. `uvm_tlm_analysis_fifo::analysis_export` and `uvm_subscriber::analysis_export` are the commonest targets, and 2B:89 and the 2B builder widget do exactly this.
  * The correct point is that every chain must terminate in an imp.
  * The lesson and the widget contradict each other.
* **T2U-13 (S3, Medium). Muddled hierarchy rule.** 2B:100-101 says "You can only connect … UP or DOWN … `peerA_port.connect(peerB_export)` is valid. But you cannot bypass hierarchy boundaries". The real rules:
  * port→port goes child-to-parent (up).
  * export→export goes parent-to-child (down).
  * port→export/imp connects siblings, typically from the common parent's `connect_phase`.
  * Unconnected non-analysis ports fail the min-size check at end of elaboration.
* S3: 2B:17 says "Ports send, exports receive". Control flow and data flow are confused: a `get` port *receives* data.
* Not taught: `` `uvm_analysis_imp_decl(_exp) ``/`(_act)` for a scoreboard with two inputs. This is the most common real scoreboard pattern, and it is absent from all tiers (grep of `content/curriculum/T*`).

### I-UVM-2C: Configuration and Resources (`I-UVM-2C_Configuration_and_Resources/index.mdx`, 126 lines)

**Inventory**
* H2 sections: Quick Take, Build Your Mental Model, Make It Work, Interview Pitfalls, Practice & Reinforce, References.
* Interactive: `ConfigDbExplorer` (2C:83). It is titled "Precedence & Matching" but only glob-matches a single `set`; it does not model precedence between competing sets (`src/components/curriculum/interactives/ConfigDbExplorer.tsx:53-85`).
* Quiz: 2 MCQs.
* Link: `/practice/lab/config-debug`.
* Flashcards: `I-UVM-2C_Configuration_and_Resources`, **not registered**.
* Code: test set, agent get, and top-module vif set. Missing `endclass`/constructors/`super.build_phase` in the agent; `cfg.randomize()` result unchecked.
* Reference: "Clause 23". From memory the config/resource classes are in Annex C of 1800.2 (unverified); either way this disagrees with the other modules' numbering.

**Coverage**

| Concept | E | P | A | D | T | Evidence |
|---|---|---|---|---|---|---|
| set/get semantics, cntxt+inst_name concatenation | 2 | 0 | 1 | 1 | 0 | 2C:23-59, 2C:77-81 |
| Precedence (build: higher context wins; same context or post-build: last set wins) | 1 (partial) | 1 | 0 | 0 | 0 | 2C:80-81, quiz 2C:114-120 |
| Wildcards | 1 | 0 | 0 | 0 | 0 | 2C:87 |
| Type-mismatch silent failure | 0 | 0 | 0 | 0 | 0 | absent (e.g. `virtual apb_if` vs `virtual apb_if.mp`, `int` vs `bit[31:0]`) |
| Virtual interface passing | 2 | 1 | 1 | 1 | 0 | 2C:61-75, 2C:91-92, config-debug lab |
| resource_db | 1 | 0 | 0 | 0 | 0 | 2C:19-21 (no code) |
| check_config_usage / +UVM_CONFIG_DB_TRACE | 0 | 0 | 0 | 0 | 0 | absent from the whole curriculum |
| get from a sequence (non-component) | 0 | 0 | 0 | 0 | 0 | absent |
| Auto-config via field macros + super.build_phase | 0 | 0 | 0 | 0 | 0 | absent |

**Technical accuracy**
* **T2U-14 (S3, High). Precedence is only half stated.** 2C:80-81: "If multiple match, **the highest component in the hierarchy wins** … if strings are set during the `run_phase`, **the latest set() call wins**." The correct rules:
  * During build, a `set` from a higher context has higher precedence.
  * Two sets from the **same** context: the last one wins.
  * Outside build (any later phase): all sets have equal precedence, so the last set wins.
  * Path specificity is **not** a factor. This is a common misconception that should be named.
  * "strings" is a misnomer.
  * The quiz explanation (2C:120) says the test's settings "always override" the children's settings, which is false after build.
* **T2U-15 (S2, High). Missing: silent type mismatch.** The only debug pattern taught is a field-name typo (2C:91-92). A `get` with a different type parameter than the `set` returns 0 with no diagnostic. The repo's own labs use modport-typed vifs (`virtual my_if.driver_mp`, `virtual fifo_if.driver_mp`) while the lesson sets `virtual apb_if`, so a learner mixing them will hit exactly this failure with no guidance.
* S4: 2C:15 "`set()` pushes from the top down. `get()` pulls from the bottom up" is a mnemonic with no technical meaning.

### I-UVM-3A: Basic Sequences and Items (`I-UVM-3A_Fundamentals/index.mdx`, 142 lines)

**Inventory**
* H2 sections: Quick Take, Build Your Mental Model, Make It Work, Push Further, Explore Nested Sequence Execution, Interview Pitfalls, Practice & Reinforce, Capstone Checkpoint, References.
* Interactives: `AnimatedUvmSequenceDriverHandshakeDiagram`, `UvmSequenceHierarchyVisualizer` (registered).
* Quiz: 2 MCQs.
* LabLink: capstone.
* Flashcards: `I-UVM-3A_Fundamentals`, **not registered**.
* Code: item (3A:22-47), sequence plus driver (3A:56-82). The item uses `op_t` in `` `uvm_field_enum `` (3A:28) before its `typedef` (3A:31); a type must be declared before use, so most tools reject this. The driver lacks a constructor, and `drive_transfer` is undefined.
* Reference: Clause 14.3 (`uvm_sequence_item`) and 15.3 (`uvm_sequence`). These conflict with 3B:34 "Clause 15 (Sequences and Sequencers)" and with my recollection (14 = sequences, 15 = sequencers).

**Coverage**

| Concept | E | P | A | D | T | Evidence |
|---|---|---|---|---|---|---|
| Sequence item modelling (rand, constraints, macros) | 2 | 0 | 1 | 0 | 0 | 3A:18-47 |
| Sequence `body()` / `start()` | 1 | 0 | 1 | 0 | 0 | 3A:51-68, 3A:94 |
| start_item / finish_item | 2 | 1 | 1 | 0 | 0 | 3A:84-89, quiz 3A:117-123 |
| `` `uvm_do `` pros/cons (1800.2 form) | 1 | 0 | 1 | 0 | 0 | 3A:84-89. No pros/cons, no 1800.2 signature (`` `uvm_do(SEQ_OR_ITEM, SEQR, PRI, CONSTRAINTS) ``, Medium confidence), no randomize-failure warning, no "works for sub-sequences too". |
| get_next_item / item_done handshake | 2 | 1 | 1 | 1 | 0 | 3A:70-82, 3A:110-111 |
| try_next_item, get/put, responses | 0 | 0 | 0 | 0 | 0 | deferred to 3B (with errors) |
| Objections around `seq.start` | 0 | 0 | 0 | 0 | 0 | 3A:94 omits them |
| Deep copy / do_copy | 1 (wrong) | 1 (wrong) | 0 | 0 | 0 | 3A:45-46, 3A:107-108 |

**Technical accuracy**
* **T2U-16 (S1, High). False SystemVerilog semantics for queues.**
  * 3A:107-108: "The clones share the EXACT SAME queue pointer in memory; modifying one modifies the other!" 3A:45-46 makes the same claim.
  * SV queues and dynamic arrays are **value-semantic**: assignment copies the elements. The real traps are different:
    1. A field that is neither registered with a macro nor copied in `do_copy` is **not copied at all**. The clone gets an empty queue, and `compare()` silently ignores the field, so a miscompare is missed.
    2. **Class-handle** members (and queues of handles) are shallow-copied unless deep-copied explicitly.
  * The lesson teaches a non-existent aliasing bug and hides the real "silently skipped field" bug.
  * Fix: rewrite both passages. Add a Predict exercise: "item with unregistered `byte q[$]`, clone, compare" → clone's q is empty and compare passes.
* **T2U-17 (S3, High).** 3A:28 vs 3A:31: `` `uvm_field_enum(op_t, …) `` appears before `typedef enum {…} op_t;`, a declare-before-use violation. Move the typedef above the macro block.
* **T2U-18 (S2, High).** 3A:94 "Call `seq.start(sequencer)` from your test's run phase" omits objections. See T2U-07.
* S4: 3A:15 retention hook "start_item, drive, item_done" mixes the sequence side and the driver side.

### I-UVM-3B: Advanced Sequencing and Layering (index plus 8 sub-pages, 698 lines)

**Inventory**
* `index.mdx` (35 lines):
  * Flashcards `I-UVM-3B_Advanced_Sequencing`, **not registered**.
  * No quiz.
  * Next is **A-UVM-4A RAL** (3B/index:35), which skips I-UVM-4/5/6.
* `virtual-sequences.mdx`:
  * `UvmVirtualSequencerDiagram`, an `InteractiveCode` walkthrough, and 2 MCQs.
  * Code issues (T2U-25): `super.new(name, parent)` on a `uvm_sequence` (:56-57), and declarations after statements in `body()` (:67-68).
* `uvm-virtual-sequencer.mdx` (27 lines):
  * `VirtualSequencerExplorer` (78-line component).
  * Text refers to "the interactive code block on the page" (:27). **There is none.** Stale duplicate page.
* `sequence-arbitration.mdx`: arbitration modes, lock/grab table, `pre_do`/`mid_do` example, static Q&A.
* `layered-sequences.mdx`: atomic/scenario/virtual hierarchy and `p_sequencer`; static Q&A.
* `sequence-libraries.mdx`: library code (fabricated API), static Q&A.
* `interrupt-handling.mdx`: monitor, router and vseq code; 2 MCQs.
* `sequencer-driver-handshake.mdx`: driver with response, `intrusive_sequence`, debug triage; static Q&A.
* `coordinated-attack-lab.mdx`: the "Lab" is "Examine the solution below" (:27). No starter, no task, no check.
* The InfoPage sub-pages show their quiz answers inline with "*(correct)*" visible next to the right option, so there is no retrieval practice.
* Global prev/next order (`src/lib/curriculum-data.tsx:509-557`) is alphabetical: coordinated-attack-lab → interrupt-handling → layered → arbitration → libraries → handshake → uvm-virtual-sequencer → virtual-sequences. The lab and interrupt page come **before** the virtual-sequence and handshake pages they depend on.

**Coverage**

| Concept | E | P | A | D | T | Evidence |
|---|---|---|---|---|---|---|
| Virtual sequences / virtual sequencers | 2 | 1 | 1 | 0 | 0 | virtual-sequences.mdx:19-120. vsqr handle assignment described in prose only (:91). Starting a vseq from the test (incl. `start(null)`) not shown. |
| p_sequencer / m_sequencer / `` `uvm_declare_p_sequencer `` | 1 | 1 | 1 | 0 | 0 | virtual-sequences.mdx:54,62; layered:61-66; macro only in fabricated library code |
| Arbitration modes | 1 (partly wrong) | 0 | 1 | 0 | 0 | sequence-arbitration.mdx:17-40 |
| lock/grab, priority | 1 | 1 | 0 | 0 | 0 | sequence-arbitration.mdx:42-48, quiz :103-113, sandbox `/exercises/sequencer-arbitration` |
| Responses (put_response/get_response/set_id_info/queue overflow) | 1 (errors) | 0 | 0 | 1 | 0 | handshake.mdx:94-106 |
| try_next_item | 1 | 0 | 0 | 0 | 0 | handshake.mdx:99 |
| Layering (protocol translation sequences) | 0 | 0 | 0 | 0 | 0 | Promised at 3B/index:8; layered-sequences.mdx covers only sequence-composition layers |
| Sequence libraries | 0 (fabricated API) | 0 | 0 | 0 | 0 | sequence-libraries.mdx |
| is_relevant / wait_for_relevant | 0 | 0 | 0 | 0 | 0 | absent (the real "veto" hook) |

**Technical accuracy: confirmed defects**
* **T2U-19 (S1, High). Sequence-library API is fabricated** (sequence-libraries.mdx):
  * :20-24 `` `uvm_sequence_library_utils_begin/_add/_end `` do not exist. The real API is `` `uvm_sequence_library_utils(LIB) `` in the library, plus `` `uvm_add_to_seq_lib(SEQ, LIB) `` in each sequence, or `add_typewide_sequence()`/`add_sequence()`.
  * :43-48 `lib.randomize() with { select_next_seq == …; mem_atomic_write::type_id::set_priority(5); }`. You cannot call functions as statements inside a constraint, `type_id::set_priority` does not exist, and `select_next_seq` is not a rand variable.
  * :51-52 `next_sequence_name()` and `pick_sequence()` do not exist. The real usage is `lib.start(sqr)` and the `selection_mode`/`min_random_count`/`max_random_count`/`sequence_count` knobs.
  * :66 the field is `selection_mode`, not `sequence_library_mode`. `UVM_SEQ_LIB_RANDC` itself is right.
  * :72 "try/finally style constructs" do not exist in SystemVerilog.
  * The quiz (:77-81) tests the invented `pick_sequence()`.
  * Fix: rewrite the page against the real `uvm_sequence_library` API, or remove it.
* **T2U-20 (S2, High). `mid_do` misuse and a wrong handshake claim** (sequence-arbitration.mdx:54-85):
  * `mid_do` is `virtual function void mid_do(uvm_sequence_item this_item)`. Overriding it as `function bit` is a compile error.
  * `mid_do` runs inside `finish_item` **after** grant, so it can neither veto nor re-arbitrate.
  * The `body` waits for credits *after* `start_item` returns, i.e. after grant, while the driver is blocked in `get_next_item`. That stalls the driver, which is the opposite of :84's claim "preventing overrun without blocking the driver".
  * The real techniques: wait for credits before `start_item`, or override `is_relevant()`/`wait_for_relevant()`.
  * handshake.mdx:30 adds "priority hooks (`mid_do`, `pre_do`) sit here", between `start_item()` and `wait_for_grant()`. In fact `wait_for_grant` is called *inside* `start_item`, and `pre_do` runs after the grant.
* **T2U-21 (S2, High). Wrong arbitration mode definition.** sequence-arbitration.mdx:22 says "`SEQ_ARB_STRICT_FIFO` – preserves strict order, even across locks". STRICT_FIFO grants the **highest-priority** requests in FIFO order. :23 lumps RANDOM and STRICT_RANDOM together without saying STRICT_RANDOM picks randomly among the highest priority. Separately, the 1800.2 enum literals are `UVM_SEQ_ARB_*`; `SEQ_ARB_*` are legacy aliases (Medium confidence). The sandbox (`src/components/exercises/SequencerArbitrationSandbox.tsx:15,137-142`) models only 3 modes and lets a second `lock()` **steal** the lock immediately; a real second lock queues.
* **T2U-22 (S2, High). Handshake exemplar contains compile errors, null-item fatals and a deadlock** (sequencer-driver-handshake.mdx:65-86):
  * `uvm_semaphore` is not a UVM class. SystemVerilog has `semaphore`.
  * `start_item(req)` with `req` never created → null-item fatal.
  * `item_done_evt.wait_on()` waits for an event nothing triggers, while holding `lock()` → permanent deadlock. `finish_item` already waits for `item_done`, so the extra wait is redundant anyway.
  * The driver response (:44-47) does `rsp.copy(req)` without `rsp.set_id_info(req)`. The page's own triage (:105) says a missing `set_id_info` mismatches responses. Without the sequence ID, the response cannot be routed; the reference implementation reports an error for a response with no sequence id (Medium confidence on exact behavior).
  * Invented API and plusargs: `set_sequence_id_info()` (:97; the real one is `set_id_info`), `seq_item_export.analysis_export` (:98; does not exist), `+UVM_SEQ_ITEM_TRACE` (:98; not a UVM plusarg), `can_get_next_item()` (:99; the real one is `has_do_available()`), `sequencer.print_seq_info()` and `uvm_report_sequences` (:109; also sequence-arbitration.mdx:89).
  * :104 "The **driver** grabbed the sequencer via `grab()`" — sequences grab, not drivers.
  * :103 "Driver hangs forever … `item_done()` was skipped". Calling `get_next_item` again without `item_done` produces a UVM error ("get_next_item called twice without item_done…"). The sequence, blocked in `finish_item`, is what hangs. The page omits that diagnostic.
  * Response-queue overflow is not explained: if a driver returns responses the sequence never collects, they are dropped with an error once the queue reaches its default depth of 8 (Medium confidence on the exact default).
* **T2U-23 (S2, High). The canonical `local::` bug is presented as correct code.** layered-sequences.mdx:41: `req.randomize() with { rw == WRITE; this.addr == addr; this.data == data; }`. Inside an inline constraint, unqualified `addr` resolves to `req.addr`, so this is `addr == addr` (always true) and the sequence's `addr`/`data` are ignored. It needs `local::addr`. Also :40 `start_item(req)` with null `req`, :53 undeclared `idx`, and :68-69 declarations after statements.
* **T2U-24 (S2, High). `write()` calls a task.** interrupt-handling.mdx:47-49 calls `pending.put(t.clone())` inside `function void write`. `mailbox::put` is a **task**, so this is a compile error (use `try_put`). Also, `clone()` returns `uvm_object`, so a `$cast` is needed for `mailbox#(irq_tr)`. This contradicts the "write is a function" rule the learner should know. Also :34-35 declaration after statement, and `router` is never assigned (:57-64).
* **T2U-25 (S3, High). Compile errors in virtual-sequences.mdx.** :56-57 `function new(string name, uvm_object parent=null); super.new(name, parent);` — `uvm_sequence::new` takes only a name. :67-68 declarations after the `if` statement.
* **T2U-26 (S2, High). Missing coverage: protocol layering.** The index promises "layering protocols (e.g., TCP over IP over Ethernet)" (3B/index:8). layered-sequences.mdx only covers organising sequences (atomic/scenario/virtual). The UVM layering pattern is never shown: a translation sequence on the lower sequencer pulling from an upper-layer sequencer's `seq_item_export`, and layering agents. :93 also advises sampling coverage in scenario sequences (quiz :104-108). That measures intent, not observed behavior; coverage normally belongs in monitor-fed subscribers.
* **T2U-27 (S3, High). Interaction weakness.** coordinated-attack-lab.mdx:27 reads "Examine the solution below". The learner writes nothing, and the vseq's `p_cfg_sqr`/`p_data_sqr` are never assigned (:36-37), although Objective 3 (:22) requires that wiring.

### I-UVM-4: Policy Classes (`I-UVM-4_UVM_Policy_Classes/index.mdx`, 194 lines)

**Inventory**
* H2 sections: Quick Take, Build Your Mental Model, Make It Work, Push Further, Practice & Reinforce, References.
* Interactive: `UvmPolicyVisualizer`.
* Quiz: 3 MCQs.
* Flashcards: `I-UVM-4_Policy_Classes`. The JSON exists (7 cards) but is **not registered**.
* Code:
  * Field-macro item.
  * Manual `do_print`/`do_compare`. Does not call `super.do_compare`, does not use the comparer, so miscompares go unreported.
  * Tolerant comparer and `do_record` snippet.
* Links: Prev is 3B. "Next" says "Explore UVM container classes" **without a link**, or go to A-UVM-4A.
* Clause refs internally inconsistent: :28 says policies are Clauses 5.4–5.8 and 16, while :191 says "Clause 16 — Reporting and recording infrastructure".

**Coverage**

| Concept | E | P | A | D | T | Evidence |
|---|---|---|---|---|---|---|
| Field macros pros/cons | 2 | 1 | 1 | 0 | 0 | 4:49-99 |
| do_copy/do_compare/do_print | 2 | 1 (wrong key) | 1 | 0 | 0 | 4:68-97, quiz 4:169-177 |
| convert2string | 0 | 0 | 0 | 0 | 0 | absent |
| comparer/printer/packer/recorder/copier | 1 | 1 | 1 | 0 | 0 | 4:16-26, 4:121-153 |
| Deep vs shallow (UVM_REFERENCE / recursion policy) | 1 (overgeneralized) | 0 | 0 | 0 | 0 | 4:26, 4:119 |

**Technical accuracy**
* **T2U-28 (S2, High). The quiz marks the correct answer wrong.** 4:169-177: "What happens if you use `uvm_field_*` macros but also implement `do_compare()`?" It marks "do_compare() takes priority and the macro-generated compare is ignored" as correct and "both run and results are combined" as wrong.
  * In UVM 1.2, `compare()` runs field automation and then `do_compare()`, and ANDs the results. 1800.2 does the same: field-macro `do_execute_op` plus `do_compare`.
  * The supporting claim at 4:66 is also wrong: "The macros auto-generate all five `do_*` methods". Macros generate the field-automation hook; `do_*` remain user hooks.
  * Learner consequence: they will double-compare, or believe they disabled macro comparison when they have not.
* **T2U-29 (S3, Medium).** 4:26 and 4:119 say "`copy()` deep-clones nested handles by default". This holds for macro-registered object fields under the default policy. A manual `do_copy` copies only what you write. Teach the `UVM_REFERENCE` flag and recursion policy.
* **T2U-30 (S3, Medium-High).** 4:126-139 tolerant comparer:
  * The `compare_field_int` override signature uses `uvm_bitstream_t`, but the base uses `uvm_integral_t`, so the override will not match.
  * `-tolerance` with `int unsigned tolerance` makes the comparison unsigned, so the tolerance check is wrong.
  * The "abs ≤ tol" logic is off by one (`<` vs `≤`).
  * The flashcard "Set `comparer.abstract`" is meaningless.
* S4: the pseudocode at 4:36-44 uses methods that do not exist (`print_object_header/footer`). It is labelled pseudocode, but a learner may search for them. 4:112 `uvm_default_printer` is legacy; 1800.2 uses `uvm_printer::set_default()` (Medium).

### I-UVM-5: Container Classes (`I-UVM-5_UVM_Container_Classes/index.mdx`, 176 lines)

**Inventory**
* Interactive: `UvmContainerVisualizer`.
* Quiz: 3 MCQs.
* Flashcards: `I-UVM-5_Container_Classes`. JSON exists, **not registered**.
* Code: pool/queue snippets and a native-SV snippet; the global event-pool pattern.
* Next: A-UVM-4A, or "explore recording classes" (no link).

**Coverage**: uvm_pool (E1 P1 A1 D0 T0, 5:27-45), uvm_queue (E1 P1 A1, 5:47-71), choice vs native SV (E2 P1, 5:73-102).

**Technical accuracy**
* **T2U-31 (S3, Medium-High). Overstated policy support.** 5:18 says both containers "support all five policy operations"; 5:61 says `pkt_log.print()` will "print all entries via uvm_printer"; quiz 3 (5:160-166) builds on this.
  * In the reference implementation, `uvm_queue` implements `do_copy` and `convert2string`, and `uvm_pool` implements `do_copy`/`do_print`. Neither implements `do_compare`, `do_pack` or `do_record`.
  * So `compare()` of two `uvm_queue`s compares nothing, and `print()` of a `uvm_queue` shows no entries.
  * 5:65 and 5:101 recommend `uvm_queue` precisely "to participate in compare". That is backwards.
* **T2U-32 (S3, High).** 5:86 `my_packet sorted_q[$] = pkt_q.sort() with (item.addr);` does not compile: `sort()` is a void, in-place method.
* S3: `uvm_pool::get(key)` silently **inserts** a default entry when the key is missing. For a class-typed value that means `null`, a pitfall for the event pattern at 5:116-131. UVM already provides `uvm_event_pool::get_global("name")`, which auto-creates; the page re-invents it.
* S4:
  * 5:8 and 5:49 say `uvm_queue` wraps a dynamic array; it wraps a SV queue.
  * 5:18 says "exactly two container classes"; `uvm_object_string_pool` and the event/barrier pools are omitted.
  * 5:173 cites IEEE 1800-2017 7.10–7.12 for associative arrays. Those are 7.8 (and the brief's standard is 1800-2023).

### I-UVM-6: Recording Classes (`I-UVM-6_UVM_Recording_Classes/index.mdx`, 106 lines)

**Inventory**
* Frontmatter uses `flashcardId` (the renderer accepts it). The deck `I-UVM-6_UVM_Recording_Classes` exists (3 cards) but is **not registered**.
* Title "UVM Recording Classes" lacks the "I-UVM-6:" prefix used by its siblings, and the page has a duplicate H1.
* Interactive: `TransactionRecordingVisualizer`.
* **No Quiz component.** "Practice & Reinforce" is two questions with the answers printed underneath (6:98-101).
* Code: `do_record` with macros; driver with `begin_tr`/`end_tr`.
* Next: **T4 E-DBG-1** (6:106).
* Clause ref "Clause 11: UVM Recording Classes" (6:105) conflicts with module 5's "Clause 11.2/11.3 containers". From memory, recording is Clause 7.

**Coverage**: recorder/stream/database roles (E2), do_record (E1 A1), begin_tr/end_tr/accept_tr (E1 A1). P/D/T are 0.

**Accuracy**
* Mostly correct.
* **T2U-33 (S3, Medium):** the page never says recording must be **enabled** before `begin_tr`/`end_tr` write anything. In UVM 1.x the classic knob is `recording_detail`/`UVM_FULL` set via config; 1800.2 has its own enable mechanism (exact name unverified). The tip at 6:88 cites a `+UVM_TR_RECORD` plusarg (Low confidence it is standard). A learner following the page may see empty streams.

---

## 2. Cross-cutting findings

| ID | Category | Evidence | Learner consequence | Sev | Conf | Recommended correction | Acceptance criteria / validation |
|---|---|---|---|---|---|---|---|
| G-01 | Confirmed defect | All 11 modules set `flashcards:` or `flashcardId:` (1A:4 … 6:4) to IDs absent from `src/lib/flashcard-decks.ts:65-121`. The registry only has the legacy `I-UVM-1_UVM_Intro … I-UVM-5_Phasing_and_Synchronization`. `FlashcardWidget.tsx:35-43` → "No flashcards available…". `I-UVM-4/5/6` JSONs exist but are unregistered. | No spaced-retrieval support anywhere in T2 UVM | S3 | High | Register decks under the frontmatter IDs. Write decks for 1A–3B. Fix wrong cards (`uvm_phase::set_drain_time`, `comparer.abstract`, `+UVM_PHASE_TRACE` "objection counts"). | A Vitest check that every `flashcards`/`flashcardId` value in `content/curriculum/**` resolves to a non-empty registry entry; a Playwright check that each T2 UVM page renders ≥1 card |
| G-02 | Confirmed defect | Snippets systematically fail to compile: missing constructors (1B, 1C, 2A, 2B, 3A, 3B), declarations after statements (virtual-sequences:67, layered:68, interrupt:35), declare-before-use (3A:28), invented classes and APIs (3B), task-in-function (interrupt:48), `sort()` assignment (5:86) | Learners who copy code hit errors unrelated to the concept. Erodes trust; trains them to ignore compiler messages. | S2 | High | Mark fragments explicitly. Make each module's main exemplar a complete, compiling unit. Add CI that compiles fenced `systemverilog` blocks tagged `compile` against a UVM library. | All `compile`-tagged blocks pass a UVM-enabled compile in CI; 0 invented UVM identifiers (lint against a UVM symbol list) |
| G-03 | Confirmed defect | Clause refs conflict: 1A:97 (13.1 component) vs 2A:119 (14 components); 3A:141 (14.3/15.3) vs 3B:34 (15 sequences+sequencers); 4:28 vs 4:191; 5:25 (11 containers) vs 6:105 (11 recording); 2C:18,125 "Clause 23"; 1C:62 "§9.2–9.3" | Learners who check the LRM land in the wrong place | S4 | High (inconsistency) / Medium (correct values) | Verify each clause against the 1800.2-2020 PDF; drop numbers that cannot be verified | Single clause map file; a lint rejecting un-mapped clause cites |
| G-04 | Interaction/design weakness | In-content "Next" links: 3B/index:35 → A-UVM-4A (skips 4/5/6); 4:193 "explore container classes" (no link) or A-UVM-4A; 5:175 → A-UVM-4A; 6:106 → T4 E-DBG-1. Global prev/next (`curriculum-data.tsx:509-557`, `findPrevNextTopics`) runs alphabetically through 3B. | The modules form a fork instead of a path. 4/5/6 are easily skipped. 3B's lab comes before its prerequisites. | S3 | High | Order 3B topics pedagogically (handshake → virtual-sequences → arbitration → layering → libraries → interrupts → lab). Make 3B → 4 → 5 → 6 → T3 linear. Delete or merge `uvm-virtual-sequencer.mdx`. | A nav test asserting the expected order, and that every in-content "Next" equals global next |
| G-05 | Missing coverage | Not taught anywhere in T2 (and mostly not anywhere): `uvm_info/warning/error/fatal`, verbosity, `+UVM_VERBOSITY`, `+UVM_TESTNAME`, report summary / pass-fail, `+UVM_TIMEOUT`/`set_timeout`, `+UVM_OBJECTION_TRACE`/`+UVM_PHASE_TRACE`, `+UVM_CONFIG_DB_TRACE`, `check_config_usage`, `` `uvm_analysis_imp_decl ``, `get_is_active`, starting-phase objections (grep results in §1) | The learner cannot decide whether a test passed, choose a test at run time, bound a hang, or trace config/objections. These are day-one skills. | S2 | High | Add a T2 "Reporting, run control & debug switches" lesson. Add `imp_decl` to 2B. Add `+UVM_CONFIG_DB_TRACE`/`check_config_usage` to 2C. Add timeouts and traces to 1C. | Each concept has a code exemplar plus a predict-or-debug exercise with a checked answer |
| G-06 | Interaction/design weakness | 3B InfoPage quizzes print "*(correct)*" next to the answer (e.g. handshake.mdx:117,123; arbitration:105,111; layered:106,112; libraries:78,85). Module 6 has answers inline. Most MCQs are single-fact recall. | Almost no Predict/Debug/Transfer practice; answers visible | S3 | High | Convert to `<Quiz>`. Add code-reading Predict items (print order, which override applies, what config value is seen, does it hang). | ≥3 reasoning items per module with explanations |
| G-07 | Prototype/gated | `UvmPhasingDiagram` is a placeholder that links to its own page (`src/components/diagrams/UvmPhasingDiagram.tsx:6-11`); `uvm-virtual-sequencer.mdx:27` refers to a missing code block | Dead UI | S4 | High | Remove or implement | Page renders with no placeholder copy |
| G-08 | Unverified concern | Relative MDX links `../I-UVM-1B_…/index` (1A:98, 1B:192, 2A:120, 2B:164, 2C via `../../`). These break if the page is opened without the trailing `/index` segment, and no remark plugin rewrites relative links. | Possible broken "Next" links | S4 | Medium | Use absolute `/curriculum/...` links | The `curriculum-links` Playwright suite covers both URL forms |

---

## 3. Practical path: can a learner build and run a first UVM environment after T2?

Target: a top module with interface and vif passed through `config_db`; a test; an env; an agent (driver/monitor/sequencer); a sequence; a scoreboard fed by an analysis FIFO; objection-controlled termination; compiled and run.

| Element | Where it is taught in T2 lessons | Quality | Starter/lab support |
|---|---|---|---|
| Interface + DUT + clock in top | none (2C:64-74 has the `config_db` set only; no clock/DUT) | — | Capstone `testbench.sv:85-93, 319-355` provides it complete |
| vif `config_db::set`/`get` + fatal | 2C:45-75 | Good, but no type-mismatch warning and no modport | Capstone starter provides both |
| Test with `run_test`, objections | 1C:72-90 (main_phase); 2C:72 `run_test("my_test")` | Driver-objection anti-pattern (T2U-07); `+UVM_TESTNAME` absent | Capstone starter provides the objection skeleton (`testbench.sv:311-316`) |
| Env build/connect | 2A:59-81 | Fragment (no ctor, undeclared ports) | Starter TODO |
| **Agent with active/passive** | **none** (prose 2A:44-48) | — | Starter TODO with hint `get_is_active()` (`testbench.sv:218-224`) |
| Driver with vif and clocking | 2B/3A loop only; `drive_transfer` undefined; no vif or clocking use | Fragment | Starter TODO (`testbench.sv:171-179`) |
| **Monitor sampling interface → `ap.write`** | **none** (2B:63-67 has the write commented out) | — | Starter TODO (`testbench.sv:199-202`) |
| Sequencer declaration | none in core lessons (only layered:31 typedef) | — | Starter provides `typedef` |
| Sequence | 3A:56-68 | Good | Starter TODO |
| Scoreboard via analysis FIFO | prose 2B:85-91 (with the false rationale) | No code | Starter provides FIFO + `get` loop; decoupling lab starter is **already solved** |
| Pass/fail reporting | none | — | Capstone solution's `check_phase`/`report_phase` (`solution.sv:382-404`) are never taught |
| Compile/run instructions | none | — | Capstone README: `<simulator_uvm_command> … solution.sv` placeholder only |

**Labs reached from T2**
* **uvm-mini-capstone** (`content/curriculum/labs/uvm_capstone/lab1_fifo_env/`).
  * Strengths: the starter is well scaffolded; it has an injected-bug run, acceptance criteria and good debug prompts (README "Debug Prompts").
  * Owned by `"owningModule": "A-UVM-6"` with `labPrerequisites: ["scoreboard-reference-model","scoreboard-decoupling"]`. The first is a T3 lab, yet T2 modules 1B, 2A, 2B and 3A link to it as a "Capstone Checkpoint".
  * All four steps are `"self_attested"`. `solution.sv` sits next to the starter.
  * The infrastructure supplies most of the structure (top, interface, vif set, objections, FIFO, `get` loop, coverage subscriber shell). The learner fills TODOs and does not design the env.
  * The in-page runner offers only Icarus/Verilator (`src/components/ui/CodeExecutionEnvironment.tsx:121-134`, images in `src/server/simulation/worker.ts:7-9`). **Unverified concern (Medium):** these images almost certainly cannot compile `uvm_pkg`, so no T2/T3 UVM lab can actually be run on-site.
* **scoreboard-decoupling** (`labs/scoreboard_decoupling/`):
  * Starter `env.sv` already declares, creates and connects `sb_fifo`, and `scoreboard.sv` already uses `uvm_blocking_get_port` with a `get()` loop. The learner has nothing to do.
  * The README premise is the false back-pressure claim (T2U-11).
  * Self-attested.
* **config-debug** (`labs/config_debug/`):
  * The bug is labelled in the starter itself: "DELIBERATE STARTER BUG: driver requests "vif", but this sets "viiif"" (`src/dv/testbench.sv`), plus the matching comment in `driver.sv`. So there is no diagnosis to do.
  * Step 3 says look for `[DRV] Wiggling pins`, but the driver prints "Driving pins through the clocking block".
  * The vif is set from the test via hierarchical reference `testbench.vif`, not from the top module as 2C teaches.
  * Self-attested.

**Verdict (High confidence):** No. Working only from T2 lessons, a learner has never seen an agent or a monitor in code, has no compile/run recipe, cannot judge pass/fail, and is given snippets that do not compile. They will copy the driver-objection pattern and the false analysis-FIFO rationale. The capstone could carry the outcome, but:
1. it sits in T3,
2. it is TODO-fill rather than independent design,
3. it ships with its solution,
4. nothing checks the result,
5. it likely cannot run on-site.

There is **no debug practice** with real symptoms for objection leaks, overrides that do not apply, unconnected analysis ports, `config_db` type mismatches, or `get_next_item` without `item_done`. The capstone README debug prompts have no answers or checks.

**What closes the gap**
1. Add a T2 "Assemble & run your first env" lesson after 3A (or 2C) that walks one complete, compiling file. It should cover top + interface + clock + DUT; vif set; test with objections; env; agent with `get_is_active`; driver with clocking block; monitor that samples and writes; sequence; scoreboard using `uvm_tlm_analysis_fifo` plus `check_phase`; `+UVM_TESTNAME`/`+UVM_VERBOSITY`/`+UVM_TIMEOUT`; and expected log output.
2. Move the mini-capstone (or a smaller first-env lab) to T2 ownership and remove the T3 prerequisites. Give it an independent variant: a different DUT, no TODO skeleton for agent/env.
3. Add four "broken env" debug labs with real symptoms: objection never dropped, override not applied (missing macro / `new()`), vif type mismatch, analysis port unconnected.
4. Make UVM labs runnable (a UVM-capable simulator image or a documented external flow), and grade at least "compiles + expected UVM_ERROR count".

---

## 4. Learner-journey transitions (I-SV-9 → I-UVM-1A … 6 → A-UVM-*)

* **I-SV-9 → 1A:** the link is clean (`I-SV-9_Why_UVM/index.mdx:260`). But I-SV-9:218 promises "a fully functioning, reusable UVM testbench" by end of T2, which T2 does not deliver (§3).
* **1A → 1B → 1C:** factory precedes phasing, yet 1B already uses `build_phase` with no explanation. 1A teaches the wrong `super.build_phase` mechanism before 1C teaches phases.
* **1C ↔ 2C contradiction pattern:** 1B (factory) and 2C (`config_db`) both state "highest component in the hierarchy wins". It is correct only for `config_db` during build. Learners will conflate the two mechanisms.
* **1C ↔ 3A:** objections live in 1C via a driver example, while 3A's "start the sequence" step drops them. The two never meet in one exemplar.
* **2B ↔ 2B widget ↔ decoupling lab:** the lesson says `analysis_port` cannot connect to `analysis_export`, while the widget and the lab connect exactly that.
* **2B ↔ 3B/interrupt-handling:** the lesson says (wrongly) that `write()` blocks. interrupt-handling calls a task from `write()`. Neither teaches "function, zero time, no back-pressure".
* **3A ↔ 4:** 3A uses field macros and warns about `do_copy`, but policy/field-macro semantics only arrive in 4, and 4's quiz is wrong (T2U-28).
* **Field macros:** used in 3A, explained in 4 (after 3B). Policy classes come after sequences instead of with objects (1A).
* **3B → T3:** 3B/index jumps to A-UVM-4A RAL, skipping 4/5/6. 4 and 5 also point to A-UVM-4A, and 6 points to T4 E-DBG-1. T3 has no A-UVM-1/2/3, although legacy flashcard JSONs exist for them, so T3 opens directly on RAL.
* **T3 back-references:** A-UVM-6, A-UVM-7 and A-UVM-8 list I-UVM-2A/2B/3A as prerequisites (e.g. `T3_Advanced/A-UVM-7_VIP_Construction/index.mdx:309-310`). They assume an agent/monitor competency that T2 never practises in code.
* **Duplicates:** `virtual-sequences.mdx` and `uvm-virtual-sequencer.mdx` cover the same content, and the latter is stale. sequence-libraries.mdx and sequence-arbitration.mdx both explain grab/lock with slightly different claims.

---

## 5. Consolidated findings list

The table lists each finding with its severity and confidence. Corrections and full evidence are in §1 and §2.

| ID | Category | Evidence | Sev | Conf |
|---|---|---|---|---|
| T2U-01 | Confirmed defect | 1A:23, 1A:67 wrong super.build_phase mechanism | S1 | High |
| T2U-02 | Confirmed defect | 1A:86-92 ambiguous quiz (null parent is legal) | S3 | High |
| T2U-03 | Confirmed defect | 1B:88 + quiz 1B:123-129 + 2 visualizers: instance-override precedence | S2 | High |
| T2U-04 | Confirmed defect | 1B:98-99 unregistered override "fatal" | S2 | Med-High |
| T2U-05 | Confirmed defect | 1C:21 connect/EoE top-down | S1 | High |
| T2U-06 | Confirmed defect | 1C:54 drain time as hang net; no timeouts | S2 | High |
| T2U-07 | Confirmed defect | 1C:36-50 driver objections as the pattern | S2 | High |
| T2U-08 | Unverified concern | 1C:109-114 run_phase→shutdown jump; no reset handling | S3 | Medium |
| T2U-09 | Confirmed defect | 1C:105 domain description | S4 | Medium |
| T2U-10 | Missing coverage | 2A: no agent/monitor code, no get_is_active | S2 | High |
| T2U-11 | Confirmed defect | 2B:86 + decoupling README: write() back-pressure | S1 | High |
| T2U-12 | Confirmed defect | 2B:57 port→export "does not" connect | S2 | High |
| T2U-13 | Confirmed defect | 2B:100-101 hierarchy connection rule | S3 | Medium |
| T2U-14 | Confirmed defect | 2C:80-81, 2C:120 precedence incomplete / "always" | S3 | High |
| T2U-15 | Missing coverage | 2C: type-mismatch silent get failure, tracing, check_config_usage | S2 | High |
| T2U-16 | Confirmed defect | 3A:45-46, 3A:107-108 queue shallow-copy myth | S1 | High |
| T2U-17 | Confirmed defect | 3A:28/31 typedef after use | S3 | High |
| T2U-18 | Missing coverage | 3A:94 seq.start without objection | S2 | High |
| T2U-19 | Confirmed defect | sequence-libraries.mdx fabricated API | S1 | High |
| T2U-20 | Confirmed defect | sequence-arbitration.mdx:54-85 mid_do bit/veto; post-grant wait; handshake.mdx:30 | S2 | High |
| T2U-21 | Confirmed defect | sequence-arbitration.mdx:22-23 STRICT_FIFO; sandbox lock stealing | S2 | High |
| T2U-22 | Confirmed defect | sequencer-driver-handshake.mdx:44-47, 65-109 null item, deadlock, invented APIs | S2 | High |
| T2U-23 | Confirmed defect | layered-sequences.mdx:41 `addr == addr` (no local::) | S2 | High |
| T2U-24 | Confirmed defect | interrupt-handling.mdx:47-49 task in write() | S2 | High |
| T2U-25 | Confirmed defect | virtual-sequences.mdx:56-57, 67-68 compile errors | S3 | High |
| T2U-26 | Missing coverage | 3B protocol layering promised (index:8), not taught; coverage-in-sequence advice | S2 | High |
| T2U-27 | Interaction/design weakness | coordinated-attack-lab.mdx:27 read-the-solution lab | S3 | High |
| T2U-28 | Confirmed defect | 4:169-177 quiz key wrong; 4:66 | S2 | High |
| T2U-29 | Confirmed defect | 4:26, 4:119 deep-copy overgeneralization | S3 | Medium |
| T2U-30 | Confirmed defect | 4:126-139 comparer signature/sign bug | S3 | Med-High |
| T2U-31 | Confirmed defect | 5:18, 5:61, 5:65, quiz 5:160-166 uvm_queue policy overclaim | S3 | Med-High |
| T2U-32 | Confirmed defect | 5:86 sort() assignment | S3 | High |
| T2U-33 | Missing coverage | 6: recording enablement not mentioned; no quiz | S3 | Medium |
| G-01…G-08 | see §2 | | S2–S4 | |
| LAB-1 | Confirmed defect | scoreboard_decoupling starter == solution (`src/dv/env.sv`, `src/dv/scoreboard.sv`) | S2 | High |
| LAB-2 | Confirmed defect | config_debug: bug labelled in starter comments; expected log string mismatch (lab.json step 3 vs driver.sv) | S3 | High |
| LAB-3 | Interaction/design weakness | uvm-mini-capstone owned by A-UVM-6 with T3 prereqs, linked as T2 checkpoint; self-attested; solution adjacent | S2 | High |
| LAB-4 | Unverified concern | On-site runner is Icarus/Verilator only, so UVM labs probably cannot run | S2 | Medium |

**Validation that would demonstrate a fix**, beyond tests passing:
* (a) Every T2 UVM exemplar tagged `compile` compiles against a UVM 1800.2 library in CI.
* (b) A learner-facing first-env lab produces expected `UVM_ERROR` counts in both its bug run and its clean run, checked automatically.
* (c) For T2U-01/03/05/11/16/28, each corrected concept has a Predict item whose answer the old text would have got wrong.
* (d) A nav test shows 3B → 4 → 5 → 6 → T3 in order.
* (e) The flashcard registry resolves all 11 IDs.
