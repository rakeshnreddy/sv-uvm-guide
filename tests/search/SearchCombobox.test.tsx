import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SearchCombobox from '@/components/search/SearchCombobox';
import SearchDialog from '@/components/search/SearchDialog';
import { focusAfterNavigation } from '@/components/search/focus-target';
import { shellStore } from '@/components/search/shell-store';

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
  const input = screen.getByRole('combobox', { name: 'Search lessons and sections' });
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
    expect(section?.getAttribute('href')).toMatch(/^\/curriculum\/T\d_[A-Za-z]+\/[^/]+\/[a-z0-9-]+#[a-z0-9-]+$/);
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
    expect(await screen.findByRole('status')).toHaveTextContent('No lessons or sections match “zzqqxx”.');
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

    const dialog = screen.getByRole('dialog', { name: 'Search the curriculum' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const input = within(dialog).getByRole('combobox', { name: 'Search lessons and sections' });
    expect(document.activeElement).toBe(input);
    expect(within(dialog).getByText(/Type at least 2 characters/)).toBeVisible();

    await user.type(input, 'uvm_config_db');
    const options = within(await within(dialog).findByRole('listbox')).getAllByRole('option');
    expect(options.some((option) => option.getAttribute('href')?.includes('I-UVM-2C_Configuration_and_Resources'))).toBe(true);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(opener);
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
