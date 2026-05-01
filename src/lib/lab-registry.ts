import { LabMetadata } from '@/types/lab';

export const LAB_REGISTRY: Record<string, LabMetadata> = {
  "basics-1": {
    id: "basics-1",
    title: "SV Basics: Variables and Assignment",
    description: "Learn how to declare and assign variables in SystemVerilog.",
    owningModule: "F2D", 
    routeSlug: "basics-1",
    prerequisites: [],
    assetLocation: "content/curriculum/labs/basics/lab1_refactoring",
    status: "available",
    graderType: "systemverilog",
    steps: [
      {
        id: "1",
        title: "Step 1: Declare a variable",
        instructions: "Declare a variable named 'myVar' of type 'int'.",
        starterCode: "// Your code here\n",
      },
      {
        id: "2",
        title: "Step 2: Assign a value",
        instructions: "Assign the value 10 to the variable 'myVar'.",
        starterCode: "int myVar;\n// Assign here\n",
      }
    ]
  },
  "common-1": {
    id: "common-1",
    title: "Common Structures",
    description: "Practice using structs, enums, and arrays.",
    owningModule: "F2C",
    routeSlug: "common-1",
    prerequisites: ["basics-1"],
    assetLocation: "content/curriculum/labs/common",
    status: "coming_soon",
    graderType: "systemverilog",
    steps: []
  },
  "fifo-1": {
    id: "fifo-1",
    title: "FIFO Implementation",
    description: "Implement and verify a simple synchronous FIFO.",
    owningModule: "I-SV-1",
    routeSlug: "fifo-1",
    prerequisites: ["common-1"],
    assetLocation: "content/curriculum/labs/fifo",
    status: "coming_soon",
    graderType: "systemverilog",
    steps: []
  },
  "simple-dut-1": {
    id: "simple-dut-1",
    title: "Simple DUT Verification",
    description: "Create a basic UVM testbench for a simple DUT.",
    owningModule: "F4",
    routeSlug: "simple-dut-1",
    prerequisites: [],
    assetLocation: "content/curriculum/labs/simple_dut",
    status: "coming_soon",
    graderType: "uvm",
    steps: []
  },
  "scoreboard-decoupling": {
    id: "scoreboard-decoupling",
    title: "Scoreboard Decoupling",
    description: "Practice removing monitor backpressure by routing transactions through an analysis FIFO.",
    owningModule: "I-UVM-2B",
    routeSlug: "scoreboard-decoupling",
    prerequisites: ["simple-dut-1"],
    assetLocation: "content/curriculum/labs/scoreboard_decoupling",
    status: "available",
    graderType: "uvm",
    steps: [
      {
        id: "1",
        title: "Step 1: Declare the FIFO",
        instructions: "Open `src/dv/env.sv` and declare a `uvm_tlm_analysis_fifo #(my_txn)` named `sb_fifo`.",
        starterCode: ""
      },
      {
        id: "2",
        title: "Step 2: Connect the FIFO",
        instructions: "In `env.sv`, wire the monitor's `ap` to the FIFO's `analysis_export`, and the scoreboard to the `get_export`.",
        starterCode: ""
      },
      {
        id: "3",
        title: "Step 3: Refactor the Scoreboard",
        instructions: "In `scoreboard.sv`, change the `analysis_imp` to a `uvm_blocking_get_port`. Replace `write()` with a `run_phase` loop that calls `get()`.",
        starterCode: ""
      }
    ]
  },
  "scoreboard-reference-model": {
    id: "scoreboard-reference-model",
    title: "Self-Checking Scoreboard with Reference Model",
    description: "Implement a UVM scoreboard that consumes monitor transactions, predicts expected ALU results, and reports mismatches automatically.",
    owningModule: "A-UVM-6",
    routeSlug: "scoreboard-reference-model",
    prerequisites: ["scoreboard-decoupling"],
    moduleHref: "/curriculum/T3_Advanced/A-UVM-6_Scoreboards_and_Reference_Models/index",
    assetLocation: "content/curriculum/labs/scoreboard/lab1_reference_model",
    status: "available",
    graderType: "uvm",
    steps: [
      {
        id: "1",
        title: "Step 1: Implement the Scoreboard",
        instructions: "Open `testbench.sv` and implement `alu_scoreboard` with a `uvm_tlm_analysis_fifo`, reference model, and compare logic.",
        starterCode: ""
      },
      {
        id: "2",
        title: "Step 2: Wire Analysis Traffic",
        instructions: "Create the scoreboard in `alu_env` and connect `monitor.ap` to the scoreboard FIFO's `analysis_export` in `connect_phase`.",
        starterCode: ""
      },
      {
        id: "3",
        title: "Step 3: Verify Self-Checking Behavior",
        instructions: "Run the lab and confirm each random ALU transaction produces a PASS comparison; then intentionally corrupt the reference model to see `uvm_error` mismatches.",
        starterCode: ""
      }
    ]
  },
  "uvm-mini-capstone": {
    id: "uvm-mini-capstone",
    title: "Mini UVM FIFO Environment Capstone",
    description: "Build a complete FIFO UVM environment with an active agent, sequence, driver, monitor, scoreboard, coverage subscriber, and factory override.",
    owningModule: "A-UVM-6",
    routeSlug: "uvm-mini-capstone",
    prerequisites: ["scoreboard-reference-model", "scoreboard-decoupling"],
    assetLocation: "content/curriculum/labs/uvm_capstone/lab1_fifo_env",
    status: "available",
    graderType: "uvm",
    steps: [
      {
        id: "1",
        title: "Step 1: Complete the Active Agent",
        instructions: "Fill in the transaction, sequence helpers, driver, monitor, sequencer, and active-agent construction in `testbench.sv`.",
        starterCode: ""
      },
      {
        id: "2",
        title: "Step 2: Wire Checking and Coverage",
        instructions: "Connect the monitor analysis port to the scoreboard FIFO and coverage subscriber, then implement queue-based compare logic and required coverage bins.",
        starterCode: ""
      },
      {
        id: "3",
        title: "Step 3: Exercise the Factory Override",
        instructions: "Override `fifo_base_seq` with `fifo_capstone_seq`, create the base type through the factory, and confirm the capstone sequence runs.",
        starterCode: ""
      },
      {
        id: "4",
        title: "Step 4: Prove the Bug and Closure",
        instructions: "Run once with `+define+INJECT_FIFO_BUG` to see a scoreboard mismatch, then run without the define to confirm zero mismatches and coverage closure.",
        starterCode: ""
      }
    ]
  },
  "config-debug": {
    id: "config-debug",
    title: "Null Virtual Interface",
    description: "Diagnose and fix a fatal null virtual interface error caused by a typo in the uvm_config_db.",
    owningModule: "I-UVM-2C",
    routeSlug: "config-debug",
    prerequisites: ["simple-dut-1"],
    assetLocation: "content/curriculum/labs/config_debug",
    status: "available",
    graderType: "uvm",
    steps: [
      {
        id: "1",
        title: "Step 1: Check the Source",
        instructions: "Open `testbench.sv` and inspect the `uvm_config_db::set` string arguments.",
        starterCode: ""
      },
      {
        id: "2",
        title: "Step 2: Check the Target",
        instructions: "Open `driver.sv` and inspect the `uvm_config_db::get` string arguments.",
        starterCode: ""
      },
      {
        id: "3",
        title: "Step 3: Fix the Typo",
        instructions: "Realign the strings so they match, then run the simulation and look for `[DRV] Wiggling pins`.",
        starterCode: ""
      }
    ]
  },
  "debug-waveform-trigger": {
    id: "debug-waveform-trigger",
    title: "Triggering Waveforms via Event Bus",
    description: "Build an event bus subscriber that listens for watchdog timeout tags and starts selective waveform capture only when the failure is near.",
    owningModule: "E-DBG-1",
    routeSlug: "debug-waveform-trigger",
    prerequisites: ["config-debug"],
    assetLocation: "content/curriculum/labs/uvm_debug/lab1_waveform_trigger",
    status: "available",
    graderType: "uvm",
    steps: [
      {
        id: "1",
        title: "Step 1: Inspect the Event Bus",
        instructions: "Open `testbench.sv` and locate the `debug_event_bus` plus the watchdog publisher that emits `WATCHDOG_TIMEOUT`.",
        starterCode: ""
      },
      {
        id: "2",
        title: "Step 2: Add the Subscriber",
        instructions: "Implement `waveform_trigger_sub` as a `uvm_subscriber#(debug_event)` and trigger waveform capture when the timeout tag appears.",
        starterCode: ""
      },
      {
        id: "3",
        title: "Step 3: Wire and Verify",
        instructions: "Connect the subscriber to the event bus, rerun, and confirm selective waveform capture starts only near the timeout.",
        starterCode: ""
      }
    ]
  },
  "ipc-deadlock": {
    id: "ipc-deadlock",
    title: "Semaphore Deadlock",
    description: "Diagnose and fix a simulation hang caused by an unreturned semaphore key in an early exit condition.",
    owningModule: "I-SV-5",
    routeSlug: "ipc-deadlock",
    prerequisites: ["systemverilog-basics"],
    assetLocation: "content/curriculum/labs/ipc_deadlock",
    status: "available",
    graderType: "systemverilog",
    steps: [
      {
        id: "1",
        title: "Step 1: Identify the Hang",
        instructions: "Run the simulation. Notice the `WATCHDOG` timer fires at 500ns because the test never organically reaches `$finish;`.",
        starterCode: ""
      },
      {
        id: "2",
        title: "Step 2: Trace the Keys",
        instructions: "Look at `producer_thread()`. It requires a key to start transmission. Trace what happens to that key if `data == 5` occurs.",
        starterCode: ""
      },
      {
        id: "3",
        title: "Step 3: Fix the Leak",
        instructions: "Ensure `shared_bus.put(1);` is called even when bailing out early. Re-run to see both threads complete all 5 iterations.",
        starterCode: ""
      }
    ]
  },
  "arbiter-1": {
    id: "arbiter-1",
    title: "Arbiter Verification",
    description: "Verify a synchronous round-robin arbiter.",
    owningModule: "I-UVM-2A",
    routeSlug: "arbiter-1",
    prerequisites: ["simple-dut-1"],
    assetLocation: "content/curriculum/labs/arbiter",
    status: "coming_soon",
    graderType: "uvm",
    steps: []
  },
  "assertions-1": {
    id: "assertions-1",
    title: "Assertions Fundamentals",
    description: "Write basic concurrent and immediate assertions.",
    owningModule: "I-SV-4A",
    routeSlug: "assertions-1",
    prerequisites: [],
    assetLocation: "content/curriculum/labs/assertions",
    status: "coming_soon",
    graderType: "systemverilog",
    steps: []
  },
  "constructs-1": {
    id: "constructs-1",
    title: "SV Constructs",
    description: "Explore advanced SystemVerilog procedural constructs.",
    owningModule: "F2B",
    routeSlug: "constructs-1",
    prerequisites: [],
    assetLocation: "content/curriculum/labs/constructs",
    status: "coming_soon",
    graderType: "systemverilog",
    steps: []
  },
  "dma-1": {
    id: "dma-1",
    title: "DMA Verification",
    description: "Build a verify environment for a Direct Memory Access controller.",
    owningModule: "I-UVM-3B",
    routeSlug: "dma-1",
    prerequisites: ["arbiter-1"],
    assetLocation: "content/curriculum/labs/dma",
    status: "coming_soon",
    graderType: "uvm",
    steps: []
  },
  "coverage-advanced-1": {
    id: "coverage-advanced-1",
    title: "Advanced Coverage",
    description: "Implement complex covergroups and analyze coverage holes.",
    owningModule: "I-SV-3B",
    routeSlug: "coverage-advanced-1",
    prerequisites: [],
    assetLocation: "content/curriculum/labs/coverage_advanced/lab1_closure_loop",
    status: "available",
    graderType: "systemverilog",
    steps: [
      {
        id: "1",
        title: "Step 1: Run and Analyze",
        instructions: "Run the simulation. Notice the coverage score. Open `alu_cov_mon.sv` and see what the bin requirements are for `MAX_VAL`.",
        starterCode: ""
      },
      {
        id: "2",
        title: "Step 2: Add Missing Operations",
        instructions: "The constraint block in `testbench.sv` explicitly omits `DIV`. Add it back to the `inside` block.",
        starterCode: ""
      },
      {
        id: "3",
        title: "Step 3: Weight Edge Cases",
        instructions: "The generic `std::randomize()` rarely hits `8'hFF`. Add a `dist` constraint for `a` and `b` to assign weight to `8'hFF` so it occurs frequently.",
        starterCode: ""
      }
    ]
  },
  "randomization-advanced-1": {
    id: "randomization-advanced-1",
    title: "Advanced Randomization",
    description: "Solve complex constraint problems and debug solver failures.",
    owningModule: "I-SV-2B",
    routeSlug: "randomization-advanced-1",
    prerequisites: [],
    assetLocation: "content/curriculum/labs/randomization_advanced/lab1_dependent_fields",
    status: "available",
    graderType: "systemverilog",
    steps: [
      {
        id: "1",
        title: "Step 1: Check the Source",
        instructions: "Open `test.sv` and notice that the generator loop is ignoring the return value of `packet.randomize()`. The packets shown in the log will all look identical (zeros) when randomization fails.",
        starterCode: ""
      },
      {
        id: "2",
        title: "Step 2: Triage with constraint_mode",
        instructions: "The constraint contradiction is between the length rules and the hardware hardware limit rules. Use `pkt.c_hardware_limit.constraint_mode(0)` in your test before the `randomize()` call. Does it succeed?",
        starterCode: ""
      },
      {
        id: "3",
        title: "Step 3: Fix the Model",
        instructions: "In `packet.sv`, notice that the IPV6 length is hardcoded to 40 bytes, but 40 is not a power of two in `c_hardware_limit`! Fix `c_hardware_limit` or `c_proto_len` so an IPV6 packet can be legally generated.",
        starterCode: ""
      }
    ]
  },
  "uvm-performance-1": {
    id: "uvm-performance-1",
    title: "UVM Performance Metrics",
    description: "Profile and optimize UVM testbench performance footprint.",
    owningModule: "E-PERF-1",
    routeSlug: "uvm-performance-1",
    prerequisites: [],
    assetLocation: "content/curriculum/labs/uvm_performance",
    status: "coming_soon",
    graderType: "uvm",
    steps: []
  },
  "ral-mirror-bug": {
    id: "ral-mirror-bug",
    title: "RAL Mirror Bug",
    description: "Diagnose and fix a frozen RAL mirror caused by a missing predictor connection in connect_phase.",
    owningModule: "A-UVM-4B",
    routeSlug: "ral-mirror-bug",
    prerequisites: ["simple-dut-1"],
    assetLocation: "content/curriculum/labs/ral_advanced/lab1_mirror_bug",
    status: "available",
    graderType: "uvm",
    steps: [
      {
        id: "1",
        title: "Step 1: Identify the Frozen Mirror",
        instructions: "Run the simulation. Every `mirror(UVM_CHECK)` call fails with the stale reset value `0x0000`, even though bus writes to the DUT succeed.",
        starterCode: ""
      },
      {
        id: "2",
        title: "Step 2: Trace the Predictor Pipeline",
        instructions: "Open `testbench_buggy.sv` and inspect `connect_phase()`. The predictor and adapter are assigned, but is the bus monitor's analysis port connected to `predictor.bus_in`?",
        starterCode: ""
      },
      {
        id: "3",
        title: "Step 3: Fix the Connect Phase",
        instructions: "Add `axi_agt.monitor.ap.connect(predictor.bus_in);` to `connect_phase`. Re-run. The mirror should now track writes and `mirror(UVM_CHECK)` should pass.",
        starterCode: ""
      }
    ]
  },
  "callbacks-driver-behavior": {
    id: "callbacks-driver-behavior",
    title: "Modifying Driver Behavior with Callbacks",
    description: "Inject an error and a delay into a driver using a callback hook without altering the driver class itself.",
    owningModule: "A-UVM-5",
    routeSlug: "callbacks-driver-behavior",
    prerequisites: ["simple-dut-1"],
    assetLocation: "content/curriculum/labs/uvm_callbacks/lab1_driver_behavior",
    status: "available",
    graderType: "uvm",
    steps: [
      {
        id: "1",
        title: "Step 1: Review the Hook",
        instructions: "Open `testbench.sv` and locate the `packet_driver_cb` virtual class. Find where `uvm_do_callbacks` is invoked inside the driver's `run_phase`.",
        starterCode: ""
      },
      {
        id: "2",
        title: "Step 2: Implement the Callback",
        instructions: "Create a class `error_inject_cb` extending `packet_driver_cb`. Override `pre_drive` to add a 10ns delay and flip the packet's parity bit.",
        starterCode: ""
      },
      {
        id: "3",
        title: "Step 3: Attach in the Test",
        instructions: "In `my_test`, instantiate your callback and add it to the driver using `uvm_callbacks#(packet_driver, packet_driver_cb)::add()`. Run the simulation to verify the delay and corruption appear in the driver's log.",
        starterCode: ""
      }
    ]
  },
  "methodology-custom-phase": {
    id: "methodology-custom-phase",
    title: "Injecting a Custom UVM Phase",
    description: "Insert a firmware-loading phase into the UVM schedule and verify it executes between reset and configure.",
    owningModule: "E-CUST-1",
    routeSlug: "methodology-custom-phase",
    prerequisites: ["simple-dut-1"],
    assetLocation: "content/curriculum/labs/methodology_customization/lab1_custom_phase",
    status: "available",
    graderType: "uvm",
    steps: [
      {
        id: "1",
        title: "Step 1: Complete the Singleton",
        instructions: "Open `testbench.sv` and complete the `load_fw_phase` singleton `get()` method so UVM can find a single canonical phase instance.",
        starterCode: ""
      },
      {
        id: "2",
        title: "Step 2: Insert Into the Schedule",
        instructions: "In `base_test::build_phase`, use `uvm_domain::get_common_domain().add()` to insert `load_fw_phase` after `reset_phase`.",
        starterCode: ""
      },
      {
        id: "3",
        title: "Step 3: Implement the Phase Task",
        instructions: "In `soc_env`, implement `load_fw_phase` as a task that raises an objection, prints a firmware-load banner, waits 20ns, and drops the objection. Run the simulation to verify the phase order.",
        starterCode: ""
      }
    ]
  },
  "soc-vip-reuse": {
    id: "soc-vip-reuse",
    title: "Block to SoC: VIP Modes",
    description: "Configure a block-level SPI agent into passive mode so it monitors traffic driven by an embedded processor without causing bus collisions.",
    owningModule: "E-SOC-1",
    routeSlug: "soc-vip-reuse",
    prerequisites: ["simple-dut-1"],
    assetLocation: "content/curriculum/labs/soc_level/lab1_vip_reuse",
    status: "available",
    graderType: "uvm",
    steps: [
      {
        id: "1",
        title: "Step 1: Observe the Active Agent Failure",
        instructions: "Run `testbench.sv` without changes. Observe the `BUS_COLLISION` fatal error caused by the UVM Driver and Firmware driving simultaneously.",
        starterCode: ""
      },
      {
        id: "2",
        title: "Step 2: Flip to Passive Mode",
        instructions: "In `soc_test::build_phase`, use the `uvm_config_db` to set `is_active` to `UVM_PASSIVE` for the `\"env.spi_agt\"` path.",
        starterCode: ""
      },
      {
        id: "3",
        title: "Step 3: Verify Monitor Behavior",
        instructions: "Rerun the simulation. Verify the driver is disabled but the `[SPI_MON]` continues to log firmware traffic.",
        starterCode: ""
      }
    ]
  },
  "soc-strategy-capstone": {
    id: "soc-strategy-capstone",
    title: "Staff-Level SoC Verification Strategy Review",
    description: "Create and review a staff-level SoC verification strategy covering VIP reuse, coverage, formal/liveness, debug triage, regression gates, and signoff risks.",
    owningModule: "E-SOC-1",
    routeSlug: "soc-strategy-capstone",
    prerequisites: ["soc-vip-reuse", "uvm-mini-capstone"],
    assetLocation: "content/curriculum/labs/soc_level/lab2_soc_strategy_capstone",
    status: "available",
    graderType: "none",
    steps: [
      {
        id: "1",
        title: "Step 1: Define Strategy Boundaries",
        instructions: "Open `strategy_template.md` and split responsibilities across block, subsystem, SoC, firmware, and formal owners.",
        starterCode: ""
      },
      {
        id: "2",
        title: "Step 2: Build the Coverage and Liveness Plan",
        instructions: "Fill in measurable system coverage goals plus formal/liveness properties with trigger, obligation, failure meaning, and owner.",
        starterCode: ""
      },
      {
        id: "3",
        title: "Step 3: Add Debug, Regression, and Risks",
        instructions: "Define the failure evidence package, bucketing workflow, smoke/nightly/stress/signoff suites, and risk register.",
        starterCode: ""
      },
      {
        id: "4",
        title: "Step 4: Peer Review Against the Rubric",
        instructions: "Score the plan with the rubric, then compare against `model_solution.md` to identify missing staff-level reasoning.",
        starterCode: ""
      }
    ]
  },
  "formal-harness": {
    id: "formal-harness",
    title: "Formal Assumption Harness",
    description: "Identify an over-constrained formal assumption that masks a real FIFO overflow bug, relax it, and fix the design.",
    owningModule: "E-INT-1",
    routeSlug: "formal-harness",
    prerequisites: [],
    assetLocation: "content/curriculum/labs/formal_harness/lab1_assumption_harness",
    status: "available",
    graderType: "systemverilog",
    steps: [
      {
        id: "1",
        title: "Step 1: Read the Buggy Harness",
        instructions: "Open `testbench_buggy.sv`. Identify the three `assume` properties. Notice that `a_never_consecutive_push` is far more restrictive than what a real environment guarantees.",
        starterCode: ""
      },
      {
        id: "2",
        title: "Step 2: Relax the Over-Constraint",
        instructions: "Comment out `a_never_consecutive_push`. Re-run the formal engine. Observe the counterexample: rapid consecutive pushes overflow the FIFO because the `full` flag updates one cycle late.",
        starterCode: ""
      },
      {
        id: "3",
        title: "Step 3: Fix the Design",
        instructions: "Open `testbench_solution.sv`. Notice that `full` and `empty` are now combinational (`assign`). Re-run: the assertion passes and the cover property is now reachable.",
        starterCode: ""
      }
    ]
  },
  "ahb-axi-bridge-debug": {
    id: "ahb-axi-bridge-debug",
    title: "AHB-to-AXI Bridge Debug",
    description: "Debug burst translation and 4KB boundary splitting in a buggy AHB-to-AXI bridge.",
    owningModule: "B-AMBA-F1",
    routeSlug: "ahb-axi-bridge-debug",
    prerequisites: ["ahb-checker-lab", "axi-scoreboard-lab"],
    assetLocation: "content/curriculum/labs/ahb_axi_bridge/lab1_bridge_debug",
    status: "available",
    graderType: "systemverilog",
    steps: [
      {
        id: "1",
        title: "Step 1: Reproduce the Split Bug",
        instructions: "Run `testbench.sv` and inspect the AXI AW log for the `crossing_4kb_bug` request. The first translated AXI burst crosses the 0x1000 boundary.",
        starterCode: ""
      },
      {
        id: "2",
        title: "Step 2: Complete the Checker",
        instructions: "Open `bridge_split_checker.sv` and implement the 4KB boundary, first split length, size preservation, and W beat accounting checks.",
        starterCode: ""
      },
      {
        id: "3",
        title: "Step 3: Fix the Split Function",
        instructions: "Replace the buggy `beats_to_4kb_boundary_buggy()` logic with the corrected boundary calculation from `solution.sv`, then rerun the lab.",
        starterCode: ""
      }
    ]
  },
  "pss-portable-intent": {
    id: "pss-portable-intent",
    title: "Memory Read/Write Portable Intent",
    description: "Write one PSS read-after-write memory intent and inspect the generated UVM sequence and C bare-metal equivalents.",
    owningModule: "E-PSS-1",
    routeSlug: "pss-portable-intent",
    prerequisites: ["A-UVM-1", "E-PSS-1"],
    moduleHref: "/curriculum/T4_Expert/E-PSS-1_Portable_Stimulus_Standard/index",
    assetLocation: "content/curriculum/labs/pss/lab1_portable_intent",
    status: "available",
    graderType: "custom",
    steps: [
      {
        id: "1",
        title: "Step 1: Complete the Write Action",
        instructions: "Open `starter/mem_test.pss` and add the 4-byte address alignment constraint plus the `0x0000` through `0xffff` data range constraint.",
        starterCode: ""
      },
      {
        id: "2",
        title: "Step 2: Bind Read-Verify to the Write",
        instructions: "Add the `write_mem` input handle to `read_verify`, then bind `rd.wr == wr` in the activity graph so the read checks the exact write action.",
        starterCode: ""
      },
      {
        id: "3",
        title: "Step 3: Compare Generated Targets",
        instructions: "Review `solution/generated_uvm_sequence.sv` and `solution/generated_baremetal_test.c`; identify how the same PSS constraints become UVM randomization and C helper calls.",
        starterCode: ""
      }
    ]
  },
  "power_aware_retention": {
    id: "power_aware_retention",
    title: "Retention Bug and Isolation Sequencing",
    description: "Identify and fix a critical bug in a Power Management Unit wake-up sequence.",
    owningModule: "E-PWR-1",
    routeSlug: "power-aware-retention",
    prerequisites: [],
    assetLocation: "content/curriculum/labs/power_aware/lab1_retention_bug",
    status: "available",
    graderType: "systemverilog",
    steps: [
      {
        id: "1",
        title: "Step 1: Understand the Bug",
        instructions: "Analyze the failing test sequence in `buggy_tb.sv` where isolation is released before power is strictly stable.",
        starterCode: ""
      },
      {
        id: "2",
        title: "Step 2: Reorder Sequence",
        instructions: "Fix the sequence so isolation remains asserted until after power is completely restored and context is reloaded.",
        starterCode: ""
      }
    ]
  },
  "axi-deadlock-hunt-lab": {
    id: "axi-deadlock-hunt-lab",
    title: "AXI Deadlock Hunt: Channel Dependency Analysis",
    description: "Analyze a waveform to identify a subtle cyclic channel-dependency deadlock between an AXI master and slave, then write SVA protocol assertions to catch and prevent it.",
    owningModule: "B-AXI-5",
    routeSlug: "axi-deadlock-hunt-lab",
    prerequisites: ["axi-scoreboard-lab"],
    assetLocation: "content/curriculum/labs/axi_deadlock/lab1_hunt",
    status: "available",
    graderType: "systemverilog",
    steps: [
      {
        id: "1",
        title: "Step 1: Run and Observe",
        instructions: "Run testbench.sv. The simulation hangs after the master asserts AWVALID. Examine which signals are high/low when the deadlock occurs.",
        starterCode: ""
      },
      {
        id: "2",
        title: "Step 2: Analyze the Dependency",
        instructions: "Identify what the master waits for (AWREADY) and what the slave waits for (WVALID). Trace the circular dependency and explain why the read also hangs.",
        starterCode: ""
      },
      {
        id: "3",
        title: "Step 3: Complete the Assertions",
        instructions: "Open axi_deadlock_checker.sv and implement the five SVA assertions: p_aw_no_deadlock, p_w_no_deadlock, p_ar_no_deadlock, p_valid_stability, and p_no_cross_channel_stall.",
        starterCode: ""
      }
    ]
  }
};

export function getAllLabs(): LabMetadata[] {
  return Object.values(LAB_REGISTRY);
}

export function getLabById(id: string): LabMetadata | undefined {
  return LAB_REGISTRY[id];
}
