# Functional Specification (spec.md)
## EPIC-02: AI Orchestration & Prompt Reliability

This document defines the functional and non-functional specifications for **EPIC-02: AI Orchestration & Prompt Reliability** within the Cinematcha fullstack application. It establishes strict quality standards, validation criteria, and Verification Gates to eliminate response drift, mitigate LLM hallucinations, and ensure 100% recommendation service availability through dynamic model failover, prompt versioning, structured validations, and robust fallback strategies.

---

## 1. Requirement Catalog

We categorize all AI orchestration and reliability requirements using traceable **Requirement IDs**:

### A. Prompt Versioning & Registry Control
*   **REQ-AI-VER-001 (Filesystem Prompt Registry)**: All system prompts (user and system roles) must be extracted from environment variables and hardcoded strings, and placed inside a structured, version-controlled filesystem registry under `backend/src/config/prompts/`.
*   **REQ-AI-VER-002 (Registry Configuration Schema)**: Prompt files must be defined in structured configurations (JSON or JS modules) containing:
    *   `version`: SemVer string (e.g., `1.0.0`).
    *   `modelConstraints`: Recommended model endpoints (e.g., `gemini-1.5-flash-latest`).
    *   `parameters`: Default hyperparameter presets (`temperature`, `topP`, `maxOutputTokens`).
    *   `templates`: The actual localized system and user prompt strings with placeholders (e.g. `{{prompt}}`, `{{locale}}`).
*   **REQ-AI-VER-003 (Dynamic Registry Loader)**: The `suggest.service.js` must consume a registry loader that dynamically retrieves prompt configurations matching specified model targets and locales at runtime.
*   **REQ-AI-VER-004 (Registry Hot-Freeze & Override)**: The registry loader must support hot-freezing prompt versions through a `.env` setting (e.g., `PROMPT_VERSION_OVERRIDE=1.0.0`) to force standard prompts during maintenance or rollout rollbacks.

### B. AI Fallback Orchestration & Model Failover Strategy
*   **REQ-AI-FAIL-001 (Model Failover Cascade)**: In the event of a transient failure on the primary model `gemini-1.5-flash-latest` (such as HTTP 429 Rate Limit, HTTP 503 Service Unavailable, token limits, or network timeout), the backend gateway must catch the error and automatically fall back to a pre-defined cascade array of alternative models:
    *   **Primary**: `gemini-1.5-flash-latest`
    *   **Secondary**: `gemini-1.5-pro` (handles complex scenarios; higher limits)
    *   **Tertiary**: `gemini-2.0-flash-exp` or equivalent active alternative.
*   **REQ-AI-FAIL-002 (Circuit Breaker State)**: The failover client must track continuous failures. If a specific model service registers **3 consecutive failures**, a circuit breaker must trip for **5 minutes**, instantly routing incoming suggestions to the next model in the cascade without making redundant outbound HTTP requests.
*   **REQ-AI-FAIL-003 (Static Fallback Recommendation Catalog)**: If the entire AI cascade fails (all models offline or timed out), the gateway must execute a graceful fail-safe by retrieving and returning high-rated, curated movie suggestions from a localized static catalog `backend/src/config/fallback_catalog.json` corresponding to the user's selected locale.

### C. AI Response Validation Contracts & Semantic Retries
*   **REQ-AI-VAL-001 (Response Validation Contract)**: The orchestration service must validate all LLM completions against a strict structural and schema contract. The default contract requires the response to be parsed into an array of exactly **5 to 10 movie titles**.
*   **REQ-AI-VAL-002 (Filler & Conversational Prose Detection)**: The validator must reject conversational filler, introduction greetings, and system chatter (e.g., "Here is a list of movies...", "Certainly, I'd be happy to help with...").
*   **REQ-AI-VAL-003 (Programmatic Semantic Retry Pipeline)**: If a response fails the validation contract (malformed layout, conversational filler, or empty array), the service must catch the validation exception and immediately trigger a **semantic retry** (up to a maximum of **2 retries**):
    *   **Retry 1**: Re-request with a reduced temperature setting (capped at `0.1`) to enforce deterministic completions.
    *   **Retry 2**: If Retry 1 fails, append a strict instruction suffix (e.g., `[REPAIR: Return only comma-separated values. No conversational intro/outro allowed.]`) to the prompt block.

### D. Hallucination Mitigation & TMDB Cross-Validation
*   **REQ-AI-MIT-001 (TMDB Entity Cross-Validation)**: During the parallel movie mapping loop, every title suggested by the LLM must be cross-validated against the TMDB Search API (`/search/movie`). If the search returns zero results, the title is flagged as a hallucination.
*   **REQ-AI-MIT-002 (Jaro-Winkler Similarity Gate)**: The cross-validation engine must compute a Jaro-Winkler or Levenshtein-based similarity score comparing the LLM-suggested title against the primary title returned by TMDB. If the similarity score is below **75%**, the title is flagged as a hallucination.
*   **REQ-AI-MIT-003 (Dynamic Eviction & Popular Backfill)**: Any title flagged as a hallucination must be immediately evicted from the results. To maintain a consistent experience, the system must dynamically backfill empty slots by pulling from TMDB's active trending/popular movie list for that locale, ensuring the client always receives the requested count of valid results.

