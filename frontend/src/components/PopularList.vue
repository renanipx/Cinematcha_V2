<script setup lang="ts">
import { onMounted } from 'vue';
import { useMovies } from '../composables/useMovies';
import { useLanguage } from '../composables/useLanguage';

const { popularMovies, isPopularLoading, fetchPopular, toggleWatchlist, isBookmarked, selectMovie } = useMovies();
const { t, locale } = useLanguage();

onMounted(() => {
  fetchPopular(locale.value);
});
</script>

<template>
  <div class="popular-view animate-fade-in">
    <h2 class="section-title">{{ t('popularTab') }}</h2>

    <div v-if="isPopularLoading" class="loading-state">
      <div class="spinner"></div>
    </div>

    <div v-else class="movie-grid">
      <div
        v-for="movie in popularMovies"
        :key="movie.id"
        class="movie-card glass-panel spring-hover"
        @click="selectMovie(movie)"
      >
        <div class="poster-container">
          <img
            :src="movie.poster ? movie.poster : 'https://images.unsplash.com/photo-1542204172-e7052809a850?auto=format&fit=crop&w=400&q=80'"
            :alt="movie.title"
            class="poster-img"
            loading="lazy"
          />
          <button
            class="btn-bookmark spring-hover"
            :class="{ 'bookmarked': isBookmarked(movie.id) }"
            @click.stop="toggleWatchlist(movie)"
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
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
.section-title {
  font-family: var(--font-heading);
  font-size: 1.8rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: 5rem 0;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(255, 255, 255, 0.08);
  border-radius: 50%;
  border-top-color: var(--primary);
  animation: spin 1s linear infinite;
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

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
