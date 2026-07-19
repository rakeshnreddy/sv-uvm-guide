import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  updateMany: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    simulationJob: {
      create: mocks.create,
      updateMany: mocks.updateMany,
      findUniqueOrThrow: mocks.findUniqueOrThrow,
      update: mocks.update,
    },
  },
}));

import {
  processQueuedSimulationJob,
  simulationJobs,
  SimulationExecutionUnavailableError,
  type SimulationSandbox,
} from "@/server/simulation";

describe("processQueuedSimulationJob", () => {
  beforeEach(() => {
    mocks.updateMany.mockReset();
    mocks.create.mockReset();
    mocks.findUniqueOrThrow.mockReset();
    mocks.update.mockReset();
  });

  it("fails before creating a zombie job when no dispatcher is configured", async () => {
    const previousQueueUrl = process.env.SIMULATION_QUEUE_URL;
    const previousLocalDocker = process.env.SIMULATION_LOCAL_DOCKER;
    delete process.env.SIMULATION_QUEUE_URL;
    delete process.env.SIMULATION_LOCAL_DOCKER;
    try {
      await expect(simulationJobs.enqueue("user-1", {
        backend: "icarus",
        files: [{ path: "top.sv", content: "module top; endmodule" }],
      })).rejects.toBeInstanceOf(SimulationExecutionUnavailableError);
      expect(mocks.create).not.toHaveBeenCalled();
    } finally {
      if (previousQueueUrl === undefined) delete process.env.SIMULATION_QUEUE_URL;
      else process.env.SIMULATION_QUEUE_URL = previousQueueUrl;
      if (previousLocalDocker === undefined) delete process.env.SIMULATION_LOCAL_DOCKER;
      else process.env.SIMULATION_LOCAL_DOCKER = previousLocalDocker;
    }
  });

  it("claims one queued job and persists the trusted sandbox result", async () => {
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.findUniqueOrThrow.mockResolvedValue({
      id: "job-1",
      backend: "ICARUS",
      files: [{ path: "top.sv", content: "module top; endmodule" }],
    });
    mocks.update.mockResolvedValue({});
    const sandbox: SimulationSandbox = {
      run: vi.fn().mockResolvedValue({
        exitCode: 0,
        stdout: "user output is not authoritative",
        stderr: "",
        resultFiles: { "result.json": JSON.stringify({ passed: true }) },
      }),
    };

    await expect(processQueuedSimulationJob("job-1", sandbox)).resolves.toBe(true);

    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "job-1", status: "QUEUED" },
      data: expect.objectContaining({ status: "RUNNING" }),
    }));
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "job-1" },
      data: expect.objectContaining({
        status: "SUCCEEDED",
        result: expect.objectContaining({ passed: true }),
      }),
    }));
  });

  it("does not execute a job another worker already claimed", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    const sandbox: SimulationSandbox = { run: vi.fn() };

    await expect(processQueuedSimulationJob("job-1", sandbox)).resolves.toBe(false);
    expect(sandbox.run).not.toHaveBeenCalled();
    expect(mocks.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});
