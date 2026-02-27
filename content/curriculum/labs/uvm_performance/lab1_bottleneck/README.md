# The Bottleneck Lab

## Objective
Identify and resolve a severe simulation performance bottleneck in a UVM scoreboard and monitor pair.

## Overview
This directory contains a simple UVM testbench. Run `make run` to execute the simulation. You will notice that the simulation takes several seconds for a very small amount of packets. This is because the scoreboard uses an inefficient algorithm to match packets, and the monitor is tightly coupled to it.

## Your Task

### 1. Profile the Simulation
Run the simulation with your simulator's profiling tools enabled (e.g. `vsim -profile` for Questa, `simvision -profile` for Xcelium, or the generic `make profile` target provided here). Inspect the results to prove that the scoreboard's `write` function is the primary hotspot.

### 2. Refactor the Lookup
Open `scoreboard.sv`. You will see it uses a nested loop to search a `uvm_queue` for matching packets upon every monitor write. 
- Change the queue to an associative array (`int pkt_q[int]`) indexed by the packet's transaction ID.
- Update the store and check logic to use `exists()` and array lookups instead of loops.

### 3. Decouple with TLM FIFOs
Currently, the monitor writes directly to the scoreboard via a `uvm_analysis_export`. If the scoreboard is slow, the monitor is blocked from capturing the next packet.
- In `env.sv`, instantiate a `uvm_tlm_analysis_fifo #(packet)`.
- Connect the monitor's analysis port to the FIFO's `analysis_export`.
- Update the scoreboard to have a `uvm_get_port` instead of an analysis export.
- Change the scoreboard to run a continuous `get()` loop inside its `run_phase` instead of relying on the `write()` callback.
- Connect the scoreboard's get port to the FIFO's `get_export` in the env.

### 4. Measure the Win
Run `make run` again. The simulation should complete in a fraction of the original time. You have successfully implemented IEEE 1800-2023 efficient coding practices and UVM architectural decoupling!
