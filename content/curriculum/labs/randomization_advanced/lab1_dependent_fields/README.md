# Silent Failure Triage Lab

A complex packet generator is silently failing randomization, generating bogus traffic. Dive into the code, disable conflicting constraints, and fix the generator.

## Scenario
You are verifying an Ethernet MAC that expects a specific payload size and checksum depending on the protocol type (IPv4, IPv6, or RAW).

You run your simulation and notice that occasionally, the testbench drives packets that are entirely zero, causing bad parity on the bus and failing the test. The root cause? `packet.randomize()` is failing, but the testbench ignores the failure.

## Your Mission

1. **Find the Conflict**: Open `packet.sv`. Review the fields and the active constraints. 
2. **Triage**: Use `constraint_mode(0)` in the test to turn off constraints one by one until you identify the contradiction between the `protocol`, `length`, and `payload` rules.
3. **Fix the Test**: 
    - Fix the constraints in `packet.sv` so they are mathematically solvable.
    - Update `test.sv` so that if randomization *ever* fails, the test immediately fatals using `$fatal()`, ensuring this bug can never be "silent" again.
