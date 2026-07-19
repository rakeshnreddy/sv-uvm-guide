/**
 * Normalizes text before it is placed inside a provider request. This is not a
 * prompt-injection boundary; authorization and server-owned instructions are.
 */
export function normalizeAIText(input: string): string {
  if (typeof input !== "string") return "";

  return input
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n?/g, "\n")
    .trim();
}
