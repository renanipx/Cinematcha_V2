# Technical Design Document (design.md)
## EPIC-03: Security & Abuse Prevention

This Technical Design Document details the concrete software architectures, pipeline components, Redis schemas, and mitigation strategies required to satisfy **EPIC-03: Security & Abuse Prevention**.

---

## 1. Middleware Architecture Pipeline

We intercept all incoming backend requests at the gateway level using a sequential, highly optimized Express middleware pipeline:

```
[ Inbound Client Request ]
           │
           ▼
┌─────────────────────────┐
│     JSON Body Parser    │  (Default Express parser)
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│    Sanitizer Utility    │  (Input validation, length filter, injection block)
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│   Global Rate Limiter   │  (Memory-based, sliding window: 100 reqs/hr)
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│    Daily Quota Check    │  (Redis-backed, 15 reqs/day/IP limit)
└──────────┬──────────────┘
           │
           ▼
[ API Controller / Gemini ]
```

---

## 2. Affected Backend Modules & Files

### A. Modified Modules
*   **[server.js](file:///d:/projetos/Cinematcha_V2/backend/src/server.js)**: Register the Redis configuration, mount the global rate limiters, and hook central error wrappers for security exceptions.
*   **[docker-compose.yml](file:///d:/projetos/Cinematcha_V2/docker-compose.yml)**: Provision the official `redis:alpine` container service and mount local configurations.
*   **[package.json](file:///d:/projetos/Cinematcha_V2/backend/package.json)**: Add security-critical packages: `express-rate-limit`, `redis`, and `rate-limit-redis`.

### B. [NEW] Modules to Create
*   **[redis.config.js](file:///d:/projetos/Cinematcha_V2/backend/src/config/redis.config.js)**: Establish a resilient connection pool to Redis with auto-reconnections.
*   **[sanitizer.js](file:///d:/projetos/Cinematcha_V2/backend/src/utils/sanitizer.js)**: Enforce character boundaries and regular-expression filters for prompt-injection behaviors.
*   **[rateLimit.middleware.js](file:///d:/projetos/Cinematcha_V2/backend/src/middleware/rateLimit.middleware.js)**: Package rate-limiting objects and configure the Redis Daily IP Capping middleware.

---

## 3. Redis Integration & Fail-Safe Strategy

### A. Redis Configuration
*   **Host**: `redis-cache` (Docker service hostname)
*   **Port**: `6379`
*   **Connection URI**: `redis://redis-cache:6379`

### B. Daily IP Capping Data Schema
*   **Key Structure**: `quota:ip:<ip_address>` (e.g., `quota:ip::ffff:127.0.0.1`)
*   **Type**: Redis `STRING` counter.
*   **Key Lifecycle (TTL)**: Calculated dynamically upon key creation to expire precisely at **00:00 UTC (Midnight)**.
*   **Operations Sequence**:
    ```javascript
    const count = await redisClient.incr(key);
    if (count === 1) {
        // Calculate remaining seconds until UTC midnight
        const now = new Date();
        const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
        const secondsToMidnight = Math.ceil((midnight.getTime() - now.getTime()) / 1000);
        await redisClient.expire(key, secondsToMidnight);
    }
    ```

### C. Fail-Safe / Resilient Standby
If the Redis container experiences critical outages, timeouts, or fails to initialize, the application must automatically fallback to a safe in-memory local tracker:
1.  Wrap Redis operations in standard `try/catch` and add connection error event listeners (`redisClient.on('error', ...)`).
2.  If Redis is disconnected, log a `winston` warning and activate a temporary `Map`-based local cache fallback.
3.  **Strict Boundary**: A Redis crash must **never** take down the suggestion engine or throw a 500 error page.

---

## 4. Input Sanitization & Anti-Injection Rules

The pure utility `sanitizer.js` inspects strings utilizing a two-pass algorithm:

### Pass 1: Structural Length Constraints
*   Validate string type and reject anything exceeding **300 characters**.
*   Sanitize special execution characters (HTML tags, double braces, control bytes).

### Pass 2: Prompt-Injection Filtering (Blocklist Regex)
We build a robust pattern library targeting adversarial prompt techniques:
```javascript
const INJECTION_PATTERNS = [
    /ignore\s+previous/i,
    /system\s+prompt/i,
    /bypass\s+instructions/i,
    /you\s+are\s+now\s+a/i,
    /translate\s+this/i,
    /override\s+instructions/i
];
```
If a user prompt matches any regular expressions, block execution immediately and log the request with high severity.

---

## 5. Rollback Considerations

To guarantee a safe recovery path if the production deployment fails:
1.  **Environment Flag Toggle**: Support `DISABLE_REDIS=true` inside `.env`. If toggled, the application will completely skip Redis connections and default to safe in-memory rate limiting.
2.  **Container Recovery**: To revert container mutations, standard Docker rollback commands will restore the deployment state:
    ```bash
    git checkout -- docker-compose.yml backend/package.json
    docker-compose down
    docker-compose up --build -d
    ```
