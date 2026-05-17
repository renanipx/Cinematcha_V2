const { register, cacheHitsCounter, cacheMissesCounter } = require('../metrics');

describe('Prometheus Observability Metrics Suite', () => {
  test('should initialize and register custom Prometheus counters', () => {
    expect(register).toBeDefined();
    expect(cacheHitsCounter).toBeDefined();
    expect(cacheMissesCounter).toBeDefined();

    // Verify counter names in the registry
    const metricsString = register.metrics();
    return metricsString.then(str => {
      expect(str).toContain('cinematcha_cache_hits_total');
      expect(str).toContain('cinematcha_cache_misses_total');
    });
  });

  test('should increment cache hit and miss counters with correct label metadata', async () => {
    cacheHitsCounter.reset();
    cacheMissesCounter.reset();

    // Trigger increments
    cacheHitsCounter.inc({ cache_type: 'suggest' });
    cacheMissesCounter.inc({ cache_type: 'movie_search' });

    const str = await register.metrics();
    expect(str).toContain('cinematcha_cache_hits_total{cache_type="suggest"} 1');
    expect(str).toContain('cinematcha_cache_misses_total{cache_type="movie_search"} 1');
  });
});
