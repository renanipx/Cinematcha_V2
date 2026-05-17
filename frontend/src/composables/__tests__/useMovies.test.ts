import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMovies } from '../useMovies';
import { safeStorage } from '../../utils/safe-storage';

vi.mock('../../utils/safe-storage', () => {
  let mockStore: Record<string, any> = {};
  return {
    safeStorage: {
      getItem: vi.fn((key: string, defaultValue: any) => {
        return mockStore[key] !== undefined ? mockStore[key] : defaultValue;
      }),
      setItem: vi.fn((key: string, value: any) => {
        mockStore[key] = value;
        return true;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStore[key];
        return true;
      })
    }
  };
});

vi.mock('../../services/api', () => {
  return {
    api: {
      suggestMovies: vi.fn((_prompt, _locale, onTitles, onMovie, onDone, _onError) => {
        onTitles(['Interstellar', 'Inception']);
        onMovie({ id: 1, title: 'Interstellar', rating: 8.5 });
        onMovie({ id: 2, title: 'Inception', rating: 8.4 });
        onDone();
        return Promise.resolve();
      }),
      getTrending: vi.fn(() => Promise.resolve([])),
      getPopular: vi.fn(() => Promise.resolve([])),
      getProviders: vi.fn(() => Promise.resolve([]))
    }
  };
});

describe('useMovies Composable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const { initializeState, watchlist, searchHistory } = useMovies();
    initializeState();
    watchlist.value = [];
    searchHistory.value = [];
  });

  it('should initialize empty suggestions, history, and watchlist', () => {
    const { movieSuggestions, watchlist, searchHistory } = useMovies();
    expect(movieSuggestions.value).toEqual([]);
    expect(watchlist.value).toEqual([]);
    expect(searchHistory.value).toEqual([]);
  });

  it('should execute suggestions stream and populate suggestions and search history', async () => {
    const { movieSuggestions, searchHistory, suggestMovie } = useMovies();
    
    await suggestMovie('time travel', 'en');

    // Suggestions should contain resolved movies
    expect(movieSuggestions.value.length).toBe(2);
    expect(movieSuggestions.value[0].title).toBe('Interstellar');
    expect(movieSuggestions.value[1].title).toBe('Inception');

    // Search history should contain the query
    expect(searchHistory.value.length).toBe(1);
    expect(searchHistory.value[0]).toEqual({ query: 'time travel', locale: 'en' });
    expect(safeStorage.setItem).toHaveBeenCalledWith('cinematcha_search_history_v1', searchHistory.value);
  });

  it('should enforce strict FIFO limit of 10 search history items', async () => {
    const { searchHistory, suggestMovie, clearHistory } = useMovies();
    clearHistory();

    // Perform 11 searches
    for (let i = 1; i <= 11; i++) {
      await suggestMovie(`query_${i}`, 'en');
    }

    // History should only retain the 10 most recent queries
    expect(searchHistory.value.length).toBe(10);
    expect(searchHistory.value[0].query).toBe('query_11');
    expect(searchHistory.value[9].query).toBe('query_2');
    expect(searchHistory.value.some(h => h.query === 'query_1')).toBe(false);
  });

  it('should toggle watchlist items and enforce strict 100 limit', () => {
    const { watchlist, toggleWatchlist, isBookmarked, watchlistWarning } = useMovies();
    
    watchlist.value = [];
    watchlistWarning.value = false;

    const movie: any = { id: 42, title: 'Hitchhiker Guide' };
    
    // Add to watchlist
    toggleWatchlist(movie);
    expect(watchlist.value.length).toBe(1);
    expect(isBookmarked(42)).toBe(true);

    // Remove from watchlist
    toggleWatchlist(movie);
    expect(watchlist.value.length).toBe(0);
    expect(isBookmarked(42)).toBe(false);

    // Mock watchlist filled up to 100
    for (let i = 1; i <= 100; i++) {
      watchlist.value.push({ id: i, title: `Movie ${i}` });
    }

    // Try adding the 101st movie
    const extraMovie: any = { id: 999, title: 'The Last Movie' };
    toggleWatchlist(extraMovie);
    
    expect(watchlist.value.length).toBe(100);
    expect(watchlistWarning.value).toBe(true);
    expect(watchlist.value.some(m => m.id === 999)).toBe(false);
  });
});
