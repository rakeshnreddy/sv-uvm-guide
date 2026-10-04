# AHB-to-AXI Bridge Debug Lab

## Objective

Protocol bridges are where clean bus theory meets ugly integration reality. The two buses have different boundary rules, and the classic mistake is to mix them up:

- An AHB master must not start an incrementing burst that crosses a **1KB** boundary (Arm IHI0033B.b §3.5).
- An AXI burst must not cross a **4KB** boundary, and an AXI4 INCR burst carries at most **256** transfers (Arm IHI0022E A3.4.1).

Every 4KB boundary is also a 1KB boundary, so a legal AHB burst can never cross 4KB. An AHB-to-AXI bridge therefore never needs a 4KB split. It splits for other reasons:

1. **The AXI 256-transfer limit.** An undefined-length AHB INCR has no length limit of its own. A byte-wide INCR can carry up to 1024 transfers and still stay inside one 1KB region, so the bridge must cut it into AXI bursts of at most 256 transfers.
2. **Width conversion.** When the AHB transfer is wider than the AXI bus, each AHB transfer becomes several AXI transfers, and a WRAP burst may have to become two INCR bursts. This lab uses a 32-bit bus on both sides, so it does not exercise width conversion.

In the other direction, an AXI-to-AHB bridge **must** split at 1KB, because a legal AXI burst may cross a 1KB boundary. An AHB burst that crosses 1KB is never something a bridge should "fix": it is illegal AHB stimulus, and an AHB-side checker must flag it.

In this lab you will debug an AHB-to-AXI bridge with a split bug:

1. Run a directed testbench that issues AHB write bursts through a buggy bridge.
2. Inspect the AXI write address bursts and the WLAST positions the bridge emits.
3. Complete a starter checker that proves every AXI burst carries exactly the transfers its AWLEN announces, and that the AHB stimulus is legal.
4. Fix the split logic so a 300-transfer AHB INCR becomes two legal AXI bursts.

## Background

### AXI burst length and WLAST

AXI encodes the number of transfers as `AxLEN + 1`. For AXI4 INCR bursts that is 1 to 256 transfers; every other burst type is limited to 16 (IHI0022E A3.4.1). The master asserts `WLAST` while it drives the final write transfer of the burst (IHI0022E A3.2.2).

`AWLEN` is only 8 bits wide. A bridge that copies the AHB transfer count into `AWLEN` without splitting silently wraps it: 300 transfers become `AWLEN = 299 mod 256 = 43`, an AXI burst of 44 transfers, while 300 W transfers follow.

### The 4KB rule still applies to the AXI side

Every AXI INCR burst the bridge emits must stay inside one 4KB page (IHI0022E A3.4.1):

```
last_byte  = AWADDR + ((AWLEN + 1) << AWSIZE) - 1     // aligned AWADDR
LEGAL iff  AWADDR[31:12] == last_byte[31:12]
```

With legal AHB input this can never fail, because the AHB request stays inside one 1KB region. The checker keeps it as a safety net.

### HREADY vs HREADYOUT Mechanics

When the AXI side stalls (AWREADY or WREADY deasserted), the bridge must propagate backpressure to the AHB master by driving its HREADYOUT low to extend the AHB data phase:

- **HREADYOUT** is the bridge's own ready output, indicating whether the bridge can complete the current AHB data phase.
- **HREADY** is the bus-level signal the interconnect multiplexes from the selected slave's HREADYOUT. The AHB master samples HREADY; it does not see HREADYOUT directly.
- While it extends a data phase, the bridge drives HRESP to OKAY (IHI0033B.b §5.1.2). HRDATA only has to be valid in the cycle that completes the transfer (IHI0033B.b §6.1.2).

This lab abstracts the AHB side into a request interface, and `req_ready` plays the role of HREADYOUT. The AXI slave in `testbench.sv` never stalls (`AWREADY` and `WREADY` are tied high), so backpressure is not exercised here.

### Write-Data Ordering

When the bridge splits an AHB burst into multiple AXI bursts, it must:

