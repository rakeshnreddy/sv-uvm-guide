import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import matter from 'gray-matter';
import flashcardDecks, { RawFlashcard } from '../src/lib/flashcard-decks';

const repoRoot = process.cwd();

const ambaModules = [
  'B-AMBA-1_Protocol_Families_and_Tradeoffs',
  'B-AMBA-2_Protocol_Intuition_and_Memory_Hooks',
  'B-AHB-1_AHB_Design_Timing_Mechanics',
  'B-AHB-2_AHB_Pitfalls_and_Deadlocks',
  'B-AHB-3_AHB_Verification',
  'B-AXI-1_AXI_Channel_Architecture',
  'B-AXI-2_AXI_Burst_Math',
  'B-AXI-3_AXI_Ordering_and_IDs',
  'B-AXI-4_AXI_Expert_Features_Cache_Atomics',
  'B-AXI-5_AXI_Pitfalls_Interconnect_Deadlocks',
  'B-AXI-6_AXI_Verification_Performance',
  'B-AMBA-F1_Bridges_and_System_Integration',
  'B-AMBA-F2_Future_Protocols_ACE_CHI',
  'B-AMBA-F3_Interview_Debug_Clinic',
];

function hasQuestion(card: RawFlashcard): boolean {
  return Boolean(card.question ?? card.front);
}

function hasAnswer(card: RawFlashcard): boolean {
  return Boolean(card.answer ?? card.back);
}

describe('AMBA flashcard coverage', () => {
  it('registers a usable deck for every AMBA/AHB/AXI curriculum module', () => {
    ambaModules.forEach((deckId) => {
      const deck = flashcardDecks[deckId] as RawFlashcard[] | undefined;

      expect(deck, `${deckId} should be registered in flashcardDecks`).toBeDefined();
      expect(deck?.length, `${deckId} should include at least five cards`).toBeGreaterThanOrEqual(5);
      deck?.forEach((card, index) => {
        expect(hasQuestion(card), `${deckId} card ${index} should have a question/front`).toBe(true);
        expect(hasAnswer(card), `${deckId} card ${index} should have an answer/back`).toBe(true);
      });
    });
  });

  it('points each AMBA module frontmatter at its matching deck', () => {
    ambaModules.forEach((moduleId) => {
      const topicPath = path.join(repoRoot, 'content', 'curriculum', 'T3_Advanced', moduleId, 'index.mdx');
      const { data } = matter(readFileSync(topicPath, 'utf8'));

      expect(data.flashcards, `${moduleId} should declare its module deck`).toBe(moduleId);
    });
  });

  it('covers every AMBA module in the reusable interview question bank', () => {
    const bankPath = path.join(repoRoot, 'content', 'interview-questions', 'amba-protocols.json');
    const bank = JSON.parse(readFileSync(bankPath, 'utf8')) as {
      groups: Array<{ moduleId: string; questions: Array<{ prompt?: string; lookFor?: string }> }>;
    };
    const groupsByModule = new Map(bank.groups.map((group) => [group.moduleId, group]));

    ambaModules.forEach((moduleId) => {
      const group = groupsByModule.get(moduleId);

      expect(group, `${moduleId} should have an interview question group`).toBeDefined();
      expect(group?.questions.length, `${moduleId} should have reusable prompts`).toBeGreaterThanOrEqual(2);
      group?.questions.forEach((question, index) => {
        expect(question.prompt, `${moduleId} prompt ${index} should be written`).toBeTruthy();
        expect(question.lookFor, `${moduleId} rubric ${index} should be written`).toBeTruthy();
      });
    });
  });
});
