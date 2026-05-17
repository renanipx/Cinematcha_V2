<script setup lang="ts">
import { computed } from 'vue';
import { useMovies } from '../composables/useMovies';
import { useLanguage } from '../composables/useLanguage';

const { selectedMovie, toggleWatchlist, isBookmarked, selectMovie, providers, isProvidersLoading } = useMovies();
const { t } = useLanguage();

const embedUrl = computed(() => {
  if (!selectedMovie.value?.trailer) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = selectedMovie.value.trailer.match(regExp);
  if (match && match[2].length === 11) {
    return `https://www.youtube.com/embed/${match[2]}`;
  }
  return null;
});

const flatrateProviders = computed(() => providers.value.filter(p => p.type === 'flatrate'));
const rentProviders = computed(() => providers.value.filter(p => p.type === 'rent'));
const buyProviders = computed(() => providers.value.filter(p => p.type === 'buy'));
</script>

<template>
  <div v-if="selectedMovie" class="modal-overlay" @click.self="selectMovie(null)">
    <div class="modal-content glass-panel animate-fade-in">
      <button class="btn-close spring-hover" @click="selectMovie(null)" aria-label="Close modal">
        &times;
      </button>

      <!-- Trailer Player -->
      <div class="trailer-wrapper" v-if="embedUrl">
        <iframe
          :src="embedUrl"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
        ></iframe>
      </div>
      <!-- Poster Fallback in modal if no trailer exists -->
      <div class="modal-header-hero" v-else>
        <img
          :src="selectedMovie.poster && selectedMovie.poster !== '/mock-poster.jpg' && selectedMovie.poster !== '/placeholder.jpg' ? selectedMovie.poster : 'https://images.unsplash.com/photo-1542204172-e7052809a850?auto=format&fit=crop&w=800&q=80'"
          :alt="selectedMovie.title"
          class="hero-poster"
        />
        <div class="hero-overlay"></div>
      </div>

      <div class="modal-body">
        <div class="movie-header">
          <h2 class="movie-title">{{ selectedMovie.title }}</h2>
          <div class="movie-meta-bar">
            <span class="meta-year" v-if="selectedMovie.year">{{ selectedMovie.year }}</span>
            <span class="meta-rating" v-if="selectedMovie.rating">
              <svg viewBox="0 0 24 24" fill="currentColor" class="star-icon">
                <path d="M12 17.27L18.18 21L16.54 13.97L22 9.24L14.81 8.63L12 2L9.19 8.63L2 9.24L7.46 13.97L5.82 21L12 17.27Z"/>
              </svg>
              {{ selectedMovie.rating.toFixed(1) }}
            </span>
            <button
              class="btn btn-secondary btn-watchlist-toggle spring-hover"
              :class="{ 'watchlist-active': isBookmarked(selectedMovie.id) }"
              @click="toggleWatchlist(selectedMovie)"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" class="bookmark-icon">
                <path d="M19 21L12 16L5 21V5C5 4.46957 5.21071 3.96086 5.58579 3.58579C5.96086 3.21071 6.46957 3 7 3H17C17.5304 3 18.0391 3.21071 18.4142 3.58579C18.7893 3.96086 19 4.46957 19 5V21Z" />
              </svg>
              {{ isBookmarked(selectedMovie.id) ? t('removeFromWatchlist') : t('addToWatchlist') }}
            </button>
          </div>
        </div>

        <p class="movie-overview">{{ selectedMovie.overview }}</p>

        <!-- Watch Providers Section -->
        <div class="providers-section">
          <h3>{{ t('providersTitle') }}</h3>
          
          <div v-if="isProvidersLoading" class="providers-loading">
            <span class="spinner"></span>
          </div>

          <div v-else-if="providers.length > 0" class="providers-groups">
            <!-- Flatrate (Stream) -->
            <div class="provider-group" v-if="flatrateProviders.length > 0">
              <span class="group-label">Stream</span>
              <div class="providers-list">
                <a
                  v-for="prov in flatrateProviders"
                  :key="prov.name"
                  :href="prov.url"
                  target="_blank"
                  rel="noopener"
                  class="provider-item spring-hover"
                  :title="prov.name"
                >
                  <img :src="prov.icon ? prov.icon : 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?auto=format&fit=crop&w=40&q=80'" :alt="prov.name" class="provider-logo" />
                </a>
              </div>
            </div>

            <!-- Rent -->
            <div class="provider-group" v-if="rentProviders.length > 0">
              <span class="group-label">Rent</span>
              <div class="providers-list">
                <a
                  v-for="prov in rentProviders"
                  :key="prov.name"
                  :href="prov.url"
                  target="_blank"
                  rel="noopener"
                  class="provider-item spring-hover"
                  :title="prov.name"
                >
                  <img :src="prov.icon ? prov.icon : 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?auto=format&fit=crop&w=40&q=80'" :alt="prov.name" class="provider-logo" />
                </a>
              </div>
            </div>

            <!-- Buy -->
            <div class="provider-group" v-if="buyProviders.length > 0">
              <span class="group-label">Buy</span>
              <div class="providers-list">
                <a
                  v-for="prov in buyProviders"
                  :key="prov.name"
                  :href="prov.url"
                  target="_blank"
                  rel="noopener"
                  class="provider-item spring-hover"
                  :title="prov.name"
                >
                  <img :src="prov.icon ? prov.icon : 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?auto=format&fit=crop&w=40&q=80'" :alt="prov.name" class="provider-logo" />
                </a>
              </div>
            </div>
          </div>
          
          <div v-else class="no-providers">
            <span>Unavailable for streaming in your region. Check TMDB for details.</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(12px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}

