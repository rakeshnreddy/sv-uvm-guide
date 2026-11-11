import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SearchCombobox, { SHORTCUT_FIELD_PADDING, SHORTCUT_HINT_VISIBILITY } from '@/components/search/SearchCombobox';
import * as searchIndexLoader from '@/components/search/load-search-index';
import SearchDialog from '@/components/search/SearchDialog';
import { focusAfterNavigation } from '@/components/search/focus-target';
import { shellStore } from '@/components/search/shell-store';
import { focusableWithin } from '@/components/search/useModalDialog';
import { PRACTICE_HUB_LINK } from '@/lib/site-links';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('next/navigation', () => ({
  usePathname: () => '/curriculum',
  useRouter: () => ({ push }),
}));

vi.mock('next/link', async () => {
  const ReactModule = await import('react');
  type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean };
  const MockLink = ReactModule.forwardRef<HTMLAnchorElement, LinkProps>(({ href, children, prefetch: _prefetch, onClick, ...rest }, ref) => (
    <a
      ref={ref}
      href={href}
      {...rest}
      onClick={(event) => {
        onClick?.(event);
        event.preventDefault();
      }}
    >
      {children}
    </a>
  ));
  MockLink.displayName = 'MockLink';
  return { __esModule: true, default: MockLink };
});

const MAILBOXES = '/curriculum/T2_Intermediate/I-SV-5_Synchronization_and_IPC/mailboxes';

beforeEach(() => {
  push.mockReset();
  shellStore.reset();
});

afterEach(() => {
  cleanup();
  shellStore.reset();
  vi.useRealTimers();
});

async function typeQuery(query: string) {
  const user = userEvent.setup();
  const input = screen.getByRole('combobox', { name: 'Search lessons, labs and practice' });
  await user.click(input);
  await user.type(input, query);
  return { user, input };
}

describe('SearchCombobox in the navbar (popup)', () => {
  it('is a combobox that lists ranked results deep-linking to lessons and headings', async () => {
    render(<SearchCombobox variant="popup" commandTarget testId="main-search-input" />);
    const { input } = await typeQuery('mailbox');

    const listbox = await screen.findByRole('listbox', { name: 'Search results' });
    const options = within(listbox).getAllByRole('option');
    expect(options.length).toBeGreaterThan(1);
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveAttribute('aria-controls', listbox.id);
    expect(input).toHaveAttribute('data-testid', 'main-search-input');
    expect(input).toHaveAttribute('data-command-target', 'global-search');

    // The first result is highlighted and is the Mailboxes lesson.
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', options[0].id);
    expect(options[0]).toHaveAttribute('href', MAILBOXES);
    expect(options[0]).toHaveTextContent('Mailboxes');
    expect(options[0]).toHaveTextContent('Lesson');

    // Section results link to the heading's anchor on the canonical lesson URL.
    const section = options.find((option) => option.getAttribute('href')?.includes('#'));
    expect(section?.getAttribute('href')).toMatch(/^\/curriculum\/T\d_[A-Za-z]+\/[^/]+\/[a-z0-9-]+#[a-z0-9_-]+$/);
    expect(section).toHaveTextContent('Section');

    // Result options stay out of the Tab order; focus stays in the field.
    for (const option of options) expect(option).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('status')).toHaveTextContent(`${options.length} results.`);
  });

  it('moves the highlight with the arrow keys and opens the highlighted result with Enter', async () => {
    render(<SearchCombobox variant="popup" />);
    const { user, input } = await typeQuery('mailbox');
    const options = within(await screen.findByRole('listbox')).getAllByRole('option');

    await user.keyboard('{ArrowDown}');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    expect(options[0]).toHaveAttribute('aria-selected', 'false');
    expect(input).toHaveAttribute('aria-activedescendant', options[1].id);

    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(options[options.length - 1]).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowDown}{Enter}');
    expect(push).toHaveBeenCalledWith(MAILBOXES);
    expect(input).toHaveValue('');
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes the list with Escape, then clears the field with a second Escape', async () => {
    render(<SearchCombobox variant="popup" />);
    const { user, input } = await typeQuery('mailbox');
    await screen.findByRole('listbox');

    await user.keyboard('{Escape}');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveValue('mailbox');

    await user.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard('{Escape}{Escape}');
    expect(input).toHaveValue('');
  });

  it('says when nothing matches', async () => {
    render(<SearchCombobox variant="popup" />);
    const { input } = await typeQuery('zzqqxx');
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Nothing matches “zzqqxx”. Search covers lessons and their sections, labs, exercises, interactive models, tools, interview questions and reference pages.',
    );
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).not.toHaveAttribute('aria-activedescendant');
  });

  it('waits for two characters before searching', async () => {
    render(<SearchCombobox variant="popup" />);
    const { input } = await typeQuery('m');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('closes the list when a result is clicked', async () => {
    const user = userEvent.setup();
    render(<SearchCombobox variant="popup" />);
    const { input } = await typeQuery('WSTRB');
    const options = within(await screen.findByRole('listbox')).getAllByRole('option');
    await user.click(options[0]);
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveValue('');
  });

  it('opens a new tab without closing on a modified click', async () => {
    render(<SearchCombobox variant="popup" />);
    const { input } = await typeQuery('WSTRB');
    const options = within(await screen.findByRole('listbox')).getAllByRole('option');
    fireEvent.click(options[0], { ctrlKey: true });
    expect(input).toHaveValue('WSTRB');
  });
});