### E. Resilience, Retries & Observability
*   **REQ-AI-RES-001 (Exponential Backoff with Jitter)**: External HTTP client requests (Gemini, TMDB) must be wrapped in a retry handler that enforces exponential backoff (e.g., multiplier `2.0`, starting delay `500ms`) with random jitter to handle transient API rate limiting (HTTP 429).
*   **REQ-AI-RES-002 (Socket Connection Timeouts)**: Inbound AI API requests must enforce a strict **8-second socket timeout** to prevent hanging threads and ensure that the failover cascade triggers swiftly rather than leaving the user waiting indefinitely.
*   **REQ-AI-OBS-001 (Winston Structured Caching Logs)**: The gateway logging framework must capture structured audit logs of the AI integration lifecycle, explicitly noting:
    *   `[AI_ORCH] PROMPT_LOAD - Version: 1.0.0, Locale: pt`
    *   `[AI_ORCH] MODEL_FALLOVER - Primary Failed (Reason: 429). Routing to: gemini-1.5-pro`
    *   `[AI_ORCH] VALIDATION_FAILURE - Output malformed. Triggering semantic retry.`
    *   `[AI_ORCH] HALLUCINATION_DETECTED - Suggested: "Interstellar 2", TMDB Sim: 40%. Evicting.`
    *   `[AI_ORCH] BACKFILL_TRIGGER - Backfilling 1 slot with: "Gladiator"`
*   **REQ-AI-OBS-002 (Prometheus Telemetry Metrics)**: Expose real-time operational and cost metrics under the `/metrics` API path:
    *   `cinematcha_ai_tokens_total` (labels: `model`, `type` [input|output])
    *   `cinematcha_ai_cost_usd_total` (labels: `model` - tracks cumulative expenditures based on token price sheets)
    *   `cinematcha_ai_failover_total` (labels: `failed_model`, `fallback_model`)
    *   `cinematcha_ai_validation_failures_total` (labels: `model`, `retry_count`)
    *   `cinematcha_ai_hallucinations_total` (labels: `suggested_title`)

### F. Rollback & Fail-Safe Strategy
*   **REQ-AI-ROL-001 (Model Fallback Toggle)**: The application must support a `.env` variable `DISABLE_AI_FAILOVER=true` to globally deactivate the model cascade, restricting calls exclusively to the primary model for strict debugging.
*   **REQ-AI-ROL-002 (Static Catalog Force Bypass)**: The application must support a `.env` variable `FORCE_STATIC_FALLBACK=true` which skips LLM lookups entirely and forces the static fallback registry to serve recommendation mocks instantly, serving as an immediate disaster recovery mechanism.

---

## 2. Validation & Testing Criteria

To sign off on the implementation, the AI Orchestration features must satisfy the following validation matrices:

| Requirement ID | Test Vector (Input) | Expected Outcome (Response) |
| :--- | :--- | :--- |
| **REQ-AI-VER-001** | App Boot + Registry Load | Prompt registry loaded from `backend/src/config/prompts/` rather than `.env` configurations. Logs confirm load. |
| **REQ-AI-FAIL-001** | Outage Mock (Simulated 503 on `gemini-1.5-flash-latest`) | Log warns primary failure. Model swaps dynamically to `gemini-1.5-pro`. Request returns successfully (~4s). |
| **REQ-AI-FAIL-002** | 3 consecutive suggestion calls when all APIs return 429 | First 3 calls fail over sequentially. Subsequent suggestion immediately triggers failover/local static fallback without calling the API. |
| **REQ-AI-FAIL-003** | Total Gemini network outage simulated (No internet) | Dynamic fallback to `fallback_catalog.json`. Return HTTP 200 containing curated static movies. |
| **REQ-AI-VAL-001** | LLM responds with: `"Sure, here are movies: Inception, Matrix, Alien"` | Validation intercepts malformed layout. Catch triggers semantic retry pipeline. |
| **REQ-AI-VAL-003** | Malformed response parsed during suggest routine | App triggers Retry 1 (temp=0.1) and successfully recovers clean titles. No user-visible error. |
| **REQ-AI-MIT-001** | LLM suggests non-existent title: `"The Cosmic Odyssey of Bob (2027)"` | TMDB search yields 0 matches. Cross-validation flags title as a hallucination. |
| **REQ-AI-MIT-002** | LLM suggests misspelled title: `"Intersellar (2014)"` | TMDB matches `"Interstellar (2014)"` with similarity score 94%. Title corrected and verified successfully. |
| **REQ-AI-MIT-003** | Suggestion contains 1 hallucinated title and 4 valid ones | Hallucinated title evicted. Empty slot backfilled with current top trending movie. Result array maintains count of 5. |
| **REQ-AI-RES-002** | Gemini API call takes >8 seconds to respond | Connection socket times out. Request immediately routes to next model in failover cascade. |
| **REQ-AI-ROL-002** | Set `.env` flag `FORCE_STATIC_FALLBACK=true` | AI suggestions bypassed entirely. Suggestions resolved in <20ms from local static catalog. |

---

## 3. Verification Gates

We establish three mandatory Quality Control checkpoints. The implementation cannot advance past a gate without 100% compliance:

### 🛑 Gate 1: Architecture Sign-off (Current)
*   **Criteria**: The functional `spec.md` and technical `design.md` are approved by the human architect and fully aligned with the `ROADMAP.md` and `docs/SDD.md`.
*   **Status**: **IN PROGRESS**

### 🛑 Gate 2: Local Mock & Unit Test Verification
*   **Criteria**: Local unit tests covering Prompt registry parsing, Jaro-Winkler similarity calculations, failover model cascades, and semantic retry state loops execute with 100% pass rates. Mocking libraries are used to simulate TMDB searches, Gemini endpoints, and network timeouts.
*   **Status**: **PENDING**

### 🛑 Gate 3: Docker-Compose Integration & Fault Injection Testing
*   **Criteria**: E2E simulation executed in the container environment. Fault injection testing (stopping network routes to Gemini, spoofing rate limit headers, feeding malformed completions) confirms the system handles failures gracefully, maintains 100% availability, and correctly records metrics inside Prometheus dashboards.
*   **Status**: **PENDING**
