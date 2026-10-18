# G29-B-UVM author log: `content/interview-questions/uvm.json`

Author: G29-B-UVM. Date: 2026-10-11. Verdict: **rewrite**. The bank went from 10 to 30 questions, and every answer was rewritten from scratch.

The bank's top-level `id` (`uvm-interview-bank`), `topic` (`uvm`) and `title` ("UVM Interview Question Bank") are unchanged. Only `description` was rewritten. All 10 original question ids survive. 20 ids are new.

**Inputs read:**
- `docs/curriculum-quality/README.md`;
- `analysis/G29.md` (the `uvm.json` section, Coverage gaps, Requests for the lead);
- `analysis/G29.verify.md` (adjustments, missed issues, notes for the implementation author);
- `curriculum-spine.md` (UVM intent cards, §5.7, Appendix A);
- `src/types/interview-question.ts`, `src/app/(learning)/interview-prep/interview-banks.ts` and `page.tsx`.

**How I verified.**
- IEEE 1800.2-2020: every clause number in `sources` was checked against the LRM text (`scratchpad/audit/uvm_lrm.txt`), by heading and signature.
- uvm-core 2020.3.1: implementation behaviour was checked in the uvm-core sources already in the scratchpad, collected into `scratchpad/g29b/src/`. It is cited as "uvm-core 2020.3.1 (`file.svh`)" and described as implementation behaviour in the answer text.
- IEEE 1800-2023: clauses are taken only from the verified index in spine Appendix A.
- Unverified: four external documents (SCE-MI, IEEE 1666, cocotb, pyuvm, UVM-ML/UVM Connect) are cited as `{doc, verified: false}`.
- Code: the SystemVerilog was checked by reading only. No simulator was available, so none of it was compiled (see Requests).

The generator is `scratchpad/g29b/build_uvm_bank.py`. It writes the JSON with 2-space indentation and orders the questions by level, keeping authoring order inside a level.

## Findings and resolutions

