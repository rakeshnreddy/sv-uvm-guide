import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { HERO_HEADLINE } from '@/components/home/HeroSection';
import { getHomeStats } from '@/components/home/home-stats';
import { curriculumData } from '@/lib/curriculum-data';
import { getAllLabs } from '@/lib/lab-registry';
import { SOCIAL_IMAGE } from '@/lib/social-image';
import { SITE_NAME, SITE_TITLE_DEFAULT, SITE_TITLE_TEMPLATE } from '@/lib/site-links';

// next/font/local only runs inside the Next compiler.
vi.mock('@/app/fonts', () => ({
  plexSans: { variable: 'font-plex' },
  plexSansGreek: { variable: 'font-plex-greek' },
  jetBrainsMono: { variable: 'font-mono' },
}));

// React's cache() is a server-only export; the lesson loader wraps its reader in it.
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, cache: <T,>(fn: T) => fn };
});

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
    expect(description).not.toMatch(/definitive|mastery|!|staff[ -]level/i);
    expect(description).toContain('from your first testbench to expert level');
    expect(metadata.openGraph?.description).toBe(description);
  });

  it('asks for the large social card and leaves the images to the static files beside the layout', async () => {
    const { metadata } = await import('@/app/layout');
    // No twitter title or description, so X falls back to each page's own og:title and og:description.
    expect(metadata.twitter).toEqual({ card: 'summary_large_image' });
    // No config-based icons or images: Next.js serves the files in src/app/ (file conventions), so nothing can point elsewhere.
    expect(metadata.icons).toBeUndefined();
    expect(metadata.openGraph && 'images' in metadata.openGraph).toBe(false);
    expect(metadata.twitter && 'images' in metadata.twitter).toBe(false);
  });
});

describe('pages that set their own openGraph keep the social image', () => {
  it('names the site card in a lesson\'s metadata', async () => {
    const { generateLessonMetadata, loadCurriculumLesson } = await import('@/lib/curriculum/lesson-loader');
    const lesson = await loadCurriculumLesson(['T1_Foundational', 'F2A_Core_Data_Types', 'index']);
    expect(lesson).not.toBeNull();
    const metadata = generateLessonMetadata(lesson!);
    expect(metadata.openGraph?.title).toBe(metadata.title);
    expect(metadata.openGraph?.images).toEqual([SOCIAL_IMAGE]);
    // No twitter block of its own: the root card type applies and X reads the lesson's og:title.
    expect(metadata.twitter).toBeUndefined();
  });

  it('names the site card in a lab\'s metadata', async () => {
    const { generateMetadata } = await import('@/app/(learning)/practice/lab/[labId]/page');
    const lab = getAllLabs().find((entry) => entry.status === 'available')!;
    const metadata = generateMetadata({ params: { labId: lab.id } });
    expect(metadata.openGraph?.images).toEqual([SOCIAL_IMAGE]);
  });

  it('points at the static image with the alt text Next.js serves for it', () => {
    expect(SOCIAL_IMAGE.url).toBe('/opengraph-image.png');
    expect(pngSize(fs.readFileSync(path.join(APP, 'opengraph-image.png')))).toEqual([SOCIAL_IMAGE.width, SOCIAL_IMAGE.height]);
    expect(fs.readFileSync(path.join(APP, 'opengraph-image.alt.txt'), 'utf8').trim()).toBe(SOCIAL_IMAGE.alt);
  });
});

const APP = path.join(process.cwd(), 'src/app');

/** Width and height from a PNG's IHDR chunk. */
function pngSize(buffer: Buffer): [number, number] {
  expect(buffer.subarray(1, 4).toString('latin1')).toBe('PNG');
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

describe('app icons and social image (static files, Next.js metadata conventions)', () => {
  it.each([
    ['icon1.png', 32, 32],
    ['icon2.png', 192, 192],
    ['apple-icon.png', 180, 180],
    ['opengraph-image.png', 1200, 630],
    ['twitter-image.png', 1200, 630],
  ])('has %s at %i x %i', (file, width, height) => {
    expect(pngSize(fs.readFileSync(path.join(APP, file)))).toEqual([width, height]);
  });

  it('makes the Apple touch icon an opaque full-bleed square (iOS rounds it and fills transparency with black)', () => {
    const png = fs.readFileSync(path.join(APP, 'apple-icon.png'));
    // IHDR colour type 2: truecolour without an alpha channel.
    expect(png.readUInt8(25)).toBe(2);
  });

  it('has a favicon.ico holding 16, 32 and 48 px PNGs', () => {
    const ico = fs.readFileSync(path.join(APP, 'favicon.ico'));
    expect(ico.readUInt16LE(2)).toBe(1);
    const count = ico.readUInt16LE(4);
    const sizes = Array.from({ length: count }, (_, index) => {
      const at = 6 + index * 16;
      const png = ico.subarray(ico.readUInt32LE(at + 12), ico.readUInt32LE(at + 12) + ico.readUInt32LE(at + 8));
      expect(pngSize(png)).toEqual([ico.readUInt8(at), ico.readUInt8(at + 1)]);
      return ico.readUInt8(at);
    });
    expect(sizes).toEqual([16, 32, 48]);
  });

  it('draws the mark as one clock pulse in a 2.5 px accent stroke on the dark page colour, in a rounded square', () => {
    const svg = fs.readFileSync(path.join(APP, 'icon.svg'), 'utf8');
    expect(svg).toMatch(/<rect width="32" height="32" rx="\d+" fill="hsl\(222 26% 7%\)"\/>/);
    // Low line, rising edge, high line, falling edge.
    expect(svg).toContain('d="M6 22H13V10H26V22"');
    expect(svg).toContain('stroke="hsl(197 85% 59%)"');
    expect(svg).toContain('stroke-width="2.5"');
  });

  it('describes the social image with the site name and the headline', () => {
    for (const file of ['opengraph-image.alt.txt', 'twitter-image.alt.txt']) {
      const alt = fs.readFileSync(path.join(APP, file), 'utf8');
      expect(alt).toContain(SITE_NAME);
      expect(alt).toContain(HERO_HEADLINE);
    }
  });

  it('keeps the generator in scripts/ and no other icon or image route beside the layout', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'scripts/generate-brand-images.mjs'))).toBe(true);
    const images = fs.readdirSync(APP).filter((file) => /^(icon|apple-icon|favicon|opengraph-image|twitter-image)/.test(file)).sort();
    expect(images).toEqual([
      'apple-icon.png',
      'favicon.ico',
      'icon.svg',
      'icon1.png',
      'icon2.png',
      'opengraph-image.alt.txt',
      'opengraph-image.png',
      'twitter-image.alt.txt',
      'twitter-image.png',
    ]);
  });
});