1. **Preserve transfer order:** AXI W transfers arrive in the same order as the AHB data phases.
2. **Match W transfers to bursts:** each AXI burst receives exactly `AWLEN + 1` W transfers, with WLAST on the final transfer of *each* split burst, not only on the final transfer of the whole AHB request.
3. **Drive WSTRB correctly:** for a narrow transfer, the strobes select the byte lanes of that transfer's address and size. A byte transfer at `0x0401` uses `WSTRB = 4'b0010` on a 32-bit bus.

### The Scenarios

The testbench issues these AHB-style requests. All three are legal AHB incrementing bursts.

| Scenario | Start | Transfers | Size | Expected bridge behavior |
|----------|-------|-----------|------|--------------------------|
| `safe_incr4` | `0x0000_2000` | 4 | 4 bytes | One AXI burst of 4 transfers |
| `ends_at_1kb` | `0x0000_03C0` | 16 | 4 bytes | One AXI burst ending at `0x03FF`. Ending exactly at a boundary is legal. |
| `long_incr_bytes` | `0x0000_0400` | 300 | 1 byte | 256 transfers at `0x0400`, then 44 transfers at `0x0500` |

With `+define+ILLEGAL_AHB_INPUT` the testbench adds a negative test:

| Scenario | Start | Transfers | Size | Expected result |
|----------|-------|-----------|------|-----------------|
| `illegal_ahb_1kb` | `0x0000_03F0` | 8 | 4 bytes | Ends at `0x040F`, across the 1KB boundary at `0x0400`. The AHB-side input check fires. The bridge is not at fault. |

The buggy bridge has no 256-transfer cap. For `long_incr_bytes` it emits one AXI burst with `AWLEN = 43` and then sends all 300 W transfers, with WLAST only on the 300th.

## Files

- `testbench.sv` — self-contained directed simulation with the buggy bridge DUT.
- `bridge_split_checker.sv` — starter checker with two worked examples and four TODOs.
- `solution.sv` — completed checker and the corrected split helper.
- `lab.json` — metadata used by the curriculum/lab registry.

## Instructions

### Step 1: Run the Buggy Testbench

Run `testbench.sv` with your simulator. The bridge prints each AXI AW handshake and the transfer on which each burst's WLAST arrives.

Focus on `long_incr_bytes`:

```
AHB request long_incr_bytes    addr=0x00000400 transfers=300 size=1 bytes ...
AXI AW addr=0x00000400 AWLEN=43 (44 transfers) ...
AXI W  WLAST on transfer 300 of this burst
```

The AW channel announced 44 transfers, but WLAST arrived on transfer 300.

### Step 2: Complete the Checker

Open `bridge_split_checker.sv`. Two checks are already written as worked examples: no AXI burst crosses 4KB, and `AWSIZE` matches the AHB transfer size. Implement the TODOs:

1. `p_ahb_input_no_1kb_cross` [AHB protocol]: the request must not cross 1KB. Run with `+define+ILLEGAL_AHB_INPUT` to see it fire.
2. Per-burst W accounting [AXI protocol]: WLAST must arrive on transfer `AWLEN + 1` and on no other transfer.
3. `p_first_split_len` [Bridge design]: a request longer than 256 transfers starts with a full 256-transfer AXI burst at the request address.
4. Total W accounting [Bridge design]: the W transfers sent for a request must equal the AHB transfer count.

With the buggy bridge, checks 2 and 3 fail on `long_incr_bytes`. Check 4 passes, because the bridge does send all 300 transfers, just in the wrong burst. Only per-burst accounting catches the bug.

### Step 3: Fix the Split Logic

In the bridge, find `choose_buggy_burst_beats()`:

```systemverilog
return remaining; // BUG: no 256-transfer cap
```

The corrected function returns at most 256 transfers per AXI burst. It needs no 4KB term.

### Step 4: Re-run

After applying the fix from `solution.sv`, `long_incr_bytes` should emit:

```
AXI AW addr=0x00000400 AWLEN=255 (256 transfers) ...
AXI W  WLAST on transfer 256 of this burst
AXI AW addr=0x00000500 AWLEN=43 (44 transfers) ...
AXI W  WLAST on transfer 44 of this burst
```

At the end of the run, the checker should print:

```
LAB PASS: every AXI burst carried AWLEN+1 transfers and no request lost a transfer
```

## Acceptance Criteria

1. **Legal stimulus**: the AHB input check passes for the three default scenarios and fires for `illegal_ahb_1kb`.
2. **Burst length**: every AXI burst carries exactly `AWLEN + 1` W transfers, with WLAST on the last one.
3. **Split length**: a request longer than 256 transfers starts with a 256-transfer AXI burst.
4. **Write-data accounting**: the total W transfers per AHB request match the AHB transfer count.
5. **Transfer size and 4KB**: `AWSIZE` matches the AHB HSIZE, and no AXI burst crosses 4KB.

## Debug Questions

1. Why can a legal AHB burst never cross a 4KB boundary? Which AHB rule guarantees it?
2. Why is `AWLEN` encoded as transfers minus one, and what happens to a 300-transfer request if the bridge does not split it?
3. Why does the total W count pass with the buggy bridge? What does that tell you about where to put a checker?
4. The `illegal_ahb_1kb` request makes the bridge emit a legal AXI burst. Why must the failure still be reported, and on which side?
5. An AXI-to-AHB bridge receives an AXI INCR16 of words at `0x03F0`. It is legal AXI. What must the bridge do on the AHB side, and why?
6. A 64-bit AHB master is bridged onto a 32-bit AXI bus. How many AXI transfers does an AHB INCR4 of doublewords become, and what `AWSIZE` must the bridge use?
7. What happens to the bridge's HREADYOUT while the AXI side stalls the W channel? Why must HRESP stay OKAY during that time?

## Expected Fix

The fixed splitter computes:

```systemverilog
this_burst = (remaining_beats > 256) ? 256 : remaining_beats;  // AXI4 INCR limit
```

The bridge then advances:

```systemverilog
current_addr += this_burst << size;
remaining    -= this_burst;
```

That keeps every AXI burst legal while preserving the total AHB payload. The interactive bridge explorer in the bridges lesson has a matching "1024-byte INCR" scenario that splits into four 256-transfer bursts.
