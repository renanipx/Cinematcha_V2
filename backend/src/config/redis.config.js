const { createClient } = require('redis');

const DISABLE_REDIS = process.env.DISABLE_REDIS === 'true' || process.env.DISABLE_CACHE === 'true';
const REDIS_URL = process.env.REDIS_URL || 'redis://redis-cache:6379';

let redisClient = null;
let isRedisConnected = false;

if (!DISABLE_REDIS) {
  redisClient = createClient({
    url: REDIS_URL,
    socket: {
      reconnectStrategy: (retries) => {
        // Exponential backoff with a cap of 30 seconds
        const delay = Math.min(Math.pow(2, retries) * 1000, 30000);
        console.warn(`[REDIS] Connection failed. Retrying in ${delay}ms... (Attempt ${retries})`);
        return delay;
      }
    }
  });

  redisClient.on('error', (err) => {
    console.error('[REDIS] Client experienced connection error:', err.message);
    isRedisConnected = false;
  });

  redisClient.on('connect', () => {
    console.log('[REDIS] Client is connecting to Redis...');
  });

  redisClient.on('ready', () => {
    console.log('[REDIS] Redis client connection established and ready.');
    isRedisConnected = true;
  });

  redisClient.on('end', () => {
    console.warn('[REDIS] Redis connection ended.');
    isRedisConnected = false;
  });

  // Connect asynchronously, catch initialization error to ensure the backend starts safely
  redisClient.connect().catch((err) => {
    console.error('[REDIS] Initial connection to Redis failed. Active fail-safe fallback to memory.', err.message);
    isRedisConnected = false;
  });
} else {
  console.log('[REDIS] Redis client disabled via environmental toggle DISABLE_REDIS.');
}

/**
 * Returns the active Redis client instance (or null if disabled)
 */
function getRedisClient() {
  return redisClient;
}

/**
 * Checks if the Redis client is initialized, active, and fully connected
 */
function isRedisReady() {
  return !DISABLE_REDIS && redisClient !== null && isRedisConnected;
}

module.exports = {
  getRedisClient,
  isRedisReady
};
