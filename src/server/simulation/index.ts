import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  executeSimulationJob,
  parseTrustedHarnessResult,
  type SimulationSandbox,
} from "./worker";

const MAX_FILE_COUNT = 16;
const MAX_FILE_BYTES = 128 * 1024;
const MAX_TOTAL_SOURCE_BYTES = 512 * 1024;

const sourceFileSchema = z.object({
  path: z
    .string()
    .min(1)
    .max(160)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/)
    .refine((value) => !value.split("/").includes(".."), "Parent paths are not allowed"),
  content: z.string().max(MAX_FILE_BYTES),
});

export const simulationRequestSchema = z
  .object({
    backend: z.enum(["icarus", "verilator"]),
    files: z.array(sourceFileSchema).min(1).max(MAX_FILE_COUNT),
  })
  .superRefine(({ files }, context) => {
    const paths = new Set<string>();
    let totalBytes = 0;

    files.forEach((file, index) => {
      if (paths.has(file.path)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["files", index, "path"],
          message: "File paths must be unique",
        });
      }
      paths.add(file.path);
      totalBytes += Buffer.byteLength(file.content, "utf8");
    });

    if (totalBytes > MAX_TOTAL_SOURCE_BYTES) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["files"],
        message: `Total source size must not exceed ${MAX_TOTAL_SOURCE_BYTES} bytes`,
      });
    }
  });

export type SimulationSubmission = z.infer<typeof simulationRequestSchema>;

export interface SimulationJobDto {
  id: string;
  backend: SimulationSubmission["backend"];
  status: "queued" | "running" | "succeeded" | "failed" | "timed_out" | "cancelled";
  result: unknown | null;
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
}

const backendToDatabase = {
  icarus: "ICARUS",
  verilator: "VERILATOR",
} as const;

const backendFromDatabase = {
  ICARUS: "icarus",
  VERILATOR: "verilator",
} as const;

const statusFromDatabase = {
  QUEUED: "queued",
  RUNNING: "running",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  TIMED_OUT: "timed_out",
  CANCELLED: "cancelled",
} as const;

function toDto(job: {
  id: string;
  backend: keyof typeof backendFromDatabase;
  status: keyof typeof statusFromDatabase;
  result: unknown;
  errorCode: string | null;
  createdAt: Date;
  updatedAt: Date;
}): SimulationJobDto {
  return {
    id: job.id,
    backend: backendFromDatabase[job.backend],
    status: statusFromDatabase[job.status],
    result: job.result,
    errorCode: job.errorCode,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

async function dispatchToIsolatedWorker(jobId: string): Promise<void> {
  const queueUrl = process.env.SIMULATION_QUEUE_URL;
  const queueToken = process.env.SIMULATION_QUEUE_TOKEN;

  if (!queueUrl) throw new SimulationExecutionUnavailableError();

  const response = await fetch(queueUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(queueToken ? { Authorization: `Bearer ${queueToken}` } : {}),
    },
    body: JSON.stringify({ jobId }),
    signal: AbortSignal.timeout(5_000),
  });

  if (!response.ok) {
    await prisma.simulationJob.update({
      where: { id: jobId },
      data: { status: "FAILED", errorCode: "QUEUE_DISPATCH_FAILED" },
    });
    throw new Error("Simulation queue rejected the job");
  }
}

export class SimulationExecutionUnavailableError extends Error {
  readonly code = "SIMULATION_EXECUTION_NOT_CONFIGURED";

  constructor() {
    super("Configure SIMULATION_QUEUE_URL or explicitly enable SIMULATION_LOCAL_DOCKER");
    this.name = "SimulationExecutionUnavailableError";
  }
}

function localDockerEnabled(): boolean {
  return process.env.SIMULATION_LOCAL_DOCKER === "true";
}

export const simulationJobs = {
  async enqueue(userId: string, submission: SimulationSubmission): Promise<SimulationJobDto> {
    if (!process.env.SIMULATION_QUEUE_URL && !localDockerEnabled()) {
      throw new SimulationExecutionUnavailableError();
    }
    const job = await prisma.simulationJob.create({
      data: {
        userId,
        backend: backendToDatabase[submission.backend],
        files: submission.files,
      },
    });

    if (localDockerEnabled() && !process.env.SIMULATION_QUEUE_URL) {
      const { DockerSimulationSandbox } = await import("./docker-sandbox");
      await processQueuedSimulationJob(job.id, new DockerSimulationSandbox());
      const completed = await prisma.simulationJob.findUniqueOrThrow({ where: { id: job.id } });
      return toDto(completed);
    }

    await dispatchToIsolatedWorker(job.id);
    return toDto(job);
  },

  async getForUser(userId: string, jobId: string): Promise<SimulationJobDto | null> {
    const job = await prisma.simulationJob.findFirst({
      where: { id: jobId, userId },
    });
    return job ? toDto(job) : null;
  },
};

export async function processQueuedSimulationJob(
  jobId: string,
  sandbox: SimulationSandbox,
): Promise<boolean> {
  const claimed = await prisma.simulationJob.updateMany({
    where: { id: jobId, status: "QUEUED" },
    data: { status: "RUNNING", startedAt: new Date(), errorCode: null },
  });
  if (claimed.count !== 1) return false;

  try {
    const job = await prisma.simulationJob.findUniqueOrThrow({ where: { id: jobId } });
    const submission = simulationRequestSchema.parse({
      backend: backendFromDatabase[job.backend],
      files: job.files,
    });
    const result = await executeSimulationJob(sandbox, submission);
    await prisma.simulationJob.update({
      where: { id: jobId },
      data: {
        status: "SUCCEEDED",
        completedAt: new Date(),
        result: result as unknown as Prisma.InputJsonValue,
      },
    });
    return true;
  } catch (error) {
    const timedOut = error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");
    await prisma.simulationJob.update({
      where: { id: jobId },
      data: {
        status: timedOut ? "TIMED_OUT" : "FAILED",
        completedAt: new Date(),
        errorCode: timedOut ? "SANDBOX_TIMEOUT" : "SANDBOX_EXECUTION_FAILED",
      },
    });
    throw error;
  }
}

export { executeSimulationJob, parseTrustedHarnessResult };
export type { SimulationSandbox };
