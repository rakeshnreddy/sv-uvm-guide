import { z } from "zod";

import type { SimulationSubmission } from "./index";

const backendImages: Record<SimulationSubmission["backend"], string> = {
  icarus: "ghcr.io/sv-uvm-guide/iverilog-runner:2026.07",
  verilator: "ghcr.io/sv-uvm-guide/verilator-runner:2026.07",
};

const simulatorCommands: Record<SimulationSubmission["backend"], readonly string[]> = {
  icarus: ["/opt/sv-runner/bin/run-iverilog"],
  verilator: ["/opt/sv-runner/bin/run-verilator"],
};

const trustedHarnessResultSchema = z.object({
  passed: z.boolean(),
  coverage: z.number().min(0).max(100).default(0),
  waveformKey: z.string().max(500).nullable().default(null),
  diagnostics: z
    .array(
      z.object({
        severity: z.enum(["info", "warning", "error"]),
        code: z.string().max(100),
        message: z.string().max(2_000),
        file: z.string().max(160).optional(),
        line: z.number().int().positive().optional(),
      }),
    )
    .max(1_000)
    .default([]),
});

export interface SandboxExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  resultFiles: Record<string, string | undefined>;
}

export interface SimulationSandbox {
  run(input: {
    image: string;
    command: readonly string[];
    files: SimulationSubmission["files"];
    limits: {
      wallTimeMs: number;
      memoryMb: number;
      cpuCount: number;
      processCount: number;
      outputBytes: number;
      filesystemBytes: number;
      network: "disabled";
    };
  }): Promise<SandboxExecutionResult>;
}

export function parseTrustedHarnessResult(result: SandboxExecutionResult) {
  const resultFile = result.resultFiles["result.json"];
  if (result.exitCode !== 0 || !resultFile) {
    return {
      passed: false,
      coverage: 0,
      waveformKey: null,
      diagnostics: [
        {
          severity: "error" as const,
          code: "SIMULATOR_EXIT",
          message: "The isolated simulator did not produce a valid harness result.",
        },
      ],
    };
  }

  return trustedHarnessResultSchema.parse(JSON.parse(resultFile));
}

export async function executeSimulationJob(
  sandbox: SimulationSandbox,
  submission: SimulationSubmission,
) {
  const result = await sandbox.run({
    image: backendImages[submission.backend],
    command: simulatorCommands[submission.backend],
    files: submission.files,
    limits: {
      wallTimeMs: 20_000,
      memoryMb: 512,
      cpuCount: 1,
      processCount: 32,
      outputBytes: 1_000_000,
      filesystemBytes: 64 * 1024 * 1024,
      network: "disabled",
    },
  });

  return parseTrustedHarnessResult(result);
}
