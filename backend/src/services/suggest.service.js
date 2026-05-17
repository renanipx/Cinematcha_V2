// Using native global fetch
const pLimit = require('p-limit');
const cacheService = require('./cache.service');
const tmdbService = require('./tmdb.service');
const logger = require('../utils/logger');
const metrics = require('../utils/metrics');
const { trackTransactionCosts } = require('../utils/cost-calculator');

// New reliability modules
const promptRegistry = require('../config/prompts/registry');
const failoverService = require('./failover.service');
const aiValidationService = require('./ai-validation.service');
const similarityService = require('../utils/similarity');
const fallbackCatalog = require('../config/fallback_catalog.json');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Safe metrics mapping with fallback wrappers
const cacheHitsCounter = metrics.cacheHitsCounter;
const cacheMissesCounter = metrics.cacheMissesCounter;

const getTokensCounter = () => metrics.aiTokensCounter || { inc: () => {} };
const getCostCounter = () => metrics.aiCostCounter || { inc: () => {} };
const getFailoverCounter = () => metrics.aiFailoverCounter || { inc: () => {} };
const getValidationFailuresCounter = () => metrics.aiValidationFailuresCounter || { inc: () => {} };
const getHallucinationsCounter = () => metrics.aiHallucinationsCounter || { inc: () => {} };

/**
 * Executes a fetch request wrapped in exponential backoff retry handler with random jitter
 * @param {string} url - Target URL
 * @param {object} options - Fetch options
 * @param {number} timeoutMs - Strict connection timeout
 * @param {number} maxRetries - Maximum retry attempts for transient errors
 * @returns {Promise<Response>}
 */
