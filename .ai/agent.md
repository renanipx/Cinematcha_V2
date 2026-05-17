# Agent Operational Handbook (agent.md)

This document is the central operational runbook for **Antigravity** (and other AI development agents) in the Cinematcha repository. It bridges the architectural design defined in [docs/SDD.md](file:///d:/projetos/Cinematcha_V2/docs/SDD.md) with practical, day-to-day code generation and execution workflows.

---

## 1. Project Topology: Two Decoupled Projects

Cinematcha consists of two completely independent, decoupled projects running in separate directories:

### A. Frontend Project (`frontend/`)
* **Purpose**: Single Page Application (SPA) rendering the user interface, suggestions list, and trailer modals.
* **Technology**: Vue 3 (Composition API) + Vite.
* **Local Development Port**: **`5173`** (accessible at `http://localhost:5173`).
* **Environment Variable**: `VITE_API_URL` (points to the Backend API).

### B. Backend Project (`backend/`)
* **Purpose**: Orchestration layer & reverse proxy querying Google Gemini AI and The Movie Database (TMDB) API.
* **Technology**: Node.js + Express.js.
* **Local Development Port**: **`3001`** (accessible at `http://localhost:3001`).
* **Environment Variables**: `TMDB_API_KEY`, `TMDB_API_URL`, `GEMINI_API_KEY`, `PROMPT_EN`, `PROMPT_PT`.

---

## 2. SDD Blueprint Alignment & Architectural Constraints

When building or modifying features, you must align every line of code with the definitions in [docs/SDD.md](file:///d:/projetos/Cinematcha_V2/docs/SDD.md):

### A. Frontend Constraints (Vue 3, Vite)
* **Reactivity**: Encapsulated in reusable composables (e.g., `useMovies.ts`, `useLanguage.ts`, `useTabs.ts`). Keep views/templates thin.
* **Styling**: Direct, vanilla CSS in `frontend/src/assets/`. Do **NOT** install Tailwind or heavy UI frameworks. Use oklch/color-mix, fluid clamp() margins, and smooth expo transitions.
* **Localization**: Maintain complete `vue-i18n` support (`pt-BR` and `en` locales).

### B. Backend Constraints (Express.js, Node.js)
* **Design Pattern**: Controller-Service. Controllers parse payloads and forward to service layers. Centralized error handling returns consistent `{ error, message }` payloads with HTTP 500.
* **Statelessness**: The system is completely database-less. Maintain volatile state configurations only on the client browser.
* **Parallel Calls**: Optimize all TMDB details and trailer fetching per title using parallelized `Promise.all` sweeps.

---

## 3. Operational Runbook (Developer Commands)

### A. Step-by-Step Dependency Installation & Start

#### 1. Running the Backend (`backend/`)
To install dependencies and start the backend service on port **`3001`**:
```bash
# Navigate to backend directory
cd backend

# Install all backend packages
npm install

# Start the local Express server
npm run start
```

#### 2. Running the Frontend (`frontend/`)
To install dependencies and start the frontend development server on port **`5173`**:
```bash
# Navigate to frontend directory
cd frontend

# Install all frontend packages
npm install

# Run the Vite local development server
npm run dev
```

### B. Containerized Orchestration (Docker Compose)
To start both projects simultaneously, connected under a virtual bridge network (`app-network`) and exposing ports `5173` (front) and `3001` (back):
* **Start Container Stack**:
  ```bash
  docker-compose up --build
  ```
* **Stop Container Stack**:
  ```bash
  docker-compose down
  ```

### C. Testing & Verification
To execute backend test frameworks:
```bash
cd backend
npm run test
```

---

## 4. Local Skills Verification & Context Routing

You must load and adhere to the relevant "Skills" under the `.ai/skills/` directory depending on your task. Below are the verified paths for all active skill specifications:

### 1. Frontend Development & UI Reviews
* **Skill**: **Frontend Design**  
  *Path*: [SKILL.md](file:///d:/projetos/Cinematcha_V2/.ai/skills/frontend-design/SKILL.md)  
  *Context*: Load whenever adding visual elements, modals, styling transitions, or styling adjustments.
* **Skill**: **Web Design Guidelines**  
  *Path*: [SKILL.md](file:///d:/projetos/Cinematcha_V2/.ai/skills/web-design-guidelines/SKILL.md)  
  *Context*: Load to audit accessibility (ARIA, focus states) and HTML5 semantics.
* **Skill**: **Web Performance Optimization**  
  *Path*: [SKILL.md](file:///d:/projetos/Cinematcha_V2/.ai/skills/perf-web-optimization/SKILL.md)  
  *Context*: Load to prevent unnecessary DOM mutations and keep interactions highly responsive.

### 2. Logic Editing & Code Modification Rules
* **Skill**: **Coding Guidelines**  
  *Path*: [coding-guidelines.md](file:///d:/projetos/Cinematcha_V2/.ai/skills/coding-guidelines.md)  
  *Context*: Load before editing APIs, controllers, services, router setups, or executing refactorings.

### 3. System Prompting & Agentic Workflows
* **Skill**: **Skill Architect**  
  *Path*: [SKILL.md](file:///d:/projetos/Cinematcha_V2/.ai/skills/skill-architect/SKILL.md)  
  *Context*: Load when creating new skills, automation triggers, or configuring MCP schemas.

### 4. Code Delivery Gateways
* **Skill**: **Security Best Practices**  
  *Path*: [SKILL.md](file:///d:/projetos/Cinematcha_V2/.ai/skills/security-best-practices/SKILL.md)  
  *Context*: Load before declaring a task finished to ensure credentials remain isolated and inputs sanitized.
