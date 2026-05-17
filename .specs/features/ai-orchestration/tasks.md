# Actionable Implementation Checklist (tasks.md)
## EPIC-02: AI Orchestration & Prompt Reliability

This document is the official implementation task registry for **EPIC-02: AI Orchestration & Prompt Reliability**. It breaks the technical specifications and design considerations down into atomic, independent, and verifiable checklist units.

---

## Task List Matrix

### 📦 Task Group 1: Infrastructure & Package Setup

*   **TSK-AI-INF-001**: Install required telemetry and observability packages:
    *   **Action**: Install production dependencies in the backend directory:
        ```bash
        cd backend
        npm install prom-client
        ```
    *   **Affected Files**: [package.json](file:///d:/projetos/Cinematcha_V2/backend/package.json)
    *   **Dependencies**: None
    *   **Testing Strategy**: Run `npm list prom-client` to confirm correct installations and inspect `package-lock.json`.
    *   **Validation Rules**: Packages are listed with SemVer constraints in `package.json` and install completes with zero errors.
    *   **Rollback Notes**: Run `npm uninstall prom-client` and discard edits to `package.json`.

---

### 🗃️ Task Group 2: Prompt Registry & Versioning Control

*   **TSK-AI-REG-001**: Implement SemVer Prompt Filesystem & Registry Loader:
    *   **Action**: Create the prompt registry subdirectory and implement `registry.js` alongside localized template structures `v1.0.0.js` and `v1.1.0.js`. The loader must parse incoming system/user prompts, inject variables, and support override environment switches.
    *   **Affected Files**: 
        *   `backend/src/config/prompts/registry.js` *[NEW]*
        *   `backend/src/config/prompts/templates/v1.0.0.js` *[NEW]*
        *   `backend/src/config/prompts/templates/v1.1.0.js` *[NEW]*
    *   **Dependencies**: TSK-AI-INF-001
    *   **Testing Strategy**: 
        *   Write unit tests asserting that loading version `1.0.0` with localized prompt strings returns the correct system prompts.
        *   Test: Verify that setting `PROMPT_VERSION_OVERRIDE=1.0.0` dynamically forces that version regardless of request headers.
    *   **Validation Rules**: System prompts are correctly externalized. Loader dynamically processes variable interpolation (`{{prompt}}`, `{{locale}}`) for English and Portuguese.
    *   **Rollback Notes**: Delete the new prompt registry folder and files.

---

### 🛡️ Task Group 3: AI Response Validation & Semantic Retry Pipeline

*   **TSK-AI-VAL-001**: Implement Response Validation Contract & Semantic Retry State-Machine:
    *   **Action**: Create `ai-validation.service.js` containing strict array parsers, conversational prose detectors, and regex-based number-strippers. Integrate the parsing engine into the suggestion service, wrapping output collection in a semantic retry loop (max 2 attempts) that handles failure modes by adjusting temperature and injecting instruction suffixes.
    *   **Affected Files**: 
        *   `backend/src/services/ai-validation.service.js` *[NEW]*
        *   [suggest.service.js](file:///d:/projetos/Cinematcha_V2/backend/src/services/suggest.service.js)
    *   **Dependencies**: TSK-AI-REG-001
    *   **Testing Strategy**: 
        *   Unit test: Verify the validator rejects conversational prose (e.g. "Certainly, here are some movies:") and empty values.
        *   Unit test: Verify that Retry 1 correctly forces `temperature = 0.0` and Retry 2 successfully appends dynamic instruction suffixes.
    *   **Validation Rules**: Outputs failing contract guidelines are caught and automatically trigger a retry without returning 500 errors to clients.
    *   **Rollback Notes**: Remove `ai-validation.service.js` and execute `git restore backend/src/services/suggest.service.js`.

---

### 🔄 Task Group 4: AI Failover Service & Cascade Integration

*   **TSK-AI-FAIL-001**: Implement Model Cascade & Circuit Breaker Logic:
    *   **Action**: Create `failover.service.js` implementing the cascade routing array (Gemini Flash -> Gemini Pro -> Gemini 2.0 Flash) with custom socket timeouts (8-10 seconds) and stateful circuit breakers. Circuit breaker tracks consecutive model failures and trips for 5 minutes after 3 failures.
    *   **Affected Files**: 
        *   `backend/src/services/failover.service.js` *[NEW]*
        *   [suggest.service.js](file:///d:/projetos/Cinematcha_V2/backend/src/services/suggest.service.js)
    *   **Dependencies**: TSK-AI-VAL-001
    *   **Testing Strategy**: 
        *   Mock: Simulate transient errors (HTTP 429/503) on the primary model; verify routing automatically switches to the secondary model.
        *   Mock: Feed consecutive errors to trip circuit breakers; assert subsequent requests bypass the failing model instantly.
    *   **Validation Rules**: Cascade successfully intercepts errors and routes requests across engines within targeted timeout margins (<= 8s).
    *   **Rollback Notes**: Remove `failover.service.js` and restore modified files.

*   **TSK-AI-FAIL-002**: Implement Local Static Recommendation Catalog:
    *   **Action**: Create `fallback_catalog.json` containing highly-rated pre-compiled movies structured by locale. Integrate a fail-safe catch inside `suggest.service.js` that loads this catalog and returns standard recommendation blocks when the entire model cascade fails.
    *   **Affected Files**: 
        *   `backend/src/config/fallback_catalog.json` *[NEW]*
        *   [suggest.service.js](file:///d:/projetos/Cinematcha_V2/backend/src/services/suggest.service.js)
    *   **Dependencies**: TSK-AI-FAIL-001
    *   **Testing Strategy**: 
        *   Test: Disable network routes or inject offline parameters; verify the service gracefully loads `fallback_catalog.json` and responds with HTTP 200 containing valid movies.
    *   **Validation Rules**: Complete backend service failures trigger a silent fallback, ensuring 100% recommendation page availability.
    *   **Rollback Notes**: Delete `fallback_catalog.json` and revert the catch blocks in `suggest.service.js`.

---

### 🔬 Task Group 5: TMDB Cross-Validation & Hallucination Mitigation

*   **TSK-AI-MIT-001**: Implement Pure Jaro-Winkler String Distance Matcher:
    *   **Action**: Create a dependency-free Jaro-Winkler string similarity matcher under the utils folder to evaluate title correlation scores during validation.
    *   **Affected Files**: 
        *   `backend/src/utils/similarity.js` *[NEW]*
    *   **Dependencies**: None
    *   **Testing Strategy**: 
        *   Unit test: Verify comparison match results between typical spelling variants (e.g. `"Intersellar"` vs `"Interstellar"` returns score >= 90%, `"Alien"` vs `"The Martian"` returns score < 50%).
    *   **Validation Rules**: String distance outputs comply with pure Winkler adjustments, returning floats between `0.0` and `1.0`.
    *   **Rollback Notes**: Remove `similarity.js`.

*   **TSK-AI-MIT-002**: Implement Eviction & Dynamic Backfill Loop:
    *   **Action**: Integrate similarity gates inside the movie mapping loop. If TMDB yields 0 results or similarity falls below 75%, evict the item and dynamically pull top trending films for the locale to backfill empty suggestion slots.
    *   **Affected Files**: 
        *   [suggest.service.js](file:///d:/projetos/Cinematcha_V2/backend/src/services/suggest.service.js)
    *   **Dependencies**: TSK-AI-MIT-001
    *   **Testing Strategy**: 
        *   Test: Spoof suggestion list with a made-up movie name (e.g., "The Infinite Sparkle"); verify the title is evicted and a popular fallback movie is dynamically backfilled.
    *   **Validation Rules**: The client is protected from hallucinated, dead-end recommendation cards. Output recommendations array maintains exact targets (e.g. 5 resolved movies).
    *   **Rollback Notes**: Restore original mapping loop configurations in `suggest.service.js`.

---

### 📊 Task Group 6: Observability, Winston Logging & Prometheus Telemetry

*   **TSK-AI-OBS-001**: Implement Structured Audit Logging & Prometheus Metrics:
    *   **Action**: Integrate Winston audit log markers inside the orchestration, failover, validation, and eviction helper services. Implement standard Prometheus counters and gauges under `/metrics` to track token count, transaction costs, failovers, and eviction events.
    *   **Affected Files**: 
        *   `backend/src/services/ai-validation.service.js`
        *   `backend/src/services/failover.service.js`
        *   [suggest.service.js](file:///d:/projetos/Cinematcha_V2/backend/src/services/suggest.service.js)
        *   [suggest.controller.js](file:///d:/projetos/Cinematcha_V2/backend/src/controllers/suggest.controller.js)
        *   [server.js](file:///d:/projetos/Cinematcha_V2/backend/src/server.js)
    *   **Dependencies**: TSK-AI-FAIL-002, TSK-AI-MIT-002
    *   **Testing Strategy**: 
        *   Execute suggest queries; query `/metrics` to ensure counters (e.g. `cinematcha_ai_tokens_total`) increment correctly.
        *   Assert Winston log streams output structured JSON lines with precise labels.
    *   **Validation Rules**: Operations metrics and system expenditures are tracked in real-time, matching standard API dashboards.
    *   **Rollback Notes**: Revert metric registrations, Winston log additions, and server mount endpoints.

---

### 🧪 Task Group 7: End-to-End Simulation & Resilience Testing

*   **TSK-AI-SIM-001**: E2E Verification of AI Pipeline & Fault Injection Simulation:
    *   **Action**: Run E2E simulation suites, injecting simulated outages, timeout delays, and malformed completions to verify robustness.
    *   **Affected Files**: None
    *   **Dependencies**: All previous implementation tasks (TSK-AI-INF-001 through TSK-AI-OBS-001)
    *   **Testing Strategy**: 
        *   Fault test: Spoof TMDB to drop 2 of 5 recommendations; assert Jaro-Winkler similarity catches evictions and successfully backfills.
        *   Load test: Verify model failover cascade functions under simulated peak-load rate limits without impacting average server throughput.
    *   **Validation Rules**: Orchestration remains functional, robust, and performs within specified margins under heavy fault injection constraints.
    *   **Rollback Notes**: None needed.
