# G29-B-DBG accuracy review, round 3: `content/interview-questions/debug.json`

Reviewer: accuracy lens, round 3 (2026-10-18). Scope: all 19 questions after the author's "Fix round 2". I re-read the whole bank. I also diffed it against the pre-fix-2 copy (`scratchpad/debug.before-fix2.json`). Round 2 changed only the six questions that B1 to B6 targeted:
- `debug-read-first-failure-log` (code);
- `debug-test-ends-at-time-zero`;
- `debug-waveform-protocol-hang`;
- `debug-tb-race-clock-edge`;
- `debug-seed-reproduction`;
- `debug-staff-regression-triage`.

Sources checked this round:
- IEEE 1800-2023 (`t1_lrm_clean.txt`).
- IEEE 1800.2-2020 (`uvm_lrm.txt`).
- Arm IHI0022E (`arm_axi.txt`).
- uvm-core 2020.3.1 source (`~/Downloads/1800.2-2020.3.1/src`; `uvm_version.svh:40` reads "Accellera:1800.2:UVM:2020.3.1").

**Verdict: pass. No S1 and no S2 remain.** All six round-2 findings are fixed, and every fix is correct against the sources. This round found 1 S3 and 6 S4, all new; none is a regression. The S3 is a consistency problem between two questions: a staff item states random-stream effects as absolutes, and the bank's own seed item teaches against them.

## Findings