| Finding | Sev (after verify) | Question | Resolution |
|---|---|---|---|
| G29-UVM-01 analysis port "receives a copy" | S1 | `uvm-tlm-analysis-port` | Fixed. `write()` passes the same handle to every subscriber. The prompt now shows a monitor that reuses one object; the fix creates an item per transaction, and subscribers that store or modify an item clone it. Also covered: zero subscribers is legal, no flow control, the analysis FIFO is unbounded, put/get ports need one connection. |
| G29-UVM-02 drain time as a "safety net"; "infinite hang" | S1 | `uvm-objection-mechanism` (also `uvm-end-of-test-drain`, `uvm-phase-concurrency-trap`) | Fixed. A missing drop ends in a PH_TIMEOUT fatal at `UVM_DEFAULT_TIMEOUT` (9200 s), set with `set_timeout()` (F.7.3.3) or `+UVM_TIMEOUT` (uvm-core). Drain time starts only after the count reaches zero (§10.5.1.3.7). |
| G29-UVM-03 no-raise skips the phase; who raises | S2 | `uvm-objection-mechanism` | Fixed. After one NBA region with no objection the phase is skipped ("No objections raised, skipping phase", visible with `+UVM_PHASE_TRACE`), so the test passes at time 0. Raise in the test or the top sequence; a raise after a delay is too late. |
| G29-UVM-04 DMA roles reversed; auto-predict only | S1 | `uvm-staff-env-architecture` | Fixed. The testbench has an APB **master** agent with an adapter and an explicit predictor (auto-predict off), and an AXI **slave responder** with a memory model and READY, latency and error knobs. Hardware-updated fields are volatile or predicted; W1C bits use the W1C policy. Also added: an interrupt monitor, an address-keyed memory-image scoreboard, error responses (IHI0022E §A3.4.4), coverage, end-of-test accounting and SoC passive reuse. |
| G29-UVM-05 hang steps 5 and 6 wrong | S2 | `uvm-staff-debug-hanging-sim` | Fixed. Messages print when issued; a failed config get returns 0; an unregistered name gives BDTYP (a warning) and null; a missing macro is normally a compile error; an unknown test is INVTST (fatal). None is a silent hang. |
| G29-UVM-06 hang: time-stuck vs time-advancing | S3 (verifier) | `uvm-staff-debug-hanging-sim` | Fixed. The answer branches on whether time advances. Time stuck: zero-delay loops (including a `try_next_item` spin), RTL combinational loops; the watchdog is a `#delay` and cannot fire; dump process stacks (tool-dependent). Time advancing: `+UVM_OBJECTION_TRACE`, and the phase trace lists outstanding objections at timeout. The prompt now carries a cycle table and logs for both cases, so it is a real waveform-debug item. Level moved from staff to senior, as the analyst suggested. |
| G29-UVM-07 wrong 1800.2 citations everywhere | S2 | all | Fixed. All sources were replaced with clause numbers verified in the LRM text, plus uvm-core file names for implementation behaviour. The "Accellera UVM debug guide" and the "§2"/"§3"/"§5"/"§7"/"§9.2"/"§12" citations are gone. Per the verifier's clause-map caution, `uvm_tlm_fifo` is cited as §12.2.8.2, checked in the LRM, not the annotation's 18.2.8.2. |
| G29-UVM-08 config_db precedence; type match; tracing | S3 | `uvm-config-db-vs-resource-db` | Fixed. During build, the higher context wins and same-level sets are last-wins; after build, last wins everywhere (quoted from the uvm-core `set()` doc). The prompt includes a test-versus-env example whose answer is 50. Added failure causes (type, path, wildcard, name, timing), the silent return value, `+UVM_CONFIG_DB_TRACE`, `print_config`/`check_config_usage`. |
| G29-UVM-09 virtual sequencer has no code or `p_sequencer` | S3 | `uvm-virtual-sequencer` | Fixed. Full code: a virtual sequencer, the handles assigned in connect, `uvm_declare_p_sequencer` (DCLPSQ), children started with `this` as parent, fork/join; plus the `start(null)` alternative and when to pick it. |
| G29-UVM-10 sequence answer thin | S3 | `uvm-sequence-vs-sequence-item`; new `uvm-driver-sequencer-handshake` | Fixed. When `start_item` and `finish_item` return, late randomization, FIFO default, the `get()` shortcut. The driver side, responses, `set_id_info`, queue depth 8 and the overflow error moved to a new coding question. `lock`/`grab` moved to the new arbitration question. |
| G29-UVM-11 factory answer thin | S3 | `uvm-factory-purpose`; new `uvm-override-not-taking-effect` | Fixed. Override timing, instance-before-type, chaining, FCTTYP, `factory.print()`, the relative and absolute inst paths, `+uvm_set_type_override`. |
| G29-UVM-12 "sub-phases" wording | S4 | `uvm-phase-concurrency-trap` | Fixed. Now "run-time phases (in parallel with run_phase)". The prompt adds a code trap (stimulus in `main_phase`, objection only in `run_phase`) with a predicted outcome and the advice not to split stimulus across both. |
| G29-UVM-13 emulation answer: no HDL/HVL split; "95%"; `+UVM_TESTNAME` confusion | S3 | `uvm-senior-staff-methodology` | Fixed. The answer is rewritten around the HDL/HVL split (synthesizable transactors, untimed proxies, SCE-MI-style transaction links, labelled unverified and vendor-specific). The 95% figure is gone, and test selection is no longer confused with choosing the execution target. |
| G29-UVM-14 bank too small; missing topics | S2 | bank | Fixed. 30 questions: junior 7, mid 8, senior 9, staff 4, senior-staff 2. Every gap topic the analysis assigned to `uvm` is covered (see Coverage gaps). |
| G29-UVM-V01 "hangs" in the phase-concurrency answer | S3 | `uvm-phase-concurrency-trap` | Fixed. PH_TIMEOUT at the run-phase timeout; the watchdog also catches a hung `main_phase`. |
| G29-UVM-V02 blocked `get()` on an empty FIFO listed under "time 0" | S3 | `uvm-staff-debug-hanging-sim` | Fixed. It is listed under "time advances", next to the objection trace and PH_TIMEOUT. |
| Verify note: BDTYP is a warning | — | hang, factory | Applied. |
| Verify note: `uvm_tlm_fifo` default size 1; only the analysis FIFO is unbounded | — | `uvm-tlm1-ports-exports-imps` | Applied. |
| Verify note: watchdog is in the run-phase branch; a hung `main_phase` still trips it | — | phase-concurrency, objection | Applied. |
| Verify gap: derived-class trap (missing utils macro in a subclass) | — | `uvm-override-not-taking-effect` | Added. Labelled as following from the uvm-core macro expansion (TYPDUP), not from the standard. |
| Verify gap: `uvm_event`, `uvm_barrier`, `uvm_heartbeat` | — | `uvm-event-barrier-pool`; hang follow-up | Added (§10.1.2, §10.1.1.2.4/5, §10.3, §10.6). |
| Verify gap: command-line overrides | — | `uvm-factory-purpose`, override question | Added (G.2.7). |
| Verify gap: TLM2 sockets and generic payload | — | `uvm-multi-language-strategy` | Covered at the language boundary (§12.3, §12.3.4.2, §12.3.5). A standalone TLM2 question is deferred. |
| Verify gap: I-SV-9 and I-UVM-5 had no question | — | `uvm-why-uvm`, `uvm-event-barrier-pool` | Added. |
| Verify visuals note: link `AnalysisBroadcastVisualizer` from the analysis-port item | — | — | Deferred. The bank schema has no visual field (lead request 3). The item's `modules` link I-UVM-2B, which hosts the visualizer. |
| Navigation S2 (banks unreachable) | S2 | — | Already resolved by the lead's `/interview-prep` page. Every question carries `modules`, so its "Learn it in" links resolve. |

