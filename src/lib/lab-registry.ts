import { LabMetadata } from '@/types/lab';

export const LAB_REGISTRY: Record<string, LabMetadata> = {
  "basics-1": {
    id: "basics-1",
    title: "SV Basics: Variables and Assignment",
    description: "Learn how to declare and assign variables in SystemVerilog.",
    owningModule: "F2D", 
    routeSlug: "basics-1",
    prerequisites: [],
    assetLocation: "labs/basics/lab1_refactoring",
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
    assetLocation: "labs/common",
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
    assetLocation: "labs/fifo",
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
    assetLocation: "labs/simple_dut",
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
    assetLocation: "labs/scoreboard_decoupling",
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
  "config-debug": {
    id: "config-debug",
    title: "Null Virtual Interface",
    description: "Diagnose and fix a fatal null virtual interface error caused by a typo in the uvm_config_db.",
    owningModule: "I-UVM-2C",
    routeSlug: "config-debug",
    prerequisites: ["simple-dut-1"],
    assetLocation: "labs/config_debug",
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
  "ipc-deadlock": {
    id: "ipc-deadlock",
    title: "Semaphore Deadlock",
    description: "Diagnose and fix a simulation hang caused by an unreturned semaphore key in an early exit condition.",
    owningModule: "I-SV-5",
    routeSlug: "ipc-deadlock",
    prerequisites: ["systemverilog-basics"],
    assetLocation: "labs/ipc_deadlock",
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
    assetLocation: "labs/arbiter",
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
    assetLocation: "labs/assertions",
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
    assetLocation: "labs/constructs",
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
    assetLocation: "labs/dma",
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
  }
};

export function getAllLabs(): LabMetadata[] {
  return Object.values(LAB_REGISTRY);
}

export function getLabById(id: string): LabMetadata | undefined {
  return LAB_REGISTRY[id];
}
