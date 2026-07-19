"use client";

import { Play, RotateCcw, Square } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import type { SimulatorBackend } from "@/server/simulation/types";

import { Button } from "./Button";

export interface SimulationSourceFile {
  path: string;
  content: string;
}

interface CodeExecutionEnvironmentProps {
  prepareFiles: () => Promise<SimulationSourceFile[]>;
}

export function CodeExecutionEnvironment({ prepareFiles }: CodeExecutionEnvironmentProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [backend, setBackend] = useState<SimulatorBackend>("icarus");
  const [output, setOutput] = useState("");
  const [coverage, setCoverage] = useState<number | null>(null);
  const requestControllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => requestControllerRef.current?.abort(), []);

  const handleRunCode = async () => {
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    setIsRunning(true);
    setCoverage(null);
    setOutput("Preparing learner workspace…");

    try {
      const files = await prepareFiles();
      if (files.length === 0) throw new Error("No editable SystemVerilog files are available to simulate.");
      setOutput("Submitting workspace to the isolated simulator…");
      const response = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ backend, files }),
      });
      const queued: unknown = await response.json().catch(() => null);
      const queuedJob = queued && typeof queued === "object" ? queued as { jobId?: unknown; error?: unknown } : {};
      if (!response.ok || typeof queuedJob.jobId !== "string") {
        throw new Error(typeof queuedJob.error === "string" ? queuedJob.error : "Unable to start simulation");
      }

      setOutput(`Simulation accepted (${queuedJob.jobId}).`);
      for (let attempt = 0; attempt < 60; attempt += 1) {
        await new Promise<void>((resolve, reject) => {
          const timer = window.setTimeout(resolve, 1_000);
          controller.signal.addEventListener("abort", () => {
            window.clearTimeout(timer);
            reject(new DOMException("Aborted", "AbortError"));
          }, { once: true });
        });

        const statusResponse = await fetch(`/api/simulate/${encodeURIComponent(queuedJob.jobId)}`, {
          signal: controller.signal,
        });
        const statusPayload: unknown = await statusResponse.json().catch(() => null);
        if (!statusResponse.ok || !statusPayload || typeof statusPayload !== "object") {
          const message = statusPayload && typeof (statusPayload as { error?: unknown }).error === "string"
            ? (statusPayload as { error: string }).error
            : "Unable to load simulation status";
          throw new Error(message);
        }
        const job = statusPayload as {
          status?: unknown;
          result?: unknown;
          errorCode?: unknown;
        };
        if (job.status === "queued" || job.status === "running") {
          setOutput(`Simulation ${job.status}…`);
          continue;
        }

        const result = job.result && typeof job.result === "object"
          ? job.result as { diagnostics?: unknown; coverage?: unknown; passed?: unknown }
          : {};
        const diagnostics = Array.isArray(result.diagnostics)
          ? result.diagnostics.filter((item): item is { message: string } => (
              Boolean(item) && typeof item === "object" && typeof (item as { message?: unknown }).message === "string"
            ))
          : [];
        setOutput(
          diagnostics.length > 0
            ? diagnostics.map((item) => item.message).join("\n")
            : result.passed === true
              ? "Simulation completed successfully."
              : typeof job.errorCode === "string"
                ? `Simulation failed: ${job.errorCode}`
                : `Simulation ended with status: ${String(job.status)}`,
        );
        setCoverage(typeof result.coverage === "number" ? result.coverage : null);
        return;
      }

      throw new Error("Simulation status timed out");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setOutput("Stopped waiting for simulation status. The isolated job may continue server-side.");
      } else {
        setOutput(error instanceof Error ? error.message : "Simulation request failed");
      }
    } finally {
      setIsRunning(false);
    }
  };

  const handleStopWaiting = () => requestControllerRef.current?.abort();
  const handleReset = () => {
    requestControllerRef.current?.abort();
    setOutput("");
    setCoverage(null);
  };

  return (
    <section className="code-execution-environment mt-4 rounded-lg border border-border bg-background/60 p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="text-sm font-medium" htmlFor="simulation-backend">Simulator</label>
        <select
          id="simulation-backend"
          className="rounded-md border bg-background p-2 text-foreground"
          value={backend}
          onChange={(event) => setBackend(event.target.value as SimulatorBackend)}
          disabled={isRunning}
        >
          <option value="icarus">Icarus</option>
          <option value="verilator">Verilator</option>
        </select>
        <Button onClick={handleRunCode} disabled={isRunning}>
          <Play className="mr-2 h-4 w-4" />
          {isRunning ? "Running…" : "Run workspace"}
        </Button>
        {isRunning && (
          <Button onClick={handleStopWaiting} variant="secondary">
            <Square className="mr-2 h-4 w-4" />Stop waiting
          </Button>
        )}
        <Button onClick={handleReset} variant="secondary" disabled={isRunning}>
          <RotateCcw className="mr-2 h-4 w-4" />Reset output
        </Button>
      </div>
      <h3 className="mb-2 text-sm font-semibold">Simulation output</h3>
      <pre
        aria-live="polite"
        className="h-48 overflow-y-auto whitespace-pre-wrap rounded-md bg-black p-4 font-mono text-sm text-white"
        data-testid="simulation-output"
      >
        {output || "Run the current editable workspace in an isolated simulator."}
      </pre>
      {coverage !== null && <p className="mt-2 text-sm">Reported coverage: {coverage}%</p>}
    </section>
  );
}

export default CodeExecutionEnvironment;
