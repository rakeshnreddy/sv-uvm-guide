# AHB-to-AXI Bridge Debug Lab

## Objective

Protocol bridges are where clean bus theory meets ugly integration reality. An AHB master may legally issue a burst that crosses a 4KB page boundary, but AXI forbids any single burst from crossing that boundary. The bridge must split the AHB burst into multiple legal AXI bursts while preserving beat count, byte lanes, and ordering.

In this lab, you will debug a bridge with a subtle split-logic bug:

1. Run a directed testbench that issues AHB write bursts through a buggy AHB-to-AXI adapter.
2. Inspect the AXI write address bursts emitted by the bridge.
3. Complete a starter checker that proves every AXI burst stays inside one 4KB window.
4. Fix the split logic so the boundary-crossing AHB request becomes two legal AXI bursts.

## Background

### The 4KB Boundary Rule

AXI requires that every beat address within a burst stays inside the same 4KB page as the first transfer (Arm IHI0022H §A3.4.1):

```
start_page = AWADDR[31:12]
last_byte  = AWADDR + ((AWLEN + 1) << AWSIZE) - 1
end_page   = last_byte[31:12]

LEGAL iff start_page == end_page
```

Equivalently, within the low 12 bits:

```
AWADDR[11:0] + ((AWLEN + 1) << AWSIZE) <= 4096
```

AHB does not enforce that rule, so the bridge owns the translation.

### HREADY vs HREADYOUT Mechanics

When the AXI side stalls (AWREADY or WREADY deasserted), the bridge must propagate backpressure to the AHB source by deasserting its HREADYOUT output (Arm IHI0033B §3.1):

- **HREADYOUT** is the bridge's per-slave ready output, indicating whether the bridge can accept the current AHB data phase.
- **HREADY** is the bus-level signal formed by the interconnect mux from the selected slave's HREADYOUT.
- When the AXI side stalls, the bridge must deassert HREADYOUT to stretch the AHB data phase, holding HRDATA/HRESP stable.
- The AHB master samples HREADY — it does **not** directly see HREADYOUT.

### Write-Data Ordering

When the bridge splits an AHB burst into multiple AXI bursts, it must:

1. **Preserve beat ordering** — AXI W beats must arrive in the same order as AHB data phases.
2. **Correlate beats with bursts** — Each AXI burst receives exactly the correct number of W beats, with WLAST asserted on the final beat of each split burst (not just the final beat of the entire AHB transfer).
3. **Handle WSTRB correctly** — Byte strobes must match the original AHB transfer size and address alignment.

### The Failing Scenario

The testbench includes three directed AHB-style requests:

| Scenario | Start | Beats | Size | Expected bridge behavior |
|----------|-------|-------|------|--------------------------| 
| Safe burst | `0x0000_2000` | 4 | 4 bytes | One AXI burst of 4 beats |
| Exact boundary end | `0x0000_1FE0` | 8 | 4 bytes | One AXI burst ending at `0x1FFF` |
| Crosses 4KB | `0x0000_0FF0` | 8 | 4 bytes | Split into 4 beats at `0x0FF0`, then 4 beats at `0x1000` |

The buggy bridge miscomputes "beats until 4KB boundary" by adding one extra beat. For the crossing case, it emits a 5-beat AXI burst from `0x0FF0`, whose last byte lands at `0x1003`. That is illegal.

## Files

- `testbench.sv` — self-contained directed simulation with the buggy bridge DUT.
- `bridge_split_checker.sv` — starter checker with TODOs for protocol properties.
- `solution.sv` — completed checker and corrected bridge split logic.
- `lab.json` — metadata used by the curriculum/lab registry.

## Instructions

### Step 1: Run the Buggy Testbench

Run `testbench.sv` with your simulator. You should see the bridge print each emitted AXI write burst.

Focus on the crossing case:

```
AHB request crossing_4kb: addr=0x00000ff0 beats=8 size=4 bytes
AXI AW: addr=0x00000ff0 beats=5 ...
```

That first AXI burst is illegal because `0x0FF0 + 5*4 - 1 = 0x1003`.

### Step 2: Complete the Checker

Open `bridge_split_checker.sv` and implement the TODOs:

1. `p_no_axi_4kb_cross` — every accepted AXI AW burst must remain inside one 4KB window.
2. `p_first_split_len` — when the AHB plan crosses 4KB, the first AXI burst length must equal the number of beats that fit before the boundary.
3. `p_aw_size_matches_plan` — translated AXI `AWSIZE` must match the AHB transfer size.
4. Procedural beat accounting — the total W beats emitted for a plan must match the original AHB beat count (verifies correct write-data ordering across split bursts).

The checker should fail before the testbench finishes, and the message should point at the illegal AW burst.

### Step 3: Fix the Split Logic

In the bridge, find:

```systemverilog
return beats + 1; // BUG
```

The corrected function should return exactly the number of complete beats that fit before the next 4KB boundary.

### Step 4: Re-run

After applying the fix from `solution.sv`, the crossing scenario should emit:

```
AXI AW: addr=0x00000ff0 beats=4
AXI AW: addr=0x00001000 beats=4
```

The checker should pass:

```
LAB PASS: bridge split plan completed without 4KB violations
```

## Acceptance Criteria

1. **4KB boundary**: No emitted AXI burst crosses a 4KB page boundary.
2. **Split length**: The first split burst contains exactly `(4096 - addr[11:0]) / beat_bytes` beats.
3. **Write-data ordering**: Total W beats per AHB plan matches the original AHB beat count, and WLAST fires at the correct beat within each split burst.
4. **Transfer size**: AWSIZE matches the original AHB HSIZE for every emitted burst.
5. **Source-side backpressure**: When the AXI side stalls, the bridge deasserts its HREADYOUT (the test verifies this by observing that the bridge's `req_ready` signal reflects AXI-side stalls).

## Debug Questions

1. Why is an AHB burst allowed to cross 4KB when an AXI burst is not?
2. Why is `AWLEN` encoded as beats minus one?
3. What happens to the bridge's HREADYOUT while the bridge is draining the second AXI split burst? Why must the AHB source see HREADY low during this time?
4. How would the checker change for 8-byte beats?
5. Why is "exactly ends at 4KB" legal, but "first byte after 4KB" illegal?
6. If the bridge incorrectly correlates W beats with the wrong split burst (e.g., sends 5 W beats for a 4-beat AXI burst), what observable failures would you expect?
7. How does HREADYOUT differ from HREADY, and why is this distinction critical for bridge verification?

## Expected Fix

The fixed splitter computes:

```systemverilog
bytes_to_boundary = 4096 - addr[11:0];
beats_to_boundary = bytes_to_boundary / beat_bytes;
this_burst = min(remaining_beats, beats_to_boundary, AXI_MAX_BURST);
```

The bridge then advances:

```systemverilog
current_addr += this_burst * beat_bytes;
remaining    -= this_burst;
```

That keeps every AXI burst legal while preserving the total AHB payload.
