import React from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __resetRecordsForTests, defineKeyedRecord, defineRecord, isPlainObject } from '@/lib/learner-store/record';
import { useHydrated, useKeyedRecord, useKeyedRecordList, useRecord, useStorageStatus } from '@/lib/learner-store/react';
import { __resetStorageForTests } from '@/lib/learner-store/storage';

interface Counter {
  count: number;
}

function parseCounter(data: unknown): Counter | null {
  return isPlainObject(data) && typeof data.count === 'number' ? { count: data.count } : null;
}

const EMPTY: Counter = Object.freeze({ count: 0 });

const counterRecord = defineRecord<Counter>({
  key: 'sv-uvm-guide:test-react-counter',
  version: 1,
  empty: EMPTY,
  parse: parseCounter,
  maxChars: 1_000,
  merge: (local) => local,
});

const noteRecords = defineKeyedRecord<Counter>({
  prefix: 'sv-uvm-guide:test-react-notes:',
  version: 1,
  parse: (data) => parseCounter(data),
  maxChars: 1_000,
  merge: (local) => local,
});

function Learner({ noteId }: { noteId: string }) {
  const counter = useRecord(counterRecord);
  const note = useKeyedRecord(noteRecords, noteId);
  const notes = useKeyedRecordList(noteRecords);
  const status = useStorageStatus();
  const hydrated = useHydrated();
  return (
    <div>
      <p data-testid="count">{`count=${counter.count}`}</p>
      <p data-testid="note">{`note=${note ? note.count : 'none'}`}</p>
      <p data-testid="notes">{`notes=${notes.map((entry) => entry.id).join(',') || 'none'}`}</p>
      <p data-testid="status">{`status=${status}`}</p>
      <p data-testid="hydrated">{`hydrated=${String(hydrated)}`}</p>
    </div>
  );
}

const originalStorage = window.localStorage;

describe('learner-store React hooks', () => {
  let roots: Root[] = [];

  beforeEach(() => {
    __resetStorageForTests();
    __resetRecordsForTests();
    originalStorage.clear();
    roots = [];
  });

  afterEach(() => {
    act(() => roots.forEach((root) => root.unmount()));
    cleanup();
    document.body.innerHTML = '';
    Object.defineProperty(window, 'localStorage', { value: originalStorage, configurable: true, writable: true });
    originalStorage.clear();
    __resetStorageForTests();
    __resetRecordsForTests();
  });

  it('renders the empty server snapshots during the server render, whatever is stored', () => {
    counterRecord.write({ count: 5 });
    noteRecords.set('a', { count: 1 });

    const html = renderToString(<Learner noteId="a" />);

    expect(html).toContain('count=0');
    expect(html).toContain('note=none');
    expect(html).toContain('notes=none');
    expect(html).toContain('status=available');
    expect(html).toContain('hydrated=false');
  });

  it('hydrates the server markup without a mismatch, then shows the stored values', () => {
    counterRecord.write({ count: 5 });
    noteRecords.set('a', { count: 1 });
    noteRecords.set('b', { count: 2 });
    const html = renderToString(<Learner noteId="a" />);
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    const consoleError = vi.spyOn(console, 'error');
    const onRecoverableError = vi.fn();

    act(() => {
      roots.push(hydrateRoot(container, <Learner noteId="a" />, { onRecoverableError }));
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
    expect(container.textContent).toContain('count=5');
    expect(container.textContent).toContain('note=1');
    expect(container.textContent).toContain('notes=a,b');
    expect(container.textContent).toContain('hydrated=true');
  });

  it('re-renders on writes from this tab and on storage events from other tabs', () => {
    render(<Learner noteId="a" />);
    expect(screen.getByTestId('count')).toHaveTextContent('count=0');
    expect(screen.getByTestId('hydrated')).toHaveTextContent('hydrated=true');

    act(() => {
      counterRecord.update((current) => ({ count: current.count + 1 }));
      noteRecords.set('a', { count: 4 });
    });
    expect(screen.getByTestId('count')).toHaveTextContent('count=1');
    expect(screen.getByTestId('note')).toHaveTextContent('note=4');
    expect(screen.getByTestId('notes')).toHaveTextContent('notes=a');

    act(() => {
      originalStorage.setItem(counterRecord.key, JSON.stringify({ v: 1, data: { count: 9 } }));
      window.dispatchEvent(new StorageEvent('storage', { key: counterRecord.key }));
    });
    expect(screen.getByTestId('count')).toHaveTextContent('count=9');
  });

  it('reports blocked storage after hydration', () => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('blocked', 'SecurityError');
      },
      configurable: true,
    });

    render(<Learner noteId="a" />);

    expect(screen.getByTestId('status')).toHaveTextContent('status=unavailable');
    expect(screen.getByTestId('count')).toHaveTextContent('count=0');
  });
});
