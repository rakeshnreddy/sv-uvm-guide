import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PageHeaderDefault, {
  PAGE_HEADER_LEAD_CLASS,
  PAGE_HEADER_META_CLASS,
  PAGE_HEADER_TITLE_CLASS,
  PageHeader,
  PageTabs,
  pageHeaderClass,
  pageTabClass,
} from '@/components/layout/PageHeader';
import { SignalTag } from '@/components/ui/SignalTag';

type MockNextLinkProps = React.PropsWithChildren<Omit<React.ComponentProps<'a'>, 'href'> & { href: string }>;

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: MockNextLinkProps) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe('PageHeader', () => {
  it('renders one h1 in the h1 token inside a plain header closed by a hairline', () => {
    const { container } = render(<PageHeader title="Practice" />);
    const header = container.querySelector('header')!;
    expect(header).toHaveAttribute('data-page-header');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Practice' }).className).toBe(PAGE_HEADER_TITLE_CLASS);
    const headerClasses = header.className.split(' ');
    expect(headerClasses).toEqual(expect.arrayContaining(['border-b', 'border-border', 'pb-6', 'mb-8']));
    // No card and no background.
    expect(header.className).not.toMatch(/\bbg-|\brounded|\bshadow/);
    // Empty slots render nothing.
    expect(header.querySelector('nav, p, [data-page-header-eyebrow], [data-page-header-meta], [data-page-header-actions]')).toBeNull();
  });

  it('renders breadcrumbs, eyebrow, lead, meta and actions', () => {
    render(
      <PageHeader
        breadcrumbs={[{ label: 'Curriculum', href: '/curriculum' }, { label: 'Interfaces', code: 'I-SV-4' }]}
        eyebrow={<SignalTag code="I-SV-4" />}
        title="Interfaces and modports"
        titleId="lesson-title"
        lead="Bundle a bus into one port and give each side its own view of it."
        meta={
          <>
            <span>18 min read</span>
            <span>Lesson 4 of 9</span>
          </>
        }
        actions={<a href="/next">Open the lab</a>}
        data-testid="lesson-header"
      />,
    );
    const header = screen.getByTestId('lesson-header');
    expect(within(header).getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
    expect(header.querySelector('[data-page-header-eyebrow] [data-signal-tag]')).toHaveTextContent('I-SV-4');
    expect(screen.getByRole('heading', { level: 1 })).toHaveAttribute('id', 'lesson-title');
    const lead = header.querySelector('[data-page-header-lead]')!;
    expect(lead.tagName).toBe('P');
    expect(lead.className).toBe(PAGE_HEADER_LEAD_CLASS);
    expect(PAGE_HEADER_LEAD_CLASS.split(' ')).toEqual(expect.arrayContaining(['max-w-[27.5em]', 'text-lead', 'text-muted-foreground']));
    expect(within(header.querySelector('[data-page-header-meta]') as HTMLElement).getByText('Lesson 4 of 9')).toBeInTheDocument();
    expect(PAGE_HEADER_META_CLASS).toContain('tabular-nums');
    expect(within(header.querySelector('[data-page-header-actions]') as HTMLElement).getByRole('link', { name: 'Open the lab' })).toBeInTheDocument();
  });

  it('puts a tab strip on the hairline, with no padding under it', () => {
    expect(pageHeaderClass({ tabs: true }).split(' ')).toEqual(expect.arrayContaining(['border-b', 'pb-0']));
    render(
      <PageHeader
        title="Practice"
        tabs={
          <PageTabs
            label="Practice sections"
            items={[
              { label: 'Labs', href: '/practice/labs', current: true },
              { label: 'Exercises', href: '/practice/exercises' },
            ]}
          />
        }
      />,
    );
    const nav = screen.getByRole('navigation', { name: 'Practice sections' });
    const current = within(nav).getByRole('link', { name: 'Labs' });
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current.className).toBe(pageTabClass(true));
    expect(within(nav).getByRole('link', { name: 'Exercises' })).not.toHaveAttribute('aria-current');
  });

  it('renders children after the meta row, inside the text column', () => {
    const { container } = render(
      <PageHeader title="Lesson" meta={<span>5 min read</span>} actions={<a href="/x">Act</a>}>
        <p data-testid="extra">Before you start</p>
      </PageHeader>,
    );
    const meta = container.querySelector('[data-page-header-meta]');
    const extra = screen.getByTestId('extra');
    expect(meta?.nextElementSibling).toBe(extra);
    expect(extra.closest('[data-page-header-actions]')).toBeNull();
  });

  it('marks the current tab with primary text and the 2 px accent underline', () => {
    expect(pageTabClass(true)).toContain('border-primary text-foreground');
    expect(pageTabClass(false)).toContain('border-transparent text-muted-foreground');
    expect(pageTabClass(true)).toContain('h-10');
    expect(PageHeaderDefault).toBe(PageHeader);
  });
});
