import React, { Suspense } from "react";
import type { Metadata } from "next";

import SystemVerilog3DVisualizer from "@/components/curriculum/f2/SystemVerilog3DVisualizer";

export const metadata: Metadata = {
  title: "SystemVerilog 3D Data Structure Explorer",
  description:
    "Model-driven sandbox for SystemVerilog dynamic arrays, queues, associative arrays and packed/unpacked index order, in 3D with an equivalent 2D view.",
};

export default function SystemVerilog3DVisualizationPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <Suspense
        fallback={
          <div className="container mx-auto px-4 py-8">
            <div className="animate-pulse">
              <div className="mb-4 h-8 w-1/3 rounded bg-muted"></div>
              <div className="mb-8 h-4 w-2/3 rounded bg-muted"></div>
              <div className="h-96 rounded bg-muted"></div>
            </div>
          </div>
        }
      >
        <div className="container mx-auto px-4 pt-6">
          <h1 className="text-2xl font-semibold text-slate-100">SystemVerilog array sandbox</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Run real array, queue and associative-array operations and see the resulting state in 3D or as text.
          </p>
        </div>
        <SystemVerilog3DVisualizer height="calc(100vh - 10rem)" />
      </Suspense>
    </div>
  );
}
