import React, { useId } from 'react';
import Link from 'next/link';
import { Beaker } from 'lucide-react';

import { LabPrerequisiteList } from '@/components/practice/LearnInLesson';
import type { LabManifest } from '@/lib/lab-manifest';
import { getLabById, labRequiresSignIn } from '@/lib/lab-registry';
import { getLabPrerequisites } from '@/lib/practice-links';
import { cn } from '@/lib/utils';

interface LabLinkProps {
  labId: string;
}

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/** Why a lab cannot be opened, as a chip. Archived labs are kept for old links only. */
const UNAVAILABLE_LABELS: Readonly<Record<Exclude<LabManifest['status'], 'available'>, { chip: string; note: string }>> = {
  coming_soon: { chip: 'Coming soon', note: 'This lab is planned and cannot be opened yet.' },
  archived: { chip: 'Retired', note: 'This lab is no longer offered.' },
};

/**
 * A lab callout inside a lesson (`<LabLink labId="…" />` in MDX):
 * - an available lab gets "Launch Lab" (the link name is pinned by
 *   learner-flow.spec), described by a note that the lab needs sign-in
 *   (G30-PRAC-10; see labRequiresSignIn);
 * - a coming-soon lab gets a "Coming soon" chip and no link, because the lab
 *   route answers 404 for it (G30-PRAC-09);
 * - "Do this lab after <lesson>" appears when a prerequisite is taught later
 *   than the lab's own lesson (getLabPrerequisites, the same rule as the lab
 *   page and the Practice Hub).
 */
export const LabLink = ({ labId }: LabLinkProps) => {
  const noteId = useId();
  const lab = getLabById(labId);

  if (!lab) {
    return (
      <div className="my-6 p-4 border border-red-500 bg-red-50 rounded-md text-red-700">
        <strong>Error:</strong> Lab mapping failed for ID <code>{labId}</code>.
      </div>
    );
  }

  // Null for an available lab; otherwise why it cannot be opened.
  const unavailable = lab.status === 'available' ? null : UNAVAILABLE_LABELS[lab.status];
  const signIn = labRequiresSignIn(lab);
  const { doAfter } = getLabPrerequisites(lab);

  return (
    <div
      className="not-prose my-6 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm"
      data-testid="lab-link"
      data-lab-status={lab.status}
    >
      <div className="flex items-start gap-3">
        <Beaker aria-hidden="true" className="mt-1 h-6 w-6 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <h4 className="m-0 text-lg font-bold text-foreground [overflow-wrap:anywhere]">Practice Lab: {lab.title}</h4>
          <p className="mb-0 mt-1 text-sm text-muted-foreground">{lab.description}</p>
          {doAfter ? <LabPrerequisiteList prerequisites={{ items: [], doAfter }} className="mt-3" /> : null}
          {unavailable === null ? (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <Link
                href={`/practice/lab/${lab.id}`}
                aria-describedby={signIn ? noteId : undefined}
                className={cn(
                  'inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground no-underline transition-colors hover:bg-primary/90 motion-reduce:transition-none',
                  focusRing,
                )}
              >
                Launch Lab
              </Link>
              {signIn ? (
                <p id={noteId} className="m-0 text-xs text-muted-foreground">
                  Sign in required: the lab saves your progress to your account.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mb-0 mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center rounded-full border border-dashed border-border px-3 py-1 text-xs font-semibold uppercase tracking-wide text-foreground">
                {unavailable.chip}
              </span>
              <span>{unavailable.note}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
