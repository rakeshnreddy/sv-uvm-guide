"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { LabMetadata } from "@/types/lab";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center">Loading editor...</div>,
});

type LabClientPageProps = {
  lab: LabMetadata;
};

const LabClientPage = ({ lab }: LabClientPageProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const hasSteps = lab.steps && lab.steps.length > 0;
  const [code, setCode] = useState(hasSteps ? lab.steps[0].starterCode : "");
  const [consoleOutput, setConsoleOutput] = useState("");
  const [isSuccess, setIsSuccess] = useState<boolean | null>(null);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  const checkSolution = async () => {
    if (!hasSteps) return;
    
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
        setCode(lab.steps[currentStep + 1].starterCode);
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
    <div className="flex h-screen">
      <div className="w-1/4 bg-secondary text-secondary-foreground p-4">
        <h2 className="text-xl font-bold mb-4">{lab.title}</h2>
        <ul>
          {lab.steps.map((step, index) => (
            <li
              key={step.id}
              className={`cursor-pointer ${
                currentStep === index ? "font-bold" : ""
              }`}
              onClick={() => {
                if (
                  completedSteps.includes(lab.steps[index - 1]?.id) ||
                  index === 0
                ) {
                  setCurrentStep(index);
                  setCode(lab.steps[index].starterCode);
                }
              }}
            >
              {step.title}
            </li>
          ))}
        </ul>
      </div>
      <div className="w-3/4 flex flex-col">
        <div className="p-4 bg-card text-card-foreground">
          <h3 className="text-lg font-bold">{lab.steps[currentStep].title}</h3>
          <p>{lab.steps[currentStep].instructions}</p>
        </div>
        <div className="flex-1">
          <MonacoEditor
            height="100%"
            language="systemverilog"
            value={code}
            onChange={(value) => setCode(value || "")}
            theme="vs-dark"
          />
        </div>
        <div className="h-1/4 bg-muted p-4">
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
        </div>
      </div>
    </div>
  );
};

export default LabClientPage;
