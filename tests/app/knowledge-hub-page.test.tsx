import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/*
 * /knowledge-hub is a draft page: its concept graph is placeholder data that
 * links to no lesson, so it answers 404 unless draft pages are switched on
 * (SITE_FEATURES.draftPages). The draft no longer carries the placeholder
 * cross-reference panel or the concept editor whose changes were never kept.
 */

type PageModule = { default: () => React.ReactElement; dynamic?: string };

const notFound = vi.fn((): never => {
  throw new Error('notFound');
});

async function loadPage(draftPages: boolean): Promise<PageModule> {
  vi.resetModules();
  vi.doMock('@/lib/site-features', () => ({ __esModule: true, SITE_FEATURES: Object.freeze({ draftPages }) }));
  vi.doMock('next/navigation', () => ({ __esModule: true, notFound }));
  // The d3 graph renders on the client only; a stub keeps this test about the page itself.
  vi.doMock('next/dynamic', () => ({
    __esModule: true,
    default: () =>
      function GraphStub() {
        return <div data-testid="knowledge-graph" />;
      },
  }));
  return import('@/app/(learning)/knowledge-hub/page') as Promise<PageModule>;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  for (const mocked of ['@/lib/site-features', 'next/navigation', 'next/dynamic']) vi.doUnmock(mocked);
  vi.resetModules();
});

describe('/knowledge-hub (draft page)', () => {
  it('answers 404 while draft pages are off', async () => {
    const page = await loadPage(false);
    expect(() => page.default()).toThrow('notFound');
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it('renders the draft without placeholder panels when draft pages are on, as a static page', async () => {
    const page = await loadPage(true);
    expect(page.dynamic).toBeUndefined();

    render(page.default());

    expect(notFound).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { level: 1, name: 'SystemVerilog & UVM Knowledge Hub' })).toBeInTheDocument();
    expect(screen.getByTestId('knowledge-graph')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Learning Path Generator' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Concept Dependency Analyzer' })).toBeInTheDocument();
    expect(screen.queryByText(/will be displayed here|will provide intelligent/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Intelligent Cross-Reference|Concept & Relationship Mapper/ })).not.toBeInTheDocument();
  });
});
