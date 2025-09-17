import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import matter from 'gray-matter';

const topicRoot = path.join(process.cwd(), 'content', 'curriculum');

const templateHeadings = [
  '## Quick Take',
  '## Build Your Mental Model',
  '## Make It Work',
  '## Push Further',
  '## Practice & Reinforce',
  '## References & Next Topics',
];

// Track files already migrated to the new template.
const migratedTopics = [
  'T1_Foundational/F1_Why_Verification/index.mdx',
  'T1_Foundational/F2_Data_Types/index.mdx',
  'T1_Foundational/F3_Procedural_Constructs/index.mdx',
  'T1_Foundational/F4_RTL_and_Testbench_Constructs/index.mdx',
  'T2_Intermediate/I-SV-1_OOP/index.mdx',
  'T2_Intermediate/I-SV-2_Constrained_Randomization/index.mdx',
];

describe('Curriculum topic template compliance', () => {
  migratedTopics.forEach((relativePath) => {
    const filePath = path.join(topicRoot, relativePath);
    const fileId = relativePath.replace(/\\/g, '/');

    it(`${fileId} includes required headings in order`, () => {
      const content = readFileSync(filePath, 'utf8');
      let lastIndex = -1;
      templateHeadings.forEach((heading) => {
        const index = content.indexOf(heading);
        expect(index, `${heading} missing in ${fileId}`).toBeGreaterThan(-1);
        expect(index, `${heading} out of order in ${fileId}`).toBeGreaterThan(lastIndex);
        lastIndex = index;
      });
    });

    it(`${fileId} front matter includes required fields`, () => {
      const raw = readFileSync(filePath, 'utf8');
      const { data } = matter(raw);
      expect(data.title, `title missing in ${fileId}`).toBeTruthy();
      expect(data.description, `description missing in ${fileId}`).toBeTruthy();
      expect(data.flashcards, `flashcards missing in ${fileId}`).toBeTruthy();
    });
  });
});