## Question map

All `modules` refs resolve to existing lessons (checked against `content/curriculum/` and `src/lib/curriculum-data.tsx`). Every IEEE 1800.2-2020 clause listed was found in the LRM text. Every IEEE 1800-2023 clause is in spine Appendix A. uvm-core references were read in the 2020.3.1 sources.

| id | level | category | modules | sources verified |
|---|---|---|---|---|
| `uvm-why-uvm` (new) | junior | concept | I-SV-9/index | yes (1800.2 front matter, clause families) |
| `uvm-object-vs-component` (new) | junior | concept | I-UVM-1A/index | yes |
| `uvm-factory-purpose` | junior | concept | I-UVM-1B/index, I-UVM-1A/index | yes |
| `uvm-phase-order` (new) | junior | concept | I-UVM-1C/index, I-UVM-1A/index | yes |
| `uvm-objection-mechanism` | junior | concept | I-UVM-1C/index, I-UVM-3A/index | yes |
| `uvm-agent-active-passive` (new) | junior | concept | I-UVM-2A/index, A-UVM-7/index | yes |
| `uvm-reporting-verbosity` (new) | junior | concept | I-UVM-1D/index, E-DBG-1/index | yes |
| `uvm-sequence-vs-sequence-item` | mid | concept | I-UVM-3A/index, I-UVM-3B/sequencer-driver-handshake | yes |
| `uvm-driver-sequencer-handshake` (new) | mid | coding | I-UVM-3B/sequencer-driver-handshake, I-UVM-3A/index | yes |
| `uvm-tlm-analysis-port` | mid | concept | I-UVM-2B/index, I-UVM-2A/index | yes |
| `uvm-tlm1-ports-exports-imps` (new) | mid | coding | I-UVM-2B/index, A-UVM-6/index | yes |
| `uvm-config-db-vs-resource-db` | mid | concept | I-UVM-2C/index | yes |
| `uvm-field-macros-vs-do-methods` (new) | mid | coding | I-UVM-4/index, I-UVM-1A/index | yes |
| `uvm-override-not-taking-effect` (new) | mid | trick | I-UVM-1B/index, A-UVM-9/index | yes |
| `uvm-event-barrier-pool` (new) | mid | concept | I-UVM-5/index, I-UVM-1C/index, A-UVM-8/index | yes |
| `uvm-phase-concurrency-trap` | senior | trick | I-UVM-1C/index | yes |
| `uvm-virtual-sequencer` | senior | coding | I-UVM-3B/virtual-sequences, I-UVM-3B/uvm-virtual-sequencer, A-UVM-8/index | yes |
| `uvm-staff-debug-hanging-sim` (level staff → senior) | senior | waveform-debug | E-DBG-1/hang-lab, I-UVM-1C/index, E-DBG-1/index | yes |
| `uvm-ral-mirror-prediction` (new) | senior | concept | A-UVM-4A/index, A-UVM-4B/explicit-vs-implicit, A-UVM-4B/frontdoor-vs-backdoor | yes |
| `uvm-sequence-arbitration-lock-grab` (new) | senior | concept | I-UVM-3B/sequence-arbitration, I-UVM-3B/interrupt-handling | yes |
| `uvm-callbacks-vs-factory` (new) | senior | concept | A-UVM-5/index, A-UVM-9/index | yes |
| `uvm-scoreboard-architecture` (new) | senior | verification-plan | A-UVM-6/index, I-UVM-2B/index | yes |
| `uvm-end-of-test-drain` (new) | senior | coding | I-UVM-1C/index, A-UVM-6/index, I-UVM-3A/index | yes |
| `uvm-mid-test-reset` (new) | senior | verification-plan | A-UVM-9/index, A-UVM-6/index | yes |
| `uvm-staff-env-architecture` | staff | staff-system-design | A-UVM-8/index, A-UVM-4A/index, A-UVM-4B/explicit-vs-implicit, I-UVM-3B/interrupt-handling, A-UVM-6/index | yes (plus IHI0022E §A3.4.4, spine Appendix A) |
| `uvm-vip-architecture` (new) | staff | staff-system-design | A-UVM-7/index, A-UVM-5/index, A-UVM-8/index | yes |
| `uvm-performance-hotspots` (new) | staff | staff-system-design | E-PERF-1/index, I-UVM-6/index | yes (cost claims labelled as implementation- and tool-specific) |
| `uvm-phase-jumping-domains` (new) | staff | trick | I-UVM-1C/index, A-UVM-9/index, E-CUST-1/index | yes |
| `uvm-senior-staff-methodology` | senior-staff | staff-system-design | E-EMU-1/index, E-PERF-1/index, A-UVM-7/index | partly: SCE-MI is `verified: false`; IEEE clauses verified |
| `uvm-multi-language-strategy` (new) | senior-staff | staff-system-design | E-UVM-ML-1/index, E-PYUVM-1/index, I-SV-7/index | partly: IEEE 1666, cocotb, pyuvm, UVM-ML/UVM Connect are `verified: false`; IEEE clauses verified |

