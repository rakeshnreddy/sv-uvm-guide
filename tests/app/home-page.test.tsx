import fs from 'node:fs';
import path from 'node:path';

import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import HomePage, { generateMetadata } from '@/app/(public)/page';
import { loadInterviewBanks } from '@/app/(learning)/interview-prep/interview-banks';
import { placementQuestions } from '@/components/assessment/placementQuizData';
import { getLandingFacts, landingDescription, type LandingFacts } from '@/components/home/home-stats';
import { returningLearnerScript } from '@/components/home/landing-resume';
import { curriculumData } from '@/lib/curriculum-data';
import { getAllLabs } from '@/lib/lab-registry';
import { getPracticePages } from '@/lib/practice-links';

const IMPORT_PATTERN = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|^import\s+['"]([^'"]+)['"]/gm;

/** Resolves a local specifier ('@/...' or relative) to a source file, as the bundler would; null for a package. */
function resolveLocal(specifier: string, from: string): string | null | undefined {
  const root = process.cwd();
  let base: string;
  if (specifier.startsWith('@/')) base = path.join(root, 'src', specifier.slice(2));
  else if (specifier.startsWith('.')) base = path.resolve(path.dirname(from), specifier);
  else return null;
  for (const suffix of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
    const candidate = base + suffix;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return undefined;
}

/** Every local source file reachable from the entries (static and dynamic imports), and every package they import. */
function localImportGraph(entries: readonly string[]): { files: string[]; packages: string[] } {
  const root = process.cwd();
  const seen = new Set<string>();
  const packages = new Set<string>();
  const visit = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    if (!/\.(tsx?|jsx?|mjs)$/.test(file)) return;
    for (const match of fs.readFileSync(file, 'utf8').matchAll(IMPORT_PATTERN)) {
      const specifier = match[1] ?? match[2] ?? match[3];
      const resolved = resolveLocal(specifier, file);
      if (resolved === null) packages.add(specifier);
      else if (resolved) visit(resolved);
    }
  };
  for (const entry of entries) visit(path.join(root, entry));
  return { files: [...seen].map((file) => path.relative(root, file)), packages: [...packages] };
}

vi.mock('next/link', async () => {
  const ReactModule = await import('react');
  type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean };
  const MockLink = ReactModule.forwardRef<HTMLAnchorElement, LinkProps>(({ href, children, prefetch: _prefetch, ...rest }, ref) => (
    <a ref={ref} href={href} {...rest}>
      {children}
    </a>
  ));
  MockLink.displayName = 'MockLink';
  return { __esModule: true, default: MockLink };
});

// The sections have their own tests (tests/components/home/); stubs keep this one about the page frame and its data.
vi.mock('@/components/home/HeroSection', () => ({
  __esModule: true,
  default: ({ stats, lessons, placementQuestionCount, frame }: { stats: LandingFacts; lessons: unknown[]; placementQuestionCount: number; frame: { stepIndex: number } }) => (
    <section
      aria-label="Hero"
      data-stats={`${stats.lessonCount}/${stats.tierCount}/${stats.labCount}`}
      data-lessons={lessons.length}
      data-placement={placementQuestionCount}
      data-frame-step={frame.stepIndex}
    />
  ),
}));
// Imported directly, not through next/dynamic, so the server HTML holds every section (landing-16).
vi.mock('@/components/home/ProofStrip', () => ({
  __esModule: true,
  default: ({ facts }: { facts: LandingFacts }) => <section aria-label="Proof" data-facts={JSON.stringify(facts)} />,
}));
vi.mock('@/components/home/ReturningLearnerStrip', () => ({
  __esModule: true,
  default: () => <section aria-label="Returning" />,
}));
vi.mock('@/components/home/RoutesStrip', () => ({
  __esModule: true,
  default: () => <section aria-label="Routes" />,
}));
vi.mock('@/components/home/InteractiveFeaturesSection', () => ({
  __esModule: true,
  default: () => <section aria-label="Practise" />,
}));

const expectedFacts = getLandingFacts({
  curriculum: curriculumData,
  labs: getAllLabs(),
  practicePages: getPracticePages(),
  interviewBanks: loadInterviewBanks(),
  placementQuestions,
});

