# Silent Failure Triage Lab

Part of I-SV-2B Advanced Constrained Randomization (Solver Debug and Failure Triage). A packet generator fails randomization for one protocol, the test ignores the failure, and the log fills with packets that look valid but are not what the test asked for. Make the failure impossible to miss, find the contradiction, and fix the model.

## Scenario

You are verifying an Ethernet MAC receive path. The spec excerpt at the top of `packet.sv` gives the length rules for each protocol (IPv4, IPv6, RAW) and the receive FIFO's size rule.

The test plan in `test.sv` asks for every protocol in turn: `pkt.randomize() with { proto == wanted; }`. When you run it, the IPV6 rows look like this:

```text
Wanted: IPV6 | Got proto: IPV4 | Length: 0 | Payload Size: 0
```

The test asked for IPv6 and got an empty IPv4 packet. `randomize()` returned 0, and when `randomize()` fails, the random variables keep their previous values (IEEE 1800-2023 §18.6.3). For a freshly constructed packet, those are the defaults: `proto` = `IPV4` (value 0), `length` = 0, an empty payload. The test throws the return value away with `void'(...)`, so nothing stops it. Most simulators also print a solver diagnostic (its format and severity are tool-dependent), but the test still "passes".

## Files

| File | Purpose |
|---|---|
| `packet.sv` | Package `pkt_pkg` with the packet model and its contradiction (edit this) |
| `test.sv` | Module `tb_top`, a generator that ignores `randomize()`'s return value (edit this) |
| `packet_buggy.sv` | Read-only copy of both buggy files in one file, for diffing or running standalone |
| `packet_solution.sv` | Fixed model and test (unlocks when you finish) |

## Run it

The steps are self-checked: the lab page records your progress, but it does not run the code. Run the files on your own simulator, one that supports constrained randomization (`randomize() with`, `constraint_mode()` and size constraints on dynamic arrays). Open-source simulators support these to different degrees (tool-dependent).

1. Compile `packet.sv` and then `test.sv` in one compilation, in your simulator's SystemVerilog mode.
2. Run the top module `tb_top`.
3. To replay a run exactly, pass the same seed with your simulator's seed option (the option name is tool-specific; IEEE 1800 does not define one).

## Your Mission

1. **Make the failure loud.**
   - **Predict first:** which of the six rows fail, and what do the failed rows print? Then run the starter.
   - The starter prints six rows. Your RAW lengths may differ, because they depend on the seed:

     ```text
     --- Starting Randomization Test ---
     Wanted: IPV4 | Got proto: IPV4 | Length: 32 | Payload Size: 32
     Wanted: IPV6 | Got proto: IPV4 | Length: 0 | Payload Size: 0
     Wanted: RAW | Got proto: RAW | Length: 128 | Payload Size: 128
     Wanted: IPV4 | Got proto: IPV4 | Length: 32 | Payload Size: 32
     Wanted: IPV6 | Got proto: IPV4 | Length: 0 | Payload Size: 0
     Wanted: RAW | Got proto: RAW | Length: 16 | Payload Size: 16
     --- Test Completed ---
     ```

     IPV4 always gets length 32: it is the only value both in 20 to 60 and in the FIFO set. RAW gets one of 16, 32, 64, 128 or 256.
   - In `test.sv`, check the return value of `randomize()` and stop with `$fatal(1, ...)` when it is 0. Rerun: the test prints the first IPV4 row, then stops on the first IPV6 row with your fatal message (the simulator's own wording around it is tool-dependent).
2. **Triage with `constraint_mode(0)`.**
   - Before `randomize()`, switch off one constraint block at a time, **only for the IPV6 rows**: `if (wanted == packet::IPV6) pkt.c_hardware_limit.constraint_mode(0);`. Do not switch `c_hardware_limit` off for every row: RAW has no length rule of its own, so its length (and payload size) could then be any 32-bit value, billions of bytes.
   - With `c_hardware_limit` off, IPV6 succeeds: `Wanted: IPV6 | Got proto: IPV6 | Length: 40 | Payload Size: 40`. IPV6 also randomizes if you switch off `c_proto_len` or `c_payload_size` instead (the length or the size it prints then comes from the remaining rules).
   - So the smallest conflicting set has four members: `length == 40` (`c_proto_len`), `payload.size() == length` (`c_payload_size`), a size in `{16, 32, 64, 128, 256}` (`c_hardware_limit`), which does not contain 40, and the inline `proto == wanted`. `constraint_mode()` switches only named blocks (§18.9), so it cannot switch off the inline constraint; you remove that one by editing the call, which is what the Push Further section does.
   - The solver cannot tell you which rule is wrong; the spec can.
3. **Fix the model, not the symptom.**
   - Compare each constraint with the spec excerpt. The protocol lengths match the spec; the FIFO rule does not: the FIFO takes multiples of 8 bytes from 8 to 256.
   - Rewrite `c_hardware_limit` to match, remove the `constraint_mode(0)` line, and rerun. All six packets randomize:

     ```text
     --- Starting Randomization Test ---
     Wanted: IPV4 | Got proto: IPV4 | Length: 48 | Payload Size: 48
     Wanted: IPV6 | Got proto: IPV6 | Length: 40 | Payload Size: 40
     Wanted: RAW | Got proto: RAW | Length: 200 | Payload Size: 200
     Wanted: IPV4 | Got proto: IPV4 | Length: 24 | Payload Size: 24
     Wanted: IPV6 | Got proto: IPV6 | Length: 40 | Payload Size: 40
     Wanted: RAW | Got proto: RAW | Length: 64 | Payload Size: 64
     --- Test Completed ---
     ```

     IPV6 is always 40. IPV4 lengths come from {24, 32, 40, 48, 56} and RAW lengths are multiples of 8 from 8 to 256, so your values will differ with the seed.

## Push Further: the same bug without a failure

Remove the inline `with { proto == wanted; }` from the original code and randomize 1000 packets. `randomize()` never fails: the solver simply never picks IPV6, because no IPV6 solution exists. The contradiction has become a silent **coverage hole**, not a failure. Only a coverpoint on `proto` (or a count of each protocol) would reveal it.
