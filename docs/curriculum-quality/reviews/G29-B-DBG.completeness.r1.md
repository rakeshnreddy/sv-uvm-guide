# G29-B-DBG completeness review, round 1: `debug.json`

Reviewer: completeness and usefulness lens. Date: 2026-10-11. Read-only except for this file.

Inputs read:
- `docs/curriculum-quality/README.md`.
- `analysis/G29.md`: the debug.json section, Coverage gaps and Requests for the lead.
- `analysis/G29.verify.md`: confirmed DBG-01/03/09, gaps 1, 3, 4 and 7, and the notes for the author.
- `curriculum-spine.md`: the E-DBG-1, E-PERF-1 and I-UVM-1D cards.
- `reviews/G29-B-DBG.author.md`.
- The whole bank (19 questions) and its diff (`git diff HEAD`: +553/−25).
- The loader and page: `src/app/(learning)/interview-prep/interview-banks.ts` and `page.tsx`.

## Verdict

**Pass: no S1 or S2 remains.** 0 S1, 0 S2, 2 S3, 9 S4.

## Checks run

| Check | Result |
|---|---|
| JSON parses (`python3 -c "import json;json.load(...)"`) | OK |
| `NODE_OPTIONS='--require @prisma/client' npx vitest run tests/interview-questions tests/app/interview-prep-banks.test.ts tests/qa/scheduling-semantics-lint.spec.ts tests/amba-flashcards.spec.ts` | 4 files, 858 tests, all pass. The author's run showed 543; other banks have changed since then. |
| Every `modules` entry resolves to `content/curriculum/*/<module>.mdx` | All 50 refs resolve (checked with glob) |
| Levels | junior 3, mid 7, senior 6, staff 2, senior-staff 1. At least 3 junior, and the levels span junior to senior staff. |
| Coding and waveform items carry code or a cycle table | All 3 coding items have buggy code, and the fix is in the answer. All 4 waveform-debug items have cycle tables. 12 of 19 questions have `code`; the author log says 10 (finding 11). |
| `follow_ups` and `common_mistakes` | Present on all 19: 3 follow-ups and 3–4 mistakes each |
| Rubrics separate strong from weak answers | All 19 end with a "weak answer" sentence that names a specific wrong move, such as starting from the `UVM_FATAL`, blaming the override order, raising the timeout, or using `exclude_bin`. |
| No bare "(secondary)" source | None remain. Opinion is labelled "Practice note (not normative)", and tool behaviour is labelled "Tool note". IEEE 1801 is `verified: false`. |
| Cited clause titles | All checked against the primary text. IEEE 1800.2-2020 (`uvm_lrm.txt`): G.2.2–G.2.7, F.7.3.3, F.7.4.2, C.4.2.2.1/2, C.4.2.3.1, 8.2.3.2.5, 8.3.1.4.2, 8.3.1.7.1/5, 9.3.1.7.1/2, 10.5.1.3.3, 10.5.1.5.1, 10.6, 13.1.4.1.7, 13.1.7.13, 14.2.3.1, 14.2.4.2/4, 15.2.1.2.1/2, 6.5.1.2.6/14, 6.6, 6.6.5, B.1.1.1 and 5.3.3.1/3 each match their title. IEEE 1800-2023 (`t1_lrm_clean.txt`): §4.7, §4.8, §6.3.1, §6.8, §10.4.2, §11.4.5, §11.4.11, §12.4, §12.5, §14.13, §14.16, §16.5.1, §16.9.3, §16.12, §16.12.7, §16.14.8, §18.14, §18.14.1, §18.14.3, §19.5.5, §19.5.6, §19.6.2, §19.6.3, §19.11, §20.9, §20.10, §20.11, §20.14.1, §21.6, §21.7.1.3, §31.3, §31.4, §31.6 and Clause 32 each match their title. |
| uvm-core behaviours used as answer keys | `PH/TRC/SKIP` "No objections raised, skipping phase" (`uvm_phase_hopper.svh:518`), `DRVCONNECT` (`uvm_driver.svh:101`), `TYPDUP` (`uvm_factory.svh:1123`) and `null (failed lookup)` (`uvm_config_db_implementation.svh:483`) are all present in the scratchpad uvm-core sources. |

