# Lab: Structs, enums and arrays in a packet-decoder bench

This lab belongs to module F2A. Do it after [F2A: Structs, Unions and Enums](/curriculum/T1_Foundational/F2A_Core_Data_Types/structs-unions-enums) and [F2B: Dynamic Data Structures](/curriculum/T1_Foundational/F2B_Dynamic_Structures/index), because it uses the types of both lessons in one bench.

The DUT, `pkt_decoder`, reads a 16-bit packet header and reports whether it accepts the packet. Its ports are plain vectors, as RTL ports usually are. Your testbench gives the same bits names and meaning: an **enum** for the packet kind and the error code, a **packed struct** for the header and for the decoder's answer, a **dynamic array** for the list of headers to send, and **associative arrays** for the traffic tables you check at the end.

## What you will practise

- `typedef enum` with chosen values and a 4-state base type, and the enum methods `first()`, `last()`, `next()` and `name()` (IEEE 1800-2023 §6.19).
- `typedef struct packed`: field order, `$bits`, building a value by member name, and using the whole struct as one vector (§7.2, §7.2.1).
- Putting an integer into an enum safely: `$cast` called as a function returns 0 instead of making an invalid assignment (§6.24.2), and a whole struct written from a vector copies any bits, member or not.
- A dynamic array sized with `new[N]`, then grown with `new[N](old)` so that its contents survive (§7.5.1).
- Associative arrays keyed by a 4-bit value and by an enum: allocation by `+=` (§7.8.7), `exists()`, `first()`/`next()` and `foreach` (§7.9, §12.7.3).
- A self-checking bench: a reference model written from the specification, a `!==` compare, one `PASS=<n> FAIL=<m>` line, and proof that it can fail.

The function headers are given. You write their bodies; F2D explains functions and tasks in full.

## Files

- `work/pkt_pkg.sv`: the testbench's types. The starter has placeholder vectors; you write the real types in step 2.
- `work/pkt_decoder.sv`: the DUT. Read its specification below, not its RTL, when you write the model.
- `work/tb_top.sv`: the starter testbench. It compiles and runs, but checks nothing. Each `TODO step N` comment marks code you write in step N.
- `solution/pkt_pkg.sv` and `solution/tb_top.sv`: one reference solution. Open them only after you finish.

