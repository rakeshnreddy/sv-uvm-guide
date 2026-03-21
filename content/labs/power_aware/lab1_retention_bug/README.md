# Lab 1: Retention Bug and Isolation Sequencing

## Objective
Identify and fix a critical bug in a Power Management Unit (PMU) wake-up sequence that causes undefined `X` values to propagate into the `Always ON` domain.

## Background
In UPF-driven verification, when a domain loses power, its non-retained signals are simulated as `X`. Isolation cells clamp these boundary signals to safe values (e.g., `0`) to protect the downstream logic. 

A strict handshake rules the sleep/wake transitions:
1. **Sleep**: Save Retained Context `->` Assert Isolation `->` Drop Power.
2. **Wake**: Restore Power `->` Restore Context `->` Release Isolation.

## The Bug
Open `buggy_tb.sv`. Walk through the `Wake up` sequence starting at line 37.

Notice the order of operations:
```systemverilog
// BUGGY:
iso_en = 0;  // Releases clamp while power is still OFF
pwr_en = 1;  // Restores power
```

By releasing the isolation clamp *before* the domain's power supply is fully restored and stable, the unpowered logic in `PD_CPU` (which is floating/driving `X`) leaks through the boundary into `PD_TOP`, causing widespread data corruption.

## Instructions
1. Analyze the failing test sequence in `buggy_tb.sv`.
2. Reorder the signals in the `[WAKE]` block so that isolation is maintained until *after* the power domain is restored and the retention context is re-loaded.
3. Compare your fix with `solution_tb.sv`.

## Bonus Challenge
Write an SVA property that asserts `iso_en` must *always* be `1` if `pwr_en` is `0`, preventing this exact bug from ever being written in future sequences.
