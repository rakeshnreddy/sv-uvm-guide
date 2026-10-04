import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import LearnInLesson, { LabPrerequisiteList, LessonChipLink } from '@/components/practice/LearnInLesson';
import { getLabById } from '@/lib/lab-registry';
import type { LabManifest } from '@/lib/lab-manifest';
import { getLabPrerequisites, requirePracticePage, resolveLessonRef } from '@/lib/practice-links';

describe('LearnInLesson', () => {
  it('links a practice page back to its teaching lesson, then related lessons', () => {
    const item = requirePracticePage('/practice/visualizations/coverage-analyzer');
    render(<LearnInLesson item={item} />);
    const nav = screen.getByRole('navigation', { name: 'Lessons for Coverage Closure Lab' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual(item.lessons.map((lesson) => lesson.href));
    expect(links[0]).toHaveTextContent('I-SV-3A');
    expect(within(nav).getByText('Learn this in')).toBeInTheDocument();
    expect(within(nav).getByText('Related lessons')).toBeInTheDocument();
  });

  it('omits the related list when only the teaching lesson exists, and renders nothing without lessons', () => {
    const { rerender, container } = render(<LearnInLesson item={requirePracticePage('/exercises/uvm-phase-sorter')} />);
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.queryByText('Related lessons')).toBeNull();
    rerender(<LearnInLesson item={{ title: 'Orphan', lessons: [] }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('labels elective lessons in text', () => {
    const lesson = resolveLessonRef('I-SV-8_Power_Intent_and_UPF/index');
    expect(lesson?.track).toBe('elective');
    render(<LessonChipLink lesson={lesson!} />);
    expect(screen.getByRole('link')).toHaveTextContent('(elective)');
  });
});

describe('LabPrerequisiteList', () => {
  it('links available labs and lessons, keeps planned labs as text, and says when to do the lab', () => {
    // The real deadlock lab has no forward dependency any more; build one: a B-AXI-5 lab that needs the B-AXI-6 scoreboard lab.
    const deadlock = getLabById('axi-deadlock-hunt-lab') as LabManifest;
    const prerequisites = getLabPrerequisites({ ...deadlock, labPrerequisites: ['axi-scoreboard-lab'] } as LabManifest);
    render(<LabPrerequisiteList prerequisites={prerequisites} />);
    expect(screen.getByRole('link', { name: 'Lab: Building an AXI Out-of-Order Scoreboard' })).toHaveAttribute(
      'href',
      '/practice/lab/axi-scoreboard-lab',
    );
    const after = screen.getByText('Do this lab after').closest('p') as HTMLElement;
    expect(within(after).getByRole('link')).toHaveAttribute(
      'href',
      '/curriculum/T3_Advanced/B-AXI-6_AXI_Verification_Performance/index',
    );
  });

  it('never links a lab that is not available', () => {
    render(
      <LabPrerequisiteList
        prerequisites={{
          items: [{ kind: 'lab', id: 'simple-dut-1', title: 'Simple DUT', status: 'coming_soon', forward: false }],
        }}
      />,
    );
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText(/Simple DUT/)).toHaveTextContent('(planned, not available yet)');
  });

  it('renders nothing when a lab has no prerequisites', () => {
    const { container } = render(<LabPrerequisiteList prerequisites={{ items: [] }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
