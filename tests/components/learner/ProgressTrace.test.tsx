import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __resetRecordsForTests } from '@/lib/learner-store/record';
import { __resetStorageForTests } from '@/lib/learner-store/storage';
import type { StaticTier } from '@/lib/learner-stats';
import { progressTraces, readoutIndex, tierTrace } from '@/lib/progress-trace';

(globalThis as typeof globalThis & { React?: typeof React }).React = React;

type MockNextLinkProps = React.PropsWithChildren<Omit<React.ComponentProps<'a'>, 'href'> & { href: string }>;

vi.mock('next/link', async () => {
  const { forwardRef } = await import('react');
  const MockLink = forwardRef<HTMLAnchorElement, MockNextLinkProps>(({ href, children, ...rest }, ref) => (
    <a ref={ref} href={href} {...rest}>
      {children}
    </a>
  ));
  MockLink.displayName = 'MockLink';
  return { __esModule: true, default: MockLink };
});

import { ProgressTrace, ProgressTraceLegend, ProgressTraceView } from '@/components/learner/ProgressTrace';

const href = (mod: string, lesson = 'index') => `/curriculum/T2_Intermediate/${mod}/${lesson}`;

const TIER: StaticTier = {
  id: 'T2_Intermediate',
  number: 2,
  label: 'Tier 2: Intermediate',
  modules: ['I-SV-1_OOP', 'I-SV-2A_Rand', 'I-SV-2B_More', 'I-SV-3A_Cov'].map((id) => ({
    id,
    code: id.split('_')[0],
    title: `${id.split('_')[1]} module`,
    tierId: 'T2_Intermediate',
    lessons: [{ slug: 'index', title: 'Index', href: href(id) }],
  })),
};

const CONTINUE = TIER.modules.map((mod) => ({ href: mod.lessons[0].href, code: mod.code, title: mod.title }));

function seededTrace() {
  return progressTraces(
    [TIER],
    {
      'I-SV-1_OOP': { completedLessons: ['index'], lastVisitedAt: 1, lastVisitedLesson: 'index' },
      'I-SV-2A_Rand': { completedLessons: [], lastVisitedAt: 2, lastVisitedLesson: 'index' },
    },
    { lessons: {} },
    href('I-SV-2A_Rand'),
  )[0];
}

