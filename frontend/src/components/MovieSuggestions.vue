<script setup lang="ts">
import { ref } from 'vue';
import { useMovies } from '../composables/useMovies';
import { useLanguage } from '../composables/useLanguage';
import HistoryPanel from './HistoryPanel.vue';

const query = ref('');
const { movieSuggestions, isLoading, streamError, suggestMovie, toggleWatchlist, isBookmarked, selectMovie } = useMovies();
const { t, locale } = useLanguage();

async function handleSearch() {
  const q = query.value.trim();
  if (!q || isLoading.value) return;
  await suggestMovie(q, locale.value);
}

function handleSelectQuery(selected: string) {
  query.value = selected;
}
</script>

<template>
  <div class="suggestions-view">
    <!-- Search Bar -->
    <form @submit.prevent="handleSearch" class="search-form glass-panel animate-fade-in">
      <input
        v-model="query"
        type="text"
        :placeholder="t('searchPlaceholder')"
        class="search-input"
        :disabled="isLoading"
        required
      />
      <button type="submit" class="btn btn-primary btn-search spring-hover" :disabled="isLoading">
        <span v-if="isLoading" class="spinner-small"></span>
        <span v-else>{{ t('searchBtn') }}</span>
      </button>
    </form>

    <!-- History Panel Component -->
    <HistoryPanel @select-query="handleSelectQuery" />

    <!-- Error state -->
    <div v-if="streamError" class="error-panel glass-panel animate-fade-in">
      <p>{{ t('errorFallback') }}</p>
      <span class="error-msg">Details: {{ streamError }}</span>
    </div>

    <!-- Skeleton Loading State / Suggestions Grid -->
    <div class="results-container">
      <div v-if="isLoading && movieSuggestions.length === 0" class="loading-state">
        <div class="spinner-large"></div>
        <p>{{ t('loading') }}</p>
      </div>

      <!-- No suggestions prompt -->
      <div v-else-if="movieSuggestions.length === 0 && !isLoading" class="empty-results glass-panel animate-fade-in">
        <p>{{ t('noSuggestions') }}</p>
      </div>

      <!-- Suggestions Grid -->
      <div v-else class="movie-grid animate-fade-in">
        <div
          v-for="movie in movieSuggestions"
          :key="movie.id"
          class="movie-card glass-panel spring-hover"
          :class="{ 'skeleton-card': movie.id < 0 }"
          @click="movie.id >= 0 && selectMovie(movie)"
        >
          <div class="poster-container">
            <img
              v-if="movie.id >= 0"
              :src="movie.poster && movie.poster !== '/mock-poster.jpg' && movie.poster !== '/placeholder.jpg' ? movie.poster : 'https://images.unsplash.com/photo-1542204172-e7052809a850?auto=format&fit=crop&w=400&q=80'"
              :alt="movie.title"
              class="poster-img"
              loading="lazy"
            />
            <!-- Skeleton poster -->
            <div v-else class="skeleton-poster">
              <span class="skeleton-glow"></span>
            </div>

            <!-- Bookmark toggle icon -->
            <button
              v-if="movie.id >= 0"
              class="btn-bookmark spring-hover"
              :class="{ 'bookmarked': isBookmarked(movie.id) }"
              @click.stop="toggleWatchlist(movie)"
              title="Bookmark movie"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 21L12 16L5 21V5C5 4.46957 5.21071 3.96086 5.58579 3.58579C5.96086 3.21071 6.46957 3 7 3H17C17.5304 3 18.0391 3.21071 18.4142 3.58579C18.7893 3.96086 19 4.46957 19 5V21Z" />
              </svg>
            </button>
          </div>

          <div class="movie-info">
            <h4 class="movie-title">
              <span v-if="movie.id >= 0">{{ movie.title }}</span>
              <span v-else class="skeleton-text skeleton-glow" style="width: 80%"></span>
            </h4>
            <p class="movie-desc">
              <span v-if="movie.id >= 0">{{ movie.overview }}</span>
              <span v-else class="skeleton-text skeleton-glow" style="height: 40px; margin-top: 5px;"></span>
            </p>
            <div class="movie-meta" v-if="movie.id >= 0">
              <span class="movie-year" v-if="movie.year">{{ movie.year }}</span>
              <span class="movie-rating" v-if="movie.rating">
                <svg viewBox="0 0 24 24" fill="currentColor" class="star-icon">
                  <path d="M12 17.27L18.18 21L16.54 13.97L22 9.24L14.81 8.63L12 2L9.19 8.63L2 9.24L7.46 13.97L5.82 21L12 17.27Z"/>
                </svg>
                {{ movie.rating.toFixed(1) }}
              </span>
            </div>
            <!-- Skeleton meta -->
            <div class="movie-meta" v-else>
              <span class="skeleton-text skeleton-glow" style="width: 30%"></span>
              <span class="skeleton-text skeleton-glow" style="width: 20%"></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.suggestions-view {
  width: 100%;
}