| # | Sev | Question | Problem | Fix | Source checked |
|---|---|---|---|---|---|
| C1 | S3 | debug-staff-debug-infrastructure (model answer step 1; common mistake 2) | The model answer says plusarg debug kits mean "a debug rerun uses the same build and the same random streams". The common mistake says "Requiring a rebuild to turn on debug features, which changes the seed's stimulus". Both are absolutes, and both disagree with the bank's own `debug-seed-reproduction`. That item teaches two things. First, a rebuild breaks the recipe but does not by itself move the stimulus: a `$display` draws no random number, and uvm-core reseeds phase processes, components, sequences and items by name. Second, it lists "Blaming every result change after a debug edit on random stability, without checking whether the stimulus actually changed" as a common mistake. Follow-up 1 of this item also admits that a kit enabled by plusarg can move the streams. A candidate who says "a rebuild always changes the stimulus" matches this key but makes the mistake the senior item warns against. | Model answer: "...so a debug rerun uses the same build, and the random streams stay the same unless the kit itself creates objects or threads, or draws random numbers, in code that seeds the stimulus (see follow-up 1)." Common mistake: "Requiring a rebuild to turn on debug features: the rerun is no longer the failing recipe, and the rebuild can move the random streams or the order of racing processes." | IEEE 1800-2023 §18.14.1 ("When an object is created using new, its RNG is seeded with the next random value from the thread that creates the object"; "new objects, threads, and random numbers can be created after existing objects"), §4.7. uvm-core `uvm_topdown_phase.svh:125`, `uvm_task_phase.svh:168`, `uvm_component.svh:1780`, `uvm_sequence_item.svh:143`. The bank's `debug-seed-reproduction` |
| C2 | S4 | debug-methodology-first-steps (model answer step 4; common mistake 2) | Step 4 gives the reason not to edit before reproducing as "Editing code and rebuilding can change the random draws (IEEE 1800-2023 §18.14)". The common mistake says prints "can change the stimulus for that seed". Both are hedged, so neither is wrong. But a print draws no random number, and in a uvm-core bench an edit inside a component's phase method cannot move another component's stimulus. The more common reasons a rebuild makes a failure vanish are a changed recipe and a race whose order moved. Follow-up 2 ("one extra `$display` ... passes") depends on this distinction. | Step 4: "Editing code and rebuilding changes the recipe: an edit that creates objects or threads, or draws random numbers, can move the random streams (§18.14.1), and any rebuild can change the order of racing processes (§4.7), so the failure may vanish without being fixed." Mirror this in the common mistake. | IEEE 1800-2023 §18.14.1, §4.7; the bank's `debug-seed-reproduction` puzzle 2 |
| C3 | S4 | debug-coverage-hole-triage (model answer steps 1 and 2; `code`) | The answer's rule is `ignore_bins` for values that "cannot occur" and `illegal_bins` for values that "must never occur". Its example then files "the specification forbids it (here, an atomic burst longer than one beat)" under unreachable and uses `ignore_bins atomic_burst`. A value the specification forbids is one that must never occur. An `ignore_bins` silently drops a hit, so a DUT or stimulus that wrongly produces an atomic burst would go unnoticed. That is exactly the case the answer reserves `illegal_bins` for (`RSVD`). The criterion is a methodology choice, not a language rule, but as written the answer contradicts itself. | Either reword the example as a configuration fact ("this configuration never issues atomic bursts, so the cross products are not applicable"), or keep the specification wording and make the cross exclusion `illegal_bins atomic_burst = ...` (§19.6.3), so a hit fails the run. State the criterion once: `ignore_bins` for combinations that are not applicable or cannot be generated; `illegal_bins` where a hit would be a bug. | IEEE 1800-2023 §19.5.5, §19.5.6 ("All values or transitions associated with illegal bins are excluded from coverage"; a hit is a run-time error), §19.6.2, §19.6.3 |
| C4 | S4 | debug-seed-reproduction (model answer, puzzle 1, bullet 3) | "Uninitialized state or out-of-range reads whose result the tool or options decide." The result of an out-of-range read is defined by the standard. An unpacked array read with an invalid index returns the Table 7-1 value (`'x` for 4-state, `'0` for 2-state), and a packed select reads x (§11.5.1). So the read itself is not a source of non-determinism. What tool options decide is the effect of initialization modes and X-propagation modes. | "Uninitialized state, or invalid-index reads that return X (§7.4.5, Table 7-1), whose downstream effect depends on tool options such as initialization or X-propagation modes (tool-dependent)." | IEEE 1800-2023 §7.4.5 ("Reading from an unpacked array of any kind with an invalid index shall return the value specified in Table 7-1"), Table 7-1, §11.5.1 |
| C5 | S4 | debug-read-first-failure-log (`code`) | The log claims to be "in the uvm-core message format", but its summary block is bare. In uvm-core the summary is itself one message: `` `uvm_info("UVM/REPORT/SERVER", ..., UVM_NONE) ``. A real log therefore shows a `UVM_INFO @ 1000000 ns: reporter [UVM/REPORT/SERVER]` line before `--- UVM Report Summary ---`. It also prints a `** Report counts by id` block after the severity counts, because `enable_report_id_count_summary` defaults to 1. A junior matching this against a real log will see lines the example lacks. | Add the `UVM_INFO @ 1000000 ns: reporter [UVM/REPORT/SERVER]` header line before the summary, and either add a short `** Report counts by id` block or mark the summary "(abridged)". | uvm-core `src/base/uvm_report_server.svh:284` (`enable_report_id_count_summary=1`), `:983-1009` (summary built into a queue and issued with `` `uvm_info("UVM/REPORT/SERVER", ...) ``) |
| C6 | S4 | debug-assertion-failure-triage (step 5); debug-honest-verdict (way 2) | "An assertion with no `else` ... reports a simulator error" and "A failing assertion with no `else` calls `$error`" are correct, but both cite only §20.10. The default fail action is defined in the assertion clauses. | Add IEEE 1800-2023 §16.14.1 (concurrent; "If the else clause is omitted, the tool shall call $error when the assertion fails, unless $assertcontrol is used to suppress the failure"), and §16.3 for immediate assertions. | IEEE 1800-2023 §16.14.1, §16.3, §20.10 |
| C7 | S4 | debug-methodology-first-steps, debug-read-first-failure-log, debug-hang-time-not-advancing (sources) | `PH_TIMEOUT` is sourced only to `uvm_phase_hopper.svh` and F.7.3.3 (`set_timeout`). The watchdog itself is normative in IEEE 1800.2-2020 §9.8.1.5: "The run phase starts a global timeout counter thread ... If the counter expires before uvm_run_phase ends, it shall generate a fatal error". The same clause makes the default expiry implementation-specific. That supports the bank's careful wording of "default 9200 s" as a uvm-core value. | Add "IEEE 1800.2-2020 §9.8.1.5 (run-phase global timeout; fatal on expiry; default implementation-specific)" to the sources of these three items. | IEEE 1800.2-2020 §9.8.1.5, F.7.3.3; uvm-core `uvm_global_defines.svh:85`, `uvm_phase_hopper.svh:561-589` |

