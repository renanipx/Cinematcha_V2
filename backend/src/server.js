require('dotenv').config();
const express = require('express');
const { globalLimiter, suggestLimiter, dailyQuotaMiddleware } = require('./middleware/rateLimit.middleware');
const { sanitizePrompt } = require('./utils/sanitizer');
const { handleSuggest } = require('./controllers/suggest.controller');
const logger = require('./utils/logger');
const { correlationIdMiddleware, httpLoggingMiddleware } = require('./middleware/logging.middleware');

const app = express();
const PORT = process.env.PORT || 3001;

// 0. Correlation ID & HTTP Logging Middleware (mounted first to trace all lifecycles)
app.use(correlationIdMiddleware);
app.use(httpLoggingMiddleware);

// 1. Core Express JSON Parser
app.use(express.json());

// Enable CORS headers middleware
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-cinematcha-prompt-version');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// 2. Global Input Sanitization Hook (Scans body requests for potential LLM/XSS injection)
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object' && 'prompt' in req.body) {
    const result = sanitizePrompt(req.body.prompt);
    
    if (!result.isValid) {
      logger.warn(`[SECURITY ADVISORY] Blocked prompt from ${req.ip || 'unknown'}. Reason: ${result.message}`);
      return res.status(400).json({
        error: result.error,
        message: result.message
      });
    }
    
    // Replace raw body string with the safely escaped/sanitized variation
    req.body.prompt = result.sanitized;
  }
  next();
});

// Standard API Endpoints protected by Moderate rate-limiting (100 reqs/hr)
app.get('/trending', globalLimiter, (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 1, title: 'Mock Trending Movie 1' },
      { id: 2, title: 'Mock Trending Movie 2' }
    ]
  });
});

app.get('/popular', globalLimiter, (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 3, title: 'Mock Popular Movie 1' },
      { id: 4, title: 'Mock Popular Movie 2' }
    ]
  });
});

// Protect high-cost Suggest recommendation routes with Aggressive throttling and Daily caps
const suggestProtection = [suggestLimiter, dailyQuotaMiddleware];

app.post('/api/suggest', suggestProtection, handleSuggest);

// Backwards compatibility endpoint
app.post('/suggest', suggestProtection, handleSuggest);

// Cache management administrative endpoints
const { handleInvalidate } = require('./controllers/cache.controller');
app.delete('/api/cache/invalidate', globalLimiter, handleInvalidate);

// Observability metrics endpoint
const { register } = require('./utils/metrics');
app.get('/metrics', globalLimiter, async (req, res) => {
  if (process.env.DISABLE_TELEMETRY === 'true') {
    return res.status(503).send('Telemetry Disabled via environment configurations.');
  }
  
  try {
    res.setHeader('Content-Type', register.contentType);
    res.send(await register.metrics());
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Centralized error handler
app.use((err, req, res, next) => {
  logger.error(`[SERVER ERROR] ${err.stack}`);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message || 'An unexpected security or processing error occurred.'
  });
});

// Check write access to the logging directory
const fs = require('fs');
const LOG_DIR = process.env.LOG_DIR || '/var/log/cinematcha';
const isProduction = process.env.NODE_ENV === 'production';
const forceMinimal = process.env.FORCE_MINIMAL_LOGGING === 'true';

if (isProduction && !forceMinimal) {
  try {
    fs.accessSync(LOG_DIR, fs.constants.W_OK);
    logger.info(`[SERVER] Log directory ${LOG_DIR} is verified writable.`);
  } catch (err) {
    logger.warn(`[SERVER WARNING] Log directory ${LOG_DIR} is not writable or does not exist: ${err.message}. Winston daily rotation will be inactive. Streams remain functional on console.`);
  }
}

// Startup listener
const server = app.listen(PORT, () => {
  logger.info(`[SERVER] Cinematcha backend running cleanly on port ${PORT}`);
  logger.info(`[SERVER] AI Orchestration & Reliability Pipeline initialized. Active Models: ${require('./services/failover.service').MODEL_CASCADE.map(m => m.id).join(', ')}`);
});

module.exports = { app, server };
