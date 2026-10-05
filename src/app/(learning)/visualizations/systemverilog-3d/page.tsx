import React, { Suspense } from "react";
import type { Metadata } from "next";

import SystemVerilog3DVisualizer from "@/components/curriculum/f2/SystemVerilog3DVisualizer";
import LearnInLesson from "@/components/practice/LearnInLesson";
import { requirePracticePage } from "@/lib/practice-links";

const HREF = "/visualizations/systemverilog-3d";
const practice = requirePracticePage(HREF);

export const metadata: Metadata = {
  title: practice.title,
  description:
    "Model-driven sandbox for SystemVerilog dynamic arrays, queues, associative arrays and packed/unpacked index order, in 3D with an equivalent 2D view.",
};

export default function SystemVerilog3DVisualizationPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Rendered on the server: only the sandbox reads the ?scene= parameter, so only it waits for the client. */}
      <div className="container mx-auto px-4 pt-6">
        <h1 className="text-2xl font-semibold text-foreground">SystemVerilog array sandbox</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Run real array, queue and associative-array operations and see the resulting state in 3D or as text.
        </p>
        {/* "Learn this in": the lesson that teaches these structures, from the practice map (G30-PRAC-02). */}
        <LearnInLesson item={practice} className="mb-4 mt-4" />
      </div>
      <Suspense
        fallback={
          <div className="container mx-auto px-4 py-4" aria-hidden="true">
            <div className="h-96 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
          </div>
        }
      >
        <SystemVerilog3DVisualizer height="calc(100vh - 10rem)" />
      </Suspense>
    </div>
  );
}
