import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ScoreboardConnectorPage from '@/app/(learning)/exercises/scoreboard-connector/page';
import UvmAgentBuilderPage from '@/app/(learning)/exercises/uvm-agent-builder/page';
import UvmPhaseSorterPage from '@/app/(learning)/exercises/uvm-phase-sorter/page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/exercises/uvm-phase-sorter',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

(globalThis as { React?: typeof React }).React = React;

afterEach(() => cleanup());

describe.each([
  ['uvm-phase-sorter', UvmPhaseSorterPage],
  ['uvm-agent-builder', UvmAgentBuilderPage],
  ['scoreboard-connector', ScoreboardConnectorPage],
] as const)('/exercises/%s', (_slug, Page) => {
  it('holds the intro and objectives to the reading measure, with the lab page\'s unboxed "Learn it in" row', () => {
    const { container } = render(<Page />);
    const objectives = screen.getByRole('heading', { name: 'Learning objectives' }).closest('section') as HTMLElement;
    expect(objectives).toHaveClass('max-w-[30em]');
    expect(objectives.querySelector('ul')).toHaveClass('list-disc', 'pl-5');
    expect(objectives.querySelector('ul')).not.toHaveClass('list-inside');
    expect(container.querySelector('nav[data-learn-in="row"]')).not.toBeNull();
  });
});
