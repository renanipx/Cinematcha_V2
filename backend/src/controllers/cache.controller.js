const cacheService = require('../services/cache.service');

/**
 * Handles administrative cache key sweeps matching glob patterns
 */
async function handleInvalidate(req, res, next) {
  const pattern = req.body?.pattern || req.query?.pattern;

  if (!pattern) {
    return res.status(400).json({
      error: 'Validation failed',
      message: 'Body/Query parameter "pattern" is required (e.g. "cache:suggest:*").'
    });
  }

  try {
    const evictedCount = await cacheService.scanAndDelete(pattern);
    console.log(`[REDIS] Administrative sweep completed. Pattern: "${pattern}". Evicted count: ${evictedCount}`);
    return res.status(200).json({
      status: 'success',
      evictedKeys: evictedCount
    });
  } catch (err) {
    console.error('[CACHE CONTROLLER ERROR] Cache invalidation failed:', err.message);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: err.message
    });
  }
}

module.exports = {
  handleInvalidate
};
