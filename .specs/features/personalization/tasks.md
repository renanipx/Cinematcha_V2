# Actionable Implementation Checklist (tasks.md)
## EPIC-05: User Personalization & Experience

This document is the official implementation task registry for **EPIC-05: User Personalization & Experience**. It breaks the technical specifications and design considerations down into atomic, independent, and verifiable checklist units.

---

## Task List Matrix

### 📦 Task Group 1: Utilities & Safe Persistence Layer

*   **TSK-PERS-STO-001**: Implement Safe Browser Storage Engine:
    *   **Action**: Create the browser storage serialization helper `safe-storage.ts`. The utility must support safe `setItem`, `getItem`, and `removeItem` wrappers, trap serialization failures with robust try-catch boundaries, diagnose storage quota exhaustions (`QuotaExceededError`), and check for persistence bypass env flags.
    *   **Affected Files**: 
        *   `frontend/src/utils/safe-storage.ts` *[NEW]*
    *   **Dependencies**: None
    *   **Testing Strategy**:
        *   Unit test: Mount helper in a test harness. Verify that saving standard strings and JSON models parses correctly.
        *   Test Quota: Simulate a `QuotaExceededError` in a mock test block. Assert the helper catches the exception and returns `false` without throwing fatal system errors.
        *   Test Bypass: Mock `import.meta.env.VITE_DISABLE_PERSISTENCE = 'true'` and assert that all writes return `false` and reads return `null`.
    *   **UI Validation Criteria**: None.
    *   **Rollback Notes**: Delete the new file `safe-storage.ts` and discard imports.

---

### 🧠 Task Group 2: State Management & Composables Integration

