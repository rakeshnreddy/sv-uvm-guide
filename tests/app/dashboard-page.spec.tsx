import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { CurriculumTopicStatus } from '@/lib/curriculum-status';

type MockNextLinkProps = React.PropsWithChildren<
  Omit<React.ComponentProps<'a'>, 'href'> & { href: string }
>;

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: MockNextLinkProps) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const baseStatus: CurriculumTopicStatus = {
  status: 'complete',
  owner: 'Content Ops',
  lastUpdated: '2025-09-22',
  tier: 'T1',
  moduleSlug: 'T1_Foundational',
  moduleTitle: 'Foundational',
  sectionSlug: 'fundamentals',
  sectionTitle: 'Fundamentals',
  topicSlug: 'overview',
  topicTitle: 'Overview',
  path: 'T1_Foundational/fundamentals/overview',
  notes: 'Mock entry for dashboard coverage tests.',
};

const curriculumStatusMock: CurriculumTopicStatus[] = [
  baseStatus,
  {
    ...baseStatus,
    status: 'in-review',
    topicSlug: 'agent-handoff',
    topicTitle: 'Agent handoff drill',
    path: 'T1_Foundational/fundamentals/agent-handoff',
  },
  {
    ...baseStatus,
    status: 'draft',
    topicSlug: 'coverage-outlook',
    topicTitle: 'Coverage outlook',
    path: 'T1_Foundational/fundamentals/coverage-outlook',
  },
];

vi.mock('@/lib/curriculum-status', () => ({
  buildCurriculumStatus: () => curriculumStatusMock,
}));

import DashboardPage from '@/app/dashboard/DashboardPageClient';

describe('DashboardPageClient', () => {
  it('summarizes curriculum coverage and module progress', () => {
    render(<DashboardPage />);

    expect(screen.getByText('Welcome back, verification lead')).toBeInTheDocument();
    expect(screen.getByText('Foundational')).toBeInTheDocument();
    expect(screen.getByText('Intermediate')).toBeInTheDocument();

    const coverageContainer = screen.getByText('Coverage snapshot').closest('.glass-card');
    expect(coverageContainer).not.toBeNull();

    const coverageCard = within(coverageContainer as HTMLElement);
    expect(coverageCard.getByText(/1\/3/)).toBeInTheDocument();
    expect(coverageCard.getByText('In review')).toBeInTheDocument();
    expect(coverageCard.getByText('Draft backlog')).toBeInTheDocument();
    expect(screen.getByText('2 topics still need accuracy or polish before the next push.')).toBeInTheDocument();

    const openDashboard = screen.getByRole('link', { name: /Open dashboard/i });
    expect(openDashboard.getAttribute('href')).toBe('/dashboard/coverage');
  });
});
