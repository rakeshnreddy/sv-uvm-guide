# AHB-to-AXI Bridge Debug Lab

## Objective

Protocol bridges are where clean bus theory meets ugly integration reality. The two buses have different boundary rules, and the classic mistake is to mix them up:

- An AHB master must not start an incrementing burst that crosses a **1KB** boundary (Arm IHI0033B.b §3.5).
- An AXI burst must not cross a **4KB** boundary, and an AXI4 INCR burst carries at most **256** transfers (Arm IHI0022E A3.4.1).

Every 4KB boundary is also a 1KB boundary, so a legal AHB burst can never cross 4KB. An AHB-to-AXI bridge therefore never needs a 4KB split. It splits for other reasons:

1. **The AXI 256-transfer limit.** An undefined-length AHB INCR has no length limit of its own. A byte-wide INCR can carry up to 1024 transfers and still stay inside one 1KB region, so the bridge must cut it into AXI bursts of at most 256 transfers. (With word transfers, 1KB holds exactly 256, so the limit only bites for byte and halfword transfers.)
2. **Width conversion.** When the AHB transfer is wider than the AXI bus, each AHB transfer becomes several AXI transfers, and a WRAP burst may have to become two INCR bursts. This lab uses a 32-bit bus on both sides, so it does not exercise width conversion.

In the other direction, an AXI-to-AHB bridge **must** split at 1KB, because a legal AXI burst may cross a 1KB boundary. An AHB burst that crosses 1KB is never something a bridge should "fix": it is illegal AHB stimulus, and an AHB-side checker must flag it.

In this lab you will debug an AHB-to-AXI bridge with a split bug:

1. **Reproduce the split bug:** run a directed testbench that issues AHB write bursts through a buggy bridge, and inspect the AXI write address bursts and the WLAST positions it emits.
2. **Complete the checker:** prove that every AXI burst carries exactly the transfers its AWLEN announces, that split bursts are contiguous, and that the AHB stimulus is legal.
3. **Fix the split function** so a 300-transfer AHB INCR becomes two legal AXI bursts, and rerun.
4. **Stress the handshakes:** rerun against an AXI slave that waits for WVALID before AWREADY, and explain why the bridge does not deadlock.

The four steps match the steps on the lab page. This lab belongs to the lesson [AHB↔AXI Bridges & System Integration](/curriculum/T3_Advanced/B-AMBA-F1_Bridges_and_System_Integration/index).

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

### What the abstraction leaves out

A real AHB INCR burst carries no length: `HBURST = INCR` means "incrementing burst of undefined length" (IHI0033B.b Table 3-3), and the bridge learns the length only when the master ends the burst. This lab hands the bridge the transfer count up front (`req_beats`), as a bridge that buffers the whole write would know it. The lesson's [Expert: undefined-length INCR](/curriculum/T3_Advanced/B-AMBA-F1_Bridges_and_System_Integration/index#expert-undefined-length-incr-the-bridge-cannot-know-the-length) compares the policies a real bridge can use when it does not know the length.

### HREADY vs HREADYOUT Mechanics

When the AXI side stalls (AWREADY or WREADY deasserted), the bridge must propagate backpressure to the AHB master by driving its HREADYOUT low to extend the AHB data phase:

- **HREADYOUT** is the bridge's own ready output, indicating whether the bridge can complete the current AHB data phase.
- **HREADY** is the bus-level signal the interconnect multiplexes from the selected slave's HREADYOUT. The AHB master samples HREADY; it does not see HREADYOUT directly.
- While it extends a data phase, the bridge drives HRESP to OKAY (IHI0033B.b §5.1.2). HRDATA only has to be valid in the cycle that completes the transfer (IHI0033B.b §6.1.2).

This lab abstracts the AHB side into a request interface, and `req_ready` plays the role of HREADYOUT.

### AXI channel dependencies

The bridge is an AXI master, and AXI forbids one handshake dependency that would deadlock: "a master must not wait for AWREADY to be asserted before driving WVALID. A deadlock condition can occur if the slave is waiting for WVALID before asserting AWREADY" (IHI0022E A3.3.1). A slave *may* wait for WVALID before it raises AWREADY. So the bridge in this lab drives its W channel independently: as soon as it accepts a request, it presents AW and W together, and each channel works out the same split by itself. Write data can therefore reach the AXI interface before, with or after its address (IHI0022E A3.3), and the checker must not assume AW comes first.

