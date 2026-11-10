# Lab: Multi-agent environment with virtual sequences

This lab belongs to module A-UVM-8. Do it after [A-UVM-8: Multi-Agent Topologies](/curriculum/T3_Advanced/A-UVM-8_Multi_Agent_Topologies/index). It is milestone M5 of the course: an environment with several agents whose stimulus is ordered by a virtual sequence and whose result is checked end to end, and which is proven to fail when the ordering is broken.

A-UVM-8 builds a bench for `dma_stream`, an APB-configured streaming engine with an interrupt. Here you build the same shape, piece by piece, for a smaller sibling, `key_stream`: a configuration agent and a data agent ordered by a virtual sequence, a passive agent on the output, a scoreboard that predicts from the configuration it watches on the bus, and two cross-interface assertions. Three mutant tests and two planted DUT bugs are supplied; your bench passes the milestone only when every one of them fails. The guided pre-lab is the [Coordinated Attack lab](/curriculum/T2_Intermediate/I-UVM-3B_Advanced_Sequencing_and_Layering/coordinated-attack-lab) in I-UVM-3B, and the single-agent environment of the [Mini UVM FIFO capstone](/curriculum/T2_Intermediate/I-UVM-3C_First_Complete_Testbench/index) (milestone M2) is assumed.

## What you will practise

- One configuration object per agent, set by the environment at each agent's own path, with the active or passive mode coming from that object.
- A virtual sequencer that only holds handles, and a virtual sequence whose `body()` decides every order: configure, send, reconfigure at a safe point, send again.
- A null check on every sequencer handle, so a passive agent gives a named fatal instead of a hang.
- An end-to-end scoreboard with three analysis imps that follows the configuration from the configuration monitor, and applies it by time stamp, not by arrival order.
- Two concurrent assertions on rules that span two interfaces.
- Proof that the bench can fail: mutant stimulus, a mutant topology and planted DUT bugs, each with a predicted signature.

## Files

- `work/key_stream.sv`: the DUT. Read its specification below, not its RTL, when you write the predictor.
- `work/mx_tb.sv`: the starter testbench. The interfaces, items, agents, agent sequences and the test are complete; read them first. Each `TODO step N` comment marks code you write in step N.
- `work/mx_mutants.svh`: three mutant tests, `include`d at the end of `mx_pkg`. Complete; do not edit it.
- `solution/mx_tb.sv`: one reference solution. Open it only after you finish.

Both `mx_tb.sv` files declare the same names, so compile the DUT with one of them, never both. Every interface, package and module declares `timeunit 1ns; timeprecision 1ps;`; give files that declare none, such as `uvm_pkg`, the same default with your simulator's switch (`--timescale 1ns/1ps` for Verilator), because a design in which some elements have a time unit and others do not is an error (IEEE 1800-2023 §3.14.2.3).

## The DUT: `key_stream`

| Port | Direction | Meaning |
|---|---|---|
| `clk` | input | Clock. Everything happens on its rising edge. |
| `rst_n` | input | Synchronous reset, active low. |
| `cfg_we`, `cfg_addr[1:0]`, `cfg_wdata[7:0]` | input | Configuration port: one register write at each edge where `cfg_we` is 1. |
| `din_valid`, `din[7:0]` | input | Data in: one byte at each edge where `din_valid` is 1. |
| `dout_valid`, `dout[7:0]` | output | Data out: one transformed byte. |

| Address | Register | Bits |
|---|---|---|
| 0 | `CTRL` | bit 0 `EN` (accept data), bit 1 `MODE` (0 XOR, 1 ADD) |
| 1 | `KEY` | 8-bit key |

On every rising edge of `clk`, after reset:

