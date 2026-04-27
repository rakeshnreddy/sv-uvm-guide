import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import { validateSourcesArray } from '../../src/lib/source-metadata-schema';

// Directories and specific files that are considered "source-critical"
// i.e. they make normative claims about protocol or language standards.
const SOURCE_CRITICAL_PAGES = [
  'T3_Advanced/B-AHB-1_AHB_Design_Timing_Mechanics/index.mdx',
  'T3_Advanced/B-AHB-2_AHB_Pitfalls_and_Deadlocks/index.mdx',
  'T3_Advanced/B-AXI-1_AXI_Channel_Architecture/index.mdx',
  'T3_Advanced/B-AXI-2_AXI_Burst_Math/index.mdx',
  'T3_Advanced/B-AXI-3_AXI_Ordering_and_IDs/index.mdx',
  'T3_Advanced/B-AMBA-F2_Future_Protocols_ACE_CHI/index.mdx',
  'T1_Foundational/F3B_Scheduling_Regions/index.mdx',
];

describe('Source Metadata Audit', () => {
  const contentDir = path.join(process.cwd(), 'content', 'curriculum');

  it.each(SOURCE_CRITICAL_PAGES)('should have valid source metadata in %s', (relativePath) => {
    const filePath = path.join(contentDir, relativePath);
    expect(fs.existsSync(filePath)).toBe(true);

    const content = fs.readFileSync(filePath, 'utf-8');
    const { data } = matter(content);

    // Ensure 'sources' frontmatter exists and is an array
    expect(data).toHaveProperty('sources');
    expect(Array.isArray(data.sources)).toBe(true);

    // Validate the array against our schema
    const isValid = validateSourcesArray(data.sources);
    
    if (!isValid) {
      console.error(`Invalid sources metadata in ${relativePath}:`, data.sources);
    }
    
    expect(isValid).toBe(true);
    
    // Ensure primary sources are standard or vendor type
    data.sources.forEach((source: any) => {
      expect(['standard', 'vendor', 'tertiary']).toContain(source.type);
    });
    
    // For these critical pages, we expect at least one 'standard' type source
    // to back up normative claims.
    const hasStandardSource = data.sources.some((s: any) => s.type === 'standard');
    expect(hasStandardSource).toBe(true);
  });
});
