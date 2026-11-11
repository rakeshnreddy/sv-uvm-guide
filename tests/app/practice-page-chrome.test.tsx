import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import UvmPhaseSorterPage from '@/app/(learning)/exercises/uvm-phase-sorter/page';
import { requirePracticePager } from '@/lib/practice-links';

describe('a practice page through PracticeInfoPage', () => {
  it('shows Practice › Exercises › <item>, the item title as the h1, and the pager at the end', () => {
    render(<UvmPhaseSorterPage />);
    // The desktop trail (the phone back link after it repeats the parent).
    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' }).querySelector('ol') as HTMLElement;
    expect(within(trail).getByRole('link', { name: 'Practice' })).toHaveAttribute('href', '/practice');
    expect(within(trail).getByRole('link', { name: 'Exercises' })).toHaveAttribute('href', '/practice#exercises');
    expect(trail.querySelector('[aria-current="page"]')).toHaveTextContent('UVM phase sorter');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^UVM phase sorter$/);

    const pager = screen.getByRole('navigation', { name: 'More in Exercises' });
    expect(within(pager).getByRole('link', { name: 'Back to Practice: Exercises' })).toHaveAttribute('href', '/practice#exercises');
    const expected = requirePracticePager('/exercises/uvm-phase-sorter');
    if (expected.next) expect(pager.querySelector('a[rel="next"]')).toHaveAttribute('href', expected.next.href);
  });
});