afterEach(() => {
  cleanup();
});

describe('home page', () => {
  it('keeps the sections in the main landmark, in order: hero, proof, returning learner, routes, practise', () => {
    render(<HomePage />);
    const main = screen.getByRole('main');
    expect(within(main).getAllByRole('region').map((region) => region.getAttribute('aria-label'))).toEqual([
      'Hero',
      'Proof',
      'Returning',
      'Routes',
      'Practise',
    ]);
    expect(screen.queryByText('Loading Section...')).not.toBeInTheDocument();
  });

  it('passes every count from the curriculum, the lab registry, the practice pages, the interview banks and the quiz', () => {
    render(<HomePage />);
    const { lessonCount, tierCount, labCount } = expectedFacts;
    const hero = screen.getByRole('region', { name: 'Hero' });
    expect(hero).toHaveAttribute('data-stats', `${lessonCount}/${tierCount}/${labCount}`);
    expect(hero).toHaveAttribute('data-lessons', String(lessonCount));
    expect(hero).toHaveAttribute('data-placement', String(placementQuestions.length));
    expect(JSON.parse(screen.getByRole('region', { name: 'Proof' }).getAttribute('data-facts') ?? '{}')).toEqual(JSON.parse(JSON.stringify(expectedFacts)));
  });

  it('runs the returning-learner script before the sections, inside main', () => {
    const { container } = render(<HomePage />);
    const script = container.querySelector('main > script');
    expect(script?.innerHTML).toBe(returningLearnerScript());
  });

  it('builds its meta description from the same counts', () => {
    expect(generateMetadata().description).toBe(landingDescription(expectedFacts));
  });

  it('stays static: no dynamic server functions and no animation library', () => {
    const files = ['src/app/(public)/page.tsx', ...fs.readdirSync(path.join(process.cwd(), 'src/components/home')).map((file) => `src/components/home/${file}`)];
    for (const file of files) {
      const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
      expect(source, file).not.toMatch(/from ['"]next\/(headers|cache)['"]|force-dynamic|revalidate\s*=|searchParams/);
      expect(source, file).not.toMatch(/framer-motion|motion\/react|gsap|react-spring/);
    }
  });

  it('loads no animation library anywhere in the public layout\'s import graph (landing, privacy and terms)', () => {
    const graph = localImportGraph([
      'src/app/(public)/layout.tsx',
      'src/app/(public)/page.tsx',
      'src/app/(public)/privacy-policy/page.tsx',
      'src/app/(public)/terms-of-service/page.tsx',
    ]);
    // The walk reaches the header, its controls and the lazily loaded search dialog.
    expect(graph.files).toContain('src/components/layout/PublicHeaderControls.tsx');
    expect(graph.files).toContain('src/components/search/SearchDialog.tsx');
    const animation = graph.packages.filter((pkg) => /^(framer-motion|motion|gsap|react-spring)(\/|$)/.test(pkg));
    expect(animation).toEqual([]);
  });

  it('ends with the site footer, which links to the privacy policy and the terms', () => {
    render(<HomePage />);
    const footer = screen.getByRole('contentinfo');
    expect(screen.getByRole('main')).not.toContainElement(footer);
    const siteMap = within(footer).getByRole('navigation', { name: 'Site map' });
    expect(within(footer).getByRole('link', { name: 'Privacy policy' })).toHaveAttribute('href', '/privacy-policy');
    expect(within(footer).getByRole('link', { name: 'Terms of service' })).toHaveAttribute('href', '/terms-of-service');
    expect(within(siteMap).getByRole('link', { name: 'Labs' })).toHaveAttribute('href', '/practice#labs');
    // The project is MIT licensed, so the footer says so and links the source (landing-2).
    expect(footer).toHaveTextContent('MIT licensed');
    expect(footer).not.toHaveTextContent(/All rights reserved/i);
    expect(within(footer).getByRole('link', { name: 'Source on GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/rakeshnreddy/sv-uvm-guide',
    );
    // The shortcuts dialog lives in the learning layout, so the home page does not offer it.
    expect(within(footer).queryByRole('button', { name: 'Keyboard shortcuts' })).not.toBeInTheDocument();
  });
});
