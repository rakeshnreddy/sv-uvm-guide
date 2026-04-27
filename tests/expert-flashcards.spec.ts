import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import matter from 'gray-matter';
import flashcardDecks, { RawFlashcard } from '../src/lib/flashcard-decks';

const repoRoot = process.cwd();

const expertModules = [
  'E-CUST-1_UVM_Methodology_Customization',
  'E-DBG-1_Advanced_UVM_Debug_Methodologies',
  'E-INT-1_Integrating_UVM_with_Formal_Verification',
  'E-PERF-1_UVM_Performance',
  'E-SOC-1_SoC-Level_Verification_Strategies',
  'E-PSS-1_Portable_Stimulus_Standard',
  'E-PYUVM-1_Python_Based_Verification',
  'E-AI-1_AI_Driven_Verification',
  'E-RISCV-1_RISC_V_Verification_Methodology',
  'E-UVM-ML-1_Multi_Language_Verification',
  'E-EMU-1_Emulation_Aware_Verification',
  'E-PWR-1_Power_Aware_Verification'
];

function hasQuestion(card: RawFlashcard): boolean {
  return Boolean(card.question ?? card.front);
}

function hasAnswer(card: RawFlashcard): boolean {
  return Boolean(card.answer ?? card.back);
}

describe('Expert (T4) flashcard coverage', () => {
  it('points each Expert module frontmatter at its matching deck and deck exists', () => {
    expertModules.forEach((moduleId) => {
      const topicPath = path.join(repoRoot, 'content', 'curriculum', 'T4_Expert', moduleId, 'index.mdx');
      const { data } = matter(readFileSync(topicPath, 'utf8'));

      const deckId = data.flashcards;
      expect(deckId, `${moduleId} should declare a flashcards deck in its frontmatter`).toBeDefined();

      const deck = flashcardDecks[deckId] as RawFlashcard[] | undefined;
      expect(deck, `${deckId} should be registered in flashcardDecks`).toBeDefined();
      expect(deck?.length, `${deckId} should include at least five cards`).toBeGreaterThanOrEqual(5);
      
      deck?.forEach((card, index) => {
        expect(hasQuestion(card), `${deckId} card ${index} should have a question/front`).toBe(true);
        expect(hasAnswer(card), `${deckId} card ${index} should have an answer/back`).toBe(true);
      });
    });
  });
});
