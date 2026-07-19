"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { LabAssetSummary, LabProgressDto, LearnerLabDto } from "@/types/lab";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center">Loading editor…</div>,
});
const CodeExecutionEnvironment = dynamic(
  () => import("@/components/ui/CodeExecutionEnvironment").then((module) => module.CodeExecutionEnvironment),
  { ssr: false },
);

type LabClientPageProps = {
  lab: LearnerLabDto;
  assets: LabAssetSummary[];
  initialProgress: LabProgressDto;
};

const roleLabel: Record<LabAssetSummary["role"], string> = {
  guide: "Guide",
  starter: "Starter",
  solution: "Solution",
  reference: "Reference",
};

const languageLabel: Record<string, string> = {
  c: "C",
  markdown: "Markdown",
  pss: "PSS",
  systemverilog: "SystemVerilog",
};

function assetUrl(labId: string, assetPath: string): string {
  const encodedPath = assetPath.split("/").map(encodeURIComponent).join("/");
  return `/api/me/labs/${encodeURIComponent(labId)}/assets/${encodedPath}`;
}

export default function LabClientPage({ lab, assets, initialProgress }: LabClientPageProps) {
  const initialStepIndex = Math.max(
    0,
    lab.steps.findIndex((step) => step.id === initialProgress.currentStepId),
  );
  const firstWorkspaceAsset = assets.find((asset) => asset.editable) ?? assets.find((asset) => asset.role !== "guide");
  const [currentStepIndex, setCurrentStepIndex] = useState(initialStepIndex);
  const [selectedAssetPath, setSelectedAssetPath] = useState<string | null>(firstWorkspaceAsset?.path ?? null);
  const [fileBuffers, setFileBuffers] = useState<Record<string, string>>(initialProgress.fileBuffers);
  const [readOnlyBuffers, setReadOnlyBuffers] = useState<Record<string, string>>({});
  const [completedSteps, setCompletedSteps] = useState(initialProgress.completedSteps);
  const [stepCode, setStepCode] = useState(lab.steps[initialStepIndex]?.starterCode ?? "");
  const [consoleOutput, setConsoleOutput] = useState("");
  const [isSuccess, setIsSuccess] = useState<boolean | null>(null);
  const [loadingAsset, setLoadingAsset] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  const selectedAsset = assets.find((asset) => asset.path === selectedAssetPath) ?? null;
  const currentStep = lab.steps[currentStepIndex];
  const hasAutomatedGrader = currentStep?.completion === "graded" && Boolean(lab.graderId);
  const selectedContent = selectedAsset
    ? (selectedAsset.editable ? fileBuffers[selectedAsset.path] : readOnlyBuffers[selectedAsset.path]) ?? ""
    : stepCode;
  const moduleHref = lab.moduleHref ?? "/curriculum";
  const editableAssets = useMemo(() => assets.filter((asset) => asset.editable), [assets]);
  const simulatableAssets = useMemo(
    () => editableAssets.filter((asset) => asset.language === "systemverilog"),
    [editableAssets],
  );

  useEffect(() => {
    if (!selectedAsset) return;
    const existing = selectedAsset.editable
      ? fileBuffers[selectedAsset.path]
      : readOnlyBuffers[selectedAsset.path];
    if (existing !== undefined) return;

    const controller = new AbortController();
    setLoadingAsset(true);
    fetch(assetUrl(lab.id, selectedAsset.path), { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Asset request failed (${response.status})`);
        const result: unknown = await response.json();
        if (!result || typeof result !== "object" || typeof (result as { content?: unknown }).content !== "string") {
          throw new Error("Asset response was malformed");
        }
        const content = (result as { content: string }).content;
        if (selectedAsset.editable) {
          setFileBuffers((buffers) => ({ ...buffers, [selectedAsset.path]: content }));
        } else {
          setReadOnlyBuffers((buffers) => ({ ...buffers, [selectedAsset.path]: content }));
        }
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setConsoleOutput(error instanceof Error ? error.message : "Unable to load the selected asset.");
      })
      .finally(() => setLoadingAsset(false));
    return () => controller.abort();
  }, [fileBuffers, lab.id, readOnlyBuffers, selectedAsset]);

  useEffect(() => {
    if (!currentStep) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch(`/api/me/labs/${encodeURIComponent(lab.id)}/progress`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labVersion: lab.version,
          currentStepId: currentStep.id,
          fileBuffers,
        }),
        signal: controller.signal,
      }).then((response) => {
        if (!response.ok) setConsoleOutput("Progress could not be saved. Your current editor remains intact.");
      }).catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setConsoleOutput("Progress could not be saved. Your current editor remains intact.");
        }
      });
    }, 600);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [currentStep, fileBuffers, lab.id, lab.version]);

  if (!currentStep) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-center">
        <div>
          <h1 className="text-3xl font-bold">{lab.title}</h1>
          <p className="mt-3 text-muted-foreground">This lab does not yet have a learner workflow.</p>
        </div>
      </div>
    );
  }

  const updateCode = (value: string) => {
    if (selectedAsset?.editable) {
      setFileBuffers((buffers) => ({ ...buffers, [selectedAsset.path]: value }));
    } else if (!selectedAsset) {
      setStepCode(value);
    }
  };

  const loadMissingEditableFiles = async (): Promise<Record<string, string>> => {
    const workspace = { ...fileBuffers };
    await Promise.all(editableAssets.map(async (asset) => {
      if (workspace[asset.path] !== undefined) return;
      const response = await fetch(assetUrl(lab.id, asset.path));
      if (!response.ok) throw new Error(`Unable to load ${asset.path} (${response.status})`);
      const result: unknown = await response.json();
      if (!result || typeof result !== "object" || typeof (result as { content?: unknown }).content !== "string") {
        throw new Error(`Malformed content response for ${asset.path}`);
      }
      workspace[asset.path] = (result as { content: string }).content;
    }));
    setFileBuffers(workspace);
    return workspace;
  };

  const checkSolution = async () => {
    if (!hasAutomatedGrader || isChecking) return;
    setConsoleOutput("Checking workspace…");
    setIsSuccess(null);
    setIsChecking(true);

    try {
      const workspace = await loadMissingEditableFiles();
      const response = await fetch("/api/labs/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labId: lab.id,
          labVersion: lab.version,
          stepId: currentStep.id,
          stepVersion: currentStep.version,
          files: Object.entries(workspace).map(([path, content]) => ({ path, content })),
        }),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const code = result && typeof result === "object" && typeof (result as { error?: unknown }).error === "string"
          ? (result as { error: string }).error
          : `HTTP_${response.status}`;
        throw new Error(`The grader could not run: ${code}`);
      }
      if (!result || typeof result !== "object" || typeof (result as { success?: unknown }).success !== "boolean") {
        throw new Error("The grader returned a malformed response.");
      }

      const outcome = result as { success: boolean; hint?: string; progress?: LabProgressDto };
      setIsSuccess(outcome.success);
      setConsoleOutput(outcome.hint ?? (outcome.success ? "Correct!" : "The workspace needs another pass."));
      if (outcome.success) {
        if (!outcome.progress) throw new Error("The grader did not return canonical progress.");
        setCompletedSteps(outcome.progress.completedSteps);
        if (currentStepIndex < lab.steps.length - 1) {
          const nextIndex = currentStepIndex + 1;
          setCurrentStepIndex(nextIndex);
          setStepCode(lab.steps[nextIndex].starterCode);
        }
      }
    } catch (error) {
      setIsSuccess(false);
      setConsoleOutput(error instanceof Error ? error.message : "The grader could not run.");
    } finally {
      setIsChecking(false);
    }
  };

  const completeSelfAttestedStep = async () => {
    if (currentStep.completion !== "self_attested" || isCompleting) return;
    setIsCompleting(true);
    setIsSuccess(null);
    setConsoleOutput("Recording your completion…");
    try {
      const response = await fetch(`/api/me/labs/${encodeURIComponent(lab.id)}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labVersion: lab.version,
          stepId: currentStep.id,
          stepVersion: currentStep.version,
          completion: "self_attested",
        }),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const code = result && typeof result === "object" && typeof (result as { error?: unknown }).error === "string"
          ? (result as { error: string }).error
          : `HTTP_${response.status}`;
        throw new Error(`Completion could not be recorded: ${code}`);
      }
      if (!result || typeof result !== "object" || !Array.isArray((result as LabProgressDto).completedSteps)) {
        throw new Error("The completion response was malformed.");
      }
      const progress = result as LabProgressDto;
      setCompletedSteps(progress.completedSteps);
      setConsoleOutput(currentStepIndex === lab.steps.length - 1 ? "Lab completed." : "Step completed. Continue when ready.");
      setIsSuccess(true);
      if (currentStepIndex < lab.steps.length - 1) {
        const nextIndex = currentStepIndex + 1;
        setCurrentStepIndex(nextIndex);
        setStepCode(lab.steps[nextIndex].starterCode);
      }
    } catch (error) {
      setIsSuccess(false);
      setConsoleOutput(error instanceof Error ? error.message : "Completion could not be recorded.");
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="flex w-80 shrink-0 flex-col border-r border-border bg-secondary p-4 text-secondary-foreground">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{lab.owningModule}</p>
        <h1 className="mb-2 text-xl font-bold">{lab.title}</h1>
        <p className="mb-5 text-sm text-muted-foreground">{lab.description}</p>

        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide">Steps</h2>
        <ol className="space-y-2">
          {lab.steps.map((step, index) => (
            <li key={step.id} className={`rounded border px-3 py-2 text-sm ${currentStepIndex === index ? "border-primary bg-primary/10 font-semibold" : "border-border"}`}>
              <button
                type="button"
                className="w-full text-left"
                disabled={index > 0 && !completedSteps.includes(lab.steps[index - 1].id)}
                onClick={() => {
                  setCurrentStepIndex(index);
                  setStepCode(step.starterCode);
                }}
              >
                {step.title}
              </button>
            </li>
          ))}
        </ol>

        {assets.length > 0 && (
          <div className="mt-6">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide">Lab files</h2>
            <div className="space-y-1">
              {assets.map((asset) => (
                <button
                  key={asset.path}
                  type="button"
                  aria-pressed={selectedAssetPath === asset.path}
                  className={`w-full rounded border px-3 py-2 text-left text-sm ${selectedAssetPath === asset.path ? "border-primary bg-primary/10" : "border-border hover:bg-background"}`}
                  onClick={() => setSelectedAssetPath(asset.path)}
                >
                  <span className="block truncate font-medium">{asset.path}</span>
                  <span className="text-xs text-muted-foreground">{roleLabel[asset.role]} · {languageLabel[asset.language] ?? asset.language}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-border bg-card p-4 text-card-foreground">
          <Link href={moduleHref} className="mb-2 inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline">Back to module</Link>
          <h2 className="text-lg font-bold">{currentStep.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{currentStep.instructions}</p>
        </div>
        <div className="min-h-[520px] flex-1" aria-busy={loadingAsset}>
          <MonacoEditor
            height="100%"
            language={selectedAsset?.language ?? "systemverilog"}
            value={selectedContent}
            onChange={(value) => updateCode(value ?? "")}
            theme="vs-dark"
            options={{ minimap: { enabled: false }, readOnly: selectedAsset ? !selectedAsset.editable : false, wordWrap: "on" }}
          />
        </div>
        <div className="border-t border-border bg-muted p-4">
          {hasAutomatedGrader ? (
            <button type="button" onClick={checkSolution} disabled={isChecking} className="mb-4 rounded bg-primary px-4 py-2 font-bold text-primary-foreground disabled:opacity-60">
              {isChecking ? "Checking…" : "Check solution"}
            </button>
          ) : currentStep.completion === "self_attested" && !completedSteps.includes(currentStep.id) ? (
            <button type="button" onClick={completeSelfAttestedStep} disabled={isCompleting} className="mb-4 rounded bg-primary px-4 py-2 font-bold text-primary-foreground disabled:opacity-60">
              {isCompleting ? "Recording…" : currentStepIndex === lab.steps.length - 1 ? "Mark lab complete" : "Mark step complete & continue"}
            </button>
          ) : (
            <p className="text-sm text-muted-foreground">This step is complete. Your progress and workspace edits are saved.</p>
          )}
          <pre aria-live="polite" className={isSuccess === true ? "text-success" : isSuccess === false ? "text-destructive" : ""}>{consoleOutput}</pre>
          {simulatableAssets.length > 0 && (
            <CodeExecutionEnvironment prepareFiles={async () => {
              const workspace = await loadMissingEditableFiles();
              return simulatableAssets.map((asset) => ({
                path: asset.path,
                content: workspace[asset.path] ?? "",
              }));
            }} />
          )}
        </div>
      </main>
    </div>
  );
}
