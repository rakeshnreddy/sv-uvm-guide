# G29-B-DBG author log: `content/interview-questions/debug.json`

Author: G29-B-DBG. Verdict carried in: **major** (G29 analysis, confirmed by G29.verify). Scope: `content/interview-questions/debug.json` only. The bank's `id`, `topic` and `title` ("Debug & Triage Interview Question Bank") are unchanged; the description was widened to match the new coverage.

Result: 6 questions became 19 (3 junior, 7 mid, 6 senior, 2 staff, 1 senior-staff). Every question has `modules`, `follow_ups` and `common_mistakes`; 10 carry `code` (all 3 "coding" items contain code, and all 4 "waveform-debug" items show a text cycle table). No bare "(secondary)" source remains.

The bank was generated from a script kept in the scratchpad (`scratchpad/g29dbg/build_debug.py`), so the JSON escaping stays consistent. The JSON file is the deliverable.

## Findings and resolution

| ID | Sev | Question | Resolution |
|---|---|---|---|
| G29-DBG-01 | S2 | debug-coverage-hole-triage | Removed `exclude_bin`. The answer now uses `ignore_bins` (§19.5.5, crosses §19.6.2) for unreachable values and `illegal_bins` (§19.5.6, §19.6.3; a hit is a run-time error) for values that must never occur, with a covergroup in `code`. Tool exclusion and waiver files are labelled vendor-specific. A "common mistake" names the non-existent construct. |
| G29-DBG-02 | S3 | debug-x-propagation | The §4.6 citation is gone (§4.6 is "Determinism"). The answer cites §6.3.1, §6.8 Table 6-7, §11.4.5, §11.4.11, §12.4, §12.5, §16.12 and §20.9. "Questa -xprop" is replaced by "the simulator's X-propagation mode (tool-dependent)". |
| G29-DBG-03 | S2 | debug-x-propagation | Rewritten around X-optimism and X-pessimism: `if` with an x condition takes `else` (§12.4), `case` with an x selector falls to `default` (§12.5), and the conditional operator keeps X visible (§11.4.11). Added a reset-gated `$isunknown` assertion in code, a cycle table contrasting RTL and gate results, and confirmation in gate-level or X-propagation runs. Category stays "waveform-debug", now with a waveform. |
| G29-DBG-04 | S3 | debug-methodology-first-steps | Rubric and answer now agree. Added: classify how the run ended, first failure plus the warnings before it, the known-bug check, exact reproduction (same test, seed, build, tool, plusargs), visibility through plusargs (`+UVM_VERBOSITY`, `+uvm_set_verbosity`, G.2.2/G.2.3) and recording, and classifying DUT, testbench or test before fixing. |
| G29-DBG-05 | S3 | debug-waveform-protocol-hang | Re-authored around two waveform snapshots (all VALID low; a circular R/AR wait). Added reset and clock-gating checks, the driver waiting in `get_next_item()` with no sequence, the objection holder as victim, VALID dropped before READY as a protocol violation, and that AXI sets no READY timeout. "Masters always accept responses" is labelled a design rule (verify note). Cites IHI0022E A3.1.2, A3.2.1, A3.3.1. |
| G29-DBG-06 | S3 | debug-staff-regression-triage | "Mark non-reproducible failures as flaky" is gone: such failures are investigated (recipe drift, races, uninitialized state, external inputs, infrastructure), citing §18.14. Added automatic signatures (first `UVM_ERROR`/`UVM_FATAL` ID plus normalized path), infrastructure-failure separation and bisection across RTL and testbench commits. |
| G29-DBG-07 | S3 | debug-senior-staff-signoff | Numeric targets are labelled project examples. Added plan review and traceability, bug-rate trend, waiver risk review, gate-level simulation, CDC/RDC, low-power, DFT modes, performance, software/emulation bring-up, ECO re-verification and escape analysis. |
| G29-DBG-08 | S3 | 4 of 6 | Every "(secondary)" source is replaced by a named IEEE 1800-2023 or 1800.2-2020 clause, an Arm IHI0022E section, a named uvm-core 2020.3.1 file, or a labelled "Practice note (not normative)" or "Tool note". IEEE 1801 is cited as `{doc, verified: false}` without a section. |
| G29-DBG-09 | S2 | (bank) | 13 questions added covering every debug gap the analysis lists: TB race at the clock edge (waveform), config_db get failure, override not taking effect, a sequence that never runs (test ends at 0 ns), assertion-failure triage (waveform), seed reproduction, simulation profiling, gate-level debug. Also the UVM trace switches, a junior log-reading item, a time-not-advancing hang, honest verdicts and a staff debug-infrastructure design. "waveform-debug" is now used only with a cycle table. |
| Verdict edit 3 | — | all | Each checklist is tied to concrete evidence: message IDs (`PH_TIMEOUT`, `PH/TRC/SKIP`, `OBJTN_TRC`, `CFGDB/GET`, `TYPDUP`, `DRVCONNECT`, `SEQ`), trace plusargs labelled uvm-core-only, and waveform or cycle-table cues. |
| Verify: UVM-05/06 notes (applied here) | S2 | debug-hang-time-not-advancing | The new hang item separates "time stuck" (zero-delay loop; the watchdog is a delay, so it cannot fire) from "time advancing" (objection never dropped; `PH_TIMEOUT`, default 9200 s in uvm-core). It says explicitly that a failed `get` with `uvm_fatal`, a missing macro or an unknown test name is not a silent hang. |
| Verify: G29-UVM-V02 | S3 | debug-hang-time-not-advancing, follow-up | A blocking `get()` on an empty FIFO is placed in the time-advancing family. |
| Verify: SV-12 trap noted for debug | S4 | — | Not added here: `sv-randomize-failure` in `systemverilog.json` owns it. Deferred to that bank. |
| Verify: "derived-class trap" (UVM gap 3) | — | debug-override-not-taking-effect | Used as bug 2: without the macro, `err_driver::get_type()` resolves to the parent's registry; uvm-core warns `TYPDUP` (checked in `uvm_factory.svh`), labelled "by inspection, not compiled". |
| Verify: `uvm_heartbeat` as hang follow-up | — | trace-switches, protocol-hang, hang, infrastructure | Cited as §10.6 in four items. |

