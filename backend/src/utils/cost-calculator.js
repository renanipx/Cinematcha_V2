const logger = require('./logger');
const metrics = require('./metrics');

// In-Memory Model Token Pricing Sheets (per 1,000 tokens)
const PRICING_CATALOG = {
  'gemini-1.5-flash-latest': {
    input: 0.000075 / 1000,
    output: 0.0003 / 1000
  },
  'gemini-1.5-pro': {
    input: 0.0035 / 1000,
    output: 0.0105 / 1000
  },
  'gemini-2.0-flash-exp': {
    input: 0.00015 / 1000,
    output: 0.0006 / 1000
  }
};

/**
 * Dynamically calculates the estimated USD cost of every Gemini transaction,
 * increments standard Prometheus metrics, and outputs structured cost logs.
 * 
 * @param {string} modelId - LLM Model ID
 * @param {number} inputTokenCount - Number of input prompt tokens
 * @param {number} outputTokenCount - Number of output response tokens
 * @param {string} traceId - Transaction correlation tracing ID
 * @param {string} context - Execution context (e.g. 'suggest')
 * @returns {number} - Calculated total cost in USD
 */
function trackTransactionCosts(modelId, inputTokenCount, outputTokenCount, traceId, context = 'suggest') {
  // Use model config rates or fallback to gemini-1.5-flash-latest
  const modelRates = PRICING_CATALOG[modelId] || PRICING_CATALOG['gemini-1.5-flash-latest'];
  
  // Calculate dynamic transaction cost
  const inputCost = inputTokenCount * modelRates.input;
  const outputCost = outputTokenCount * modelRates.output;
  const totalCost = inputCost + outputCost;

  // 1. Record Prometheus counters using the standard metrics exporter
  try {
    if (metrics.aiTokensCounter) {
      metrics.aiTokensCounter.labels(modelId, 'input').inc(inputTokenCount);
      metrics.aiTokensCounter.labels(modelId, 'output').inc(outputTokenCount);
    }
    if (metrics.aiCostCounter) {
      metrics.aiCostCounter.labels(modelId).inc(totalCost);
    }
  } catch (err) {
    logger.error(`[METRICS ERROR] Failed to record token costs: ${err.message}`);
  }

  // 2. Emit structured log tracking costs
  logger.info({
    message: `[AI_COST] Transaction completed. Model: ${modelId}, Tokens: [In:${inputTokenCount} | Out:${outputTokenCount}], Cost: $${totalCost.toFixed(6)}`,
    context: 'AI_ORCHESTRATION',
    traceId,
    metadata: {
      modelId,
      inputTokenCount,
      outputTokenCount,
      totalCost,
      context
    }
  });

  return totalCost;
}

module.exports = {
  PRICING_CATALOG,
  trackTransactionCosts
};
