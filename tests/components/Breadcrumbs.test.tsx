import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  breadcrumbParent,
  Breadcrumbs as ItemBreadcrumbs,
  crumbItemClass,
  crumbLinkClass,
} from '@/components/layout/Breadcrumbs';

type MockNextLinkProps = React.PropsWithChildren<
  Omit<React.ComponentProps<'a'>, 'href'> & { href: string }
>;

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: MockNextLinkProps) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe('Breadcrumbs with items', () => {
  const items = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Review', href: '/dashboard/review' },
    { label: 'Deck I-UVM-1C', code: 'I-UVM-1C' },
  ];

  it('renders a plain ordered list in nav[aria-label="Breadcrumb"] with no card or background', () => {
    const { container } = render(<ItemBreadcrumbs items={items} />);
    const navigation = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(navigation).toHaveClass('text-ui');
    expect(navigation.className).not.toMatch(/\b(bg-|border|rounded-xl|shadow)/);
    const list = within(navigation).getByRole('list');
    expect(list.tagName).toBe('OL');
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    // Chevrons between items only, hidden from assistive technology.
    expect(list.querySelectorAll('svg.lucide-chevron-right')).toHaveLength(2);
    expect(list.querySelector('li')!.querySelector('svg')).toBeNull();
    expect(container.querySelectorAll('svg[aria-hidden="true"]').length).toBeGreaterThanOrEqual(2);
  });

  it('links ancestors in the secondary colour and marks the last item as the current page', () => {
    render(<ItemBreadcrumbs items={items} />);
    const list = within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByRole('list');
    const links = within(list).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/dashboard', '/dashboard/review']);
    for (const link of links) {
      expect(link).toHaveClass('text-muted-foreground', 'hover:text-primary');
      expect(link).not.toHaveAttribute('aria-current');
    }
    const current = list.querySelector('[aria-current="page"]')!;
    expect(current.tagName).toBe('SPAN');
    expect(current).toHaveClass('text-foreground', 'font-medium');
    expect(current).toHaveTextContent('Deck I-UVM-1C');
  });

  it('shows a SignalTag before the label of an item with a code, and a title on truncatable labels', () => {
    render(<ItemBreadcrumbs items={items} />);
    const current = document.querySelector('[aria-current="page"]')!;
    const tag = current.querySelector('[data-signal-tag]')!;
    expect(tag).toHaveTextContent('I-UVM-1C');
    // A visually hidden ": " so the crumb reads "I-UVM-1C: Deck I-UVM-1C" (the e2e suites match crumbs by "CODE: title").
    expect(tag.nextElementSibling).toHaveClass('sr-only');
    expect(tag.nextElementSibling).toHaveTextContent(':');
    expect(current.textContent).toBe('I-UVM-1C: Deck I-UVM-1C');
    const label = tag.nextElementSibling!.nextElementSibling!;
    expect(label).toHaveClass('min-w-0', 'truncate');
    expect(label).toHaveAttribute('title', 'Deck I-UVM-1C');
    // A tag inside a crumb is never a link of its own.
    expect(tag.tagName).toBe('SPAN');
  });

  it('switches to one back link to the nearest ancestor with an href below 640 px, by CSS alone', () => {
    render(<ItemBreadcrumbs items={[{ label: 'Curriculum', href: '/curriculum' }, { label: 'Unlinked group' }, { label: 'Expert index' }]} />);
    const navigation = screen.getByRole('navigation', { name: 'Breadcrumb' });
    const list = within(navigation).getByRole('list');
    expect(list).toHaveClass('hidden', 'sm:flex');
    const back = navigation.querySelector('[data-breadcrumb-back]')!;
    expect(back).toHaveAttribute('href', '/curriculum');
    expect(back).toHaveTextContent('Curriculum');
    expect(back).toHaveClass('sm:hidden', 'min-h-[2.5rem]');
    // A long module name wraps onto a second line instead of being cut off.
    const label = back.querySelector('[data-breadcrumb-back-label]')!;
    expect(label).toHaveClass('break-words');
    expect(label).not.toHaveClass('truncate');
    // After the list in the DOM, so "first matching link" finds the visible trail on desktop.
    expect(list.compareDocumentPosition(back) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps the full trail at every width when no ancestor has an href', () => {
    render(<ItemBreadcrumbs items={[{ label: 'Only page' }]} />);
    const navigation = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(navigation).getByRole('list')).toHaveClass('flex');
    expect(within(navigation).getByRole('list')).not.toHaveClass('hidden');
    expect(navigation.querySelector('[data-breadcrumb-back]')).toBeNull();
  });

  it('finds the nearest linked ancestor', () => {
    expect(breadcrumbParent(items)).toEqual({ label: 'Review', href: '/dashboard/review' });
    expect(breadcrumbParent([{ label: 'A', href: '/a' }, { label: 'B' }, { label: 'C' }])).toEqual({ label: 'A', href: '/a' });
    expect(breadcrumbParent([{ label: 'A', href: '/a' }])).toBeUndefined();
  });

  it('renders nothing for an empty trail', () => {
    const { container } = render(<ItemBreadcrumbs items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
