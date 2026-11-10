import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';

import InteractiveFeaturesSection from '@/components/home/InteractiveFeaturesSection';
import { LABS_HREF } from '@/lib/site-links';
import { appRouteExists } from '../fixtures/site-routes';

afterEach(() => {
  cleanup();
});

describe('home feature cards (landing-18, landing-1)', () => {
  it('give each card a link that says where it goes', () => {
    render(<InteractiveFeaturesSection />);
    expect(screen.queryByRole('link', { name: /Try It Now/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Step through the scheduler' })).toHaveAttribute(
      'href',
      '/curriculum/T1_Foundational/F3C_Delta_Cycles_and_Race_Conditions/index',
    );
    expect(screen.getByRole('link', { name: 'Open the architecture map' })).toHaveAttribute(
      'href',
      '/practice/visualizations/uvm-architecture',
    );
    expect(screen.getByRole('link', { name: 'Try an exercise' })).toHaveAttribute('href', '/exercises');
    expect(screen.getByRole('link', { name: 'Browse the labs' })).toHaveAttribute('href', LABS_HREF);
  });

  it('links only pages that exist', () => {
    render(<InteractiveFeaturesSection />);
    for (const link of screen.getAllByRole('link')) {
      const href = link.getAttribute('href') ?? '';
      expect(appRouteExists(href), href).toBe(true);
    }
  });

  it('renders visible in the server HTML, full width, with no entrance animation styles', () => {
    const html = renderToStaticMarkup(<InteractiveFeaturesSection />);
    expect(html).not.toMatch(/opacity:\s*0/);
    expect(html).not.toMatch(/transform:/);
    expect(html).toMatch(/<section class="w-full/);
  });
});
