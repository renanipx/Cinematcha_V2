const crypto = require('crypto');
const logger = require('../utils/logger');
const metrics = require('../utils/metrics');

// Middleware to capture X-Correlation-ID or inject a fresh UUID v4 trace
function correlationIdMiddleware(req, res, next) {
  const correlationHeader = req.get('X-Correlation-ID');
  const traceId = correlationHeader || crypto.randomUUID();
  
  // Attach correlation ID to request context for subsequent processing steps
  req.traceId = traceId;
  res.set('X-Correlation-ID', traceId);
  next();
}

// Middleware to capture Express endpoint transaction metrics and JSON log outputs
function httpLoggingMiddleware(req, res, next) {
  const startTime = process.hrtime();
  
  res.on('finish', () => {
    const diff = process.hrtime(startTime);
    const durationSeconds = diff[0] + diff[1] / 1e9;
    const statusCode = res.statusCode;
    
    // 1. Record transaction latency duration and total HTTP requests in Prometheus if available
    try {
      if (metrics.httpRequestDuration) {
        metrics.httpRequestDuration
          .labels(req.method, req.route ? req.route.path : req.path, statusCode)
          .observe(durationSeconds);
      }
      if (metrics.httpRequestsTotal) {
        metrics.httpRequestsTotal
          .labels(req.method, req.route ? req.route.path : req.path, statusCode)
          .inc();
      }
    } catch (err) {
      logger.error(`[METRICS ERROR] Failed to record http metrics: ${err.message}`);
    }

    // 2. Output structured JSON transaction log via Winston
    logger.info({
      message: `HTTP ${req.method} ${req.originalUrl} finished with status ${statusCode} in ${Math.round(durationSeconds * 1000)}ms`,
      context: 'API_GATEWAY',
      traceId: req.traceId,
      metadata: {
        method: req.method,
        url: req.originalUrl,
        statusCode,
        durationMs: Math.round(durationSeconds * 1000),
        userAgent: req.get('User-Agent'),
        ip: req.ip
      }
    });
  });
  
  next();
}

module.exports = {
  correlationIdMiddleware,
  httpLoggingMiddleware
};
