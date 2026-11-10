# Lab: DMA copy engine with layered and virtual sequences

This lab belongs to module I-UVM-3B. Do it after [I-UVM-3B: Advanced Sequencing and Layering](/curriculum/T2_Intermediate/I-UVM-3B_Advanced_Sequencing_and_Layering/index), in particular its lessons on layered sequences and virtual sequences. It is a step towards milestone M5, a multi-agent environment driven by virtual sequences. Plan on three to four hours, most of it in steps 2 to 5.

You verify `dma_copy`, a one-channel engine that copies a block of 32-bit words from one memory address to another. Software programs it through four registers; the DMA then reads and writes memory through a request/grant port. The bench has two agents, one per port, and you write the sequences that coordinate them:

- a **translation sequence** that turns a whole copy ("16 words from 0x1270 to 0x87A8") into register accesses (protocol layering);
- a **virtual sequence** that loads memory and starts the memory responder before anything can start the DMA (an ordering rule across agents);
- the **scoreboard**'s prediction and end-of-transfer accounting;
- a second virtual sequence that writes a register **while a copy is running**, on the same sequencer the translation sequence is using.

The agents, the memory model, the environment and the tests are written for you. Their names follow I-UVM-3B: an upper sequencer with no driver, a translation sequence that pulls from it, a virtual sequencer reached through `p_sequencer`.

## What you will practise

