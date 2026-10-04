import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { appRouteExists } from '../fixtures/site-routes';

// Page modules use the automatic JSX runtime; the test transform expects a global React.
(globalThis as typeof globalThis & { React?: typeof React }).React = React;

type MockNextLinkProps = React.PropsWithChildren<Omit<React.ComponentProps<'a'>, 'href'> & { href: string }>;

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: MockNextLinkProps) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function hrefs(html: string): string[] {
  return [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
}

function count(html: string, pattern: RegExp): number {
  return [...html.matchAll(pattern)].length;
}

describe('/curriculum', () => {
  it('renders one h1, no main of its own, the routes, the tiers and only links that resolve', async () => {
    const { default: CurriculumPage } = await import('@/app/(learning)/curriculum/page');
    const html = renderToStaticMarkup(<CurriculumPage />);

    expect(count(html, /<h1[\s>]/g)).toBe(1);
    expect(html).not.toMatch(/<main[\s>]/);
    expect(html).toContain('id="routes"');
    for (const id of ['route-junior', 'route-practitioner', 'route-expert', 't1', 't2', 't3', 't4', 'modules']) {
      expect(html, id).toContain(`id="${id}"`);
    }
    // No placeholder diagram, no dead filters, no unbacked "Recommended For You".
    expect(html).not.toMatch(/Placeholder|All Difficulties|All Statuses|Recommended For You/);
    expect(html).toContain('Explore the verification stack');

    const links = hrefs(html).filter((href) => href.startsWith('/'));
    expect(links.length).toBeGreaterThan(20);
    for (const href of links) expect(appRouteExists(href), href).toBe(true);
    expect(links).toContain('/curriculum/expert-index');
    expect(links).toContain('/quiz/placement');
  }, 30_000);
});

describe('/curriculum/expert-index', () => {
  it('renders one h1, every tier and only links that resolve', async () => {
    const { default: ExpertIndexPage } = await import('@/app/(learning)/curriculum/expert-index/page');
    const html = renderToStaticMarkup(<ExpertIndexPage />);

    expect(count(html, /<h1[\s>]/g)).toBe(1);
    expect(html).not.toMatch(/<main[\s>]/);
    for (const id of ['t1', 't2', 't3', 't4']) expect(html, id).toContain(`id="${id}"`);
    expect(html).toContain('aria-current="page"');

    const links = hrefs(html).filter((href) => href.startsWith('/'));
    for (const href of links) expect(appRouteExists(href), href).toBe(true);
    // Every module is listed, tagged or not.
    expect(count(html, /href="\/curriculum\/T\d_[^"#]+\/index"/g)).toBeGreaterThanOrEqual(69);
  }, 30_000);
});
