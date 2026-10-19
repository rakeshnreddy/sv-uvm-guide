import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LabLink } from '@/components/mdx/LabLink';
import type { LabManifest } from '@/lib/lab-manifest';
import { getAllLabs, getLabById, labCheckSummary, labProgressNote } from '@/lib/lab-registry';
import { __resetRecordsForTests } from '@/lib/learner-store/record';
import { labProgressRecords, labRecordId, type LabProgressRecord } from '@/lib/learner-store/repositories/labs';
import { __resetStorageForTests } from '@/lib/learner-store/storage';

/** An available lab whose module prerequisite (I-SV-1) is taught after its own module (F2D). */
const FORWARD_LAB: LabManifest = {
  id: 'synthetic-forward-lab',
  version: '1.0.0',
  title: 'Synthetic forward lab',
  description: 'A lab whose prerequisite comes later in the curriculum.',
  owningModule: 'F2D',
  routeSlug: 'synthetic-forward-lab',
  status: 'available',
  labPrerequisites: [],
  modulePrerequisites: ['I-SV-1'],
  steps: [],
  assets: [],
  assetLocation: 'labs/synthetic',
};

vi.mock('@/lib/lab-registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/lab-registry')>();
  return {
    ...actual,
    getLabById: (id: string) => (id === FORWARD_LAB.id ? FORWARD_LAB : actual.getLabById(id)),
  };
});

const PROGRESS_NOTE = 'Your progress is saved in this browser.';

function storedProgress(lab: LabManifest, overrides: Partial<LabProgressRecord> = {}): LabProgressRecord {
  return {
    labId: lab.id,
    labVersion: lab.version,
    currentStepId: lab.steps[1]?.id ?? null,
    completedSteps: lab.steps.slice(0, 1).map((step) => step.id),
    stepEvidence: {},
    fileBuffers: {},
    status: 'in_progress',
    startedAt: 1_000,
    updatedAt: 2_000,
    ...overrides,
  };
}

function resetLearnerStore() {
  __resetStorageForTests();
  __resetRecordsForTests();
  window.localStorage.clear();
}

beforeEach(() => {
  resetLearnerStore();
});

afterEach(() => {
  cleanup();
  resetLearnerStore();
});

