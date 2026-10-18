# AXI Out-of-Order Scoreboard Lab (B-AXI-6, milestone M6)

## Objective

Build the two components that make an AXI environment ID-aware, then prove them against a slave that reorders, interleaves, stalls and injects errors:

1. `axi_rd_monitor` (`axi_monitor.sv`): rebuilds each read from its AR handshake and its R beats, with **one ordered queue of open reads per ARID**.
2. `axi_rd_scoreboard` (`axi_scoreboard.sv`): compares each completed read with the prediction made at its AR handshake, with **one ordered queue of expected reads per ARID**, and accounts for every read at the end of the test.

The pass signature is `SCB_SUMMARY matches=40 mismatches=0 pending=0` with `UVM_ERROR :    0`, and each of four mutants must produce at least one named error.

## What you need first

- [The B-AXI-6 lesson](/curriculum/T3_Advanced/B-AXI-6_AXI_Verification_Performance/index), especially "The read monitor" and "The per-ID read scoreboard". This lab is its Make It Work environment without coverage and performance.
- The AXI ordering rules: same-ARID data returns in issue order; different ARIDs may complete in any order and their beats may interleave (Arm IHI0022E §A5.3, §A5.3.1).
- A local simulator with IEEE 1800.2 UVM (uvm-core 2020.3.1 or your vendor's library), concurrent assertions and clocking blocks. The in-browser runner cannot run UVM, so this lab is self-attested.

## Files

| File | Role | What it holds |
|---|---|---|
| `testbench.sv` | reference, read-only | the interface `axi_rd_if` with clocking blocks, the bound checker `axi_rd_checker`, and package `axi_rd_pkg`: configuration, reference memory, item, sequence, master driver, reordering responder, predictor, environment, test, and `tb_top`. It includes your two files inside the package. |
| `axi_monitor.sv` | starter, you edit | `axi_rd_monitor`: complete `on_ar()` and `on_r_beat()` |
| `axi_scoreboard.sv` | starter, you edit | `axi_rd_scoreboard`: complete `write_act()` and `check_phase()` |
| `solution.sv` | solution | both classes, complete |
| `write_pairing.sv` | starter, stretch step | `axi_wr_pairer`: AXI4 write reassembly without WID |
| `write_pairing_tb.sv` | reference, stretch step | replays a write trace through `axi_wr_pairer` |
| `write_pairing_solution.sv` | solution, stretch step | `axi_wr_pairer`, complete |

The starters compile as given. With them, the run ends with `[EOT] 0 of 40 reads compared`: a bench that checks nothing must not pass.

## What the testbench does

- The master issues 40 random reads with ARIDs 0 to 3 (so several reads with one ID are often outstanding), ARLEN 0 to 7, INCR with 4-byte beats, up to 8 reads open at once, and a random RREADY.
- The responder plays the slave. It queues each accepted AR per ID and answers only the oldest read of each ID, but picks any ID next (reads overtake), and may switch ID between beats of one burst (interleaving). ARREADY is random and R has random idle cycles. Reads in the window `0x3000` to `0x30FF` answer SLVERR on every beat in the window, which is a legal response (§A3.4.4).
- The predictor builds each expected read at its AR handshake from the reference memory (`data = addr ^ 32'hC0DE_0000`), so reads of different addresses never carry the same data.
- `+MUTANT=<name>` makes the responder break one rule, once:

| Mutant | What the slave does wrong | What must catch it |
|---|---|---|
| `SAME_ID_SWAP` | answers the younger of two same-ID reads first | scoreboard: two `SCB_MISMATCH ... beat 0 data` when the two lengths are equal. When they differ: two monitor `RLAST` errors, one `SCB_MISMATCH ... beat count` and one `... beat 0 data`, then `UNEXPECTED_R` for the leftover beats (or a further mismatch if another read with that ID is open) |
| `DROP_RLAST` | sends the last beat without RLAST | monitor: `RLAST` on beat N of N |
| `EXTRA_BEAT` | sends one more beat, with RLAST, after a read is complete | monitor: `UNEXPECTED_R` (or `RLAST`/`SCB_MISMATCH` if a new same-ID read was already open). The checker also reports `AXI_CHK` errors: the extra RLAST leaves its counters one completion ahead, so `a_r_after_ar` fires at RVALID edges while only one read is in flight |
| `WRONG_RID` | after the last AR, answers every beat of one read with an ID that was never issued; it picks a read that is the last with its ID | monitor: `UNEXPECTED_R` once per beat of that read; then the test's `[EOT]` warning after the timeout, scoreboard `SCB_PENDING`, test `[EOT] 39 of 40 reads compared` and `pending=1` |

## Instructions

### Step 1: The monitor (`axi_monitor.sv`)

Complete the TODOs.
- In `on_ar()`, create a new item, copy ARID, ARADDR and ARLEN, and `push_back` it into `open_q[ARID]`. Publish a **separate** copy on `req_ap` for the predictor.
- In `on_r_beat()`, report `UNEXPECTED_R` if no read with that RID is open (test `exists()` first). Otherwise append RDATA and RRESP to the **oldest** open read of that RID, `open_q[RID][0]`. RLAST must be HIGH exactly on beat ARLEN + 1; report `RLAST` otherwise. On RLAST, or on beat ARLEN + 1 even without RLAST, `pop_front` the read and publish it on `ap`.
- Do not report SLVERR or DECERR. The monitor records responses; the scoreboard compares them with the prediction.

The common mistake is one slot per ID (`open_q[id] = t`). It works until two reads with one ID are outstanding, which this testbench makes happen in almost every run.

### Step 2: The scoreboard (`axi_scoreboard.sv`)

- In `write_act()`, report `SCB_UNEXPECTED` if no expected read with that ID is queued. Otherwise `pop_front` the oldest expected read for that ID, compare with `e.diff(a)` and count a match or report `SCB_MISMATCH`.
- In `check_phase()`, report `SCB_PENDING` for every ID whose queue is not empty.

A single queue for all IDs fails this testbench on its first legal reorder; a "claim any matching prediction" search would let `SAME_ID_SWAP` escape.

### Step 3: The clean run

Compile `testbench.sv` with `tb_top` as the top module and run it with no plusargs. Expected (illustrative; numbers depend on the seed):

```text
UVM_INFO … uvm_test_top [CFG] mutant=NONE reads=40
UVM_INFO … uvm_test_top.env.scb [SCB_SUMMARY] matches=40 mismatches=0 pending=0
...
UVM_ERROR :    0
UVM_FATAL :    0
```

Run three or four seeds (your simulator's seed option; tool-dependent). The clean run must stay clean on every seed.

### Step 4: The mutants

Run once with each of `+MUTANT=SAME_ID_SWAP`, `+MUTANT=DROP_RLAST`, `+MUTANT=EXTRA_BEAT` and `+MUTANT=WRONG_RID`. Each run must end with at least one `UVM_ERROR`, from the component named in the mutant table. If a mutant passes, or the named error is missing, your monitor or scoreboard is missing the check that the table names. For `EXTRA_BEAT`, look for the monitor's `UNEXPECTED_R` (or `RLAST`) line itself: the reference checker's `AXI_CHK` errors make that run fail even when your monitor checks nothing.

`WRONG_RID` is timed to hit the last read of an ID on purpose. The monitor never receives a beat with the answered read's ID, so that read stays at the head of `open_q[ID]`; if a later read used the same ID, its beats would be attributed to the stale entry and the log would show `SCB_MISMATCH` and `RLAST` errors on later reads instead of one `SCB_PENDING`. When a real run shows a cascade like that, debug its first error.

### Step 5 (stretch): The write path

AXI4 write data has no ID: the n-th complete W burst belongs to the n-th AW, and W may arrive before its AW (§A5.4.1, §A3.3). Complete `axi_wr_pairer` in `write_pairing.sv`: an AW FIFO, a FIFO of complete W bursts that wait for an AW, a pairing helper that checks the beat count against AWLEN + 1, and one queue per AWID that each B pops from the front (§A6.4). Compile `write_pairing_tb.sv` on its own, with `tb_wr_pairing` as the top. Expected:

```text
ERROR: Q (AWID 0): WLAST on beat 3 of 4
PASS: BID 0 completes P (2 beats)
PASS: BID 1 completes R (1 beats)
PASS: BID 0 completes Q (3 beats)
PASS: exactly one WLAST error (Q)
PASS=4 FAIL=0
```

The `ERROR` line is expected: the trace contains one write whose W burst is a beat short.

## Reference solution

Compile with `+define+AXI_LAB_SOLUTION` to replace your two files with `solution.sv`, and with `+define+WR_PAIRING_SOLUTION` for the stretch step. Do not add `solution.sv` to the file list yourself: `testbench.sv` already includes it under the define, and compiling it twice declares every class twice.

## Tips

- Sample through `vif.mon_cb`, never through raw `vif` signals, so you read the values just before the edge.
- At each edge the monitor handles R before AR. A beat can only belong to a read whose AR handshake came at an earlier edge (§A3.3.1).
- Publish a new object per read. Reusing one handle makes every stored read change when the next one arrives.
