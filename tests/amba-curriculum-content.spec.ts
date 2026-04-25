import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import matter from 'gray-matter';

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

const expectedVisualizerTags: Record<string, string> = {
  'B-AMBA-1_Protocol_Families_and_Tradeoffs': '<AmbaFamilyExplorer />',
  'B-AMBA-2_Protocol_Intuition_and_Memory_Hooks': '<ProtocolAnalogyExplorer />',
  'B-AHB-1_AHB_Design_Timing_Mechanics': '<AhbPipelineBurstVisualizer />',
  'B-AXI-1_AXI_Channel_Architecture': '<AxiChannelHandshakeVisualizer />',
  'B-AXI-2_AXI_Burst_Math': '<AxiMemoryMathVisualizer />',
  'B-AXI-3_AXI_Ordering_and_IDs': '<AxiIdOrderingVisualizer />',
  'B-AXI-4_AXI_Expert_Features_Cache_Atomics': '<ExclusiveAccessVisualizer />',
  'B-AXI-5_AXI_Pitfalls_Interconnect_Deadlocks': '<AxiDeadlockSimulator />',
  'B-AMBA-F1_Bridges_and_System_Integration': '<BridgeTranslationExplorer />',
};

const readModule = (moduleId: string) => {
  const filePath = path.join(repoRoot, 'content', 'curriculum', 'T3_Advanced', moduleId, 'index.mdx');
  return readFileSync(filePath, 'utf8');
};

describe('AMBA curriculum content coverage', () => {
  it('keeps every AMBA/AHB/AXI module linked to flashcards and quiz practice', () => {
    ambaModules.forEach((moduleId) => {
      const raw = readModule(moduleId);
      const { data, content } = matter(raw);
      const quizQuestionCount =
        (content.match(/<QuizQuestion/g) ?? []).length + (content.match(/question:/g) ?? []).length;

      expect(data.flashcards, `${moduleId} should link to its flashcard deck`).toBe(moduleId);
      expect(content, `${moduleId} should include quiz reinforcement`).toContain('<Quiz');
      expect(quizQuestionCount, `${moduleId} should include at least three quiz questions`).toBeGreaterThanOrEqual(3);
    });
  });

  it('keeps each AMBA visualizer embedded in its curriculum page', () => {
    Object.entries(expectedVisualizerTags).forEach(([moduleId, tag]) => {
      expect(readModule(moduleId), `${moduleId} should embed ${tag}`).toContain(tag);
    });
  });

  it('keeps the bridge debug lab linked from the bridge integration module', () => {
    expect(readModule('B-AMBA-F1_Bridges_and_System_Integration')).toContain(
      '<LabLink labId="ahb-axi-bridge-debug" />',
    );
  });
});
