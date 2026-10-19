import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import LearningStrategiesPage, { metadata } from '@/app/(learning)/learning-strategies/page';
import sitemap from '@/app/sitemap';

type MockNextLinkProps = React.PropsWithChildren<Omit<React.ComponentProps<'a'>, 'href'> & { href: string }>;

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: MockNextLinkProps) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function renderPage(): string {
  return renderToStaticMarkup(<LearningStrategiesPage />);
}

/** The visible text, without tags. */
function textOf(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&apos;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
}

describe('/learning-strategies', () => {
  it('is a real guide with no placeholder text', () => {
    const html = renderPage();

    expect(html).not.toContain('[Placeholder');
    expect(html).not.toContain('Placeholder');
    expect(html).not.toContain('from blueprint');
    expect(html).not.toContain('Loading visualization');
    expect(html).toMatch(/<h1[^>]*>Learning strategies<\/h1>/);
  });

  it('has metadata', () => {
    expect(metadata.title).toBe('Learning strategies');
    expect(String(metadata.description)).toMatch(/retrieval practice and spaced review/);
  });

  it('links the review queue, the notebook, placement, the labs, the exercises and the backup controls', () => {
    const html = renderPage();

    for (const href of ['/dashboard/review', '/dashboard/notebook', '/quiz/placement', '/practice#labs', '/exercises', '/settings#data']) {
      expect(html, href).toContain(`href="${href}"`);
    }
  });

  it('covers retrieval and spacing, the four ratings, Teach it back, quizzes and deliberate practice', () => {
    const text = textOf(renderPage());

    for (const phrase of [
      'Why retrieval and spacing work',
      'Reinforce the essentials',
      'Again',
      'Hard',
      'Good',
      'Easy',
      'Teach it back',
      // The practice block (with Teach it back) comes before References & Next Topics, so it is near the end, not last.
      'Near the end of every lesson, Teach it back asks you to explain the topic in your own words',
      'Save to notebook',
      'Practice & Reinforce',
      'Deliberate practice',
      'structural check in your browser: it does not compile or simulate',
      'saved in this browser only',
    ]) {
      expect(text, phrase).toContain(phrase);
    }
    expect(text).not.toContain('Every lesson ends with');
  });

  it('makes no claims about AI grading or sign-in', () => {
    const text = textOf(renderPage());

    expect(text).not.toMatch(/\bAI\b/);
    expect(text).not.toMatch(/sign[ -]?in/i);
  });

  it('stays in the sitemap', () => {
    expect(sitemap().some((entry) => new URL(entry.url).pathname === '/learning-strategies')).toBe(true);
  });
});
