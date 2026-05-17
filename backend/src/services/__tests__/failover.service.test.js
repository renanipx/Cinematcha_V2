const failoverService = require('../failover.service');

describe('AI Failover Service & Circuit Breaker Suite', () => {
  const originalEnvDisable = process.env.DISABLE_AI_FAILOVER;
  const originalEnvForce = process.env.FORCE_STATIC_FALLBACK;

  beforeEach(() => {
    delete process.env.DISABLE_AI_FAILOVER;
    delete process.env.FORCE_STATIC_FALLBACK;
    // Clear circuit breaker state
    for (const key in failoverService.circuitBreakerRegistry) {
      delete failoverService.circuitBreakerRegistry[key];
    }
  });

  afterAll(() => {
    process.env.DISABLE_AI_FAILOVER = originalEnvDisable;
    process.env.FORCE_STATIC_FALLBACK = originalEnvForce;
  });

  test('should return all models in cascade initially as they are healthy', () => {
    const active = failoverService.getActiveModelCascade();
    expect(active).toHaveLength(3);
    expect(active[0].id).toBe('gemini-1.5-flash-latest');
  });

  test('should trip circuit breaker after 3 failures', () => {
    const model = 'gemini-1.5-flash-latest';
    expect(failoverService.isModelHealthy(model)).toBe(true);

    failoverService.recordModelFailure(model);
    expect(failoverService.isModelHealthy(model)).toBe(true);

    failoverService.recordModelFailure(model);
    expect(failoverService.isModelHealthy(model)).toBe(true);

    failoverService.recordModelFailure(model);
    expect(failoverService.isModelHealthy(model)).toBe(false); // Tripped!

    // Cascade should now omit the tripped model
    const active = failoverService.getActiveModelCascade();
    expect(active).toHaveLength(2);
    expect(active.some(m => m.id === model)).toBe(false);
  });

  test('should reset circuit breaker on success', () => {
    const model = 'gemini-1.5-flash-latest';
    failoverService.recordModelFailure(model);
    failoverService.recordModelFailure(model);
    
    // Success resets it
    failoverService.recordModelSuccess(model);
    
    // Third failure now shouldn't trip
    failoverService.recordModelFailure(model);
    expect(failoverService.isModelHealthy(model)).toBe(true);
  });

  test('should half-open/reset when tripped cooldown expires', () => {
    const model = 'gemini-1.5-flash-latest';
    failoverService.recordModelFailure(model);
    failoverService.recordModelFailure(model);
    failoverService.recordModelFailure(model);
    expect(failoverService.isModelHealthy(model)).toBe(false);

    // Mock trippedUntil to the past
    failoverService.circuitBreakerRegistry[model].trippedUntil = Date.now() - 1000;
    
    expect(failoverService.isModelHealthy(model)).toBe(true); // Reset!
  });

  test('should enforce DISABLE_AI_FAILOVER by returning only primary model', () => {
    process.env.DISABLE_AI_FAILOVER = 'true';
    const active = failoverService.getActiveModelCascade();
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe('gemini-1.5-flash-latest');
  });

  test('should detect FORCE_STATIC_FALLBACK correctly', () => {
    expect(failoverService.isStaticFallbackForced()).toBe(false);
    process.env.FORCE_STATIC_FALLBACK = 'true';
    expect(failoverService.isStaticFallbackForced()).toBe(true);
  });
});
