# Coverage Closure Loop: ALU

This is the milestone M4 lab of module I-SV-3B, Advanced Functional Coverage. You get a small ALU, its verification plan, a coverage model that carries the plan IDs, a self-checking testbench, and a stimulus generator that cannot close the plan. Your job is to read the report, classify every hole, and make the smallest change that closes the plan on three seeds, without hiding a single scenario.

## Files and how to run

| File | Role | Edit it? |
|---|---|---|
| `alu_pkg.sv` | `op_t`, the reference model `alu_model`, the stimulus class `alu_txn` and the coverage collector `alu_cov` | Yes: the stimulus constraints live in `alu_txn` |
| `alu.sv` | The design under test (DUT): a combinational 8-bit ALU | No |
| `tb_top.sv` | Stimulus loop, the ALU-5 and ALU-6 checks, and the report | Only in the optional step 6 |

Compile in this order: `alu_pkg.sv`, `alu.sv`, `tb_top.sv`. The top level is `tb_top`. Run each seed with the plusarg `+SEED=<n>`; the testbench seeds its own random generator from it, so the same seed always replays the same stimulus with the same code. You need a simulator that supports IEEE 1800-2023 functional coverage (covergroups, crosses and `illegal_bins`). Open-source support for covergroups is partial or absent, so check your tool before you trust the numbers.

## The plan

| Row | Scenario or rule | Coverage item | Check |
|---|---|---|---|
| ALU-1 | every operation: ADD, SUB, MUL, DIV, AND, OR, XOR | `cp_op` (7 bins) | ALU-6 |
| ALU-2 | `a` at its edge values 0 and `8'hFF` | `cp_a` (2 bins) | ALU-6 |
| ALU-3 | `b` at its edge values | `cp_b` (2 bins) | ALU-6 |
| ALU-4 | every operation with each edge of `a` | `x_op_a` (7 × 2 = 14 cells) | ALU-6 |
| ALU-5 | every operation with each edge of `b`; **DIV with `b == 0` is forbidden by the spec** | `x_op_b` (14 cells − 1 illegal = 13 that count) | forbidden-input check in `tb_top`, plus the illegal cross bin |
| ALU-6 | `y` always equals the reference model | none: exercised by ALU-1 to ALU-5 | `y !== alu_model(...)` in `tb_top` |

Values of `a` and `b` other than 0 and `8'hFF` fall in no bin and are not counted. The illegal cell of `x_op_b` is excluded from coverage, and sampling it raises a run-time error from the simulator (IEEE 1800-2023 §19.6.3).

## What the report prints

Each run ends with one `COV` line per coverage item, read from the item's `option.comment`, then a summary and a verdict:

```text
COV ALU-1 cp_op <covered>/<total>
COV ALU-2 cp_a <covered>/<total>
COV ALU-3 cp_b <covered>/<total>
COV ALU-4 x_op_a <covered>/<total>
COV ALU-5 x_op_b <covered>/<total>
COV_SUMMARY seed=<n> items=500 total=<percent> PASS=<n> FAIL=<n> ILLEGAL=<n>
LAB RESULT: CLOSED   (or OPEN)
```

`total` is the covergroup's instance coverage: the average of the five items, weight 1 each. `ILLEGAL` counts forbidden inputs the generator sent; the testbench mirrors the ALU-5 rule because the coverage API has no method that returns illegal-bin hits.

## Pass criterion

The lab is done when **each of seeds 1, 2 and 3** prints `LAB RESULT: CLOSED` within its 500 transactions. That means all five items at 100%, `FAIL=0`, `ILLEGAL=0`, and no illegal-bin error from the simulator. You may change only the constraints of `alu_txn`; changing the coverage model, the bins or the budget does not count.

## Your mission

