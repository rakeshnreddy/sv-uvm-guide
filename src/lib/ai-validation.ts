/**
 * Validates and sanitizes user input for AI prompts to prevent injection.
 * Enforces a maximum length and escapes potentially dangerous characters.
 *
 * @param input The raw user input string.
 * @param maxLength The maximum allowed length (default: 2000).
 * @returns The sanitized and truncated input string.
 */
export function validateAIInput(input: string, maxLength: number = 2000): string {
  if (!input) return "";

  // Truncate to maximum length
  let sanitized = input.slice(0, maxLength);

  // Escape backslashes first, then double quotes to avoid double escaping
  // This helps prevent breaking out of string delimiters in prompts
  sanitized = sanitized
    .replace(/\\/g, "\\\\")
    .replace(/"/g, "\\\"");

  return sanitized;
}