## Question map

"Sources verified" means each clause or section cited was found and read in the primary text this session: IEEE 1800-2023 (`t1_lrm_clean.txt`), IEEE 1800.2-2020 (`uvm_lrm.txt`), Arm IHI0022E (`l40b/axi.txt`), uvm-core 2020.3.1 files in `scratchpad/uvmcore` and `scratchpad/uvm`.

| id | level | category | modules | sources verified |
|---|---|---|---|---|
| debug-methodology-first-steps (kept) | junior | concept | E-DBG-1/effective-debug, A-UVM-6, I-UVM-1D | G.2.2, G.2.3; §18.14; uvm_phase_hopper.svh |
| debug-read-first-failure-log (new) | junior | concept (log in `code`) | E-DBG-1/effective-debug, I-UVM-1D | uvm_report_server.svh summary format; PH_TIMEOUT text; F.7.3.3, G.2.6; cmdline_processor trace plusargs |
| debug-config-db-get-failure (new) | junior | coding | I-UVM-2C, E-DBG-1 | C.4.2.2.1, C.4.2.2.2, C.4.2.3.1; F.7.4.2; +UVM_CONFIG_DB_TRACE (uvm-core) |
| debug-uvm-trace-switches (new) | mid | concept | E-DBG-1, I-UVM-1D, I-UVM-1B | §8.3.1.7.1, §8.3.1.7.5, §9.3.1.7.1, §10.5.1.5.1, §10.6, F.7.4.2, G.2.3; §21.6 |
| debug-override-not-taking-effect (new) | mid | coding | I-UVM-1B, E-DBG-1 | §8.2.3.2.5, §8.3.1.4.2, §8.3.1.7.1, §8.3.1.7.5, F.7.4.2, G.2.7; uvm_factory.svh TYPDUP |
| debug-test-ends-at-time-zero (new) | mid | concept | I-UVM-1C, I-UVM-3A, E-DBG-1/hang-lab | §9.3.1.7.2, §10.5.1.3.3, §14.2.3.1, §14.2.4.2, §14.2.4.4, §13.1.4.1.7; PH/TRC/SKIP; SEQ fatal; DRVCONNECT |
| debug-waveform-protocol-hang (kept) | mid | waveform-debug | B-AXI-1, B-AXI-5, E-DBG-1/hang-lab | IHI0022E A3.1.2, A3.2.1, A3.3.1; §10.5.1.5.1, §10.6; OBJTN_TRC |
| debug-x-propagation (kept) | mid | waveform-debug | F2C/flow-control, F2A, A-UVM-9 | §6.3.1, §6.8 Table 6-7, §11.4.5, §11.4.11, §12.4, §12.5, §16.12, §20.9 |
| debug-tb-race-clock-edge (new) | mid | waveform-debug | F3C, F4C | §4.7, §4.8, §10.4.2, §14.13, §14.16 |
| debug-assertion-failure-triage (new) | mid | waveform-debug | I-SV-4A, I-SV-4A/immediate-vs-concurrent, E-DBG-1 | §16.5.1, §16.9.3, §16.12, §16.12.7, §16.14.8, §20.10, §20.11 |
| debug-seed-reproduction (new) | senior | concept | E-DBG-1/effective-debug, I-SV-2B/controlling-randomization | §18.14, §18.14.1, §18.14.3, §4.7, §20.14.1; 1800.2 §5.3.3.1, §5.3.3.3 |
| debug-hang-time-not-advancing (new) | senior | coding | E-DBG-1/hang-lab, I-UVM-3B/sequencer-driver-handshake, I-UVM-1C | §15.2.1.2.1, §15.2.1.2.2, F.7.3.3, §10.6; uvm_phase_hopper.svh watchdog; UVM_DEFAULT_TIMEOUT 9200s; uvm_sequencer.svh try_next_item; uvm_wait_for_nba_region |
| debug-honest-verdict (new) | senior | concept | E-DBG-1, I-UVM-1D, A-UVM-6 | §6.6, §6.6.5, §6.5.1.2.14, §6.5.1.2.6, G.2.4, G.2.5, §13.1.4.1.7; §20.10, §20.11; message-macro guard (uvm-core, as cited by the E-DBG-1 lesson) |
| debug-simulation-performance (new) | senior | concept | E-PERF-1, E-DBG-1 | B.1.1.1, §13.1.7.13, C.4.2.2.2; uvm_message_defines.svh (as cited by E-PERF-1) |
| debug-gate-level-x-and-timing (new) | senior | concept | F2A, F4C, A-UVM-9 | §12.4, §12.5, §14.13, §31.3, §31.4, §31.6, Clause 32 title |
| debug-coverage-hole-triage (kept) | senior | verification-plan | I-SV-3B/closure-workflow, I-SV-3A/coverage-options | §19.5.5, §19.5.6, §19.6.2, §19.6.3, §19.11 |
| debug-staff-regression-triage (kept) | staff | staff-system-design | E-DBG-1/effective-debug, E-DBG-1 | §18.14; §6.5.1.2.6, G.2.6 |
| debug-staff-debug-infrastructure (new) | staff | staff-system-design | E-DBG-1, E-DBG-1/hang-lab, E-PERF-1 | §10.6, §13.1.7.13, §6.6, G.2.3, G.2.6; §21.7.1.3, §18.14 |
| debug-senior-staff-signoff (kept) | senior-staff | staff-system-design | E-SOC-1, I-SV-3B/linking-coverage, E-INT-1, E-PWR-1 | Clause 19, §19.5.5; IEEE 1801 marked `verified: false` |

