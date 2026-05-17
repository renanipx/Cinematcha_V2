const pLimit = require('p-limit');
const suggestService = require('../services/suggest.service');
const tmdbService = require('../services/tmdb.service');
const cacheService = require('../services/cache.service');

/**
 * Handles movie suggestion recommendations using HTTP Chunked Early Resolution Streaming
 */
async function handleSuggest(req, res, next) {
  const { prompt } = req.body;
  const locale = req.body.locale || 'en';
  const bypassCache = req.body.bypassCache === true || req.query.bypassCache === 'true';
  const version = (req.headers && req.headers['x-cinematcha-prompt-version']) || (req.body && req.body.version) || '1.0.0';

  try {
    // 1. If cache bypass requested, evict existing cache entry
    if (bypassCache) {
      const promptHash = cacheService.hashPrompt(prompt);
      const cacheKey = `cache:suggest:${promptHash}:${locale}`;
      await cacheService.del(cacheKey);
      console.log(`[REDIS] Cache bypassed. Evicted suggest key: ${cacheKey}`);
    }

    // 2. Initialize Chunked Transfer Encoding Headers
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Connection', 'keep-alive');
    res.statusCode = 200;

    // 3. Resolve AI recommendation titles from Gemini
    const titles = await suggestService.suggestMovies(prompt, locale, version);

    // 4. Stream early resolved titles chunk immediately to frontend
    res.write(JSON.stringify({ type: 'titles', data: titles }) + '\n');

    // 5. Run p-limit concurrent metadata resolution and stream chunks as they resolve
    const limit = pLimit(5);
    const tasks = titles.map(title => {
      return limit(async () => {
        try {
          // If cache bypass is requested, also bypass TMDB cache keys
          if (bypassCache) {
            const titleHash = cacheService.hashPrompt(title);
            const searchCacheKey = `cache:movie:search:${titleHash}:${locale}`;
            await cacheService.del(searchCacheKey);
          }

          const movie = await tmdbService.searchMovie(title, locale);
          if (!movie) return null;

          if (bypassCache) {
            await cacheService.del(`cache:movie:trailer:${movie.id}:${locale}`);
            await cacheService.del(`cache:movie:providers:${movie.id}:${locale}`);
            await cacheService.del(`cache:movie:detail:${movie.id}:${locale}`);
          }

          const [trailer, providers] = await Promise.all([
            tmdbService.getMovieTrailer(movie.id, locale),
            tmdbService.getMovieProviders(movie.id, locale)
          ]);

          const fullMovie = {
            ...movie,
            trailer,
            providers
          };

          // Stream resolved movie immediately as NDJSON chunk
          res.write(JSON.stringify({ type: 'movie', data: fullMovie }) + '\n');
          return fullMovie;
        } catch (err) {
          console.warn(`[STREAM LIMITER WARNING] Soft fail occurred mapping metadata for "${title}":`, err.message);
          return null;
        }
      });
    });

    // Wait for all concurrency items to finish resolving
    await Promise.all(tasks);

    // 6. Send final closing NDJSON chunk and end response
    res.write(JSON.stringify({ type: 'done' }) + '\n');
    res.end();
  } catch (err) {
    console.error('[CONTROLLER ERROR] Chunked suggestion stream crashed:', err.stack);
    // If headers are not sent, return 500. Otherwise, end stream with error chunk
    if (!res.headersSent) {
      res.statusCode = 500;
      res.json({ error: 'Internal Server Error', message: err.message });
    } else {
      res.write(JSON.stringify({ type: 'error', message: err.message }) + '\n');
      res.end();
    }
  }
}

module.exports = {
  handleSuggest
};
