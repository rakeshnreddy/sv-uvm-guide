import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import type { SandboxExecutionResult, SimulationSandbox } from "./worker";

function runDocker(
  args: string[],
  wallTimeMs: number,
  outputBytes: number,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, { shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const append = (current: string, chunk: Buffer) => (
      current.length >= outputBytes ? current : (current + chunk.toString("utf8")).slice(0, outputBytes)
    );
    child.stdout.on("data", (chunk: Buffer) => { stdout = append(stdout, chunk); });
    child.stderr.on("data", (chunk: Buffer) => { stderr = append(stderr, chunk); });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      const error = new Error("Isolated simulator exceeded its wall-time limit");
      error.name = "TimeoutError";
      reject(error);
    }, wallTimeMs);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      resolve({ exitCode: code ?? 1, stdout, stderr });
    });
  });
}

export class DockerSimulationSandbox implements SimulationSandbox {
  async run(input: Parameters<SimulationSandbox["run"]>[0]): Promise<SandboxExecutionResult> {
    const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "sv-uvm-simulation-"));
    const workspace = path.join(temporaryRoot, "workspace");
    const results = path.join(temporaryRoot, "results");
    await fs.mkdir(workspace, { recursive: true });
    await fs.mkdir(results, { recursive: true });
    await fs.chmod(results, 0o777);

    try {
      for (const file of input.files) {
        const destination = path.resolve(workspace, file.path);
        if (!destination.startsWith(`${workspace}${path.sep}`)) {
          throw new Error("Simulation file escaped the isolated workspace");
        }
        await fs.mkdir(path.dirname(destination), { recursive: true });
        await fs.writeFile(destination, file.content, { encoding: "utf8", mode: 0o644 });
      }

      const execution = await runDocker([
        "run",
        "--rm",
        "--network", "none",
        "--memory", `${input.limits.memoryMb}m`,
        "--cpus", String(input.limits.cpuCount),
        "--pids-limit", String(input.limits.processCount),
        "--read-only",
        "--cap-drop", "ALL",
        "--security-opt", "no-new-privileges",
        "--tmpfs", `/tmp:rw,nosuid,nodev,size=${input.limits.filesystemBytes}`,
        "--volume", `${workspace}:/workspace:ro`,
        "--volume", `${results}:/results:rw`,
        input.image,
        ...input.command,
      ], input.limits.wallTimeMs, input.limits.outputBytes);

      const resultPath = path.join(results, "result.json");
      const resultFile = await fs.readFile(resultPath, "utf8").catch(() => undefined);
      return {
        ...execution,
        resultFiles: { "result.json": resultFile },
      };
    } finally {
      await fs.rm(temporaryRoot, { recursive: true, force: true });
    }
  }
}
