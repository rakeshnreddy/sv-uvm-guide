import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SectionDefault, {
  SECTION_CLASS,
  SECTION_DESCRIPTION_CLASS,
  SECTION_ANCHORED_HEADING_CLASS,
  SECTION_HEADING_CLASS,
  Section,
} from '@/components/layout/Section';

describe('Section', () => {
  it('is a region labelled by its h2, with the anchor id on the section', () => {
    render(
      <Section id="labs" title="Labs" description="Hands-on benches for each tier">
        <p>Body</p>
      </Section>,
    );
    const region = screen.getByRole('region', { name: 'Labs' });
    expect(region).toHaveAttribute('id', 'labs');
    const heading = screen.getByRole('heading', { level: 2, name: 'Labs' });
    expect(heading).toHaveAttribute('id', 'labs-heading');
    expect(heading.className).toBe(SECTION_HEADING_CLASS);
    expect(screen.getByText('Hands-on benches for each tier').className).toBe(SECTION_DESCRIPTION_CLASS);
    expect(region).toHaveAttribute('data-section');
  });

  it('can put the anchor id on the heading, which then clears the sticky header and labels the section', () => {
    const { container } = render(<Section id="labs" anchor="heading" title="Labs" />);
    const heading = screen.getByRole('heading', { level: 2, name: 'Labs' });
    expect(heading).toHaveAttribute('id', 'labs');
    expect(heading.className).toBe(SECTION_ANCHORED_HEADING_CLASS);
    expect(heading).toHaveClass('scroll-mt-24', 'text-h2', 'text-foreground');
    const region = screen.getByRole('region', { name: 'Labs' });
    expect(region).not.toHaveAttribute('id');
    expect(region).toHaveAttribute('aria-labelledby', 'labs');
    expect(container.querySelectorAll('#labs')).toHaveLength(1);
  });

  it('keeps the h2 look at any heading level', () => {
    render(<Section id="deep" title="Deeper" level={3} />);
    const heading = screen.getByRole('heading', { level: 3, name: 'Deeper' });
    expect(heading.className).toContain('text-h2');
  });

  it('puts 48 px between adjacent sections only, and clears the sticky header on anchors', () => {
    expect(SECTION_CLASS.split(' ')).toEqual(['scroll-mt-24', '[[data-section]+&]:mt-12']);
    expect(SECTION_HEADING_CLASS).toBe('text-h2 text-foreground');
    expect(SECTION_DESCRIPTION_CLASS).toContain('text-muted-foreground');
  });

  it('renders an action beside the heading, and leaves out empty slots', () => {
    const { container } = render(<Section id="x" title="Reviews" action={<a href="/review">All reviews</a>} className="pt-2" />);
    expect(screen.getByRole('link', { name: 'All reviews' })).toBeInTheDocument();
    expect(container.querySelector('p')).toBeNull();
    expect(container.querySelector('section')!.className).toContain('pt-2');
    expect(SectionDefault).toBe(Section);
  });
});