1. **Run and read.** Run seeds 1, 2 and 3. Copy the five `COV` lines and the summary of each run into a table, one row per plan row. Before you change anything, note which items are short and by how much.
2. **Classify every short item.** For each one, decide its class: *forbidden* (the spec says it must never happen), *unreachable* (legal but impossible in this design), *under-stimulated* (legal and reachable, but rare, or impossible because of a constraint bug) or *unobserved* (it happened, but the collector did not count it). Read the constraint block in `alu_txn` before you decide. For one cell of `x_op_a`, compute the chance that 500 transactions hit it: P = 1 − (1 − p)^N.
3. **Fix the generator bug.** Make the smallest change that lets every operation be generated. Predict the new `total` first, then rerun the three seeds. Some seeds may now also report an `ALU-5` error: note it and keep going; step 5 deals with it.
4. **Steer the rare cells.** Add `dist` constraints that make the edge values of the inputs common enough. Predict the per-cell probability of `x_op_a` and `x_op_b` and the chance that all 27 cells close in 500 transactions. Rerun the three seeds.
5. **Handle what steering exposed.** Read the `ALU-5` errors and the simulator's illegal-bin errors. Classify them, and fix them the way the plan requires. Rerun the three seeds until each prints `LAB RESULT: CLOSED`.
6. **(Optional) Make a hole unobserved on purpose.** In `tb_top.sv`, move `cov.write(t);` into the `n_fail++` branch, so the collector is fed only on failures. Rerun: the checks all pass, yet every `COV` line drops to `0/N`. That is an unobserved hole: the scenarios ran, and only the sampling is wrong. Move the call back.

## Hints (read only when you are stuck)

- **Step 2.** `cp_op` sits at 6/7 on every seed. Which operation is missing, and can any seed produce it? Probability 0 is not "rare".
- **Step 2.** With `a` uniform, one operation with `a == 0` has p = 1/6 × 1/256 = 1/1536 per transaction while one operation is missing, so 500 transactions hit a given cell with probability 1 − (1535/1536)^500 ≈ 28%.
- **Step 4.** Weight *both* edge values of *both* inputs. A `dist` such as `a dist {8'h00 := 1, 8'hFF := 1, [8'h01:8'hFE] :/ 2};` gives each edge probability 1/4. Weighting only `8'hFF` leaves `a == 0` rare.
- **Step 5.** The spec forbids DIV with `b == 0`. Is that a hole to exclude, or a stimulus that must never be generated? What would `ignore_bins` do to a forbidden scenario, and what does §19.6.3 say happens when a cross product is both illegal and ignored?

## The arithmetic

These numbers are averages over seeds, recomputed for this coverage model. One seed is one draw, so your numbers will scatter around them.

- **Starter: about 61%.** `cp_op` is 6/7 = 85.7% (no DIV). Each edge value of `a` and `b` is hit within 500 transactions with probability 1 − (255/256)^500 ≈ 86%, so `cp_a` and `cp_b` average about 86%. Each of the 12 reachable cells of `x_op_a` has p = 1/1536 and is hit with probability ≈ 28%, so `x_op_a` averages 12 × 0.278 / 14 ≈ 24%; `x_op_b` averages 12 × 0.278 / 13 ≈ 26%. The average of the five items is ≈ 61.4%.
- **DIV added, inputs still uniform: about 64%.** `cp_op` closes, but each cross cell now has p = 1/1792 and is hit with probability ≈ 24%. The average rises only to ≈ 64.1%. DIV with `b == 0` has p = 1/1792 too, so about one seed in four reports an ALU-5 error.
- **Only `a` steered: about 82%.** `x_op_a` closes, `x_op_b` stays near 24%, and `cp_b` near 86%: ≈ 82.0%.
- **Both inputs steered, no spec constraint:** every cell closes, but DIV with `b == 0` now has p = 1/28 per transaction. The chance that 500 transactions avoid it is (27/28)^500 ≈ 10⁻⁸, so `ILLEGAL` is never 0 and the verdict stays OPEN.
- **Both inputs steered, with the spec constraint `op == DIV -> b != 8'h00`:** if your solver multiplies the weights and removes the forbidden combinations, P(DIV) becomes 1/9 and every other operation 4/27, so each cell of `x_op_a` and `x_op_b` has p between 1/36 and 1/27. The chance that any of the 38 bins is still empty after 500 transactions is below 2 × 10⁻⁶ per seed. IEEE 1800-2023 §18.5.3 guarantees the weight ratios only "absent any other constraints", so treat these figures as estimates and let the `COV` lines confirm them.

## Note on grading

The steps are self-checked for now: the lab page cannot run a covergroup-capable simulator yet. The report format above is the grading contract a future automatic grader will parse.
