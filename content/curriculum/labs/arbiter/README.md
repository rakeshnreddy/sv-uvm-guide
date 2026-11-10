# Lab: Verify a round-robin arbiter with UVM

This lab is the independent variant of [I-UVM-3C: Your First Complete UVM Testbench](/curriculum/T2_Intermediate/I-UVM-3C_First_Complete_Testbench/index). Do the lesson and its guided lab, `uvm-mini-capstone`, first. There you completed a FIFO environment that the lesson had already built for a similar DUT. Here you get a specification and a skeleton, and you decide most of the code yourself.

The DUT is `rr_arbiter`, a synchronous round-robin arbiter for four requesters. An arbiter has two kinds of bug. The first kind is a wrong winner, which a reference model catches the moment it happens. The second kind is starvation: a requester that keeps asking and never wins. Starvation is a property of a whole run, not of one cycle, so you check it separately, as a fairness bound. The lab ends with a planted starvation bug that a single-requester smoke test passes.

## What you will practise

- An agent that always builds its monitor, and builds its sequencer and driver only when `get_is_active() == UVM_ACTIVE` (IEEE 1800.2-2020 §13.4.2.2). This is I-UVM-2A's agent shape.
- A driver that drives only through a clocking block, and a monitor that samples only through one and publishes a new transaction object every cycle (IEEE 1800-2023 §14.4, §14.13, §14.16).
- A scoreboard with two independent checks, both written from the specification: a grant predictor and a fairness bound. It also keeps the accounting that turns "nothing was checked" into an error.
- A covergroup whose bins come from the plan: who won, under how much contention, and after how long a wait.
- Directed sequences chosen from a plan table, and proof that the environment fails on planted bugs.

## Files

- `work/rr_arbiter.sv`: the DUT. Read the specification below, not its RTL, when you write the scoreboard. It is editable only for step 6.
- `work/arb_if.sv`: the interface and its two clocking blocks. Complete.
- `work/arb_pkg.sv`: the starter UVM package. It compiles and runs, but checks nothing. Each `TODO step N` comment marks code you write in step N. The items, the sequencer type, the base sequence's `send()`, the env's build and the tests are already written.
- `work/tb_top.sv`: clock, reset, DUT, interface, `uvm_config_db` set and `run_test()`. Complete.
- `solution/arb_pkg.sv`: one reference solution. Open it only after you finish.