- **R1.** A configuration write updates its register at the edge where `cfg_we` is 1. A byte accepted at the same edge still uses the old register values.
- **R2.** A byte is accepted at an edge where `din_valid` is 1 and `EN` is 1. A byte sent while `EN` is 0 is **dropped silently**.
- **R3.** One edge after a byte is accepted, `dout_valid` is 1 and `dout` is `(din + KEY) mod 256` when `MODE` is 1, or `din ^ KEY` when `MODE` is 0.
- **R4.** While `EN` is 1 the configuration is **locked**: a `KEY` write is ignored, and a `CTRL` write changes `EN` only. To change `KEY` or `MODE`, write `CTRL` with `EN` = 0 first.

R2 and R4 are rules about the *order* of traffic on two different interfaces. No single agent can see them; that is why this DUT needs a virtual sequence and cross-agent checks.

The DUT reads `+BUG=<n>` from the command line, so you can plant a known bug without rebuilding (step 7). Leave it out until then.

## The testbench you complete

| Interface (bus in `tb_top`) | Who drives it | Agent | Mode | Handle in `vsqr` | Scoreboard input |
|---|---|---|---|---|---|
| configuration (`cfg_bus`, `cfg_if`) | the testbench | `cfg_agt` (`cfg_agent`) | active | `cfg_sqr` | `cfg_imp` → `write_cfg` |
| data in (`din_bus`, `din_if`) | the testbench | `din_agt` (`din_agent`) | active | `din_sqr` | `in_imp` → `write_in` |
| data out (`dout_bus`, `dout_if`) | the DUT | `dout_agt` (`dout_agent`) | passive, always | none | `out_imp` → `write_out` |

- The test builds one `mx_env_cfg` holding `cfg_agt_cfg`, `din_agt_cfg` and `dout_agt_cfg`, stores the virtual interfaces that `tb_top` published, and sets the tree once at `env`.
- `dout_if` has no driving clocking block at all: the DUT drives those signals, so no agent class may ever write them. A-UVM-8 shows the other approach, one agent class reused on two instances of a net-based interface.
- Each monitor stamps every transaction it publishes with `$time` at the clock edge where it sampled it. The scoreboard uses those stamps in step 4.
- Both drivers drive in the time slot of the edge at which they receive an item, so the DUT samples it at the next edge. `cfg_driver` releases `cfg_we` after each write; when the next write follows at once, it drives `cfg_we` to 1 again in the same time slot, and the value driven is the last of those drives (IEEE 1800-2023 §14.16.2; at worst `cfg_we` glitches inside that time slot, where no edge samples it), so back-to-back writes are sampled on consecutive edges.

### The scenario

`mx_reconfig_vseq` (step 3) runs this, one line after the other:

| Step | Call | Bytes or writes | Expected outputs |
|---|---|---|---|
| 1 | `program_dut(KEY_1, MODE_XOR)` | `CTRL`=0x00, `KEY`=0x3C, `CTRL`=0x01 | none |
| 2 | `send_burst(FIRST_1, BURST_LEN)` | 0x10 0x2D 0x4A 0x67 0x84 0xA1 | 0x2C 0x11 0x76 0x5B 0xB8 0x9D |
| 3 | `program_dut(KEY_2, MODE_ADD)` | `CTRL`=0x00, `KEY`=0xA5, `CTRL`=0x03 | none |
| 4 | `send_burst(FIRST_2, BURST_LEN)` | 0xE0 0xFD 0x1A 0x37 0x54 0x71 | 0x85 0xA2 0xBF 0xDC 0xF9 0x16 |

Each burst is `BURST_LEN` = 6 bytes, `first`, `first + 0x1D`, and so on, modulo 256. `program_dut` returns after the DUT has sampled the write that sets `EN`; `send_burst` returns after the DUT has sampled the last byte. Both helpers are written for you.

## Step 1: Run the starter

