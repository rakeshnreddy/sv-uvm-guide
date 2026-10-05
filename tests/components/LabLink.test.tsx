import fs from 'node:fs';
import path from 'node:path';

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LabLink } from '@/components/mdx/LabLink';
import type { LabManifest } from '@/lib/lab-manifest';
import { getAllLabs, getLabById, labRequiresSignIn } from '@/lib/lab-registry';

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

const SIGN_IN_NOTE = 'Sign in required: the lab saves your progress to your account.';

afterEach(() => {
  cleanup();
});

describe('LabLink in a lesson', () => {
  it('launches an available lab with the e2e-pinned "Launch Lab" name, described by the sign-in note (G30-PRAC-10)', () => {
    render(<LabLink labId="pss-portable-intent" />);
    expect(screen.getByRole('heading', { level: 4, name: 'Practice Lab: Memory Read/Write Portable Intent' })).toBeInTheDocument();
    const launch = screen.getByRole('link', { name: 'Launch Lab' });
    expect(launch).toHaveAttribute('href', '/practice/lab/pss-portable-intent');
    expect(launch).toHaveAccessibleDescription(SIGN_IN_NOTE);
    expect(screen.queryByText('Coming soon')).not.toBeInTheDocument();
  });

  it('renders a coming-soon lab as a "Coming soon" chip with no link to the lab (G30-PRAC-09)', () => {
    expect(getLabById('simple-dut-1')?.status).toBe('coming_soon');
    render(<LabLink labId="simple-dut-1" />);
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
    expect(screen.getByText('This lab is planned and cannot be opened yet.')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByText(SIGN_IN_NOTE)).not.toBeInTheDocument();
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
    expect(second).toHaveAccessibleDescription(SIGN_IN_NOTE);
  });

  it('reports an unknown lab id to the author', () => {
    render(<LabLink labId="no-such-lab" />);
    expect(screen.getByText(/Lab mapping failed/)).toBeInTheDocument();
  });
});

describe('labRequiresSignIn', () => {
  it('matches the lab route, which requires a session for every available lab', () => {
    const route = fs.readFileSync(
      path.join(process.cwd(), 'src', 'app', '(learning)', 'practice', 'lab', '[labId]', 'page.tsx'),
      'utf8',
    );
    expect(route).toContain('requireSession()');
    expect(route).toMatch(/lab\.status !== "available"\) notFound\(\)/);
    for (const lab of getAllLabs()) expect(labRequiresSignIn(lab), lab.id).toBe(lab.status === 'available');
    expect(labRequiresSignIn({ status: 'coming_soon' })).toBe(false);
    expect(labRequiresSignIn({ status: 'archived' })).toBe(false);
  });
});