## Round-2 findings: verification of the fixes

| R2 # | Question | Status | Evidence checked this round |
|---|---|---|---|
| B1 (S2) | debug-waveform-protocol-hang | **Fixed, correct.** | **Snapshot A.** All VALIDs low now means "no transfer is offered in these cycles", not "nothing is pending". The answer counts AR against R with RLAST per ID, and AW and W (WLAST) against B by ID, before it looks upstream. Each AXI rule it states is in the spec:<br>- The slave must not wait for RREADY or BREADY before asserting RVALID or BVALID.<br>- BVALID comes only after WLAST.<br>- An AXI4 slave needs the AW handshake before BVALID.<br>- W data may come before AW for a while.<br>- AXI4 write data follows address order.<br>**Rest of the item.** The rubric, the new common mistake and the new follow-up (ID 0x3) agree with the answer. Snapshot B still reads correctly, and "masters always accept responses" stays labelled a design rule. | IHI0022E A3.3: "read data must always follow the address"; "a write response must always follow the last write transfer"; "the write data can appear at an interface before the write address". A3.3.1: the read and write transaction dependencies, and the AXI4 write response dependency ("must wait for AWVALID, AWREADY, WVALID, and WREADY ... before asserting BVALID"). A5.4.1: "All write data must be in the same order as the associated write addresses". Also A3.1.2 and A3.2.1. |
| B2 (S3) | debug-seed-reproduction | **Fixed, correct.** | **Plain SV.** The creation-order rule is now framed as the IEEE rule for plain SystemVerilog.<br>**uvm-core.** Each line cited was read and matches:<br>- Each component's phase process is reseeded before its phase method: `proc.srandom(uvm_create_random_seed(phase.get_type_name(), comp.get_full_name()))` in `uvm_topdown_phase.svh:125`, `uvm_bottomup_phase.svh:123` and `uvm_task_phase.svh:168`. There is no seeding check, so this is unconditional.<br>- `reseed()` is called in `uvm_component::new` (`uvm_component.svh:1780`) and in `set_item_context` (`uvm_sequence_item.svh:143`), which `start` (`uvm_sequence_base.svh:307`) and `start_item` (`:1066`) call.<br>- `uvm_object::reseed` acts only if `get_uvm_seeding()` (`uvm_object.svh:813-819`). The default coreservice returns `uvm_object::use_uvm_seeding`, initialized to 1 (`:76`; `uvm_coreservice.svh:389-390`).<br>- `uvm_create_random_seed` hashes the type and instance names with the global seed (`uvm_misc.svh:189-219`).<br>**Consequences.** Edits in the scoreboard's `build_phase` or `run_phase` cannot move other components' streams. A constructor edit advances the parent's `build_phase` process RNG (§18.14.1 object seeding). Both statements hold.<br>**Standard citations.** §5.3.3.3 and F.4.1.4.20 are quoted correctly. |
| B3 (S3) | debug-staff-regression-triage | **Fixed, correct.** | **Answer.** A run with no summary is bucketed by its crash, null-object or `$fatal` message. Only grid kills and licence or disk problems count as infrastructure.<br>**Standard.** §20.10: `$fatal` "terminates the simulation" and "results in an implicit call to $finish". §8.4: null-handle access "is illegal ... implementations may issue an error".<br>**uvm-core.** `report_summarize` is called only from `die()` (`uvm_root.svh:179`) and at the end of `run_test` (`:628`). There is no `final` block anywhere in `src/`, so a `$fatal` or a crash prints no summary. A UVM fatal goes through `die()` and does print one, which matches the answer's "Real failures with a summary ... a fatal such as `PH_TIMEOUT`". |
| B4 (S4) | debug-test-ends-at-time-zero | **Fixed.** | "UVM ends a task phase (`run_phase` or a run-time phase)". §9.6 (`uvm_task_phase`), §9.8.1.5 (`uvm_run_phase` "runs in parallel to the run-time phases") and §9.8.2 all match. |
| B5 (S4) | debug-read-first-failure-log | **Fixed.** | "Explicit timeout of 1000000 ns hit". Both fields use `%0t` (`uvm_report_server.svh:891`; `uvm_phase_hopper.svh:587-589`). "Explicit" is right because `$time` is not `` `UVM_DEFAULT_TIMEOUT `` (`:562-569`). |
| B6 (S4) | debug-tb-race-clock-edge | **Fixed.** | "§4.8 gives a related example of an order-dependent race". The source note describes the §4.8 example correctly: `assign p = q;` with a `$display` in an `initial`. |

## Checked and correct this round (no change needed)

**Bank-wide.**
- The JSON has 19 questions: 3 junior, 7 mid, 6 senior, 2 staff, 1 senior-staff.
- The bank has 0 occurrences each of "secondary", `exclude_bin` and `-xprop`.
- Every `modules` entry resolves to an MDX file under `content/curriculum/`, and its module id appears in `curriculum-spine.md`.
- Every plusarg in the bank is real:
  - In 1800.2 Annex G: `+UVM_VERBOSITY`, `+uvm_set_verbosity`, `+uvm_set_action`, `+uvm_set_severity`, `+UVM_MAX_QUIT_COUNT`, `+uvm_set_type_override` and `+UVM_TESTNAME`.
  - uvm-core only, and labelled so: `+UVM_PHASE_TRACE` (`uvm_phase.svh:726`), `+UVM_OBJECTION_TRACE` (`uvm_objection.svh:157`), `+UVM_CONFIG_DB_TRACE` (`uvm_config_db.svh:291`) and `+UVM_TIMEOUT` (`uvm_root.svh:891`). All four are documented in `uvm_cmdline_processor.svh:60-80`.
  - `+TB_DEBUG` is labelled as a user plusarg.
- No tool flag is named anywhere.

**IEEE 1800-2023.** Each cited clause exists with the stated title, and the content behind each claim was read:
- §4.7, §4.8; §6.3.1; §6.8 Table 6-7 (4-state default `'x`); §7.4.5.
- §8.4; §10.4.2; §11.4.5; §11.4.11 Table 11-20 (x where the operands differ).
- §12.4 ("has a zero value or the value is x or z"); §12.5.
- §14.13 (a skew that is not `#0` samples "at the Postponed region of the time step skew time units prior"); §14.16 (zero-skew drives go to "the Re-NBA region").
- §16.5.1, §16.9.3; §16.12 ("i.e., not sampled"); §16.12.7, §16.14.8.
- §18.14 (`$random` is not in the list; §18.14.3 example), §18.14.1, §18.14.2, §18.14.3.
- §19.5 with Syntax 19-2, §19.5.5, §19.5.6, §19.6.2, §19.6.3, §19.11.
- §20.9, §20.10, §20.11, §20.14.1; §21.6; §21.7.1.3.
- §31.3 (lists `$setuphold`, `$recovery` and `$removal`), §31.4, §31.6 ("propagate an x value at the output"); the Clause 32 title.

