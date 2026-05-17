const crypto = require('crypto');
const { getRedisClient, isRedisReady } = require('../config/redis.config');

/**
 * Normalizes and hashes the prompt to create a standard SHA-256 key digest
 * @param {string} prompt - The natural language search query
 * @returns {string} - The hex digest of the hashed prompt
 */
function hashPrompt(prompt) {
  if (typeof prompt !== 'string') return '';
  return crypto
    .createHash('sha256')
    .update(prompt.trim().toLowerCase())
    .digest('hex');
}

/**
 * Gets a cached item and parses it from JSON format
 * @param {string} key - The Redis namespace key
 * @returns {Promise<any|null>} - The parsed value or null if cache miss or error
 */
async function get(key) {
  if (!isRedisReady()) return null;
  try {
    const client = getRedisClient();
    const value = await client.get(key);
    if (!value) return null;
    return JSON.parse(value);
  } catch (err) {
    console.error(`[REDIS ERROR] Fail-safe active. Failed to GET key "${key}":`, err.message);
    return null;
  }
}

/**
 * Sets an item in the cache with a serialized JSON format and expiration TTL
 * @param {string} key - The Redis namespace key
 * @param {any} value - The payload to serialize and cache
 * @param {number} ttlSeconds - Time-To-Live in seconds (default 24h / 86400s)
 * @returns {Promise<boolean>} - True if set successfully, false otherwise
 */
async function set(key, value, ttlSeconds = 86400) {
  if (!isRedisReady()) return false;
  try {
    const client = getRedisClient();
    const serialized = JSON.stringify(value);
    await client.set(key, serialized, {
      EX: ttlSeconds
    });
    return true;
  } catch (err) {
    console.error(`[REDIS ERROR] Fail-safe active. Failed to SET key "${key}":`, err.message);
    return false;
  }
}

/**
 * Evicts/Deletes a specific key from Redis
 * @param {string} key - The key to delete
 * @returns {Promise<boolean>} - True if deleted successfully
 */
async function del(key) {
  if (!isRedisReady()) return false;
  try {
    const client = getRedisClient();
    await client.del(key);
    return true;
  } catch (err) {
    console.error(`[REDIS ERROR] Fail-safe active. Failed to DEL key "${key}":`, err.message);
    return false;
  }
}

/**
 * Sweeps the cache using cursor-based SCAN to find and delete matching keys
 * @param {string} pattern - The GLOB match pattern (e.g. 'cache:suggest:*')
 * @returns {Promise<number>} - Count of evicted keys
 */
async function scanAndDelete(pattern) {
  if (!isRedisReady()) return 0;
  try {
    const client = getRedisClient();
    let cursor = 0;
    let totalDeleted = 0;

    do {
      const reply = await client.scan(cursor, {
        MATCH: pattern,
        COUNT: 100
      });
      
      cursor = Number(reply.cursor);
      const keys = reply.keys;

      if (keys && keys.length > 0) {
        await client.del(keys);
        totalDeleted += keys.length;
      }
    } while (cursor !== 0);

    return totalDeleted;
  } catch (err) {
    console.error(`[REDIS ERROR] Fail-safe active. Failed to sweep pattern "${pattern}":`, err.message);
    return 0;
  }
}

module.exports = {
  hashPrompt,
  get,
  set,
  del,
  scanAndDelete
};
