import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { AuthenticationError, requireSession } from "@/lib/auth";
import { getLearnerLabAssets } from "@/lib/lab-assets";
import { getLabById, toLearnerLabDto } from "@/lib/lab-registry";
import { getLabBackLink, getLabLessons, getLabPrerequisites } from "@/lib/practice-links";
import { getLabProgress, labAccessService } from "@/server/labs";

import LabClientPage from "./LabClientPage";

type LabPageProps = { params: { labId: string } };

export const dynamic = "force-dynamic";

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

  try {
    const session = await requireSession();
    const access = await labAccessService.resolve(session.user.id, lab);
    const [assets, initialProgress] = await Promise.all([
      getLearnerLabAssets(lab, access),
      getLabProgress(session.user.id, lab),
    ]);

    // Orientation comes from the practice map and the manifest order (src/lib/practice-links.ts):
    // the launching lesson for "Back to module", prerequisites, and "do this lab after" for forward ones.
    const { items, doAfter } = getLabPrerequisites(lab);

    return (
      <LabClientPage
        lab={toLearnerLabDto(lab)}
        assets={assets}
        initialProgress={initialProgress}
        backLink={getLabBackLink(lab)}
        lessons={getLabLessons(lab)}
        prerequisites={{ items, doAfter }}
      />
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent(`/practice/lab/${lab.id}`)}`);
    }
    throw error;
  }
}