## S1/S2 resolution (G29.md and G29.verify.md)

| ID | Sev | Status |
|---|---|---|
| G29-DBG-01 | S2 | **Resolved.** `exclude_bin` is gone from the answer. `ignore_bins` (§19.5.5; crosses §19.6.2) and `illegal_bins` (§19.5.6, §19.6.3) are used correctly, with a covergroup in `code` that shows both, including an `ignore_bins` on a cross. Tool waiver files are labelled vendor-specific. The non-existent construct is named as a common mistake. |
| G29-DBG-03 | S2 | **Resolved.** The question is rebuilt around X-optimism (§12.4 `if` with an x condition takes `else`; §12.5 `case` falls to `default`) and X-pessimism. It adds the X-preserving conditional operator (§11.4.11) and a reset-gated `$isunknown` assertion in code (§20.9). An RTL vs gate cycle table makes the category honest. The DBG-02 citation (§4.6) and the vendor flag are also gone. |
| G29-DBG-09 | S2 | **Resolved.** 13 questions were added. Every debug gap in the analysis now has a question: TB race (waveform), config_db get failure, override not taking effect, a sequence that never runs, assertion triage (waveform), seeds, profiling and gate-level debug. Also added: trace switches, a junior log-reading item, a time-stuck hang, honest verdicts and a staff debug-infrastructure design. |
| Navigation S2 (banks unreachable) | S2 | Lead-side and done: `/interview-prep` loads the bank and is linked from `PracticeHub.tsx`, `site-links.ts` and the sitemap. Each question's `modules` gives "Learn it in" links. Links from the lessons back to the bank are still the lead's request 4 (finding 10). |
| Verify UVM-02/03/05/06/V01/V02 notes, as they apply to the debug hang items | S1–S3 in uvm.json | Applied correctly here. "Time stuck" and "time advancing" are separated. The watchdog is described as a delay, with `UVM_DEFAULT_TIMEOUT` 9200 s. The phase-skip check runs one NBA region after the phase starts, so an objection raised after `#10ns` is too late. A blocking `get()` belongs in the time-advancing family. A failed `get` with `uvm_fatal` and `INVTST` are explicitly *not* silent hangs. |

## Coverage gaps assigned to `debug` (G29.md "Coverage gaps")

All seven are filled:
- TB/DUT race from a waveform: `debug-tb-race-clock-edge`.
- UVM debug switches: `debug-uvm-trace-switches`.
- Override not taking effect, and config not applied: `debug-override-not-taking-effect` and `debug-config-db-get-failure`.
- Assertion-failure triage: `debug-assertion-failure-triage`.
- Seeds and random stability: `debug-seed-reproduction`.
- Profiling: `debug-simulation-performance`.
- Gate-level debug: `debug-gate-level-x-and-timing`.

Analysis edit 6 asked for a junior "read this log" item; `debug-read-first-failure-log` provides it.

Verify gaps that fall to this bank are also covered:
- `uvm_heartbeat` as a hang follow-up: in four items.
- The derived-class `uvm_component_utils` trap: bug 2 of the override item, labelled "by inspection".
- `$assertoff`/`$assertcontrol`: in `debug-honest-verdict`.
- The `assert(obj.randomize())` trap stays in `sv-randomize-failure` (systemverilog.json). That question exists and covers it.

All three E-DBG-1 spine misconceptions are targeted:
1. "`UVM_ERROR : 0` proves a pass": honest-verdict and test-ends-at-time-zero.
2. "A demoting catcher is a fix": honest-verdict.
3. "The same seed reproduces after a rebuild": seed-reproduction and methodology-first-steps.

So is the E-PERF-1 misconception that "an unguarded `uvm_report_info($sformatf…)` is as cheap as the macro" (simulation-performance).

## Findings

