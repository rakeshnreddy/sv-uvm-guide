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
    assetLocation: "content/curriculum/labs/coverage_advanced",
    status: "coming_soon",
    graderType: "systemverilog",
    steps: []
  },
  "randomization-advanced-1": {
    id: "randomization-advanced-1",
    title: "Advanced Randomization",
    description: "Solve complex constraint problems and debug solver failures.",
    owningModule: "I-SV-2B",
    routeSlug: "randomization-advanced-1",
    prerequisites: [],
    assetLocation: "content/curriculum/labs/randomization_advanced/lab1_dependent_fields",
    status: "coming_soon",
    graderType: "systemverilog",
    steps: []
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
  }
};

export function getAllLabs(): LabMetadata[] {
  return Object.values(LAB_REGISTRY);
}

export function getLabById(id: string): LabMetadata | undefined {
  return LAB_REGISTRY[id];
}
