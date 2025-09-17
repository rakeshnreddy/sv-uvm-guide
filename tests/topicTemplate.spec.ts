import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import matter from 'gray-matter';

const repoRoot = process.cwd();
const migrationTrackerPath = path.join(repoRoot, 'docs', 'topic-template-migration.md');

const templateHeadings = [
  '## Quick Take',
  '## Build Your Mental Model',
  '## Make It Work',
  '## Push Further',
  '## Practice & Reinforce',
  '## References & Next Topics',
];

function parseMigratedTopicPaths(): string[] {
  if (!existsSync(migrationTrackerPath)) {
    throw new Error('Missing topic template migration tracker markdown file.');
  }

  const raw = readFileSync(migrationTrackerPath, 'utf8');
  const topics = new Set<string>();

  raw.split('\n').forEach((line) => {
    if (!line.startsWith('|')) {
      return;
    }

    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('| ---')) {
      return;
    }

    const cells = trimmedLine
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());

    if (cells.length < 4 || cells[0] === 'Tier') {
      return;
    }

    const topicPathCell = cells[2];
    const statusCell = cells[3];
    if (!statusCell.includes('✅')) {
      return;
    }

    const pathMatch = topicPathCell.match(/`([^`]+)`/);
    const normalizedPath = (pathMatch ? pathMatch[1] : topicPathCell)
      .replace(/^\.\//, '')
      .replace(/\\/g, '/');

    if (normalizedPath.length > 0) {
      topics.add(normalizedPath);
    }
  });

  return Array.from(topics);
}

const migratedTopics = parseMigratedTopicPaths();

describe('Curriculum topic template compliance', () => {
  it('has at least one migrated topic recorded in the tracker', () => {
    expect(migratedTopics.length).toBeGreaterThan(0);
  });

  migratedTopics.forEach((recordedPath) => {
    const sanitizedPath = recordedPath
      .replace(/^\.\//, '')
      .replace(/\\/g, '/');
    const absolutePath = path.join(repoRoot, sanitizedPath);
    const curriculumRelativePath = sanitizedPath.startsWith('content/curriculum/')
      ? sanitizedPath.replace('content/curriculum/', '')
      : sanitizedPath;
    const displayId = curriculumRelativePath.replace(/\\/g, '/');

    it(`${displayId} exists and includes required headings in order`, () => {
      expect(sanitizedPath.startsWith('content/curriculum/'), `${sanitizedPath} should live under content/curriculum/`).toBe(true);
      expect(existsSync(absolutePath), `${displayId} listed in migration tracker but missing on disk`).toBe(true);

      const content = readFileSync(absolutePath, 'utf8');
      let lastIndex = -1;
      templateHeadings.forEach((heading) => {
        const index = content.indexOf(heading);
        expect(index, `${heading} missing in ${displayId}`).toBeGreaterThan(-1);
        expect(index, `${heading} out of order in ${displayId}`).toBeGreaterThan(lastIndex);
        lastIndex = index;
      });
    });

    it(`${displayId} front matter includes required fields`, () => {
      const raw = readFileSync(absolutePath, 'utf8');
      const { data } = matter(raw);
      expect(data.title, `title missing in ${displayId}`).toBeTruthy();
      expect(data.description, `description missing in ${displayId}`).toBeTruthy();
      expect(data.flashcards, `flashcards missing in ${displayId}`).toBeTruthy();
    });
  });
});