**IEEE 1800.2-2020.** Each cited clause was found as a heading, and its content matches the claim:
- Seeding and reporting: 5.3.3.1, 5.3.3.3; 6.5.1.2.6, 6.5.1.2.14; 6.6 (default catchers "catch all reports on all uvm_report_object reporters"); 6.6.5.
- Factory: 8.2.3.2.5, 8.3.1.4.2 ("The original type shall be a super class of the override_type"); 8.3.1.7.1, 8.3.1.7.5.
- Phases, objections and heartbeat: 9.3.1.7.1, 9.3.1.7.2, 9.6, 9.8.1.5, 9.8.2; 10.5.1.3.3, 10.5.1.5.1; 10.6 (window driven by a `uvm_event`).
- Components and sequences: 13.1.4.1.7, 13.1.7.13; 14.2.3.1, 14.2.4.2, 14.2.4.4; 15.2.1.2.1, 15.2.1.2.2 ("Returns immediately ... otherwise returns with the t set to null").
- Annexes:
  - B.1.1.1;
  - C.4.2.2.1 (`{cntxt,".",inst_name}`), C.4.2.2.2, C.4.2.3.1;
  - F.4.1.4.20, F.7.3.3, F.7.4.2;
  - G.2.2 to G.2.7 (the `time` form of G.2.3, and `<count>,<overridable>` for G.2.6).

