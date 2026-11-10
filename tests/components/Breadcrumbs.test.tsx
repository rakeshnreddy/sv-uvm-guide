import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Breadcrumbs, { crumbItemClass, crumbLinkClass } from '@/components/layout/Breadcrumbs';
import { lessonBreadcrumbs } from '@/lib/curriculum/lesson-context';

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

const IUVM3B = 'I-UVM-3B_Advanced_Sequencing_and_Layering';

describe('Breadcrumbs', () => {
  it('renders an ordered list of canonical links with aria-current on the last crumb', () => {
    render(<Breadcrumbs slug={['T2_Intermediate', IUVM3B, 'virtual-sequences']} />);

    const navigation = screen.getByRole('navigation', { name: 'Breadcrumb' });
    const list = within(navigation).getByRole('list');
    expect(list.tagName).toBe('OL');
    const links = within(list).getAllByRole('link');
    const expected = lessonBreadcrumbs(['T2_Intermediate', IUVM3B, 'virtual-sequences']);

    expect(links.map((link) => link.textContent)).toEqual(expected.map((crumb) => crumb.label));
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/curriculum',
      '/curriculum#t2',
      `/curriculum/T2_Intermediate/${IUVM3B}/index`,
      `/curriculum/T2_Intermediate/${IUVM3B}/virtual-sequences`,
    ]);
    expect(links.map((link) => link.getAttribute('aria-current'))).toEqual([null, null, null, 'page']);
  });

  it('lets the current crumb take the free room on the row and truncate only when the row is full', () => {
    render(<Breadcrumbs slug={['T2_Intermediate', IUVM3B, 'virtual-sequences']} />);
    const links = within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getAllByRole('link');
    const current = links[links.length - 1];
    expect(current).toHaveClass('max-w-full', 'min-w-0');
    expect(current.className).not.toMatch(/max-w-\[(15|20)rem\]/);
    expect(current.parentElement).toHaveClass('min-w-0', 'flex-auto');
    expect(current.querySelector('span')).toHaveClass('truncate');
    // Ancestors keep their own width, with their caps.
    for (const link of links.slice(0, -1)) {
      expect(link).toHaveClass('max-w-[15rem]', 'sm:max-w-[20rem]');
      expect(link.parentElement).not.toHaveClass('flex-auto');
    }
    expect(crumbItemClass(false)).not.toMatch(/flex-auto/);
    expect(crumbLinkClass(true)).not.toMatch(/max-w-\[/);
  });

  it('ends on the module crumb on a module page and links canonical URLs from a pretty slug', () => {
    render(<Breadcrumbs slug={['t1-foundational', 'f2a-core-data-types']} />);
    const links = within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getAllByRole('link');
    expect(links).toHaveLength(3);
    expect(links[2]).toHaveAttribute('href', '/curriculum/T1_Foundational/F2A_Core_Data_Types/index');
    expect(links[2]).toHaveAttribute('aria-current', 'page');
  });

  it('shows no authoring-status icons or invented time estimates (G30-PAGE-05/06)', () => {
    const { container } = render(<Breadcrumbs slug={['T1_Foundational', 'F2C_Procedural_Code_and_Flow_Control', 'index']} />);
    expect(container.querySelector('svg.lucide-clock, svg.lucide-circle-check-big, svg.lucide-check-circle')).toBeNull();
    expect(container).not.toHaveTextContent(/mins left/);
  });

  it('opens "Jump to" as a disclosure listing the module lessons in order, with the current one marked', () => {
    render(<Breadcrumbs slug={['t2-intermediate', 'i-uvm-3b-advanced-sequencing-and-layering', 'sequence-arbitration']} />);

    const jumpToButton = screen.getByRole('button', { name: 'Jump to' });
    expect(jumpToButton).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(jumpToButton);
    expect(jumpToButton).toHaveAttribute('aria-expanded', 'true');

    const panel = document.getElementById(jumpToButton.getAttribute('aria-controls')!)!;
    expect(panel).toBeInTheDocument();
    const list = within(panel).getByRole('list');
    expect(list.tagName).toBe('OL');
    const links = within(list).getAllByRole('link');
    expect(links[0]).toHaveAttribute('href', `/curriculum/T2_Intermediate/${IUVM3B}/index`);
    const current = links.filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAttribute('href', `/curriculum/T2_Intermediate/${IUVM3B}/sequence-arbitration`);
    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(jumpToButton).toHaveAttribute('aria-expanded', 'false');
    expect(jumpToButton).toHaveFocus();
  });

  it('leaves out "Jump to" for a one-lesson module', () => {
    render(<Breadcrumbs slug={['T1_Foundational', 'F2B_Dynamic_Structures', 'index']} />);
    expect(screen.queryByRole('button', { name: 'Jump to' })).toBeNull();
  });
});
