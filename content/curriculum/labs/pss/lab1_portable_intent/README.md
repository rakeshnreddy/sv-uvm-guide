# Lab: Writing a Portable Test Intent Specification

## Scenario

You are verifying a DMA controller that supports the following operations:
- **Configure:** Set source address, destination address, and transfer length via a register interface
- **Transfer:** Start a DMA transfer and wait for completion
- **Verify:** Read back the destination memory and compare against the source

Currently, your team has separate tests for simulation (SV UVM sequences) and validation (C bare-metal tests). Every time the DMA spec changes, both test suites must be updated independently. Your manager wants you to explore PSS as a "write once, target many" solution.

## Objective

1. Review the PSS specification skeleton in `starter.pss` that defines the DMA component and basic actions.
2. Complete the following TODOs:
   - **Define the `dma_configure` action** with fields for `src_addr`, `dst_addr`, and `length`, each with appropriate constraints.
   - **Define the `dma_transfer` action** that reads the configured parameters and initiates the transfer.
   - **Define an activity graph** that sequences: configure → transfer → verify, with the constraint that `length` must be a power of 2 and ≤ 4096.
3. Review `solution.pss` to compare your implementation against the reference.
4. Analyze how the same PSS specification would map to:
   - A UVM sequence in SystemVerilog (register writes → DMA trigger → polling loop)
   - A C bare-metal test (memory-mapped I/O writes → interrupt wait → memcmp)

## Key Concepts

- **Actions** define atomic verification operations (configure, transfer, verify)
- **Components** own resources (the DMA controller, memory regions)
- **Activity graphs** define execution order and parallelism between actions
- **Constraints** limit the random space (valid addresses, aligned lengths)
- **Portability** — one spec compiles to SV sequences and C tests

## Files

| File | Purpose |
|---|---|
| `starter.pss` | Skeleton PSS spec with TODOs to complete |
| `solution.pss` | Reference implementation |
| `README.md` | This file |

## Success Criteria

- All three actions are defined with correct field types and constraints
- The activity graph enforces configure → transfer → verify ordering
- The `length` constraint limits values to powers of 2, max 4096
- You can explain how each action would map to SV and C implementations

## Need Help?

Review the [E-PSS-1: Portable Stimulus Standard](../../../T4_Expert/E-PSS-1_Portable_Stimulus_Standard/index.mdx) lesson for PSS syntax and compilation examples.
