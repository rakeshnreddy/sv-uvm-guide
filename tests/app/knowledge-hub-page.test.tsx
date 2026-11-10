import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CONCEPT_TERMS } from '@/lib/concept-terms';
import { conceptGraph } from '@/lib/knowledge-graph-engine';
import { filterConcepts } from '@/components/knowledge/ConceptList';

/*
 * /knowledge-hub: a module map and a searchable concept list derived from the
 * curriculum (src/lib/knowledge-graph-engine.ts). It is public: no switch
 * hides it.
 */

type PageModule = { default: () => React.ReactElement; dynamic?: string };

const notFound = vi.fn((): never => {
  throw new Error('notFound');
});

async function loadPage(draftPages: boolean): Promise<PageModule> {
  vi.resetModules();
  vi.doMock('@/lib/site-features', () => ({ __esModule: true, SITE_FEATURES: Object.freeze({ draftPages }) }));
  vi.doMock('next/navigation', () => ({ __esModule: true, notFound }));
  return import('@/app/(learning)/knowledge-hub/page') as Promise<PageModule>;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  for (const mocked of ['@/lib/site-features', 'next/navigation']) vi.doUnmock(mocked);
  vi.resetModules();
});

async function renderHub() {
  const page = await loadPage(true);
  render(page.default());
  return page;
}

const mapGroup = () => screen.getByRole('group', { name: /module map/ });
const mapTier = (name: string) =>
  within(screen.getByRole('radiogroup', { name: 'Tier shown on the map' })).getByRole('radio', { name });

describe('/knowledge-hub', () => {
  it('renders while draft pages are off: it is a public page', async () => {
    const page = await loadPage(false);
    expect(() => page.default()).not.toThrow();
    expect(notFound).not.toHaveBeenCalled();
  });

  it('renders statically with real counts and no placeholder wording', async () => {
    const page = await renderHub();
    expect(page.dynamic).toBeUndefined();
    expect(screen.getByRole('heading', { level: 1, name: 'Knowledge Hub' })).toBeInTheDocument();
    const lessons = conceptGraph.modules.reduce((total, node) => total + (node.lessons?.length ?? 0), 0);
    expect(
      screen.getByText(new RegExp(`${conceptGraph.modules.length} modules and ${lessons} lessons .* ${CONCEPT_TERMS.length} key terms`)),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/placeholder|coming soon|will be displayed here/i);
  });

  it('shows the tier 1 lanes with F1A selected and its dependent marked', async () => {
    await renderHub();
    const map = mapGroup();
    for (const lane of ['Why verify', 'The language', 'Time and races', 'Structure and interfaces']) {
      expect(within(map).getByRole('heading', { name: lane })).toBeInTheDocument();
    }
    const f1a = within(map).getByRole('button', { name: /^F1A/ });
    expect(f1a).toHaveAttribute('aria-pressed', 'true');
    expect(f1a).toHaveAttribute('tabindex', '0');
    expect(within(map).getByRole('button', { name: /^F1B.*builds on F1A/ })).toBeInTheDocument();
  });

  it('moves with the arrow keys (roving tabindex) and selects with a click', async () => {
    await renderHub();
    const map = mapGroup();
    const f1a = within(map).getByRole('button', { name: /^F1A/ });
    f1a.focus();
    fireEvent.keyDown(f1a, { key: 'ArrowDown' });
    const f1b = within(map).getByRole('button', { name: /^F1B/ });
    expect(f1b).toHaveFocus();
    expect(f1b).toHaveAttribute('tabindex', '0');
    expect(f1a).toHaveAttribute('tabindex', '-1');

    fireEvent.keyDown(f1b, { key: 'ArrowRight' });
    const f2b = within(map).getByRole('button', { name: /^F2B/ });
    expect(f2b).toHaveFocus();
    fireEvent.click(f2b);
    expect(f2b).toHaveAttribute('aria-pressed', 'true');
    // F2B needs F2A; F2E builds on F2B.
    expect(within(map).getByRole('button', { name: /^F2A.*needed before F2B/ })).toBeInTheDocument();
    expect(within(map).getByRole('button', { name: /^F2E.*builds on F2B/ })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /^F2B:/ })).toBeInTheDocument();
  });

  it('follows a prerequisite across tiers from the details panel', async () => {
    await renderHub();
    fireEvent.click(mapTier('Tier 2'));
    const map = mapGroup();
    expect(within(map).getByRole('heading', { name: 'UVM' })).toBeInTheDocument();
    fireEvent.click(within(map).getByRole('button', { name: /^I-SV-1/ }));

    const details = screen.getByRole('region', { name: /^I-SV-1:/ });
    fireEvent.click(within(details).getByRole('button', { name: /^F4B:.*\(Foundational\)/ }));
    expect(mapTier('Tier 1')).toHaveAttribute('aria-checked', 'true');
    expect(within(mapGroup()).getByRole('button', { name: /^F4B/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('opens a key term taught in the selected module in the concept dialog', async () => {
    await renderHub();
    fireEvent.click(within(mapGroup()).getByRole('button', { name: /^F4C/ }));
    fireEvent.click(screen.getByRole('button', { name: 'clocking block' }));
    const dialog = screen.getByRole('dialog', { name: 'clocking block' });
    expect(within(dialog).getByText(/Foundational/)).toBeInTheDocument();
  });

  it('searches the concept list and shows a module on the map', async () => {
    await renderHub();
    fireEvent.change(screen.getByLabelText('Search concepts'), { target: { value: 'objection' } });
    expect(screen.getByText(/^Showing \d+ of \d+ concepts?\.$/)).toBeInTheDocument();
    const term = screen.getByRole('heading', { level: 3, name: 'objection' }).closest('li')!;
    expect(within(term).getByRole('link', { name: /^I-UVM-1C:/ })).toHaveAttribute(
      'href',
      '/curriculum/T2_Intermediate/I-UVM-1C_UVM_Phasing/index',
    );

    fireEvent.change(screen.getByLabelText('Search concepts'), { target: { value: 'axi burst math' } });
    fireEvent.click(screen.getByRole('button', { name: 'Show B-AXI-2 on the map' }));
    expect(mapTier('Tier 3')).toHaveAttribute('aria-checked', 'true');
    expect(within(mapGroup()).getByRole('button', { name: /^B-AXI-2/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('says so when nothing matches', async () => {
    await renderHub();
    fireEvent.change(screen.getByLabelText('Search concepts'), { target: { value: 'zzzzqx' } });
    expect(screen.getByText(/No concept matches/)).toBeInTheDocument();
  });
});

describe('filterConcepts', () => {
  it('filters by kind and tier and matches word starts, names, codes and aliases', () => {
    const nodes = conceptGraph.nodes;
    expect(filterConcepts(nodes, { query: '', kind: 'module', tier: 'all' })).toHaveLength(conceptGraph.modules.length);
    expect(filterConcepts(nodes, { query: 'uvm_config_db', kind: 'term', tier: 'all' }).map((n) => n.id)).toContain(
      'term:configuration-database',
    );
    expect(filterConcepts(nodes, { query: 'B-AXI-3', kind: 'module', tier: 'Advanced' }).map((n) => n.code)).toEqual(['B-AXI-3']);
    expect(filterConcepts(nodes, { query: 'B-AXI-3', kind: 'module', tier: 'Foundational' })).toEqual([]);
  });
});
