"use client";

import React, { useState } from "react";
import Editor from "@monaco-editor/react";

const labData = {
  id: "1",
  title: "My First Lab",
  steps: [
    {
      id: "1",
      title: "Step 1: Declare a variable",
      instructions: "Declare a variable named 'myVar' of type 'int'.",
      starterCode: "// Your code here",
    },
    {
      id: "2",
      title: "Step 2: Assign a value",
      instructions: "Assign the value 10 to the variable 'myVar'.",
      starterCode: "int myVar;",
    },
  ],
};

type LabClientPageProps = {
  lab: typeof labData;
};

const LabClientPage = ({ lab }: LabClientPageProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [code, setCode] = useState(lab.steps[0].starterCode);
  const [consoleOutput, setConsoleOutput] = useState("");
  const [isSuccess, setIsSuccess] = useState<boolean | null>(null);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  const checkSolution = async () => {
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
          <Editor
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
