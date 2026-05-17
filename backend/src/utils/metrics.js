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

module.exports = {
  register: client.register,
  cacheHitsCounter,
  cacheMissesCounter
};
