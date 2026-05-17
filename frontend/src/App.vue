<script setup lang="ts">
import { useTabs } from './composables/useTabs';
import { useLanguage } from './composables/useLanguage';
import { useMovies } from './composables/useMovies';

import MovieSuggestions from './components/MovieSuggestions.vue';
import TrendingList from './components/TrendingList.vue';
import PopularList from './components/PopularList.vue';
import WatchlistTab from './components/WatchlistTab.vue';
import MovieDetailsModal from './components/MovieDetailsModal.vue';

const { activeTab, setTab } = useTabs();
const { t, locale, setLanguage } = useLanguage();
const { watchlist, watchlistWarning } = useMovies();
</script>

<template>
  <div class="app-layout">
    <!-- Header -->
    <header class="app-header animate-fade-in">
      <div class="header-logo">
        <h1 class="gradient-accent-text">{{ t('title') }}</h1>
        <p class="subtitle">{{ t('subtitle') }}</p>
      </div>

      <!-- Language selector dropdown -->
      <div class="header-controls">
        <div class="language-dropdown glass-panel">
          <button
            class="lang-btn"
            :class="{ active: locale === 'en' }"
            @click="setLanguage('en')"
          >
            EN
          </button>
          <div class="divider"></div>
          <button
            class="lang-btn"
            :class="{ active: locale === 'pt' }"
            @click="setLanguage('pt')"
          >
            PT
          </button>
        </div>
      </div>
    </header>

    <!-- Navigation Tabs -->
    <nav class="navigation-tabs glass-panel animate-fade-in">
      <button
        class="tab-link"
        :class="{ active: activeTab === 'suggest' }"
        @click="setTab('suggest')"
      >
        AI Match
      </button>
      <button
        class="tab-link"
        :class="{ active: activeTab === 'trending' }"
        @click="setTab('trending')"
      >
        {{ t('trendingTab') }}
      </button>
      <button
        class="tab-link"
        :class="{ active: activeTab === 'popular' }"
        @click="setTab('popular')"
      >
        {{ t('popularTab') }}
      </button>
      <button
        class="tab-link watchlist-tab"
        :class="{ active: activeTab === 'watchlist' }"
        @click="setTab('watchlist')"
      >
        {{ t('watchlistTab') }}
        <span v-if="watchlist.length > 0" class="badge badge-gold badge-tab animate-pulse">
          {{ watchlist.length }}
        </span>
      </button>
    </nav>

    <!-- Main View Routing -->
    <main class="main-content">
      <MovieSuggestions v-if="activeTab === 'suggest'" />
      <TrendingList v-else-if="activeTab === 'trending'" />
      <PopularList v-else-if="activeTab === 'popular'" />
      <WatchlistTab v-else-if="activeTab === 'watchlist'" />
    </main>

    <!-- Toast Warning Alert for Watchlist Limit Exceeded -->
    <Transition name="toast">
      <div v-if="watchlistWarning" class="warning-toast glass-panel" @click="watchlistWarning = false">
        <svg viewBox="0 0 24 24" fill="currentColor" class="warning-icon">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
        </svg>
        <span class="warning-text">{{ t('warningLimit') }}</span>
        <button class="btn-dismiss">&times;</button>
      </div>
    </Transition>

    <!-- Global Movie Detail Modal overlay -->
    <MovieDetailsModal />
  </div>
</template>

<style>
/* Layout Styles */
.app-layout {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  width: 100%;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1.5rem;
}

.header-logo h1 {
  font-size: 2.6rem;
  font-weight: 800;
  letter-spacing: -1px;
}

.header-logo .subtitle {
  color: var(--text-secondary);
  font-size: 1rem;
  margin-top: 0.25rem;
  font-weight: 500;
}

.language-dropdown {
  display: flex;
  padding: 0.25rem;
  border-radius: 50px !important;
}

.lang-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-family: var(--font-heading);
  font-size: 0.8rem;
  font-weight: 700;
  padding: 0.4rem 0.8rem;
  cursor: pointer;
  border-radius: 50px;
  transition: all var(--transition-fast);
}

.lang-btn.active {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
}

.language-dropdown .divider {
  width: 1px;
  background: var(--border-glass);
  margin: 0.25rem 0;
}

.navigation-tabs {
  display: flex;
  padding: 0.4rem;
  border-radius: var(--radius-lg) !important;
  width: 100%;
  overflow-x: auto;
  gap: 0.25rem;
}

.tab-link {
  flex-grow: 1;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-family: var(--font-heading);
  font-size: 0.95rem;
  font-weight: 600;
  padding: 0.8rem 1.2rem;
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: all var(--transition-normal);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  white-space: nowrap;
}

.tab-link:hover {
  background: rgba(255, 255, 255, 0.03);
  color: var(--text-primary);
}

.tab-link.active {
  background: var(--bg-card-hover);
  color: var(--primary);
  border: 1px solid var(--border-glass);
}

.watchlist-tab {
  position: relative;
}

.badge-tab {
  font-size: 0.7rem;
  padding: 0.1rem 0.4rem;
}

.main-content {
  width: 100%;
}

/* Toast styling */
.warning-toast {
  position: fixed;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(10, 9, 11, 0.9) !important;
  border: 1px solid var(--danger) !important;
  border-radius: var(--radius-md) !important;
  padding: 1rem 1.5rem;
  box-shadow: 0 10px 40px rgba(220, 53, 69, 0.25);
  display: flex;
  align-items: center;
  gap: 1rem;
  z-index: 2000;
  cursor: pointer;
  max-width: 90vw;
  width: max-content;
}

.warning-icon {
  width: 24px;
  height: 24px;
  color: var(--danger);
  flex-shrink: 0;
}

.warning-text {
  color: var(--text-primary);
  font-size: 0.9rem;
  font-weight: 600;
}

.btn-dismiss {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 1.2rem;
  cursor: pointer;
  line-height: 1;
}

/* Toast Transitions */
.toast-enter-active {
  animation: slideUp var(--transition-spring);
}
.toast-leave-active {
  animation: slideUp var(--transition-fast) reverse;
}

@keyframes slideUp {
  from { transform: translate(-50%, 100px); opacity: 0; }
  to { transform: translate(-50%, 0); opacity: 1; }
}
</style>
