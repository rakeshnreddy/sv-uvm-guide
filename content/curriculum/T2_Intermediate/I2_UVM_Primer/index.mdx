---
title: "I2 – UVM Primer (Testbench Architecture)"
description: "An introduction to the Universal Verification Methodology (UVM) and its standard testbench architecture."
---

import { Quiz, InteractiveCode } from '@/components/ui';

## The "Why" of UVM: A Standardized Approach

In the F4 module, we built a testbench for our ALU. While functional, it was an *ad-hoc* solution. If a new engineer joined the team, they would have to learn our specific, custom-built testbench structure. If we wanted to reuse our ALU testbench for a different project, we would have to make significant changes.

UVM solves these problems by providing a standardized, reusable, and scalable methodology for building testbenches. It is a library of SystemVerilog base classes that we `extend` to create our own verification components. This means that any engineer familiar with UVM can understand and contribute to any UVM testbench.

## The UVM Component Hierarchy

A standard UVM environment is composed of several key components, each with a specific role.

![UVM Component Hierarchy](https://i.imgur.com/9y8F7H9.png)

### Component Descriptions

#### uvm_component vs. uvm_object

- **uvm_component:** These are the building blocks of the testbench. They are quasi-static, have a place in the hierarchy, and persist for the entire simulation. Examples include drivers, monitors, and scoreboards.
- **uvm_object:** These are transient data packets that are passed between components. They are created and destroyed as needed. Examples include sequence items and configuration objects.

#### Test (uvm_test)

The `uvm_test` is the top-level component in the UVM hierarchy. It is responsible for:

- Configuring the testbench environment.
- Selecting and starting the main test sequence.
- Applying any test-specific constraints or configurations.

#### Environment (uvm_env)

The `uvm_env` is the top-level container for our verification components. It typically contains one or more agents and a scoreboard.

#### Agent (uvm_agent)

An `uvm_agent` is a container for components that handle a specific interface protocol. For our ALU, we would have an `alu_agent`. An agent can be configured as:

- **Active:** The agent generates and drives stimulus onto the interface. It contains a sequencer, a driver, and a monitor.
- **Passive:** The agent only monitors the interface. It contains only a monitor.

#### Sequencer (uvm_sequencer)

The `uvm_sequencer` controls the flow of `uvm_sequence_item`s (transactions) that are sent to the driver. It acts as an arbiter if multiple sequences are trying to send data at the same time.

#### Driver (uvm_driver)

The `uvm_driver` receives stimulus data from the sequencer and drives the physical signals on the interface. It converts the transaction-level data from the sequencer into pin-level activity on the DUT interface.

#### Monitor (uvm_monitor)

The `uvm_monitor` observes the interface signals and broadcasts them as transaction objects. It converts the pin-level activity on the DUT interface into transaction-level data.

#### Scoreboard (uvm_scoreboard)

The `uvm_scoreboard` receives transactions from monitors and checks for correctness. This is where the self-checking logic of the testbench resides. It typically contains a model of the DUT to predict the expected results.

## The UVM Simulation Lifecycle (Phases)

UVM simulations run in a series of ordered steps called "phases." This ensures that everything is built and connected before the test starts running, preventing race conditions.

![UVM Phases](https://i.imgur.com/4l3g7t4.png)

### Key Phases

- **build_phase:** Components are constructed (created using the factory). This is where `create()` calls are made.
- **connect_phase:** Components are connected to each other (e.g., TLM ports).
- **run_phase:** Time-consuming tasks execute. Stimulus is generated and driven.
- **report_phase:** Final results are summarized and reported.

## Conclusion

This module has provided a high-level overview of the UVM testbench architecture and its key components. In the upcoming modules, we will dive into the details of how to write the code for each of these components.
