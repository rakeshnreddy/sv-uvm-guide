# G29-B-DBG completeness review, round 1: `debug.json`

Reviewer: completeness and usefulness lens. Date: 2026-10-18. Read-only except for this file. This file replaces an earlier round-1 note (2026-10-11). I re-ran every check below myself, and I list only findings I confirmed in this session.

Inputs read:
- `docs/curriculum-quality/README.md`.
- `analysis/G29.md`: the `debug.json` section, "Coverage gaps" and "Requests for the lead".
- `analysis/G29.verify.md`: confirmed DBG-01/03/09, the missed issues, gaps 1, 3, 4 and 7, and the notes for the author.
- `curriculum-spine.md`: the E-DBG-1 and I-UVM-1D cards, and the curriculum-wide gaps table (G12, G13, G18, G29).
- `reviews/G29-B-DBG.author.md`.
- The whole bank (19 questions) and `git diff HEAD -- content/interview-questions/debug.json` (+553/−25).
- `src/app/(learning)/interview-prep/interview-banks.ts` and `page.tsx`, to see how `code` and text are rendered.

## Verdict

**Pass: no S1 or S2 remains.** 0 S1, 0 S2, 4 S3, 10 S4.

## Checks run

| Check | Result |
|---|---|
| JSON parses | OK (`python3 json.load`) |
| `NODE_OPTIONS='--require @prisma/client' npx vitest run tests/interview-questions tests/app/interview-prep-banks.test.ts tests/qa/scheduling-semantics-lint.spec.ts` | 3 files, 860 tests, all pass |
| Every `modules` entry resolves to `content/curriculum/*/<folder>/<page>.mdx` | All 50 refs resolve (glob) |
| Levels | junior 3, mid 7, senior 6, staff 2, senior-staff 1: at least 3 junior, and the range runs from junior to senior staff |
| Coding and waveform items | All 3 `coding` items carry buggy code, and each answer has the fix. All 4 `waveform-debug` items carry a cycle table. 12 of 19 questions have `code`. |
| `follow_ups` / `common_mistakes` | On all 19: 3 follow-ups each, and 3–4 mistakes each |
| Rubrics discriminate | All 19 name what a strong answer must contain and end with a specific weak move, for example starting from the `UVM_FATAL`, blaming the override order, raising the timeout, or using `exclude_bin`. |
| Bare "(secondary)" sources | None remain. Opinion is labelled "Practice note (not normative)" and tool behaviour "Tool note". IEEE 1801 is `{doc, verified: false}`. No invented tool flags: there is no `-xprop`, and the seed option is "tool-dependent". |
| Clause titles (spot check) | IEEE 1800.2-2020: B.1.1.1, C.4.2.3.1, 5.3.3.1, 5.3.3.3, G.2.7, F.7.3.3, 6.5.1.2.6, 6.5.1.2.14, 8.2.3.2.5, 10.5.1.5.1, 13.1.7.13, 14.2.4.4 and 15.2.1.2.2 all match the cited topic. IEEE 1800-2023: §11.4.11, §14.16, §16.9.3, §16.14.8, §18.14.3, §19.6.3, §20.14.1, §21.7.1.3, §31.3, §31.4 and §31.6 match. §16.12 says the disable condition uses current values ("not sampled"), as the assertion item states. |

## S1/S2 resolution (G29.md and G29.verify.md)

