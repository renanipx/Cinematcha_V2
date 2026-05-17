const logger = require('../utils/logger');

/**
 * Validates the raw AI response against the Cinematcha movie suggestions contract.
 * Checks for conversational prose and ensures the output is a clean array of 5 to 10 movie titles.
 * Strips list numbers or prefixes if present.
 * @param {string} rawContent - Raw text output from LLM
 * @returns {string[]} - Array of cleaned movie titles
 */
function validateResponseContract(rawContent) {
  if (!rawContent || typeof rawContent !== 'string') {
    throw new Error('Response is null or not a string.');
  }

  // Check for common conversational prose patterns in both English and Portuguese
  const conversationalProseTriggers = [
    /^sure/i, /^here are/i, /^here is/i, /^certainly/i, 
    /^recomendo/i, /^claro/i, /^como solicitado/i, 
    /\bsocial\b/i, /\bhope you\b/i, /\bmy suggestions\b/i,
    /claro!/i, /certamente/i, /aqui estão/i, /aqui está/i
  ];

  const trimmed = rawContent.trim();
  const hasProse = conversationalProseTriggers.some(trigger => trigger.test(trimmed));

  if (hasProse) {
    throw new Error('Response contains conversational prose filler.');
  }

  // Parse comma-separated titles and strip numbering/prefixes (e.g. "1. Inception", "2) Matrix", "3- Alien")
  const titles = trimmed.split(',')
    .map(t => t.trim().replace(/^[0-9]+[\.\-\)\s]+/, '').trim()) // Strip numbering like "1.", "2 - ", "3)"
    .map(t => t.replace(/[\r\n\t\*\"']/g, '').trim()) // Clean special formatting like markdown asterisks or quotes
    .filter(t => t.length > 0);

  if (titles.length < 5 || titles.length > 10) {
    throw new Error(`Response title count out of boundaries: ${titles.length} titles parsed.`);
  }

  return titles;
}

module.exports = {
  validateResponseContract
};
