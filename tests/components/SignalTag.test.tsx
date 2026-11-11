import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SignalTagDefault, { SignalTag, signalTagClass } from '@/components/ui/SignalTag';

type MockNextLinkProps = React.PropsWithChildren<Omit<React.ComponentProps<'a'>, 'href'> & { href: string }>;

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: MockNextLinkProps) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe('SignalTag', () => {
  it('renders the code exactly as given in mono 12/16 at 500, secondary text, radius 4, hairline, 2 x 6 px padding', () => {
    render(<SignalTag code="I-UVM-1C" />);
    const tag = screen.getByText('I-UVM-1C');
    expect(tag.tagName).toBe('SPAN');
    expect(tag.textContent).toBe('I-UVM-1C');
    expect(tag).toHaveClass(
      'font-mono',
      'text-label',
      'font-medium',
      'text-muted-foreground',
      'rounded',
      'border',
      'border-border',
      'px-1.5',
      'py-0.5',
      'whitespace-nowrap',
    );
    expect(tag).toHaveAttribute('translate', 'no');
    expect(tag).toHaveAttribute('data-signal-tag');
  });

  it('does not change the case of a code', () => {
    render(<SignalTag code="b-axi-1" />);
    expect(screen.getByText('b-axi-1').textContent).toBe('b-axi-1');
  });

  it('has no background in lists and the raised background when standalone', () => {
    const { rerender } = render(<SignalTag code="M3" />);
    expect(screen.getByText('M3').className).not.toMatch(/\bbg-/);
    rerender(<SignalTag code="M3" standalone />);
    expect(screen.getByText('M3')).toHaveClass('bg-muted');
  });

  it('as a link shows the accent on hover and focus-visible only', () => {
    render(<SignalTag code="F1A" href="/curriculum/T1_Foundational/F1A_Intro/index" label="Module F1A" />);
    const link = screen.getByRole('link', { name: 'Module F1A' });
    expect(link).toHaveAttribute('href', '/curriculum/T1_Foundational/F1A_Intro/index');
    expect(link).toHaveTextContent('F1A');
    expect(link).toHaveClass('text-muted-foreground', 'hover:text-primary', 'focus-visible:text-primary', 'focus-visible:ring-ring');
    // The accent appears only behind hover: or focus-visible: variants.
    const accentClasses = link.className.split(/\s+/).filter((name) => /primary|ring-ring/.test(name));
    expect(accentClasses.length).toBeGreaterThan(0);
    for (const name of accentClasses) expect(name).toMatch(/^(hover|focus-visible):/);
  });

  it('keeps the tag classes stable for other elements and exports a default', () => {
    expect(signalTagClass()).not.toMatch(/bg-muted|hover:/);
    expect(signalTagClass({ standalone: true })).toMatch(/bg-muted/);
    expect(signalTagClass({ link: true })).toMatch(/hover:text-primary/);
    expect(SignalTagDefault).toBe(SignalTag);
  });

  it('merges a className', () => {
    render(<SignalTag code="T2" className="ml-2" title="Tier 2" />);
    expect(screen.getByText('T2')).toHaveClass('ml-2');
    expect(screen.getByText('T2')).toHaveAttribute('title', 'Tier 2');
  });
});
