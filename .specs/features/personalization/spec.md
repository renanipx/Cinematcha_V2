# Functional Specification (spec.md)
## EPIC-05: User Personalization & Experience

This document defines the functional and non-functional specifications for **EPIC-05: User Personalization & Experience** within the Cinematcha frontend SPA. It establishes the client-side state management architecture for search history persistence and watchlist favorites collection. The goal is to provide a premium, highly engaging user experience that allows users to instantly retrieve prior search queries and bookmark recommendations, surviving browser restarts and page refreshes with zero backend API overhead.

---

## 1. Requirement Catalog

We categorize all personalization and user experience requirements using traceable **Requirement IDs**:

### A. Client-Side Search History Persistence
*   **REQ-PERS-HIS-001 (History Buffer Capacity)**: The frontend application must maintain a search history buffer of **up to 10 historical searches**. Once the buffer reaches 10 items, any new successful search query must trigger a First-In, First-Out (FIFO) eviction of the oldest entry.
*   **REQ-PERS-HIS-002 (Payload Optimization & Payload Footprint)**: To conserve browser storage and improve retrieval performance, each history entry must store a optimized payload structure:
    *   `id`: Unique identifier (timestamp-based or hash of prompt).
    *   `prompt`: The exact natural language string queried by the user.
    *   `locale`: The active language interface used during the search (`en` or `pt`).
    *   `timestamp`: ISO-8601 string of when the query was successfully processed.
    *   `results`: Compact array of movie objects containing only essential fields (`id`, `title`, `poster`, `overview`, `year`, `rating`, `trailer`). All secondary fields (e.g. watch providers fetched on-demand) must be excluded from this payload to minimize the storage footprint.
*   **REQ-PERS-HIS-003 (Instant Cache-Bypass Reload)**: Clicking on a previous search history item must instantly load the saved query and its corresponding movie suggestions array directly into the active layout of `useMovies.ts`. This operation must be entirely client-side, bypassing backend server connections and Google Gemini/TMDB API requests.
*   **REQ-PERS-HIS-004 (Clear History Actions)**: The user interface must provide a "Clear History" action button in the "Previous Searches" panel. Clicking this button must clear all historical entries from both volatile state memory and browser persistent storage.

### B. Watchlist & Favorites Persistent Collection
*   **REQ-PERS-WAT-001 (Reactive Bookmarking)**: The frontend must display a bookmark/favorite action button on every movie suggestion card (in the list layout) and within the `MovieDetailsModal.vue`. The visual icon must dynamically toggle between a standard outlined bookmark icon (inactive state) and a vibrant gold-filled bookmark icon (active state).
*   **REQ-PERS-WAT-002 (Watchlist Capacity Guard)**: To ensure client storage boundaries are respected, the watchlist collection must cap at a maximum of **100 bookmarked movies**. If a user attempts to add a 101st bookmark, the system must show a micro-toast warning alert: *"Watchlist is full (max 100 movies). Please remove an item before adding another."*
*   **REQ-PERS-WAT-003 (Dynamic Multi-Component Sync)**: The bookmarking state must be reactive and globally synchronized across all components. Toggling a bookmark on a movie suggestion card must instantly update the active state of the same movie inside the details modal, other trending/popular lists, and the watchlist tab collection.
*   **REQ-PERS-WAT-004 (On-Demand Provider Refresh)**: Since watch provider details (streaming, rent, purchase) are highly dynamic and region-specific, the watchlist item must only persist core movie metadata. When a user opens a bookmarked movie from their watchlist, the application must query the backend API (`GET /suggest/tmdb/providers/:movieId`) on-demand to fetch real-time watch provider data.

### C. LocalStorage Persistence Architecture & Safety
*   **REQ-PERS-STO-001 (Isolated Key Namespacing)**: The application must store data under isolated, version-controlled namespaces to avoid collisions with other local assets or legacy variables:
    *   `cinematcha_search_history_v1`: Manages the search history buffer.
    *   `cinematcha_watchlist_v1`: Manages the bookmarked favorites list.
*   **REQ-PERS-STO-002 (Safe Storage Try-Catch Boundaries)**: All interactions with the browser's `LocalStorage` API must be wrapped in `try-catch` blocks. If `LocalStorage` is disabled, blocked (e.g. private browsing mode), or throws a `QuotaExceededError` due to local client disk full conditions:
    *   The application must fail gracefully, fallback to memory-only reactive states, and continue operating normally.
    *   A silent warning must be logged to the console, and a user-facing toast alert should show: *"Storage access limited. Changes will only persist during this session."*
*   **REQ-PERS-STO-003 (Persistence Bypass Switch)**: The composables must support a global runtime configuration or environment variable `VITE_DISABLE_PERSISTENCE=true`. When active, this flag must force the system to skip all `LocalStorage` writes and reads, using volatile in-memory arrays exclusively.

### D. SPA Navigation & Navigation Integration
*   **REQ-PERS-NAV-001 (Tab Navigation Extension)**: The global navigation tabs controller `useTabs.ts` must incorporate `'watchlist'` as a core, first-class active tab route alongside standard tabs (e.g. `'suggest'`, `'trending'`, `'popular'`).
*   **REQ-PERS-NAV-002 (Watchlist Tab Badge Count)**: The navigation tab element for "My Watchlist" must display a reactive, dynamic badge pill showing the exact number of active bookmarked items. The badge count must increment and decrement instantly in response to bookmark toggles.
*   **REQ-PERS-NAV-003 (Empty State Navigation UX)**: If the watchlist is empty, the tab view must render an engaging "empty state" panel showing a decorative bookmark graphic, a supportive text message (*"Your watchlist is empty! Start bookmarked movies you find in the search or trending tabs."*), and a CTA button (*"Explore Movies"*) that instantly routes the user back to the search tab.