Build and run (commands under [Running the lab](#running-the-lab)) with no `+UVM_TESTNAME`. Captured from a Verilator 5.052 run of the starter, with the banner and file names trimmed:

```text
UVM_INFO @ 0: reporter [RNTST] Running test mx_reconfig_test...
UVM_FATAL ... @ 0: uvm_test_top.env.cfg_agt [NO_CFG] cfg_agent_cfg not set for this agent
UVM_ERROR :    0
UVM_FATAL :    1
```

Before you read on: the test created `cfg_agt_cfg` and set the whole `mx_env_cfg` tree. Which component did not do its job?

<details>
<summary>Answer: the environment</summary>

The test sets one object, `mx_env_cfg`, at `env`. Each agent asks the configuration database for its own `cfg_agent_cfg` (or `din_agent_cfg`, `dout_agent_cfg`) at its own path, and nobody has set one there: that is the environment's job, between getting `mx_env_cfg` and creating the agents. `get()` returns 0 and the agent's guard turns it into a named fatal at build time, before any time passes. Without the guard the agent would dereference a null `cfg` and the simulator would stop with a bare null-object error and no UVM id.

</details>

## Step 2: The topology

1. **`mx_env::build_phase`.** After the null checks, set each agent's object at its own path before you create the agent, for example `uvm_config_db #(cfg_agent_cfg)::set(this, "cfg_agt", "cfg", cfg.cfg_agt_cfg);`. `build_phase` runs top-down, so a `set()` made here is in place when the agent's own `build_phase` calls `get()`.
2. **`mx_env::connect_phase`.** Copy `cfg_agt.sqr` and `din_agt.sqr` into `vsqr.cfg_sqr` and `vsqr.din_sqr`. Then, when `cfg.has_scoreboard` is 1, connect `cfg_agt.ap` to `scb.cfg_imp`, `din_agt.ap` to `scb.in_imp` and `dout_agt.ap` to `scb.out_imp`.

A passive agent never builds a sequencer, so its `sqr` handle is null, and so is the copy in `vsqr`. That is legal here; step 3 decides what happens when someone tries to use it.

Rerun. Captured from Verilator:

```text
UVM_INFO ... @ 0: uvm_test_top [TEST] Running mx_reconfig_vseq
UVM_INFO ... @ 20000: uvm_test_top.env.scb [SCB_SUMMARY] SCB_SUMMARY matches=0 mismatches=0 pending=0 order=0
UVM_INFO ... @ 20000: uvm_test_top [RESULT] TEST PASSED
UVM_ERROR :    0
UVM_FATAL :    0
```

Is it a pass?

<details>
<summary>Answer: a vacuous pass</summary>

No. The virtual sequence's `body()` is empty, so it returns at once; the test drops its objection at 0 ns and the run ends after the 20 ns drain time. Nothing was sent and nothing was compared. A regression script that looks only for `TEST PASSED`, or for `UVM_ERROR : 0`, would mark it green. Step 4 adds `SCB_NO_TRAFFIC`, which turns "nothing was checked" into an error.

</details>

## Step 3: The virtual sequence decides the order

1. **`check_handles()`.** For each of `p_sequencer.cfg_sqr` and `p_sequencer.din_sqr`, raise `` `uvm_fatal("NO_SQR", ...) `` when it is null. `p_sequencer` is the typed handle that `` `uvm_declare_p_sequencer(mx_vsqr) `` declares (IEEE 1800.2-2020 Annex B.3.3).
2. **`body()`.** Call `check_handles()`, then the four steps of [the scenario](#the-scenario), in order.

`child.start(sqr, this)` returns when the child's `body()` returns (IEEE 1800.2-2020 §14.2.3.1), so four calls in a row run one after the other. The virtual sequencer does not order anything; it only holds handles.

Why is the second `program_dut` call a **safe point** for reconfiguration?

<details>
<summary>Answer: nothing the change could affect is still in flight</summary>

`send_burst` returns only after the DUT has sampled the burst's last byte. From then on, no byte of burst 1 can be accepted with the new configuration: R1 says each accepted byte is transformed with the values held before its edge, and the outputs still on their way carry the configuration they were accepted with. The first write of `program_dut` clears `EN`, which unlocks `KEY` and `MODE` (R4). If the virtual sequence wrote `KEY` without clearing `EN` first, the DUT would ignore it: that is mutant 2 in step 6.

Why check the handles at all? Started with `this` as parent, a child given a null sequencer falls back to its parent's sequencer, `vsqr`, which no driver ever pulls from. The run then hangs until the phase timeout, with no message that names the cause. A-UVM-8's debugging table lists this signature.

</details>

## Step 4: The scoreboard follows the configuration bus

The scoreboard's predictor keeps its own copy of the DUT's registers (`en`, `mode`, `key`), updated only from what the configuration monitor saw, never from what the sequence intended. Fill in, from the specification:

1. **`apply(w)`.** One write, on that copy. A `CTRL` write sets `en`, and sets `mode` only while `en` is 0. A `KEY` write while `en` is 1 is ignored by the DUT (R4): count `order_cnt` and report `` `uvm_error("ORDER", ...) ``; otherwise update `key`.
2. **`commit_before(t)`.** Apply, oldest first, every write in `pending_cfg` whose `stamp` is earlier than `t`.
3. **`predict(din)`.** R3, written from the specification, not copied from the RTL.
4. **`write_cfg(w)`.** `commit_before(w.stamp)`, then `pending_cfg.push_back(w)`.
5. **`write_in(b)`.** `commit_before(b.stamp)`. If `en` is 0, the DUT drops the byte (R2): count `order_cnt` and report `` `uvm_error("ORDER", ...) ``. Otherwise push `predict(b.data)` onto `expected`.
6. **`write_out(b)`.** With nothing in `expected`, count a mismatch (`SCB_UNEXPECTED`). Otherwise pop the oldest prediction and compare with `!==`; count `match_cnt` or `mismatch_cnt` (`SCB_MISMATCH`).
7. **`check_phase`.** `SCB_PENDING` when predictions are left in `expected`; `SCB_NO_TRAFFIC` when `match_cnt + mismatch_cnt` is 0.

The three imps exist because one component cannot have three methods named `write()`: `` `uvm_analysis_imp_decl(_cfg) `` declares an imp class whose `write()` calls your `write_cfg()` (IEEE 1800.2-2020 Annex B.5.22).

Why queue the writes and commit them by stamp, instead of applying each write when it arrives?

<details>
<summary>Answer: two monitors sampling the same edge publish in an order the standard leaves open</summary>

The configuration monitor and the data-in monitor both wake on the same clock edge. Which one runs first, and so which `write()` the scoreboard sees first, is not defined (IEEE 1800-2023 §4.7). R1 says a write sampled at edge *t* affects bytes sampled after *t*, never a byte sampled at *t*. With the stamp, `write_in` for a byte at *t* commits only writes stamped before *t*, so the prediction is right in either order.

This is not hypothetical: in mutant 1 (step 6) the enabling `CTRL` write and the third data byte, 0x4A, are both sampled at 75 ns. Apply-on-arrival gives two different results depending on process order. If the byte arrives first, it is reported as `ORDER`, which is right. If the write arrives first, the scoreboard predicts an output for 0x4A that the DUT never produces, and every later output is compared with the prediction before it. A variant of the solution whose `write_cfg` calls `apply(w)` at once was run on Verilator 5.052, which ran the configuration monitor first: the clean test still passed, but mutant 1 ended with

```text
SCB_SUMMARY matches=0 mismatches=9 pending=1 order=2
```

instead of `matches=9 mismatches=0 pending=0 order=3`: nine mismatches that point at the DUT instead of the stimulus, and a signature that may change from one simulator to another.

The price: a write is applied only when a later transaction arrives. That is why, in mutant 2, `LOCK_SVA` fires at 145 ns but the scoreboard's `ORDER` for the same write appears at 155 ns, when the next write commits it. The message prints the write's own stamp, 145000.

</details>

Run `mx_reconfig_test`. The summary must read `SCB_SUMMARY matches=12 mismatches=0 pending=0 order=0`.

## Step 5: Cross-interface ordering assertions

In `tb_top`, add two concurrent assertions, clocked on `posedge clk` and disabled while `rst_n` is 0. They read the DUT's `EN` register as `dut.en`:

- `ORDER_SVA`: `din_bus.valid |-> dut.en` (R2).
- `LOCK_SVA`: `(cfg_bus.we && cfg_bus.addr == ADDR_KEY) |-> !dut.en` (R4).

Report each failure with `` `uvm_error("ORDER_SVA", ...) `` or `` `uvm_error("LOCK_SVA", ...) `` in the action block, so it is counted with every other UVM error. A concurrent assertion evaluates its expressions with the values sampled before the edge (IEEE 1800-2023 §16.5.1), which is exactly the `EN` the DUT uses at that edge; in the message, `$sampled(din_bus.data)` (§16.9.3) prints the byte that was dropped.

The scoreboard already reports `ORDER`; why have both? The assertions check the rule at the pins, whatever virtual sequence or scoreboard configuration runs, and they still fire when `has_scoreboard` is 0. The scoreboard check names the rule in transaction terms, next to the predictions it changes. A-UVM-8's section "Checking across agents" compares the alternatives.

### Expected log, clean run

Captured from Verilator 5.052 with `+UVM_TESTNAME=mx_reconfig_test` (the default). File names and line numbers are trimmed:

```text
UVM_INFO @ 0: reporter [RNTST] Running test mx_reconfig_test...
UVM_INFO ... @ 0: uvm_test_top [TEST] Running mx_reconfig_vseq
UVM_INFO ... @ 245000: uvm_test_top.env.scb [SCB_SUMMARY] SCB_SUMMARY matches=12 mismatches=0 pending=0 order=0
UVM_INFO ... @ 245000: uvm_test_top [RESULT] TEST PASSED
UVM_WARNING :    2
UVM_ERROR :    0
UVM_FATAL :    0
```

The two warnings are uvm-core's `NO_DPI_USED` and `NO_VISIT_CHECK`, because this build defines `UVM_NO_DPI` (see [Running the lab](#running-the-lab)). Times are in ps, the simulation precision. The clock's rising edges are at 5, 15, 25 ns and so on, and reset is released after the edge at 35 ns.

| Time (ns) | What the DUT samples |
|---|---|
| 55, 65, 75 | `CTRL`=0x00, `KEY`=0x3C, `CTRL`=0x01 |
| 85 to 135 | burst 1, one byte per edge; outputs at 95 to 145 |
| 145, 155, 165 | `CTRL`=0x00, `KEY`=0xA5, `CTRL`=0x03 |
| 175 to 225 | burst 2; outputs at 185 to 235 |
| 245 | end of the 20 ns drain time after the objection is dropped at 225 |

## Step 6: Run the mutant tests

A test you have never seen fail is no evidence. `work/mx_mutants.svh` holds three mutants. The first two are factory type overrides of `mx_reconfig_vseq` (IEEE 1800.2-2020 §8.2.4.2.5), so they run on your environment, your scoreboard and your assertions; the third changes the topology. Predict each signature, run it with `+UVM_TESTNAME=<name>`, then compare.

| Test | What the mutant does | Signature (captured from Verilator) |
|---|---|---|
| `mx_data_first_test` | `fork program_dut(...); send_burst(...); join`: the burst does not wait for `EN` | 3 `ORDER_SVA` and 3 `ORDER` (bytes 0x10, 0x2D, 0x4A at 55, 65 and 75 ns), `SCB_SUMMARY matches=9 mismatches=0 pending=0 order=3`, `TEST FAILED: 6 errors` |
| `mx_no_quiesce_test` | writes `KEY`=0xA5 and `CTRL`=0x03 while `EN` is 1 | `LOCK_SVA` at 145 ns, `ORDER` at 155 ns, `SCB_SUMMARY matches=12 mismatches=0 pending=0 order=1`, `TEST FAILED: 2 errors` |
| `mx_passive_cfg_test` | makes `cfg_agt` passive | `UVM_FATAL ... uvm_test_top.env.vsqr@@vseq [NO_SQR] vsqr.cfg_sqr is null: is cfg_agt passive?` at 0 ns |

`mx_data_first_test`, in full:

```text
UVM_INFO ... @ 0: uvm_test_top [TEST] Running mx_data_first_vseq
UVM_ERROR ... @ 55000: reporter [ORDER_SVA] din_valid sampled while EN = 0: byte 0x10 dropped
UVM_ERROR ... @ 55000: uvm_test_top.env.scb [ORDER] byte 0x10 @55000 sent while EN = 0: the DUT drops it (R2)
UVM_ERROR ... @ 65000: reporter [ORDER_SVA] din_valid sampled while EN = 0: byte 0x2d dropped
UVM_ERROR ... @ 65000: uvm_test_top.env.scb [ORDER] byte 0x2d @65000 sent while EN = 0: the DUT drops it (R2)
UVM_ERROR ... @ 75000: reporter [ORDER_SVA] din_valid sampled while EN = 0: byte 0x4a dropped
UVM_ERROR ... @ 75000: uvm_test_top.env.scb [ORDER] byte 0x4a @75000 sent while EN = 0: the DUT drops it (R2)
UVM_INFO ... @ 215000: uvm_test_top.env.scb [SCB_SUMMARY] SCB_SUMMARY matches=9 mismatches=0 pending=0 order=3
UVM_INFO ... @ 215000: uvm_test_top [RESULT] TEST FAILED: 6 errors
UVM_ERROR :    6
UVM_FATAL :    0
```

What each mutant teaches:

- **Mutant 1: the comparator alone sees nothing.** The three dropped bytes were never predicted, so there is no mismatch and nothing pending: `matches=9 mismatches=0 pending=0`. Only the ordering checks fail the run. A scoreboard that skipped those bytes silently, in a bench without `ORDER_SVA`, would pass this broken test.
- **Mutant 2: the DUT did what R4 says.** The `KEY` write is ignored and `MODE` keeps its value, so burst 2 runs with the old configuration, and the scoreboard, which models R4, predicts exactly that: 12 matches. The failure is in the stimulus, and only the ordering checks say so.
- **Mutant 3: a passive agent has no sequencer.** `check_handles()` turns a silent hang into a fatal that names the agent. Without the call, `program_dut` starts its child on a null handle, the child falls back to `vsqr`, and nothing ever pulls its first item. Captured from a solution variant without the call: `UVM_FATAL ... [PH_TIMEOUT] Explicit timeout of 100000000 hit, indicating a probable testbench issue` at 100 µs, the test's `set_timeout()`, with no message that names the agent.

## Step 7: Break the DUT and watch the bench catch it

Run each test with each planted bug, **predict** first, then compare with the table. Captured from Verilator 5.052:

| Test | Correct DUT | `+BUG=1` (`MODE` ignored: always XOR) | `+BUG=2` (`EN` one edge late) | Your bug: a `CTRL` write while `EN` is 1 also sets `MODE` |
|---|---|---|---|---|
| `mx_reconfig_test` | `matches=12`, PASSED | `matches=7 mismatches=5` | `matches=0 mismatches=10 pending=2` | `matches=12`, PASSED: **escapes** |
| `mx_data_first_test` | `matches=9 order=3` | `matches=4 mismatches=5 order=3` | `matches=0 mismatches=7 pending=2 order=3` | `matches=9 order=3`: no change |
| `mx_no_quiesce_test` | `matches=12 order=1` | `matches=12 order=1`: no change | `matches=0 mismatches=11 pending=1 order=1` | `matches=6 mismatches=6 order=1` |

To plant your own bug, in `work/key_stream.sv` change `if (!en) mode <= cfg_wdata[1];` to `mode <= cfg_wdata[1];`. Remove it when you are done and rerun `mx_reconfig_test`: `TEST PASSED`.

<details>
<summary>Why five mismatches, not six, for BUG=1?</summary>

Only burst 2 uses `MODE` = ADD. For 0x1A with key 0xA5, `0x1A + 0xA5` = 0xBF = `0x1A ^ 0xA5`: the two values have no 1 bit in the same position, so the addition has no carry and equals the XOR. A DUT that ignores `MODE` gets that byte right by accident. Burst 1 never exercises `MODE` at all, which is why a test without a mid-stream reconfiguration misses this bug entirely.

</details>

<details>
<summary>Why does one dropped byte give ten mismatches for BUG=2?</summary>

The first byte of each burst arrives one edge after `EN` rises, and the late `EN` drops it. The scoreboard compares in order, so every later output is compared with the prediction for the byte before it, and the count explodes. Read the first error, not the count: `expected 0x2c observed 0x11`, and 0x11 is the prediction for the *second* byte, so the first byte's output is missing. `pending=2`, one per burst, confirms it. The bug is visible only because `program_dut` returns at the enabling edge and `send_burst` drives its first byte at once; a bench that waited a few idle cycles between configuration and data would never see it.

</details>

<details>
<summary>Why does only the mutant catch your bug?</summary>

The correct virtual sequence writes `CTRL` while `EN` is 1 only to clear `EN`, and at that moment `MODE` is still 0 (XOR), so the buggy DUT rewrites `MODE` with the value it already has. Legal programming never exercises the lock on `MODE`. Mutant 2 writes `CTRL`=0x03 while `EN` is 1: the correct DUT keeps XOR, the buggy one switches to ADD, and burst 2 mismatches. R4 is a DUT feature, so a verification plan needs a test that writes while locked on purpose. That test expects `LOCK_SVA` and `ORDER` errors, so it needs expected-error accounting, which [A-UVM-9](/curriculum/T3_Advanced/A-UVM-9_Reset_and_Error_Injection/index) teaches.

</details>

## Running the lab

Run from the lab folder. You need uvm-core 2020.3.1 (IEEE 1800.2-2020), either your simulator's built-in UVM library or the Accellera sources, with `$UVM_HOME/src` on the include path, and `work/` on the include path for `mx_mutants.svh`. These are the commands the expected logs in this README were captured with, on Verilator 5.052:

```bash
export UVM_HOME=/path/to/uvm-core-2020.3.1
verilator --binary --timing -Wno-fatal -Wno-lint -Wno-style --timescale 1ns/1ps \
  +define+UVM_NO_DPI -I$UVM_HOME/src -Iwork \
  $UVM_HOME/src/uvm_pkg.sv work/key_stream.sv work/mx_tb.sv --top-module tb_top
./obj_dir/Vtb_top +UVM_TESTNAME=mx_reconfig_test
./obj_dir/Vtb_top +UVM_TESTNAME=mx_data_first_test
./obj_dir/Vtb_top +UVM_TESTNAME=mx_reconfig_test +BUG=1
```

For the reference solution, replace `work/mx_tb.sv` with `solution/mx_tb.sv`. With a commercial simulator, compile the same files in the same order with its UVM switch and run `tb_top` with the same plusargs; `+UVM_TESTNAME` selects the test (IEEE 1800.2-2020 Annex G.2.1), and without it `run_test()` creates `mx_reconfig_test`.

Notes on the Verilator route:

- **Build cost.** Compiling uvm-core takes one to five minutes and about 150 MB in `obj_dir/`. Build once: the test and the bug are both chosen at run time, so you rebuild only after you edit a source file.
- **`UVM_NO_DPI`.** It builds uvm-core without its C sources. uvm-core then reads `+UVM_TESTNAME` directly and warns twice (`NO_DPI_USED`, `NO_VISIT_CHECK`); those are the two warnings in the logs. A build with uvm-core's DPI sources was not tried for this lab.
- **2-state.** Verilator has no X or Z, so the `!==` compare behaves like `!=` there. Use a 4-state simulator to see X on `dout` reported as a mismatch.
- **Warnings.** `-Wno-lint -Wno-style` hides the style warnings uvm-core produces; `-Wno-fatal` keeps any remaining warning from stopping the build.

## How a run reports PASS or FAIL

- **The verdict line.** `mx_reconfig_test::report_phase` prints `RESULT TEST PASSED` only when the report server has counted no `UVM_ERROR` and no `UVM_FATAL` (`get_severity_count`, IEEE 1800.2-2020 §6.5.1.2.6). A run with no `RESULT` line, such as a fatal, a crash or a killed job, is a failure.
- **Errors keep going, fatals stop.** `` `uvm_error `` counts a failure and lets the run continue, so one run shows every failure; `` `uvm_fatal `` is for a bench that cannot continue (no configuration, no sequencer) and ends the run at once.
- **No vacuous passes.** `SCB_NO_TRAFFIC` fails a run that compared nothing, and `SCB_PENDING` fails one in which predicted outputs never arrived.
- **Every mutant fails.** The milestone is not the clean run alone: it is the clean run plus every row of the step 6 and step 7 tables failing as predicted.

## Completion checklist

- [ ] The environment sets each agent's configuration object at its own path before creating the agent, and the passive output agent has no sequencer.
- [ ] `vsqr` only holds handles; `mx_reconfig_vseq::body()` orders configuration, burst 1, reconfiguration and burst 2 with sequential `start()` calls.
- [ ] `check_handles()` stops with `NO_SQR` on a null handle.
- [ ] The scoreboard learns the configuration from the configuration monitor, applies it by time stamp, models R2 and R4, and reports `ORDER`, `SCB_MISMATCH`, `SCB_PENDING` and `SCB_NO_TRAFFIC`.
- [ ] `ORDER_SVA` and `LOCK_SVA` report through `` `uvm_error ``.
- [ ] `mx_reconfig_test` ends with `SCB_SUMMARY matches=12 mismatches=0 pending=0 order=0` and `RESULT TEST PASSED`.
- [ ] I have seen all three mutants fail with the signatures in step 6, and `+BUG=1`, `+BUG=2` and my own bug fail where the step 7 table says, and I can explain each escape.

> **Ready to compare?** Open `solution/mx_tb.sv` after you finish.

## References

- IEEE 1800.2-2020: §13.4.2.2 `get_is_active`; §14.2.3.1 `start`; §8.2.4.2.5 `set_type_override`; §10.5.1.3.7 `set_drain_time`; §6.5.1.2.6 `get_severity_count` and §6.5.1.2.18 `get_server`; Annex B.3.3 `` `uvm_declare_p_sequencer ``; Annex B.5.22 `` `uvm_analysis_imp_decl ``; Annex C.4.2 `uvm_config_db`; Annex F.7.3.3 `set_timeout`; Annex G.2.1 `+UVM_TESTNAME`.
- IEEE 1800-2023: §3.14.2.3 time-unit precedence; §4.7 nondeterminism; §9.3.2 `fork`…`join`; §14.4 input and output skews; §14.13 input sampling; §14.16 synchronous drives (§14.16.2, the last of several drives in one time slot wins); §16.5.1 sampling in concurrent assertions; §16.9.3 `$sampled`.
- Lessons: [A-UVM-8: Multi-Agent Topologies](/curriculum/T3_Advanced/A-UVM-8_Multi_Agent_Topologies/index) (this lab's module), [I-UVM-3B: Virtual Sequences and Sequencers](/curriculum/T2_Intermediate/I-UVM-3B_Advanced_Sequencing_and_Layering/virtual-sequences), [A-UVM-6: Scoreboards and Reference Models](/curriculum/T3_Advanced/A-UVM-6_Scoreboards_and_Reference_Models/index), [A-UVM-9: Reset Handling and Error Injection](/curriculum/T3_Advanced/A-UVM-9_Reset_and_Error_Injection/index).
