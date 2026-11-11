import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import BadgeDefault, {
  Badge,
  COUNT_BADGE_CLASS,
  CountBadge,
  FilterChip,
  LEVEL_BADGE_CLASS,
  LevelBadge,
  STATUS_DOT_CLASS,
  StatusBadge,
  badgeVariants,
  filterChipClass,
} from '@/components/ui/Badge';

type MockNextLinkProps = React.PropsWithChildren<Omit<React.ComponentProps<'a'>, 'href'> & { href: string }>;

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: MockNextLinkProps) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const classes = (element: Element) => element.className.split(/\s+/);

describe('Badge', () => {
  it('keeps the original variants', () => {
    render(
      <>
        <Badge data-testid="default">Default</Badge>
        <Badge variant="secondary" data-testid="secondary">Secondary</Badge>
        <Badge variant="outline" className="ml-2" data-testid="outline">Outline</Badge>
      </>,
    );
    expect(classes(screen.getByTestId('default'))).toEqual(expect.arrayContaining(['bg-muted', 'text-foreground', 'rounded']));
    expect(classes(screen.getByTestId('secondary'))).toContain('bg-card');
    expect(classes(screen.getByTestId('outline'))).toEqual(expect.arrayContaining(['text-muted-foreground', 'ml-2']));
    expect(badgeVariants({ variant: 'outline' })).toContain('border-border');
    expect(BadgeDefault).toBe(Badge);
  });

  it('code: renders the signal tag, as a link when given an href', () => {
    const { container } = render(
      <>
        <Badge variant="code" code="I-UVM-1C" />
        <Badge variant="code" code="M3" href="/curriculum/m3" label="Milestone M3" />
      </>,
    );
    const tags = container.querySelectorAll('[data-signal-tag]');
    expect(tags).toHaveLength(2);
    expect(tags[0]).toHaveTextContent('I-UVM-1C');
    expect(classes(tags[0])).toContain('font-mono');
    expect(screen.getByRole('link', { name: 'Milestone M3' })).toHaveAttribute('href', '/curriculum/m3');
  });

  it.each(['neutral', 'info', 'success', 'warning', 'danger'] as const)('status %s: a 6 px dot in the tone plus the label', (tone) => {
    render(<Badge variant="status" tone={tone} data-testid="status">Done</Badge>);
    const badge = screen.getByTestId('status');
    expect(badge).toHaveTextContent('Done');
    expect(badge).toHaveAttribute('data-tone', tone);
    const dot = badge.querySelector('[aria-hidden="true"]')!;
    expect(classes(dot)).toEqual(expect.arrayContaining(['h-1.5', 'w-1.5', 'rounded-full', STATUS_DOT_CLASS[tone]]));
  });

  it('status defaults to the neutral tone', () => {
    render(<StatusBadge data-testid="s">Not started</StatusBadge>);
    expect(screen.getByTestId('s')).toHaveAttribute('data-tone', 'neutral');
  });

  it('level: Core, Elective and Expert as quiet outlined text', () => {
    render(
      <>
        <Badge variant="level" level="core" />
        <LevelBadge level="elective" />
        <LevelBadge level="expert">Expert only</LevelBadge>
      </>,
    );
    expect(screen.getByText('Core').className).toBe(LEVEL_BADGE_CLASS);
    expect(screen.getByText('Elective')).toHaveAttribute('data-level', 'elective');
    expect(screen.getByText('Expert only')).toBeInTheDocument();
    expect(LEVEL_BADGE_CLASS.split(' ')).toEqual(expect.arrayContaining(['border', 'border-border', 'text-muted-foreground']));
    expect(LEVEL_BADGE_CLASS).not.toMatch(/uppercase|tracking|\bbg-/);
  });

  it('count: mono with tabular figures, no box', () => {
    render(
      <>
        <Badge variant="count">12</Badge>
        <CountBadge>3 of 9</CountBadge>
      </>,
    );
    expect(screen.getByText('12').className).toBe(COUNT_BADGE_CLASS);
    expect(COUNT_BADGE_CLASS.split(' ')).toEqual(expect.arrayContaining(['font-mono', 'tabular-nums']));
    expect(COUNT_BADGE_CLASS).not.toMatch(/border|\bbg-|rounded/);
    expect(screen.getByText('3 of 9')).toHaveAttribute('data-badge', 'count');
  });

  it('filter: a 40 px toggle chip button with aria-pressed and a check when on', () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <Badge variant="filter" pressed={false} onClick={onClick}>
        Senior
      </Badge>,
    );
    const chip = screen.getByRole('button', { name: 'Senior' });
    expect(chip).toHaveAttribute('type', 'button');
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    expect(chip.querySelector('svg')).toBeNull();
    fireEvent.click(chip);
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <FilterChip pressed onClick={onClick}>
        Senior
      </FilterChip>,
    );
    const on = screen.getByRole('button', { name: 'Senior' });
    expect(on).toHaveAttribute('aria-pressed', 'true');
    expect(on.querySelector('svg')).not.toBeNull();
    expect(classes(on)).toEqual(expect.arrayContaining(['min-h-10', 'rounded-full', 'border-primary', 'bg-muted', 'text-foreground']));
    expect(filterChipClass(false)).toContain('border-border text-muted-foreground');
  });
});
