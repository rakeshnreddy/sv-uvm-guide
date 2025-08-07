"use client";
import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import Link from "next/link";

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
    name: "Inheritance Resolution",
    description:
      "Factory resolves final type, applying overrides and reporting conflicts if multiple overrides match.",
  },
];

const debuggingTips = [
  {
    tip: "Call `uvm_factory::print()` to inspect registered overrides.",
    href: "/docs/T4_Expert/E3_Advanced_Debugging",
  },
  {
    tip: "Ensure overrides are applied before the build phase.",
    href: "/docs/T3_Advanced/A3_Config_and_Factory_Mastery",
  },
  {
    tip: "Verify instance paths when setting instance overrides.",
    href: "/docs/T3_Advanced/A3_Config_and_Factory_Mastery#instance-overrides",
  },
];

const performanceTips = [
  {
    tip: "Seal the factory after build phase to cache lookups.",
    href: "/docs/T4_Expert/E1_UVM_Performance_Optimization#factory-seal",
  },
  {
    tip: "Avoid unnecessary overrides to reduce lookup overhead.",
    href: "/docs/T4_Expert/E1_UVM_Performance_Optimization",
  },
];

interface NodeInfo {
  id: string;
  label: string;
  x: number;
  y: number;
  step: number;
}

interface EdgeInfo {
  from: string;
  to: string;
  step: number;
  dashed?: boolean;
  conflict?: boolean;
}

const nodeData: NodeInfo[] = [
  { id: "reg", label: "Register", x: 80, y: 100, step: 0 },
  { id: "type", label: "Type Override", x: 260, y: 100, step: 1 },
  { id: "inst", label: "Instance Override", x: 440, y: 100, step: 2 },
  {
    id: "inherit",
    label: "Inheritance\nResolution",
    x: 620,
    y: 100,
    step: 3,
  },
  { id: "conflict", label: "Conflict", x: 360, y: 180, step: 2 },
];

const edges: EdgeInfo[] = [
  { from: "reg", to: "type", step: 0 },
  { from: "type", to: "inst", step: 1 },
  { from: "type", to: "inherit", step: 2, dashed: true },
  { from: "inst", to: "inherit", step: 2 },
  { from: "type", to: "conflict", step: 2, conflict: true },
  { from: "inst", to: "conflict", step: 2, conflict: true },
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
        <div className="flex flex-col gap-6 lg:flex-row">
          <div ref={diagramRef} className="flex-1">
            <svg
              width={700}
              height={220}
              viewBox="0 0 700 220"
              className="mx-auto"
              role="img"
              aria-label="UVM factory workflow diagram"
            >
              {edges.map((edge) => {
                const from = nodeData.find((n) => n.id === edge.from)!;
                const to = nodeData.find((n) => n.id === edge.to)!;
                const active = currentStep >= edge.step;
                const stroke = edge.conflict
                  ? active
                    ? "#dc2626"
                    : "#94a3b8"
                  : active
                  ? "#2563eb"
                  : "#94a3b8";
                const marker = edge.conflict
                  ? active
                    ? "url(#arrow-red)"
                    : "url(#arrow-grey)"
                  : active
                  ? "url(#arrow-blue)"
                  : "url(#arrow-grey)";
                return (
                  <motion.line
                    key={edge.from + edge.to}
                    x1={from.x + 40}
                    y1={from.y}
                    x2={to.x - 40}
                    y2={to.y}
                    stroke={edge.dashed ? "#94a3b8" : stroke}
                    strokeDasharray={edge.dashed || edge.conflict ? "4 4" : undefined}
                    strokeWidth={2}
                    markerEnd={edge.dashed ? "url(#arrow-grey)" : marker}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: active ? 1 : 0 }}
                  />
                );
              })}

              {nodeData.map((node) => {
                const active = currentStep >= node.step;
                const stroke = node.id === "conflict" ? "#dc2626" : "#2563eb";
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
                      stroke={active ? stroke : "#94a3b8"}
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
                y={180}
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
                <marker
                  id="arrow-red"
                  markerWidth="10"
                  markerHeight="7"
                  refX="9"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3.5, 0 7" fill="#dc2626" />
                </marker>
              </defs>
            </svg>

            <p className="mb-4 mt-4 text-sm text-center">{steps[currentStep].description}</p>

            <div className="flex justify-between mb-6">
              <Button onClick={handlePrev} disabled={currentStep === 0}>
                Previous
              </Button>
              <Button onClick={handleNext} disabled={currentStep === steps.length - 1}>
                Next
              </Button>
            </div>
          </div>

          <aside className="lg:w-64">
            <div className="mb-6">
              <h4 className="font-semibold mb-2">Debugging Tips</h4>
              <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                {debuggingTips.map((tip) => (
                  <li key={tip.tip}>
                    <Link href={tip.href} className="underline">
                      {tip.tip}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Performance Considerations</h4>
              <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                {performanceTips.map((tip) => (
                  <li key={tip.tip}>
                    <Link href={tip.href} className="underline">
                      {tip.tip}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </CardContent>
    </Card>
  );
};

export default UvmFactoryWorkflowVisualizer;

