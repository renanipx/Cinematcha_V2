# Functional Specification (spec.md)
## EPIC-04: Infrastructure Hardening & Observability

This document defines the functional and non-functional specifications for **EPIC-04: Infrastructure Hardening & Observability** within the Cinematcha fullstack application. It establishes strict operational standards, logging contracts, real-time telemetry pipelines, token-level cost metrics, and a Docker-based observability topology. The goal is to provide engineering and operations teams with 100% visibility into request performance, upstream API failures, AI token usage, and live system expenditures.

---

## 1. Requirement Catalog

We categorize all infrastructure hardening and observability requirements using traceable **Requirement IDs**:

### A. Structured Logging & Winston Architecture
*   **REQ-OBS-LOG-001 (JSON Structured Outputs)**: The Express backend must emit all logs as structured JSON strings to standard output (`stdout`) and standard error (`stderr`) when running in production environment. Standardizing on JSON ensures compatibility with downstream log collectors.
*   **REQ-OBS-LOG-002 (Winston Integration)**: The logging utility must utilize the `winston` logging framework. It must support distinct log levels (`error`, `warn`, `info`, `http`, `debug`) and expose a singleton logger instance used globally across controllers, services, and middlewares.
*   **REQ-OBS-LOG-003 (Standard Log Schema)**: Every structured log entry must adhere to a standardized JSON schema containing the following key-value pairs:
    *   `timestamp`: ISO-8601 formatted date-time string.
    *   `level`: The log severity level in uppercase.
    *   `message`: A clear, human-readable description of the log event.
    *   `context`: The subsystem or module emitting the log (e.g. `API_GATEWAY`, `AI_ORCHESTRATION`, `REDIS_CACHE`).
    *   `traceId`: Optional unique request identifier (UUID v4) propagated through incoming headers to enable transaction correlation.
    *   `metadata`: Context-specific key-value object (e.g. API status, response latency, prompt versions).
*   **REQ-OBS-LOG-004 (Environment-Dependent Formatting)**: The Winston logger must automatically swap formatters based on environment configurations:
    *   **Development (`NODE_ENV=development`)**: Human-readable, colorized console output with inline timestamps and spacing.
    *   **Production (`NODE_ENV=production`)**: Minimized, single-line JSON format.

### B. Log Rotation Policies & Storage Caps
*   **REQ-OBS-ROT-001 (Log File Segregation)**: In addition to console streaming, the Winston logger must write to persistent files using `winston-daily-rotate-file` in the container's `/var/log/cinematcha/` volume directory:
    *   `combined-%DATE%.log`: Standard application logs (`info` level and above).
    *   `error-%DATE%.log`: Restricted exclusively to system exceptions, integration timeouts, and contract failures (`error` level only).
*   **REQ-OBS-ROT-002 (Size & Age Boundary Policies)**: Log files must follow strict rotation boundaries to prevent host disk exhaustion:
    *   `maxSize`: 10 Megabytes (`10m`). Once a file exceeds 10MB, it must rotate immediately.
    *   `maxFiles`: 14 Days (`14d`). Logs older than 14 days must be automatically purged.
    *   `zippedArchive`: True. Rotated log files must be compressed using gzip (`.gz`) to optimize disk utilization.

### C. Prometheus Metrics Pipeline & Exporter
*   **REQ-OBS-MET-001 (Prometheus Metrics Exporter)**: The Express application must expose an internal scraping endpoint `/metrics` utilizing the `prom-client` library. Access to this endpoint should be restricted to the internal Docker network.
*   **REQ-OBS-MET-002 (Default NodeJS Telemetry)**: The `/metrics` endpoint must automatically collect and export default Node.js runtime metrics (e.g. Event Loop lag, CPU utilization, active handles, memory usage, heap garbage collection stats).
*   **REQ-OBS-MET-003 (Custom Core Metrics)**: The application must register and expose the following custom metrics to track client usage, caching performance, and API transactions:
    *   `cinematcha_http_requests_total` (Counter): Tracks total incoming HTTP requests (labels: `method`, `route`, `status_code`).
    *   `cinematcha_http_request_duration_seconds` (Histogram): Measures API request latency (labels: `method`, `route`, `status_code`, buckets: `[0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]`).
    *   `cinematcha_cache_hits_total` (Counter): Tracks Redis caching success rates (labels: `cache_type` [e.g. `movies`, `trending`, `providers`], `hit` [true|false]).