All module refs resolve (`tests/app/interview-prep-banks.test.ts` "resolves every modules entry").

## Ids removed or renamed

None. All six original ids are kept, so `INTERVIEW_QUESTION_LESSONS` stays valid. Thirteen ids are new; each carries `modules`, so it needs no map entry.

## Deferred items

| Item | Reason |
|---|---|
| A `debug` category for log-based items, and `predict-output` | `tests/interview-questions/bank-schema.test.ts` allows only the six original categories (the loader already labels both). Log-based items use "concept" with the log in `code` until the lead extends the test. |
| WaveDrom `waveform` fields | The schema has no `waveform` field (the loader drops it). Waveforms are text cycle tables in `code`, as the brief asks. |
| Links to visualizers (`TestbenchDriveComparison`, the hang-lab DebuggingSimulator, `TelemetryEventBusVisualizer`, `UvmPhaseTimelineVisualizer`) | No `visual` field exists (verify gap 7). The lessons named in `modules` host these visualizers. |
| `assert(obj.randomize())` trap | Owned by `sv-randomize-failure` in `systemverilog.json` (SV-12). |
| Compile-checking the code snippets | No simulator in this session. The snippets are marked `// snippet` where partial. The uvm-core behaviours (TYPDUP, DRVCONNECT, `try_next_item` waiting only for an NBA region) were checked by reading the uvm-core 2020.3.1 source, not by running it. |

