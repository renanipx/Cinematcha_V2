/**
 * Sanitizes user-provided search prompts to prevent prompt injection and execution attacks.
 * 
 * Pass 1: Structural boundaries and character-level escaping.
 * Pass 2: Regular-expression screening against known LLM injection patterns.
 * 
 * @param {string} prompt - The raw user prompt
 * @returns {object} - Validation result containing { isValid, sanitized, error, message }
 */
function sanitizePrompt(prompt) {
  if (typeof prompt !== 'string') {
    return {
      isValid: false,
      error: 'Validation failed',
      message: 'Input must be a string'
    };
  }

  // 1. Enforce strict 300-character boundary
  if (prompt.length > 300) {
    return {
      isValid: false,
      error: 'Validation failed',
      message: 'Exceeds 300 char limit'
    };
  }

  // 2. Check for Prompt-Injection Patterns (Blocklist Regex)
  const INJECTION_PATTERNS = [
    /ignore\s+previous/i,
    /system\s+prompt/i,
    /bypass\s+instructions/i,
    /you\s+are\s+now\s+a/i,
    /translate\s+this/i,
    /override\s+instructions/i
  ];

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(prompt)) {
      // Log the attack attempt (can hook central winston logger in server integration)
      console.warn(`[SECURITY WARNING] Prompt injection pattern matched: ${pattern} in prompt: "${prompt}"`);
      return {
        isValid: false,
        error: 'Security validation failed',
        message: 'Invalid characters or patterns detected.'
      };
    }
  }

  // 3. Escape HTML tags, double braces (execution blocks), and control characters
  const escaped = prompt
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/`/g, '&#x60;')
    .replace(/\{/g, '&#x7B;')
    .replace(/\}/g, '&#x7D;');

  return {
    isValid: true,
    sanitized: escaped
  };
}

module.exports = {
  sanitizePrompt
};
