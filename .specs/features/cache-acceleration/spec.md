# Functional Specification (spec.md)
## EPIC-01: Real-time Performance & Cache Acceleration

This document defines the functional and non-functional specifications for **EPIC-01: Real-time Performance & Cache Acceleration** within the Cinematcha fullstack application. It establishes strict quality standards, validation criteria, and Verification Gates to eliminate response bottlenecks, minimize Google Gemini and TMDB API credit usage, and prevent rate-limit exhaustion through intelligent stateful caching and controlled async operations.

---

## 1. Requirement Catalog

We categorize all performance-optimizing requirements and specifications using traceable **Requirement IDs**:

### A. Redis Caching Core & TTL Policy
*   **REQ-PERF-CACHE-001 (Stateful Storage Integration)**: The backend gateway must integrate a high-performance, containerized Redis instance to store serialized API response payloads.
*   **REQ-PERF-CACHE-002 (Entity TTL Policies)**: The system must enforce distinct Time-To-Live (TTL) policies on cached items to guarantee data freshness and prevent memory bloat:
    *   **Gemini AI Suggestions (`cache:suggest`)**: TTL of **24 hours** (86,400 seconds).
    *   **TMDB Movie Metadata (`cache:movie:detail`)**: TTL of **24 hours** (86,400 seconds).
    *   **TMDB Movie Trailers (`cache:movie:trailer`)**: TTL of **24 hours** (86,400 seconds).
    *   **TMDB Watch Providers (`cache:movie:providers`)**: TTL of **24 hours** (86,400 seconds).
*   **REQ-PERF-CACHE-003 (Structured Namespace Key Schema)**: Cache keys must follow strict namespaces containing the language/locale and query parameters or IDs to avoid data collisions:
    *   `cache:suggest:<query_hash>:<locale>`
    *   `cache:movie:detail:<movie_id>:<locale>`
    *   `cache:movie:trailer:<movie_id>:<locale>`
    *   `cache:movie:providers:<movie_id>:<locale>`
*   **REQ-PERF-CACHE-004 (Transparent Caching Middleware/Wrapper)**: Upstream service requests must be transparently intercepted, checking the Redis cache *before* making network calls to Gemini or TMDB APIs. If a cache hit occurs, the cached payload is returned instantly without making downstream HTTP requests.

### B. Cache Invalidation & Management
*   **REQ-PERF-EVICT-001 (Explicit Cache Invalidation Hook)**: The system must expose a secure administrative API endpoint (`DELETE /api/cache/invalidate`) to programmatically evict specific keys or namespaces (e.g., when a user requests a fresh reload of trending movies).
*   **REQ-PERF-EVICT-002 (Least Recently Used Eviction)**: The Redis engine must be configured to automatically manage memory constraints using a strict LRU (Least Recently Used) policy once memory limits are hit.
*   **REQ-PERF-EVICT-003 (Soft Flush / Cache Bypass)**: The backend suggestion service must support a query parameter bypass (e.g., `POST /api/suggest?bypassCache=true`) for administrative requests, forcing a fresh fetch from Gemini/TMDB and updating the cached state.

### C. Asynchronous API Concurrency & Early Resolution
*   **REQ-PERF-ASYNC-001 (Controlled Parallel Pools)**: Serial mapping loops over suggested titles to fetch metadata must be refactored into fully concurrent, non-blocking promise chains constrained by a controlled pool size of **max 5 concurrent operations** (using `p-limit` or equivalent chunked `Promise.all` bounds) to optimize network bandwidth and avoid TMDB HTTP 429 errors.
*   **REQ-PERF-ASYNC-002 (Early Partial-Resolution Headers & Streaming)**: The `/suggest` API gateway must support chunked transfer encoding (`Transfer-Encoding: chunked`) or Server-Sent Events (SSE) to send early suggestions (resolved titles) to the client immediately after Gemini completes, and subsequently stream individual movie metadata payloads as they are resolved.
*   **REQ-PERF-ASYNC-003 (Non-Blocking Failure Tolerances)**: If a specific movie metadata fetch fails in the mapping loop (e.g., TMDB returns 404 or 500 for a particular ID), the entire request must not fail. The system must filter out the single broken entry, log a diagnostic warning, and proceed to deliver the remaining valid items.

