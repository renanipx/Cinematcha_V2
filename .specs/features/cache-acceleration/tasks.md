# Actionable Implementation Checklist (tasks.md)
## EPIC-01: Real-time Performance & Cache Acceleration

This document is the official implementation task registry for **EPIC-01: Real-time Performance & Cache Acceleration**. It breaks the technical specifications and design considerations down into atomic, independent, and verifiable checklist units.

---

## Task List Matrix

### 📦 Task Group 1: Infrastructure & Package Setup

*   **TSK-PERF-INF-001**: Install required caching and concurrency packages:
    *   **Action**: Install production dependencies in backend directory:
        ```bash
        cd backend
        npm install redis p-limit
        ```
    *   **Affected Files**: [package.json](file:///d:/projetos/Cinematcha_V2/backend/package.json)
    *   **Dependencies**: None
    *   **Verification Checklist**:
        *   [ ] Run `npm list redis p-limit` to confirm correct installations.
        *   [ ] Verify packages and lockfiles are generated with correct versioning bounds.
    *   **Rollback Notes**: Run `npm uninstall redis p-limit` and discard edits to `package.json`.

*   **TSK-PERF-INF-002**: Add Redis container service to `docker-compose.yml`:
    *   **Action**: Append a stateful `redis-cache` service to the Compose file. Configure to run official `redis:7.2-alpine`, mapping to private `app-network` and setup data volume persistence, capping memory to 256MB under LRU eviction policies.
    *   **Affected Files**: [docker-compose.yml](file:///d:/projetos/Cinematcha_V2/docker-compose.yml)
    *   **Dependencies**: None
    *   **Verification Checklist**:
        *   [ ] Execute `docker-compose config` to ensure syntax validation is clean.
        *   [ ] Boot Redis service standalone (`docker-compose up -d redis-cache`) and check runtime status in docker CLI.
    *   **Rollback Notes**: Revert edits in `docker-compose.yml` and clean volume mounts.

---

### 🔌 Task Group 2: Core Redis Client & Config Setup

*   **TSK-PERF-RED-001**: Implement resilient Redis Connection Client:
    *   **Action**: Create `backend/src/config/redis.config.js` to manage client connections, event listeners, exponential backoff reconnection strategies, and the `DISABLE_CACHE` environment hook.
    *   **Affected Files**: `backend/src/config/redis.config.js` *[NEW]*
    *   **Dependencies**: TSK-PERF-INF-001, TSK-PERF-INF-002
    *   **Verification Checklist**:
        *   [ ] Boot application with Redis container stopped; confirm server boots without crash, printing warning logs.
        *   [ ] Boot application with Redis running; confirm server prints connection success logs.
    *   **Rollback Notes**: Remove the newly created `redis.config.js` file.

*   **TSK-PERF-RED-002**: Implement Redis Cache Service Helper:
    *   **Action**: Create `backend/src/services/cache.service.js` providing pure utility wrappers for operations like get, set with TTL expiration, delete, scan for pattern key sweeps, and SHA-256 suggestion key hash algorithms.
    *   **Affected Files**: `backend/src/services/cache.service.js` *[NEW]*
    *   **Dependencies**: TSK-PERF-RED-001
    *   **Verification Checklist**:
        *   [ ] Verify SHA-256 prompt hashing creates clean string digests.
        *   [ ] Write unit tests to check successful JSON serialization/deserialization.
    *   **Rollback Notes**: Remove the newly created `cache.service.js` file.

---

### 🧬 Task Group 3: Caching Integration in Upstream Services

*   **TSK-PERF-SVC-001**: Integrate Movie Caching in TMDB Service:
    *   **Action**: Modify the movie detailing, trailer lookups, and watch provider search hooks inside the TMDB service to check the Redis cache using standard namespaces before querying downstream HTTP API endpoints. Write back to Redis with a 24h TTL on cache misses.
    *   **Affected Files**: `backend/src/services/tmdb.service.js`
    *   **Dependencies**: TSK-PERF-RED-002
    *   **Verification Checklist**:
        *   [ ] Test: Verify that repeat queries to movie details or watch providers do not trigger external TMDB API fetch requests.
        *   [ ] Test: Verify cached entries exist in Redis using `redis-cli GET`.
    *   **Rollback Notes**: Execute `git checkout -- backend/src/services/tmdb.service.js` to restore original file.

*   **TSK-PERF-SVC-002**: Integrate Recommendation Caching in Suggest Service:
    *   **Action**: Modify `suggestMovies` inside the suggestion service to check for cached suggestion titles array in Redis using hashed prompt namespaces before calling Google Gemini AI endpoints.
    *   **Affected Files**: `backend/src/services/suggest.service.js`
    *   **Dependencies**: TSK-PERF-RED-002
    *   **Verification Checklist**:
        *   [ ] Test: Confirm that repeat suggestions load recommendations instantly, completely bypassing Google Gemini API limits.
        *   [ ] Test: Verify that cached suggestions are correctly stored in the `cache:suggest:<query_hash>:<locale>` namespace in Redis.
    *   **Rollback Notes**: Execute `git checkout -- backend/src/services/suggest.service.js` to restore original file.

---

### ⚡ Task Group 4: Asynchronous Parallel Concurrency Pool

*   **TSK-PERF-ASYNC-001**: Implement Controlled Concurrency Loop (`p-limit`):
    *   **Action**: Refactor TMDB metadata resolution mapping loops in the suggest service. Replace sequential executions with parallel streams, capping active outbound API calls to **exactly 5 concurrent connections** using `p-limit`. Implement soft-fail try/catch to filter out failed movie detail fetches without failing the overall request.
    *   **Affected Files**: `backend/src/services/suggest.service.js`
    *   **Dependencies**: TSK-PERF-INF-001
    *   **Verification Checklist**:
        *   [ ] Verify total execution time for mapping 10 movie metadata lookups drops by >= 60% compared to sequential iterations.
        *   [ ] Confirm that if a single movie details lookup fails (e.g., TMDB 404), the suggest method filters it out and returns the remaining 9 movies successfully.
    *   **Rollback Notes**: Revert mapping loops back to standard sequential execution or unlimited `Promise.all` blocks.

---

### 📡 Task Group 5: Chunked Streaming Gateway Responses

*   **TSK-PERF-STREAM-001**: Implement Chunked Early Resolution Response Streaming:
    *   **Action**: Refactor the suggestion route handler in the controller to initialize chunked HTTP transfer encoding. Return headers immediately with the basic suggestion list from Gemini, and stream movie metadata entities incrementally as they resolve from the `p-limit` pool.
    *   **Affected Files**: `backend/src/controllers/suggest.controller.js`
    *   **Dependencies**: TSK-PERF-ASYNC-001
    *   **Verification Checklist**:
        *   [ ] Execute API suggestions via `curl -N -X POST ...` and check that the chunked boundaries print incrementally.
        *   [ ] Verify the frontend SPA can successfully parse chunked JSON streams and display loading placeholders for individual cards.
    *   **Rollback Notes**: Revert the controller endpoint handler back to returning standard monolithic JSON arrays.

---

### 🔐 Task Group 6: Cache Invalidation administrative route

*   **TSK-PERF-EVICT-001**: Implement Cache Invalidation API endpoint:
    *   **Action**: Expose a secure route `DELETE /api/cache/invalidate` allowing administrators to sweep specific cached keys or whole namespaces using non-blocking Redis `SCAN` cursor commands.
    *   **Affected Files**: `backend/src/server.js`, `backend/src/controllers/suggest.controller.js`
    *   **Dependencies**: TSK-PERF-RED-002
    *   **Verification Checklist**:
        *   [ ] Call `DELETE /api/cache/invalidate` specifying standard namespace sweeps (e.g., `cache:suggest:*`). Confirm return details report correct count of deleted keys.
        *   [ ] Verify that subsequent suggestion queries successfully execute fresh outbound API calls to Google Gemini.
    *   **Rollback Notes**: Remove the route endpoint definitions and clean routing registries.

---

### 📊 Task Group 7: Observability Metrics & Winston Logs

*   **TSK-PERF-OBS-001**: Integrate Prometheus Cache Metrics & Structured Caching Logs:
    *   **Action**: Hook cache hit/miss count trackers into the Prometheus middleware configuration using `prom-client`. Integrate structured logging inside the cache service to print audit traces (`[REDIS] CACHE_HIT` / `[REDIS] CACHE_MISS`) via Winston.
    *   **Affected Files**: `backend/src/services/cache.service.js`, `backend/src/server.js`
    *   **Dependencies**: TSK-PERF-RED-002, TSK-PERF-INF-001
    *   **Verification Checklist**:
        *   [ ] Query `/metrics` and confirm cache registry counters (`cinematcha_cache_hits_total` and `cinematcha_cache_misses_total`) appear and increment correctly.
        *   [ ] Check application logs to confirm caching event audit logs contain exact query hashes and locale references.
    *   **Rollback Notes**: Remove Prometheus instrumentation metrics hooks and clean out custom Winston audit lines.

---

### 🧪 Task Group 8: End-to-End Simulation & Load Testing

*   **TSK-PERF-SIM-001**: E2E Verification of cache-hit latency speedups:
    *   **Action**: Deploy the full multi-container Docker Compose layout and run simulated queries to measure performance gains under loaded states.
    *   **Affected Files**: None
    *   **Dependencies**: All previous implementation tasks (TSK-PERF-INF-001 through TSK-PERF-OBS-001)
    *   **Verification Checklist**:
        *   [ ] Deploy composition (`docker-compose up --build -d`). Check container network mappings.
        *   [ ] Execute repetitive queries for standard prompt combinations. Assert first query executes in normal latency (~3s) and subsequent hits respond in under 50ms.
    *   **Rollback Notes**: None needed.

*   **TSK-PERF-SIM-002**: Verification of connection outage Fail-safe resiliency:
    *   **Action**: Terminate the Redis database container during high-volume suggestion routines to simulate a cache failure event.
    *   **Affected Files**: None
    *   **Dependencies**: All previous implementation tasks (TSK-PERF-INF-001 through TSK-PERF-OBS-001)
    *   **Verification Checklist**:
        *   [ ] Turn off Redis container (`docker-compose stop redis-cache`).
        *   [ ] Execute suggest queries; assert server logs reconnection failures and warnings, fallback direct query succeeds without crashes, returning standard movie results.
    *   **Rollback Notes**: Restart Redis container service (`docker-compose start redis-cache`).
