const { dailyQuotaMiddleware, memoryQuotaStore } = require('../rateLimit.middleware');
const { isRedisReady } = require('../../config/redis.config');

jest.mock('../../config/redis.config', () => ({
  getRedisClient: jest.fn(),
  isRedisReady: jest.fn(() => false) // Force Redis to be offline for testing fallback
}));

describe('Rate Limiting & Daily Quota Middleware Suite', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    memoryQuotaStore.clear();

    req = {
      ip: '127.0.0.1',
      headers: {},
      socket: {}
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    next = jest.fn();
  });

  test('should allow requests within the daily limit under fail-safe memory mode', async () => {
    // Perform 15 requests (exactly at the threshold limit)
    for (let i = 0; i < 15; i++) {
      await dailyQuotaMiddleware(req, res, next);
    }

    expect(next).toHaveBeenCalledTimes(15);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('should block requests exceeding the daily limit (16th request) under memory mode', async () => {
    // Perform 15 allowed requests
    for (let i = 0; i < 15; i++) {
      await dailyQuotaMiddleware(req, res, next);
    }

    // Perform 16th request which should be blocked
    await dailyQuotaMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(15); // Next was not called for the 16th
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Daily limit reached',
        resetTime: expect.any(String),
        message: expect.stringContaining('Daily API recommendation limit of 15 requests reached')
      })
    );
  });

  test('should track distinct counts for different IP addresses independently', async () => {
    const reqIP1 = { ...req, ip: '192.168.1.1' };
    const reqIP2 = { ...req, ip: '192.168.1.2' };

    // Request from IP1 15 times (meets quota)
    for (let i = 0; i < 15; i++) {
      await dailyQuotaMiddleware(reqIP1, res, next);
    }
    expect(next).toHaveBeenCalledTimes(15);

    // Request from IP2 1 time
    await dailyQuotaMiddleware(reqIP2, res, next);
    expect(next).toHaveBeenCalledTimes(16);
    expect(res.status).not.toHaveBeenCalled();
  });
});