## Requests for the lead

1. **Categories.** Add `debug` and `predict-output` to `VALID_CATEGORIES` in `tests/interview-questions/bank-schema.test.ts` (G29 Request 2). Then recategorize `debug-read-first-failure-log`, `debug-test-ends-at-time-zero` and `debug-honest-verdict` as `debug`.
2. **Practice map.** Optionally align the six `debug-*` entries in `src/lib/practice-links.ts` `INTERVIEW_QUESTION_LESSONS` with the new `modules` (modules already take precedence). For example, `debug-x-propagation` now leads with `F2C_Procedural_Code_and_Flow_Control/flow-control`, and `debug-methodology-first-steps` with `E-DBG-1_.../effective-debug`.
3. **Schema.** Add `visual?: {component, props}` (verify gap 7), so items can link `TestbenchDriveComparison` (tb-race), the hang-lab simulator (both hang items) and `TelemetryEventBusVisualizer` (honest-verdict).
4. **Lesson links.** E-DBG-1's three pages, F3C, F4C, I-UVM-2C and E-PERF-1 could link their Push Further "Interview angles" to this bank's anchor (`/interview-prep#debug--triage-interview-question-bank`, per `headingSlug`: the `&` is dropped and both spaces become hyphens).
5. **Citation lint.** Add `exclude_bin`, "§4.6 (X semantics)" and "-xprop" to the known-wrong phrase list (G29 Request 3); this bank no longer contains them.

## Validation

- `python3 -c "import json;json.load(open('content/interview-questions/debug.json'))"`: passes.
- `NODE_OPTIONS='--require @prisma/client' npx vitest run tests/interview-questions tests/app/interview-prep-banks.test.ts tests/qa/scheduling-semantics-lint.spec.ts tests/amba-flashcards.spec.ts`: 4 files, 543 tests, all pass.

## Fix round 1

Scope: `content/interview-questions/debug.json` only. The bank `id`, `topic`, `title`, all 19 question ids and the field order are unchanged. The edits were applied by a script that matches each old string exactly once (`scratchpad/g29dbg_fix1/fix1.py`, with the pre-edit copy beside it). Every behaviour below was re-read in uvm-core 2020.3.1 (`~/Downloads/1800.2-2020.3.1/src`), IEEE 1800-2023 (`t1_lrm_clean.txt`) or IEEE 1800.2-2020 (`uvm_lrm.txt`) in this round.

