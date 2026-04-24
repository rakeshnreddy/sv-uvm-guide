# AXI Out-of-Order Scoreboard Lab

## Objective
The AXI protocol decouples its 5 channels (AW, W, B, AR, R) and allows responses with different `AxID` values to complete out of order. This makes monitoring and scoreboarding significantly more complex than AHB.

In this lab, you will:
1. Complete a multi-threaded `axi_monitor` that reconstructs read transactions.
2. Complete an `axi_scoreboard` that uses associative arrays (keyed by `ARID`) to track out-of-order read responses.
3. Verify that your scoreboard correctly matches read responses even when the slave reorders them.

## Background
The testbench drives two simultaneous Read transactions:
- Read A: `ARID=1` (Takes a long time to return data)
- Read B: `ARID=2` (Returns data quickly)

Because `ARID` values are different, the AXI slave is legally allowed to return Read B before Read A. A standard FIFO-based scoreboard would fail here because it expects Read A first. 

## Instructions

### Step 1: The Monitor (`axi_monitor.sv`)
Open `axi_monitor.sv`. The read channel threads are partially complete.
1. In `monitor_ar_channel()`, capture the address phase and store it in the `pending_reads` associative array.
2. In `monitor_r_channel()`, wait for `RVALID && RREADY && RLAST`. Extract the transaction from `pending_reads`, append the `RDATA`, and write it to the analysis port.

### Step 2: The Scoreboard (`axi_scoreboard.sv`)
Open `axi_scoreboard.sv`. 
1. Look at `write_expected()`. Notice how it pushes expected transactions into an array of queues: `expected_reads[txn.id]`.
2. In `write_actual()`, you must extract the actual transaction from the monitor. Pop the expected transaction from the correct ID queue and compare them.
3. Handle the case where an unexpected `ARID` returns.

### Step 3: Run the Simulation
Run the testbench. You should see the monitor reconstruct the transactions, and the scoreboard should report MATCHES despite the fact that ID=2 finishes before ID=1.

## Tips
- Remember that the transaction is only complete when `RLAST` is asserted alongside `RVALID` and `RREADY`.
- Associative array syntax in SV: `pending_reads.exists(id)` and `pending_reads.delete(id)`.
