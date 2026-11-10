import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ResourcesPage, { metadata } from '@/app/(learning)/resources/page';
import ResourceLibrary from '@/app/(learning)/resources/ResourceLibrary';
import {
  RESOURCES,
  RESOURCE_GROUPS,
  VERIFIED_ON,
  matchesResourceQuery,
  resourcesInGroup,
} from '@/lib/resources';
import { resolveResources, unresolvedLessonRefs } from '@/lib/resources-lessons';

type MockNextLinkProps = React.PropsWithChildren<Omit<React.ComponentProps<'a'>, 'href'> & { href: string }>;

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: MockNextLinkProps) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(() => cleanup());

function textOf(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&apos;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
}

describe('/resources data', () => {
  it('has unique ids and https URLs on known hosts, with no guessed placeholders', () => {
    const ids = RESOURCES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    const hosts = new Set([
      'standards.ieee.org',
      'github.com',
      'www.accellera.org',
      'www.arm.com',
      'developer.arm.com',
      'www.veripool.org',
      'verilator.org',
      'steveicarus.github.io',
      'www.edaplayground.com',
      'www.cocotb.org',
      'docs.cocotb.org',
      'surfer-project.org',
      'chipsalliance.github.io',
    ]);
    for (const resource of RESOURCES) {
      const url = new URL(resource.href);
      expect(url.protocol, resource.id).toBe('https:');
      expect(hosts.has(url.hostname), `${resource.id}: ${url.hostname}`).toBe(true);
      expect(resource.summary.length, resource.id).toBeGreaterThan(40);
      expect(resource.whenToUse.length, resource.id).toBeGreaterThan(40);
    }
  });

  it('puts every resource in a declared group and leaves no group empty', () => {
    const groupIds = new Set(RESOURCE_GROUPS.map((g) => g.id));
    for (const resource of RESOURCES) expect(groupIds.has(resource.group), resource.id).toBe(true);
    for (const group of RESOURCE_GROUPS) expect(resourcesInGroup(group.id).length, group.id).toBeGreaterThan(0);
  });

  it('covers the briefed standards, AMBA specifications and tools', () => {
    const hrefs = RESOURCES.map((r) => r.href);
    for (const href of [
      'https://standards.ieee.org/ieee/1800/7743/',
      'https://standards.ieee.org/ieee/1800.2/7567/',
      'https://github.com/accellera-official/uvm-core',
      'https://developer.arm.com/documentation/ihi0022/latest/',
      'https://developer.arm.com/documentation/ihi0033/latest/',
      'https://developer.arm.com/documentation/ihi0024/latest/',
      'https://developer.arm.com/documentation/ihi0051/latest/',
      'https://www.veripool.org/verilator/',
      'https://steveicarus.github.io/iverilog/',
      'https://www.edaplayground.com/',
      'https://www.cocotb.org/',
      'https://github.com/pyuvm/pyuvm',
      'https://github.com/chipsalliance/riscv-dv',
    ]) {
      expect(hrefs, href).toContain(href);
    }
  });

  it('names only lessons that exist in the curriculum', () => {
    for (const resource of RESOURCES) expect(unresolvedLessonRefs(resource), resource.id).toEqual([]);
    const resolved = resolveResources();
    const withLessons = resolved.filter((r) => r.lessonLinks.length > 0);
    expect(withLessons.length).toBeGreaterThanOrEqual(RESOURCES.length - 3);
    for (const r of resolved) {
      for (const lesson of r.lessonLinks) expect(lesson.href).toMatch(/^\/curriculum\/T[1-4]_/);
    }
  });

  it('matches every search word against the resource text, ignoring case', () => {
    const axi = RESOURCES.find((r) => r.id === 'arm-axi')!;
    expect(matchesResourceQuery(axi, '')).toBe(true);
    expect(matchesResourceQuery(axi, 'ihi 0022')).toBe(true);
    expect(matchesResourceQuery(axi, 'AXI ordering')).toBe(true);
    expect(matchesResourceQuery(axi, 'axi python')).toBe(false);
    expect(VERIFIED_ON).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('/resources page', () => {
  it('is public, has metadata and no placeholder text', () => {
    const html = renderToStaticMarkup(<ResourcesPage />);
    expect(html).toMatch(/<h1[^>]*>Resources<\/h1>/);
    expect(html).not.toMatch(/placeholder content|coming soon|will be listed here/i);
    expect(metadata.title).toBe('Resources');
    expect(String(metadata.description)).toMatch(/IEEE GET Program/);
  });

  it('renders every resource, group, external link and the verification date in the static HTML', () => {
    const html = renderToStaticMarkup(<ResourcesPage />);
    const text = textOf(html);
    for (const resource of RESOURCES) {
      expect(html, resource.id).toContain(`href="${resource.href}"`);
    }
    for (const group of RESOURCE_GROUPS) expect(text, group.id).toContain(group.title);
    expect(text).toContain('10 November 2026');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('href="/curriculum/T3_Advanced/B-AXI-1_AXI_Channel_Architecture/index"');
  });
});

describe('ResourceLibrary filtering', () => {
  const resources = resolveResources();

  function cards(): string[] {
    return Array.from(document.querySelectorAll('[data-resource-id]')).map((el) => el.getAttribute('data-resource-id')!);
  }

  it('filters by search text and announces the count', () => {
    render(<ResourceLibrary groups={RESOURCE_GROUPS} resources={resources} />);
    expect(cards()).toHaveLength(RESOURCES.length);
    expect(screen.getByText(`Showing all ${RESOURCES.length} resources.`)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search resources'), { target: { value: 'pyuvm' } });
    expect(cards()).toContain('pyuvm');
    expect(cards()).not.toContain('arm-axi');
    expect(screen.getByText(/^Showing \d+ of \d+ resources\.$/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search resources'), { target: { value: 'zzzz-no-match' } });
    expect(cards()).toHaveLength(0);
    expect(screen.getByText(/No resource matches that search/)).toBeInTheDocument();
  });

  it('filters by group with pressed-state buttons', () => {
    render(<ResourceLibrary groups={RESOURCE_GROUPS} resources={resources} />);
    const groupBar = screen.getByRole('group', { name: 'Show resources by purpose' });
    const amba = within(groupBar).getByRole('button', { name: 'Arm AMBA protocol specifications' });
    expect(amba).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(amba);
    expect(amba).toHaveAttribute('aria-pressed', 'true');
    expect(cards().sort()).toEqual(resourcesInGroup('amba').map((r) => r.id).sort());

    fireEvent.click(within(groupBar).getByRole('button', { name: 'All' }));
    expect(cards()).toHaveLength(RESOURCES.length);
  });
});
