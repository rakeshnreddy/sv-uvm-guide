import { describe, expect, it, vi } from "vitest";

import { executeSimulationJob, parseTrustedHarnessResult } from "@/server/simulation";
import type { SimulationSandbox } from "@/server/simulation";

describe("isolated simulation worker contract", () => {
  it("trusts the harness result file instead of user-controlled output", () => {
    const result = parseTrustedHarnessResult({
      exitCode: 0,
      stdout: "PASSED PASSED PASSED",
      stderr: "",
      resultFiles: {
        "result.json": JSON.stringify({
          passed: false,
          coverage: 12,
          waveformKey: null,
          diagnostics: [],
        }),
      },
    });

    expect(result.passed).toBe(false);
    expect(result.coverage).toBe(12);
  });

  it("applies the fixed image, command, and resource policy", async () => {
    const run = vi.fn().mockResolvedValue({
      exitCode: 0,
      stdout: "",
      stderr: "",
      resultFiles: {
        "result.json": JSON.stringify({ passed: true }),
      },
    });
    const sandbox: SimulationSandbox = { run };

    const result = await executeSimulationJob(sandbox, {
      backend: "icarus",
      files: [{ path: "top.sv", content: "module top; endmodule" }],
    });

    expect(result.passed).toBe(true);
    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({
        image: expect.stringContaining("iverilog-runner"),
        command: ["/opt/sv-runner/bin/run-iverilog"],
        limits: expect.objectContaining({
          wallTimeMs: 20_000,
          memoryMb: 512,
          cpuCount: 1,
          network: "disabled",
        }),
      }),
    );
  });

  it("fails closed when the harness result is missing", () => {
    const result = parseTrustedHarnessResult({
      exitCode: 0,
      stdout: "Simulation PASSED",
      stderr: "",
      resultFiles: {},
    });

    expect(result.passed).toBe(false);
    expect(result.diagnostics[0].code).toBe("SIMULATOR_EXIT");
  });
});
