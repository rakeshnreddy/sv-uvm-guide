import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Sidebar from '@/components/layout/Sidebar';

const mockPathname = vi.fn();

const { mockCurriculumData, statusEntries, normalizeSlug } = vi.hoisted(() => {
  const data = [
    {
      title: 'Foundational',
      slug: 'T1_Foundational',
      tier: 'T1',
      sections: [
        {
          title: 'Module A',
          slug: 'Module_A',
          topics: [
            {
              title: 'Module A Topic',
              slug: 'index',
              description: 'Baseline content',
            },
          ],
        },
        {
          title: 'Module B',
          slug: 'Module_B',
          topics: [
            {
              title: 'Module B Topic',
              slug: 'index',
              description: 'Follow-on content',
            },
          ],
        },
      ],
    },
  ];

  const normalize = (slug: string[]): string[] => {
    if (slug.length >= 3) {
      return slug.slice(0, 3);
    }
    if (slug.length === 0) {
      return [];
    }

    const [tierSlug, sectionSlug] = slug;
    const tier = data.find(module => module.slug === tierSlug);
    if (!tier) {
      return [];
    }

    if (!sectionSlug) {
      const firstSection = tier.sections[0];
      const topicSlug = firstSection?.topics[0]?.slug ?? 'index';
      return [tierSlug, firstSection.slug, topicSlug];
    }

    const section = tier.sections.find(entry => entry.slug === sectionSlug);
    if (!section) {
      return [];
    }

    const topicSlug = section.topics[0]?.slug ?? 'index';
    return [tierSlug, section.slug, topicSlug];
  };

  const statuses = [
    {
      tier: 'T1' as const,
      moduleSlug: 'T1_Foundational',
      moduleTitle: 'Foundational',
      sectionSlug: 'Module_A',
      sectionTitle: 'Module A',
      topicSlug: 'index',
      topicTitle: 'Module A Topic',
      path: 'T1_Foundational/Module_A/index',
      status: 'complete' as const,
      owner: 'Content Ops',
      lastUpdated: '2025-09-24',
      notes: 'Ready for launch',
    },
    {
      tier: 'T1' as const,
      moduleSlug: 'T1_Foundational',
      moduleTitle: 'Foundational',
      sectionSlug: 'Module_B',
      sectionTitle: 'Module B',
      topicSlug: 'index',
      topicTitle: 'Module B Topic',
      path: 'T1_Foundational/Module_B/index',
      status: 'in-review' as const,
      owner: 'Content Ops',
      lastUpdated: '2025-09-24',
      notes: 'Pending SME sign-off',
    },
  ];

  return {
    mockCurriculumData: data,
    statusEntries: statuses,
    normalizeSlug: normalize,
  };
});

vi.mock('@/contexts/NavigationContext', () => ({
  useNavigation: () => ({
    isSidebarOpen: true,
    toggleSidebar: vi.fn(),
  }),
}));

vi.mock('@/lib/curriculum-data', () => ({
  curriculumData: mockCurriculumData,
  normalizeSlug,
}));

vi.mock('@/lib/curriculum-status', () => ({
  buildCurriculumStatus: () => statusEntries,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

describe('Sidebar curriculum outline', () => {
  beforeEach(() => {
    mockPathname.mockReturnValue('/curriculum/T1_Foundational/Module_B/index');
  });

  afterEach(() => {
    mockPathname.mockReset();
  });

  it('surfaces section status chips sourced from curriculum metadata', () => {
    render(<Sidebar />);

    expect(screen.getByText('Tier 1: Foundational')).toBeInTheDocument();

    const completeChip = screen.getByText('Complete');
    expect(completeChip).toHaveClass('border-emerald-400/30', { exact: false });

    const reviewChip = screen.getByText('In Review');
    expect(reviewChip).toHaveClass('border-amber-400/30', { exact: false });

    const currentLink = screen.getByRole('link', { name: /Module B/i });
    expect(currentLink).toHaveClass('bg-primary/10', { exact: false });
    expect(currentLink).toHaveAttribute('href', '/curriculum/T1_Foundational/Module_B/index');
  });

  it('falls back to the first tier when the route lacks curriculum segments', () => {
    mockPathname.mockReturnValue('/dashboard');

    render(<Sidebar />);

    const defaultLink = screen.getByRole('link', { name: /Module A/i });
    expect(defaultLink).toHaveClass('bg-primary/10', { exact: false });
    expect(defaultLink).toHaveAttribute('href', '/curriculum/T1_Foundational/Module_A/index');
  });
});
