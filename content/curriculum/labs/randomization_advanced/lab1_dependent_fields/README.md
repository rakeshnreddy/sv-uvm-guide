# Silent Failure Triage Lab

A packet generator fails randomization for one protocol, the test ignores the failure, and the log fills with packets that look valid but are not what the test asked for. Find the contradiction, fix the model, and make the failure impossible to miss.

## Scenario

You are verifying an Ethernet MAC receive path. The spec excerpt at the top of `packet.sv` gives the length rules for each protocol (IPv4, IPv6, RAW) and the receive FIFO's size rule.

The test plan in `test.sv` asks for every protocol in turn: `pkt.randomize() with { proto == wanted; }`. When you run it, the IPV6 rows look like this:

```
Wanted: IPV6 | Got proto: IPV4 | Length: 0 | Payload Size: 0
```

The test asked for IPv6 and got an empty IPv4 packet. `randomize()` returned 0, and when `randomize()` fails, the random variables keep their previous values (IEEE 1800-2023 §18.6.3). For a freshly constructed packet, those are the defaults: `proto` = `IPV4` (value 0), `length` = 0, an empty payload. The test throws the return value away with `void'(...)`, so nothing stops it. Many simulators print a solver warning, but the test still "passes".

## Files

| File | Purpose |
|---|---|
| `packet.sv` | Packet model with the contradiction (edit this) |
| `test.sv` | Generator that ignores `randomize()`'s return value (edit this) |
| `packet_buggy.sv` | Read-only copy of both buggy files in one file, for diffing or running standalone |
| `packet_solution.sv` | Fixed model and test (unlocks when you finish) |

## Your Mission

1. **Make the failure loud.** In `test.sv`, check the return value of `randomize()` and stop with `$fatal(1, ...)` when it is 0. Rerun: the test now stops on the first IPV6 packet.
2. **Triage with `constraint_mode(0)`.** Before `randomize()`, turn off one constraint block at a time, for example `pkt.c_hardware_limit.constraint_mode(0);`. With `c_hardware_limit` off, IPV6 succeeds with length 40. IPV6 also randomizes if you turn off either of the other two blocks instead. All three take part in the contradiction: `length == 40` (`c_proto_len`), `payload.size() == length` (`c_payload_size`) and a size in `{16, 32, 64, 128, 256}` (`c_hardware_limit`), which does not contain 40. The solver cannot tell you which one is wrong; the spec can.
3. **Fix the model, not the symptom.** Compare each constraint with the spec excerpt. The protocol lengths match the spec; the FIFO rule does not: the FIFO takes multiples of 8 bytes from 8 to 256. Rewrite `c_hardware_limit` to match, remove the `constraint_mode(0)` line, and rerun: all six packets succeed, IPV6 with length 40.

## Push Further: the same bug without a failure

Remove the inline `with { proto == wanted; }` from the original code and randomize 1000 packets. `randomize()` never fails: the solver simply never picks IPV6, because no IPV6 solution exists. The contradiction has become a silent **coverage hole**, not a failure. Only a coverpoint on `proto` (or a count of each protocol) would reveal it.