| Sev | Question | Finding | Resolution |
|---|---|---|---|
| S2 | debug-test-ends-at-time-zero | An unconnected `seq_item_port` was said to block the sequence until `PH_TIMEOUT`. | Rewritten. The port's `min_size` is 0, so there is no connection error. uvm-core warns `DRVCONNECT` at end of elaboration. `get_next_item` forwards to `m_if`, which is set only when `size() > 0`, so the driver's first call goes through a null handle. That is illegal (IEEE 1800-2023 §8.4, verified), and the run normally stops with a null-object error in the driver (message tool-dependent) while the sequence still waits in `start_item`. The answer names `DRVCONNECT` as the lead. The rubric now lists the evidence for each cause, and a new common mistake covers expecting a timeout. Sources added: §8.4; `uvm_sqr_connections.svh:56-59`, `uvm_tlm_imps.svh:200-203`, `uvm_tlm_defines.svh:584-587`, `uvm_port_base.svh:455-461, 898-901`, `uvm_driver.svh:99-102`. |
| S4 | debug-test-ends-at-time-zero | A missing `item_done` hits a uvm-core error; it is not a silent block. | The bullet now gives the sequencer's `UVM_ERROR` as the evidence. In `get_next_item` (`uvm_sequencer.svh:224-227`) the message is "Get_next_item called twice without item_done or get in between", and `try_next_item` has its own version (244-247). The bullet also says the driver gets the same item back (`m_safe_select_item` peeks it again). Note: the finding quoted the `try_next_item` text. The `get_next_item` path reports and continues; it does not return. |
| S3 | debug-read-first-failure-log | "One lost item at index 4" contradicts the log, where each `act` equals the previous `exp`. | Changed to "One extra item in the actual stream at index 4 (or, seen the other way, one item missing from the expected stream)". This matches the underflow explanation, and the rubric says the same. The `PH_TIMEOUT` sentence now also covers run-time phases. |
| S3 | debug-seed-reproduction | Puzzle 2 said every seed's stimulus changes. | Rewritten around §18.14.1 thread and object stability (verified). The stimulus moves only when the edit creates objects or threads, or draws random numbers, in a thread that later creates or seeds the stimulus: a constructor or `build_phase`, or a thread forked before the stimulus starts. A clone or `$urandom` inside the scoreboard's `run_phase` loop does not move it. The answer then says where to look when the stimulus is unchanged. Added a uvm-core note: UVM seeding is on by default, and components (at construction) and sequences and items (at `start`/`start_item`, via `set_item_context`) are reseeded from their names (`uvm_object.svh`, `uvm_component.svh:1780`, `uvm_sequence_item.svh`; 1800.2 §5.3.3.3, verified). The rubric was updated and a common mistake added. |
| S3 | debug-simulation-performance | The claim that uvm-core's `uvm_info` tests `uvm_report_enabled` first was wrong. | Now: the macro opens with the `` `uvm_report_begin `` guard, which checks the verbosity and the action through `get_report_verbosity_level` and `get_report_action` before the message is evaluated (`uvm_message_defines.svh:130-158`, verified; 1800.2 B.1.1.1). |
| S4 | debug-override-not-taking-effect | "changes nothing" | Now: it warns `TYPDUP`, then still records a `bus_driver` to `bus_driver` override, which has no effect (`uvm_factory.svh:1113-1185`; the lookup at 1785-1880 returns the requested type with no `OVRDLOOP`). This is consistent with the factory-print evidence the answer already gives. |
| S4 | debug-x-propagation | With a = 8'h11 and b = 8'h22, the gate output under an X select is 8'b00xx_00xx, not xx. | The inputs are now 8'h5A and 8'hA5, which differ in every bit. The table now reads `a5`/`5a` (RTL) and `xx`/`5a` (gates). The answer says a mux cell outputs X on every bit where its data inputs differ (consistent with §11.4.11, Table 11-20, verified). |
| S4 | debug-methodology-first-steps | `PH_TIMEOUT` was tied only to `run_phase`. | Now "held `run_phase`, or a run-time phase such as `main_phase`, open". The same fix was applied in debug-read-first-failure-log. |
| S4 | debug-assertion-failure-triage | Follow-up 2 had reset "deasserted" mid-attempt. | Now: "reset is asserted (`rst_n` low) at edge 3, during the attempt that started at edge 2". |
| S4 | debug-hang-time-not-advancing | Optional iteration-limit note. | Added to the "Time stuck" bullet as a labelled tool note: some simulators stop such a loop with an iteration-limit error, which is tool-dependent, so a missing error proves nothing. No tool or flag is named. The tool-note source was widened, and the `uvm_globals.svh:506-523` source now says the NBA wait has no time delay. |
| S4 | debug-coverage-hole-triage | The planned lint phrase would flag three correct negations. | Resolved in content, so no allowlist is needed. The literal wrong token no longer appears anywhere in the bank (`grep -c` gives 0). The lesson is kept: the rubric, the answer and the common mistake say that the language has no other exclusion keyword, because `bins_keyword` is `bins`, `illegal_bins` or `ignore_bins` (IEEE 1800-2023 §19.5, Syntax 19-2, verified; added to sources). |