Module folder names are abbreviated in this table. The JSON uses the full `<ModuleFolder>/<lesson>` refs, for example `I-UVM-1B_The_UVM_Factory/index`.

**Every question has:**
- `modules`, `rubric` (what separates a strong answer from a weak one), `follow_ups` (3–4) and `common_mistakes` (3–4);
- code in every `coding` item;
- a text cycle table in `code` for the `waveform-debug` item;
- code or a predicted trace in most concept and trick items.

## Implementation-behaviour claims (labelled in the answers)

These come from uvm-core 2020.3.1, not from IEEE 1800.2-2020, and the answers say so:
- **Run control:** the PH_TIMEOUT watchdog and the 9200 s default; `+UVM_TIMEOUT`, `+UVM_OBJECTION_TRACE`, `+UVM_PHASE_TRACE`, `+UVM_CONFIG_DB_TRACE`.
- **Message IDs:** ILLCRT, ILLCLN, BDTYP (a warning), TYPDUP, FCTTYP, DCLPSQ, SQRBADITMDN, CBUNREG, INVTST, RNTST, and the "called twice" error.
- **Defaults and limits:** response queue depth 8; quit count 0 means no limit; the comparer reports at UVM_INFO; 20 ready-to-end iterations; objection propagation on by default; `recording_detail` UVM_NONE.
- **Internal mechanics:**
  - `uvm_agent::build_phase` reads `is_active`.
  - `stop_sequences` flushes the request FIFO, so a later `item_done` fatals with SQRBADITMDN.
  - Locks are removed when a sequence exits.
  - `set_domain` recurses over the children that exist at the time of the call.
  - `uvm_pool::get` creates missing entries.

## ids removed or renamed

None. All 10 original ids are kept. `uvm-staff-debug-hanging-sim` keeps its id but its level changed from staff to senior; the id still contains "staff".

## Coverage gaps from the analysis assigned to `uvm`

| Gap | Covered by |
|---|---|
| uvm_object vs uvm_component | `uvm-object-vs-component` |
| Hierarchy, roles, active/passive | `uvm-agent-active-passive` |
| Phase order, function vs task, top-down/bottom-up | `uvm-phase-order` |
| Reporting, verbosity, actions, catcher | `uvm-reporting-verbosity`, `uvm-mid-test-reset` (catcher) |
| Driver–sequencer handshake, responses, `set_id_info` | `uvm-driver-sequencer-handshake` |
| TLM 1 ports/exports/imps, FIFOs, `uvm_analysis_imp_decl` | `uvm-tlm1-ports-exports-imps` |
| Field macros vs `do_*`, copy vs clone | `uvm-field-macros-vs-do-methods` |
| Arbitration, priority, lock/grab | `uvm-sequence-arbitration-lock-grab` |
| Layered sequences | Follow-up only (deferred, see below) |
| RAL: adapter, predictor, desired/mirrored, frontdoor/backdoor | `uvm-ral-mirror-prediction`, `uvm-staff-env-architecture` |
| Callbacks vs factory | `uvm-callbacks-vs-factory` |
| Scoreboard architectures | `uvm-scoreboard-architecture` |
| End of test: sequence objections, drain, `phase_ready_to_end` | `uvm-end-of-test-drain` |
| Phase jumping and user domains | `uvm-phase-jumping-domains` |
| UVM performance | `uvm-performance-hotspots` |
| VIP construction | `uvm-vip-architecture` |
| UVM-ML, pyuvm, cocotb | `uvm-multi-language-strategy` |
| I-SV-9 Why UVM (verifier) | `uvm-why-uvm` |
| I-UVM-5 containers, `uvm_event`/`uvm_barrier` (verifier) | `uvm-event-barrier-pool` |
| I-UVM-6 recording (verifier) | `uvm-performance-hotspots` (recording cost); no dedicated question |

