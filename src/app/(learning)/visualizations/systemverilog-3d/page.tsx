import React, { Suspense } from "react";
import type { Metadata } from "next";

import SystemVerilog3DVisualizer from "@/components/curriculum/f2/SystemVerilog3DVisualizer";

export const metadata: Metadata = {
  title: "SystemVerilog 3D Data Structure Explorer",
  description:
    "Interactive 3D visualization of SystemVerilog data structures including dynamic arrays, queues, associative arrays, and packed/unpacked memory layouts.",
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
        <SystemVerilog3DVisualizer height="calc(100vh - 6rem)" />
      </Suspense>
    </div>
  );
}