.search-form {
  display: flex;
  gap: 1rem;
  padding: 0.75rem;
  margin-bottom: 1.5rem;
  width: 100%;
}

.search-input {
  flex-grow: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-family: var(--font-body);
  font-size: 1.05rem;
  padding: 0.5rem 1rem;
}

.search-input::placeholder {
  color: var(--text-muted);
}

.btn-search {
  min-width: 130px;
}

.error-panel {
  border: 1px solid var(--danger);
  background: rgba(220, 53, 69, 0.05);
  color: var(--text-primary);
  padding: 1.25rem;
  margin-bottom: 2rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.error-msg {
  color: var(--danger);
  font-size: 0.85rem;
  font-family: monospace;
}

.results-container {
  margin-top: 1rem;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 5rem 0;
  gap: 1.5rem;
}

.spinner-large {
  width: 50px;
  height: 50px;
  border: 4px solid rgba(255, 255, 255, 0.08);
  border-radius: 50%;
  border-top-color: var(--primary);
  animation: spin 1s linear infinite;
}

.spinner-small {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top-color: var(--bg-dark);
  animation: spin 1s linear infinite;
}

.empty-results {
  text-align: center;
  padding: 5rem 2rem;
  color: var(--text-secondary);
}

.movie-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
}

@media (min-width: 768px) {
  .movie-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.movie-card {
  cursor: pointer;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.movie-card.skeleton-card {
  cursor: default;
}

.poster-container {
  position: relative;
  width: 100%;
  aspect-ratio: 2/3;
  overflow: hidden;
}

.poster-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--transition-normal);
}

.movie-card:hover:not(.skeleton-card) .poster-img {
  transform: scale(1.05);
}

.skeleton-poster {
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.02);
  position: relative;
  overflow: hidden;
}

.btn-bookmark {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid var(--border-glass);
  color: rgba(255, 255, 255, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
  transition: all var(--transition-spring);
}

.btn-bookmark:hover {
  background: rgba(0, 0, 0, 0.85);
  transform: scale(1.1);
  color: var(--text-primary);
}

.btn-bookmark.bookmarked {
  color: var(--gold);
  background: rgba(0, 0, 0, 0.7);
  border-color: var(--gold);
  box-shadow: 0 0 10px var(--gold-glow);
  transform: scale(1.1);
}

.btn-bookmark.bookmarked:active {
  transform: scale(0.9);
}

.movie-info {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex-grow: 1;
}

.movie-title {
  font-family: var(--font-heading);
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.3;
  color: var(--text-primary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  height: 2.6rem;
}

.movie-desc {
  font-size: 0.8rem;
  color: var(--text-secondary);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  height: 3.3rem;
}

.movie-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.03);
}

.movie-year {
  font-size: 0.85rem;
  color: var(--text-muted);
  font-weight: 500;
}

.movie-rating {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--gold);
}

.star-icon {
  width: 14px;
  height: 14px;
}

/* Skeletons */
.skeleton-text {
  display: block;
  height: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}

.skeleton-glow {
  position: relative;
  overflow: hidden;
}

.skeleton-glow::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.04),
    transparent
  );
  transform: translateX(-100%);
  animation: shimmer 1.6s infinite;
}

@keyframes shimmer {
  100% { transform: translateX(100%); }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
