"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { LabAsset, LabMetadata } from "@/types/lab";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center">Loading editor...</div>,
});

type LabClientPageProps = {
  lab: LabMetadata;
  assets: LabAsset[];
};

const roleLabel: Record<LabAsset["role"], string> = {
  guide: "Guide",
  starter: "Starter",
  solution: "Solution",
  metadata: "Metadata",
  reference: "Reference",
};

const languageLabel: Record<string, string> = {
  c: "C",
  json: "JSON",
  markdown: "Markdown",
  pss: "PSS",
  systemverilog: "SystemVerilog",
};

const LabClientPage = ({ lab, assets }: LabClientPageProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const hasSteps = lab.steps && lab.steps.length > 0;
  const firstStarterAsset = assets.find((asset) => asset.role === "starter");
  const [selectedAssetPath, setSelectedAssetPath] = useState<string | null>(firstStarterAsset?.path ?? null);
  const [fileBuffers, setFileBuffers] = useState<Record<string, string>>(() =>
    Object.fromEntries(assets.map((asset) => [asset.path, asset.content])),
  );
  const selectedAsset = assets.find((asset) => asset.path === selectedAssetPath) ?? null;
  const [stepCode, setStepCode] = useState(hasSteps ? lab.steps[0].starterCode : "");
  const code = selectedAsset ? fileBuffers[selectedAsset.path] ?? selectedAsset.content : stepCode;
  const hasAutomatedGrader = lab.graderType !== "custom" && lab.graderType !== "none";
  const [consoleOutput, setConsoleOutput] = useState("");
  const [isSuccess, setIsSuccess] = useState<boolean | null>(null);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const moduleHref = lab.moduleHref ?? "/curriculum";

  const updateCode = (value: string) => {
    if (selectedAsset) {
      setFileBuffers((current) => ({
        ...current,
        [selectedAsset.path]: value,
      }));
      return;
    }

    setStepCode(value);
  };

  const checkSolution = async () => {
    if (!hasSteps || !hasAutomatedGrader) return;
    
    setConsoleOutput("Checking solution...");
    setIsSuccess(null);
    const response = await fetch("/api/labs/run", {
      method: "POST",
      body: JSON.stringify({
        code,
        labId: lab.id,
        stepId: lab.steps[currentStep].id,
      }),
    });
    const result = await response.json();
    setIsSuccess(result.success);
    setConsoleOutput(
      result.hint || (result.success ? "Correct!" : "Incorrect."),
    );
    if (result.success) {
      setCompletedSteps([...completedSteps, lab.steps[currentStep].id]);
      if (currentStep < lab.steps.length - 1) {
        setCurrentStep(currentStep + 1);
        if (!selectedAsset) {
          setStepCode(lab.steps[currentStep + 1].starterCode);
        }
      }
    }
  };

  if (!hasSteps) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">{lab.title}</h1>
          <p className="text-muted-foreground">This lab is currently under construction. Please check back later!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="flex w-80 shrink-0 flex-col border-r border-border bg-secondary p-4 text-secondary-foreground">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{lab.owningModule}</p>
        <h2 className="mb-2 text-xl font-bold">{lab.title}</h2>
        <p className="mb-5 text-sm text-muted-foreground">{lab.description}</p>

        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide">Steps</h3>
        <ol className="space-y-2">
          {lab.steps.map((step, index) => (
            <li
              key={step.id}
              className={`rounded border px-3 py-2 text-sm transition ${
                currentStep === index ? "border-primary bg-primary/10 font-semibold" : "border-border"
              }`}
            >
              <button
                type="button"
                className="w-full text-left"
                onClick={() => {
                  if (
                    completedSteps.includes(lab.steps[index - 1]?.id) ||
                    index === 0
                  ) {
                    setCurrentStep(index);
                    setSelectedAssetPath(firstStarterAsset?.path ?? null);
                    if (!firstStarterAsset) {
                      setStepCode(lab.steps[index].starterCode);
                    }
                  }
                }}
              >
                {step.title}
              </button>
            </li>
          ))}
        </ol>

        {assets.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide">Lab Files</h3>
            <div className="space-y-1">
              {assets.map((asset) => (
                <button
                  key={asset.path}
                  type="button"
                  aria-pressed={selectedAssetPath === asset.path}
                  className={`w-full rounded border px-3 py-2 text-left text-sm transition ${
                    selectedAssetPath === asset.path ? "border-primary bg-primary/10" : "border-border hover:bg-background"
                  }`}
                  onClick={() => setSelectedAssetPath(asset.path)}
                >
                  <span className="block truncate font-medium">{asset.path}</span>
                  <span className="text-xs text-muted-foreground">
                    {roleLabel[asset.role]} · {languageLabel[asset.language] ?? asset.language}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-border bg-card p-4 text-card-foreground">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Link
                href={moduleHref}
                className="mb-2 inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Back to Module
              </Link>
              <h3 className="text-lg font-bold">{lab.steps[currentStep].title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{lab.steps[currentStep].instructions}</p>
            </div>
            {selectedAsset && (
              <div className="rounded border border-border px-3 py-2 text-right text-xs text-muted-foreground">
                <div className="font-semibold text-foreground">{selectedAsset.fileName}</div>
                <div>{roleLabel[selectedAsset.role]} · {languageLabel[selectedAsset.language] ?? selectedAsset.language}</div>
              </div>
            )}
          </div>
        </div>
        <div className="min-h-[520px] flex-1">
          <MonacoEditor
            height="100%"
            language={selectedAsset?.language ?? "systemverilog"}
            value={code}
            onChange={(value) => updateCode(value || "")}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              readOnly: selectedAsset ? !selectedAsset.editable : false,
              wordWrap: "on",
            }}
          />
        </div>
        <div className="border-t border-border bg-muted p-4">
          {hasAutomatedGrader ? (
            <>
              <button
                onClick={checkSolution}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2 px-4 rounded mb-4"
              >
                Check Solution
              </button>
              <pre
                className={`text-white ${
                  isSuccess === true
                    ? "text-success"
                    : isSuccess === false
                      ? "text-destructive"
                      : ""
                }`}
              >
                {consoleOutput}
              </pre>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              This lab is reviewed by comparing your starter edits with the solution and generated target files.
            </p>
          )}
        </div>
      </main>
    </div>
  );
};

export default LabClientPage;
