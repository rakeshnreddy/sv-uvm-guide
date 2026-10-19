'use client';

import React from 'react';
import { CheckCircle2, CircleDashed } from 'lucide-react';

import { useKeyedRecord } from '@/lib/learner-store/react';
import { labProgressRecords, labRecordId, type LabProgressRecord } from '@/lib/learner-store/repositories/labs';
import { cn } from '@/lib/utils';

/**
 * The lab facts the badge needs, passed as props by a server component
 * (labBadgeProps in src/lib/lab-registry.ts). The badge never imports the lab
 * registry, so lesson, hub and home bundles stay free of it.
 */
export interface LabProgressBadgeProps {
  labId: string;
  version: string;
  stepCount: number;
  /** The lab's title, read by screen readers before the status. */
  title: string;
  /** Step ids in lab order; turns the stored current step into "step X of N". */
  stepIds?: readonly string[];
  className?: string;
}

/**
 * The 1-based step a learner is on, clamped to 1..stepCount. With step ids it
 * is the stored current step's position (the lab page reopens there); without
 * them, or when the current step is unknown, it is one past the completed
 * steps.
 */
export function labProgressStepNumber(
  record: Pick<LabProgressRecord, 'currentStepId' | 'completedSteps'>,
  stepCount: number,
  stepIds?: readonly string[],
): number {
  const index = stepIds && record.currentStepId ? stepIds.indexOf(record.currentStepId) : -1;
  const completed = stepIds
    ? record.completedSteps.filter((stepId) => stepIds.includes(stepId)).length
    : record.completedSteps.length;
  const step = index >= 0 ? index + 1 : completed + 1;
  return Math.min(Math.max(step, 1), Math.max(stepCount, 1));
}

/** The badge text: 'Completed', or 'In progress · step X of N' ('In progress' for a lab with no steps). */
export function labProgressLabel(
  record: Pick<LabProgressRecord, 'status' | 'currentStepId' | 'completedSteps'>,
  stepCount: number,
  stepIds?: readonly string[],
): string {
  if (record.status === 'completed') return 'Completed';
  if (stepCount <= 0) return 'In progress';
  return `In progress · step ${labProgressStepNumber(record, stepCount, stepIds)} of ${stepCount}`;
}

/**
 * Local progress on one lab version, as plain text (never a link). It shows
 * nothing during the server render, the hydrating render and whenever this
 * browser holds no record for the lab, so prerendered pages and hydration
 * always match; the status appears right after hydration and follows writes
 * from this tab and others.
 */
export function LabProgressBadge({ labId, version, stepCount, title, stepIds, className }: LabProgressBadgeProps) {
  const record = useKeyedRecord(labProgressRecords, labRecordId(labId, version));
  if (!record) return null;

  const completed = record.status === 'completed';
  const Icon = completed ? CheckCircle2 : CircleDashed;
  return (
    <p
      className={cn(
        'm-0 inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-semibold text-foreground',
        className,
      )}
      data-testid="lab-progress-badge"
      data-lab-progress={record.status}
    >
      <Icon aria-hidden="true" className={cn('h-3.5 w-3.5 shrink-0', completed ? 'text-primary' : 'text-muted-foreground')} />
      <span className="sr-only">{title}: </span>
      {labProgressLabel(record, stepCount, stepIds)}
    </p>
  );
}

export default LabProgressBadge;