### D. Token Usage Tracking & Cost Observability
*   **REQ-OBS-CST-001 (Gemini API Token Tracking)**: The AI Orchestration service must extract exact token usage metrics for all incoming requests. When using the Gemini SDK, the service must query the SDK's metadata or execute `countTokens` programmatically to capture:
    *   `input_tokens`: The number of tokens sent in the prompt.
    *   `output_tokens`: The number of tokens returned by the LLM.
*   **REQ-OBS-CST-002 (Real-Time Token Telemetry)**: Real-time token counts must be exported to Prometheus using the custom counter metric:
    *   `cinematcha_ai_tokens_total` (labels: `model_id`, `type` [`input`|`output``]).
*   **REQ-OBS-CST-003 (Dynamic Cost Calculation Engine)**: The service must dynamically calculate the estimated USD cost of every Gemini transaction. It must utilize an in-memory pricing catalog mapping token volumes to their respective pricing models:
    *   **`gemini-1.5-flash-latest`**: $0.000075 / 1k input tokens (up to 128k context), $0.0003 / 1k output tokens (up to 128k context).
    *   **`gemini-1.5-pro`**: $0.0035 / 1k input tokens (up to 128k context), $0.0105 / 1k output tokens (up to 128k context).
    *   **`gemini-2.0-flash-exp`**: $0.00015 / 1k input tokens, $0.0006 / 1k output tokens.
*   **REQ-OBS-CST-004 (Cost Aggregator Metric)**: Calculated USD transaction costs must be incremented and exposed using the custom counter metric:
    *   `cinematcha_ai_cost_usd_total` (labels: `model_id`, `context` [`suggest`|`fallback`]).

### E. Docker Compose Observability Topology
*   **REQ-OBS-DEP-001 (Observability Container Stack)**: The system's multi-container environment must incorporate Prometheus and Grafana as dedicated, long-running services:
    *   `prometheus`: Scrapes `/metrics` from the backend API gateway at a **15-second interval**.
    *   `grafana`: Connects to Prometheus as a default datasource, serving pre-configured dashboard UI visualization assets.
*   **REQ-OBS-DEP-002 (Isolated Networking & Volume Persistence)**:
    *   Containers must share a private virtual bridge network (`app-network`) allowing DNS resolution (e.g. Prometheus resolves backend metrics via `http://backend:3001/metrics`).
    *   Prometheus metrics database (`/prometheus`) and Grafana settings/dashboards (`/var/lib/grafana`) must be mapped to persistent, named Docker volumes to guarantee data survival across container recreations.
    *   Access to Grafana must be exposed on the host's public network via port `3000`, protected by strong, environment-injected admin credentials.

### F. Grafana Dashboard Architecture & Visual Panels
*   **REQ-OBS-GRA-001 (Unified Observability Dashboard)**: The Grafana container must boot with an automatically provisioned, custom dashboard (`Cinematcha System Overview`) showcasing:
    *   **System Throughput & Health**: Live HTTP request rates, error rates (5xx/4xx), and average latency gauges.
    *   **Redis Caching Metrics**: Live Cache hit ratio gauge ($\text{hits} / \text{total requests}$).
    *   **AI Service Health**: Model failover event counts and semantic retry distribution.
    *   **Financial & Resource Dashboard**: Cumulative API spending in USD (calculated from `cinematcha_ai_cost_usd_total`), token consumption over time, and active LLM model breakdown.
*   **REQ-OBS-GRA-002 (Declarative Dashboard-as-Code)**: The dashboard layout, datasources, and provision settings must be declared as version-controlled JSON files mounted into the Grafana container's provisioning path during execution.

### G. Rollback & Fault-Tolerant Fail-Safe Strategy
*   **REQ-OBS-ROL-001 (Observability Bypass Switch)**: In the event of Prometheus metrics registry errors causing application boot blocks or server-side memory leaks, the application must support a `.env` variable `DISABLE_TELEMETRY=true`. Setting this flag must bypass all Prometheus metric collections, registries, and exporter routes, rendering `/metrics` as a standard HTTP 503 endpoint.
*   **REQ-OBS-ROL-002 (Log Rotation Spillover Override)**: If local container disk space drops below **10%**, a fallback script or `.env` variable `FORCE_MINIMAL_LOGGING=true` must automatically force Winston to drop output levels from `info`/`http` to `error` only, stopping file-writes instantly and emitting minimal JSON logs exclusively to `stdout`.

---

## 2. Validation & Testing Criteria

To sign off on the implementation, the Hardening & Observability features must satisfy the following validation matrices:

| Requirement ID | Test Vector (Input) | Expected Outcome (Response) |
| :--- | :--- | :--- |
| **REQ-OBS-LOG-001** | Trigger a HTTP request in production mode | Winston outputs single-line JSON structure to `stdout`. No formatting colors or linebreaks. |
| **REQ-OBS-LOG-003** | Run `/suggest` request with `X-Correlation-ID: test-trace-uuid` | Returned log entries include `"context": "API_GATEWAY"`, `"traceId": "test-trace-uuid"`, and detailed API metadata. |
| **REQ-OBS-ROT-002** | Generate 25MB of structured logs in 5 minutes | Verify log files rotate correctly into `combined-%DATE%.1.log.gz` and `combined-%DATE%.2.log.gz`. Files size never exceeds 10MB. |
| **REQ-OBS-MET-001** | Call `GET http://backend:3001/metrics` | Returns standard Prometheus plaintext payload (`# HELP`, `# TYPE`, metrics names). |
| **REQ-OBS-MET-003** | Trigger successful suggest cached query | Counter `cinematcha_cache_hits_total{cache_type="movies", hit="true"}` increments by 1. |
| **REQ-OBS-CST-002** | Send recommendation prompt using `gemini-1.5-flash-latest` | `cinematcha_ai_tokens_total{model_id="gemini-1.5-flash-latest", type="input"}` increments by exact prompt token size. |
| **REQ-OBS-CST-004** | Complete recommendation call using `gemini-1.5-flash-latest` (1000 input, 200 output tokens) | Counter `cinematcha_ai_cost_usd_total{model_id="gemini-1.5-flash-latest", context="suggest"}` increments by exactly `$0.000135`. |
| **REQ-OBS-DEP-002** | Recreate Prometheus and Grafana docker containers | Past scraped time-series data and Grafana custom dashboard dashboards persist and reload seamlessly. |
| **REQ-OBS-GRA-001** | Open Grafana UI on Host Port 3000 | Custom "Cinematcha System Overview" dashboard renders without errors, connecting automatically to Prometheus. |
| **REQ-OBS-ROL-001** | Boot application with `DISABLE_TELEMETRY=true` | Application starts normally. `/metrics` endpoint returns HTTP 503 "Telemetry Disabled". Metrics wrappers are non-blocking. |
| **REQ-OBS-ROL-002** | Boot application with `FORCE_MINIMAL_LOGGING=true` | Application starts. Logs restricted to `error` level. Log rotation writing stopped. Console receives plain errors only. |

---

## 3. Verification Gates

We establish three mandatory Quality Control checkpoints. The implementation cannot advance past a gate without 100% compliance:

### 🛑 Gate 1: Architecture Sign-off (Current)
*   **Criteria**: The functional `spec.md` and technical `design.md` are approved by the lead architect and fully aligned with the `ROADMAP.md` and `docs/SDD.md`.
*   **Status**: **IN PROGRESS**

### 🛑 Gate 2: Logging and Metrics Unit & Integration Test Pass
*   **Criteria**:
    *   Winston configuration, transport handlers, and custom formatting filters verify 100% test coverage.
    *   Prometheus metrics registry initialization, custom counters, histograms, and cost calculator utilities are validated using unit testing blocks (mocking clock inputs and client parameters).
    *   Metrics endpoint exposes formatted payloads under `/metrics` without blocking system runtime threads.
*   **Status**: **PENDING**

### 🛑 Gate 3: Docker-Compose Infrastructure & Live Telemetry Sign-off
*   **Criteria**:
    *   Prometheus, Grafana, and backend Node.js API Gateway execute in harmony within `docker-compose.yml`.
    *   Scraping intervals execute every 15s without packet drops or timeout issues.
    *   E2E traffic simulation script run against `/suggest` validates that Grafana dashboards correctly map live data (throughput, latencies, caching success rates, token quantities, and pricing summaries in USD).
    *   Disk cap limits, zip compression, and log rotation files are fully verified inside the backend running container.
*   **Status**: **PENDING**