async function fetchWithBackoff(url, options, timeoutMs, maxRetries = 2) {
  let attempt = 0;
  let delay = 500; // Starting delay 500ms

  while (attempt <= maxRetries) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      // If we hit a rate limit (429) or server error (503/504), retry with backoff
      if (response.status === 429 || response.status >= 500) {
        if (attempt === maxRetries) {
          return response; // Out of retries, return the failed response
        }
        
        attempt++;
        const jitter = Math.floor(Math.random() * 100);
        const backoffDelay = delay * Math.pow(2, attempt) + jitter;
        logger.warn(`[AI_ORCH] Fetch transient error ${response.status}. Retrying in ${backoffDelay}ms (attempt ${attempt}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        continue;
      }

      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      
      const isTimeout = err.name === 'AbortError';
      if (attempt === maxRetries) {
        throw new Error(isTimeout ? 'Request timed out' : err.message);
      }

      attempt++;
      const jitter = Math.floor(Math.random() * 100);
      const backoffDelay = delay * Math.pow(2, attempt) + jitter;
      logger.warn(`[AI_ORCH] Fetch network error: ${err.message}. Retrying in ${backoffDelay}ms (attempt ${attempt}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }
}

/**
 * Cross-validates suggested movie titles against TMDB search with a Jaro-Winkler gate (>= 75%).
 * Evicts unrecognized or low-similarity titles, and dynamically backfills with trending movies.
 * @param {string[]} movieTitles - Suggested movie titles from LLM
 * @param {string} locale - Locale ('en' or 'pt')
 * @returns {Promise<string[]>} - Clean, verified, and backfilled movie titles list
 */
async function crossValidateAndBackfill(movieTitles, locale) {
  const verifiedTitles = [];
  const limit = pLimit(5); // Concurrency cap: max 5 parallel TMDB queries

  const tasks = movieTitles.map(title => {
    return limit(async () => {
      try {
        const movie = await tmdbService.searchMovie(title, locale);
        if (!movie) {
          logger.warn(`[AI_ORCH] HALLUCINATION_DETECTED - Suggested: "${title}", TMDB returned 0 results. Evicting.`);
          getHallucinationsCounter().inc({ suggested_title: title });
          return null;
        }

        const matchScore = similarityService.calculateJaroWinkler(title, movie.title);
        if (matchScore < 0.75) {
          logger.warn(`[AI_ORCH] HALLUCINATION_DETECTED - Suggested: "${title}", TMDB Sim: ${Math.round(matchScore * 100)}% (Best match: "${movie.title}"). Evicting.`);
          getHallucinationsCounter().inc({ suggested_title: title });
          return null;
        }

        // Return corrected/perfect title from TMDB
        return movie.title;
      } catch (err) {
        logger.error(`[AI_ORCH] Error cross-validating "${title}": ${err.message}`);
        return null;
      }
    });
  });

  const results = await Promise.all(tasks);
  
  // Filter out null entries and duplicates
  for (const t of results) {
    if (t && !verifiedTitles.includes(t)) {
      verifiedTitles.push(t);
    }
  }

  // Backfill loop to maintain target count (exactly 5)
  const targetCount = 5;
  if (verifiedTitles.length < targetCount) {
    const gap = targetCount - verifiedTitles.length;
    logger.info(`[AI_ORCH] BACKFILL_TRIGGER - Validation gap detected. Need ${gap} movies. Fetching popular...`);
    
    try {
      const popularMovies = await tmdbService.getPopularMovies(locale);
      let backfillIndex = 0;
      
      while (verifiedTitles.length < targetCount && backfillIndex < popularMovies.length) {
        const candidate = popularMovies[backfillIndex];
        if (!verifiedTitles.includes(candidate.title)) {
          verifiedTitles.push(candidate.title);
          logger.info(`[AI_ORCH] BACKFILL_TRIGGER - Backfilling slot with: "${candidate.title}"`);
        }
        backfillIndex++;
      }
    } catch (err) {
      logger.error(`[AI_ORCH] Failed to backfill movies: ${err.message}`);
    }
  }

  return verifiedTitles.slice(0, targetCount);
}

/**
 * Generates recommendation titles using Google Gemini AI (or mock offline simulator), with Redis caching
 * @param {string} prompt - Clean search query
 * @param {string} locale - Locale ('en' or 'pt')
 * @param {string} version - Optional SemVer version (e.g. '1.0.0')
 * @param {string} traceId - Optional correlation ID
 * @returns {Promise<string[]>} - Array of recommendation movie titles
 */
async function suggestMovies(prompt, locale = 'en', version = '1.0.0', traceId = null) {
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

  // 2. Immediate Disaster Recovery: check if static fallback catalog is forced
  if (failoverService.isStaticFallbackForced()) {
    logger.info('[AI_ORCH] FORCE_STATIC_FALLBACK is active. Bypassing AI cascade.');
    const staticMovies = fallbackCatalog[locale] || fallbackCatalog['en'];
    titles = staticMovies.map(m => m.title);
    
    // Cache the static titles list for 24h
    await cacheService.set(cacheKey, titles, 86400);
    return titles;
  }

  // 3. Resolve AI cascade
  if (GEMINI_API_KEY) {
    const activeCascade = failoverService.getActiveModelCascade();

    if (activeCascade.length === 0) {
      logger.warn('[AI_ORCH] No healthy models available in cascade! Falling back to static catalog.');
    } else {
      // Loop through cascading models
      for (const modelConfig of activeCascade) {
        const modelId = modelConfig.id;
        let attempt = 0;
        let success = false;

        // Load prompt config from SemVer registry
        let promptConfig;
        try {
          promptConfig = promptRegistry.getPrompt(version, locale, prompt);
        } catch (err) {
          logger.error(`[AI_ORCH] Failed to load prompt from registry: ${err.message}`);
          break; // Registry error is fatal for this query, break cascade loop
        }

        while (attempt <= 2) {
          try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${GEMINI_API_KEY}`;
            const payload = {
              contents: [{ parts: [{ text: promptConfig.userPrompt }] }],
              systemInstruction: {
                parts: [{ text: promptConfig.systemPrompt }]
              },
              generationConfig: {
                temperature: promptConfig.parameters.temperature,
                topP: promptConfig.parameters.topP,
                maxOutputTokens: promptConfig.parameters.maxOutputTokens
              }
            };

            logger.info(`[AI_ORCH] Calling model ${modelId} (attempt ${attempt + 1})...`);
            
            // Outbound connection with socket timeout and backoff handler
            const response = await fetchWithBackoff(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            }, modelConfig.timeoutMs);

            if (response.status !== 200) {
              const errText = await response.text();
              throw new Error(`Gemini API returned status ${response.status}: ${errText}`);
            }

            const data = await response.json();
            const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!rawText) {
              throw new Error('LLM returned response with empty parts');
            }

            // Expose Prometheus token count and cost metrics using the cost calculator
            const inputTokens = data.usageMetadata?.promptTokenCount || 0;
            const outputTokens = data.usageMetadata?.candidatesTokenCount || 0;
            
            trackTransactionCosts(modelId, inputTokens, outputTokens, traceId, 'suggest');

            // Execute response validation contract
            titles = aiValidationService.validateResponseContract(rawText);

            // Record success and break retry/cascade loop
            failoverService.recordModelSuccess(modelId);
            success = true;
            break;
          } catch (err) {
            attempt++;
            logger.warn(`[AI_ORCH] Attempt ${attempt} failed on model ${modelId}: ${err.message}`);

            const isValidationError = err.message.includes('prose') || err.message.includes('boundaries') || err.message.includes('contract');

            if (isValidationError && attempt <= 2) {
              getValidationFailuresCounter().inc({ model: modelId, retry_count: attempt });
              logger.warn(`[AI_ORCH] VALIDATION_FAILURE - Output malformed. Triggering semantic retry.`);

              if (attempt === 1) {
                // Retry 1: Keep prompt, force absolute temperature zero for determinism
                promptConfig.parameters.temperature = 0.0;
                logger.info('[AI_ORCH] Semantic Retry #1: Enforcing deterministic temp=0.0');
              } else if (attempt === 2) {
                // Retry 2: Append severe repair guidance notes
                promptConfig.userPrompt += "\n[REPAIR NOTICE: Your previous output failed contract constraints. Return ONLY comma-separated movie names. DO NOT write descriptions, conversational headers, lists, or numbers.]";
                promptConfig.parameters.temperature = 0.0;
                logger.info('[AI_ORCH] Semantic Retry #2: Appending instruction repair blocks');
              }
            } else {
              // Network timeout, rate limit, or exhausted retries
              logger.error(`[AI_ORCH] Model ${modelId} execution failed: ${err.message}`);
              failoverService.recordModelFailure(modelId);

              // Increment failover counter if there are other models
              const activeIndex = activeCascade.findIndex(m => m.id === modelId);
              if (activeIndex !== -1 && activeIndex < activeCascade.length - 1) {
                const nextModel = activeCascade[activeIndex + 1];
                getFailoverCounter().inc({ failed_model: modelId, fallback_model: nextModel.id });
                logger.warn(`[AI_ORCH] MODEL_FALLOVER - Primary Failed. Routing to: ${nextModel.id}`);
              }

              break; // Break the attempt loop to move to the next model in the cascade
            }
          }
        }

        if (success) {
          break; // Cascade loop succeeded
        }
      }
    }
  }

  // 4. Offline Simulator or Complete Outage Fallback
  if (!titles || titles.length === 0) {
    logger.error('[AI_ORCH] All models in cascade failed or returned empty titles. Serving static catalog.');
    const staticMovies = fallbackCatalog[locale] || fallbackCatalog['en'];
    titles = staticMovies.map(m => m.title);
  }

  // 5. Cross-validate against TMDB and mitigate hallucinations
  const verifiedTitles = await crossValidateAndBackfill(titles, locale);

  // 6. Cache the final verified titles list for 24h
  if (verifiedTitles && verifiedTitles.length > 0) {
    await cacheService.set(cacheKey, verifiedTitles, 86400); // 24h
  }

  return verifiedTitles;
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
