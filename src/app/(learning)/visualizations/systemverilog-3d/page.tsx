import React, { Suspense } from "react";
import type { Metadata } from "next";

import SystemVerilog3DVisualizer from "@/components/curriculum/f2/SystemVerilog3DVisualizer";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageShell } from "@/components/layout/PageShell";
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
    // One width for the header and the sandbox, from the page frame's left edge.
    <PageShell width="content">
      {/* Rendered on the server: only the sandbox reads the ?scene= parameter, so only it waits for the client. */}
      <PageHeader
        data-testid="sv3d-header"
        breadcrumbs={practiceBreadcrumbs(practice)}
        title={practice.title}
        lead="Run real array, queue and associative-array operations and see the resulting state in 3D or as text."
      />
      {/* "Learn this in": the lesson that teaches these structures, from the practice map (G30-PRAC-02). */}
      <LearnInLesson item={practice} className="mb-6" />
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
    </PageShell>
  );
}
