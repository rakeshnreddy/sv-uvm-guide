import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LabBackLink, LabLessonContext } from '@/app/(learning)/practice/lab/[labId]/LabNavigation';
import type { LabManifest } from '@/lib/lab-manifest';
import { getLabById } from '@/lib/lab-registry';
import { getLabBackLink, getLabLessons, getLabPrerequisites } from '@/lib/practice-links';

const lab = (id: string) => getLabById(id) as LabManifest;

describe('lab back link', () => {
  it('returns to the owning module by name (the learner-flow e2e clicks "Back to module")', () => {
    render(<LabBackLink backLink={getLabBackLink(lab('pss-portable-intent'))} />);
    const link = screen.getByRole('link', { name: /^Back to module/ });
    expect(link).toHaveAttribute('href', '/curriculum/T4_Expert/E-PSS-1_Portable_Stimulus_Standard/index');
    expect(link).toHaveTextContent('Back to module: E-PSS-1 Portable Stimulus Standard');
  });

  it('derives the module for a lab whose registry entry has no moduleHref', () => {
    render(<LabBackLink backLink={getLabBackLink(lab('callbacks-driver-behavior'))} />);
    expect(screen.getByRole('link', { name: /^Back to module/ })).toHaveAttribute(
      'href',
      '/curriculum/T3_Advanced/A-UVM-5_UVM_Callbacks/index',
    );
  });

  it('says "Back to lesson" for a lab launched from a sub-lesson', () => {
    render(<LabBackLink backLink={getLabBackLink(lab('coverage-advanced-1'))} />);
    expect(screen.getByRole('link', { name: /^Back to lesson/ })).toHaveAttribute(
      'href',
      '/curriculum/T2_Intermediate/I-SV-3B_Advanced_Functional_Coverage/closure-workflow',
    );
  });
});

describe('lab lesson context', () => {
  it('shows the launching lesson, the capstone checkpoints and the prerequisite labs', () => {
    const capstone = lab('uvm-mini-capstone');
    const { items, doAfter } = getLabPrerequisites(capstone);
    render(<LabLessonContext lessons={getLabLessons(capstone)} prerequisites={{ items, doAfter }} />);
    expect(screen.getByText('Learn it in')).toBeInTheDocument();
    expect(screen.getByText('Related lessons')).toBeInTheDocument();
    expect(screen.getByText('Before you start')).toBeInTheDocument();
    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    expect(hrefs[0]).toBe('/curriculum/T3_Advanced/A-UVM-6_Scoreboards_and_Reference_Models/index');
    expect(hrefs).toContain('/curriculum/T2_Intermediate/I-UVM-1B_The_UVM_Factory/index');
    expect(hrefs).toContain('/practice/lab/scoreboard-decoupling');
  });

  it('warns about a forward dependency with "Do this lab after"', () => {
    // The real deadlock lab has no forward dependency any more; build one: a B-AXI-5 lab that needs the B-AXI-6 scoreboard lab.
    const deadlock = lab('axi-deadlock-hunt-lab');
    const { items, doAfter } = getLabPrerequisites({ ...deadlock, labPrerequisites: ['axi-scoreboard-lab'] } as LabManifest);
    render(<LabLessonContext lessons={getLabLessons(deadlock)} prerequisites={{ items, doAfter }} />);
    expect(screen.getByText('Do this lab after')).toBeInTheDocument();
  });

  it('renders nothing without lessons or prerequisites', () => {
    const { container } = render(<LabLessonContext lessons={[]} prerequisites={{ items: [] }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
