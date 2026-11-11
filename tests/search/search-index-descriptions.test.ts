// @vitest-environment node
import { describe, expect, it } from 'vitest';

import index from '@/generated/search-index.json';
import type { SearchIndexData } from '@/components/search/search-engine';
import { ITEM_DESCRIPTION_MAX, firstSentence, oneLine } from '../../scripts/generate-search-index.mjs';

const data = index as unknown as SearchIndexData;

describe('item descriptions in the search index', () => {
  it('ends the first sentence at a full stop followed by a capital letter or the end', () => {
    expect(firstSentence('Run the bench.  Then read the log.')).toBe('Run the bench.');
    expect(firstSentence('Pick a mode, e.g. passive. Then build it.')).toBe('Pick a mode, e.g. passive.');
    expect(firstSentence('Uses v1.2 of the model')).toBe('Uses v1.2 of the model');
    expect(firstSentence('Is it legal? Find out.')).toBe('Is it legal?');
  });

  it('keeps a short first sentence whole, without an ellipsis', () => {
    expect(ITEM_DESCRIPTION_MAX).toBe(120);
    expect(oneLine('Choose active or passive, then build the agent. Each mode has its own parts.')).toBe(
      'Choose active or passive, then build the agent.',
    );
  });

  it('cuts a long first sentence at a word boundary and adds an ellipsis, 120 characters at most', () => {
    const long = `${'word '.repeat(40).trim()}, and more.`;
    const line = oneLine(long);
    expect(line.length).toBeLessThanOrEqual(120);
    expect(line.endsWith('word…')).toBe(true);
    expect(line).not.toMatch(/\s…$/);
  });

  it('writes every item description as one sentence or a cut that ends in an ellipsis', () => {
    for (const item of data.items ?? []) {
      expect(item.description.length, item.href).toBeLessThanOrEqual(120);
      expect(item.description, item.href).toMatch(/[.!?…]$/);
    }
  });
});
