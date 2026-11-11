import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TabStripScroll, hiddenEdges, scrollLeftToShow } from '@/components/interview/TabStripScroll';

describe('hiddenEdges', () => {
  it('names the edges that hide content', () => {
    expect(hiddenEdges(0, 300, 300)).toBeUndefined();
    expect(hiddenEdges(0, 507, 358)).toBe('end');
    expect(hiddenEdges(149, 507, 358)).toBe('start');
    expect(hiddenEdges(60, 507, 358)).toBe('both');
  });
});

describe('scrollLeftToShow', () => {
  it('keeps a visible item where it is and centres one that is cut off, within the scroll range', () => {
    expect(scrollLeftToShow(0, 358, 507, 40, 80)).toBe(0);
    expect(scrollLeftToShow(0, 358, 507, 330, 60)).toBe(149);
    expect(scrollLeftToShow(0, 358, 700, 330, 60)).toBe(181);
    expect(scrollLeftToShow(200, 358, 700, 0, 60)).toBe(0);
  });
});

describe('TabStripScroll', () => {
  it('is a labelled navigation landmark around the server markup, and marks itself measured', () => {
    render(
      <TabStripScroll label="Interview banks">
        <ul>
          <li>
            <a href="/a" aria-current="page">
              A
            </a>
          </li>
        </ul>
      </TabStripScroll>,
    );
    const nav = screen.getByRole('navigation', { name: 'Interview banks' });
    expect(nav).toHaveAttribute('data-measured');
    expect(nav).toHaveClass('overflow-x-auto');
    expect(screen.getByRole('link', { name: 'A' })).toHaveAttribute('aria-current', 'page');
  });
});
