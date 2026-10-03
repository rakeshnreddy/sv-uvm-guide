# The Coverage Closure Loop Lab

You have a simple 8-bit ALU testbench. The goal is to see every ALU operation (ADD, SUB, MUL, DIV, AND, OR, XOR) and the edge values `0` and `8'hFF` on both inputs, and to see every operation with `a == 0` and with `a == 8'hFF`.

## Read the coverage model first

`alu_cov_mon.sv` has four items, each with weight 1, and the score is their average:

| Item | Bins that count |
|---|---|
| `cp_op` | 7: one automatic bin per enum value |
| `cp_a` | 2: `zero` and `max` (`others` is a default bin, which never counts) |
| `cp_b` | 2: `zero` and `max` |
| `cross_edge_op` (`cp_op` × `cp_a`) | 14: 7 operations × {`zero`, `max`}. Default bins are excluded from crosses. |

## Scenario

The testbench runs 500 random transactions and ends at about **70%**. With uniform 8-bit inputs, a given value appears about once in 256 samples:

- `cp_op` is 6/7 = 85.7%: `DIV` is never generated.
- `cp_a` and `cp_b` are usually 100%, sometimes 50%: each edge value is hit in 500 samples with probability 1 − (255/256)^500 ≈ 0.86, so on average about 86%.
- `cross_edge_op` is about 24%: a specific operation with `a == 0` has probability 1/6 × 1/256 per sample, so each reachable cross bin is hit with probability ≈ 0.28, and the 2 `DIV` bins never are.

The expected average is (85.7 + 85.9 + 85.9 + 23.8) / 4 ≈ 70%. Your exact number depends on the seed.

## Your Mission

1. **Run and analyze.** Note the score and which bins are empty (use your simulator's coverage report if it has one).
2. **Add the missing operation.** Add `DIV` to the `inside` list. `cp_op` reaches 100%, but the score only rises to about 74%: the cross still needs each operation together with both edge values of `a`.
3. **Weight both edge values.** Add a `dist` for `a` and for `b` that gives real weight to `0` **and** `8'hFF`, for example:

   ```systemverilog
   a dist { 8'h00 := 1, 8'hFF := 1, [8'h01:8'hFE] :/ 2 };
   b dist { 8'h00 := 1, 8'hFF := 1, [8'h01:8'hFE] :/ 2 };
   ```

   Now P(a == 0) = P(a == 8'hFF) = 1/4, so each of the 14 cross bins has probability 1/4 × 1/7 = 1/28 per sample. The chance that any of them is still empty after 500 samples is below 14 × (27/28)^500 ≈ 2 × 10^-7, and the test prints `Final ALU Coverage: 100.00%` and `SUCCESS: Coverage Closed!`.

Weighting only `8'hFF` is not enough: `a == 0` stays near 1/512, most `op × zero` cross bins stay empty, and the score stalls near 80%.

## Note on tools

Covergroups need a simulator with functional-coverage support. Many open-source simulators support them only partially or not at all, so check your tool before you trust the score.
