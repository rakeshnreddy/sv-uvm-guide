import React from 'react';
import { renderToString } from 'react-dom/server';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StorageStatusNote, STORAGE_WARNING_BYTES } from '@/components/learner/StorageStatusNote';
import { LEARNER_DATA_CHANGED_EVENT } from '@/lib/learner-store/keys';
import { __resetRecordsForTests, notifyLearnerStoreChanged } from '@/lib/learner-store/record';
import { flashcardRecord } from '@/lib/learner-store/repositories/flashcards';
import { __resetStorageForTests, safeStorage } from '@/lib/learner-store/storage';

const BLOCKED_COPY =
  "This browser isn't saving your progress (storage is blocked or full). Download a backup to keep it.";
const NEARLY_FULL_COPY = 'Browser storage is nearly full. Download a backup, then delete old notes or old lab versions.';

const originalStorage = window.localStorage;

function blockStorage(): void {
  Object.defineProperty(window, 'localStorage', {
    get() {
      throw new DOMException('blocked', 'SecurityError');
    },
    configurable: true,
  });
}

/** A learner value big enough to pass the warning threshold (2 bytes per character). */
function bigValue(): string {
  return 'x'.repeat(Math.ceil(STORAGE_WARNING_BYTES / 2) + 1_000);
}

describe('StorageStatusNote', () => {
  beforeEach(() => {
    __resetStorageForTests();
    __resetRecordsForTests();
    originalStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    Object.defineProperty(window, 'localStorage', { value: originalStorage, configurable: true, writable: true });
    originalStorage.clear();
    __resetStorageForTests();
    __resetRecordsForTests();
  });

  it('says where data lives in a polite status region', () => {
    render(<StorageStatusNote />);

    const note = screen.getByRole('status');
    expect(note).toHaveTextContent('Saved in this browser');
    expect(note).toHaveAttribute('aria-live', 'polite');
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('uses a custom saved label and class name', () => {
    render(<StorageStatusNote savedLabel="Stored only in this browser" className="mt-2" />);

    expect(screen.getByRole('status')).toHaveTextContent('Stored only in this browser');
    expect(screen.getByRole('status')).toHaveClass('mt-2');
  });

  it('warns and links to the backup controls when storage is blocked', () => {
    blockStorage();

    render(<StorageStatusNote />);

    expect(screen.getByRole('status')).toHaveTextContent(BLOCKED_COPY);
    expect(screen.getByRole('link', { name: 'Download a backup' })).toHaveAttribute('href', '/settings#data');
  });

  it('warns when a write hits the quota while the note is showing', () => {
    render(<StorageStatusNote />);
    expect(screen.getByRole('status')).toHaveTextContent('Saved in this browser');
    const setItem = vi.spyOn(originalStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });

    act(() => {
      safeStorage.set('sv-uvm-guide:flashcards', '{}');
    });

    expect(screen.getByRole('status')).toHaveTextContent(BLOCKED_COPY);
    setItem.mockRestore();
  });

  it('warns when learner data is close to the storage limit after mount', () => {
    originalStorage.setItem('sv-uvm-guide:notebook:big', bigValue());

    render(<StorageStatusNote />);

    expect(screen.getByRole('status')).toHaveTextContent(NEARLY_FULL_COPY);
    expect(screen.getByRole('link', { name: 'Download a backup' })).toHaveAttribute('href', '/settings#data');
  });

  it('does not count the theme or outline keys toward the limit', () => {
    originalStorage.setItem('theme', bigValue());

    render(<StorageStatusNote />);

    expect(screen.getByRole('status')).toHaveTextContent('Saved in this browser');
  });

  it('measures again after learner data changes, and after an import or reset', () => {
    vi.useFakeTimers();
    render(<StorageStatusNote />);
    expect(screen.getByRole('status')).toHaveTextContent('Saved in this browser');

    act(() => {
      originalStorage.setItem('sv-uvm-guide:lab:big@1', bigValue());
      flashcardRecord.write({ cards: {}, decks: {}, positions: {} });
    });
    expect(screen.getByRole('status')).toHaveTextContent('Saved in this browser');
    act(() => {
      vi.advanceTimersByTime(1_500);
    });
    expect(screen.getByRole('status')).toHaveTextContent(NEARLY_FULL_COPY);

    act(() => {
      originalStorage.removeItem('sv-uvm-guide:lab:big@1');
      notifyLearnerStoreChanged();
      window.dispatchEvent(new Event(LEARNER_DATA_CHANGED_EVENT));
    });
    expect(screen.getByRole('status')).toHaveTextContent('Saved in this browser');
  });

  it('renders the saved label on the server, whatever the browser storage', () => {
    blockStorage();

    const html = renderToString(<StorageStatusNote />);

    expect(html).toContain('Saved in this browser');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).not.toContain('isn&#x27;t saving');
  });
});
