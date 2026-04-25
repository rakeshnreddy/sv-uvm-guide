import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Breadcrumbs from '@/components/layout/Breadcrumbs';

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

describe('Breadcrumbs', () => {
  it('renders the canonical curriculum breadcrumb hrefs in order', () => {
    render(<Breadcrumbs slug={['T1_Foundational', 'F2A_Core_Data_Types', 'index']} />);

    const navigation = screen.getByRole('navigation');
    const links = within(navigation).getAllByRole('link').slice(0, 4);

    expect(links.map((link) => link.textContent)).toEqual([
      'Curriculum',
      'Foundational',
      'F2A: Core Data Types',
      'F2A: Core Data Types',
    ]);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/curriculum',
      '/curriculum/T1_Foundational',
      '/curriculum/T1_Foundational/F2A_Core_Data_Types',
      '/curriculum/T1_Foundational/F2A_Core_Data_Types/index',
    ]);
  });

  it('normalizes pretty slugs before deriving the current section jump menu', () => {
    render(<Breadcrumbs slug={['t3-advanced', 'a-uvm-6-scoreboards-and-reference-models']} />);

    const jumpToButton = screen.getByRole('button', { name: 'Jump to' });
    fireEvent.click(jumpToButton);

    const menu = screen.getByRole('menu', { name: 'Topics in A-UVM-6: Scoreboards and Reference Models' });
    const menuitem = within(menu).getByRole('menuitem', {
      name: 'A-UVM-6: Scoreboards and Reference Models',
    });

    expect(menuitem).toHaveAttribute(
      'href',
      '/curriculum/T3_Advanced/A-UVM-6_Scoreboards_and_Reference_Models/index',
    );
  });
});