| ID | Sev | Status |
|---|---|---|
| G29-DBG-01 | S2 | **Resolved.** The answer now uses `ignore_bins` (§19.5.5, crosses §19.6.2) and `illegal_bins` (§19.5.6, §19.6.3), with a covergroup in `code` that has an `ignore_bins` on a cross. Waiver files are labelled vendor-specific. `exclude_bin` now appears only as a named non-construct; see finding 2. |
| G29-DBG-03 | S2 | **Resolved.** The item is rebuilt around X-optimism (§12.4, §12.5) versus X-pessimism. It adds the X-preserving `?:` (§11.4.11), a reset-gated `$isunknown` assertion (§20.9) and an RTL-versus-gates cycle table. The DBG-02 §4.6 citation and the vendor flag are gone. |
| G29-DBG-09 | S2 | **Resolved.** 13 questions were added, covering every debug gap the analysis lists (see the next section). |
| Navigation S2 (banks unreachable) | S2 | **Done, lead-side.** `/interview-prep` loads the bank (`BANK_FILES`), and each question's `modules` gives "Learn it in" links. Lesson-to-bank links remain the author's lead request 4 (finding 14). |
| Verify notes UVM-02/03/05/06/V01/V02, as they apply here | S1–S3 (uvm.json) | **Applied.** The hang item separates "time stuck" from "time advancing". The watchdog is described as a delay, with `UVM_DEFAULT_TIMEOUT` 9200 s. The phase skip happens one NBA region after the phase starts, which the "#10ns reset wait" follow-up tests. A blocking `get()` belongs to the time-advancing family, and a failed `get` with `uvm_fatal` or `INVTST` is explicitly not a silent hang. |

## Coverage gaps assigned to `debug`

All seven rows in G29.md "Coverage gaps" are filled:
- TB/DUT race from a waveform: `debug-tb-race-clock-edge`.
- UVM debug switches: `debug-uvm-trace-switches`.
- An override that does not take effect, and config not applied: `debug-override-not-taking-effect` and `debug-config-db-get-failure`.
- Assertion-failure triage (sampled values, vacuity, `disable iff`): `debug-assertion-failure-triage`.
- Seeds and random stability: `debug-seed-reproduction`.
- Profiling: `debug-simulation-performance`.
- Gate-level debug: `debug-gate-level-x-and-timing`.

Analysis edit 6 asked for a junior "read this log/waveform" item; `debug-read-first-failure-log` provides it.

Verify gaps that fall to this bank are also covered:
- `uvm_heartbeat` (spine G18) appears in four items.
- The derived-class `uvm_component_utils` trap is bug 2 of the override item, labelled "by inspection".
- `$assertoff`/`$assertcontrol` appear in `debug-honest-verdict`.
- The `assert(obj.randomize())` trap stays in `systemverilog.json` `sv-randomize-failure`, which covers it ("explains why not `assert`").

The three E-DBG-1 spine misconceptions are each targeted:
1. "`UVM_ERROR : 0` proves a pass": honest-verdict and test-ends-at-time-zero.
2. "A demoting catcher is a fix": honest-verdict.
3. "The same seed reproduces after a rebuild": seed-reproduction and methodology-first-steps.

## Findings

