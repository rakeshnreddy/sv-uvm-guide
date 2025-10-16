import React from "react";
import type { Metadata } from "next";
import Link from "next/link";

import { SystemVerilog3DVisualizer } from "@/components/curriculum/f2";

export const metadata: Metadata = {
  title: "SystemVerilog Data Structures 3D Explorer",
  description:
    "Walk through SystemVerilog dynamic arrays, queues, associative arrays, and packed layouts in an animated 3D environment.",
};

const SystemVerilog3DPage = () => {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 lg:px-8">
      <div className="space-y-3">
        <Link href="/curriculum/T1_Foundational/F2B_Dynamic_Structures/" className="text-sm text-muted-foreground hover:text-primary">
          ← Back to F2B lesson
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">SystemVerilog Data Structures 3D Explorer</h1>
        <p className="max-w-3xl text-base text-muted-foreground">
          This immersive view mirrors the interactive widgets from the F2B lesson. Rotate around dynamic arrays, queues, associative arrays,
          and packed/unpacked combinations to see head and tail markers, reserved capacity, hash collisions, and packed lane ordering at a
          glance.
        </p>
      </div>

      <SystemVerilog3DVisualizer />

      <div className="rounded-3xl border border-border/60 bg-muted/20 p-6 text-sm text-muted-foreground">
        <p>
          Ready to apply the concepts? Visit the <Link href="/practice/visualizations/uvm-architecture" className="text-primary underline">
            UVM Architecture Visualizer
          </Link>{" "}
          or the <Link href="/practice/visualizations/memory-hub" className="text-primary underline">Memory Hub</Link> to connect these data
          structures to full environments.
        </p>
      </div>
    </div>
  );
};

export default SystemVerilog3DPage;
