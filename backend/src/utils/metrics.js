const client = require('prom-client');

const telemetryDisabled = process.env.DISABLE_TELEMETRY === 'true';

// Use standard register, or custom empty one if disabled
const register = telemetryDisabled ? new client.Registry() : client.register;

// Enable default system metrics collection (CPU, Memory, Event Loop, etc.) if enabled
if (!telemetryDisabled) {
  client.collectDefaultMetrics({
    register,
    prefix: 'cinematcha_'
  });
}

const activeRegisters = telemetryDisabled ? [] : [register];

// 1. Counter metric for tracking Cache Hits
const cacheHitsCounter = new client.Counter({
  name: 'cinematcha_cache_hits_total',
  help: 'Total number of cache hits labeled by request resource type',
  labelNames: ['cache_type'],
  registers: activeRegisters
});

// 2. Counter metric for tracking Cache Misses
const cacheMissesCounter = new client.Counter({
  name: 'cinematcha_cache_misses_total',
  help: 'Total number of cache misses labeled by request resource type',
  labelNames: ['cache_type'],
  registers: activeRegisters
});

// 3. Token tracking
const aiTokensCounter = new client.Counter({
  name: 'cinematcha_ai_tokens_total',
  help: 'Total input/output AI tokens consumed by model type',
  labelNames: ['model', 'type'],
  registers: activeRegisters
});

// 4. Cost tracking
const aiCostCounter = new client.Counter({
  name: 'cinematcha_ai_cost_total',
  help: 'Cumulative API cost in USD labeled by model',
  labelNames: ['model'],
  registers: activeRegisters
});

// 5. Failover tracking
const aiFailoverCounter = new client.Counter({
  name: 'cinematcha_ai_failover_total',
  help: 'Total cascading failovers executed labeled by failed/fallback models',
  labelNames: ['failed_model', 'fallback_model'],
  registers: activeRegisters
});

// 6. Validation failures
const aiValidationFailuresCounter = new client.Counter({
  name: 'cinematcha_ai_validation_failures_total',
  help: 'Malformed output parser events tracking model retries',
  labelNames: ['model', 'retry_count'],
  registers: activeRegisters
});

// 7. Hallucination tracking
const aiHallucinationsCounter = new client.Counter({
  name: 'cinematcha_ai_hallucinations_total',
  help: 'Count of Jaro-Winkler or TMDB evicted recommendation titles',
  labelNames: ['suggested_title'],
  registers: activeRegisters
});

// 8. Custom HTTP Requests Counter
const httpRequestsTotal = new client.Counter({
  name: 'cinematcha_http_requests_total',
  help: 'Total number of HTTP requests processed by Cinematcha Gateway',
  labelNames: ['method', 'route', 'status_code'],
  registers: activeRegisters
});

// 9. Custom HTTP Duration Histogram
const httpRequestDuration = new client.Histogram({
  name: 'cinematcha_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
  registers: activeRegisters
});

module.exports = {
  register,
  cacheHitsCounter,
  cacheMissesCounter,
  aiTokensCounter,
  aiCostCounter,
  aiFailoverCounter,
  aiValidationFailuresCounter,
  aiHallucinationsCounter,
  httpRequestsTotal,
  httpRequestDuration
};
