// Using native global fetch
const pLimit = require('p-limit');
const cacheService = require('./cache.service');
const tmdbService = require('./tmdb.service');
const logger = require('../utils/logger');
const { cacheHitsCounter, cacheMissesCounter } = require('../utils/metrics');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-1.5-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Generates recommendation titles using Google Gemini AI (or mock offline simulator), with Redis caching
 * @param {string} prompt - Clean search query
 * @param {string} locale - Locale ('en' or 'pt')
 * @returns {Promise<string[]>} - Array of recommendation movie titles
 */
async function suggestMovies(prompt, locale = 'en') {
  const promptHash = cacheService.hashPrompt(prompt);
  const cacheKey = `cache:suggest:${promptHash}:${locale}`;

  // 1. Check Redis cache
  const cachedTitles = await cacheService.get(cacheKey);
  if (cachedTitles) {
    logger.info(`[REDIS] CACHE_HIT - Key: ${cacheKey}`);
    cacheHitsCounter.inc({ cache_type: 'suggest' });
    return cachedTitles;
  }

  logger.info(`[REDIS] CACHE_MISS - Key: ${cacheKey}`);
  cacheMissesCounter.inc({ cache_type: 'suggest' });

  let titles = null;

  // 2. Fetch from Gemini REST API if key is present
  if (GEMINI_API_KEY) {
    try {
      const languageText = locale === 'pt' ? 'Portuguese' : 'English';
      const orchestratedPrompt = `Return exactly 5 movie recommendations for this prompt: "${prompt}" in ${languageText}. The response must be a single line containing only movie titles separated by commas, with no intro, outro, numbering, markdown, or extra text. Example: Inception, Interstellar, The Matrix`;

      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: orchestratedPrompt }] }]
        })
      });

      if (response.status === 200) {
        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          // Parse comma-separated titles and trim whitespace
          titles = rawText
            .split(',')
            .map(t => t.replace(/[\r\n\t\*\"']/g, '').trim())
            .filter(t => t.length > 0);
        }
      } else {
        logger.error(`[GEMINI SERVICE ERROR] API returned status ${response.status}: ${await response.text()}`);
      }
    } catch (err) {
      logger.error(`[GEMINI SERVICE ERROR] Outgoing API connection failed: ${err.message}`);
    }
  }

  // 3. Fallback to Mock Offline Recommender if not resolved
  if (!titles || titles.length === 0) {
    const normPrompt = prompt.toLowerCase();
    if (normPrompt.includes('sci-fi') || normPrompt.includes('space') || normPrompt.includes('interstellar') || normPrompt.includes('odyssey')) {
      titles = ['Interstellar', 'Inception', '2001: A Space Odyssey'];
    } else if (normPrompt.includes('action') || normPrompt.includes('matrix') || normPrompt.includes('pulp')) {
      titles = ['The Matrix', 'Pulp Fiction', 'Inception'];
    } else {
      // General fallbacks
      titles = ['Inception', 'Interstellar', 'The Matrix'];
    }
  }

  // 4. Cache the titles list for 24h
  if (titles && titles.length > 0) {
    await cacheService.set(cacheKey, titles, 86400); // 24h
  }

  return titles;
}

/**
 * Maps suggestions concurrently using p-limit (exactly 5 active channels), with soft-fail limits
 * @param {string[]} movieTitles - List of recommended movie titles
 * @param {string} locale - Locale
 * @returns {Promise<object[]>} - Mapped high-fidelity movie objects
 */
async function resolveMovieMetadata(movieTitles, locale = 'en') {
  if (!movieTitles || movieTitles.length === 0) return [];
  
  // Concurrency cap: max 5 simultaneous outbound channels
  const limit = pLimit(5);

  const tasks = movieTitles.map(title => {
    return limit(async () => {
      try {
        // Query TMDB (caches internally)
        const movie = await tmdbService.searchMovie(title, locale);
        if (!movie) return null;

        // Query trailers and watch providers concurrently
        const [trailer, providers] = await Promise.all([
          tmdbService.getMovieTrailer(movie.id, locale),
          tmdbService.getMovieProviders(movie.id, locale)
        ]);

        return {
          ...movie,
          trailer,
          providers
        };
      } catch (err) {
        // Soft fail: skip item and return null to prevent crashing the entire suggestion run
        logger.warn(`[ASYNC LIMITER WARNING] Soft fail occurred mapping metadata for "${title}": ${err.message}`);
        return null;
      }
    });
  });

  const results = await Promise.all(tasks);
  
  // Filter out soft-fail null entries
  return results.filter(movie => movie !== null);
}

module.exports = {
  suggestMovies,
  resolveMovieMetadata
};