Compile order: `uvm_pkg`, then `work/arb_if.sv`, then the package (`work/arb_pkg.sv` or `solution/arb_pkg.sv`), then `work/rr_arbiter.sv` and `work/tb_top.sv`. The commands are under [Running the lab](#running-the-lab).

## The DUT: a round-robin arbiter

| Port | Direction | Meaning |
|---|---|---|
| `clk` | input | Clock. The pointer moves on its rising edge. |
| `rst_n` | input | Synchronous reset, active low. |
| `req` | input, 4 bits | `req[i]` is 1 while requester `i` asks for the resource. |
| `gnt` | output, 4 bits | `gnt[i]` is 1 in the cycle requester `i` wins. Combinational from `req` and the pointer. |

The arbiter remembers one thing: the **last winner**. Every cycle:

- **R1.** `gnt` is zero or one-hot, and `gnt[i]` is 1 only when `req[i]` is 1.
- **R2.** When at least one `req` bit is 1, exactly one `gnt` bit is 1.
- **R3.** The winner is the first requester found by searching from the index after the last winner, upward, wrapping from 3 to 0.
- **R4.** On a rising edge of `clk` with a grant, the winner becomes the last winner. With no grant, the last winner does not change.
- **R5.** On a rising edge of `clk` with `rst_n` at 0, the last winner becomes 3, so after reset requester 0 is searched first.

**The fairness bound** follows from R3 and R4. Each cycle grants one requester. That requester then moves to the back of the search order, so the others move up. A requester that holds `req` is therefore granted within 4 cycles, after at most 3 grants to others. A requester that has waited 4 cycles with `req` held is starving.

The parameter `BUG` plants a known bug for step 6. `tb_top` sets it from the define `ARB_BUG`. Leave it at 0 until then.

## How the environment sees a cycle

```text
          edge k                      edge k+1
            |                           |
  drv_cb:   req <= item.req (lands just after edge k, output skew #0)
  DUT:      gnt follows req at once (combinational); the pointer moves at edge k+1 (R4)
  mon_cb:                     samples req and gnt just before edge k+1 (input skew #1step)
  monitor:                    one new arb_txn {req, gnt} -> agent.ap -> scoreboard, coverage
```

`mon_cb` samples with the default input skew, `#1step`. That gives the values just before the edge, which are the `req` and `gnt` the pointer flip-flop uses at that edge (IEEE 1800-2023 §14.4: "the default input skew is 1step and the default output skew is 0"). So one sample is exactly one arbitration decision, and the scoreboard can advance its model once per sample. `drv_cb` drives with output skew 0: the new `req` lands just after the edge (§14.16), so the DUT sees it for the whole following cycle.

## Step 1: Run the starter

Compile with `work/arb_pkg.sv` and run with no plusargs. The test is `arb_regress_test`, the `run_test()` default. Captured from a Verilator 5.052 run (see [Running the lab](#running-the-lab)), with the banner left out:

```text
UVM_INFO @ 0: reporter [RNTST] Running test arb_regress_test...
UVM_INFO work/arb_pkg.sv(289) @ 5000: uvm_test_top.env.cov [ARB_COVERAGE] grant-pattern coverage = 0.00%
UVM_INFO work/arb_pkg.sv(255) @ 5000: uvm_test_top.env.scb [ARB_SUMMARY] ARB_SUMMARY cycles=0 grants=0 mismatches=0 protocol=0 starved=0
UVM_ERROR :    0
UVM_FATAL :    0
```

Before you read on: `UVM_ERROR : 0` and `mismatches=0`. Is this a pass?

<details>
<summary>Answer: a vacuous pass</summary>

No. Nothing ran. The sequences are empty, so the test drops its objection at time 0 and the run ends after the 5 ns drain time. Even with stimulus, nothing would be checked: the monitor publishes nothing, the env connects nothing, and the scoreboard counts nothing. A regression script that looks only for `UVM_ERROR : 0` would mark this run green. In step 3, `check_phase` turns "no grant was seen" into an `ARB_NO_TRAFFIC` error.

</details>

## Step 2: Driver, monitor and agent

1. **Driver.** First wait for a `drv_cb` edge at which reset was already released: `do @(vif.drv_cb); while (vif.drv_cb.rst_n !== 1'b1);`. Then, forever: `seq_item_port.get_next_item(req)`. Do the following `req.cycles` times: drive `vif.drv_cb.req <= req.req;` and wait `@(vif.drv_cb)`. Then call `seq_item_port.item_done()` (§15.2.1.2.1, §15.2.1.2.3). The driver writes no interface signal directly, only through `drv_cb`.
2. **Monitor.** Forever: wait `@(vif.mon_cb)`. When `vif.mon_cb.rst_n === 1'b1`, create a **new** `arb_txn`, copy `mon_cb.req` and `mon_cb.gnt` into it, and `ap.write()` it. Publish idle cycles too, with `req` at 0: R2 says they must have no grant, and the fairness count needs every cycle.
3. **Agent.** In `build_phase`: create `mon` always, and `sqr` and `drv` only when `get_is_active() == UVM_ACTIVE`. In `connect_phase`: `mon.ap.connect(ap)`. When active, also connect `drv.seq_item_port` to `sqr.seq_item_export`.

<details>
<summary>Why must the monitor create a new object every cycle?</summary>

`write()` hands the subscribers a handle, not a copy (§12.2.10). If the monitor reused one object, a subscriber that keeps the handle, such as a queue in a scoreboard, would see every stored transaction change into the newest one. This scoreboard checks inside `write()` and keeps nothing, so a reused object would happen to work here. It would then break in the next scoreboard that stores transactions. A new object per transaction is the rule, not an optimization.

</details>

## Step 3: The scoreboard

Write both checks from R1 to R5, not from `rr_arbiter.sv`. A model copied from the RTL repeats its bugs and can never disagree with it.

1. **`build_phase`.** Set `last = ARB_N - 1`. That is R5, and the monitor publishes nothing during reset. If `$test$plusargs("ARB_FAIRNESS_ONLY")` is true, clear `check_order`. Step 6 uses it.
2. **`predict(r)`.** For `k` from 1 to `ARB_N`, take `idx = (last + k) % ARB_N`. Return `req_t'(1) << idx` for the first `idx` with `r[idx]` set, and `'0` if there is none.
3. **`write(t)`**, in this order:
   1. Count the cycle in `n_cycles`, and the grant in `n_grants` when `t.gnt != 0`.
   2. R1: count `n_protocol` and report `ARB_PROTOCOL` when `!$onehot0(t.gnt)`, or when `(t.gnt & ~t.req) != 0`. `$onehot0` is 1 when at most one bit is 1 (§20.9).
   3. R2, R3: when `check_order` is 1 and `t.gnt !== predict(t.req)`, count `n_mismatch` and report `ARB_MISMATCH` with the observed and the expected grant.
   4. R4: move `last` to the index of the **predicted** grant, never the DUT's. A model that follows the DUT resynchronizes to its bugs, so after one mismatch it would agree with every wrong cycle that followed.
   5. Fairness, for every requester `i`: on `t.gnt[i]`, or when `t.req[i]` is 0, clear `wait_cnt[i]` and `starving[i]`. Otherwise increment `wait_cnt[i]`. When it reaches `ARB_N` and `starving[i]` is clear, set `starving[i]`, count `n_starved` and report `ARB_STARVED` once for this wait. This check uses the DUT's grants: it asks whether the DUT kept its promise, whatever the predictor says.
4. **`check_phase`.** Report `ARB_NO_TRAFFIC` when `n_grants == 0`.
5. **The env.** Connect `agent.ap` to `scb.analysis_export`.

<details>
<summary>Why two checks, when the predictor already catches every wrong winner?</summary>

They answer different questions. The predictor checks one exact policy, cycle by cycle. The fairness bound checks a property that every fair policy must have. That is the property a system architect cares about, and the specification states it on its own. If the specification allowed any fair order, the predictor would be wrong and the bound would still be right. The two checks also fail differently. A wrong winner shows up as an `ARB_MISMATCH` at the first wrong cycle. Starvation shows up as an `ARB_STARVED` that names the victim. Step 6 turns the predictor off and shows that the bound still catches the bug.

</details>

## Step 4: Sequences from the plan, and coverage

Write the two sequence bodies from this plan with `send(r, c)`, which holds request vector `r` for `c` cycles:

| Plan row (rule) | Sequence | Stimulus, in order | The check proves |
|---|---|---|---|
| P1: an uncontended grant (R1, R2) | `arb_smoke_seq` | `4'b0001`, `4'b0010`, `4'b0100`, `4'b1000`, 2 cycles each; then `'0` for 2 cycles | a lone requester always wins, and the path works end to end |
| P2: full load rotates (R3, R4, the bound) | `arb_load_seq` | `'1` for 8 cycles, then `'0` for 1 cycle | the grant rotates 0, 1, 2, 3 and wraps; every requester waits at most 3 cycles |
| P3: partial contention (R3) | `arb_load_seq`, continued | `4'b0101` for 4 cycles, `4'b1010` for 4 cycles, then `'0` for 2 cycles | the search skips requesters that do not ask, and wraps from 3 to 1 |

End every sequence with idle cycles. The last samples then see `req` at 0, and the run ends after the final decision has been checked.

Then the coverage subscriber. Complete `arb_cg` with these coverpoints (§19.5) and the cross (§19.6):

| Item | Bins | Plan row |
|---|---|---|
| `cp_gnt: coverpoint g_idx` | `idx[] = {[0:ARB_N-1]}`: one bin per winner | P1 to P3 |
| `cp_load: coverpoint n_req` | `one = {1}`, `some = {[2:ARB_N-1]}`, `all = {ARB_N}` | P1, P3, P2 |
| `cp_wait: coverpoint g_wait` | `w[] = {[0:ARB_N-1]}`: the winner had waited 0, 1, 2 or 3 cycles | P2: the bound reached exactly |
| `x_gnt_load: cross cp_gnt, cp_load` | 12 bins: every requester wins alone, under partial load and under full load | P1 to P3 |

In `write(t)`: when `$onehot(t.gnt)`, set `g_idx` to the winner, `n_req = $countones(t.req)` and `g_wait = wait_cnt[g_idx]`, then call `arb_cg.sample()`. Then update every `wait_cnt[i]` the way the scoreboard does. The `w[3]` bin is the interesting one. Only sustained full load makes a requester wait the full bound, and it is the cycle in which a fairness bug would first show. Connect `agent.ap` to `cov.analysis_export` in the env.

## Step 5: The clean regression

Run `arb_regress_test` (no plusargs) on the correct DUT. Captured from a Verilator 5.052 run:

```text
UVM_INFO ... @ 330000: uvm_test_top.env.cov [ARB_COVERAGE] grant-pattern coverage = 100.00%
UVM_INFO ... @ 330000: uvm_test_top.env.scb [ARB_SUMMARY] ARB_SUMMARY cycles=30 grants=24 mismatches=0 protocol=0 starved=0
UVM_ERROR :    0
UVM_FATAL :    0
```

UVM prints the time with `%t`. Unless a `$timeformat` call changes it, `%t` uses the default units of IEEE 1800-2023 §20.4.3 (Table 20-3), the smallest time precision in the source. With this lab's 1 ps precision, Verilator 5.052 printed picoseconds, so `330000` means 330 ns. Reset ends at the edge at 25 ns, and the monitor's first sample is at 35 ns. That sample is an idle cycle, because the driver's first drive lands just after it. Smoke adds 10 samples (45 to 135 ns) and load adds 19 (145 to 325 ns), which makes 30 cycles. 24 of them have a grant: 8 in smoke, 8 at full load and 8 in the pairs. The sequence ends at 325 ns and the 5 ns drain time ends the run at 330 ns.

Now run each half alone, with `+UVM_TESTNAME=arb_smoke_test` and `+UVM_TESTNAME=arb_load_test`:

| Test | Summary line | Coverage, by IEEE 1800-2023 §19.11 | Coverage printed by Verilator 5.052 |
|---|---|---|---|
| `arb_regress_test` | `cycles=30 grants=24 mismatches=0 protocol=0 starved=0` | 100.00% | 100.00% |
| `arb_smoke_test` | `cycles=11 grants=8 mismatches=0 protocol=0 starved=0` | 47.92% | 43.48% |
| `arb_load_test` | `cycles=20 grants=16 mismatches=0 protocol=0 starved=0` | 83.33% | 78.26% |

<details>
<summary>Which bins does each half leave empty, and why do the two coverage columns differ?</summary>

Smoke never has contention. It fills all of `cp_gnt` and the `one` bin of `cp_load`, but only `w[0]` of `cp_wait` and the 4 "alone" bins of the cross. Load never has a lone requester. It misses `one`, and the 4 "alone" bins of the cross, but it reaches every wait, `w[3]` included.

§19.11 defines a covergroup's coverage as the weighted average of its items' coverage, and every item here has weight 1. For smoke that is (4/4 + 1/3 + 1/4 + 4/12) / 4 = 47.92%. Verilator 5.052 printed the share of all 23 bins that were hit, 10/23 = 43.48%, so its partial numbers are not the standard's. Both agree at 100%. Other simulators should print the §19.11 values. Check yours, and close on 100%, not on a partial number.

</details>

## Step 6: Prove that the environment can fail

A check you have never seen fail is no evidence. Plant each bug, **predict** which tests catch it, run, then compare with the table. `+define+ARB_BUG=<n>` is a compile option, so recompile for each value.

1. **`ARB_BUG=1`, a starvation bug.** When requester 3 wins, the pointer does not move. While 3 keeps asking, the search starts at 3 again, so 3 wins every cycle and 0, 1 and 2 starve. Run `arb_smoke_test`, then `arb_regress_test`.
2. **The bound alone.** With `ARB_BUG=1`, run `arb_regress_test +ARB_FAIRNESS_ONLY`. The predictor no longer compares, and the fairness bound must catch the bug on its own.
3. **`ARB_BUG=2`, fixed priority.** The pointer never moves, so the search always starts at 0. Run all three tests.
4. **Your own bug: the last winner keeps priority.** Set `ARB_BUG` back to 0. In `work/rr_arbiter.sv`, change the search loop from `for (int k = 1; k <= N; k++)` to `for (int k = 0; k < N; k++)`, so that the search starts **at** the last winner. Run all three tests.
5. Undo your edit, rebuild without `ARB_BUG` and rerun `arb_regress_test`. It must end `mismatches=0 protocol=0 starved=0`. A planted bug proves the environment, then it goes.

Summary lines, captured from Verilator 5.052 runs of the reference solution:

| Test | correct DUT | `ARB_BUG=1` | `ARB_BUG=2` | your bug (search from the last winner) |
|---|---|---|---|---|
| `arb_smoke_test` | `mismatches=0 starved=0` | `mismatches=0 starved=0`, escapes | `mismatches=0 starved=0`, escapes | `mismatches=0 starved=0`, escapes |
| `arb_load_test` | `mismatches=0 starved=0` | `mismatches=5 starved=4` | `mismatches=10 starved=5` | `mismatches=10 starved=5` |
| `arb_regress_test` | `mismatches=0 starved=0` | `mismatches=8 starved=4` | `mismatches=10 starved=5` | `mismatches=10 starved=5` |
| `arb_regress_test +ARB_FAIRNESS_ONLY` | `mismatches=0 starved=0` | `mismatches=0 starved=4` | `mismatches=0 starved=5` | not run |

Every row has the same `cycles` and `grants` as the clean run, and `protocol=0`: none of these bugs ever grants two requesters, or grants one that is not asking. `UVM_ERROR` equals `mismatches + starved`.

`ARB_BUG=1` with `arb_regress_test`, the scoreboard's errors (file and line fields shortened):

```text
UVM_ERROR ... @ 145000: uvm_test_top.env.scb [ARB_MISMATCH] req=1111 gnt=1000, expected gnt=0001
UVM_ERROR ... @ 155000: uvm_test_top.env.scb [ARB_MISMATCH] req=1111 gnt=1000, expected gnt=0010
UVM_ERROR ... @ 165000: uvm_test_top.env.scb [ARB_MISMATCH] req=1111 gnt=1000, expected gnt=0100
UVM_ERROR ... @ 175000: uvm_test_top.env.scb [ARB_STARVED] requester 0 has waited 4 cycles; the bound is 3
UVM_ERROR ... @ 175000: uvm_test_top.env.scb [ARB_STARVED] requester 1 has waited 4 cycles; the bound is 3
UVM_ERROR ... @ 175000: uvm_test_top.env.scb [ARB_STARVED] requester 2 has waited 4 cycles; the bound is 3
UVM_ERROR ... @ 185000: uvm_test_top.env.scb [ARB_MISMATCH] req=1111 gnt=1000, expected gnt=0001
UVM_ERROR ... @ 195000: uvm_test_top.env.scb [ARB_MISMATCH] req=1111 gnt=1000, expected gnt=0010
UVM_ERROR ... @ 205000: uvm_test_top.env.scb [ARB_MISMATCH] req=1111 gnt=1000, expected gnt=0100
UVM_ERROR ... @ 285000: uvm_test_top.env.scb [ARB_MISMATCH] req=1010 gnt=1000, expected gnt=0010
UVM_ERROR ... @ 305000: uvm_test_top.env.scb [ARB_MISMATCH] req=1010 gnt=1000, expected gnt=0010
UVM_ERROR ... @ 305000: uvm_test_top.env.scb [ARB_STARVED] requester 1 has waited 4 cycles; the bound is 3
UVM_INFO ... @ 330000: uvm_test_top.env.scb [ARB_SUMMARY] ARB_SUMMARY cycles=30 grants=24 mismatches=8 protocol=0 starved=4
UVM_ERROR :   12
```

What the table teaches:

- **Every arbitration bug escapes the smoke test.** With one requester there is nothing to arbitrate: any arbiter that obeys R1 and R2 grants a lone requester. That is why `x_gnt_load` asks for every winner under partial and full load. A test that fills only the "alone" bins has not tested arbitration.
- **The bug hides in the first smoke grant to requester 3.** At 105 ns the buggy DUT grants 3 and keeps its pointer at 2. The model moves to 3. Both agree while 3 is alone, so nothing is reported. The disagreement appears at 145 ns, at the first contended cycle. The predictor is right to report it there.
- **At 175 and 215 ns the predictor agrees with the buggy DUT.** The model's own rotation comes back round to 3 just as the DUT grants 3 again. The fairness bound is what keeps reporting the victims.
- **The bound fires one cycle after the last legal wait.** Requesters 0, 1 and 2 start waiting at 145 ns. At 175 ns they have waited 4 cycles, one more than the bound allows.

## Stretch

- **Random stimulus.** Run `+UVM_TESTNAME=arb_random_test`: 60 random request vectors, each held 1 to 4 cycles, then 2 idle cycles. The results depend on your simulator's random generator and the seed, so no summary line is given. It must end with `mismatches=0 protocol=0 starved=0` and some grants. Compare its coverage with the directed regression's, and find the bins it needs most cycles to hit. Usually that is `w[3]`, because a four-requester vector must persist for several cycles.
- **A passive instance.** Add a test that sets `is_active` to `UVM_PASSIVE` for `env.agent`, with `uvm_config_db#(uvm_active_passive_enum)::set(this, "env.agent", "is_active", UVM_PASSIVE)` in `build_phase`. Drive `bus.req` from a small `initial` block in a second top module instead, and call `print_topology()` at the end of elaboration. The topology has no `sqr` and no `drv`, and the scoreboard and coverage work unchanged.
- **Clients that let go.** Real clients drop `req` after they win. Write a sequence, or a reactive driver, that models four clients that each request until granted and then drop. Which of the three bugs still escape?

## Running the lab

You need uvm-core 2020.3.1 (IEEE 1800.2-2020): your simulator's built-in UVM library, or `src/uvm_pkg.sv` from the Accellera kit with `src` on the include path. Files that declare no time unit, such as `uvm_pkg`, need a default time unit and precision of 1 ns / 1 ps. Every lab file declares `timeunit 1ns; timeprecision 1ps;`, and IEEE 1800-2023 §3.14.2.3 makes it an error when some design elements have a time unit and others do not. These are typical invocations. Check your simulator's documentation, because options differ between tools and versions.

Commercial simulators ship their own UVM library and select it, and the IEEE 1800.2-2020 version of it, with options that differ by tool and version: check your simulator's documentation. Compile the four lab files in the order above, set the 1 ns / 1 ps default, and pass `+UVM_TESTNAME=<test>` at run time.

```bash
# Verilator 5 with the Accellera kit; UVM_HOME points at the unpacked 2020.3.1 kit
verilator --binary --timing -Wno-fatal -Wno-lint -Wno-style --timescale 1ns/1ps \
  +define+UVM_NO_DPI -I$UVM_HOME/src $UVM_HOME/src/uvm_pkg.sv \
  work/arb_if.sv work/arb_pkg.sv work/rr_arbiter.sv work/tb_top.sv --top-module tb_top -j 4
./obj_dir/Vtb_top +UVM_TESTNAME=arb_smoke_test
```

Leave out `+UVM_TESTNAME` to run `arb_regress_test`. Add `+define+ARB_BUG=1` (or `=2`) to the compile for step 6. For the reference solution, replace `work/arb_pkg.sv` with `solution/arb_pkg.sv`.

Notes on Verilator, which this lab was run on (version 5.052):

- **UVM builds and runs.** Building `uvm_pkg` takes a few minutes and a few hundred megabytes in `obj_dir`. Without `+define+UVM_NO_DPI`, the link fails on UVM's C functions (`uvm_hdl_*`, `uvm_re_*`) unless you also compile `src/dpi/uvm_dpi.cc`. With the define, UVM prints two warnings, `NO_DPI_USED` and `NO_VISIT_CHECK`. It cannot read or force signals by path (`uvm_hdl_*`), and it cannot match regular expressions in some command-line and name checks. This lab needs none of them.
- **Constrained randomization needs a solver.** Verilator hands `randomize()` with constraints to an external SMT solver, z3 or cvc5, at run time. Without one, every `randomize()` fails and `arb_random_test` stops at once with `ARB_RAND`. The directed tests do not randomize.
- **Coverage percentages.** Verilator collected the covergroup, but it printed partial coverage as a share of all bins, not as the §19.11 average (step 5).
- **2-state.** Verilator has no x or z, so an x on `gnt` would never appear there. The scoreboard compares with `!==`, which also catches x and z on a 4-state simulator.

## How a run reports PASS or FAIL

- **The verdict is the report summary.** A clean run has `UVM_ERROR :    0`, `UVM_FATAL :    0`, an `ARB_SUMMARY` line with `mismatches=0 protocol=0 starved=0`, and an `ARB_COVERAGE` line at 100.00% for the regression. A missing summary line means the run died before `report_phase`, for example with `PH_TIMEOUT` after 100 us.
- **`uvm_error`** reports a failed check and lets the run continue, so one run shows every failure. **`uvm_fatal`** is for a broken bench: no virtual interface, or a failed `randomize()`.
- **Exit status is tool-dependent.** Decide PASS or FAIL from the report counts and the summary line, not from the process exit status.

## Completion checklist

- [ ] The agent builds `sqr` and `drv` only when active, and promotes `mon.ap` to `ap`.
- [ ] The driver drives only through `drv_cb` and calls `item_done()` once per item. The monitor samples only through `mon_cb` and publishes a new `arb_txn` every cycle after reset.
- [ ] The scoreboard's predictor follows its own predictions, and its fairness check follows the DUT's grants. Both were written from R1 to R5.
- [ ] A run that saw no grant fails with `ARB_NO_TRAFFIC`.
- [ ] `arb_regress_test` ends `cycles=30 grants=24 mismatches=0 protocol=0 starved=0` with 100.00% coverage.
- [ ] I have seen `ARB_BUG=1`, `ARB_BUG=2` and my own bug escape `arb_smoke_test` and fail `arb_regress_test`, and I have seen the fairness bound alone catch `ARB_BUG=1`.

> **Ready to compare?** Open `solution/arb_pkg.sv` after you finish.

## References

- IEEE 1800.2-2020: §12.2.10 analysis ports and imps (§12.2.10.1 `uvm_analysis_port`, §12.2.10.2 `uvm_analysis_imp`); §13.4 `uvm_agent` (§13.4.2.2 `get_is_active`); §13.5 `uvm_monitor`; §13.6 `uvm_scoreboard`; §13.7 `uvm_driver`; §13.9 `uvm_subscriber`; §15.2.1.2.1 `get_next_item`, §15.2.1.2.3 `item_done`; §10.5.1.3.3 `raise_objection`, §10.5.1.3.4 `drop_objection`, §10.5.1.3.7 `set_drain_time`; F.7.3.1 `run_test`.
- IEEE 1800-2023: §3.14.2.3 time-unit precedence; §14.3 clocking blocks, §14.4 input and output skews, §14.13 input sampling, §14.16 synchronous drives; §19.5 coverage points, §19.6 cross coverage, §19.11 coverage computation; §20.9 `$countones`, `$onehot`, `$onehot0`.