.modal-content {
  position: relative;
  width: 100%;
  max-width: 750px;
  max-height: 90vh;
  overflow-y: auto;
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  background: var(--bg-darker);
  border: 1px solid var(--border-glass-focus);
}

.btn-close {
  position: absolute;
  top: 15px;
  right: 15px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid var(--border-glass);
  color: var(--text-primary);
  font-size: 1.5rem;
  font-weight: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 100;
}

.btn-close:hover {
  background: var(--danger);
  border-color: var(--danger);
}

.trailer-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 16/9;
  background: #000;
}

.trailer-wrapper iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.modal-header-hero {
  position: relative;
  width: 100%;
  height: 250px;
  overflow: hidden;
}

.hero-poster {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 20%;
}

.hero-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 120px;
  background: linear-gradient(to top, var(--bg-darker), transparent);
}

.modal-body {
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.movie-header {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.movie-title {
  font-family: var(--font-heading);
  font-size: 2rem;
  font-weight: 800;
  line-height: 1.2;
}

.movie-meta-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1.25rem;
}

.meta-year {
  color: var(--text-secondary);
  font-weight: 600;
}

.meta-rating {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--gold);
  font-weight: 700;
}

.star-icon {
  width: 18px;
  height: 18px;
}

.btn-watchlist-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  font-size: 0.85rem;
}

.bookmark-icon {
  width: 14px;
  height: 14px;
}

.watchlist-active {
  color: var(--gold) !important;
  border-color: var(--gold) !important;
}

.movie-overview {
  color: var(--text-secondary);
  line-height: 1.6;
  font-size: 1rem;
}

.providers-section {
  border-top: 1px solid var(--border-glass);
  padding-top: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.providers-section h3 {
  font-family: var(--font-heading);
  font-size: 1.2rem;
  font-weight: 700;
}

.providers-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem 0;
}

.spinner {
  width: 28px;
  height: 28px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  border-top-color: var(--primary);
  animation: spin 1s ease infinite;
}

.providers-groups {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.provider-group {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.group-label {
  width: 80px;
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-muted);
}

.providers-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.provider-item {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid var(--border-glass);
}

.provider-logo {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.no-providers {
  color: var(--text-muted);
  font-size: 0.9rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
