import fs from 'node:fs';
import path from 'node:path';

import React from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  LabProgressBadge,
  labProgressLabel,
  labProgressStepNumber,
  type LabProgressBadgeProps,
} from '@/components/practice/LabProgressBadge';
import { __resetRecordsForTests } from '@/lib/learner-store/record';
import { labProgressRecords, labRecordId, type LabProgressRecord } from '@/lib/learner-store/repositories/labs';
import { __resetStorageForTests } from '@/lib/learner-store/storage';

const BADGE: LabProgressBadgeProps = {
  labId: 'synthetic-badge-lab',
  version: '2',
  stepCount: 4,
  title: 'Synthetic badge lab',
  stepIds: ['run-starter', 'write-task', 'call-task', 'self-check'],
};

const RECORD_ID = labRecordId(BADGE.labId, BADGE.version);

function progress(overrides: Partial<LabProgressRecord> = {}): LabProgressRecord {
  return {
    labId: BADGE.labId,
    labVersion: BADGE.version,
    currentStepId: 'call-task',
    completedSteps: ['run-starter', 'write-task'],
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

describe('LabProgressBadge', () => {
  let roots: Root[] = [];

  beforeEach(() => {
    resetLearnerStore();
    roots = [];
  });

  afterEach(() => {
    act(() => roots.forEach((root) => root.unmount()));
    cleanup();
    document.body.innerHTML = '';
    resetLearnerStore();
  });

  it('renders nothing when this browser holds no record for the lab', () => {
    const { container } = render(<LabProgressBadge {...BADGE} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for a record of another version of the lab', () => {
    labProgressRecords.set(labRecordId(BADGE.labId, '1'), progress({ labVersion: '1' }));
    const { container } = render(<LabProgressBadge {...BADGE} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing in the server render, even with a stored record', () => {
    labProgressRecords.set(RECORD_ID, progress());
    expect(renderToString(<LabProgressBadge {...BADGE} />)).toBe('');
  });

  it('shows the current step of a lab in progress as plain text, with the lab title for screen readers', () => {
    labProgressRecords.set(RECORD_ID, progress());
    render(<LabProgressBadge {...BADGE} />);
    const badge = screen.getByTestId('lab-progress-badge');
    expect(badge).toHaveTextContent('Synthetic badge lab: In progress · step 3 of 4');
    expect(badge).toHaveAttribute('data-lab-progress', 'in_progress');
    expect(screen.getByText('Synthetic badge lab:', { exact: false })).toHaveClass('sr-only');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows Completed for a completed lab', () => {
    labProgressRecords.set(RECORD_ID, progress({ status: 'completed', completedAt: 3_000, completedSteps: [...BADGE.stepIds!] }));
    render(<LabProgressBadge {...BADGE} />);
    const badge = screen.getByTestId('lab-progress-badge');
    expect(badge).toHaveTextContent('Synthetic badge lab: Completed');
    expect(badge).not.toHaveTextContent(/step/);
    expect(badge).toHaveAttribute('data-lab-progress', 'completed');
  });

  it('follows writes to the store after it mounts', () => {
    const { container } = render(<LabProgressBadge {...BADGE} />);
    expect(container).toBeEmptyDOMElement();

    act(() => {
      labProgressRecords.set(RECORD_ID, progress({ currentStepId: 'write-task', completedSteps: ['run-starter'] }));
    });
    expect(screen.getByTestId('lab-progress-badge')).toHaveTextContent('In progress · step 2 of 4');

    act(() => {
      labProgressRecords.update(RECORD_ID, (current) =>
        current ? { ...current, status: 'completed', completedAt: 4_000, updatedAt: 4_000 } : current,
      );
    });
    expect(screen.getByTestId('lab-progress-badge')).toHaveTextContent('Completed');

    act(() => {
      labProgressRecords.remove(RECORD_ID);
    });
    expect(container).toBeEmptyDOMElement();
  });

  it('follows a record written by another tab', () => {
    render(<LabProgressBadge {...BADGE} />);
    act(() => {
      window.localStorage.setItem(
        labProgressRecords.keyFor(RECORD_ID),
        JSON.stringify({ v: 1, data: progress({ currentStepId: 'self-check' }) }),
      );
      window.dispatchEvent(new StorageEvent('storage', { key: labProgressRecords.keyFor(RECORD_ID) }));
    });
    expect(screen.getByTestId('lab-progress-badge')).toHaveTextContent('In progress · step 4 of 4');
  });

  it('hydrates the empty server markup without a warning, then shows the stored progress', () => {
    labProgressRecords.set(RECORD_ID, progress());
    const tree = (
      <div data-testid="slot">
        <LabProgressBadge {...BADGE} />
      </div>
    );
    const html = renderToString(tree);
    expect(html).not.toContain('In progress');
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    const consoleError = vi.spyOn(console, 'error');
    const onRecoverableError = vi.fn();

    act(() => {
      roots.push(hydrateRoot(container, tree, { onRecoverableError }));
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
    expect(container.textContent).toContain('In progress · step 3 of 4');
  });
});

describe('labProgressStepNumber and labProgressLabel', () => {
  const ids = ['a', 'b', 'c'];

  it('use the position of the stored current step', () => {
    expect(labProgressStepNumber({ currentStepId: 'a', completedSteps: [] }, 3, ids)).toBe(1);
    expect(labProgressStepNumber({ currentStepId: 'c', completedSteps: ['a'] }, 3, ids)).toBe(3);
    expect(labProgressLabel({ status: 'in_progress', currentStepId: 'b', completedSteps: [] }, 3, ids)).toBe(
      'In progress · step 2 of 3',
    );
  });

  it('fall back to one past the completed steps when the current step is missing or unknown', () => {
    expect(labProgressStepNumber({ currentStepId: null, completedSteps: [] }, 3, ids)).toBe(1);
    expect(labProgressStepNumber({ currentStepId: 'gone', completedSteps: ['a', 'stale'] }, 3, ids)).toBe(2);
    expect(labProgressStepNumber({ currentStepId: 'b', completedSteps: ['a'] }, 3)).toBe(2);
  });

  it('clamp the step to the lab length', () => {
    expect(labProgressStepNumber({ currentStepId: null, completedSteps: ['a', 'b', 'c'] }, 3, ids)).toBe(3);
    expect(labProgressStepNumber({ currentStepId: null, completedSteps: ['x', 'y', 'z', 'w'] }, 3)).toBe(3);
    expect(labProgressStepNumber({ currentStepId: 'c', completedSteps: [] }, 2, ids)).toBe(2);
  });

  it('say Completed for a completed lab and drop the step count for a lab with no steps', () => {
    expect(labProgressLabel({ status: 'completed', currentStepId: 'b', completedSteps: ['a'] }, 3, ids)).toBe('Completed');
    expect(labProgressLabel({ status: 'in_progress', currentStepId: null, completedSteps: [] }, 0)).toBe('In progress');
  });
});

describe('lab entry-point client components', () => {
  it('never import the lab registry, so lesson, hub and home bundles stay free of it', () => {
    const clientFiles = [
      'src/components/practice/LabProgressBadge.tsx',
      'src/components/curriculum/ModuleCard.tsx',
      'src/components/home/InteractiveFeaturesSection.tsx',
    ];
    for (const file of clientFiles) {
      const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
      expect(source.startsWith("'use client'") || source.startsWith('"use client"'), file).toBe(true);
      expect(source, file).not.toMatch(/from ['"]@\/(lib|generated)\/lab-registry['"]/);
      expect(source, file).not.toMatch(/from ['"]@\/lib\/flashcard-decks['"]/);
    }
  });
});