describe('ProgressTrace', () => {
  beforeEach(() => {
    __resetStorageForTests();
    __resetRecordsForTests();
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('draws one linked segment per module in the tier colour, named with code, title and state', () => {
    render(<ProgressTraceView trace={seededTrace()} />);
    const list = screen.getByRole('list', { name: 'Tier 2: Intermediate modules' });
    const links = within(list).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('aria-label'))).toEqual([
      'I-SV-1: OOP module, done',
      'I-SV-2A: Rand module, opened, where you are',
      'I-SV-2B: More module, not started',
      'I-SV-3A: Cov module, not started',
    ]);
    expect(links.map((link) => link.getAttribute('href'))).toEqual(TIER.modules.map((mod) => mod.lessons[0].href));
    expect(screen.getByTestId('progress-trace')).toHaveAttribute('data-tier', '2');
    // State is drawn by height and a dashed top, not colour alone; the cursor sits on one segment.
    expect(links[1].querySelector('.border-dashed')).not.toBeNull();
    expect(links[0].querySelector('.border-dashed')).toBeNull();
    expect(list.querySelectorAll('[data-trace-part="cursor"]')).toHaveLength(1);
    expect(links[1].querySelector('[data-trace-part="cursor"]')).not.toBeNull();
  });

  it('keeps one tab stop, on the cursor, and moves it with the arrow keys, Home and End', () => {
    render(<ProgressTraceView trace={seededTrace()} />);
    const links = within(screen.getByRole('list', { name: 'Tier 2: Intermediate modules' })).getAllByRole('link');
    expect(links.map((link) => link.tabIndex)).toEqual([-1, 0, -1, -1]);
    act(() => links[1].focus());
    fireEvent.keyDown(links[1], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(links[2]);
    expect(links.map((link) => link.tabIndex)).toEqual([-1, -1, 0, -1]);
    fireEvent.keyDown(links[2], { key: 'End' });
    expect(document.activeElement).toBe(links[3]);
    fireEvent.keyDown(links[3], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(links[3]);
    fireEvent.keyDown(links[3], { key: 'Home' });
    expect(document.activeElement).toBe(links[0]);
    fireEvent.keyDown(links[0], { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(links[0]);
  });

  it('shows the segment under focus in the readout', () => {
    render(<ProgressTraceView trace={seededTrace()} />);
    const readout = screen.getByTestId('progress-trace-readout');
    expect(readout).toHaveTextContent('Rand module');
    expect(readout).toHaveTextContent('Opened, where you are');
    fireEvent.focus(within(screen.getByRole('list', { name: 'Tier 2: Intermediate modules' })).getAllByRole('link')[0]);
    expect(readout).toHaveTextContent('OOP module');
    expect(readout).toHaveTextContent('Done');
  });

  it('leaves the readout empty at rest in a tier without the cursor, so only one module reads as where you are', () => {
    const trace = progressTraces(
      [TIER],
      { 'I-SV-1_OOP': { completedLessons: ['index'], lastVisitedAt: 1, lastVisitedLesson: 'index' } },
      { lessons: {} },
      null,
    )[0];
    render(<ProgressTraceView trace={trace} />);
    const readout = screen.getByTestId('progress-trace-readout');
    expect(readout).toBeEmptyDOMElement();
    const links = within(screen.getByRole('list', { name: 'Tier 2: Intermediate modules' })).getAllByRole('link');
    fireEvent.focus(links[0]);
    expect(readout).toHaveTextContent('OOP module');
    fireEvent.blur(links[0]);
    expect(readout).toBeEmptyDOMElement();
    expect(readoutIndex(null, -1)).toBeNull();
    expect(readoutIndex(null, 2)).toBe(2);
    expect(readoutIndex(1, 2)).toBe(1);
  });

  it('marks the cursor with a flag over its segment as well as a line, and rings focus in the text colour', () => {
    const { container } = render(<ProgressTraceView trace={seededTrace()} />);
    const flag = container.querySelector<HTMLElement>('[data-trace-part="cursor-flag"]');
    expect(flag).not.toBeNull();
    // Segment 2 of 4: its centre is 37.5% across.
    expect(flag?.style.left).toBe('37.5%');
    const links = within(screen.getByRole('list', { name: 'Tier 2: Intermediate modules' })).getAllByRole('link');
    expect(links[0].className).toContain('focus-visible:ring-foreground');
    expect(links[0].className).not.toContain('focus-visible:ring-ring');

    cleanup();
    const { container: none } = render(<ProgressTraceView trace={tierTrace(TIER, null)} />);
    expect(none.querySelector('[data-trace-part="cursor-flag"]')).toBeNull();
  });

  it('lists every module as a row link for phones, where the segments take no pointer input', () => {
    render(<ProgressTraceView trace={seededTrace()} />);
    const segments = within(screen.getByRole('list', { name: 'Tier 2: Intermediate modules' })).getAllByRole('link');
    for (const link of segments) expect(link.className).toContain('max-sm:pointer-events-none');
    const details = screen.getByTestId('progress-trace-modules');
    expect(details).toHaveClass('sm:hidden');
    expect(within(details).getByText('All 4 modules').tagName).toBe('SUMMARY');
    const rows = details.querySelectorAll('li a');
    expect([...rows].map((row) => row.getAttribute('href'))).toEqual(TIER.modules.map((mod) => mod.lessons[0].href));
    expect(rows[1]).toHaveTextContent('I-SV-2A');
    expect(rows[1]).toHaveTextContent('Rand module');
    expect(rows[1]).toHaveTextContent('Opened, where you are');
    expect(rows[1].className).toContain('min-h-10');
  });

  it('draws the miniature as one image named with the tier totals, with no links', () => {
    render(<ProgressTraceView trace={seededTrace()} size="mini" />);
    const mini = screen.getByRole('img', { name: 'Tier 2: Intermediate: 1 of 4 modules done, 1 more opened' });
    expect(mini).toHaveAttribute('data-size', 'mini');
    expect(within(mini).queryAllByRole('link')).toHaveLength(0);
    expect(mini.querySelectorAll('[data-state]')).toHaveLength(4);
    expect(mini.querySelectorAll('[data-trace-part="cursor"]')).toHaveLength(1);
  });

  it('gives the three states in words in the legend', () => {
    render(<ProgressTraceLegend />);
    const items = within(screen.getByRole('list', { name: 'Trace key' })).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(['Not started', 'Opened', 'Done']);
  });

  it('renders the not-started trace on the server, then fills it from this browser', () => {
    localStorage.setItem(
      'curriculumProgress',
      JSON.stringify({ 'I-SV-1_OOP': { completedLessons: ['index'], lastVisitedAt: Date.now(), lastVisitedLesson: 'index' } }),
    );
    const html = renderToStaticMarkup(<ProgressTrace tier={TIER} continueLessons={CONTINUE} />);
    expect(html.match(/data-state="not-started"/g)).toHaveLength(4);
    expect(html).not.toContain('data-trace-part="cursor"');

    render(<ProgressTrace tier={TIER} continueLessons={CONTINUE} />);
    const links = within(screen.getByRole('list', { name: 'Tier 2: Intermediate modules' })).getAllByRole('link');
    expect(links[0]).toHaveAttribute('data-state', 'done');
    expect(links[0]).toHaveAccessibleName('I-SV-1: OOP module, done, where you are');
  });

  it('keeps the same box for every state, so nothing shifts when progress arrives', () => {
    const empty = renderToStaticMarkup(<ProgressTraceView trace={tierTrace(TIER, null)} />);
    const full = renderToStaticMarkup(<ProgressTraceView trace={seededTrace()} />);
    const box = (html: string) => /<ol[^>]*class="([^"]*)"/.exec(html)?.[1];
    expect(box(empty)).toBe(box(full));
    expect(box(full)).toContain('h-14');
  });
});
