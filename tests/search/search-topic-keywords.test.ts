// @vitest-environment node
import { describe, expect, it } from 'vitest';

import index from '@/generated/search-index.json';
import { prepareSearchDocuments, searchCurriculum, type SearchIndexData } from '@/components/search/search-engine';
import { topicKeywords } from '../../scripts/generate-search-index.mjs';

const data = index as unknown as SearchIndexData;
const docs = prepareSearchDocuments(data);
const isLesson = (kind: string) => kind === 'lesson' || kind === 'section';

describe('topic keywords for practice items', () => {
  it('takes the words of the outcome line and the teaching lesson titles, without the module code', () => {
    expect(
      topicKeywords({
        title: 'Semaphore Hangs',
        description: 'Read a watchdog report.',
        outcome: 'Draw a wait-for graph from a watchdog report and fix a leaked key.',
        lessonTitles: ['I-SV-5: Synchronization and IPC', 'Semaphores: Keys, Mutual Exclusion and Deadlock', 'F1A: The Cost of Bugs'],
      }),
    ).toEqual(['draw', 'wait', 'graph', 'fix', 'leaked', 'key', 'synchronization', 'ipc', 'semaphores', 'keys', 'mutual', 'exclusion', 'deadlock', 'cost', 'bugs']);
  });

  it('adds no stop words, function words, single letters or words the item already holds', () => {
    expect(
      topicKeywords(
        { title: 'Bridge lab', description: 'Debug the bridge.', outcome: "Debug a bridge's split and check it in your bench.", lessonTitles: [] },
        ['lab', 'bench'],
      ),
    ).toEqual(['split', 'check']);
    expect(topicKeywords({ title: 'T', description: 'D.', lessonTitles: [] })).toEqual([]);
  });
});

describe('search finds the practice for a topic word', () => {
  const hrefs = (query: string) => searchCurriculum(docs, query, 50).map((result) => result.doc.href);

  it.each([
    ['deadlock', ['/practice/lab/ipc-deadlock', '/practice/lab/axi-deadlock-hunt-lab']],
    ['starvation', ['/practice/lab/arbiter-1']],
    ['vacuous', ['/practice/lab/assertions-1']],
    ['vacuity', ['/interview-prep/sva-formal']],
  ])('"%s" finds %j', (query, expected) => {
    expect(hrefs(query)).toEqual(expect.arrayContaining(expected));
  });

  it.each(['deadlock', 'starvation'])('"%s" still lists a lesson first', (query) => {
    expect(isLesson(searchCurriculum(docs, query, 50)[0].doc.kind)).toBe(true);
  });

  it.each(['deadlock', 'starvation', 'vacuous', 'semaphore', 'scoreboard'])(
    '"%s" lists lessons before practice items that match equally',
    (query) => {
      const results = searchCurriculum(docs, query, 50);
      for (let i = 1; i < results.length; i += 1) {
        const [before, after] = [results[i - 1], results[i]];
        if (before.score === after.score && isLesson(after.doc.kind)) {
          expect(isLesson(before.doc.kind), `${query}: ${before.doc.href} above ${after.doc.href}`).toBe(true);
        }
      }
    },
  );
});
