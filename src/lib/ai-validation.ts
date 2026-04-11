/**
 * Sanitizes and validates user input for AI prompts to prevent prompt injection and other abuses.
 */
export function validateAIInput(
  content: unknown,
  maxLength: number = 2000,
  fieldName: string = 'content'
): { isValid: boolean; error?: string; sanitizedContent?: string } {
  if (typeof content !== 'string') {
    return {
      isValid: false,
      error: `${fieldName} must be a string.`
    };
  }

  const trimmed = content.trim();

  if (trimmed.length === 0) {
    return {
      isValid: false,
      error: `${fieldName} cannot be empty.`
    };
  }

  if (trimmed.length > maxLength) {
    return {
      isValid: false,
      error: `${fieldName} exceeds the maximum length of ${maxLength} characters.`
    };
  }

  // Basic sanitization:
  // 1. Remove control characters
  // 2. Escape backslashes first
  // 3. Escape double quotes (since they are used as delimiters in the prompt)

  const sanitized = trimmed
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // Remove control characters
    .replace(/\\/g, "\\\\") // Escape backslashes
    .replace(/"/g, '\\"'); // Escape double quotes

  return {
    isValid: true,
    sanitizedContent: sanitized
  };
}