- Protocol layering: a translation sequence on the lower (register) sequencer that calls `get_next_item` and `item_done` on a driverless upper sequencer (IEEE 1800.2-2020 §15.5.2.3, §15.5.2.5), so the upper sequence's `finish_item` returns only when the copy is finished (§14.2.6.3).
- A virtual sequence with `` `uvm_declare_p_sequencer `` (§B.3.3) that starts sub-sequences on several sequencers (§14.2.3.1), with background sequences in `fork ... join_none` (IEEE 1800-2023 §9.3.2).
- An ordering rule across agents: memory loaded and the responder running before the first START.
- A reactive responder (a driver that answers the DUT) serving the DUT from a memory model.
- A scoreboard that keeps a shadow of the programming model, predicts every destination write and register read, and closes the books on each transfer when the done pulse arrives.
- Two sequences sharing one sequencer: the default arbitration is `UVM_SEQ_ARB_FIFO` (§15.3.2.18), and each register access is one item, so accesses from different sequences interleave but never mix.
- Proof that the bench can fail, and which test catches which bug.

## Files

| File | Role |
|---|---|
| `rtl/dma_copy.sv` | The DUT. Write the bench from the specification below, not from this RTL. Two planted bugs are selected at run time with `+DMA_BUG=<n>`. |
| `tb/dma_ifs.sv` | Interfaces `dma_cfg_if` (register port) and `dma_mem_if` (memory port). |
| `tb/tb_top.sv` | Clock, reset, the DUT, the interfaces, `run_test("dma_smoke_test")`. |
| `work/dma_tb_pkg.sv` | The starter bench, package `dma_tb_pkg`. Every `TODO step N` marks code you write in step N. |
| `solution/dma_tb_pkg.sv` | One worked solution. Open it after you finish. |

Both package files declare `dma_tb_pkg`: build with one of them, never both.

## Specification: `dma_copy`

### Ports

| Port | Dir | Meaning |
|---|---|---|
| `clk`, `rst_n` | in | Clock; reset, active low (asynchronous). Everything else happens on the rising edge of `clk`. |
| `cfg_valid`, `cfg_write`, `cfg_addr[7:0]`, `cfg_wdata[31:0]` | in | Register access. An access happens on each rising edge where `cfg_valid` is 1; there are no wait states. |
| `cfg_rdata[31:0]` | out | Read data, combinational from `cfg_addr` while `cfg_valid` is 1 and `cfg_write` is 0. |
| `mem_req`, `mem_we`, `mem_addr[31:0]`, `mem_wdata[31:0]` | out | Memory request from the DMA. |
| `mem_gnt` | in | Grant from memory. |
| `mem_rvalid`, `mem_rdata[31:0]` | in | Read data from memory. |
| `done_o` | out | A one-cycle pulse when a transfer ends. |

### Registers

| Offset | Name | Access | Meaning |
|---|---|---|---|
| 0x00 | SRC | read/write | Byte address of the first source word. |
| 0x04 | DST | read/write | Byte address of the first destination word. |
| 0x08 | LEN | read/write | Number of 32-bit words to copy, 0 to 255. |
| 0x0C | CTRL | write | Bit 0 = START. Reads return 0. |
| 0x10 | STATUS | read | Bit 0 = BUSY, bit 1 = DONE. |

- **R1.** SRC and DST store bits [31:2] (word addresses); bits [1:0] read as 0. LEN stores bits [7:0]; the other bits read as 0.
- **R2.** A read returns the register's current value on the same edge as the access. CTRL and unmapped offsets read as 0; writes to them (other than START) do nothing.
- **R3.** While BUSY is 1, writes to SRC, DST and LEN are ignored.
- **R4.** A write to CTRL with bit 0 set, while BUSY is 0, starts a transfer: BUSY becomes 1 and DONE becomes 0. While BUSY is 1, START is ignored.
- **R5.** A transfer copies word *i*, for *i* = 0 to LEN-1, from address SRC + 4*i* to DST + 4*i*, in increasing order of *i*: it reads the word, then writes it. A transfer with LEN = 0 touches no memory.
- **R6.** When a transfer ends (after the last write is granted, or at once for LEN = 0), BUSY becomes 0, DONE becomes 1 and `done_o` pulses for one cycle. DONE stays 1 until the next START.

### Memory port

- **M1.** The DMA raises `mem_req` with `mem_we`, `mem_addr` and (for a write) `mem_wdata`, and holds them stable until the rising edge where `mem_gnt` is also 1. The access is accepted on that edge.
- **M2.** For a read, memory returns the data with `mem_rvalid` = 1 for one cycle, at least one cycle after the grant edge. The DMA takes `mem_rdata` on the edge where `mem_rvalid` is 1.
- **M3.** The DMA has at most one access outstanding: it does not request again until a read's data has arrived.

The source and destination of one transfer never overlap in this lab's tests (the bench keeps sources in 0x1000 to 0x13FF and destinations in 0x8000 to 0x8FFF), so the copy result does not depend on the order of reads and writes.

## The bench

```text
 dma_smoke_vseq / dma_busy_vseq   (run on env.vsqr; p_sequencer is a dma_vsequencer)
   |                         |                                   |
   | xfers.start             | translate.start                   | rsp_seq.start
   v                         v                                   v
 xfer_sqr  ------------>  dma_xfer_to_cfg_seq                  mem_agt.sqr
 (upper layer,  get_next_item    |  (runs on cfg_agt.sqr)          |
  no driver)    item_done        v                                 v
                           cfg_agt: sqr -> driver            mem_agt: responder <--> dma_mem_model
                                            |                          |               ^   ^
                                       dma_cfg_if                 dma_mem_if           |   |
                                            |                          |       preload |   |
                                            +------> dma_copy <--------+       (vseq)  |   |
                                            |                          |               |   |
                                     cfg_agt.mon                  mem_agt.mon          |   |
                          (accesses, done pulses)            (writes, reads)           |   |
                                            |                          |               |   |
                                            +----> dma_scoreboard <----+    peek ------+---+
```

- **Register agent** (`cfg_agt`): the driver performs one access per item and returns read data in the item. The monitor publishes each access and each `done_o` pulse; on an edge with both, the done pulse is published first.
- **Memory agent** (`mem_agt`): the responder is a driver that answers the DUT. For each item from its sequencer (a grant delay of 0 to 3 cycles, a read-data delay of 0 to 2 cycles) it waits for a request, grants it, writes the memory model or reads it and returns the data. The monitor publishes every completed access.
- **Memory model** (`dma_mem_model`): one object shared by the responder and the scoreboard. Reading an address that nothing wrote is an error (`[MEM] read of ..., which nothing has written`).
- **Upper layer**: `dma_xfer_item` is one whole copy; `dma_xfer_seq` sends LEN 0, LEN 1 and LEN 16 first, then `n_random` random copies of 2 to 16 words.
- **Tests**: `dma_smoke_test` (the default) runs `dma_smoke_vseq`; `dma_busy_test` runs `dma_busy_vseq`. The base test sets a 100 us timeout and prints one verdict line, `[RESULT] PASS` or `[RESULT] FAIL: <n> errors`, counting UVM_ERROR and UVM_FATAL reports.

Stimulus uses `$urandom_range` (IEEE 1800-2023 §18.13.2) instead of `rand` fields and constraints, so the bench runs on Verilator without an external constraint solver.

## Running the lab

You need a simulator with UVM 1800.2. The commands and every log in this README were captured with **Verilator 5.052** and the Accellera library **uvm-core 2020.3.1**, the library the course's own compile checks use. Set `UVM_HOME` to the folder that contains `src/uvm_pkg.sv`, then, from this lab's folder:

```bash
verilator --binary --timing -Wno-fatal -Wno-lint -Wno-style --timescale 1ns/1ps \
  +define+UVM_NO_DPI -I$UVM_HOME/src $UVM_HOME/src/uvm_pkg.sv \
  rtl/dma_copy.sv tb/dma_ifs.sv work/dma_tb_pkg.sv tb/tb_top.sv \
  --top-module tb_top -j 4 -Mdir obj_work