### E. Premium UX Interaction & Micro-Animations
*   **REQ-PERS-UXI-001 (Micro-Interactions)**: Bookmark icons must incorporate premium micro-animations. Hovering over a bookmark button must trigger a scale up transition (`scale(1.15)`) over `150ms` using `cubic-bezier(0.4, 0, 0.2, 1)`. Toggling active state must trigger an elastic spring bounce (`scale(1.3) -> scale(1.0)`) to simulate tactile feedback.
*   **REQ-PERS-UXI-002 (Smooth Layout Transitions)**: Switching to the `'watchlist'` tab and rendering the list of saved search items must utilize Vue `<TransitionGroup>` layouts, executing smooth CSS fades and slides (`translateY(20px) -> translateY(0px)`) to avoid abrupt layout reflows.

---

## 2. Validation & Testing Criteria

To sign off on the implementation, the User Personalization features must satisfy the following validation matrices:

| Requirement ID | Test Vector (Input) | Expected Outcome (Response) |
| :--- | :--- | :--- |
| **REQ-PERS-HIS-001** | Perform 11 successful recommendation queries | The oldest search prompt (item 1) is automatically removed. The local storage contains exactly the 10 newest items. |
| **REQ-PERS-HIS-002** | Save a search query in `LocalStorage` | Inspection of `cinematcha_search_history_v1` confirms no watch provider arrays or deep structures are saved. Space is optimized. |
| **REQ-PERS-HIS-003** | Click on a saved search card in "Previous Searches" | Vue state is instantly updated with movie suggestions. Zero backend network traffic is observed in browser Developer Tools. |
| **REQ-PERS-HIS-004** | Click "Clear History" button | `cinematcha_search_history_v1` key is completely removed from storage. The UI panel disappears immediately. |
| **REQ-PERS-WAT-001** | Click empty bookmark icon on suggestion card | Icon immediately fills gold. Watchlist count badge increments by 1. Item appears in the Watchlist collection. |
| **REQ-PERS-WAT-002** | Attempt to add 101st bookmarked item | Toggle action is rejected. Alert toast *"Watchlist is full (max 100 movies)..."* renders, and badge remains at 100. |
| **REQ-PERS-WAT-003** | Toggle bookmark in `MovieDetailsModal` | The background movie suggestion card instantly syncs its bookmark icon status. No desynchronization occurs. |
| **REQ-PERS-WAT-004** | Open modal of a bookmarked movie from Watchlist tab | Client triggers `GET /suggest/tmdb/providers/:movieId` to fetch fresh watch options. Real-time options are displayed. |
| **REQ-PERS-STO-002** | Block storage permissions in browser (Private Mode) | Application starts and works normally. Volatile in-memory states manage bookmarks and history without console crashes. |
| **REQ-PERS-STO-003** | Set environment variable `VITE_DISABLE_PERSISTENCE=true` | Application bypasses `LocalStorage` operations entirely. Changes to bookmarks are kept in memory only. |
| **REQ-PERS-NAV-001** | Click on "My Watchlist" navigation tab | The layout coordinates active view swap. Tab updates using the established `useTabs.ts` system. |
| **REQ-PERS-NAV-002** | Add 3 items to watchlist | Navigation tab displays a vibrant gold circle badge with the number `3`. |
| **REQ-PERS-UXI-001** | Hover and click bookmark icon | Smooth transition displays golden outline scaling. Clicking triggers a pleasant visual spring effect on the bookmark icon. |

---

## 3. Verification Gates

We establish three mandatory Quality Control checkpoints. The implementation cannot advance past a gate without 100% compliance:

### 🛑 Gate 1: Architecture Sign-off (Current)
*   **Criteria**: The functional `spec.md` and technical `design.md` are approved by the lead architect and fully aligned with the `ROADMAP.md` and `docs/SDD.md`.
*   **Status**: **IN PROGRESS**

### 🛑 Gate 2: Reactive State & Storage Composable Unit Test Pass
*   **Criteria**:
    *   Storage serialization utility helpers (JSON formatting, quota checking, and boundary parsing) verify 100% test coverage.
    *   The personalization state composable (`useMovies.ts` or a supplementary `usePersonalization.ts`) is fully validated using unit testing blocks (e.g. `vitest` with mock `localStorage`).
    *   State operations (adding, removing, eviction, limits, and fallback triggers) verify zero regressions under simulated browser storage lockouts.
*   **Status**: **PENDING**

### 🛑 Gate 3: UI/UX Layout Integration & E2E Verification
*   **Criteria**:
    *   History panel and watchlist tab displays render perfectly on both desktop and mobile viewports.
    *   E2E automation test scripts (e.g. Cypress or Playwright) confirm that toggles, navigation tabs, empty states, and storage updates operate in harmony.
    *   CSS transitions and micro-interactions execute smoothly under 60fps frame rate budgets.
*   **Status**: **PENDING**
