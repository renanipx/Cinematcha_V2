<script setup lang="ts">
import { useMovies } from '../composables/useMovies';
import { useLanguage } from '../composables/useLanguage';
import { useTabs } from '../composables/useTabs';

const { watchlist, toggleWatchlist, selectMovie } = useMovies();
const { t } = useLanguage();
const { setTab } = useTabs();
</script>

<template>
  <div class="watchlist-container animate-fade-in">
    <h2 class="section-title">
      {{ t('watchlistTab') }}
      <span class="badge badge-gold">{{ watchlist.length }}</span>
    </h2>

    <!-- Empty State -->
    <div v-if="watchlist.length === 0" class="empty-state glass-panel">
      <!-- High fidelity movie SVG -->
      <svg class="empty-icon animate-pulse" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M7 3H17C19.2091 3 21 4.79086 21 7V17C21 19.2091 19.2091 21 17 21H7C4.79086 21 3 19.2091 3 17V7C3 4.79086 4.79086 3 7 3Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M7 3V21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M17 3V21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M3 7H7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M3 12H7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M3 17H7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M17 7H21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M17 12H21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M17 17H21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M10 9L15 12L10 15V9Z" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <h3>{{ t('watchlistEmpty') }}</h3>
      <p>{{ t('watchlistGuide') }}</p>
      <button class="btn btn-primary spring-hover" @click="setTab('suggest')">
        {{ t('backToSearch') }}
      </button>
    </div>

    <!-- Movie Grid -->
    <div v-else class="watchlist-grid">
      <div
        v-for="movie in watchlist"
        :key="movie.id"
        class="movie-card glass-panel spring-hover"
        @click="selectMovie(movie)"
      >
        <div class="poster-container">
          <img
            :src="movie.poster && movie.poster !== '/mock-poster.jpg' && movie.poster !== '/placeholder.jpg' ? movie.poster : 'https://images.unsplash.com/photo-1542204172-e7052809a850?auto=format&fit=crop&w=400&q=80'"
            :alt="movie.title"
            class="poster-img"
            loading="lazy"
          />
          <button
            class="btn-bookmark active spring-hover"
            @click.stop="toggleWatchlist(movie)"
            title="Remove from watchlist"
          >
            <!-- Bookmark filled icon -->
            <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 21L12 16L5 21V5C5 4.46957 5.21071 3.96086 5.58579 3.58579C5.96086 3.21071 6.46957 3 7 3H17C17.5304 3 18.0391 3.21071 18.4142 3.58579C18.7893 3.96086 19 4.46957 19 5V21Z" />
            </svg>
          </button>
        </div>
        <div class="movie-info">
          <h4 class="movie-title">{{ movie.title }}</h4>
          <div class="movie-meta">
            <span class="movie-year" v-if="movie.year">{{ movie.year }}</span>
            <span class="movie-rating" v-if="movie.rating">
              <svg viewBox="0 0 24 24" fill="currentColor" class="star-icon">
                <path d="M12 17.27L18.18 21L16.54 13.97L22 9.24L14.81 8.63L12 2L9.19 8.63L2 9.24L7.46 13.97L5.82 21L12 17.27Z"/>
              </svg>
              {{ movie.rating.toFixed(1) }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.watchlist-container {
  margin-top: 1rem;
}

.section-title {
  font-family: var(--font-heading);
  font-size: 1.8rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
  gap: 1.25rem;
  max-width: 600px;
  margin: 2rem auto;
}

.empty-icon {
  width: 80px;
  height: 80px;
  color: var(--text-muted);
}

.empty-state h3 {
  font-family: var(--font-heading);
  font-size: 1.4rem;
  font-weight: 600;
}

.empty-state p {
  color: var(--text-secondary);
  max-width: 400px;
  line-height: 1.5;
  font-size: 0.95rem;
}

.watchlist-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
}

@media (min-width: 768px) {
  .watchlist-grid {
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

.movie-card:hover .poster-img {
  transform: scale(1.05);
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
  color: var(--text-secondary);
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
}

.btn-bookmark.active {
  color: var(--gold);
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
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  height: 2.6rem;
  color: var(--text-primary);
}

.movie-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
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

@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.05); opacity: 1; }
}

.animate-pulse {
  animation: pulse 3s infinite ease-in-out;
}
</style>
