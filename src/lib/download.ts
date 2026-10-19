/**
 * How long the object URL stays valid after the click. Safari and iOS read it
 * after click() returns and fail the download (WebKitBlobResource error) when
 * it is revoked too soon, so it is revoked late, as FileSaver.js does.
 */
export const OBJECT_URL_REVOKE_DELAY_MS = 40_000;

/**
 * Saves a file in the browser through an object URL and a temporary anchor.
 * Call it from an event handler. Does nothing on the server or where object
 * URLs are unavailable, and returns whether the download was started.
 */
export function downloadBlob(blob: Blob, fileName: string): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return false;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), OBJECT_URL_REVOKE_DELAY_MS);
  }
  return true;
}

/** Saves `text` as a file named `fileName` with the given media type. */
export function downloadText(text: string, fileName: string, mime = 'text/plain'): boolean {
  if (typeof window === 'undefined' || typeof Blob === 'undefined') return false;
  return downloadBlob(new Blob([text], { type: mime }), fileName);
}
