import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ProseDefault, { PROSE_CLASS, PROSE_MEASURE_CHILDREN_CLASS, PROSE_MEASURE_CLASS, Prose } from '@/components/ui/Prose';

describe('Prose', () => {
  it('builds on the typography plugin, leaves the column uncapped and caps direct text children at the 68-character measure', () => {
    const recipe = PROSE_CLASS.split(' ');
    expect(recipe).toEqual(expect.arrayContaining(['prose', 'max-w-none', 'min-w-0']));
    // In em, not ch: 68ch measured about 90 characters a line in IBM Plex Sans.
    expect(PROSE_MEASURE_CLASS).toBe('max-w-[30em]');
    for (const tag of ['p', 'ul', 'ol', 'dl', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']) {
      expect(recipe).toContain(`[&>${tag}]:max-w-[30em]`);
    }
    // Figures, tables, code blocks and interactives are not capped.
    for (const tag of ['figure', 'table', 'pre', 'div']) {
      expect(PROSE_MEASURE_CHILDREN_CLASS).not.toContain(`[&>${tag}]`);
    }
    expect(recipe).toEqual(expect.arrayContaining(['[&>.not-prose]:max-w-none', '[&>[data-full-width]]:max-w-none']));
  });

  it('renders the wrapper with the recipe, as the chosen element', () => {
    render(
      <Prose as="article" className="mt-8" aria-label="Lesson">
        <p>Text</p>
      </Prose>,
    );
    const article = screen.getByRole('article', { name: 'Lesson' });
    expect(article).toHaveAttribute('data-prose');
    expect(article.className.split(' ')).toEqual(expect.arrayContaining(['prose', 'mt-8', '[&>p]:max-w-[30em]']));
    expect(ProseDefault).toBe(Prose);
  });
});