| # | Sev | Question id | Problem | Fix | Source checked |
|---|---|---|---|---|---|
| 1 | S3 | debug-seed-reproduction | The `modules` link `I-SV-2B_Advanced_Constrained_Randomization/controlling-randomization` never mentions seeds or random stability: 0 hits for "seed", "stability" or "18.14". The page that teaches the answer is `randomization-methods.mdx`, titled "Procedural Randomization, Seeds and Random Stability". The spine's gap G13 assigns random stability to exactly that page. A learner who follows "Learn it in" lands on the wrong page. | Replace that ref with `I-SV-2B_Advanced_Constrained_Randomization/randomization-methods`. Optionally add `I-SV-2B_Advanced_Constrained_Randomization/index`, which has the "same seed, small code change" table and a §18.14.1 quiz. | `grep` of the I-SV-2B pages; `curriculum-spine.md` gap G13 |
| 2 | S3 | debug-coverage-hole-triage (author log, lead request 5) | The author asks the lead to add `exclude_bin` to the known-wrong phrase lint, saying "this bank no longer contains them". The bank still contains `exclude_bin` 3 times: in the rubric (`:482`), the model answer (`:483`) and a common mistake (`:490`). Each mention is correct, because it names the construct as non-existent. A plain phrase lint would still fail this bank, or force the teaching point out. | Lead: write the lint to allow negated mentions (for example, skip matches within a few words of "no", "non-existent" or "none exists"), or an allowlist for this question id. Author: correct the log's claim. | `grep -n exclude_bin content/interview-questions/debug.json` |
| 3 | S3 | (all; lead, cross-bank) | The page renders bank text with `toRichBlocks` and `splitInlineCode` (`interview-banks.ts:278-284`). These handle only ``` fences, blank-line paragraphs and backtick code. This bank's answers rely on `**bold**` lead-ins and `- ` or `1.` lists. Bold appears as literal asterisks, and list lines inside one paragraph run together. Examples are the "Check, in order:" list in `debug-waveform-protocol-hang` and the five-step triage in `debug-assertion-failure-triage`. That hurts the usefulness of every re-authored bank. | Lead: render `**…**` as `<strong>`, and line runs that start with `- ` or `N. ` as `<ul>`/`<ol>`, in `toRichBlocks`/`InlineText`. Add a test with one bank answer. | `src/app/(learning)/interview-prep/interview-banks.ts`, `page.tsx:37-70` |
| 4 | S3 | debug-gate-level-x-and-timing | The "Learn it in" links (F2A, F4C, A-UVM-9) teach X-optimism and clocking skew, but no lesson teaches SDF back-annotation, Clause 31 timing checks or notifiers: 0 hits for `SDF` or `setuphold` in `content/curriculum`. The spine's gap G29 places gate-level simulation in "F2A Push Further + E-PWR-1". E-PWR-1 has an "Expert: power-aware gate-level simulation" section (`index.mdx:1507`) that the item does not link. | Add `E-PWR-1_Power_Aware_Verification/index` to `modules`. Lead: record the SDF, timing-check and notifier half as a curriculum gap (an F2A Push Further or A-UVM-9 owner), so the senior half of this answer has somewhere to be learned. | `grep -rl "SDF\|setuphold" content/curriculum`; spine gap G29; E-PWR-1 `index.mdx:1507`; F2A `index.mdx:843` |
| 5 | S4 | debug-coverage-hole-triage | `modules` links `I-SV-3A_Functional_Coverage_Fundamentals/coverage-options`, which never mentions `ignore_bins` or `illegal_bins`. The I-SV-3A index teaches both, in a table at lines 176–185. | Replace `…/coverage-options` with `I-SV-3A_Functional_Coverage_Fundamentals/index`, or put the index first. | `grep ignore_bins\|illegal_bins` of the I-SV-3A pages |
| 6 | S4 | debug-assertion-failure-triage, debug-honest-verdict | Both items teach that an assertion's `$error` never reaches the UVM counts, and the assertion item's follow-up 3 asks how to route failures into UVM. The lesson that teaches this is A-UVM-7: objective 4, the "`$error` in an interface assertion increments `UVM_ERROR`" misconception, and the `$assertoff`/`$assertcontrol` table. The spine's gap G12 assigns the topic there. Neither item links it. | Add `A-UVM-7_VIP_Construction/index` to both items' `modules`. | A-UVM-7 `index.mdx:27, :571, :601`; spine gap G12 |
| 7 | S4 | debug-uvm-trace-switches | The question is built on `+UVM_CONFIG_DB_TRACE`, `+UVM_PHASE_TRACE` and `+UVM_OBJECTION_TRACE`, but `modules` omits the lessons that teach them: I-UVM-2C (10 hits for the config trace) and I-UVM-1C (17 hits for the phase and objection traces). | Add `I-UVM-2C_Configuration_and_Resources/index` and `I-UVM-1C_UVM_Phasing/index`. | `grep -c` of both lessons |
| 8 | S4 | debug-staff-debug-infrastructure (and debug-simulation-performance) | Both rely on transaction recording (`set_recording_enabled`, §13.1.7.13). G29.verify gap 1 lists I-UVM-6, the recording module, as having no bank question. E-DBG-1 objective 4, "Design a debug event bus", and its must-cover "the debug event-bus pattern" appear in no question. The infrastructure design is the natural place for both. | Add `I-UVM-6_UVM_Recording_Classes/index` to `modules`. Add one point to the infrastructure answer and rubric: a debug event bus, where monitors and scoreboards publish to one analysis-based channel that a recorder or ring buffer subscribes to, so new debug consumers need no edits to the agents. | G29.verify.md gap 1; spine E-DBG-1 card |
| 9 | S4 | debug-x-propagation | The cycle table shows `y (gates)` as `xx` (all bits X). But a = 8'h11 and b = 8'h22 agree on bits 7, 6, 3 and 2, so the bit-by-bit rule the answer itself cites for `?:` (§11.4.11), and a typical mux cell, give `8'b00xx_00xx`. The table also leaves out `cfg_sel`, so `sel` = 1 at edge 5 is assumed. | Use complementary data (for example a = 8'h0F, b = 8'hF0) so every bit really is X, or show `8'b00xx_00xx`. Add a `cfg_sel` row (1 at edge 4). | IEEE 1800-2023 §11.4.11 (ambiguous condition: bitwise combination); the item's own text |
| 10 | S4 | debug-config-db-get-failure | Follow-up 1 asks "the env also sets `num_items` to 8: which value wins?", and the sources cite C.4.2.2.1 for build-time precedence, but no answer text states the rule. | Add one sentence: during build, the setting from the hierarchically higher context wins (the test's 20 beats the env's 8); after build, the last setting wins. | IEEE 1800.2-2020 C.4.2.2.1 |
| 11 | S4 | debug-override-not-taking-effect | Follow-up 2 (an override from the command line) is unanswered, although G.2.7 is cited. It is also a good discriminator: the plusarg is name-based, so it cannot find an unregistered `err_driver` either. | Add a closing line: `+uvm_set_type_override=bus_driver,err_driver` (G.2.7) needs no rebuild, but works only once `err_driver` is registered with the macro, and only for objects built with `create`. | IEEE 1800.2-2020 G.2.7 |
| 12 | S4 | debug-honest-verdict | The E-DBG-1 objective names report actions (`UVM_COUNT`). The answer covers `UVM_NO_ACTION` but not the subtler case: `+uvm_set_action=…,UVM_ERROR,UVM_DISPLAY` drops `UVM_COUNT`, so the error prints but `UVM_ERROR : 0` still holds. | Add it to item 1 and to the rubric. | IEEE 1800.2-2020 G.2.4; spine E-DBG-1 objective 1 |
| 13 | S4 | debug-read-first-failure-log | I-UVM-1D misconception 1, "verbosity filters warnings and errors", is tested nowhere in the bank. The junior log item is its natural home. | Add a follow-up or a common mistake: `+UVM_VERBOSITY=UVM_NONE` hides only info messages; `` `uvm_warning `` and `` `uvm_error `` are issued at `UVM_NONE` and still print. | Spine I-UVM-1D card; IEEE 1800.2-2020 B.1.1.2, B.1.1.3 |
| 14 | S4 | (lead; author log) | (a) No lesson links back to the bank. The E-DBG-1 pages, F3C, F4C, I-UVM-2C and E-PERF-1 have no `/interview-prep` link. (b) The author log says "10 carry `code`", but 12 do. | (a) I agree with lead request 4 (anchor `/interview-prep#debug--triage-interview-question-bank`). (b) Correct the count in the log. | `grep -rln /interview-prep content`; bank JSON |

## Notes (no change required)

- **Follow-up answers.** No follow-up in any bank has an answer; that is a schema choice for the lead. Findings 10 and 11 cover the two cases where the bank cites a source for the answer and then leaves the answer out.
- **Deferrals I agree with.** The `debug`/`predict-output` categories, WaveDrom fields, a `visual` field (for TestbenchDriveComparison, the hang-lab DebuggingSimulator and TelemetryEventBusVisualizer) and the "Is time advancing?" chart all wait on schema changes owned by the lead.
- **Level spread.** All four `waveform-debug` items are mid-level. A junior waveform item (for example, reading a single X on a control line) would round out the junior path, but no gap row requires one.
- **Accuracy spot checks (lens overlap, no finding).** The tb-race table is consistent: A captures 03/07/09 and B captures 07/09/09. In the assertion table, the attempt from edge 2 covers edges 3–5 and fails at 5, and ack is first sampled high at edge 6, 4 cycles after the rise. `try_next_item` waits only for an NBA region in uvm-core, so the hang loop really freezes time.
