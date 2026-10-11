# Lab: Decoupling a Scoreboard with Analysis FIFOs

This lab belongs to I-UVM-2B ([TLM connections](/curriculum/T2_Intermediate/I-UVM-2B_TLM_Connections/index)) and is the warm-up for the A-UVM-6 scoreboard lab ([Scoreboards and Reference Models](/curriculum/T3_Advanced/A-UVM-6_Scoreboards_and_Reference_Models/index)).

## The problem

`traffic_gen` stands in for a DUT and its two monitors. Every 10 ns it publishes a request on `req_ap`; 30 ns later (3 cycles) it publishes the response on `rsp_ap`, which must carry the request's `seq` and the inverted data, `~data`.

The starter scoreboard, `src/dv/scoreboard.sv`, receives both streams through two analysis imps (`` `uvm_analysis_imp_decl(_req) `` and `(_rsp)`). All of its code therefore runs inside the publisher's `write()` call. `write()` is a function: it runs in zero simulation time and cannot wait (IEEE 1800-2023 §13.4). An analysis port has no back-pressure either: `write()` returns at once, whatever the subscriber does. So when a request arrives, its response does not exist yet, and `write_req()` can only give up.

**Predict, then run the starter.** How many errors, and with which IDs?

```text
UVM_ERROR @ 10 ns: uvm_test_top.env.scb [SCB/NO_RSP] seq=0 data=..: no response yet, cannot check
... (one per request, at 10, 20, ... 100 ns)
UVM_ERROR @ 130 ns: uvm_test_top.env.scb [SCB/NO_TRAFFIC] no response was compared: this run proves nothing
UVM_INFO @ 130 ns: uvm_test_top.env.scb [SCB_SUMMARY] SCB_SUMMARY matches=0 mismatches=0 pending=0
```

(A hand trace, not a simulator log; data values depend on the seed.)

## Your task

Change only `src/dv/scoreboard.sv`. Keep the member names `req_in` and `rsp_in`, so the environment does not change.

1. **Try the wrong fix first.** Add `@(rsp_in)` or `wait (last_rsp != null)` inside `write_req()` and compile: the compiler rejects a time-controlling statement in a function. Remove it.
2. **Make the inputs exports.** Declare `req_in` and `rsp_in` as `uvm_analysis_export #(my_txn)`, and add two private `uvm_tlm_analysis_fifo #(my_txn)` members, `req_fifo` and `rsp_fifo`. Construct all four with `new()` in `build_phase`, and connect each export to its FIFO's `analysis_export` in `connect_phase`. Delete the two `` `uvm_analysis_imp_decl `` lines, `write_req()` and `write_rsp()`.
3. **Move the check into a thread.** In `run_phase`, loop forever: `peek()` the oldest request (it stays in `req_fifo`), `get()` the next response (this is where the thread waits 3 cycles), then `try_get()` the request and call `check()`. Peeking first means a request whose response never comes is still in `req_fifo` when the run ends.
4. **Account at the end.** In `check_phase`, report `SCB/MISSING` if `req_fifo` is not empty, `SCB/UNEXPECTED` if `rsp_fifo` is not empty, and keep `SCB/NO_TRAFFIC`. Print `pending` as the number of items left in both FIFOs.
5. **Prove it can fail.** Run with `+CORRUPT=4`: the response to request 4 has one data bit flipped.

## Run instructions

The steps are tool-neutral; switches differ between simulators.

1. Compile against uvm-core 2020.3.1 (or your simulator's built-in UVM library of that version).
2. Compile only `src/dv/testbench.sv`, with `src/dv` on the include path; it includes the other files. To run the reference answer, put `solution/` on the include path **before** `src/dv`, so `solution/scoreboard.sv` replaces the starter.
3. Elaborate `tb_top` and run. Add `+CORRUPT=4` to plant the bug.

## Success criteria

Hand-traced expected lines (not a simulator log):

```text
# clean run
UVM_INFO @ 130 ns: uvm_test_top.env.scb [SCB_SUMMARY] SCB_SUMMARY matches=10 mismatches=0 pending=0
UVM_ERROR :    0
UVM_FATAL :    0

# +CORRUPT=4
UVM_ERROR @ 80 ns: uvm_test_top.env.scb [SCB/MISMATCH] expected seq=4 data=.., got seq=4 data=..
UVM_INFO @ 130 ns: uvm_test_top.env.scb [SCB_SUMMARY] SCB_SUMMARY matches=9 mismatches=1 pending=0
```

The run ends at 130 ns because the test drops its objection when `traffic_gen` has published its last response; it never reaches into the scoreboard.

## Need help?

- Review [I-UVM-2B: TLM Connections](/curriculum/T2_Intermediate/I-UVM-2B_TLM_Connections/index#two-input-scoreboards), section "Two-input scoreboards", for the two-imp and two-FIFO forms and the `peek()`, `get()`, `try_get()` loop.
- Review [A-UVM-6: Scoreboards and Reference Models](/curriculum/T3_Advanced/A-UVM-6_Scoreboards_and_Reference_Models/index#end-of-test-accounting-and-draining), section "End-of-test accounting and draining", for `check_phase` accounting and holding the run phase until the scoreboard is idle.
- `solution/scoreboard.sv` is the complete answer for steps 2 to 4.

## Going further

- **Two imps would also have worked here,** with the requests stored in a queue and the check done in `write_rsp()`, because comparing is zero-time once both items exist. The thread form is what you need as soon as a check must wait for time: a sideband signal, a clock, or a model that consumes time. A-UVM-6 compares the two forms.
- **Make the check slow.** Add `#20ns;` between `get()` and `try_get()` in `run_phase`, as if the model took two cycles. The thread now falls behind (a response every 10 ns, one check every 20 ns), but the FIFOs absorb the backlog: the publisher is never slowed. Run again: when the test ends, requests and responses are still in the FIFOs, and `check_phase` reports them. The fix is a scoreboard that holds the run phase until it is idle, taught in A-UVM-6 ("End-of-test accounting and draining").
