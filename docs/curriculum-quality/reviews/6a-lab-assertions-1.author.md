# 6a author log: lab assertions-1

Owner module: I-SV-4A (SVA Fundamentals). Module prerequisites unchanged: F3B, F4C (matches the spine card).

## What I built

The lab already had a complete design, checker starter, bench, solutions and README traced by hand. This pass finished it and made it available:

- `lab.json`: version 2 -> 3, status `coming_soon` -> `available`, description updated, new self-attested step 6 "Prove it fails: plant a valid-drop bug for R1". Steps 1-5 unchanged (ids and versions kept). No grader (all steps self-attested), so no `graderId`.
- `Makefile`: new `SIM=verilator` recipe (`verilator --binary --timing --assert --coverage-user ... -Mdir obj_dir`, run with `+verilator+error+limit+100`), with comments on why each switch matters; `clean` removes `obj_dir`.
- `README.md`:
  - "You need" and "Run it" now name Verilator 5 as the free option and explain `--coverage-user` (cover pass statements) and `+verilator+error+limit+100` (keep running after `$error`).
  - "About the logs": the logs are hand-traced and now also captured from Verilator 5.052 (every line matched); shows the Verilator `$error` prefix as an example.
  - New Step 6: plant `out_valid <= in_valid && in_ready;` in the fixed design; R1 (`a_out_valid_hold`) fires at 75 ns, the scoreboard sees an off-by-one stream and the watchdog ends the run; an R1 written with `|->` reports nothing (Q2 made visible). Restore the fix afterwards. Checklist item added.
  - Hint 4: Verilator needs `--coverage-user`.
  - Hint 5 corrected: LRM default runs the pass action on vacuous success (§20.11 VacuousOff), so covering an implication inflates the count on tools that follow the default; Verilator 5.052 does not, and hides the mistake. A sequence is never vacuous (§16.14.8), so cover the sequence.
  - Push-further answers: tool notes that Verilator 5.052 ignores the scope argument of `$assertoff`/`$assertkill` (it switched off every assertion in the bench) and that its `$fatal` stops without running `final` procedures.

The planted protocol bug stays the payload bug in `rtl/hs_slice.sv` (`if (in_valid) out_data <= in_data;`), caught by R2 `a_out_data_stable` at 75 ns, one edge before the scoreboard (85 ns). Step 6 adds a second planted bug for R1.

## Sources verified (IEEE 1800-2023, read in place)

- §16.14.3 cover statement: pass statement executes once per successful evaluation attempt, in the Reactive region; disabled evaluations not counted.
- §16.14.8 nonvacuous evaluations: `a |-> b` with `a` false is a vacuous success; a sequence evaluation is always nonvacuous.
- §20.11 assertion control: Off stops new attempts but running attempts and their actions are unaffected; Kill aborts running attempts; "By default, the pass action is executed on vacuous success" (VacuousOff).
- §16.14.1 assert statement: disabled evaluation runs no action block.
- §20.10: `$fatal` implies `$finish`; first argument is the finish number.
- Existing README citations (§16.3, §16.4, §16.4.3, §16.5.1, §16.9.3, §16.12, §16.12.7, §14.3, §14.16, §21.6) were left as written by the earlier author; no clause numbers were added beyond those checked above.

## Verilator results (Verilator 5.052 2026-09-05)

Lint, for each of the three combinations (starter checker + buggy RTL; solution checker + buggy RTL; solution checker + fixed RTL), run from the lab folder:

`verilator --lint-only -Wall --timing -Wno-fatal <dut> <sva> tb/tb_top.sv --top-module tb_top`

Result: no errors. Warnings only: PROCASSINIT (`clk` initial value), UNDRIVEN/UNUSEDSIGNAL on the clocking-block members in `tb_top` (lint false positives for clocking signals), SYNCASYNCNET on `rst_n`, and in the starter UNUSEDPARAM `MAX_STALL` / UNUSEDSIGNAL `out_ready` (used once the TODOs are filled).

Runs: `verilator --binary --timing --assert --coverage-user <dut> <sva> tb/tb_top.sv --top-module tb_top -Mdir obj_dir && ./obj_dir/Vtb_top +verilator+error+limit+100 [plusargs]`, also through `make <target> SIM=verilator` on a copy of the folder. Messages below omit the Verilator prefix.

| Run | Captured result | README |
|---|---|---|
| `make run` (starter) | 85 ns scoreboard a2/a3; 135 ns FAIL 1 mismatch 0 failures; summary 0 / 0 / 0 | matches Step 1 |
| `make nostall` (solution checker, buggy RTL) | 115 ns PASS; summary 0 failures, stall 0, transfer 6 | matches Step 3 |
| `make solution` | 75 ns `a_out_data_stable` a2 -> a3; 85 ns scoreboard; 135 ns FAIL 1/1; summary 1, 1, 6 | matches Step 4 |
| `make solution-fixed` | 135 ns PASS; summary 0, 1, 6 | matches Step 5 |
| `solution-fixed +PAUSE=6` | 105 and 115 ns `m_sink_ready_bounded`; 175 ns FAIL 0 mismatches 2 failures; summary 2, 1, 6 | matches Push further |
| Step 6 valid-drop mutation, solution checker | 75 ns `a_out_valid_hold`; scoreboard at 85/95/105 ns; 1015 ns TIMEOUT 5 of 6; 1035 ns FAIL 5 words 3 mismatches 1 failure; summary 1, 0, 5 | new Step 6 |
| Step 6 mutation, R1 with `\|->` | same, but 0 assertion failures | Step 6 claim |
| R2 with `\|->` on fixed RTL | 65 ns `a_out_data_stable` a1 -> a2 (false failure) | Hint 2 / Q1 |
| R2 message with plain `out_data` | 75 ns "changed from a3 to a3" | Hint 3 |
| C2 written as an implication | counted 1 (Verilator skips the pass statement on vacuous success) | Hint 5 now says tools differ |
| `$assertoff(0, tb_top.u_sva.a_out_data_stable)` at 0 / 70 ns, `$assertkill` at 70 ns | only the `[SVA] summary` line printed: Verilator turned off all assertions, including the bench's immediate ones | tool note added |
| R2 with `$fatal(1, ...)` | 75 ns fatal message, then `$stop`, no `final` summary | tool note added |

## Validation

- Manifest: ran a copy of `scripts/generate-lab-registry.mjs` restricted to this lab, writing to the scratchpad (not `src/generated`): "Generated 1 lab manifests", status available. (The full script currently stops on another agent's in-progress lab, `constructs-1: missing asset: README.md`.)
- `NODE_OPTIONS='--require @prisma/client' npx vitest run tests/lib/lab-graders.test.ts tests/lib/lab-assets.test.ts tests/lib/lab-registry.test.ts tests/lib/lab-progress-policy.test.ts`: 61 tests passed (against the current generated registry).
- No TS or MDX files touched, so `tsc`, `eslint` and `check-mdx` do not apply.

## Shared-file requests

- Regenerate `src/generated/lab-registry.ts` (lead) so assertions-1 shows as available with 6 steps; then rerun `tests/lib/lab-assets.test.ts` (it reads every available lab's assets; total is about 53 KB, well within caps).
- `docs/curriculum-quality/curriculum-spine.md` I-SV-4A card, "Hands-on that should exist": change "Lab `assertions-1` (coming soon)" to available, and mention the step 6 valid-drop prove-it-fails step; the "planned card" wording no longer applies.
- No test pins assertions-1 as `coming_soon` (searched `tests/` and `src/lib`). Owning module and prerequisites unchanged, so `src/lib/practice-links.ts` needs no change.