./obj_work/Vtb_top                                   # dma_smoke_test
./obj_work/Vtb_top +UVM_TESTNAME=dma_busy_test
./obj_work/Vtb_top +UVM_TESTNAME=dma_busy_test +DMA_BUG=2
```

- **Build once, run many times.** The build takes a few minutes and about 250 MB, because it compiles the whole UVM library. The test and the planted bug are run-time plusargs, so steps 1 and 6 need no rebuild. Rebuild after each change to `work/dma_tb_pkg.sv`.
- **`+define+UVM_NO_DPI`** builds UVM without its C code, so every run prints two warnings, `[NO_DPI_USED]` and `[NO_VISIT_CHECK]`. They are expected. Verilator may also warn that the system stack size may be too small; this bench does not need more.
- **`--timescale 1ns/1ps`** gives every file without its own time unit a 1 ns unit, so the 10 ns clock in `tb_top` is 10 ns and UVM messages print `@ 115 ns`.
- **The seed.** Verilator uses the same seed on every run unless you pass `+verilator+seed+<n>`. The numbers in this README (addresses, data, word and read counts) are for the default seed and the worked solution. Your code may call `$urandom` in a different order, so your addresses and counts can differ; the transfer counts (9 for the smoke test, 3 for the busy test) and the verdicts cannot.
- **Another simulator.** Compile the same four files after your simulator's UVM 1800.2 library, with a default time scale of 1 ns/1 ps and `tb_top` as the top, and pass the same plusargs. That route was not run for this README.
- For the worked solution, replace `work/dma_tb_pkg.sv` with `solution/dma_tb_pkg.sv` (and use another `-Mdir`).

Messages below omit the start of the file path and the UVM release notes. The line number after the file name is that of the file that produced the log (the starter for step 1, the worked solution with step 4 not yet done for step 3, the worked solution for the rest), so yours will differ.

## Step 1: Read the specification and run the starter

Read the specification and the bench diagram. Then build and run the starter with no plusargs. The end of the log:

```text
UVM_ERROR work/dma_tb_pkg.sv(464) @ 45 ns: uvm_test_top.env.sb [SB] no transfer was checked: a run that checks nothing is not a pass
UVM_INFO work/dma_tb_pkg.sv(469) @ 45 ns: uvm_test_top.env.sb [SB] transfers started 0, checked 0; words matched 0; register reads checked 0
UVM_INFO work/dma_tb_pkg.sv(741) @ 45 ns: uvm_test_top [RESULT] FAIL: 1 errors
```

The run ends at 45 ns: `dma_smoke_vseq` is empty, so the test waits its five closing clock edges (5 ns to 45 ns) and drops its objection. `+UVM_TESTNAME=dma_busy_test` ends the same way.

**Question 1.** No message came from the DUT and no check failed on its data. Why is this run a failure, and what would go wrong in a regression if it were reported as a pass?

## Step 2: The translation sequence

`dma_xfer_to_cfg_seq` runs on the register sequencer. In its `body`, after `up_sqr.get_next_item(x)`:

1. `cfg_write` SRC, DST and LEN from `x` (LEN as `{24'h0, x.len}`).
2. `cfg_write(REG_CTRL, 32'h1)`: START (R4).
3. `cfg_read(REG_STATUS, status)` in a loop until `status[1]` (DONE) is 1 (R6). Count the reads; when `poll_limit` reads have not seen DONE, end the run with `` `uvm_fatal("LAYER", ...) ``, so a DMA that never finishes cannot hang the bench.

Leave `up_sqr.item_done()` as the last statement of the loop. `cfg_write` and `cfg_read` come from `dma_cfg_base_seq`: each is one `start_item`/`finish_item` pair, and `cfg_read` returns the data the driver put into the item.

Rerun. Nothing changes: no virtual sequence starts the translation sequence yet.

**Question 2.** `dma_xfer_seq` calls `finish_item(req)` on the upper sequencer. When does that call return: when the translation sequence takes the item, when the START write is driven, or later? What would change for the scoreboard and the busy test if `item_done` were called right after `get_next_item`?

## Step 3: The virtual sequence and its ordering rule

The ordering rule: **memory holds the source data and the responder is running before anything can start the DMA.** In `dma_base_vseq::start_background`:

1. `dma_preload_sources(p_sequencer.mem)` fills the whole source window (a backdoor load: straight into the model, no bus traffic).
2. `translate.up_sqr = p_sequencer.xfer_sqr;`
3. In a `fork ... join_none`, `rsp_seq.start(p_sequencer.mem_sqr)` and `translate.start(p_sequencer.cfg_sqr)`. Both run forever, so they must not block the virtual sequence.

In `dma_smoke_vseq::body`, call `start_background()`, then `xfers.start(p_sequencer.xfer_sqr)`.

Rebuild and run `dma_smoke_test`. The copies now run, and the scoreboard rejects every destination write, because nothing predicts them yet. With the worked solution's stimulus:

```text
UVM_INFO dma_tb_pkg.sv(615) @ 0 ns: uvm_test_top.env.cfg_agt.sqr@@translate [LAYER] copy 0 words 0x000012b0 -> 0x00008204
UVM_INFO dma_tb_pkg.sv(409) @ 75 ns: uvm_test_top.env.sb [SB] transfer 1 started: 0 words 0x000012b0 -> 0x00008204
...
UVM_ERROR dma_tb_pkg.sv(422) @ 195 ns: uvm_test_top.env.sb [SB] unexpected write: WRITE 0x00008a54 data 0xdce96a74
UVM_ERROR dma_tb_pkg.sv(422) @ 315 ns: uvm_test_top.env.sb [SB] unexpected write: WRITE 0x00008a90 data 0x4d9b629b
...
UVM_ERROR dma_tb_pkg.sv(457) @ 7235 ns: uvm_test_top.env.sb [SB] no transfer was checked: a run that checks nothing is not a pass
UVM_INFO dma_tb_pkg.sv(462) @ 7235 ns: uvm_test_top.env.sb [SB] transfers started 9, checked 0; words matched 0; register reads checked 679
UVM_INFO dma_tb_pkg.sv(770) @ 7235 ns: uvm_test_top [RESULT] FAIL: 75 errors
```

74 unexpected writes (one per copied word) plus the empty-run error. The register reads already pass: the shadow updates in `write_cfg` are given.

**Question 3.** In `fork ... join_none`, the two child sequences start only when `start_background` blocks or returns (IEEE 1800-2023 §9.3.2, "processes spawned by a fork-join block shall not start executing until the parent process is blocked or terminates"). Would moving `dma_preload_sources` to just after the `join_none` break the ordering rule? Would moving it to after `xfers.start(...)` in `dma_smoke_vseq`?

## Step 4: Predict and account in the scoreboard

`write_cfg` (given) keeps the shadow: SRC, DST and LEN as R1 stores them, ignored while BUSY (R3); a START sets BUSY, clears DONE and calls `predict_transfer` (R4); a read is compared with the shadow (R2). Write the two functions it calls:

- `predict_transfer`: for *i* = 0 to `len`-1, `exp_q.push_back('{addr: dst + 4 * i, data: mem.peek(src + 4 * i)})` (R5). The model is read when the copy starts, which is safe because sources and destinations never overlap.
- `end_of_transfer`, called for each done pulse (R6): a `` `uvm_error `` if no transfer is running; a `` `uvm_error `` if `exp_q` is not empty, naming how many words are missing and the first missing address; otherwise `n_checked++`. Then `exp_q.delete()`. The two shadow updates below your code are given.

`write_mem` (given) pops one expectation per destination write and compares address and data with `!==`. `check_phase` (given) fails a run that ends mid-transfer or checked nothing.

Rebuild and run `dma_smoke_test`. The worked solution, default seed:

```text
UVM_INFO dma_tb_pkg.sv(409) @ 75 ns: uvm_test_top.env.sb [SB] transfer 1 started: 0 words 0x000012b0 -> 0x00008204
UVM_INFO dma_tb_pkg.sv(409) @ 135 ns: uvm_test_top.env.sb [SB] transfer 2 started: 1 words 0x0000111c -> 0x00008a54
UVM_INFO dma_tb_pkg.sv(409) @ 255 ns: uvm_test_top.env.sb [SB] transfer 3 started: 16 words 0x00001010 -> 0x00008a90
...
UVM_INFO dma_tb_pkg.sv(409) @ 6785 ns: uvm_test_top.env.sb [SB] transfer 9 started: 4 words 0x00001334 -> 0x00008b6c
UVM_INFO dma_tb_pkg.sv(472) @ 7235 ns: uvm_test_top.env.sb [SB] transfers started 9, checked 9; words matched 74; register reads checked 679
UVM_INFO dma_tb_pkg.sv(779) @ 7235 ns: uvm_test_top [RESULT] PASS
```

with `UVM_ERROR :    0` and `UVM_FATAL :    0` in the report summary. Most of the 679 reads are the translation sequence's STATUS polls.

**Question 4.** The scoreboard predicts from the same memory model the responder serves the DMA from. Name a DUT bug this scoreboard still catches because it computes the source address itself, and one class of bug it could miss because it shares the model.

## Step 5: Reprogram while busy

R3 says writes to SRC, DST and LEN are ignored while BUSY. The smoke test never tries it: the translation sequence only programs an idle DMA. In `dma_busy_vseq::body`:

1. `start_background()`, and `first.n_random = 0`, so `first` sends LEN 0, LEN 1 and one 16-word copy.
2. A `fork ... join` of two branches:
   - `first.start(p_sequencer.xfer_sqr)`;
   - a loop that reads STATUS with a `dma_cfg_access_seq` started on `p_sequencer.cfg_sqr`, and, when BUSY is 1, reads LEN too, until the DMA is BUSY with LEN 16. Then one more `dma_cfg_access_seq` writes `DST_ALT` (0x9000) to DST, with a `` `uvm_info("VSEQ", ...) `` before it.
3. After the `join`, read DST back with a `dma_cfg_access_seq`. The scoreboard checks the value against its shadow, which ignored the write.

Run `+UVM_TESTNAME=dma_busy_test`:

```text
UVM_INFO dma_tb_pkg.sv(733) @ 405 ns: uvm_test_top.env.vsqr@@vseq [VSEQ] copy is BUSY: writing DST (R3 says it is ignored)
UVM_INFO dma_tb_pkg.sv(472) @ 1855 ns: uvm_test_top.env.sb [SB] transfers started 3, checked 3; words matched 17; register reads checked 164
UVM_INFO dma_tb_pkg.sv(779) @ 1855 ns: uvm_test_top [RESULT] PASS
```

**Question 5.** Two sequences run on `cfg_sqr` at the same time: the translation sequence (polling STATUS) and your access sequences. Why can't a poll and your DST write corrupt each other on the bus? What could happen if your write arrived between the translation sequence's SRC and DST writes for the next copy, and which sequencer call would prevent it?

## Step 6: Prove the bench can fail

A test you have never seen fail is no evidence. For each planted bug, **predict** which test catches it, then run. No rebuild is needed for the DUT bugs.

1. `+DMA_BUG=1`: a transfer of 2 or more words ends one word early (breaks R5).
2. `+DMA_BUG=2`: a DST write while BUSY is accepted, and the rest of the copy goes to the new address (breaks R3).

Captured with the worked solution:

| Run | `dma_smoke_test` | `dma_busy_test` |
|---|---|---|
| no plusarg | `[RESULT] PASS` | `[RESULT] PASS` |
| `+DMA_BUG=1` | `FAIL: 7 errors`: transfers 3 to 9 (every LEN of 2 or more) each end with `1 of its words not written` | `FAIL: 1 errors`: transfer 3 (16 words) ends with `1 of its words not written; first missing: 0x000087e4` |
| `+DMA_BUG=2` | `[RESULT] PASS`: the bug escapes | `FAIL: 17 errors`: 16 writes to 0x9000 to 0x903C instead of 0x87A8 to 0x87E4, and `read 0x04 returned 0x00009000, expected 0x000087a8` |

`+DMA_BUG=1` with `dma_smoke_test`, the first and last errors:

```text
dma_copy: planted bug 1 is active
UVM_ERROR dma_tb_pkg.sv(420) @ 1605 ns: uvm_test_top.env.sb [SB] transfer 3 ended with 1 of its words not written; first missing: 0x00008acc
...
UVM_ERROR dma_tb_pkg.sv(420) @ 6515 ns: uvm_test_top.env.sb [SB] transfer 9 ended with 1 of its words not written; first missing: 0x00008b78
UVM_INFO dma_tb_pkg.sv(472) @ 6565 ns: uvm_test_top.env.sb [SB] transfers started 9, checked 2; words matched 67; register reads checked 612
UVM_INFO dma_tb_pkg.sv(780) @ 6565 ns: uvm_test_top [RESULT] FAIL: 7 errors
```

`+DMA_BUG=2` with `dma_busy_test`:

```text
dma_copy: planted bug 2 is active
UVM_INFO dma_tb_pkg.sv(733) @ 405 ns: uvm_test_top.env.vsqr@@vseq [VSEQ] copy is BUSY: writing DST (R3 says it is ignored)
UVM_ERROR dma_tb_pkg.sv(438) @ 435 ns: uvm_test_top.env.sb [SB] transfer 3: wrote 0x00009000 = 0xfe9d0b0f, expected 0x000087a8 = 0xfe9d0b0f
...
UVM_ERROR dma_tb_pkg.sv(438) @ 1775 ns: uvm_test_top.env.sb [SB] transfer 3: wrote 0x0000903c = 0x50c0db6e, expected 0x000087e4 = 0x50c0db6e
UVM_ERROR dma_tb_pkg.sv(456) @ 1805 ns: uvm_test_top.env.sb [SB] read 0x04 returned 0x00009000, expected 0x000087a8
UVM_INFO dma_tb_pkg.sv(780) @ 1855 ns: uvm_test_top [RESULT] FAIL: 17 errors
```

The redirect lands at 405 ns, before the first destination write at 435 ns, so all 16 words go to the wrong place. The data is right every time; only the address is wrong.

3. **A bench bug.** In `start_background`, comment out `rsp_seq.start(p_sequencer.mem_sqr);`, rebuild and run `dma_smoke_test`. Predict first: what does the DMA do when nobody grants its first read, and which part of the bench notices?

```text
UVM_FATAL dma_tb_pkg.sv(624) @ 2135 ns: uvm_test_top.env.cfg_agt.sqr@@translate [LAYER] DONE not set after 200 polls of STATUS
```

A `UVM_FATAL` ends the run at once, so there is no `[RESULT]` line; the report summary shows `UVM_FATAL :    1`. Without the poll limit, the run would end only at the base test's 100 us timeout.

4. Restore the line, rebuild, and confirm `[RESULT] PASS` for both tests with no plusarg.

**What the table teaches.** Each test catches only the bugs its stimulus provokes. The smoke test never writes a register while BUSY, so bug 2 passes it cleanly; only the virtual sequence that runs two sequences against the DMA at once provokes it. The empty-run check, the done-pulse accounting and the poll limit each turn a silent problem (nothing checked, a word never written, a hang) into a named error.

## Answers

<details>
<summary>Question 1: why the starter fails</summary>

The starter starts no copies, so the scoreboard compared nothing. A bench that reports PASS when it checked nothing passes for every DUT, including a DUT that does nothing at all; in a regression, a broken sequence or a missing connection would turn every test green. `check_phase` therefore counts a run with no checked transfer as an error.
</details>

<details>
<summary>Question 2: when the upper finish_item returns</summary>

`finish_item` waits for `item_done` on the item's sequencer (§14.2.6.3). The upper sequencer has no driver: the translation sequence calls `item_done` on it (§15.5.2.5) only after STATUS shows DONE. So `dma_xfer_seq`'s `finish_item` returns when the copy is finished, and the next copy cannot be programmed while the DMA is BUSY. If `item_done` came right after `get_next_item`, `dma_xfer_seq` would run ahead: `xfers.start` would return after the translation sequence had taken the last item but before that copy (and its polls) finished, so the smoke test could end mid-transfer and `check_phase` would report a transfer still running. In the busy test, `first` would finish early and the `join` would no longer mean "the long copy is done".
</details>

<details>
<summary>Question 3: moving the preload</summary>

Just after the `join_none`: no. The children start only when the parent blocks or returns; `dma_preload_sources` is a function and does not block, so it still runs before the responder and the translation sequence start. After `xfers.start(...)`: yes. By then every copy has run against an empty memory; the responder reports `[MEM] read of ..., which nothing has written` and returns 0xDEADBEEF, and the scoreboard, reading the same empty model when each copy starts, reports the same error. Writing the rule down ("load, then start the responder, then start the DMA") and putting the load first is safer than relying on when `join_none` children start.
</details>

<details>
<summary>Question 4: what a shared model can miss</summary>

Caught: a DMA that reads the wrong source address (for example SRC + 4*(*i*+1)), because the scoreboard computes SRC + 4*i* itself and the data read from the wrong address differs. Caught: a DMA that writes the right data to the wrong place, as bug 2 shows. Possibly missed: a bug in the memory model or in the responder that corrupts a stored word, because the scoreboard predicts from the same model; a corrupted source word gives the same wrong data on both sides. An independent reference (for example, the preload values kept in the virtual sequence and compared with a final readback of the destinations) closes that gap.
</details>

<details>
<summary>Question 5: sharing a sequencer</summary>

The sequencer grants one item at a time, and the register driver completes each item (one access on one edge) before it calls `item_done` and takes the next. With the default `UVM_SEQ_ARB_FIFO` arbitration (§15.3.2.18) requests are granted in the order they arrive, so the poll and the write are two separate accesses on two edges. What the sequencer does not protect is a group of accesses: a write from another sequence can land between the translation sequence's SRC and DST writes. If that write went to SRC, the copy would start from an address nobody intended. The translation sequence can prevent it by calling `lock()` (§14.2.5.5) before its four programming writes and `unlock()` (§14.2.5.7) after START: while the lock is held, the sequencer grants only this sequence's items. A lock request is arbitrated like any other request; `grab()` (§14.2.5.6) does the same job but is put in front of the arbitration queue.
</details>

## Push further

- Extend `dma_busy_vseq` to write SRC and LEN while BUSY as well, and START again while BUSY (R4). Which shadow update in `write_cfg` makes the scoreboard expect each of these to be ignored?
- Add `lock()` and `unlock()` to the translation sequence, then write a virtual sequence that tries to write SRC between programming writes. Show that the write now lands after START, where R3 ignores it.
- Replace the preload with a sequence that writes known patterns, and add a final pass that reads every destination word from the model and compares it with the pattern the virtual sequence wrote, an independent check that answers Question 4.
- Run with several seeds (`+verilator+seed+1`, `+verilator+seed+2`, ...). The transfer counts and verdicts stay the same; the lengths, addresses and timing change.

## Completion checklist

- [ ] The translation sequence programs SRC, DST, LEN, starts the copy, polls STATUS with a limit, and calls `item_done` on the upper sequencer only after DONE.
- [ ] The virtual sequence loads memory and starts the responder and the translation sequence in the background before any copy is sent.
- [ ] The scoreboard predicts LEN writes per transfer from SRC and DST, and a done pulse with words outstanding is an error.
- [ ] `dma_smoke_test` ends `transfers started 9, checked 9` and `[RESULT] PASS`; `dma_busy_test` ends `[RESULT] PASS`.
- [ ] I have seen `+DMA_BUG=1` fail both tests, `+DMA_BUG=2` fail only the busy test, and the missing responder end the run with the poll-limit fatal, and I can say which check caught each.

> **Ready to compare?** Open `solution/dma_tb_pkg.sv` after you finish.
