import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, cardClass, cardTierProps } from '@/components/ui/Card';

const classes = (element: Element) => element.className.split(/\s+/);

describe('Card', () => {
  it('keeps the original look by default: radius 12, hairline, card surface, no padding of its own', () => {
    render(<Card data-testid="card">Body</Card>);
    const card = screen.getByTestId('card');
    expect(card.tagName).toBe('DIV');
    expect(card).toHaveAttribute('data-card', 'surface');
    expect(classes(card)).toEqual(expect.arrayContaining(['rounded-xl', 'border', 'border-border', 'bg-card', 'text-card-foreground', 'shadow-card']));
    expect(card.className).not.toMatch(/\bp-\d/);
  });

  it('keeps the sub-components working', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardDescription>Description</CardDescription>
        </CardHeader>
        <CardContent>Content</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>,
    );
    expect(screen.getByRole('heading', { level: 3, name: 'Title' }).className).toContain('text-h3');
    expect(screen.getByText('Content').className).toContain('p-6');
  });

  it('interactive: the surface plus a raised hover and a stronger border, and a ring for keyboard focus inside', () => {
    const recipe = cardClass({ variant: 'interactive' }).split(' ');
    expect(recipe).toEqual(
      expect.arrayContaining(['bg-card', 'border-border', 'hover:bg-muted', 'hover:border-input', 'has-[:focus-visible]:ring-2', 'duration-150', 'ease-bench']),
    );
    expect(recipe.some((name) => /scale|translate|shadow-(lg|xl|2xl)/.test(name))).toBe(false);
  });

  it('inset: the raised surface, no border and no shadow', () => {
    const recipe = cardClass({ variant: 'inset' }).split(' ');
    expect(recipe).toEqual(['rounded-xl', 'text-card-foreground', 'bg-muted']);
  });

  it.each([
    ['info', 'border-l-info', 'bg-info-subtle'],
    ['success', 'border-l-success', 'bg-success-subtle'],
    ['warning', 'border-l-warning', 'bg-warning-subtle'],
    ['danger', 'border-l-danger', 'bg-danger-subtle'],
  ] as const)('callout %s: a 2 px leading border in the role colour over its subtle fill', (tone, border, fill) => {
    render(
      <Card variant="callout" tone={tone} as="aside" data-testid="callout">
        Note
      </Card>,
    );
    const callout = screen.getByTestId('callout');
    expect(callout.tagName).toBe('ASIDE');
    expect(callout).toHaveAttribute('data-tone', tone);
    expect(classes(callout)).toEqual(expect.arrayContaining(['border-l-2', border, fill, 'text-foreground']));
    expect(classes(callout)).not.toContain('bg-card');
  });

  it('pads on request (compact 16, default 20 to 24) and lets a className win', () => {
    expect(cardClass({ padding: 'compact' })).toContain('p-4');
    expect(cardClass({ padding: 'default' })).toContain('p-5 sm:p-6');
    expect(cardClass({ padding: 'default', className: 'p-0' }).split(' ')).not.toContain('p-5');
    render(
      <ul>
        <Card as="li" data-testid="row">Row</Card>
      </ul>,
    );
    expect(screen.getByTestId('row').tagName).toBe('LI');
    expect(screen.getByTestId('row')).not.toHaveAttribute('data-tone');
  });

  it('glass: the glass class (fill, hairline, highlight and blur from globals.css) and no solid card surface', () => {
    render(<Card variant="glass" data-testid="glass">Hub card</Card>);
    const card = screen.getByTestId('glass');
    expect(card).toHaveAttribute('data-card', 'glass');
    expect(classes(card)).toEqual(['rounded-xl', 'text-card-foreground', 'glass']);
  });

  it('glassQuiet: the quiet glass class without blur', () => {
    expect(cardClass({ variant: 'glassQuiet' }).split(' ')).toEqual(['rounded-xl', 'text-card-foreground', 'glass-quiet']);
  });

  it('glassQuietInteractive: quiet glass with the interactive hover and focus ring, no blur', () => {
    const classes = cardClass({ variant: 'glassQuietInteractive' }).split(' ');
    expect(classes).toEqual(expect.arrayContaining(['glass-quiet', 'relative', 'hover:bg-muted', 'hover:border-input', 'has-[:focus-visible]:ring-2']));
    expect(classes).not.toContain('glass');
  });

  it('tier: sets data-tier and adds the tier top edge on any variant, and leaves both off without a tier', () => {
    render(
      <>
        <Card tier={2} data-testid="tiered">Tier 2</Card>
        <Card variant="glassQuiet" tier={4} padding="default" data-testid="quiet">Tier 4</Card>
        <Card data-testid="plain">Plain</Card>
      </>,
    );
    expect(screen.getByTestId('tiered')).toHaveAttribute('data-tier', '2');
    expect(classes(screen.getByTestId('tiered'))).toEqual(expect.arrayContaining(['bg-card', 'border-border', 'tier-edge']));
    expect(screen.getByTestId('quiet')).toHaveAttribute('data-tier', '4');
    expect(classes(screen.getByTestId('quiet'))).toEqual(expect.arrayContaining(['glass-quiet', 'tier-edge', 'p-5']));
    expect(screen.getByTestId('plain')).not.toHaveAttribute('data-tier');
    expect(screen.getByTestId('plain').className).not.toContain('tier-edge');
  });

  it('cardTierProps gives data-tier for a Link styled with cardClass', () => {
    expect(cardTierProps(3)).toEqual({ 'data-tier': '3' });
    expect(cardTierProps(undefined)).toEqual({});
    expect(cardClass({ variant: 'interactive', tier: 1 })).toContain('tier-edge');
  });
});
