import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { downloadBlob, downloadText, OBJECT_URL_REVOKE_DELAY_MS } from '@/lib/download';

const originalCreate = URL.createObjectURL;
const originalRevoke = URL.revokeObjectURL;

describe('download helpers', () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let clicked: HTMLAnchorElement[];

  beforeEach(() => {
    vi.useFakeTimers();
    createObjectURL = vi.fn(() => 'blob:sv-uvm-guide/123');
    revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true, writable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true, writable: true });
    clicked = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(this: HTMLAnchorElement) {
      clicked.push(this);
      expect(document.body.contains(this)).toBe(true);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Object.defineProperty(URL, 'createObjectURL', { value: originalCreate, configurable: true, writable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: originalRevoke, configurable: true, writable: true });
  });

  it('saves text through an object URL and a temporary anchor, then revokes the URL late', () => {
    expect(downloadText('{"ok":true}', 'sv-uvm-guide-learning-data.json', 'application/json')).toBe(true);

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('application/json');
    expect(blob.size).toBe(new TextEncoder().encode('{"ok":true}').length);

    expect(clicked).toHaveLength(1);
    expect(clicked[0].download).toBe('sv-uvm-guide-learning-data.json');
    expect(clicked[0].getAttribute('href')).toBe('blob:sv-uvm-guide/123');
    expect(document.body.contains(clicked[0])).toBe(false);

    // Safari reads the URL after click() returns, so it must outlive the click by a long way.
    expect(OBJECT_URL_REVOKE_DELAY_MS).toBeGreaterThanOrEqual(30_000);
    vi.advanceTimersByTime(OBJECT_URL_REVOKE_DELAY_MS - 1);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:sv-uvm-guide/123');
  });

  it('defaults to text/plain', () => {
    downloadText('notes', 'notes.txt');
    expect((createObjectURL.mock.calls[0][0] as Blob).type).toBe('text/plain');
  });

  it('saves a Blob as given', () => {
    const blob = new Blob(['zip'], { type: 'application/zip' });
    expect(downloadBlob(blob, 'lab.zip')).toBe(true);
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(clicked[0].download).toBe('lab.zip');
  });

  it('removes the anchor and revokes the URL even when click throws', () => {
    vi.mocked(HTMLAnchorElement.prototype.click).mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => downloadText('x', 'x.txt')).toThrow('blocked');
    expect(document.body.querySelector('a[download]')).toBeNull();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(OBJECT_URL_REVOKE_DELAY_MS);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it('does nothing where object URLs are unavailable', () => {
    Object.defineProperty(URL, 'createObjectURL', { value: undefined, configurable: true, writable: true });

    expect(downloadText('x', 'x.txt')).toBe(false);
    expect(clicked).toHaveLength(0);
  });

  it('does nothing on the server', () => {
    vi.stubGlobal('window', undefined);

    expect(downloadText('x', 'x.txt')).toBe(false);
    expect(downloadBlob(new Blob(['x']), 'x.txt')).toBe(false);
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});
