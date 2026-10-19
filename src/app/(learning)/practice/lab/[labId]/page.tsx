import type { Metadata } from "next";
import { notFound } from "next/navigation";
import React from "react";

import { readLabFilesForBuild } from "@/lib/lab-assets";
import { toLabPolicyInput } from "@/lib/lab-progress-policy";
import { getAllLabs, getLabById, toLearnerLabDto } from "@/lib/lab-registry";
import { getLabBackLink, getLabLessons, getLabPrerequisites } from "@/lib/practice-links";

import LabClientPage from "./LabClientPage";

type LabPageProps = { params: { labId: string } };

/*
 * Every available lab is prerendered at build time and served as a static
 * page, like the lessons. The page needs no session: steps, editing, checks
 * and progress run in the browser (LabClientPage). The lab files are read
 * here, at build time only, and travel as props. dynamic = "error" makes the
 * build fail if anything would turn the route into a per-request render, and
 * dynamicParams = false answers 404 for unknown and coming-soon lab ids.
 */
export const dynamic = "error";
export const dynamicParams = false;

export function generateStaticParams(): Array<LabPageProps["params"]> {
  return getAllLabs()
    .filter((lab) => lab.status === "available")
    .map((lab) => ({ labId: lab.id }));
}

export function generateMetadata({ params }: LabPageProps): Metadata {
  const lab = getLabById(params.labId);
  if (!lab) return {};
  const canonical = `/practice/lab/${encodeURIComponent(lab.id)}`;
  return {
    title: lab.title,
    description: lab.description,
    alternates: { canonical },
    openGraph: { title: lab.title, description: lab.description, url: canonical },
  };
}

export default async function LabPage({ params }: LabPageProps) {
  const lab = getLabById(params.labId);
  if (!lab || lab.status !== "available") notFound();

  // Guide, starter and reference files, plus the solutions the client lists once the lab is complete.
  const { files, solutions } = await readLabFilesForBuild(lab);

  // Orientation comes from the practice map and the manifest order (src/lib/practice-links.ts):
  // the launching lesson for "Back to module", prerequisites, and "do this lab after" for forward ones.
  const { items, doAfter } = getLabPrerequisites(lab);

  return (
    <LabClientPage
      lab={toLearnerLabDto(lab)}
      policy={toLabPolicyInput(lab)}
      files={files}
      solutions={solutions}
      backLink={getLabBackLink(lab)}
      lessons={getLabLessons(lab)}
      prerequisites={{ items, doAfter }}
    />
  );
}
