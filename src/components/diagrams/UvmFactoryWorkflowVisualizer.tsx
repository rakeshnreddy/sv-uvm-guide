"use client";
import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

interface StepInfo {
  name: string;
  description: string;
}

const steps: StepInfo[] = [
  {
    name: "Registration",
    description:
      "Components register types with the factory using `uvm_component_utils` or `uvm_object_utils`.",
  },
  {
    name: "Type Override",
    description: "Factory checks for type overrides and uses the override if present.",
  },
  {
    name: "Instance Override",
    description:
      "Instance-specific overrides are checked and take priority over type overrides.",
  },
  {
    name: "Resolution",
    description: "Factory creates and returns the final resolved type.",
  },
];

const debuggingTips = [
  "Call `uvm_factory::print()` to inspect registered overrides.",
  "Ensure overrides are applied before the build phase.",
  "Verify instance paths when setting instance overrides.",
];

const nodeData = [
  { id: "reg", label: "Register", x: 60, y: 100 },
  { id: "type", label: "Type Override", x: 240, y: 100 },
  { id: "inst", label: "Instance Override", x: 420, y: 100 },
  { id: "final", label: "Final Type", x: 600, y: 100 },
];

const edges = [
  { from: "reg", to: "type" },
  { from: "type", to: "inst" },
  { from: "type", to: "final", dashed: true },
  { from: "inst", to: "final" },
];

const UvmFactoryWorkflowVisualizer: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const diagramRef = useRef<HTMLDivElement>(null);

  const handleNext = () => setCurrentStep((s) => Math.min(s + 1, steps.length - 1));
  const handlePrev = () => setCurrentStep((s) => Math.max(s - 1, 0));

  const exportImage = async () => {
    if (!diagramRef.current) return;
    const svg = diagramRef.current.querySelector("svg");
    if (!svg) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const img = new Image();
    const svgBlob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = svg.clientWidth;
      canvas.height = svg.clientHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const png = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.download = "uvm-factory-workflow.png";
        link.href = png;
        link.click();
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex justify-between items-center">
        <CardTitle>UVM Factory Workflow</CardTitle>
        <Button variant="outline" onClick={exportImage}>
          Export Image
        </Button>
      </CardHeader>
      <CardContent>
        <div ref={diagramRef} className="mb-4">
          <svg
            width={660}
            height={200}
            viewBox="0 0 660 200"
            className="mx-auto"
            role="img"
            aria-label="UVM factory workflow diagram"
          >
            {edges.map((edge, index) => {
              const from = nodeData.find((n) => n.id === edge.from)!;
              const to = nodeData.find((n) => n.id === edge.to)!;
              const active = index <= currentStep;
              const stroke = active ? "#2563eb" : "#94a3b8";
              const marker = active ? "url(#arrow-blue)" : "url(#arrow-grey)";
              return (
                <motion.line
                  key={edge.from + edge.to}
                  x1={from.x + 40}
                  y1={from.y}
                  x2={to.x - 40}
                  y2={to.y}
                  stroke={edge.dashed ? "#94a3b8" : stroke}
                  strokeDasharray={edge.dashed ? "4 4" : undefined}
                  strokeWidth={2}
                  markerEnd={edge.dashed ? "url(#arrow-grey)" : marker}
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: active ? 1 : 0 }}
                />
              );
            })}

            {nodeData.map((node, index) => {
              const active = currentStep >= index;
              return (
                <motion.g
                  key={node.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: active ? 1 : 0.3 }}
                >
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={40}
                    fill="white"
                    stroke={active ? "#2563eb" : "#94a3b8"}
                    strokeWidth={2}
                  />
                  <text
                    x={node.x}
                    y={node.y}
                    textAnchor="middle"
                    dy="0.3em"
                    className="text-xs"
                  >
                    {node.label}
                  </text>
                </motion.g>
              );
            })}

            <text
              x={350}
              y={150}
              textAnchor="middle"
              className="text-xs fill-muted-foreground"
            >
              Instance overrides take priority over type overrides
            </text>

            <defs>
              <marker
                id="arrow-blue"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#2563eb" />
              </marker>
              <marker
                id="arrow-grey"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
              </marker>
            </defs>
          </svg>
        </div>

        <p className="mb-4 text-sm">{steps[currentStep].description}</p>

        <div className="flex justify-between mb-6">
          <Button onClick={handlePrev} disabled={currentStep === 0}>
            Previous
          </Button>
          <Button onClick={handleNext} disabled={currentStep === steps.length - 1}>
            Next
          </Button>
        </div>

        <div>
          <h4 className="font-semibold mb-2">Debugging Tips</h4>
          <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
            {debuggingTips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default UvmFactoryWorkflowVisualizer;