describe('SearchCombobox results across kinds', () => {
  it('uses the same placeholder in the navbar field and in the dialog field', () => {
    render(
      <>
        <SearchCombobox variant="popup" commandTarget />
        <SearchCombobox variant="inline" />
      </>,
    );
    const fields = screen.getAllByRole('combobox');
    for (const field of fields) expect(field).toHaveAttribute('placeholder', 'Search lessons, labs and practice');
  });

  it('labels each result with its kind and shows module codes as signal tags', async () => {
    render(<SearchCombobox variant="popup" />);
    await typeQuery('phase sorter');
    const options = within(await screen.findByRole('listbox')).getAllByRole('option');
    const sorter = options.find((option) => option.getAttribute('href') === '/exercises/uvm-phase-sorter');
    expect(sorter).toBeDefined();
    expect(sorter).toHaveAttribute('data-kind', 'exercise');
    expect(sorter?.querySelector('[data-search-kind]')).toHaveTextContent('Exercise');
    const tag = sorter?.querySelector('[data-signal-tag]');
    expect(tag).toHaveTextContent('I-UVM-1C');
    // The tag sits inside the result link, so it is not a link of its own.
    expect(tag?.tagName).toBe('SPAN');
  });

  it('ranks the lesson first and shows its tag, kind and tier', async () => {
    render(<SearchCombobox variant="popup" />);
    await typeQuery('mailbox');
    const first = within(await screen.findByRole('listbox')).getAllByRole('option')[0];
    expect(first).toHaveAttribute('data-kind', 'lesson');
    expect(first.querySelector('[data-search-kind]')).toHaveTextContent('Lesson');
    expect(first.querySelector('[data-signal-tag]')).toHaveTextContent('I-SV-5');
    expect(first).toHaveTextContent('Tier 2: Intermediate');
  });

  it('marks only the highlighted result as the current one', async () => {
    render(<SearchCombobox variant="popup" />);
    const { user } = await typeQuery('mailbox');
    const options = within(await screen.findByRole('listbox')).getAllByRole('option');
    expect(options[0].className).toMatch(/border-primary/);
    expect(options[1].className).not.toMatch(/border-primary/);
    await user.keyboard('{ArrowDown}');
    expect(options[1].className).toMatch(/border-primary/);
    expect(options[0].className).not.toMatch(/border-primary/);
  });

  it('floats the results on glass, with the highlighted row raised and marked, and the hint in secondary text', async () => {
    render(<SearchCombobox variant="popup" />);
    const { user } = await typeQuery('mailbox');
    const listbox = await screen.findByRole('listbox');
    const panel = listbox.closest('[data-search-panel]') as HTMLElement;
    expect(panel).toHaveAttribute('data-search-panel', 'popup');
    expect(panel).toHaveClass('glass', 'rounded-xl', 'mt-3');
    expect(panel.className).not.toMatch(/\bbg-popover\b/);
    const options = within(listbox).getAllByRole('option');
    expect(options[0]).toHaveClass('bg-muted', 'border-primary');
    const hint = panel.querySelector('p.border-t');
    expect(hint).toHaveClass('text-muted-foreground');
    expect(hint).not.toHaveClass('text-subtle');
    await user.keyboard('{Escape}');
  });

  it('shows lesson titles without the module code the tag beside them shows', async () => {
    render(<SearchCombobox variant="popup" />);
    await typeQuery('I-SV-3A');
    const first = within(await screen.findByRole('listbox')).getAllByRole('option')[0];
    expect(first.querySelector('[data-search-title]')).toHaveTextContent(/^Functional Coverage Fundamentals$/);
    expect(first.querySelector('[data-signal-tag]')).toHaveTextContent('I-SV-3A');
    expect(first.textContent?.match(/I-SV-3A/g)).toHaveLength(1);
  });

  it('keeps one title weight as the highlight moves, so the text does not reflow', async () => {
    render(<SearchCombobox variant="popup" />);
    const { user } = await typeQuery('mailbox');
    const options = within(await screen.findByRole('listbox')).getAllByRole('option');
    const titleClass = (index: number) => options[index].querySelector('[data-search-title]')?.className;
    expect(titleClass(0)).toBe(titleClass(1));
    await user.keyboard('{ArrowDown}');
    expect(titleClass(0)).toBe(titleClass(1));
    expect(titleClass(0)).not.toMatch(/font-medium/);
  });

  it('hides the keyboard hint and its padding between lg and xl, where the field is narrow', () => {
    render(<SearchCombobox variant="popup" commandTarget />);
    const hint = document.querySelector('[data-search-shortcut]') as HTMLElement;
    expect(SHORTCUT_HINT_VISIBILITY.split(' ')).toEqual(['hidden', 'sm:inline-block', 'lg:hidden', 'xl:inline-block']);
    for (const name of SHORTCUT_HINT_VISIBILITY.split(' ')) expect(hint).toHaveClass(name);
    const field = screen.getByRole('combobox');
    expect(SHORTCUT_FIELD_PADDING.split(' ')).toEqual(['pr-3', 'sm:pr-16', 'lg:pr-3', 'xl:pr-16']);
    for (const name of SHORTCUT_FIELD_PADDING.split(' ')) expect(field).toHaveClass(name);
  });

  it('links to the curriculum and the practice hub when the index cannot load', async () => {
    const spy = vi.spyOn(searchIndexLoader, 'loadSearchDocuments').mockRejectedValue(new Error('offline'));
    try {
      render(<SearchCombobox variant="popup" />);
      await typeQuery('mailbox');
      expect(await screen.findByRole('status')).toHaveTextContent('Search is unavailable right now.');
      expect(screen.getByRole('link', { name: 'Browse the curriculum' })).toHaveAttribute('href', '/curriculum');
      expect(screen.getByRole('link', { name: PRACTICE_HUB_LINK.label })).toHaveAttribute('href', PRACTICE_HUB_LINK.href);
    } finally {
      spy.mockRestore();
    }
  });

  it('says what can be searched before a query is typed in the dialog', () => {
    render(<SearchCombobox variant="inline" />);
    expect(screen.getByText(/Search lessons and their sections, labs, exercises, interactive models, tools/)).toBeVisible();
  });
});

