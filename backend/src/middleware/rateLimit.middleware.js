const rateLimit = require('express-rate-limit');
const { getRedisClient, isRedisReady } = require('../config/redis.config');

// In-memory fallback map for the daily quota
const memoryQuotaStore = new Map();

/**
 * Calculates the exact time remaining until the next UTC midnight
 */
function getMemoryQuotaResetTime() {
  const now = new Date();
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
  const secondsToMidnight = Math.ceil((midnight.getTime() - now.getTime()) / 1000);
  return { midnight, secondsToMidnight };
}

/**
 * Validates daily quota using the in-memory fallback cache
 * @param {string} ip - The client's IP address
 * @returns {object} - { count, resetTime }
 */
function checkMemoryQuota(ip) {
  const { midnight } = getMemoryQuotaResetTime();
  const record = memoryQuotaStore.get(ip);
  const nowMs = Date.now();

  // If no record exists, or the record has expired past midnight, reset/create it
  if (!record || nowMs >= record.expiresAt) {
    const newRecord = {
      count: 1,
      expiresAt: midnight.getTime()
    };
    memoryQuotaStore.set(ip, newRecord);
    return { count: 1, resetTime: midnight.toISOString() };
  }

  record.count += 1;
  memoryQuotaStore.set(ip, record);
  return { count: record.count, resetTime: new Date(record.expiresAt).toISOString() };
}

// 1. Global Memory Rate Limiter (100 requests per sliding window of 1 hour per IP)
const globalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100,
  message: {
    error: 'Too many requests',
    message: 'Too many requests from this IP, please try again after an hour.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 2. Aggressive Suggest Endpoint Rate Limiter (30 requests per sliding window of 1 hour per IP)
const suggestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  message: {
    error: 'Too many requests',
    message: 'Too many movie suggestions requested from this IP. Please try again in an hour.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 3. Custom Daily Request Cap (15 requests per calendar day per IP)
const DAILY_LIMIT = 15;

async function dailyQuotaMiddleware(req, res, next) {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  // Attempt stateful Redis-based validation if connection is live
  if (isRedisReady()) {
    try {
      const client = getRedisClient();
      const key = `quota:ip:${ip}`;

      const count = await client.incr(key);
      const { midnight, secondsToMidnight } = getMemoryQuotaResetTime();

      // If this is the first request of the day, apply a dynamic TTL to expire precisely at midnight UTC
      if (count === 1) {
        await client.expire(key, secondsToMidnight);
      }

      if (count > DAILY_LIMIT) {
        console.warn(`[SECURITY WARNING] Daily limit exceeded via Redis for IP: ${ip}. Count: ${count}`);
        return res.status(429).json({
          error: 'Daily limit reached',
          resetTime: midnight.toISOString(),
          message: `Daily API recommendation limit of ${DAILY_LIMIT} requests reached. Resets at UTC midnight (${midnight.toISOString()}).`
        });
      }

      return next();
    } catch (err) {
      console.error('[SECURITY WARNING] Redis Quota operation failed. Invoking safe memory fallback.', err.message);
      // Fall through to memory quota tracker
    }
  }

  // Safe In-Memory Fallback Track
  const { count, resetTime } = checkMemoryQuota(ip);

  if (count > DAILY_LIMIT) {
    console.warn(`[SECURITY WARNING] Daily limit exceeded via Memory Fallback for IP: ${ip}. Count: ${count}`);
    return res.status(429).json({
      error: 'Daily limit reached',
      resetTime,
      message: `Daily API recommendation limit of ${DAILY_LIMIT} requests reached. Resets at UTC midnight (${resetTime}).`
    });
  }

  next();
}

module.exports = {
  globalLimiter,
  suggestLimiter,
  dailyQuotaMiddleware,
  memoryQuotaStore // Exported for test verification if needed
};
