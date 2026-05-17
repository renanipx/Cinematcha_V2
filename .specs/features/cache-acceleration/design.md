# Technical Design Document (design.md)
## EPIC-01: Real-time Performance & Cache Acceleration

This Technical Design Document details the software architectures, component pipelines, Redis schemas, asynchronous pooling models, and mitigation strategies required to satisfy **EPIC-01: Real-time Performance & Cache Acceleration**.

---

## 1. High-Level Cache & Performance Pipeline

We intercept incoming requests and process outgoing API queries using an integrated caching and streaming pipeline:

```
                  [ Inbound Client Suggest Request ]
                                  │
                                  ▼
                    ┌───────────────────────────┐
                    │    Cache Invalidation?    │  (Checks bypassCache=true)
                    └─────────────┬─────────────┘
                                  ├───────────────────────────┐ (Yes)
                             (No) │                           │
                                  ▼                           ▼
                    ┌───────────────────────────┐       ┌───────────┐
                    │   Check Redis suggest     │       │           │
                    │   namespace for key       │       │           │
                    └─────────────┬─────────────┘       │           │
                                  │                     │           │
                    ┌─────────────┴─────────────┐       │           │
                    │        Cache Hit?         │       │           │
                    └─────────────┬─────────────┘       │           │
                             (No) │        │ (Yes)      │           │
                                  ▼        └──────────┐ │           │
                    ┌───────────────────────────┐     │ │           │
                    │   Call Gemini AI API     │     │ │           │
                    │   (Get suggested names)   │     │ │           │
                    └─────────────┬─────────────┘     │ │           │
                                  ▼                   │ │           │
                    ┌───────────────────────────┐     │ │           │
                    │   Chunked Steam Init      │     │ │           │
                    │   (Stream names to SPA)   │     │ │           │
                    └─────────────┬─────────────┘     │ │           │
                                  ▼                   │ │           │
                    ┌───────────────────────────┐     │ │           │
                    │  Concurrent Details Pool  │     │ │           │
                    │  (p-limit TMDB details    │     │ │           │
                    │   lookups / max 5 parallel)     │ │           │
                    └─────────────┬─────────────┘     │ │           │
                                  ▼                   │ │           │
                    ┌───────────────────────────┐     │ │           │
                    │   Stream resolved metadata│     │ │           │
                    │   as chunks & write cache │     │ │           │
                    └─────────────┬─────────────┘     │ │           │
                                  │                   │ │           │
                                  ▼                   ▼ ▼           ▼
                    ┌───────────────────────────────────────────────┐
                    │            Deliver Output to Client           │
                    └───────────────────────────────────────────────┘
```

---

## 2. Affected Backend Modules & Files

