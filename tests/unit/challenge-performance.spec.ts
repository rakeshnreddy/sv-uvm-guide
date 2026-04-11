import { describe, it, expect } from 'vitest';

interface Challenge {
  id: string;
  status: string;
}

interface StoryChapter {
  id: string;
  relatedChallenges: string[];
}

describe('ChallengeQuestSystem Performance Baseline', () => {
  const NUM_CHALLENGES = 1000;
  const NUM_CHAPTERS = 100;
  const CHALLENGES_PER_CHAPTER = 10;

  const challenges: Challenge[] = Array.from({ length: NUM_CHALLENGES }, (_, i) => ({
    id: `c${i}`,
    status: 'Completed',
  }));

  const storyChapters: StoryChapter[] = Array.from({ length: NUM_CHAPTERS }, (_, i) => ({
    id: `s${i}`,
    relatedChallenges: Array.from({ length: CHALLENGES_PER_CHAPTER }, (_, j) => `c${(i * CHALLENGES_PER_CHAPTER + j) % NUM_CHALLENGES}`),
  }));

  it('measures the time for O(N*M) lookup', () => {
    const start = performance.now();

    // Simulating the logic in useEffect (line 150)
    storyChapters.forEach(chapter => {
      const completed = chapter.relatedChallenges.every(id => challenges.find(c => c.id === id && c.status === 'Completed'));
    });

    // Simulating the logic in render (line 179)
    storyChapters.forEach(chapter => {
      chapter.relatedChallenges.map(id => {
        const ch = challenges.find(c => c.id === id);
        return ch ? ch.status : null;
      });
    });

    const end = performance.now();
    console.log(`Baseline execution time: ${end - start}ms`);
    expect(end - start).toBeGreaterThan(0);
  });

  it('measures the time for optimized lookup', () => {
    const start = performance.now();

    // Optimized: pre-compute map
    const challengesMap = challenges.reduce((acc, c) => {
      acc[c.id] = c;
      return acc;
    }, {} as Record<string, Challenge>);

    // Simulating the logic in useEffect (line 150)
    storyChapters.forEach(chapter => {
      const completed = chapter.relatedChallenges.every(id => {
        const ch = challengesMap[id];
        return ch && ch.status === 'Completed';
      });
    });

    // Simulating the logic in render (line 179)
    storyChapters.forEach(chapter => {
      chapter.relatedChallenges.map(id => {
        const ch = challengesMap[id];
        return ch ? ch.status : null;
      });
    });

    const end = performance.now();
    console.log(`Optimized execution time: ${end - start}ms`);
    expect(end - start).toBeLessThan(100); // Should be very fast
  });
});