No bare "(secondary)" source exists (`grep -c secondary` gives 0). No new clause number was cited without being read in the source text this round.

### Ids removed or renamed (fix round 1)

None.

### Requests for the lead (fix round 1)

1. Request 5 from round 0 now holds: `debug.json` contains no `exclude_bin`, so the phrase can go into the known-wrong list without an allowlist for this bank. If the lint is meant to catch real uses, it should still tolerate negated mentions in other banks.
2. Optional: `INTERVIEW_QUESTION_LESSONS` needs no change. All ids survive, and every question carries `modules`.

### Validation (fix round 1)

- `python3 -c "import json;json.load(open('content/interview-questions/debug.json'))"`: passes.
- `NODE_OPTIONS='--require @prisma/client' npx vitest run tests/interview-questions tests/app/interview-prep-banks.test.ts tests/qa/scheduling-semantics-lint.spec.ts tests/amba-flashcards.spec.ts`: 4 files, 863 tests, all pass.

## Fix round 2

Scope: `content/interview-questions/debug.json` only, against `G29-B-DBG.accuracy.r2.md` (B1 to B6: 1 S2, 2 S3, 3 S4). The bank `id`, `topic`, `title`, all 19 question ids and the field order are unchanged. The edits were applied by a script that matches each old string exactly once (`scratchpad/g29dbg_fix2.py`, pre-edit copy `scratchpad/debug.before-fix2.json`), plus two small follow-up replacements made the same way. Every claim below was re-read this round in Arm IHI0022E (`arm_axi.txt`), IEEE 1800-2023 (`t1_lrm_clean.txt`), IEEE 1800.2-2020 (`uvm_lrm.txt`) or uvm-core 2020.3.1 (`~/Downloads/1800.2-2020.3.1/src`).

