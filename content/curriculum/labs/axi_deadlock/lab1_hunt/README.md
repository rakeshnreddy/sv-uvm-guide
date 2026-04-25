# AXI Deadlock Hunt Lab

## Objective
In a real SoC, AXI deadlocks are catastrophic — the entire system hangs with no error message. They are caused by **illegal channel dependencies** where a master or slave stalls one AXI channel while waiting for another, creating a circular wait.

In this lab, you will:
1. Study a testbench that contains a **buggy AXI slave** with a subtle cyclic channel-dependency deadlock.
2. Analyze the waveform output to identify **which channel handshake causes the hang**.
3. Complete a set of **SVA protocol assertions** that detect the illegal dependency and fire *before* the system deadlocks.

## Background

### The AXI Channel Dependency Rules

The AXI specification (A3.3 / A3.4) defines strict rules about which channels can wait on other channels. These rules exist specifically to prevent deadlocks.

**Legal dependencies (→ means "can wait for"):**
- `BVALID` → `AWVALID` and `WVALID` (slave can wait for address and data before responding)
- `RVALID` → `ARVALID` (slave can wait for read address before returning data)
- `WVALID` → `AWVALID` (master can wait for AW handshake before sending data)

**Illegal dependencies (deadlock risk):**
- `AWREADY` ↛ `WVALID` — A slave **MUST NOT** stall address acceptance waiting for write data
- `WREADY` ↛ `AWVALID` — A slave **MUST NOT** stall data acceptance waiting for write address (when master sends W before AW)
- `ARREADY` ↛ Any R-channel signal — A slave **MUST NOT** stall AR acceptance waiting for read data to drain

### The Deadlock in This Lab

The testbench drives two concurrent write transactions from a master. The slave has a bug:
- It **refuses to accept write addresses** (`AWREADY` stays low) until it sees **write data** (`WVALID`) arrive first.
- Meanwhile, the master **refuses to send write data** (`WVALID` stays low) until the slave **accepts the address** (`AWREADY` goes high).

This creates a **circular wait**: Master waits for Slave, Slave waits for Master. **Deadlock.**

The deadlock also has a second, more subtle layer: the slave's read channel (`ARREADY`) is blocked because the slave's internal FSM is stuck waiting for the write to complete. This means a **completely independent read transaction also hangs**, demonstrating how channel-dependency bugs cascade.

## Instructions

### Step 1: Run the Simulation

Run the testbench as-is. You will see the simulation **hang** after the master asserts `AWVALID`. The simulation will timeout at `$time = 2000`.

Examine the waveform output printed by the testbench:
- At what cycle does the system freeze?
- Which signals are high and which are low when the deadlock occurs?
- Can you identify the circular dependency from the signal values?

### Step 2: Analyze the Deadlock (Answer These Questions)

Before writing any code, answer these:
1. What is the master waiting for? (Hint: look at which signal the master checks before asserting `WVALID`)
2. What is the slave waiting for? (Hint: look at the `buggy_slave` module's `AWREADY` logic)
3. Why does the read transaction also hang?
4. Which AXI dependency rule (from the Background section) does the slave violate?

### Step 3: Write the Assertions (`axi_deadlock_checker.sv`)

Open `axi_deadlock_checker.sv`. You will find a skeleton checker module with `TODO` markers.

Complete the following assertions:

1. **`p_aw_no_deadlock`**: Assert that when `AWVALID` is high, `AWREADY` must eventually go high within `MAX_WAIT` cycles, regardless of `WVALID` state. This catches the illegal `AWREADY → WVALID` dependency.

2. **`p_w_no_deadlock`**: Assert that when `WVALID` is high, `WREADY` must eventually go high within `MAX_WAIT` cycles. This catches any stall on the write data channel.

3. **`p_ar_no_deadlock`**: Assert that when `ARVALID` is high, `ARREADY` must eventually go high within `MAX_WAIT` cycles. This catches the cascade where read acceptance is blocked by a stuck write FSM.

4. **`p_valid_stability`**: Assert that once `AWVALID` is asserted, it must remain high until `AWREADY` is asserted (VALID must not drop without a handshake).

5. **`p_no_cross_channel_stall`**: Assert that `AWREADY` is not conditioned on `WVALID` by checking that AWREADY can go high even when WVALID is low. (Hint: use a cover property to verify this can happen, or assert that the pattern AWVALID && !WVALID |-> ##[1:MAX_WAIT] AWREADY occurs.)

### Step 4: Verify Your Assertions Fire

After completing the assertions, re-run the simulation. You should see:
- `p_aw_no_deadlock` **FAIL** early (within `MAX_WAIT` cycles of the deadlock starting)
- `p_ar_no_deadlock` **FAIL** because the read channel is cascading from the write deadlock
- The simulation no longer hangs silently — the assertions give clear diagnostic messages indicating *exactly which dependency rule was violated*

## Tips

- The `MAX_WAIT` parameter is set to 32 cycles. Any legal AXI slave must accept a handshake within a reasonable number of cycles.
- Use `$sformatf` in your assertion failure messages to include signal values for debug.
- SVA `s_eventually` is useful for properties that must hold at some point in the future: `AWVALID |-> s_eventually AWREADY`
- The `disable iff (!ARESETn)` clause ensures assertions don't fire during reset.
- Remember: the goal is to catch the deadlock *before* the system hangs, not after.

## Expected Output (After Completing Assertions)

```
# Time    0: RESET asserted
# Time  100: RESET deasserted
# Time  120: Master: Driving AWVALID for Write ID=1, ADDR=0x1000
# Time  130: Master: Driving ARVALID for Read ID=3, ADDR=0x3000
# ... (deadlock begins) ...
# Time  152: SVA FAIL: p_aw_no_deadlock — AWVALID has been high for 32 cycles without AWREADY
# Time  162: SVA FAIL: p_ar_no_deadlock — ARVALID has been high for 32 cycles without ARREADY
# Time  200: TIMEOUT — simulation stopped (deadlock detected by assertions)
```