## Deferred items

1. **Layered sequences / protocol layering (I-UVM-3B/layered-sequences): no dedicated question.** The bank is already at 30 items; a layering design question would fit a later round. The lesson is reachable from the arbitration and virtual-sequencer items.
2. **TLM2 sockets and the generic payload as a standalone question.** They are covered only at the language boundary in `uvm-multi-language-strategy`.
3. **I-UVM-6 recording (`uvm_tr_database`) as a standalone question.** It is covered only as a cost item in the performance question.
4. **E-AI-1, E-RISCV-1, E-PSS-1.** These are uncovered modules from the verifier's list, but they are not UVM-bank topics. I propose `soc-system-design.json` (lead decision).
5. **Linking visualizers** (`AnalysisBroadcastVisualizer`, `UvmPhaseTimelineVisualizer`, `ConfigDbExplorer`, `FactoryOverrideExplorerVisualizer`, `SequencerArbitrationSandbox`, `RALPredictorVisualizer`). The schema has no field for them; see request 3.
6. **Compile-checking the code blocks.** No simulator with UVM was available. The code was checked by reading against the uvm-core sources and IEEE 1800-2023. Snippets that use members declared elsewhere (for example `busy`, `n_outstanding`, `reset_seen`) are method bodies taken from larger classes, not complete compilation units.

## Requests for the lead

1. **Schema type and test.** `src/types/interview-question.ts` does not declare `modules`, `code`, `follow_ups`, `common_mistakes` or structured sources, although the loader accepts them. Add them to the type. `tests/interview-questions/bank-schema.test.ts` types `sources` as `string[]`; it should accept `{doc, section, verified}` objects.
2. **Categories.** The page has labels for `debug` and `predict-output`, but `VALID_CATEGORIES` in the schema test rejects them. `uvm-staff-debug-hanging-sim` would read better as `debug`, and `uvm-reporting-verbosity` and `uvm-phase-concurrency-trap` have a predict-the-output shape. If the categories are added, I can recategorize them.
3. **Visual field.** Add `visual?: {component, props}` so items can link the model-backed visualizers listed in G29.verify.md. The analysis-port item should link `AnalysisBroadcastVisualizer` first.
4. **`INTERVIEW_QUESTION_LESSONS` (`src/lib/practice-links.ts`).** The bank's `modules` now take precedence for all 10 kept ids, so the map entries are fallbacks only. Consider aligning them with the bank, or dropping the uvm entries except `uvm-factory-purpose`, which a test pins. No new ids need map entries.
5. **Content lint.** Add the known-wrong phrases to a lint: analysis ports "receive a copy"; `set_drain_time` as a "safety net"; the old "IEEE 1800.2-2020 §3 (Factory)" / "§9.4 (Objections)" citations; "Accellera UVM debug guide".
6. **Lesson owners (cross-check).** Two behaviours taught here should be confirmed in the lessons:
   - **A-UVM-9 (reset handling):** after `stop_sequences()`, uvm-core flushes the driver's held request, so a later `item_done()` fatals with SQRBADITMDN. The lesson should state that only one side may own the interrupted item.
   - **A-UVM-5 (callbacks):** a callback added in `build_phase` before its target exists becomes type-wide (null handle). The spine already lists this as a misconception; check that the lesson teaches it.
7. **Compile pipeline.** If the lead's pipeline can compile bank code blocks against uvm-core 2020.3.1, run it on the coding items (`uvm-driver-sequencer-handshake`, `uvm-tlm1-ports-exports-imps`, `uvm-field-macros-vs-do-methods`, `uvm-virtual-sequencer`, `uvm-end-of-test-drain`).

## Validation

- `python3 -c "import json;json.load(open('content/interview-questions/uvm.json'))"`: OK.
- `NODE_OPTIONS='--require @prisma/client' npx vitest run tests/interview-questions tests/app/interview-prep-banks.test.ts tests/qa/scheduling-semantics-lint.spec.ts tests/amba-flashcards.spec.ts`: 4 files, **863 tests passed**, 0 failed, on the final run. The first run had 858; the count changed because another agent's bank changed in parallel.
- Extra checks:
  - every `modules` ref exists under `content/curriculum/`;
  - every `coding` item contains code, and the `waveform-debug` item has a cycle table in `code`;
  - no unbalanced inline backticks, so inline code renders correctly;
  - no markdown bold, which `RichText` would not render.
