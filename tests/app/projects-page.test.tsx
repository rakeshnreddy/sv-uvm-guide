import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PROJECT_BRIEFS } from '@/app/(learning)/projects/projects-data';
import { resolveProjects } from '@/app/(learning)/projects/resolve-projects';
import { getLabById } from '@/lib/lab-registry';
import { MILESTONES } from '@/lib/learning-paths';

/*
 * /projects: one project brief per milestone (M0-M8). Every lesson and lab a
 * brief names must resolve through the practice-links helpers, and labs that
 * are not available render as text, never as a link. The page is public: it
 * renders whatever SITE_FEATURES.draftPages says.
 */

type PageModule = { default: () => React.ReactElement; dynamic?: string };

const notFound = vi.fn((): never => {
  throw new Error('notFound');
});

type MockNextLinkProps = React.PropsWithChildren<Omit<React.ComponentProps<'a'>, 'href'> & { href: string }>;

async function loadPage(draftPages: boolean): Promise<PageModule> {
  vi.resetModules();
  vi.doMock('@/lib/site-features', () => ({ __esModule: true, SITE_FEATURES: Object.freeze({ draftPages }) }));
  vi.doMock('next/navigation', () => ({ __esModule: true, notFound }));
  vi.doMock('next/link', () => ({
    __esModule: true,
    default: ({ href, children, ...rest }: MockNextLinkProps) => (
      <a href={href} {...rest}>
        {children}
      </a>
    ),
  }));
  return import('@/app/(learning)/projects/page') as Promise<PageModule>;
}

async function renderPage(): Promise<string> {
  const page = await loadPage(true);
  return renderToStaticMarkup(page.default());
}

function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
}

afterEach(() => {
  vi.clearAllMocks();
  for (const mocked of ['@/lib/site-features', 'next/navigation', 'next/link']) vi.doUnmock(mocked);
  vi.resetModules();
});

describe('project briefs data', () => {
  it('has exactly one brief per milestone, in ladder order', () => {
    expect(PROJECT_BRIEFS.map((brief) => brief.milestone)).toEqual(MILESTONES.map((m) => m.id));
  });

  it('fills every part of every brief', () => {
    for (const brief of PROJECT_BRIEFS) {
      expect(brief.goal.length, brief.milestone).toBeGreaterThan(40);
      expect(brief.dut.name, brief.milestone).not.toBe('');
      expect(brief.dut.description.length, brief.milestone).toBeGreaterThan(40);
      expect(brief.requiredFeatures.length, brief.milestone).toBeGreaterThanOrEqual(4);
      expect(brief.acceptance.length, brief.milestone).toBeGreaterThanOrEqual(4);
      expect(brief.lessons.length, brief.milestone).toBeGreaterThanOrEqual(3);
      expect(brief.labs.length, brief.milestone).toBeGreaterThanOrEqual(1);
      expect(brief.stretch.length, brief.milestone).toBeGreaterThanOrEqual(2);
      expect(brief.effort, brief.milestone).toMatch(/\d+ to \d+ hours/);
      expect(brief.tools, brief.milestone).not.toBe('');
    }
  });

  it('lists the milestone lab among the preparing labs', () => {
    for (const milestone of MILESTONES) {
      if (!milestone.lab) continue;
      const brief = PROJECT_BRIEFS.find((entry) => entry.milestone === milestone.id);
      expect(brief?.labs, milestone.id).toContain(milestone.lab);
    }
  });

  it('names only labs in the registry, none archived', () => {
    for (const brief of PROJECT_BRIEFS) {
      for (const id of brief.labs) {
        const lab = getLabById(id);
        expect(lab, `${brief.milestone}: ${id}`).toBeDefined();
        expect(lab?.status, `${brief.milestone}: ${id}`).not.toBe('archived');
      }
    }
  });

  it('resolves every lesson and lab to a canonical URL', () => {
    const projects = resolveProjects();
    expect(projects).toHaveLength(MILESTONES.length);
    for (const project of projects) {
      expect(project.lessonLinks).toHaveLength(project.lessons.length);
      for (const lesson of project.lessonLinks) {
        expect(lesson.href).toMatch(/^\/curriculum\/T[1-4]_[A-Za-z]+\/[^/]+\/[^/]+$/);
      }
      for (const lab of project.labItems) {
        if (lab.status === 'available') expect(lab.href).toBe(`/practice/lab/${lab.id.replace(/^lab:/, '')}`);
        else expect(lab.href).toBeUndefined();
      }
    }
  });
});

describe('/projects page', () => {
  it('renders while draft pages are off, since the page is public', async () => {
    const page = await loadPage(false);
    expect(() => page.default()).not.toThrow();
    expect(notFound).not.toHaveBeenCalled();
  });

  it('is static and carries no placeholder text', async () => {
    const page = await loadPage(true);
    expect(page.dynamic).toBeUndefined();
    const html = renderToStaticMarkup(page.default());
    expect(html).toMatch(/<h1[^>]*>Projects<\/h1>/);
    for (const banned of ['Placeholder', 'from blueprint', 'TODO', 'Lorem', 'will launch']) {
      expect(html, banned).not.toContain(banned);
    }
  });

  it('shows every milestone with its sections', async () => {
    const html = await renderPage();
    const text = textOf(html);
    for (const milestone of MILESTONES) {
      expect(html, milestone.id).toContain(`id="project-${milestone.id.toLowerCase()}"`);
      expect(html, milestone.id).toContain(`href="#project-${milestone.id.toLowerCase()}"`);
      expect(text, milestone.id).toContain(milestone.name);
    }
    for (const heading of ['Required features', 'Acceptance criteria', 'Prepare with', 'Stretch goals']) {
      expect(html.match(new RegExp(`<h3[^>]*>${heading}</h3>`, 'g')) ?? [], heading).toHaveLength(MILESTONES.length);
    }
    expect(html.match(/<h3[^>]*>Design under test: /g) ?? []).toHaveLength(MILESTONES.length);
  });

  it('links every preparing lesson and every available lab, and no unavailable lab', async () => {
    const html = await renderPage();
    for (const project of resolveProjects()) {
      for (const lesson of project.lessonLinks) expect(html, lesson.ref).toContain(`href="${lesson.href}"`);
      for (const lab of project.labItems) {
        const labId = lab.id.replace(/^lab:/, '');
        if (lab.href) {
          expect(html, labId).toContain(`href="${lab.href}"`);
        } else {
          expect(html, labId).not.toContain(`href="/practice/lab/${labId}"`);
          expect(textOf(html), labId).toContain(`${lab.title} (lab coming soon)`);
        }
      }
    }
    expect(html).toContain('href="/practice#labs"');
  });

  it('says plainly that projects are self-checked and keep no progress claims', async () => {
    const text = textOf(await renderPage());
    expect(text).toContain('Nothing on this site runs or grades a project.');
    expect(text).not.toMatch(/mark (as )?done|in progress|sign in|log in/i);
  });
});
