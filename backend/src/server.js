const express = require('express');
const { globalLimiter, suggestLimiter, dailyQuotaMiddleware } = require('./middleware/rateLimit.middleware');
const { sanitizePrompt } = require('./utils/sanitizer');
const { handleSuggest } = require('./controllers/suggest.controller');

const app = express();
const PORT = process.env.PORT || 3001;

// 1. Core Express JSON Parser
app.use(express.json());

// 2. Global Input Sanitization Hook (Scans body requests for potential LLM/XSS injection)
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object' && 'prompt' in req.body) {
    const result = sanitizePrompt(req.body.prompt);
    
    if (!result.isValid) {
      console.warn(`[SECURITY ADVISORY] Blocked prompt from ${req.ip || 'unknown'}. Reason: ${result.message}`);
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

// Centralized error handler
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message || 'An unexpected security or processing error occurred.'
  });
});

// Startup listener
const server = app.listen(PORT, () => {
  console.log(`[SERVER] Cinematcha backend running cleanly on port ${PORT}`);
});

module.exports = { app, server };