### A. Modified Modules
*   **[server.js](file:///d:/projetos/Cinematcha_V2/backend/src/server.js)**: 
    *   Register the Redis client config and check connection during bootstrapping.
    *   Expose administrative cache flushing endpoints.
*   **[docker-compose.yml](file:///d:/projetos/Cinematcha_V2/docker-compose.yml)**: 
    *   Add a containerized Redis service mapped to the private `app-network` and setup data volumes.
*   **[package.json](file:///d:/projetos/Cinematcha_V2/backend/package.json)**: 
    *   Add production-grade packages: `redis`, `p-limit`.
*   **[suggest.service.js](file:///d:/projetos/Cinematcha_V2/backend/src/services/suggest.service.js)**:
    *   Wrap semantic suggestion requests with Redis cache checks.
    *   Integrate parallel metadata resolution loop with `p-limit`.
*   **[tmdb.service.js](file:///d:/projetos/Cinematcha_V2/backend/src/services/tmdb.service.js)**:
    *   Wrap `searchMovie`, `getMovieTrailer`, and `getMovieProviders` calls with localized key caching logic.
*   **[suggest.controller.js](file:///d:/projetos/Cinematcha_V2/backend/src/controllers/suggest.controller.js)**:
    *   Support chunked response streaming (`Transfer-Encoding: chunked`) to flush recommendations to the frontend as they complete.

### B. [NEW] Modules to Create
*   **[redis.config.js](file:///d:/projetos/Cinematcha_V2/backend/src/config/redis.config.js)**: 
    *   Initialize the Redis client, manage reconnection policies, export client instances, and define the global bypass environment control flag.
*   **[cache.service.js](file:///d:/projetos/Cinematcha_V2/backend/src/services/cache.service.js)**: 
    *   Expose utility functions for parsing cache keys, reading/writing values, handling transaction flushes, and administrative invalidation hooks.

---

## 3. Redis Architecture & Container Topology

### A. Container Definition (`docker-compose.yml`)
The official Alpine-based Redis image is provisioned to minimize resource overhead, structured inside the root configuration:

```yaml
services:
  # ... Existing frontend and backend services
  redis-cache:
    image: redis:7.2-alpine
    container_name: cinematcha-redis
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru --appendonly yes
    restart: always
    volumes:
      - redis-data:/data
    networks:
      - app-network
    # Note: Ports are NOT exposed to the host to ensure absolute backend isolation.

volumes:
  redis-data:
    driver: local
```

### B. Connection Settings
*   **Service DNS Identifier**: `redis-cache` (resolved internally by Docker DNS)
*   **Operational Port**: `6379`
*   **Connection URL**: `redis://redis-cache:6379`

### C. Reconnection Strategy & Resilient Fail-Safe
To safeguard availability if the cache container fails, connection initialization is wrapped in robust event catchers:

```javascript
// backend/src/config/redis.config.js
import { createClient } from 'redis';
import logger from '../utils/logger.js'; // Winston logger instance

const REDIS_URL = process.env.REDIS_URL || 'redis://redis-cache:6379';
const DISABLE_CACHE = process.env.DISABLE_CACHE === 'true';

let redisClient = null;
let isCacheAvailable = false;

if (!DISABLE_CACHE) {
  redisClient = createClient({
    url: REDIS_URL,
    socket: {
      reconnectStrategy: (retries) => {
        // Exponential backoff with a cap of 30 seconds
        const delay = Math.min(Math.pow(2, retries) * 1000, 30000);
        logger.warn(`[REDIS] Connection failed. Retrying in ${delay}ms... (Attempt ${retries})`);
        return delay;
      },
      connectTimeout: 5000 // Timeouts after 5 seconds
    }
  });

  redisClient.on('connect', () => {
    isCacheAvailable = true;
    logger.info('[REDIS] Client successfully connected to Redis server.');
  });

  redisClient.on('error', (err) => {
    isCacheAvailable = false;
    logger.error(`[REDIS] Error occurred: ${err.message}`);
  });

  redisClient.on('end', () => {
    isCacheAvailable = false;
    logger.warn('[REDIS] Connection closed.');
  });

  // Self-executing asynchronous initialization
  (async () => {
    try {
      await redisClient.connect();
    } catch (err) {
      logger.error(`[REDIS] Direct boot connection failed: ${err.message}`);
      isCacheAvailable = false;
    }
  })();
} else {
  logger.info('[REDIS] Caching layer explicitly disabled via environmental configuration.');
}

export { redisClient, isCacheAvailable };
```

---

## 4. Cache Keys, TTL & Invalidation Strategy

### A. Key Schemas
To prevent data contamination, keys are structured as standardized nested namespaces incorporating the locale:
*   **Gemini suggestion result names cache**:
    `cache:suggest:<query_hash>:<locale>`
    *   *Where query_hash is the SHA-256 string hash of the trimmed, lowercase prompt.*
*   **TMDB detail payload**:
    `cache:movie:detail:<movie_id>:<locale>`
*   **TMDB trailer videos**:
    `cache:movie:trailer:<movie_id>:<locale>`
*   **TMDB watch providers details**:
    `cache:movie:providers:<movie_id>:<locale>`

### B. TTL (Time-To-Live) Policies
All entity keys are assigned a Time-To-Live threshold of **24 Hours (86,400 seconds)** during writing. This ensures system updates (like TMDB rating adjustments or changes in streaming platform catalogs) propagate within 24 hours.

```javascript
// Example cache write operation
const key = `cache:movie:detail:${movieId}:${locale}`;
await redisClient.set(key, JSON.stringify(data), {
  EX: 86400 // 24 Hours TTL
});
```

### C. Eviction & Memory Control
Under heavy query loads, memory usage must not expand infinitely. The Redis server runs under these boundaries:
1.  **Maxmemory Constraint**: Configured to `--maxmemory 256mb`.
2.  **Eviction Algorithm**: `--maxmemory-policy allkeys-lru`. This evicts the least recently used keys, prioritizing the preservation of fresh or high-traffic recommendations.

### D. Manual Cache Invalidation
An administrative hook allows selective flushing of cache namespaces without recycling containers:
*   **API Hook**: `DELETE /api/cache/invalidate`
*   **Parameters (JSON Body)**:
    ```json
    {
      "pattern": "cache:suggest:*"
    }
    ```
*   **Controller Logic**: Uses the Redis `SCAN` iterator cursor pattern to fetch keys matching the pattern and delete them in batches (avoiding blockages caused by the deprecated `KEYS` command).

---

## 5. Asynchronous Processing Strategy

### A. Controlled Concurrency Pool (`p-limit`)
To optimize mapping loops where 5-10 movie suggestions fetch trailers and provider data simultaneously from external APIs, we integrate `p-limit` to replace serial execution without overloading external APIs:

```javascript
// backend/src/services/suggest.service.js
import pLimit from 'p-limit';
import tmdbService from './tmdb.service.js';

export async function resolveMovieMetadata(movieTitles, locale) {
  // Cap concurrent HTTP outgoing requests to max 5 simultaneous channels
  const limit = pLimit(5);

  const tasks = movieTitles.map((title) => {
    return limit(async () => {
      try {
        const movie = await tmdbService.searchMovie(title, locale);
        if (!movie) return null;

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
        // Soft fail: return null so that a single failure doesn't crash the loop
        logger.error(`[ASYNC] Failed resolving metadata for "${title}": ${err.message}`);
        return null;
      }
    });
  });

  const results = await Promise.all(tasks);
  // Filter out any entries that failed or returned null
  return results.filter(movie => movie !== null);
}
```

### B. Chunked Transfer Encoding (Early Response Streaming)
To provide instant client response times, we transition the suggestion endpoint from loading standard monolithic JSON arrays to streaming output.
*   **Protocol Details**: Sets standard headers `Transfer-Encoding: chunked` and `Content-Type: application/json; charset=utf-8`.
*   **Execution Flow**:
    1.  Immediately returns the basic structured suggestion names array from Gemini (enabling the frontend to show a quick loading list).
    2.  As each movie metadata resolves from `p-limit`, writes the movie data as a serialized NDJSON chunk.
    3.  Closes the stream when the final movie has resolved.

---

## 6. Rollback Considerations

1.  **Fail-safe Cache Middleware Check**: The check `if (isCacheAvailable && redisClient)` protects all cached methods. If the connection fails or `DISABLE_CACHE=true` is set inside environment variables, the system completely bypasses the caching routines.
2.  **Container Recovery**: If the Docker Compose deploy fails, the system can instantly roll back to its stateless architecture using:
    ```bash
    git checkout -- docker-compose.yml backend/package.json
    docker-compose down
    docker-compose up --build -d
    ```

---

## 7. Scalability & Memory Footprint

*   **Memory Footprint**: A standard movie metadata record consumes approximately 3KB. Storing 50,000 active cached items in Redis requires roughly **150MB** of memory, which easily fits within the 256MB LRU memory constraint.
*   **CPU Utilization**: Checking a Redis key takes `<1ms`, resulting in significant CPU savings for the backend since it avoids raw text parsing, SHA calculations, and outbound networking on repeat prompts.

---

## 8. Observability Hooks

### A. Logging Patterns
We write structured audit lines for all caching cycles using standard labels:
*   *Cache Hit*: `logger.info('[REDIS] CACHE_HIT - Key: cache:suggest:dfa25b locale: en')`
*   *Cache Miss*: `logger.info('[REDIS] CACHE_MISS - Key: cache:suggest:dfa25b locale: en')`
*   *Connection Loss*: `logger.error('[REDIS] Connection lost. Caching offline.')`

### B. Prometheus Metric Instrumentation
Expose cache metrics under the global backend `/metrics` endpoint using `prom-client`:
*   `cinematcha_cache_hits_total`: Increments on each successful cache hit (labels: `namespace`).
*   `cinematcha_cache_misses_total`: Increments on cache misses (labels: `namespace`).
*   `cinematcha_redis_connected`: Binary gauge (`1` for connected, `0` for disconnected).