By default the AXI slave in `testbench.sv` never stalls (`AWREADY` and `WREADY` tied high). With `+define+AXI_SLAVE_WAITS_FOR_W` it raises AWREADY only after it has seen WVALID and accepts W on about three cycles in four. A bridge whose WVALID waited for AWREADY would hang against that slave; a watchdog then ends the run with a failure.

### Write-Data Ordering

When the bridge splits an AHB burst into multiple AXI bursts, it must:

1. **Preserve transfer order:** AXI W transfers arrive in the same order as the AHB data phases.
2. **Match W transfers to bursts:** each AXI burst receives exactly `AWLEN + 1` W transfers, with WLAST on the final transfer of *each* split burst, not only on the final transfer of the whole AHB request.
3. **Advance the address by bytes:** each AXI burst starts where the previous one ended, `(AWLEN + 1) << AWSIZE` bytes later.
4. **Drive WSTRB correctly:** for a narrow transfer, the strobes select the byte lanes of that transfer's address and size. A byte transfer at `0x0401` uses `WSTRB = 4'b0010` on a 32-bit bus. *Not checked in this lab:* the checker has no `WSTRB` input. The bridge already drives `WSTRB` from each transfer's own address (`lane_strobe()` in `testbench.sv`). Optional extension: add a `WSTRB` input to the checker and assert that it equals the lanes of each W transfer's address and size.

### The Scenarios

The testbench issues these AHB-style requests. All four are legal AHB incrementing bursts.

| Scenario | Start | Transfers | Size | Expected bridge behavior |
|----------|-------|-----------|------|--------------------------|
| `safe_incr4` | `0x0000_2000` | 4 | 4 bytes | One AXI burst of 4 transfers |
| `ends_at_1kb` | `0x0000_03C0` | 16 | 4 bytes | One AXI burst ending at `0x03FF`. Ending exactly at a boundary is legal. |
| `long_incr_bytes` | `0x0000_0400` | 300 | 1 byte | 256 transfers at `0x0400`, then 44 transfers at `0x0500` |
| `long_incr_halfwords` | `0x0000_0400` | 300 | 2 bytes | 256 transfers at `0x0400`, then 44 transfers at `0x0600` (last byte `0x0657`) |

With `+define+ILLEGAL_AHB_INPUT` the testbench adds a negative test:

| Scenario | Start | Transfers | Size | Expected result |
|----------|-------|-----------|------|-----------------|
| `illegal_ahb_1kb` | `0x0000_03F0` | 8 | 4 bytes | Ends at `0x040F`, across the 1KB boundary at `0x0400`. The AHB-side input check fires. The bridge is not at fault. |

The buggy bridge has no 256-transfer cap. For each long request it emits one AXI burst with `AWLEN = 43` and then sends all 300 W transfers, with WLAST only on the 300th.

## Files

- `testbench.sv` — directed simulation with the buggy bridge DUT, the AXI slave model and a watchdog (top module `tb_top`).
- `bridge_split_checker.sv` — starter checker with two worked examples and five TODOs.
- `solution.sv` — completed checker and the corrected split helper.
- `lab.json` — metadata used by the curriculum/lab registry.

Compile the checker and the testbench together, with `tb_top` as the top module:

```
<simulator> bridge_split_checker.sv testbench.sv
```

To run the reference checker, compile `solution.sv` in place of `bridge_split_checker.sv`. The files need a simulator that supports concurrent SystemVerilog assertions with ranged cycle delays, queues and `final` blocks. Support in open-source simulators varies by tool and version, so check yours first (tool-dependent).

## Instructions

### Step 1: Reproduce the Split Bug

Run the testbench with the starter checker. The bridge prints each AXI AW handshake and the transfer on which each burst's WLAST arrives.

Focus on `long_incr_bytes`:

```
# AHB request long_incr_bytes addr=0x00000400 transfers=300 size=1 bytes last_byte=0x0000052b
# Time ...: AXI AW addr=0x00000400 AWLEN=43 (44 transfers) AWSIZE=0 last_byte=0x0000042b
# Time ...: AXI W  WLAST on transfer 300 of this burst
```

The AW channel announced 44 transfers, but WLAST arrived on transfer 300. Because no TODO is written yet, nothing has been compared, and the run ends with:

```
LAB INCOMPLETE: TODO 2 compared no AXI burst, so nothing was checked
```

### Step 2: Complete the Checker

Open `bridge_split_checker.sv`. Two checks are already written as worked examples: no AXI burst crosses 4KB, and `AWSIZE` matches the AHB transfer size. Implement the TODOs:

1. `p_ahb_input_no_1kb_cross` [AHB protocol]: the request must not cross 1KB. Run with `+define+ILLEGAL_AHB_INPUT` to see it fire.
2. Per-burst W accounting [AXI protocol]: WLAST must arrive on transfer `AWLEN + 1` of each burst and on no other transfer. Match W bursts to AW bursts through two in-order queues, because this bridge does not wait for AW before sending W.
3. `p_first_split_len` [Bridge design]: a request longer than 256 transfers starts with a full 256-transfer AXI burst at the request address.
4. Total W accounting [Bridge design]: the W transfers sent for a request must equal the AHB transfer count.
5. Address continuity [Bridge design]: each AXI burst of a request starts where the previous one ended.

With the buggy bridge, checks 2 and 3 fail on both long requests. Check 4 passes, because the bridge does send all 300 transfers, just in the wrong burst. Only per-burst accounting catches the bug.

### Step 3: Fix the Split Function

In the bridge, find `choose_buggy_burst_beats()`:

```systemverilog
return remaining; // BUG: no 256-transfer cap
```

Replace its body with the cap shown under [Expected Fix](#expected-fix). Both the AW and the W channel call this function, so one change fixes both. It needs no 4KB term.

Then rerun. After the fix, `long_incr_bytes` should emit:

```
# Time ...: AXI AW addr=0x00000400 AWLEN=255 (256 transfers) AWSIZE=0 last_byte=0x000004ff
# Time ...: AXI AW addr=0x00000500 AWLEN=43 (44 transfers) AWSIZE=0 last_byte=0x0000052b
# Time ...: AXI W  WLAST on transfer 256 of this burst
# Time ...: AXI W  WLAST on transfer 44 of this burst
```

The second AW appears before the first burst's WLAST: the AW channel runs ahead of the W channel, which is legal. `long_incr_halfwords` shows the same pattern with `AWSIZE=1` and its second burst at `0x00000600`. At the end of the run, the checker should print:

```
LAB PASS: 6 AXI bursts carried AWLEN+1 transfers and no request lost a transfer
```

Finally rerun with `+define+ILLEGAL_AHB_INPUT`: only the AHB input check (TODO 1) may fail.

### Step 4: Stress the Handshakes

Rerun the fixed bridge with `+define+AXI_SLAVE_WAITS_FOR_W`. The run must still end in `LAB PASS`; now W transfers reach the slave before their AW is accepted, which is why TODO 2 uses queues. Then answer debug question 8.

## Acceptance Criteria

1. **Legal stimulus**: the AHB input check passes for the four default scenarios and fires for `illegal_ahb_1kb`.
2. **Burst length**: every AXI burst carries exactly `AWLEN + 1` W transfers, with WLAST on the last one, whether W arrives before or after its AW.
3. **Split length**: a request longer than 256 transfers starts with a 256-transfer AXI burst.
4. **Write-data accounting**: the total W transfers per AHB request match the AHB transfer count.
5. **Address continuity**: each split burst starts at the byte after the previous one ends.
6. **Transfer size and 4KB**: `AWSIZE` matches the AHB HSIZE, and no AXI burst crosses 4KB.
7. **Handshakes**: the fixed bridge passes with `+define+AXI_SLAVE_WAITS_FOR_W`.

## Debug Questions

Write your answers before you read the model answers under [Check Your Answers](#check-your-answers) at the end of this guide.

1. Why can a legal AHB burst never cross a 4KB boundary? Which AHB rule guarantees it?
2. Why is `AWLEN` encoded as transfers minus one, and what happens to a 300-transfer request if the bridge does not split it?
3. Why does the total W count pass with the buggy bridge? What does that tell you about where to put a checker?
4. The `illegal_ahb_1kb` request makes the bridge emit a legal AXI burst. Why must the failure still be reported, and on which side?
5. An AXI-to-AHB bridge receives an AXI INCR16 of words at `0x03F0`. It is legal AXI. What must the bridge do on the AHB side, and why?
6. A 64-bit AHB master is bridged onto a 32-bit AXI bus. How many AXI transfers does an AHB INCR4 of doublewords become, and what `AWSIZE` must the bridge use?
7. What happens to the bridge's HREADYOUT while the AXI side stalls the W channel? Why must HRESP stay OKAY during that time?
8. Suppose the bridge raised WVALID only after the AW handshake of the same burst. What would happen with `+define+AXI_SLAVE_WAITS_FOR_W`, and which AXI rule does that bridge break?
9. Which check catches a bridge that advances the next burst's address by the number of transfers instead of the number of bytes, and why does only `long_incr_halfwords` expose it?
10. A real AHB INCR carries no length. How would a bridge that does not buffer the whole write choose `AWLEN` for the first AXI burst?

## Expected Fix

The fixed splitter computes:

```systemverilog
return (remaining > 256) ? 256 : remaining;  // AXI4 INCR limit (IHI0022E A3.4.1)
```

Each channel then advances on its own: the AW channel by one burst at each AW handshake,

```systemverilog
aw_addr      <= aw_addr + (32'(aw_beats) << size_q);
aw_remaining <= aw_left_next;   // aw_remaining - aw_beats
```

and the W channel by one transfer at each W handshake. That keeps every AXI burst legal while preserving the total AHB payload. The interactive bridge explorer in the [bridges lesson](/curriculum/T3_Advanced/B-AMBA-F1_Bridges_and_System_Integration/index) has a matching "1024-byte INCR" scenario that splits into four 256-transfer bursts.

## Check Your Answers

Attempt the debug questions first. Each answer names the rule, and where the lesson teaches it.

1. Every 4KB boundary is also a 1KB boundary, and an AHB master must not start an incrementing burst that crosses 1KB (IHI0033B.b §3.5). A legal AHB burst therefore cannot reach across 4KB. (Lesson: "AHB to AXI: what forces a split".)
2. AXI encodes 1 to 256 transfers in 8 bits, so `AWLEN = 0` means one transfer (IHI0022E A3.4.1). Unsplit, 300 − 1 = 299 wraps to 299 mod 256 = 43: the AW announces 44 transfers, while 300 W transfers follow with WLAST only on the 300th.
3. The bridge does send all 300 transfers; it only groups them into the wrong burst. A total count compares the request with the sum, so it cannot see the grouping. Put a check where the protocol defines the rule: per AXI burst (`AWLEN + 1` transfers, WLAST on the last). (Lesson: "Common bridge bugs".)
4. The AHB master broke §3.5, not the bridge. Report it on the AHB side as illegal stimulus, so the stimulus gets fixed; a test that relies on the bridge to "fix" the burst hides a broken master.
5. Split at 0x0400: an AHB INCR4 from 0x03F0, then the remaining 12 transfers from 0x0400 (as an undefined-length INCR, or INCR8 plus INCR4). The AXI burst is legal because it stays inside 4KB, but an AHB incrementing burst must not cross 1KB. (Lesson: "AXI to AHB" and the Make It Work splitter.)
6. Eight AXI transfers with `AWSIZE = 2` (4 bytes) and `AWLEN = 7`: each doubleword becomes two words. Downsizing must modify the transaction (IHI0022E A4.3.1 Note).
7. HREADYOUT stays low, which extends the current data phase, so the master keeps the next address and its write data on the bus. HRESP must be OKAY during those wait states (IHI0033B.b §5.1.2): ERROR is a two-cycle response that ends the transfer with an error.
8. The slave waits for WVALID before it raises AWREADY, and the bridge waits for AWREADY before it raises WVALID, so neither moves and the watchdog ends the run. That bridge breaks IHI0022E A3.3.1: "a master must not wait for AWREADY to be asserted before driving WVALID". (Lesson: "AXI handshake dependencies".)
9. TODO 5, address continuity. For bytes, 256 transfers are 256 bytes, so advancing by transfers or by bytes gives the same 0x0500. For halfwords, 256 transfers are 512 bytes: the second burst must start at 0x0600, and a transfer-count advance sends it to 0x0500.
10. It cannot know the length, so it must choose a policy: single-transfer AXI bursts; buffering until the burst ends, the buffer fills, 256 transfers or the 1KB boundary; or fixed chunks whose surplus transfers are sent with all strobes low, because an AXI burst cannot be cut short (IHI0022E A3.4.1). The lesson's [Expert: undefined-length INCR](/curriculum/T3_Advanced/B-AMBA-F1_Bridges_and_System_Integration/index#expert-undefined-length-incr-the-bridge-cannot-know-the-length) compares them.