| # | Sev | Question id | Problem | Fix | Source checked |
|---|---|---|---|---|---|
| 1 | S3 | (all; lead, cross-bank) | The page renders bank text with `toRichBlocks`/`splitInlineCode`, which handle only fenced code, blank-line paragraphs and backticks. In this bank, 229 `**bold**` markers appear as literal asterisks. 72 `- ` bullet lines and 9 numbered lines fall inside single `<p>` elements, where HTML collapses the newlines, so lists run together. Examples are the "Check, in order:" list in `debug-waveform-protocol-hang` and the five-step triage in `debug-assertion-failure-triage`. The other re-authored banks have the same problem (systemverilog 652 `**`, soc 360, amba 286, sva 252). | Lead: extend `toRichBlocks` and `InlineText` to render `**…**` as `<strong>` and runs of `- ` or `N. ` lines as `<ul>`/`<ol>`, with a unit test. Do not ask the bank authors to strip the markdown, because the structure helps learners. | `src/app/(learning)/interview-prep/interview-banks.ts:264-296`; `page.tsx:57-80`; marker counts by grep |
| 2 | S3 | debug-gate-level-x-and-timing | The "Learn it in" links (F2A, F4C, A-UVM-9) teach X-optimism and clocking skew. No lesson teaches SDF back-annotation, `$setuphold`/`$recovery` timing checks or notifiers: there are 0 hits for `SDF` and `setuphold` in `content/curriculum`. A learner who misses the timing half of this senior question has nowhere to learn it. | Keep the question. Lead: record a curriculum gap (gate-level simulation: SDF, Clause 31 timing checks and notifiers, X-pessimism) for A-UVM-9 Push Further or E-SOC-1. Until then, add `T4_Expert/E-PWR-1_Power_Aware_Verification/index` only if its X-optimism material fits; otherwise leave the modules as they are. | `grep -rl SDF\|setuphold content/curriculum` (no hits); IEEE 1800-2023 §31.3, §31.4, §31.6, Clause 32 |
| 3 | S4 | debug-coverage-hole-triage | `modules` links `I-SV-3A_Functional_Coverage_Fundamentals/coverage-options`, which covers sampling events and `option`/`type_option` but never mentions `ignore_bins` or `illegal_bins`. The I-SV-3A index page teaches them. | Replace `I-SV-3A…/coverage-options` with `I-SV-3A_Functional_Coverage_Fundamentals/index`, or add the index ahead of it. | `grep ignore_bins\|illegal_bins` hits I-SV-3A `index.mdx` only; it also hits I-SV-3B closure-workflow, index, linking-coverage and coverage-apis |
| 4 | S4 | debug-uvm-trace-switches | The question pairs symptoms with `+UVM_CONFIG_DB_TRACE`, `+UVM_PHASE_TRACE` and `+UVM_OBJECTION_TRACE`, but `modules` omits the lessons that teach them: I-UVM-2C (10 hits for the config trace) and I-UVM-1C (17 hits for the phase and objection traces). | Add `I-UVM-2C_Configuration_and_Resources/index` and `I-UVM-1C_UVM_Phasing/index`. | Lesson grep |
| 5 | S4 | debug-config-db-get-failure | Follow-up 1 ("the env also sets `num_items` to 8; which value wins?") has no answer, although the sources cite C.4.2.2.1 for "build-time precedence". The source backs no claim in the content. | Add one sentence to the answer: during build, a setting from a hierarchically higher context wins, so the test's 20 beats the env's 8. After build, settings use default precedence, so the most recent one wins. | IEEE 1800.2-2020 C.4.2.2.1 ("Settings from hierarchically higher levels have higher precedence … After build time, all settings use the default precedence") |
| 6 | S4 | debug-override-not-taking-effect | Follow-up 2 (an override from the command line) is unanswered, although G.2.7 is cited. It is also a good discriminator: `+uvm_set_type_override` is name-based, so with bug 2 still present (`err_driver` not registered) it cannot find `err_driver` either. | Add a closing line: `+uvm_set_type_override=bus_driver,err_driver` (G.2.7, which works like `set_type_override_by_name`) needs no rebuild. It works only once `err_driver` is registered with the macro, and only for objects built with `create`. | IEEE 1800.2-2020 G.2.7, §8.2.3.2 |
| 7 | S4 | debug-honest-verdict | The E-DBG-1 spine objective names report *actions* (`UVM_COUNT`). The answer covers `UVM_NO_ACTION`, but not the subtler case where `+uvm_set_action=…,UVM_ERROR,UVM_DISPLAY` drops `UVM_COUNT`: the error still prints but is not counted. A reviewer who sees the line in the log could wrongly trust the summary. | Add it to item 1: "an action list without `UVM_COUNT` (for example `UVM_DISPLAY` alone) prints the error but leaves `UVM_ERROR : 0`". | IEEE 1800.2-2020 G.2.4 ("UVM_NO_ACTION or a \| separated list of the other UVM message actions"); spine E-DBG-1 objective 1 |
| 8 | S4 | debug-read-first-failure-log | The I-UVM-1D spine misconception "verbosity filters warnings and errors" is tested nowhere in the bank, and the junior log item is the natural place for it. | Add a follow-up or common mistake: "`+UVM_VERBOSITY=UVM_NONE` hides only INFO messages above `UVM_NONE`; `` `uvm_warning `` and `` `uvm_error `` are issued at `UVM_NONE`, so they still print". | IEEE 1800.2-2020 B.1.1.2 (`` `uvm_warning `` "with a verbosity of UVM_NONE"), B.1.1.3; spine I-UVM-1D misconception 1 |
| 9 | S4 | debug-staff-debug-infrastructure (also debug-simulation-performance) | Both questions rely on transaction recording (`set_recording_enabled`, §13.1.7.13). G29.verify gap 1 lists I-UVM-6, the recording module, as uncovered by any bank, and this bank is its natural home. | Add `T2_Intermediate/I-UVM-6_UVM_Recording_Classes/index` to `modules` on debug-staff-debug-infrastructure, and optionally on debug-simulation-performance. | G29.verify.md gap 1; `I-UVM-6…` has 135 recording/`uvm_tr_database` hits |
| 10 | S4 | (lead) | No lesson links back to the bank. The E-DBG-1 pages, F3C, F4C, I-UVM-2C and E-PERF-1 have no `/interview-prep` link; only B-AMBA-F2/F3 link it. | I agree with the author's lead request 4 (anchor `/interview-prep#debug--triage-interview-question-bank`). | `grep -rln /interview-prep content src` |
| 11 | S4 | (author log) | The log says "10 carry `code`", but 12 do. It also says all four waveform items use a ```` ```text ```` fence, but `debug-waveform-protocol-hang`'s `code` has no fence. It renders correctly, because `page.tsx:116` wraps unfenced code. | Correct the count. Optionally fence the protocol-hang table as ```` ```text ```` to match the other three. | Bank JSON; `page.tsx:113-117` |

## Notes (no change required)

- **Follow-up answers.** Follow-ups have no answers. This is a schema choice across all banks, so self-study learners cannot check them. Findings 5 and 6 cover the two cases where the bank cites a source for the answer and then leaves it out. A future `follow_ups: {q, a}` shape is a lead decision.
- **Agreed deferrals.** I agree with the author's deferred items: the `debug`/`predict-output` categories, WaveDrom fields, the `visual` field for TestbenchDriveComparison, the hang-lab DebuggingSimulator and TelemetryEventBusVisualizer, and the citation-lint phrases. The E-DBG-1 must-cover "debug event-bus pattern" has no question. It can wait for the `visual` field, since TelemetryEventBusVisualizer is the natural carrier.
- **Accuracy spot checks (lens overlap, no finding).** The tb-race, assertion and x-prop cycle tables are internally consistent. The assertion attempt from edge 2 covers edges 3–5 and fails at 5, with ack first sampled high at edge 6, 4 cycles after the rise. The `TYPDUP` path in `set_type_override_by_type` still registers an identity override rather than returning. That matches "changes nothing" and the factory-print evidence the answer describes.
