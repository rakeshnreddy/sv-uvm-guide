import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PracticePager, pagerEyebrow } from '@/components/practice/PracticePager';
import type { PracticePagerData } from '@/lib/practice-links';

const section = { section: 'exercises', id: 'exercises', label: 'Exercises', href: '/practice#exercises' } as const;
const prev = { title: 'UVM phase sorter', href: '/exercises/uvm-phase-sorter', lesson: { code: 'I-UVM-1C', title: 'UVM Phasing' } };
const next = { title: 'Scoreboard connector', href: '/exercises/scoreboard-connector' };

function renderPager(pager: Partial<PracticePagerData>) {
  render(<PracticePager pager={{ kind: 'exercise', section, ...pager }} />);
  return screen.getByRole('navigation', { name: 'More in Exercises' });
}

describe('PracticePager', () => {
  it('starts with "Back to Practice: <section>" linking to that section of /practice', () => {
    const nav = renderPager({ prev, next });
    const back = within(nav).getByRole('link', { name: 'Back to Practice: Exercises' });
    expect(back).toHaveAttribute('href', '/practice#exercises');
    expect(back.className).toContain('min-h-[2.5rem]');
    expect(back.className).toContain('focus-visible:ring-2');
  });

  it('shows previous and next cards for a middle item, with rel and the teaching lesson', () => {
    const nav = renderPager({ prev, next });
    const previous = within(nav).getByRole('link', { name: /Previous exercise/ });
    expect(previous).toHaveAttribute('href', prev.href);
    expect(previous).toHaveAttribute('rel', 'prev');
    expect(previous).toHaveTextContent('UVM phase sorter');
    expect(within(previous).getByText('I-UVM-1C')).toHaveAttribute('data-signal-tag');
    const following = within(nav).getByRole('link', { name: /Next exercise/ });
    expect(following).toHaveAttribute('href', next.href);
    expect(following).toHaveAttribute('rel', 'next');
    expect(following.className).toContain('sm:col-start-2');
  });

  it('has no previous card on the first item and no next card on the last', () => {
    const first = renderPager({ next });
    expect(within(first).queryByRole('link', { name: /Previous/ })).toBeNull();
    expect(within(first).getByRole('link', { name: /Next exercise/ })).toBeInTheDocument();
  });

  it('shows only the back link when the kind has one item', () => {
    const nav = renderPager({});
    expect(within(nav).getAllByRole('link')).toHaveLength(1);
  });

  it('stacks the cards in one column on phones and lets them shrink so long titles wrap', () => {
    const nav = renderPager({ prev, next });
    const grid = within(nav).getByTestId('practice-pager-cards');
    expect(grid.className).toContain('grid-cols-1');
    expect(grid.className).toContain('sm:grid-cols-2');
    for (const card of within(grid).getAllByRole('link')) expect(card.className).toContain('min-w-0');
  });

  it('names the kind in sentence case', () => {
    expect(pagerEyebrow('next', 'interactive')).toBe('Next interactive model');
    expect(pagerEyebrow('prev', 'lab')).toBe('Previous lab');
  });
});