### D. Scalability, Resilience & Fail-safe
*   **REQ-PERF-SCA-001 (Resilient Connection Fail-safe)**: In the event of a Redis container failure, crash, network partition, or connection timeout, the backend must fail-safe. The application must log a warning and fall back to direct, non-cached queries to Gemini and TMDB APIs without causing application crashes or returning HTTP 500 errors to clients.
*   **REQ-PERF-SCA-002 (Dynamic Reconnection Strategy)**: The Redis client must implement an exponential backoff reconnection strategy (e.g., retrying connections after 1s, 2s, 4s, 8s, up to a maximum of 30s) to automatically heal once the Redis service recovers.
*   **REQ-PERF-SCA-003 (Global Caching Toggle)**: The application must support a `.env` toggle `DISABLE_CACHE=true` to globally disable all caching layers during active debugging, maintenance, or high-velocity development runs.

---

## 2. Validation & Testing Criteria

To sign off on the implementation, the performance features must meet these objective validation matrices:

| Requirement ID | Test Vector (Input) | Expected Outcome (Response) |
| :--- | :--- | :--- |
| **REQ-PERF-CACHE-001** | Multiple requests to `/suggest` for "90s space movies" | First call: Upstream query + cache write (~2.5s - 5s). Subsequent calls: Instant Redis cache delivery (<50ms). |
| **REQ-PERF-CACHE-002** | Cache entry verified in Redis CLI after a suggest call | Key namespace created (e.g. `cache:suggest:...`) and command `TTL <key>` returns positive seconds <= 86400 (24h). |
| **REQ-PERF-EVICT-001** | Call `DELETE /api/cache/invalidate` for a specific key | HTTP 200 `{ status: "success", evictedKeys: 1 }`. Subsequent suggest requests trigger a fresh upstream call. |
| **REQ-PERF-ASYNC-001** | Mapping loop for 10 suggested movie detail lookups | Concurrency capped at 5 simultaneous requests. Average total mapping time reduced by >= 60% compared to sequential execution. |
| **REQ-PERF-ASYNC-002** | Fetching `/suggest` with chunked streaming enabled | Stream begins immediately. First data chunk (titles list) arrives in <1.5s, followed by individual movie data blocks as they finish resolving. |
| **REQ-PERF-ASYNC-003** | TMDB lookup fails for 1 of 5 movies in suggestions | Gateway skips failed movie, returns remaining 4 successfully mapped movie entities with no HTTP 500 thrown. |
| **REQ-PERF-SCA-001** | Suggest call executed while Redis server is stopped | Log warning emitted: `[REDIS] Connection offline. Falling back to direct API.`. Suggest request succeeds after standard API latency (~3s). |

---

## 3. Verification Gates

We establish three mandatory Quality Control checkpoints. The implementation cannot advance past a gate without 100% compliance:

### 🛑 Gate 1: Architecture Sign-off (Current)
*   **Criteria**: The functional `spec.md` and technical `design.md` are approved by the human architect and fully aligned with the `ROADMAP.md` and `docs/SDD.md`.
*   **Status**: **IN PROGRESS**

### 🛑 Gate 2: Local Mock & Unit Test Verification
*   **Criteria**: Local unit tests covering Redis connection fail-safes, caching logic wrappers, `p-limit` concurrent pools, and chunked streamers execute with 100% pass rates. Mocking libraries are used to simulate Redis and third-party APIs.
*   **Status**: **PENDING**

### 🛑 Gate 3: Docker-Compose Integration & Load Test Verification
*   **Criteria**: E2E simulation executed in the container environment. Docker Compose boots all services, Redis maintains stateful caching keys, and JMeter/Artillery load-tests verify that cache hits deliver responses under 50ms while upstream API calls are successfully avoided on recurrent requests.
*   **Status**: **PENDING**