**uvm-core behaviours re-read this round.**
- **Phase skip.** "No objections raised, skipping phase" is `PH/TRC/SKIP` at `UVM_LOW` (`uvm_phase_hopper.svh:518`), checked after one `uvm_wait_for_nba_region()` (`:487`).
- **Watchdog.**
  - The watchdog is `` `uvm_delay(top.phase_timeout) `` (`:561`).
  - The outstanding-objection dump is a `UVM_PH_TRACE` (`:579`).
  - `` `UVM_DEFAULT_TIMEOUT `` is 9200s (`uvm_global_defines.svh:85`).
- **`try_next_item`.**
  - It returns null after `m_wait_for_sequences_count` calls to `wait_for_sequences()` and no time delay (`uvm_sequencer.svh:238-310`; `uvm_sequencer_base.svh:1381`).
  - `uvm_wait_for_nba_region` is `nba <= next_nba; @(nba);` (`uvm_globals.svh:506-523`).
  - The "called twice" errors are at `uvm_sequencer.svh:224-227` and `:244-247`.
- **Unconnected `seq_item_port`.**
  - `DRVCONNECT` fires when `seq_item_port.size<1` (`uvm_driver.svh:99-102`).
  - The port's `min_size` is 0 (`uvm_tlm_imps.svh:200-203`).
  - `get_next_item` forwards to `m_if` (`uvm_tlm_defines.svh:584-587`), which is set only `if (size())` (`uvm_port_base.svh:898-901`).
- **`SEQ` fatal.** It is at `uvm_sequence_base.svh:1062`.
- **Factory override.** `TYPDUP` is issued when original equals override (`uvm_factory.svh:1113-1135`). `debug_create_by_type` exists (`:524`).
- **Config DB.**
  - The lookup matches on `uvm_resource#(T)::get_type()` and returns 0 on failure before it assigns `value` (`uvm_config_db_implementation.svh:210-226`).
  - `CFGDB/GET` and `CFGDB/SET` are issued at `:215` and `:428`, and a failed lookup prints "null (failed lookup)" (`:483`).
  - Tracing is initialized on first use (`uvm_config_db.svh:276-296`), so sets made from the top module at time 0 are traced.
- **Message macros.** `` `uvm_report_begin `` checks `get_report_verbosity_level(...) >= VERBOSITY` and `get_report_action(...) != UVM_NO_ACTION` before the message is built (`uvm_message_defines.svh:130-135`). This supports both the performance item and "a `UVM_NO_ACTION` error is never even created".
- **Verbosity settings.** Phase-form `+uvm_set_verbosity` settings with id `_ALL_` are applied at the start of the named phase, so the `build` form works (`uvm_component.svh:3712-3735`, called from the phase `traverse` functions).

**Traced examples (by hand).** Every table and key holds:
- **Log slip.** Each `act` equals the previous `exp`.
- **Race table.** A gives 03/07/09; B gives 07/09/09.
- **X-propagation.** RTL gives `a5`/`5a` and gates give `xx`/`5a`. `sel` loads at edge 4 and is sampled as 1 at edge 5. The `$isunknown` assertion fires at edges 1 to 4.
- **Assertion window.** The attempt starts at edge 2 and fails at edge 5. The sampled `ack` is first 1 at edge 6, 4 cycles after `$rose(req)`.
- **Config DB.** There are three bugs, and the order is not a bug.
- **Override.** There are two bugs, and the order is not a bug.
- **Snapshot B.** The circular wait is read correctly.

**Code legality (by inspection; nothing compiled).**
- The covergroup with `sample()` arguments, and its cross `ignore_bins` with `binsof ... intersect ... && binsof(cp_kind.atomic)`.
- The clocking block (`default input #1step output #0`) and the clocking drive.
- The reset-gated `$isunknown` property.
- The report catcher.
- The `check_phase` macros inside `if` (`` `uvm_error `` expands to `begin ... end`).
- The objection fix, the `try_next_item` idle loop, and the `$test$plusargs` guard.
