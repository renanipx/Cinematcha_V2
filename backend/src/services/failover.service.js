const logger = require('../utils/logger');

const MODEL_CASCADE = [
  { id: 'gemini-1.5-flash-latest', timeoutMs: 8000, costPer1kIn: 0.000075, costPer1kOut: 0.0003 },
  { id: 'gemini-1.5-pro', timeoutMs: 10000, costPer1kIn: 0.0035, costPer1kOut: 0.0105 },
  { id: 'gemini-2.0-flash-exp', timeoutMs: 8000, costPer1kIn: 0.00015, costPer1kOut: 0.0006 }
];

const circuitBreakerRegistry = {};
const FAILURE_THRESHOLD = 3;
const COOLDOWN_DURATION_MS = 300000; // 5 Minutes

/**
 * Checks if a model service is healthy. Trips circuit breaker for 5 mins after 3 consecutive failures.
 * @param {string} modelId - The model identifier
 * @returns {boolean} - Health status
 */
function isModelHealthy(modelId) {
  const record = circuitBreakerRegistry[modelId];
  if (!record) return true;

  if (record.trippedUntil && record.trippedUntil > Date.now()) {
    return false; // Circuit is TRIPPED (Open)
  }

  if (record.trippedUntil && record.trippedUntil <= Date.now()) {
    // Cooldown expired; Reset circuit to HALF-OPEN / Healthy state
    record.consecutiveFailures = 0;
    record.trippedUntil = null;
    logger.info(`[FAILOVER] Circuit Breaker RESET to healthy for model ${modelId}`);
  }

  return true;
}

/**
 * Records a failure for a model service, checking if threshold is breached.
 * @param {string} modelId - The model identifier
 */
function recordModelFailure(modelId) {
  if (!circuitBreakerRegistry[modelId]) {
    circuitBreakerRegistry[modelId] = { consecutiveFailures: 0, trippedUntil: null };
  }

  const record = circuitBreakerRegistry[modelId];
  record.consecutiveFailures += 1;

  if (record.consecutiveFailures >= FAILURE_THRESHOLD) {
    record.trippedUntil = Date.now() + COOLDOWN_DURATION_MS;
    logger.warn(`[FAILOVER] Circuit Breaker TRIPPED for model ${modelId} until ${new Date(record.trippedUntil).toISOString()}`);
  } else {
    logger.info(`[FAILOVER] Recorded failure for model ${modelId}. Consecutive count: ${record.consecutiveFailures}/${FAILURE_THRESHOLD}`);
  }
}

/**
 * Resets the consecutive failure counter for a model on successful execution.
 * @param {string} modelId - The model identifier
 */
function recordModelSuccess(modelId) {
  if (circuitBreakerRegistry[modelId]) {
    circuitBreakerRegistry[modelId].consecutiveFailures = 0;
    circuitBreakerRegistry[modelId].trippedUntil = null;
  }
}

/**
 * Resolves the active model cascade array based on environment overrides and model health.
 * @returns {object[]} - Array of active model configuration blocks
 */
function getActiveModelCascade() {
  const disableFailover = process.env.DISABLE_AI_FAILOVER === 'true';

  if (disableFailover) {
    // Return only the primary model (first item in cascade)
    return [MODEL_CASCADE[0]];
  }

  // Filter models that are healthy (not currently tripped)
  return MODEL_CASCADE.filter(model => isModelHealthy(model.id));
}

/**
 * Checks if the static recommendations catalog fallback is forced.
 * @returns {boolean}
 */
function isStaticFallbackForced() {
  return process.env.FORCE_STATIC_FALLBACK === 'true';
}

module.exports = {
  MODEL_CASCADE,
  isModelHealthy,
  recordModelFailure,
  recordModelSuccess,
  getActiveModelCascade,
  isStaticFallbackForced,
  circuitBreakerRegistry
};
