import { ref } from 'vue';
import { api } from '../services/api';
import type { Movie } from '../services/api';
import { safeStorage } from '../utils/safe-storage';

export interface HistoryItem {
  query: string;
  locale: string;
}

const movieSuggestions = ref<Movie[]>([]);
const trendingMovies = ref<Movie[]>([]);
const popularMovies = ref<Movie[]>([]);
const watchlist = ref<Movie[]>([]);
const searchHistory = ref<HistoryItem[]>([]);

const isLoading = ref(false);
const isTrendingLoading = ref(false);
const isPopularLoading = ref(false);
const selectedMovie = ref<Movie | null>(null);
const providers = ref<any[]>([]);
const isProvidersLoading = ref(false);
const watchlistWarning = ref(false);
const streamError = ref<string | null>(null);

// Namespaces
const HISTORY_KEY = 'cinematcha_search_history_v1';
const WATCHLIST_KEY = 'cinematcha_watchlist_v1';

export function useMovies() {
  // Load initial data
  function initializeState() {
    searchHistory.value = safeStorage.getItem<HistoryItem[]>(HISTORY_KEY, []);
    watchlist.value = safeStorage.getItem<Movie[]>(WATCHLIST_KEY, []);
  }

  // Auto-init
  initializeState();

  async function suggestMovie(query: string, language: string) {
    if (!query.trim()) return;
    
    isLoading.value = true;
    streamError.value = null;
    movieSuggestions.value = [];

    await api.suggestMovies(
      query,
      language,
      // onTitles
      (titles) => {
        // Prepare skeleton cards for each title to create a high-fidelity staggered rendering effect
        movieSuggestions.value = titles.map((title, idx) => ({
          id: -1 - idx, // temporary negative IDs
          title,
          overview: 'Resolving AI recommendation and movie metadata details...',
          rating: 0
        }));
      },
      // onMovie
      (movie) => {
        // Find if this title is in the suggestions placeholders
        const idx = movieSuggestions.value.findIndex(
          (item) => item.title.toLowerCase() === movie.title.toLowerCase() || item.id < 0 && item.title === movie.title
        );

        if (idx !== -1) {
          // Replace placeholder skeleton card with rich TMDB details
          movieSuggestions.value[idx] = movie;
        } else {
          // Fallback append
          movieSuggestions.value.push(movie);
        }
      },
      // onDone
      () => {
        isLoading.value = false;
        // Save query to recent searches history buffer
        saveSearchToHistory(query, language);
      },
      // onError
      (err) => {
        console.error('Suggest stream failed:', err);
        streamError.value = err.message || 'Stream resolved with error';
        isLoading.value = false;
      }
    );
  }

  function saveSearchToHistory(query: string, locale: string) {
    const cleanQuery = query.trim();
    if (!cleanQuery) return;

    // Dedup: remove previous instance if it exists
    const filtered = searchHistory.value.filter(
      item => item.query.toLowerCase() !== cleanQuery.toLowerCase()
    );

    // Add to top (FIFO buffer)
    const newHistory = [{ query: cleanQuery, locale }, ...filtered];

    // Enforce max 10 entries limit
    if (newHistory.length > 10) {
      newHistory.pop();
    }

    searchHistory.value = newHistory;
    safeStorage.setItem(HISTORY_KEY, newHistory);
  }

  function clearHistory() {
    searchHistory.value = [];
    safeStorage.removeItem(HISTORY_KEY);
  }

  function toggleWatchlist(movie: Movie) {
    watchlistWarning.value = false;
    const existsIdx = watchlist.value.findIndex(m => m.id === movie.id);

    if (existsIdx !== -1) {
      // Remove from watchlist
      watchlist.value.splice(existsIdx, 1);
    } else {
      // Check strict 100 entries limit
      if (watchlist.value.length >= 100) {
        watchlistWarning.value = true;
        console.warn('[WATCHLIST] Watchlist is capped at 100 movies. Cannot add movie:', movie.title);
        return;
      }
      // Add to watchlist
      watchlist.value.push(movie);
    }

    safeStorage.setItem(WATCHLIST_KEY, watchlist.value);
  }

  function isBookmarked(movieId: number): boolean {
    return watchlist.value.some(m => m.id === movieId);
  }

  async function fetchTrending(language: string) {
    isTrendingLoading.value = true;
    try {
      trendingMovies.value = await api.getTrending(language);
    } catch (e) {
      console.error('Failed to fetch trending movies:', e);
    } finally {
      isTrendingLoading.value = false;
    }
  }

  async function fetchPopular(language: string) {
    isPopularLoading.value = true;
    try {
      popularMovies.value = await api.getPopular(language);
    } catch (e) {
      console.error('Failed to fetch popular movies:', e);
    } finally {
      isPopularLoading.value = false;
    }
  }

  async function fetchProviders(movieId: number, language: string) {
    isProvidersLoading.value = true;
    providers.value = [];
    try {
      // If the movie in suggestions already has providers, load them immediately as a cache optimization
      const movieInSuggestions = movieSuggestions.value.find(m => m.id === movieId);
      if (movieInSuggestions?.providers) {
        providers.value = movieInSuggestions.providers;
      } else {
        providers.value = await api.getProviders(movieId, language);
      }
    } catch (e) {
      console.error('Failed to fetch watch providers:', e);
    } finally {
      isProvidersLoading.value = false;
    }
  }

  function selectMovie(movie: Movie | null) {
    selectedMovie.value = movie;
    if (movie) {
      fetchProviders(movie.id, 'en'); // Load on-demand
    } else {
      providers.value = [];
    }
  }

  return {
    movieSuggestions,
    trendingMovies,
    popularMovies,
    watchlist,
    searchHistory,
    isLoading,
    isTrendingLoading,
    isPopularLoading,
    selectedMovie,
    providers,
    isProvidersLoading,
    watchlistWarning,
    streamError,
    suggestMovie,
    toggleWatchlist,
    isBookmarked,
    clearHistory,
    fetchTrending,
    fetchPopular,
    fetchProviders,
    selectMovie,
    initializeState
  };
}