*   **TSK-PERS-COM-001**: Extend Movies State Composable:
    *   **Action**: Update `useMovies.ts` to implement personalization state management. Introduce reactive arrays `searchHistory` and `watchlist`. Bind core operations: `isBookmarked(movieId)`, `saveSearchToHistory(prompt, locale, results)`, `loadHistoryQuery(historyId)`, `toggleWatchlist(movie)`, and `clearSearchHistory()`. Integrate Safe Storage reads during setup.
    *   **Affected Files**: 
        *   [useMovies.ts](file:///d:/projetos/Cinematcha_V2/frontend/src/composables/useMovies.ts)
    *   **Dependencies**: TSK-PERS-STO-001
    *   **Testing Strategy**:
        *   Unit test: Mount `useMovies` using `vitest`. Call `saveSearchToHistory` 11 times. Confirm that the array contains exactly the 10 newest items (evicting the oldest prompt).
        *   Unit test: Verify that toggling a bookmark on a new movie inserts it into the `watchlist` array and saves it to local storage. Toggling again must remove it.
        *   Mock: Block `SafeStorage` and verify that the composable operates cleanly in volatile RAM memory mode.
    *   **UI Validation Criteria**: None.
    *   **Rollback Notes**: Discard all modifications made to `useMovies.ts`.

*   **TSK-PERS-COM-002**: Extend Tabs Composable Navigation Binds:
    *   **Action**: Modify the tabs composable `useTabs.ts` to include `'watchlist'` in the array list of active tab routes.
    *   **Affected Files**: 
        *   [useTabs.ts](file:///d:/projetos/Cinematcha_V2/frontend/src/composables/useTabs.ts)
    *   **Dependencies**: None
    *   **Testing Strategy**:
        *   Unit test: Set `activeTab.value = 'watchlist'` in a test harness and verify the state updates cleanly.
    *   **UI Validation Criteria**: None.
    *   **Rollback Notes**: Discard modifications in `useTabs.ts`.

---

### 🎨 Task Group 3: Core Personalization UI Components

*   **TSK-PERS-UI-001**: Create Search History Panel Component:
    *   **Action**: Create the `HistoryPanel.vue` component. It must render horizontal scrolling tag pills displaying previous searches. Pills must be clickable to trigger reload, display active locale tags (e.g. `[EN]` or `[PT]`), and contain an action link to clear all history.
    *   **Affected Files**: 
        *   `frontend/src/components/HistoryPanel.vue` *[NEW]*
    *   **Dependencies**: TSK-PERS-COM-001
    *   **Testing Strategy**:
        *   Component test: Mount `HistoryPanel.vue` with populated historical items. Confirm that item tags display correct prompt text strings.
        *   Mock: Simulate a click on a pill and verify that it calls `loadHistoryQuery` with the correct item ID.
        *   Mock: Click the "Clear History" button and verify it triggers `clearSearchHistory` in the composable.
    *   **UI Validation Criteria**:
        *   Render style: Sleek tag pills with subtle borders and smooth hover fades.
        *   Horizontal scrolling container with clean overflow styling (no coarse browser scrollbars).
        *   Fade transition on history item removals.
    *   **Rollback Notes**: Delete `HistoryPanel.vue`.

*   **TSK-PERS-UI-002**: Create Watchlist Tab Component:
    *   **Action**: Create the `WatchlistTab.vue` component. It must render bookmarked favorites in a responsive CSS grid of movie cards. Include custom empty-state layouts displaying bookmark vector graphics, helpful helper labels, and a call-to-action button that switches back to the search tab.
    *   **Affected Files**: 
        *   `frontend/src/components/WatchlistTab.vue` *[NEW]*
    *   **Dependencies**: TSK-PERS-COM-001, TSK-PERS-COM-002
    *   **Testing Strategy**:
        *   Component test: Mount `WatchlistTab.vue` with an empty watchlist. Confirm the empty-state graphics and "Explore Movies" CTA display correctly.
        *   Component test: Mount with 3 movie entries. Verify the cards render correct titles, poster images, ratings, and active gold bookmark indicators.
        *   Mock: Click the "Explore Movies" CTA and verify it triggers the tab switch to `'suggest'`.
    *   **UI Validation Criteria**:
        *   CSS Grid: 2 columns on mobile, 4 columns on desktop viewports.
        *   Vibrant gold bookmark indicators.
        *   Responsive empty-state layout with high-contrast text and sleek button styling.
    *   **Rollback Notes**: Delete `WatchlistTab.vue`.

---

### 🖼️ Task Group 4: Layout & View Integration

*   **TSK-PERS-LAY-001**: Mount Personalization Panels inside App Frame:
    *   **Action**: Integrate `HistoryPanel.vue` and `WatchlistTab.vue` inside `App.vue`. Update navigation headers to include the "My Watchlist" tab button, featuring a dynamic count badge.
    *   **Affected Files**: 
        *   [App.vue](file:///d:/projetos/Cinematcha_V2/frontend/src/App.vue)
    *   **Dependencies**: TSK-PERS-UI-001, TSK-PERS-UI-002
    *   **Testing Strategy**:
        *   E2E: Launch Vite development server. Click between "Search", "Trending", "Popular", and "My Watchlist" tabs, verifying layout changes cleanly.
        *   Verification: Assert that adding an item to the watchlist increments the badge count instantly in the navigation bar.
    *   **UI Validation Criteria**:
        *   Navigation tab: Displays the text "My Watchlist" with a dynamic badge pill in a sleek gold circle (`background-color: #ffd700; color: #1e1e1e; font-weight: bold;`).
        *   Layout alignment: History panel fits perfectly below search inputs without pushing suggestions off-screen.
    *   **Rollback Notes**: Discard modifications in `App.vue`.

*   **TSK-PERS-LAY-002**: Integrate Bookmark Action Binds on Cards & Modals:
    *   **Action**: Mount bookmark toggle icons on movie cards within `MovieSuggestions.vue` and the main detailed dialog `MovieDetailsModal.vue`. Connect actions to `toggleWatchlist` and bind visual state dynamically using `isBookmarked`.
    *   **Affected Files**: 
        *   [MovieSuggestions.vue](file:///d:/projetos/Cinematcha_V2/frontend/src/components/MovieSuggestions.vue)
        *   [MovieDetailsModal.vue](file:///d:/projetos/Cinematcha_V2/frontend/src/components/MovieDetailsModal.vue)
    *   **Dependencies**: TSK-PERS-COM-001
    *   **Testing Strategy**:
        *   E2E: Perform a search. Click the bookmark icon on a suggestion card. Verify it immediately turns gold.
        *   E2E: Open the movie details modal for the bookmarked card. Verify that the bookmark button inside the modal reflects the active (gold) state.
        *   E2E: Click "Remove Bookmark" inside the modal. Close the modal, and verify the card icon has returned to the outlined state.
    *   **UI Validation Criteria**:
        *   Icon style: Outlined bookmark icon in passive state (`color: #888888;`). Golden bookmark icon in active state (`color: #ffd700;`).
        *   Micro-animation: Elastic spring scale transitions on state toggle.
    *   **Rollback Notes**: Revert changes in `MovieSuggestions.vue` and `MovieDetailsModal.vue`.

---

### 🎨 Task Group 5: Premium Interaction Polish & Verification

*   **TSK-PERS-UX-001**: Apply CSS Animations & E2E Validation:
    *   **Action**: Polish transitions on cards list view and history item removals. Perform global testing across mobile browsers, private modes, and full storage blocks, certifying that the personalization engine behaves safely and smoothly.
    *   **Affected Files**: None (Styling and verification only)
    *   **Dependencies**: All previous implementation tasks (TSK-PERS-STO-001 through TSK-PERS-LAY-002)
    *   **Testing Strategy**:
        *   UX check: Verify CSS hover states on buttons trigger 150ms bezier transitions.
        *   Resilience test: Simulate a complete LocalStorage blockage in browser settings. Confirm the application boots, permits search queries, allows watchlist clicks, and falls back to transient in-memory operations with zero errors.
        *   Performance check: Run Lighthouse or Chrome Performance profile. Confirm tab switches and search reloads execute with zero lag and maintain 60 FPS transitions.
    *   **UI Validation Criteria**:
        *   Micro-interaction: Smooth hover scale up (`scale(1.15)`) and elastic spring bounce (`scale(1.3) -> scale(1.0)`) on active toggle.
        *   Tab transitions: Fade-in animation when entering the Watchlist tab.
    *   **Rollback Notes**: None.
