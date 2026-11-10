# 6a lab fifo-1 (author log)

## What I built

Lab `fifo-1` v2, owned by I-SV-1 (status `available`, all steps self-attested, no grader). The lab is a layered class-based bench, without UVM, randomization or mailboxes, for a 4-entry synchronous FIFO. It follows `simple-dut-1`: the specification is written as rules, the starter has TODO markers, and there is a full solution, an expected log, a vacuity guard and a planted-bug table.

- `content/curriculum/labs/fifo/work/sync_fifo.sv`: the DUT, with spec rules F1-F5 in its header. A write while full is ignored even when a read happens on the same edge, and that choice is stated in the spec. `BUG=1` stores a write while full. `BUG=2` makes "write and read on one edge" add 1 to the count.
- `work/fifo_if.sv`: the interface. The classes reach it through `virtual fifo_if #(W)`.
- `work/tb_top.sv` (given): clock, interface, DUT, `+TEST=`, `+DUMP`, watchdog (`fork`/`join_any`, `disable fork`), `report()`, `$finish`.
- `work/fifo_tb_pkg.sv` (starter) and `solution/fifo_tb_pkg.sv`:
  - `fifo_item` has virtual `copy`, `clone` and `convert2string`.
  - `fifo_obs extends fifo_item` overrides all three, calls `super`, and uses a checked function-form `$cast`.
  - `fifo_gen` edits one blueprint and pushes `clone()`. Write data is unique. The mixed test uses a fixed LFSR, so counts are the same on every simulator.
  - `fifo_drv` drives with `<=` through `vif`.
  - `fifo_mon` creates a new object on every edge after reset.
  - `fifo_sb`: its reference model is a `fifo_item ref_q[$]`. It checks data with `!==` and both flags on every edge. Acceptance comes from the model's level, never from the DUT's flags. It keeps corner counters (full reached, write while full, read while empty, write and read together when empty, in the middle, when full).
  - `report()` fails when entries are left over, when a read is pending, when a corner is missed in the full run, and when no data was read back.
  - `fifo_env` (given) wires the layers and returns at a falling edge, so the monitor has finished the last rising edge before the verdict. Without that, the counts depended on process order.
