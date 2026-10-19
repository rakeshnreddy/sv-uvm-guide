"use client";

import { Download, FileText } from "lucide-react";
import React, { useId, useState } from "react";

import { downloadBlob } from "@/lib/download";
import { cn } from "@/lib/utils";
import { createZipBlob, type ZipEntry } from "@/lib/zip-store";
import type { LabFileDto } from "@/types/lab";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export const labActionButtonClass = cn(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60",
  focusRing,
);

/** `<labId>-v<version>-workspace.zip` */
export function labWorkspaceZipName(labId: string, version: string): string {
  return `${labId}-v${version}-workspace.zip`;
}

export interface LabWorkspaceArchive {
  labId: string;
  version: string;
  /** The editable files as the learner has them now. */
  editableBuffers: Readonly<Record<string, string>>;
  /** Read-only files (guide, reference and read-only starters) from the page props. */
  readOnlyFiles: readonly Pick<LabFileDto, "path" | "content">[];
  /** Solutions, once revealed; empty otherwise. */
  solutions?: readonly Pick<LabFileDto, "path" | "content">[];
}

/** The archive's entries, all inside one `<labId>-v<version>/` folder. */
export function labWorkspaceEntries(archive: LabWorkspaceArchive): ZipEntry[] {
  const folder = `${archive.labId}-v${archive.version}`;
  const entries = new Map<string, string>();
  for (const file of archive.readOnlyFiles) entries.set(file.path, file.content);
  for (const [path, content] of Object.entries(archive.editableBuffers)) entries.set(path, content);
  for (const file of archive.solutions ?? []) {
    if (!entries.has(file.path)) entries.set(file.path, file.content);
  }
  return [...entries.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, content]) => ({ path: `${folder}/${path}`, content }));
}

/** Builds the workspace ZIP and starts the download. Returns false when this browser cannot download files. */
export function downloadLabWorkspace(archive: LabWorkspaceArchive): boolean {
  try {
    return downloadBlob(createZipBlob(labWorkspaceEntries(archive)), labWorkspaceZipName(archive.labId, archive.version));
  } catch {
    return false;
  }
}

/** The guide's section on running the lab ("Running the lab", "Run it", "How to run it"), or null. */
export function findRunSectionHeading(markdown: string): string | null {
  for (const line of markdown.split(/\r?\n/)) {
    const match = /^#{2,3}\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) continue;
    const heading = match[1].replace(/[*_`]/g, "").trim();
    if (/^step\b/i.test(heading)) continue;
    if (/\b(run|running)\b/i.test(heading)) return heading;
  }
  return null;
}

export interface LabRunLocallyProps {
  archive: LabWorkspaceArchive;
  /** The lab guide (README), for pointing at its run section. */
  guide?: Pick<LabFileDto, "path" | "content"> | null;
  /** Shows the guide in the editor. */
  onOpenGuide?: () => void;
  className?: string;
}

/**
 * Shown instead of the simulation panel when the simulator service is not
 * available (always on the anonymous deploy): the learner downloads the
 * workspace and runs it with their own simulator, using the guide's commands.
 */
export function LabRunLocally({ archive, guide, onOpenGuide, className }: LabRunLocallyProps) {
  const headingId = useId();
  const [status, setStatus] = useState<string | null>(null);
  const runSection = guide ? findRunSectionHeading(guide.content) : null;
  const guideName = guide?.path ?? "README.md";

  const download = () => {
    const started = downloadLabWorkspace(archive);
    setStatus(
      started
        ? `Downloaded ${labWorkspaceZipName(archive.labId, archive.version)}.`
        : "This browser could not start the download.",
    );
  };

  return (
    <section
      aria-labelledby={headingId}
      className={cn("mt-4 rounded-lg border border-border bg-card p-4 text-card-foreground", className)}
    >
      <h2 id={headingId} className="text-base font-bold">Run it on your simulator</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        This site does not compile or simulate your code. Download the workspace, unzip it, and run it with your
        own SystemVerilog simulator.
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {runSection ? (
          <>
            The lab guide ({guideName}) lists the commands in <span className="font-semibold text-foreground">“{runSection}”</span>.
          </>
        ) : (
          <>The lab guide ({guideName}) explains how to run it.</>
        )}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={download} className={labActionButtonClass}>
          <Download aria-hidden="true" className="h-4 w-4" />
          Download workspace (.zip)
        </button>
        {guide && onOpenGuide ? (
          <button type="button" onClick={onOpenGuide} className={labActionButtonClass}>
            <FileText aria-hidden="true" className="h-4 w-4" />
            Open the guide
          </button>
        ) : null}
      </div>
      <p role="status" aria-live="polite" className="mt-2 text-xs text-muted-foreground">
        {status}
      </p>
    </section>
  );
}

export default LabRunLocally;
