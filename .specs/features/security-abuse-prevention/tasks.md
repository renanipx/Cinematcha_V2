# Actionable Implementation Checklist (tasks.md)
## EPIC-03: Security & Abuse Prevention

This document is the official implementation task registry for **EPIC-03: Security & Abuse Prevention**. It breaks the technical specifications and design considerations down into atomic, independent, and verifiable checklist units.

---

## Task List Matrix

### 📦 Task Group 1: Infrastructure & Package Setup
- [x] **TSK-SEC-INF-001**: Install required security packages:
  ```bash
  cd backend
  npm install express-rate-limit redis rate-limit-redis
  ```
  ➔ *Verify: `package.json` contains packages in dependencies list.*
- [x] **TSK-SEC-INF-002**: Add Redis container service to root `docker-compose.yml`:
  * Add `redis-cache` service using image `redis:alpine`.
  * Map service to the `app-network` virtual bridge.
  * Ensure no port `6379` is exposed directly to the public host interface, maintaining container isolation.
  ➔ *Verify: `docker-compose config` parses correctly without syntax errors.*

### 🔐 Task Group 2: Sanitization & Filtering Core
- [x] **TSK-SEC-SAN-001**: Create pure sanitizer module at `backend/src/utils/sanitizer.js`:
  * Enforce maximum boundary of `300` characters.
  * Create `INJECTION_PATTERNS` regular expression blocklist.
  * Implement safe string escapers.
  ➔ *Verify: Write modular tests passing clean strings and blocking malicious prompt injections.*
- [x] **TSK-SEC-SAN-002**: Add unit testing spec for sanitizer in `backend/src/utils/__tests__/sanitizer.test.js`:
  * Test: Exact 300 character edge cases.
  * Test: Standard injections (e.g. "ignore previous directions").
  ➔ *Verify: Run `npm run test` and confirm sanitizer suite passes successfully.*

### 🔌 Task Group 3: Stateful Redis & Middleware Configuration
- [x] **TSK-SEC-RED-001**: Implement Redis connection client at `backend/src/config/redis.config.js`:
  * Handle standard error listeners and reconnection triggers.
  * Implement an environmental toggle `DISABLE_REDIS` that disables pool creations safely.
  ➔ *Verify: Node server boots without crash if Redis container is offline.*
- [x] **TSK-SEC-RED-002**: Build custom rate limiters in `backend/src/middleware/rateLimit.middleware.js`:
  * Implement a Global memory rate-limiter (100 reqs/hr).
  * Implement the `/suggest` specific rate-limiter (30 reqs/hr).
  * Build the stateful IP-based Daily Request Cap (15 reqs/day) with Redis string counters and dynamic expirations at midnight UTC.
  * Embed in-memory fail-safe fallbacks if Redis client experiences connectivity outages.
  ➔ *Verify: Middleware imports clean configurations and does not lock Express cycle.*

### 🚀 Task Group 4: Server Integration & Gateway Hooks
- [x] **TSK-SEC-INT-001**: Mount global middlewares in `backend/src/server.js`:
  * Hook the Global rate-limiter on standard endpoints (`/trending`, `/popular`).
  * Mount the input sanitizer and sanitization checker directly on incoming body hooks.
  ➔ *Verify: Local development start command (`npm run start`) runs clean.*
- [x] **TSK-SEC-INT-002**: Protect expensive recommendation route:
  * Mount the aggressive rate limiter (30 reqs/hr) and the Redis daily quota checker (15 reqs/day) on `/api/suggest`.
  ➔ *Verify: Test route through Postman or Curl to receive correct payloads.*

### 🧪 Task Group 5: End-to-End Simulation & Verification
- [x] **TSK-SEC-SIM-001**: Conduct Docker integration test run:
  ```bash
  docker-compose up --build -d
  ```
  ➔ *Verify: Both `app-backend`, `app-frontend`, and `redis-cache` containers register green status in container lists.*
- [x] **TSK-SEC-SIM-002**: Perform E2E Abuse Simulations:
  * Simulate API floods to `/suggest` to trigger HTTP 429 after 30 requests.
  * Simulate daily cap exhaustions to verify key creation, expiry TTL limits, and daily blocks.
  * Trigger prompt injection request models to confirm HTTP 400 rejections.
  ➔ *Verify: Security logging pipelines capture audit trails.*