describe('SearchDialog (phones, and Ctrl/Cmd+K when the navbar field is hidden)', () => {
  it('is a labelled modal dialog that focuses the field, searches, and closes with Escape', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button" onClick={shellStore.openSearch}>
          Search
        </button>
        <SearchDialog />
      </>,
    );
    const opener = screen.getByRole('button', { name: 'Search' });
    await user.click(opener);

    const dialog = screen.getByRole('dialog', { name: 'Search SV/UVM Hub' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const input = within(dialog).getByRole('combobox', { name: 'Search lessons, labs and practice' });
    expect(document.activeElement).toBe(input);
    expect(within(dialog).getByText(/Type at least 2 characters/)).toBeVisible();

    await user.type(input, 'uvm_config_db');
    const options = within(await within(dialog).findByRole('listbox')).getAllByRole('option');
    expect(options.some((option) => option.getAttribute('href')?.includes('I-UVM-2C_Configuration_and_Resources'))).toBe(true);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(opener);
  });

  it('keeps Tab inside the dialog while results are showing', async () => {
    const user = userEvent.setup();
    render(
      <>
        <a href="#behind">Link behind the dialog</a>
        <SearchDialog />
      </>,
    );
    act(() => shellStore.openSearch());
    const dialog = screen.getByRole('dialog', { name: 'Search SV/UVM Hub' });
    const input = within(dialog).getByRole('combobox');
    await user.type(input, 'phasing');
    await within(dialog).findByRole('listbox');

    // The result options have tabIndex -1 (they are reached with the arrow keys),
    // so Tab and Shift+Tab cycle through the dialog's own controls and never
    // reach the page behind it.
    const close = within(dialog).getByRole('button', { name: 'Close search' });
    await user.tab();
    expect(document.activeElement).toBe(close);
    for (let step = 0; step < 6; step += 1) {
      await user.tab({ shift: step % 2 === 1 });
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    for (let step = 0; step < 4; step += 1) {
      await user.tab({ shift: true });
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it('closes and navigates when a result is chosen with Enter', async () => {
    const user = userEvent.setup();
    render(<SearchDialog />);
    act(() => shellStore.openSearch());
    const input = screen.getByRole('combobox');
    await user.type(input, 'mailbox');
    await screen.findByRole('listbox');
    await user.keyboard('{Enter}');
    expect(push).toHaveBeenCalledWith(MAILBOXES);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(shellStore.getState().searchOpen).toBe(false);
  });
});

describe('focusableWithin', () => {
  it('skips elements taken out of the Tab order with a negative tabIndex', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <button type="button">First</button>
      <input aria-label="Field" />
      <span tabindex="0">Focusable span</span>
      <a href="/result" tabindex="-1" role="option">Result</a>
    `;
    document.body.appendChild(container);
    const names = focusableWithin(container).map((element) => element.textContent?.trim() || element.getAttribute('aria-label'));
    expect(names).toEqual(['First', 'Field', 'Focusable span']);
    container.remove();
  });
});

describe('focusAfterNavigation', () => {
  it('focuses the chosen section once it exists on the new page', () => {
    vi.useFakeTimers();
    const stop = focusAfterNavigation(`${window.location.pathname}#failure-modes`);
    const heading = document.createElement('h2');
    heading.id = 'failure-modes';
    document.body.appendChild(heading);
    vi.advanceTimersByTime(200);
    expect(document.activeElement).toBe(heading);
    expect(heading).toHaveAttribute('tabindex', '-1');
    stop();
  });

  it('focuses the page heading when there is no anchor', () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<main id="main-content"><h1>Mailboxes</h1></main>';
    focusAfterNavigation(window.location.pathname);
    vi.advanceTimersByTime(100);
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Mailboxes' }));
  });

  it('gives up if the learner moves focus before the page is ready', () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<button type="button">Elsewhere</button>';
    focusAfterNavigation(`${window.location.pathname}#late`);
    vi.advanceTimersByTime(10);
    const elsewhere = screen.getByRole('button', { name: 'Elsewhere' });
    elsewhere.focus();
    const late = document.createElement('h2');
    late.id = 'late';
    document.body.appendChild(late);
    vi.advanceTimersByTime(500);
    expect(document.activeElement).toBe(elsewhere);
  });
});