- `README.md`: spec, bench table, steps 1-8 with answers in `<details>`, a plan table, an expected log, a planted-bug table, run commands and a checklist.
- `lab.json`: v2, `available`, `owningModule` `I-SV-1`, `modulePrerequisites` `F2B`, `F2D`, `F4B` (the spine card's prerequisites), and `labPrerequisites` `simple-dut-1` (was `common-1`, which is coming soon). It has 8 self-attested steps and 6 assets.
- Removed the old `lab1_simple_tb/test_fifo.sv`. It drove with blocking `=`, compared with `==` in an `assert`, had no verdict and was not class-based.

## Sources verified (IEEE 1800-2023, read in place)

- §6.24.2: `$cast` as a task gives a run-time error on an invalid assignment; as a function it returns 0 and never errors.
- §8.12 (handle assignment and copying), §8.15 `super`, §8.16 casting, §8.20 virtual methods, §25.9 virtual interfaces, §7.10 queues, §4.9.4 nonblocking assignment, §20.10 severity tasks, §3.14.2.3 (timeunit, as cited in `simple-dut-1`): the headings were confirmed in the text.
- The package syntax allows `timeunits_declaration` (A.1.2 `package_declaration`), so the package declares `timeunit`.
- No external URLs or historical facts are used.

## Verilator (5.052 2026-09-05)

- Lint:
  - `verilator --lint-only -Wall --timing -Wno-fatal --top-module tb_top work/sync_fifo.sv work/fifo_if.sv solution/fifo_tb_pkg.sv work/tb_top.sv` gives 0 errors. The warnings left are style or analysis notes: DECLFILENAME (a package file that holds classes), PROCASSINIT (`logic clk = 1'b0` plus `always`, as in `simple-dut-1`), and UNDRIVEN/UNUSEDSIGNAL on the interface signals. Those signals are driven and read through the virtual interface, which lint does not trace.
  - Starter: same command with `work/fifo_tb_pkg.sv`. 0 errors, plus extra UNUSED/UNDRIVEN warnings from the TODO stubs.
- Build: `verilator --binary --timing -Wno-fatal --top-module tb_top <4 files>`, then `./obj_dir/Vtb_top [+TEST=x] +verilator+error+limit+1000`.
- Results, captured (correct / BUG=1 / BUG=2 / monitor reuses one object / generator stores the blueprint):
  - all: 155/0, 100/55, 106/49, 105/50, 105/2
  - smoke: 13/0, 13/0, 13/0, 10/3, 10/1
  - fill_drain: 20/0, 13/7, 20/0, 16/4, 16/1
  - simultaneous: 23/0, 19/4, 16/7, 16/7, 16/1
  - mixed: 108/0, 64/44, 68/40, 72/36, 72/1
- Starter with no plusargs: `PASS=0 FAIL=2` (corner guard and no-data guard). With `+TEST=x` each test gives `PASS=0 FAIL=1`.
- An unknown `+TEST` stops on the `TEST unknown test` fatal.
- Every log in the README is copied from these runs. The commercial-tool commands were not run, and the README says so.

## Validation

- `node scripts/generate-lab-registry.mjs --stdout`: the manifest parses. I did not write to `src/generated`.
- `NODE_OPTIONS='--require @prisma/client' npx vitest run tests/lib/lab-graders.test.ts tests/app/lab-page.test.tsx tests/api/labs-run.test.ts tests/lib/lab-*.test.ts tests/lib/sv-elaboration-model.test.ts`: 110 passed. This ran against the current (stale) generated registry.
- `npx tsc --noEmit -p .`: clean. No TS or MDX files were touched, so eslint and check-mdx do not apply.

## Shared-file requests (for Integrate)

1. Regenerate `src/generated` lab registry (`fifo-1` becomes `available`, v2).
2. These tests pin `fifo-1` as unavailable and must change after regeneration:
   - `tests/app/lab-page.test.tsx:30`: static params must not contain `fifo-1`.
   - `tests/app/lab-page.test.tsx:79`: `fifo-1` expected to 404.
   - `tests/api/labs-run.test.ts:81`: `fifo-1` gives `LAB_NOT_FOUND`.
   - `tests/e2e/labs.spec.ts:70`: `/practice/lab/fifo-1` expected not available.
   Pick another coming-soon lab (for example `common-1`) as the fixture.
   Also: the count of 23 static params at `tests/app/lab-page.test.tsx:30` changes. The lab's `labPrerequisites` change (`common-1` -> `simple-dut-1`) lands with the registry regeneration.
3. `src/lib/practice-links.ts` `LAB_LESSON_OVERRIDES`, optional: `'fifo-1': ['I-SV-1_OOP/copying-and-cloning']`. That page teaches clone and aliasing, which steps 2, 3, 5 and 8 rely on. Otherwise the lab launches from `I-SV-1_OOP/index`.
4. The I-SV-1 lesson pages should link the lab ("Lab: fifo-1") once it is available. The spine card's "Hands-on that should exist" kata (a transaction with copy/clone/convert2string, and a generator that clones before storing) is covered by this lab.
5. `content/curriculum/labs/compile-units.json:154`: the `fifo` unit still lists the deleted `lab1_simple_tb/test_fifo.sv` (will fail `tests/curriculum/compile-sv.test.ts:101` once multi_agent is fixed). Replace it with two units in compile order, top `tb_top`:
   - `{name: solution, files: [work/sync_fifo.sv, work/fifo_if.sv, solution/fifo_tb_pkg.sv, work/tb_top.sv]}`
   - `{name: starter, files: [work/sync_fifo.sv, work/fifo_if.sv, work/fifo_tb_pkg.sv, work/tb_top.sv]}`

## Fix round 1

- solution `fifo_obs::clone` comment corrected (base clone drops fields silently; no $cast failure).
- 'with no plusargs' replaced by 'without +TEST=' in README and lab.json, with the Verilator error-limit note in steps 1 and 7.
- BUG comments in work/sync_fifo.sv and work/tb_top.sv now point to step 8.
- Step 5 snippet declares `int unsigned cycle = 0;`.
- sync_fifo timeunit comment reworded (3.14.2.3 is precedence, not a requirement).
