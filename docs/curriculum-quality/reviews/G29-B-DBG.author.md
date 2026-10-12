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
