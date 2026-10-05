import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import LessonError from '@/app/(learning)/curriculum/[...slug]/error';

const { router } = vi.hoisted(() => ({ router: { refresh: vi.fn(), push: vi.fn() } }));

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index',
}));

const F1A = '/curriculum/T1_Foundational/F1A_The_Cost_of_Bugs/index';

function failure(digest?: string): Error & { digest?: string } {
  return Object.assign(new Error('render failed'), digest ? { digest } : {});
}

beforeEach(() => {
  router.refresh.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('lesson error page (G30-PAGE-04)', () => {
  it('says what happened in a labelled region with one h1, and logs the error', () => {
    const error = failure();
    render(<LessonError error={error} reset={vi.fn()} />);
    const heading = screen.getByRole('heading', { level: 1, name: 'This lesson could not be shown' });
    const region = screen.getByRole('region', { name: 'This lesson could not be shown' });
    expect(region).toContainElement(heading);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(within(region).getByText(/Something went wrong while loading this page/)).toBeInTheDocument();
    expect(console.error).toHaveBeenCalledWith(error);
  });

  it('retries by refetching the route and re-rendering the segment', async () => {
    const user = userEvent.setup();
    const reset = vi.fn();
    render(<LessonError error={failure()} reset={reset} />);
    const retry = screen.getByRole('button', { name: 'Try again' });
    expect(retry).toHaveAttribute('type', 'button');
    await user.click(retry);
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('can be retried from the keyboard', async () => {
    const user = userEvent.setup();
    const reset = vi.fn();
    render(<LessonError error={failure()} reset={reset} />);
    screen.getByRole('button', { name: 'Try again' }).focus();
    await user.keyboard('{Enter}');
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('has a status region for the retry announcement', () => {
    render(<LessonError error={failure()} reset={vi.fn()} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows the error reference only when the server sent one', () => {
    const { unmount } = render(<LessonError error={failure('4021790551')} reset={vi.fn()} />);
    expect(screen.getByText('4021790551')).toBeInTheDocument();
    expect(screen.getByText(/Error reference/)).toBeInTheDocument();
    unmount();
    render(<LessonError error={failure()} reset={vi.fn()} />);
    expect(screen.queryByText(/Error reference/)).not.toBeInTheDocument();
  });

  it('offers the same ways back as the not-found page', () => {
    render(<LessonError error={failure()} reset={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Find your way back' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Curriculum overview' })).toHaveAttribute('href', '/curriculum');
    expect(screen.getByRole('link', { name: 'Start at the first lesson' })).toHaveAttribute('href', F1A);
    expect(screen.getByRole('link', { name: 'Practice hub' })).toHaveAttribute('href', '/practice');
  });
});
