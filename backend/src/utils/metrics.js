const client = require('prom-client');

// Enable default system metrics collection (CPU, Memory, Event Loop, etc.)
client.collectDefaultMetrics({
  register: client.register,
  prefix: 'cinematcha_'
});

// Counter metric for tracking Cache Hits
const cacheHitsCounter = new client.Counter({
  name: 'cinematcha_cache_hits_total',
  help: 'Total number of cache hits labeled by request resource type',
  labelNames: ['cache_type']
});

// Counter metric for tracking Cache Misses
const cacheMissesCounter = new client.Counter({
  name: 'cinematcha_cache_misses_total',
  help: 'Total number of cache misses labeled by request resource type',
  labelNames: ['cache_type']
});

// Token tracking
const aiTokensCounter = new client.Counter({
  name: 'cinematcha_ai_tokens_total',
  help: 'Total input/output AI tokens consumed by model type',
  labelNames: ['model', 'type']
});

// Cost tracking
const aiCostCounter = new client.Counter({
  name: 'cinematcha_ai_cost_total',
  help: 'Cumulative API cost in USD labeled by model',
  labelNames: ['model']
});

// Failover tracking
const aiFailoverCounter = new client.Counter({
  name: 'cinematcha_ai_failover_total',
  help: 'Total cascading failovers executed labeled by failed/fallback models',
  labelNames: ['failed_model', 'fallback_model']
});

// Validation failures
const aiValidationFailuresCounter = new client.Counter({
  name: 'cinematcha_ai_validation_failures_total',
  help: 'Malformed output parser events tracking model retries',
  labelNames: ['model', 'retry_count']
});

// Hallucination tracking
const aiHallucinationsCounter = new client.Counter({
  name: 'cinematcha_ai_hallucinations_total',
  help: 'Count of Jaro-Winkler or TMDB evicted recommendation titles',
  labelNames: ['suggested_title']
});

module.exports = {
  register: client.register,
  cacheHitsCounter,
  cacheMissesCounter,
  aiTokensCounter,
  aiCostCounter,
  aiFailoverCounter,
  aiValidationFailuresCounter,
  aiHallucinationsCounter
};
