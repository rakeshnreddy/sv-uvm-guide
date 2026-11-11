import React, { Suspense } from "react";
import type { Metadata } from "next";

import SystemVerilog3DVisualizer from "@/components/curriculum/f2/SystemVerilog3DVisualizer";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import LearnInLesson from "@/components/practice/LearnInLesson";
import { PracticePager } from "@/components/practice/PracticePager";
import { practiceBreadcrumbs, requirePracticePage, requirePracticePager } from "@/lib/practice-links";

const HREF = "/visualizations/systemverilog-3d";
const practice = requirePracticePage(HREF);

export const metadata: Metadata = {
  title: practice.title,
  description:
    "Model-driven sandbox for SystemVerilog dynamic arrays, queues, associative arrays and packed/unpacked index order, in 3D with an equivalent 2D view.",
};

export default function SystemVerilog3DVisualizationPage() {
  return (
    // One container for the header and the sandbox, so their edges line up.
    <div className="mx-auto w-full max-w-6xl pb-8">
      <Breadcrumbs items={practiceBreadcrumbs(practice)} className="-mt-2 mb-4" />
      {/* Rendered on the server: only the sandbox reads the ?scene= parameter, so only it waits for the client. */}
      <header data-testid="sv3d-header">
        <h1 className="text-h1 text-foreground">{practice.title}</h1>
        <p className="mt-2 max-w-2xl text-lead text-muted-foreground">
          Run real array, queue and associative-array operations and see the resulting state in 3D or as text.
        </p>
        {/* "Learn this in": the lesson that teaches these structures, from the practice map (G30-PRAC-02). */}
        <LearnInLesson item={practice} className="mb-4 mt-4" />
      </header>
      <Suspense
        fallback={
          <div className="py-4" aria-hidden="true">
            <div className="h-96 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
          </div>
        }
      >
        <SystemVerilog3DVisualizer height="calc(100vh - 10rem)" />
      </Suspense>
      <PracticePager pager={requirePracticePager(HREF)} className="mt-12" />
    </div>
  );
}
