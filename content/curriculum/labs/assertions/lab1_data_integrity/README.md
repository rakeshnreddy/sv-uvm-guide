# Lab: Data Integrity Challenge

Welcome to the Data Integrity Challenge! In this lab, you'll use Advanced SystemVerilog Assertions to catch a subtle bug in a pipeline design.

## The Design (DUT)

The DUT (`dut.sv`) is a simple 4-stage data pipeline. It takes in data via an `in_vld`/`in_rdy` handshake and outputs it via an `out_vld`/`out_rdy` handshake.
There is a subtle bug hidden in one of the pipeline stages that occasionally corrupts data when the pipeline stalls.

## Your Task

Your task is to write a SystemVerilog Assertion that guarantees data entering the pipeline is the same data exiting the pipeline.

1.  Open `solution_assertions.sv` (or create your own checker file).
2.  Write a concurrent assertion that uses **local variables** to sample `in_data` when `in_vld` and `in_rdy` are high.
3.  Use the `s_eventually` operator or a bounded delay to verify that when `out_vld` and `out_rdy` go high, the `out_data` exactly matches the value you stored.
4.  Bind your checker module to the `dut` instance.

## Running the Lab

Use the provided `Makefile` to run the simulation and see if your assertion catches the bug!

```bash
make run
```

If your assertion is correct, you should see an assertion failure message indicating that the expected data does not match the actual data when the bug is triggered by the testbench.

## Solution

A reference solution is provided in `solution_assertions.sv`. Use it if you get stuck!
