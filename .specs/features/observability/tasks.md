# Actionable Implementation Checklist (tasks.md)
## EPIC-04: Infrastructure Hardening & Observability

This document is the official implementation task registry for **EPIC-04: Infrastructure Hardening & Observability**. It breaks the technical specifications and design considerations down into atomic, independent, and verifiable checklist units.

---

## Task List Matrix

### 📦 Task Group 1: Package & Dependency Scaffolding

*   **TSK-OBS-INF-001**: Install Logging & Metrics npm Packages:
    *   **Action**: Scaffold required operational dependencies in the backend repository folder:
        ```bash
        cd backend
        npm install winston winston-daily-rotate-file prom-client
        ```
    *   **Affected Files**: 
        *   [package.json](file:///d:/projetos/Cinematcha_V2/backend/package.json)
    *   **Dependencies**: None
    *   **Testing Strategy**:
        *   Run `npm list winston winston-daily-rotate-file prom-client` in the backend directory.
        *   Verify that packages are listed under `dependencies` with correct SemVer constraints inside `package.json` and lockfiles update correctly.
    *   **Monitoring Validation**: None.
    *   **Rollback Notes**: Run `npm uninstall winston winston-daily-rotate-file prom-client` and discard edits.

---

### 🪵 Task Group 2: Structured Diagnostic Logging Pipeline

*   **TSK-OBS-LOG-001**: Implement Production Winston Logging Core:
    *   **Action**: Create the Winston logger utility file `logger.js`. The logger must support colorized spacing formats in development, optimized JSON structured lines in production, dynamic bypass variables, daily file rotations with size caps (10MB), and age-based file prunes (14 days).
    *   **Affected Files**: 
        *   `backend/src/utils/logger.js` *[NEW]*
    *   **Dependencies**: TSK-OBS-INF-001
    *   **Testing Strategy**:
        *   Unit test: Load the logger in a test script. In development mode, verify logs are output as colorized, styled console strings.
        *   Test: Swap environment to `NODE_ENV=production` and assert logs print as single-line, standardized JSON objects containing keys (`timestamp`, `level`, `message`).
    *   **Monitoring Validation**: Confirm file system writes are created in `/var/log/cinematcha` and compressed correctly to `.gz` format after rotation.
    *   **Rollback Notes**: Delete the new file `logger.js`.

*   **TSK-OBS-LOG-002**: Implement Correlation and HTTP Request Logging Middleware:
    *   **Action**: Create the Logging Middleware module. It must intercept incoming calls to check or inject `X-Correlation-ID` tracing IDs, and monitor standard finish hooks to log request latency, paths, response codes, and user IP contexts.
    *   **Affected Files**: 
        *   `backend/src/middleware/logging.middleware.js` *[NEW]*
    *   **Dependencies**: TSK-OBS-LOG-001
    *   **Testing Strategy**:
        *   Unit test: Verify that headers are parsed, and requests containing `X-Correlation-ID` preserve that value. If header is empty, assert a valid UUID v4 is generated.
        *   Mock: Simulate an incoming request finish lifecycle. Verify Winston outputs a transaction logs string matching the JSON logging schema.
    *   **Monitoring Validation**: Ensure Express transaction logs list identical correlation keys across concurrent routes.
    *   **Rollback Notes**: Delete `logging.middleware.js`.

*   **TSK-OBS-LOG-003**: Mount Logging and Correlation Middlewares in Gateway:
    *   **Action**: Integrate logging middlewares into `server.js` and implement startup folder check hooks to ensure the logging volume `/var/log/cinematcha` exists and is writable.
    *   **Affected Files**: 
        *   [server.js](file:///d:/projetos/Cinematcha_V2/backend/src/server.js)
    *   **Dependencies**: TSK-OBS-LOG-002
    *   **Testing Strategy**:
        *   Test: Start the backend server locally. Trigger requests (e.g. `GET /suggest/tmdb/trending`) and verify stdout displays structured console lines detailing HTTP paths and execution latencies.
        *   Test: Disable writing privileges to the logs directory, verify application handles file issues gracefully and falls back to console stream logging without crashing.
    *   **Monitoring Validation**: Check that console logs detail exact routing metadata.
    *   **Rollback Notes**: Discard changes made to `server.js`.

---

### 📊 Task Group 3: Prometheus Metrics & Telemetry Exporter

*   **TSK-OBS-MET-001**: Configure Prometheus Registry & Custom Metrics:
    *   **Action**: Create the Prometheus Metrics utility. It must initialize the metrics exporter registry, bind default NodeJS runtime monitors, declare custom counters and histograms (`cinematcha_http_requests_total`, `cinematcha_cache_hits_total`, etc.), and export the Express route handler.
    *   **Affected Files**: 
        *   `backend/src/config/metrics.js` *[NEW]*
    *   **Dependencies**: TSK-OBS-INF-001
    *   **Testing Strategy**:
        *   Unit test: Check that the register is initialized. Call the metrics endpoint handler inside mock requests, verify that plaintext output includes the help headers (`# HELP cinematcha_http_requests_total`).
        *   Test: Assert setting `DISABLE_TELEMETRY=true` causes the registry loader to skip metrics tracking and returns HTTP 503 on request.
    *   **Monitoring Validation**: Telemetry endpoints respond in standard Prometheus scrapers formats.
    *   **Rollback Notes**: Delete `metrics.js`.

*   **TSK-OBS-MET-002**: Mount Prometheus Telemetry Endpoint in Gateway Routing:
    *   **Action**: Update `server.js` to register the internal `/metrics` endpoint, exposing it securely for internal Docker containers scraping.
    *   **Affected Files**: 
        *   [server.js](file:///d:/projetos/Cinematcha_V2/backend/src/server.js)
    *   **Dependencies**: TSK-OBS-MET-001
    *   **Testing Strategy**:
        *   Test: Boot the gateway locally. Fetch `GET http://localhost:3001/metrics` and verify the body contains active system values (such as `cinematcha_nodejs_eventloop_lag_seconds`).
    *   **Monitoring Validation**: Endpoint responds within <5ms.
    *   **Rollback Notes**: Revert changes made to `server.js`.

---

### 💰 Task Group 4: Token Usage & Cost Observability Integration

*   **TSK-OBS-CST-001**: Implement AI Dynamic Cost Calculator:
    *   **Action**: Create the Cost Calculator utility. Scaffold the pricing sheets catalog for active models (Gemini Flash, Gemini Pro, Gemini 2.0) and write the tracker method to compute input/output USD expenditures and record counters metrics.
    *   **Affected Files**: 
        *   `backend/src/utils/cost-calculator.js` *[NEW]*
    *   **Dependencies**: TSK-OBS-MET-001
    *   **Testing Strategy**:
        *   Unit test: Verify that passing `gemini-1.5-flash-latest` (1000 input, 200 output tokens) returns exactly `$0.000135`.
        *   Unit test: Assert metric counters (`cinematcha_ai_cost_usd_total` and `cinematcha_ai_tokens_total`) increment by the exact expected amounts.
    *   **Monitoring Validation**: Logs contain context-appropriate `[AI_COST]` records and match calculated metric outputs.
    *   **Rollback Notes**: Delete `cost-calculator.js`.

*   **TSK-OBS-CST-002**: Integrate Observability Hooks in Business Services:
    *   **Action**: Inject logging, caching, and cost monitoring hooks inside the core suggestion and TMDB APIs. Record cache hits and misses, extract exact prompt/response token quantities on Gemini calls, and forward metrics to the cost calculator.
    *   **Affected Files**: 
        *   [suggest.service.js](file:///d:/projetos/Cinematcha_V2/backend/src/services/suggest.service.js)
        *   [tmdb.service.js](file:///d:/projetos/Cinematcha_V2/backend/src/services/tmdb.service.js)
    *   **Dependencies**: TSK-OBS-CST-001, TSK-OBS-LOG-003
    *   **Testing Strategy**:
        *   Test: Run search suggestions. Query `/metrics` to confirm that cache hits increments when hitting Redis, and `cinematcha_ai_tokens_total` and `cinematcha_ai_cost_usd_total` update instantly on AI processing.
        *   Test: Verify Winston output lines trace prompt counts and transactional dollar values.
    *   **Monitoring Validation**: Metrics show perfect correlation with system traffic.
    *   **Rollback Notes**: Revert changes in `suggest.service.js` and `tmdb.service.js`.

---

### 🐳 Task Group 5: Docker-Compose Observability Stack Topology

*   **TSK-OBS-DEP-001**: Scaffold Prometheus Scraping Rules and Grafana Mappings:
    *   **Action**: Create configuration folders and files to provision Prometheus targets and Grafana dashboards-as-code configurations:
        *   Create `prometheus.yml` configuring target scraping rules for backend service container.
        *   Create Grafana datasource mappings `datasource.yml` pointing to Prometheus.
        *   Create provisioning dashboard specifications `dashboards.yml` linking to custom Cinematcha dashboard folder.
        *   Create declarative layout model `cinematcha_dashboard.json` outlining gauges, charts, tables, and metric queries.
    *   **Affected Files**: 
        *   `infrastructure/prometheus/prometheus.yml` *[NEW]*
        *   `infrastructure/grafana/provisioning/datasources/datasource.yml` *[NEW]*
        *   `infrastructure/grafana/provisioning/dashboards/dashboards.yml` *[NEW]*
        *   `infrastructure/grafana/provisioning/dashboards/cinematcha_dashboard.json` *[NEW]*
    *   **Dependencies**: None
    *   **Testing Strategy**:
        *   Verify formatting and schema compliance of all YAML files.
        *   Validate JSON structure of `cinematcha_dashboard.json` using validation utilities.
    *   **Monitoring Validation**: None.
    *   **Rollback Notes**: Delete the new directories and files under `infrastructure/`.

*   **TSK-OBS-DEP-002**: Integrate Prometheus and Grafana into Docker Compose Stack:
    *   **Action**: Update the root `docker-compose.yml` to incorporate `prometheus` and `grafana` containers, bind local network links, configure environment flags, mount configuration pathways, and register persistent named disks (`app-logs`, `prometheus-data`, `grafana-data`).
    *   **Affected Files**: 
        *   [docker-compose.yml](file:///d:/projetos/Cinematcha_V2/docker-compose.yml)
    *   **Dependencies**: TSK-OBS-DEP-001
    *   **Testing Strategy**:
        *   Verify syntax parsing: Run `docker compose config` to assert environment config contains zero parsing errors.
        *   Deploy stack locally: Execute `docker compose up -d` and verify all containers (frontend, backend, redis, prometheus, grafana) start and list active states.
    *   **Monitoring Validation**:
        *   Access Prometheus Web UI (`http://localhost:9090`) to verify target status for `backend:3001` lists as "UP".
        *   Access Grafana UI (`http://localhost:3000`) and login using secure credentials. Assert the custom dashboard "Cinematcha System Overview" renders perfectly.
    *   **Rollback Notes**: Discard edits made to `docker-compose.yml` and stop/prune containers.

---

### 🧪 Task Group 6: Live Integration & Resilience Verification

*   **TSK-OBS-SIM-001**: End-to-End Simulation & Rollback Strategy Verification:
    *   **Action**: Execute load simulation sequences to verify log rotations, file size limits, metrics calculations under load, and bypass switches:
        *   Verify that setting `.env` variable `DISABLE_TELEMETRY=true` deactivates metrics processing and returns a friendly error on `/metrics` endpoint.
        *   Verify that setting `.env` variable `FORCE_MINIMAL_LOGGING=true` stops file writing, restricts console logs to `error` level, and continues system processes.
        *   Verify log rotations: Inject large logging arrays, check that files split at 10MB, compress to `.gz`, and preserve historical logs.
    *   **Affected Files**: None.
    *   **Dependencies**: All previous implementation tasks (TSK-OBS-INF-001 through TSK-OBS-DEP-002)
    *   **Testing Strategy**:
        *   Inspect running container logs during fault injections and mock out rate limit limits or connection timeouts.
        *   Assert Grafana dashboard charts display accurate representations of real-time failures, cost increases, caching success, and response times.
    *   **Validation Rules**: System observability is stable, operates under 5% CPU overhead, and adheres 100% to functional guidelines.
    *   **Rollback Notes**: None.