Compile the package first, then the DUT, then the bench (commands under [Running the lab](#running-the-lab)). Never compile a `work/` file together with its `solution/` twin: they declare the same package or module. Every package and module declares `timeunit 1ns; timeprecision 1ps;`, because a design in which some design elements have a time unit and others do not is an error (§3.14.2.3).

## The DUT: a packet-header decoder

`pkt_decoder` is combinational: its outputs follow `hdr` with no clock.

| Port | Direction | Meaning |
|---|---|---|
| `hdr` | input, 16 bits | One packet header (layout below). |
| `accept` | output | 1 when the packet is accepted. |
| `err` | output, 2 bits | Why the header is wrong: 0 none, 1 bad kind, 2 bad checksum, 3 payload too long. |
| `dest` | output, 4 bits | The destination of an accepted packet, else 0. |
| `len` | output, 5 bits | The payload length of an accepted packet, else 0. |

The header layout, most significant bit first:

| Bits | Field | Meaning |
|---|---|---|
| `[15:13]` | `kind` | 0 IDLE, 1 READ, 2 WRITE, 4 RESP. The values 3, 5, 6 and 7 are not kinds. |
| `[12:9]` | `dest` | Destination, 0 to 15. |
| `[8:4]` | `len` | Payload length in bytes, 0 to 31; at most 16 is legal. |
| `[3:0]` | `chk` | Checksum of the upper twelve bits. |

The rules:

- **D1.** The kind is legal when it is 0, 1, 2 or 4.
- **D2.** The checksum is right when `chk` equals `hdr[15:12] ^ hdr[11:8] ^ hdr[7:4]`.
- **D3.** `err` names the first rule that fails, in this order: 1 when the kind is illegal, else 2 when the checksum is wrong, else 3 when `len` is greater than 16, else 0.
- **D4.** `accept` is 1 when `err` is 0 and the kind is not IDLE. An IDLE header with no error is dropped quietly: `accept` 0, `err` 0.
- **D5.** When `accept` is 1, `dest` and `len` copy the header's fields; otherwise both are 0.

The parameter `BUG` plants a known bug for step 7; the testbench sets it with `localparam int DUT_BUG = 0;`. Leave it at 0 until then.

## Step 1: Run the starter

Compile `work/pkt_pkg.sv`, `work/pkt_decoder.sv` and `work/tb_top.sv` and run. It prints (captured with Verilator 5.052; your simulator adds its own `$finish` lines):

```text
TEST 0 packets
PASS=0 FAIL=0
```

Before you read on: the line matches `PASS=<n> FAIL=0`. Is it a pass?

<details>
<summary>Answer: a vacuous pass</summary>

No. The stimulus list is empty, so nothing was sent and nothing was compared. A script that looks only for `FAIL=0` would mark this run green. Step 6 makes `report()` turn "nothing was checked" into a failure.

</details>

## Step 2: The types

In `work/pkt_pkg.sv`, replace the four placeholder `typedef`s. Keep the names; the bench uses them.

1. **`kind_e`**: `typedef enum logic [2:0]` with `K_IDLE = 3'd0`, `K_READ = 3'd1`, `K_WRITE = 3'd2` and `K_RESP = 3'd4`. The values must match D1 exactly, because the enum will be laid over the DUT's bits.
2. **`err_e`**: `typedef enum logic [1:0]` with `E_NONE`, `E_KIND`, `E_CHK` and `E_LEN`, valued 0 to 3 in that order (D3).
3. **`hdr_t`**: `typedef struct packed` with the members `kind_e kind`, `logic [3:0] dest`, `logic [4:0] len` and `logic [3:0] chk`. The first member is the most significant end (§7.2.1), so this order puts `kind` in bits `[15:13]`.
4. **`dec_t`**: `typedef struct packed` with `logic accept`, `err_e err`, `logic [3:0] dest` and `logic [4:0] len`, in that order: 12 bits, the same order as the concatenation `{accept, err, dest, len}` the bench builds from the DUT's ports.

Then, in `work/tb_top.sv`, delete the `/*` and `*/` lines in `check_types()` so its checks run. It checks `$bits(hdr_t)` and `$bits(dec_t)`, and builds `'{kind: K_WRITE, dest: 4'hA, len: 5'd17, chk: 4'h5}`, which must be `16'h5515`. Rerun: the output is unchanged, and a wrong width or field order stops the run with a `TYPES` fatal.

<details>
<summary>Why a 4-state base, logic [2:0], and not bit [2:0]?</summary>

A variable of an enum with a 4-state base starts at x, which is not a member, so a kind that nobody wrote shows up as an error and as an empty `name()`. With a 2-state base it would start at 0, which is `K_IDLE`, a legal value that hides the missing write. F2A's Make It Work shows the same effect for `opcode_e`.

</details>

<details>
<summary>Predict: swap the order of dest and len in hdr_t. What happens?</summary>

`hdr_t` is still 16 bits, so the `$bits` check passes, but the probe becomes `{3'b010, 5'b10001, 4'b1010, 4'b0101}`, which is `16'h51A5`, and `check_types()` stops the run with the field-order fatal. Without that check, every `dest` and `len` the bench reads from a header would come from the wrong bits, while the DUT reads the right ones.

</details>

## Step 3: The reference model

Write these five function bodies in `work/tb_top.sv`, from rules D1 to D5, not from the RTL. A model that copies the design's expressions copies its bugs, and can never disagree with it.

1. **`hdr_chk(h)`** (D2): return `h[15:12] ^ h[11:8] ^ h[7:4]`. A packed struct used as a primary is one vector (§7.2.1), so you can part-select it.
2. **`kind_is_member(raw)`** (D1): declare `kind_e k;` and return `$cast(k, raw) != 0`. Called as a function, `$cast` returns 1 and assigns when the value is a member, and returns 0 without assigning when it is not (§6.24.2).
3. **`make_hdr(k, d, l)`**: build `h` by member name, `'{kind: k, dest: d, len: l, chk: 4'h0}`, then `h.chk = hdr_chk(h);` and return `h`.
4. **`raw_hdr(kind, d, l, good_chk)`**: assign the concatenation `{kind, d, l, 4'h0}` to an `hdr_t`, then set `chk` to `hdr_chk(h)` when `good_chk` is 1 and to `~hdr_chk(h)` when it is 0.
5. **`model_decode(h)`**: start from `'{accept: 1'b0, err: E_NONE, dest: 4'd0, len: 5'd0}`. Set `err` with an `if`/`else if` chain in D3's order, using `kind_is_member(h.kind)`, `h.chk !== hdr_chk(h)` and `h.len > MAX_LEN`. Then set `accept` from D4, and copy `dest` and `len` when `accept` is 1 (D5).

<details>
<summary>Predict: raw_hdr(3'd5, ...) puts 5 into the kind member. Would h.kind = 3'd5; compile?</summary>

No. Enums are strongly typed: assigning a value that is not of the enum type to an enum variable needs a cast (§6.19.3). `raw_hdr` gets 5 in anyway, because it writes the **whole** packed struct from a vector, and a packed struct is assigned as one vector (§7.2.1); nothing checks its enum member. A DUT's output bus decoded into a struct reaches the same place. That is why the model checks `kind` with `kind_is_member()` instead of trusting its type, and why `dec_str()` uses `name()`, which returns `""` for a value that is not a member (§6.19.5.6).

</details>

## Step 4: The stimulus list

Fill in `build_stimulus()`. Size `stim` with `stim = new[6];` and fill entries 0 to 5 with `make_hdr`. Then grow it to 10 entries **and keep the first six**:

```systemverilog
stim = new[stim.size() + 4](stim);
```

`new[N](old)` copies the old elements into the new array and pads the rest with default values (§7.5.1). Then fill entries 6 to 8 with `raw_hdr` and entry 9 with `make_hdr`. Each row of the plan exercises a rule:

| # | Header | Rule | The model expects |
|---|---|---|---|
| 0 | `make_hdr(K_READ, 3, 4)` | an ordinary packet | accept, dest 3, len 4 |
| 1 | `make_hdr(K_WRITE, 3, 16)` | D3: the longest legal payload | accept, dest 3, len 16 |
| 2 | `make_hdr(K_WRITE, 5, 17)` | D3: one byte too long | `E_LEN` |
| 3 | `make_hdr(K_RESP, 9, 0)` | a legal packet with no payload | accept, dest 9, len 0 |
| 4 | `make_hdr(K_IDLE, 0, 0)` | D4: IDLE is never accepted | no accept, `E_NONE` |
| 5 | `make_hdr(K_READ, 5, 8)` | an ordinary packet | accept, dest 5, len 8 |
| 6 | `raw_hdr(3'd2, 9, 2, 0)` | D2: a WRITE with a wrong checksum | `E_CHK` |
| 7 | `raw_hdr(3'd5, 3, 1, 1)` | D1: kind 5 is not a member | `E_KIND` |
| 8 | `raw_hdr(3'd3, 7, 4, 0)` | D3 order: bad kind **and** wrong checksum | `E_KIND`, not `E_CHK` |
| 9 | `make_hdr(K_WRITE, 9, 16)` | a second packet for destination 9 | accept, dest 9, len 16 |

Rows 1 and 2 sit on both sides of the length limit, so a limit that is off by one cannot slip through. Row 8 is the only header that breaks two rules at once: without it, nothing tests the order in D3.

Rerun. The first line is now `TEST 10 packets`, and the summary is still `PASS=0 FAIL=0`, because nothing checks yet.

## Step 5: The per-packet check

1. **`dec_str(d)`**: return `$sformatf("accept=%b err=%s dest=%0d len=%0d", d.accept, d.err.name(), d.dest, d.len)`.
2. **`check_packet(idx, h)`**: the main loop has already driven `hdr_word` and waited `#1` for the combinational DUT to settle. Then:
   - Build the DUT's answer as a struct from its ports, `act = {accept, err, dest, len};`, and the model's, `exp = model_decode(h);`.
   - Count the model's error: `seen_err[exp.err]++;`.
   - Compare `act !== exp`. On a difference count `fail_cnt++` and report it with `$error("PKT %0d hdr=%h: got %s, expected %s", ...)`; otherwise count `pass_cnt++`.
   - When the model accepts, add its length to the model's table: `exp_bytes[exp.dest] += int'(exp.len);`. When the DUT accepts (`act.accept === 1'b1`), add to the DUT's table, `act_bytes[act.dest] += int'(act.len);`, and count `count_by_kind[h.kind]++;`.

`+=` on a key that does not exist yet is safe: an increment both reads and writes, and the standard allocates the missing entry with its default value, 0, before the read (§7.8.7). A plain read of a missing key is different: it returns the default value and issues a warning (§7.8.6).

Rerun: `PASS=10 FAIL=0`. Use `!==`, not `!=`: with `!=`, an x bit makes the condition x, `if` takes the `else` branch, and an unknown result counts as a pass.

## Step 6: Tables, plan and verdict

1. **`print_traffic()`**: walk `count_by_kind` in key order and print one `KIND <name> accepted=<n>` line per kind. `first(k)` puts the smallest key into `k` and returns 0 when the array is empty; `next(k)` moves `k` to the next larger key and returns 0 when there is none (§7.9.4, §7.9.6):

   ```systemverilog
   kind_e k;
   if (count_by_kind.first(k) != 0) begin
     do $display("KIND %s accepted=%0d", k.name(), count_by_kind[k]);
     while (count_by_kind.next(k) != 0);
   end
   ```

   Then print one `DEST <d> bytes=<n>` line per key of `exp_bytes` with `foreach (exp_bytes[d])`.
2. **`compare_tables()`**: for every key `d` of `exp_bytes`, count a failure if `act_bytes.exists(d)` is 0 or the two values differ, and a pass otherwise. Then, for every key of `act_bytes`, count a failure if `exp_bytes` has no such key: a destination the DUT used that the model never expected. Check `exists()` before you read the other table, so a missing key is never read.
3. **`check_plan()`**: every member of `err_e` must have been predicted at least once, or the list does not test the rule that produces it. Walk the members with the enum methods (§6.19.5), and count a failure with a `PLAN` message for each one that `seen_err.exists(e)` does not find, and a pass otherwise:

   ```systemverilog
   err_e e = e.first();
   forever begin
     // look e up in seen_err here
     if (e == e.last()) break;
     e = e.next();
   end
   ```

4. **`report()`**: before the `PASS=%0d FAIL=%0d` line, count a failure with an `$error` when `pass_cnt == 0 && fail_cnt == 0`.

Why compare the tables when every packet was already compared? The tables check the bench's bookkeeping from another angle: they would also catch a bench that skipped packets or recorded them under the wrong key. And a DUT that sends traffic to a destination nobody expected shows up as a key in one table only, which is easy to see in a report and easy to miss in a long log.

## Expected log

Run with the solution, or your finished bench, and `DUT_BUG = 0`. Captured with Verilator 5.052 (commands below):

```text
TEST 10 packets
KIND K_READ accepted=2
KIND K_WRITE accepted=2
KIND K_RESP accepted=1
DEST 3 bytes=20
DEST 5 bytes=8
DEST 9 bytes=16
PASS=17 FAIL=0
```

The 17 checks are 10 packets, 3 destinations and 4 error values. The `KIND` lines come out in key order, which for an enum key is its numeric value (§7.8.4): `K_READ` (1), `K_WRITE` (2), `K_RESP` (4). `K_IDLE` never appears, because IDLE is never accepted.

## Step 7: Prove that the bench can fail

A check you have never seen fail is no evidence. Plant each bug, **predict** which checks catch it, run, then compare with the table.

1. **`DUT_BUG = 1`: the length limit is off by one.** The DUT accepts a 17-byte payload.
2. **`DUT_BUG = 2`: the error priority is wrong.** The DUT checks the checksum before the kind.
3. **`DUT_BUG = 3`: `dest` comes from the wrong bits,** `hdr[11:8]` instead of `hdr[12:9]`.
4. **Your own DUT bug: IDLE is accepted.** Set `DUT_BUG = 0` and, in `work/pkt_decoder.sv`, change `accept = (err == 2'd0) && (kind != 3'd0);` to `accept = (err == 2'd0);`.
5. **A bench bug: the list is wiped.** Undo your DUT edit and, in `build_stimulus()`, drop the `(stim)` from `new[stim.size() + 4](stim)`.
6. Undo everything, set `DUT_BUG = 0` and rerun: `PASS=17 FAIL=0`. A planted bug proves the bench, then it goes.

Summary lines, captured with Verilator 5.052:

| Bug | Summary | What catches it |
|---|---|---|
| none | `PASS=17 FAIL=0` | |
| `DUT_BUG = 1` | `PASS=15 FAIL=2` | packet 2 only, and the table for destination 5 (25 bytes, expected 8) |
| `DUT_BUG = 2` | `PASS=16 FAIL=1` | packet 8 only |
| `DUT_BUG = 3` | `PASS=9 FAIL=12` | every accepted packet (5), and the tables (3 missing or wrong destinations, 4 unexpected ones) |
| IDLE accepted | `PASS=16 FAIL=2` | packet 4, and the table: destination 0 appears with 0 bytes nobody expected |
| list wiped | `PASS=14 FAIL=1` on Verilator | only the plan: `PLAN no packet in the list produces E_LEN` |

`DUT_BUG = 1` prints, where `[error]` stands for your simulator's own `$error` prefix with the time, file and line:

```text
TEST 10 packets
[error] PKT 2 hdr=4b1e: got accept=1 err=E_NONE dest=5 len=17, expected accept=0 err=E_LEN dest=0 len=0
KIND K_READ accepted=2
KIND K_WRITE accepted=3
KIND K_RESP accepted=1
DEST 3 bytes=20
DEST 5 bytes=8
DEST 9 bytes=16
[error] TABLE dest=5: got 25 bytes, expected 8
PASS=15 FAIL=2
```

What the table teaches:

- **The off-by-one escapes every row but one.** Only row 2, a 17-byte payload, provokes it. A boundary needs a test on each side.
- **The priority bug needs two faults at once.** Every other bad header breaks one rule, and gives the same `err` in either order. Without row 8, `DUT_BUG = 2` passes.
- **Your IDLE bug shows up twice:** in packet 4's compare, and as a key, destination 0, that only the DUT's table has.
- **The wiped list is a bench bug, and only the plan check sees it.** `new[N]` without `(stim)` gives a fresh array of default values (§7.5.1). On Verilator, which models only 2-state values, those six entries are `16'h0000`: legal IDLE headers that the DUT and the model agree on, so every packet and table check passes. The six lost rows include the only `E_LEN` row, and `check_plan()` reports it. On a 4-state simulator the six entries are all x instead, and their packet checks fail too; the exact count depends on how the simulator evaluates `$cast` and the DUT's `if` conditions on x, so it is not given here.

## Running the lab

Compile the package, the DUT and one testbench, in that order, then run `tb_top` (nothing instantiates it, so it is the top). These are typical invocations; check your simulator's documentation, because options differ between tools and versions.

```bash
# Synopsys VCS
vcs -sverilog work/pkt_pkg.sv work/pkt_decoder.sv work/tb_top.sv
./simv

# Siemens Questa
vlib work
vlog work/pkt_pkg.sv work/pkt_decoder.sv work/tb_top.sv
vsim -c tb_top -do "run -all; quit"

# Cadence Xcelium
xrun work/pkt_pkg.sv work/pkt_decoder.sv work/tb_top.sv

# Verilator 5 (open source)
verilator --binary --timing -Wno-fatal --top-module tb_top work/pkt_pkg.sv work/pkt_decoder.sv work/tb_top.sv
./obj_dir/Vtb_top +verilator+error+limit+100
```

For the reference solution, use `solution/pkt_pkg.sv` and `solution/tb_top.sv` with `work/pkt_decoder.sv`.

Notes on Verilator, which produced every captured log in this README:

- `--timing` is needed for the `#1` in the main loop. Verilator stops on lint warnings unless you pass `-Wno-fatal`.
- By default a Verilator run stops at the first `$error`. The runtime option `+verilator+error+limit+100` lets it continue, so that one run shows every failure and the summary line.
- Verilator models only 2-state values: x becomes a known value, so the `!==`-on-x cases and a never-written `kind_e` cannot show up there. Use a 4-state simulator to see them.
- `verilator --lint-only -Wall` reports two warnings on the solution, both expected: `kind_is_member` never reads `k` (it exists only as the `$cast` destination), and `hdr_chk` never reads bits `[3:0]` of its argument (the checksum covers the upper twelve bits).

## How a run reports PASS or FAIL

- **The summary line is the verdict.** Each run prints exactly one `PASS=<n> FAIL=<m>` line, and a clean run matches `^PASS=\d+ FAIL=0$`. A missing line (a crash, a killed job) is a failure.
- **`$error`** reports a failed check and lets the run continue (on Verilator, with the error-limit option above). **`$fatal`** is for a broken bench, such as wrong types in `check_types()`, and ends the run at once.
- Decide PASS or FAIL from the summary line, not from the process exit status, which the standard does not define.

## Completion checklist

- [ ] `kind_e` and `err_e` are enums with a 4-state base and the values from D1 and D3; `hdr_t` and `dec_t` are packed structs whose field order passes `check_types()`.
- [ ] The model was written from D1 to D5, and checks the kind with `$cast` instead of trusting its type.
- [ ] `stim` was grown with `new[N](stim)`, and the list covers every row of the plan.
- [ ] Every packet is compared with `!==`, and both tables are compared in both directions, reading a key only after `exists()`.
- [ ] Every `err_e` member is predicted at least once, and a run that checked nothing is a failure.
- [ ] With `DUT_BUG = 0` the log ends `PASS=17 FAIL=0`.
- [ ] I have seen `FAIL` greater than 0 for each of the five planted bugs, and I can name the check that catches each one.

> **Ready to compare?** Open `solution/pkt_pkg.sv` and `solution/tb_top.sv` after you finish.
