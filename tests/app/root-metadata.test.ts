import { describe, expect, it, vi } from 'vitest';

import { getHomeStats } from '@/components/home/home-stats';
import { curriculumData } from '@/lib/curriculum-data';
import { getAllLabs } from '@/lib/lab-registry';
import { SITE_NAME, SITE_TITLE_DEFAULT, SITE_TITLE_TEMPLATE } from '@/lib/site-links';

// next/font/local only runs inside the Next compiler.
vi.mock('@/app/fonts', () => ({
  plexSans: { variable: 'font-plex' },
  plexSansGreek: { variable: 'font-plex-greek' },
  jetBrainsMono: { variable: 'font-mono' },
}));

describe('root metadata', () => {
  it('takes the title template, default title and site name from site-links.ts', async () => {
    const { metadata } = await import('@/app/layout');
    expect(metadata.title).toEqual({ default: SITE_TITLE_DEFAULT, template: SITE_TITLE_TEMPLATE });
    expect(metadata.openGraph?.siteName).toBe(SITE_NAME);
    expect(metadata.openGraph?.title).toBe(SITE_TITLE_DEFAULT);
  });

  it('describes the site with counts from the curriculum and the lab registry', async () => {
    const { metadata } = await import('@/app/layout');
    const { lessonCount, tierCount, labCount } = getHomeStats(curriculumData, getAllLabs());
    const description = String(metadata.description);
    expect(description).toContain(`${lessonCount} lessons in ${tierCount} tiers`);
    expect(description).toContain(`${labCount} guided labs`);
    expect(description).toMatch(/SystemVerilog, UVM and AMBA verification/);
    expect(description).not.toMatch(/definitive|mastery|!/i);
    expect(metadata.openGraph?.description).toBe(description);
  });
});