| # | Sev | Question | Resolution |
|---|---|---|---|
| B1 | S2 | debug-waveform-protocol-hang (snapshot A) | Rewritten. All VALIDs low now means "no transfer is offered in these cycles", not "nothing is pending". The answer first counts handshakes in the monitor's outstanding table or the protocol checker (or from the waveform): AR against R with RLAST, per ID (ARID/RID); AW and W bursts (WLAST) against B, matching AW and B by ID. It notes that AXI4 W carries no ID and write data follows address order (A5.4.1, verified). If anything is outstanding, the stall is in that transaction: a lost or withheld R or B (the slave must not wait for RREADY/BREADY before RVALID/BVALID, and BVALID comes only after the last W transfer, A3.3.1, verified; read data follows its address, A3.3, verified), or a master that never finished the write (an accepted AW with no W data, or W with no AW, which an AXI4 slave needs before BVALID, A3.3.1 AXI4 write response dependency, verified). Reset and clock, stimulus and the objection holder are checked only when nothing is outstanding. The rubric says the same, and its weak-answer line now includes "calls snapshot A an idle bus without checking for outstanding transactions". The common mistake "assuming every VALID low means nothing is pending" replaces the old reset-only line, which is kept in a narrower form. A follow-up on an AR with ID 0x3 that never got a response was added. Sources: A3.3.1 expanded, A3.3 and A5.4.1 added. |
| B2 | S3 | debug-seed-reproduction (puzzle 2) | Restructured into three bullets. (1) The creation-order mechanism is presented as the IEEE 1800-2023 rule (§18.14.1, verified) for plain SystemVerilog and for objects UVM does not reseed. (2) uvm-core: before each component's phase method, the phase process is reseeded from the phase type name and the component's full name, unconditionally (`uvm_topdown_phase.svh:125`, `uvm_bottomup_phase.svh:123`, `uvm_task_phase.svh:168`, verified; no `get_uvm_seeding` check). While UVM seeding is on, components also reseed in their constructor (`uvm_component.svh:1780`), and sequences and items reseed at `start`/`start_item` (`uvm_sequence_item.svh:143`, called from `uvm_sequence_base.svh:307, 1066`, verified). So an edit in the scoreboard's `build_phase` or `run_phase`, a fork included, cannot move another component's stimulus, and an extra component reseeds itself. Only a constructor edit can shift objects or `$urandom` draws later in the parent's `build_phase`, for example a randomized config object. (3) In a UVM bench, compare the stimulus logs first: usually the cause is the rebuild, a race (§4.7) or the edit's own behaviour. The rubric is qualified the same way, and "so creation order changes" is gone. Added a follow-up (an edit in the constructor) and a common mistake (applying the plain-SV rule to a UVM bench). Sources: phase-file lines and `uvm_misc.svh:189-219` (`uvm_create_random_seed`) added. `uvm_object.svh` is now cited as :76 (`use_uvm_seeding = 1`) and :813-819 (the `reseed` body; the review's 813-818 stops one line short of `endfunction`). 1800.2 F.4.1.4.20 (`get_global_seed`: seeds "objects and/or processes", value implementation specific, verified) added. |
| B3 | S3 | debug-staff-regression-triage (step 1, step 2, rubric) | "No report summary" no longer means infrastructure. The answer now reads the log tail first. A crash, a SystemVerilog `$fatal` (for example from an assertion action block) or a null-object error (typically fatal in simulators) is a real failure, bucketed by that message (§20.10: `$fatal` terminates the simulation; §8.4: null-handle access is illegal and implementations may issue an error; both verified). Only grid kills (a time or memory limit) and licence or disk problems are infrastructure: they are rerun and counted outside the bug count. Step 2's signature rule now covers runs with no summary. The rubric and its weak-answer line were updated, and a common mistake was added. Sources: §20.10, §8.4, `uvm_report_server.svh:972-1010` (`m_report_summarize`), and `uvm_root.svh:179, 628`. The summary is printed only from `die()` and at the end of `run_test`, and uvm-core has no `final` block, so a `$fatal` or a crash prints none (verified). |
| B4 | S4 | debug-test-ends-at-time-zero | Now: "UVM ends a task phase (`run_phase` or a run-time phase) when its objection count is zero". Source added: IEEE 1800.2-2020 §9.6, §9.8.1.5 (`uvm_run_phase` runs in parallel to the run-time phases), §9.8.2 (all verified). |
| B5 | S4 | debug-read-first-failure-log (`code`) | Now "Explicit timeout of 1000000 ns hit". Both fields use `%0t` under the same `$timeformat` (`uvm_report_server.svh:891`, `uvm_phase_hopper.svh:587-589`, verified). |
| B6 | S4 | debug-tb-race-clock-edge | Model answer: "§4.8 gives a related example of an order-dependent race". Rubric: "(IEEE 1800-2023 §4.7; §4.8 gives a related example)". The source note now says that §4.8's example is a continuous assignment interleaved with a `$display` (verified). |

Bank-wide re-checks: `grep -c secondary` and `grep -c exclude_bin` both give 0. Every `modules` entry still resolves to an MDX file under `content/curriculum/`. The bank still has 19 questions (3 junior, 7 mid, 6 senior, 2 staff, 1 senior-staff), and every question keeps `modules`, `follow_ups` and `common_mistakes`. No clause number was added without being read in the source text this round, and no tool flag or plusarg was added.

### Ids removed or renamed (fix round 2)

None.

### Requests for the lead (fix round 2)

1. None required. `INTERVIEW_QUESTION_LESSONS` needs no change, because every id survives.

### Validation (fix round 2)

- `python3 -c "import json;json.load(open('content/interview-questions/debug.json'))"`: passes.
- `NODE_OPTIONS='--require @prisma/client' npx vitest run tests/interview-questions tests/app/interview-prep-banks.test.ts tests/qa/scheduling-semantics-lint.spec.ts tests/amba-flashcards.spec.ts`: 4 files, 873 tests, all pass.