describe('LabLink in a lesson', () => {
  it('launches an available lab with the e2e-pinned "Launch Lab" name, described by the progress note', () => {
    render(<LabLink labId="pss-portable-intent" />);
    expect(screen.getByRole('heading', { level: 4, name: 'Practice Lab: Memory Read/Write Portable Intent' })).toBeInTheDocument();
    const launch = screen.getByRole('link', { name: 'Launch Lab' });
    expect(launch).toHaveAttribute('href', '/practice/lab/pss-portable-intent');
    expect(launch).toHaveAccessibleDescription(PROGRESS_NOTE);
    expect(screen.queryByText('Coming soon')).not.toBeInTheDocument();
    expect(screen.getByTestId('lab-link')).not.toHaveTextContent(/sign[ -]in/i);
  });

  it('shows no progress badge until this browser holds progress on the lab', () => {
    render(<LabLink labId="pss-portable-intent" />);
    expect(screen.queryByTestId('lab-progress-badge')).not.toBeInTheDocument();
  });

  it('fills the badge slot beside the link with this browser\'s progress on the lab', () => {
    const lab = getLabById('pss-portable-intent')!;
    labProgressRecords.set(labRecordId(lab.id, lab.version), storedProgress(lab));
    render(<LabLink labId={lab.id} />);
    const callout = screen.getByTestId('lab-link');
    const badge = within(callout).getByTestId('lab-progress-badge');
    expect(badge).toHaveTextContent(`${lab.title}: In progress · step 2 of ${lab.steps.length}`);
    expect(within(badge).queryByRole('link')).not.toBeInTheDocument();
    // The badge sits next to the link and never becomes part of its description.
    const launch = screen.getByRole('link', { name: 'Launch Lab' });
    expect(launch.parentElement).toContainElement(badge);
    expect(launch).toHaveAccessibleDescription(PROGRESS_NOTE);
  });

  it('marks a lab completed in this browser', () => {
    const lab = getLabById('pss-portable-intent')!;
    labProgressRecords.set(
      labRecordId(lab.id, lab.version),
      storedProgress(lab, { status: 'completed', completedAt: 3_000, completedSteps: lab.steps.map((step) => step.id) }),
    );
    render(<LabLink labId={lab.id} />);
    expect(screen.getByTestId('lab-progress-badge')).toHaveTextContent('Completed');
  });

  it('renders a coming-soon lab as a "Coming soon" chip with no link to the lab (G30-PRAC-09)', () => {
    expect(getLabById('dma-1')?.status).toBe('coming_soon');
    render(<LabLink labId="dma-1" />);
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
    expect(screen.getByText('This lab is planned and cannot be opened yet.')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByText(PROGRESS_NOTE)).not.toBeInTheDocument();
    expect(screen.queryByTestId('lab-progress-badge')).not.toBeInTheDocument();
  });

  it('keeps lesson links but never links a coming-soon lab itself', () => {
    expect(getLabById('common-1')?.status).toBe('coming_soon');
    render(<LabLink labId="common-1" />);
    for (const link of screen.queryAllByRole('link')) {
      expect(link.getAttribute('href')).toMatch(/^\/curriculum\//);
    }
    expect(screen.queryByRole('link', { name: 'Launch Lab' })).not.toBeInTheDocument();
  });

  it('says "Do this lab after <lesson>" when a prerequisite is taught later', () => {
    render(<LabLink labId={FORWARD_LAB.id} />);
    expect(screen.getByText('Do this lab after')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /I-SV-1/ })).toHaveAttribute('href', '/curriculum/T2_Intermediate/I-SV-1_OOP/index');
    expect(screen.getByRole('link', { name: 'Launch Lab' })).toHaveAttribute('href', `/practice/lab/${FORWARD_LAB.id}`);
  });

  it('says nothing about order when every prerequisite comes first', () => {
    render(<LabLink labId="ipc-deadlock" />);
    expect(screen.queryByText('Do this lab after')).not.toBeInTheDocument();
  });

  it('gives each callout its own note id, so two on one page never share a description', () => {
    render(
      <>
        <LabLink labId="soc-vip-reuse" />
        <LabLink labId="soc-strategy-capstone" />
      </>,
    );
    const [first, second] = screen.getAllByRole('link', { name: 'Launch Lab' });
    expect(first.getAttribute('aria-describedby')).toBeTruthy();
    expect(first.getAttribute('aria-describedby')).not.toBe(second.getAttribute('aria-describedby'));
    expect(first).toHaveAccessibleDescription(PROGRESS_NOTE);
    expect(second).toHaveAccessibleDescription(PROGRESS_NOTE);
  });

  it('reports an unknown lab id to the author', () => {
    render(<LabLink labId="no-such-lab" />);
    expect(screen.getByText(/Lab mapping failed/)).toBeInTheDocument();
  });
});

describe('labProgressNote', () => {
  it('describes every available lab with where its progress lives, and nothing else', () => {
    for (const lab of getAllLabs()) {
      expect(labProgressNote(lab), lab.id).toBe(lab.status === 'available' ? PROGRESS_NOTE : null);
    }
    expect(labProgressNote({ status: 'available' })).toBe(PROGRESS_NOTE);
    expect(labProgressNote({ status: 'coming_soon' })).toBeNull();
    expect(labProgressNote({ status: 'archived' })).toBeNull();
  });
});

describe('labCheckSummary', () => {
  const graded = { completion: 'graded' as const };
  const selfChecked = { completion: 'self_attested' as const };

  it('calls a lab auto-checked only with a grader and at least one graded step', () => {
    expect(labCheckSummary({ graderId: 'sv-basics-v2', steps: [selfChecked, graded] })).toBe(
      'Auto-checked steps (structural, in your browser)',
    );
    expect(labCheckSummary({ graderId: 'sv-basics-v2', steps: [selfChecked] })).toBe(
      'Self-checked steps: you mark each one complete',
    );
    expect(labCheckSummary({ steps: [graded] })).toBe('Self-checked steps: you mark each one complete');
    expect(labCheckSummary({ steps: [] })).toBe('Self-checked steps: you mark each one complete');
  });

  it('matches the registry: basics-1 and simple-dut-1 are auto-checked, pss-portable-intent is self-checked', () => {
    expect(labCheckSummary(getLabById('basics-1')!)).toBe('Auto-checked steps (structural, in your browser)');
    expect(labCheckSummary(getLabById('simple-dut-1')!)).toBe('Auto-checked steps (structural, in your browser)');
    expect(labCheckSummary(getLabById('pss-portable-intent')!)).toBe('Self-checked steps: you mark each one complete');
  });
});
