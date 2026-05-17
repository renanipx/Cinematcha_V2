const suggestService = require('../suggest.service');
const cacheService = require('../cache.service');
const tmdbService = require('../tmdb.service');

jest.mock('../cache.service', () => ({
  get: jest.fn(),
  set: jest.fn(),
  hashPrompt: jest.fn(val => 'mock_hash')
}));

jest.mock('../tmdb.service', () => ({
  searchMovie: jest.fn(),
  getMovieTrailer: jest.fn(),
  getMovieProviders: jest.fn()
}));

describe('Suggest Service Caching & p-limit Resolver Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Test 1: Caching suggest lists
  test('should return cached titles on suggestMovies cache hit', async () => {
    const cachedTitles = ['Inception', 'Interstellar'];
    cacheService.get.mockResolvedValue(cachedTitles);

    const result = await suggestService.suggestMovies('space movies', 'en');

    expect(result).toEqual(cachedTitles);
    expect(cacheService.get).toHaveBeenCalledWith('cache:suggest:mock_hash:en');
    expect(cacheService.set).not.toHaveBeenCalled();
  });

  test('should resolve suggestions on suggestMovies cache miss', async () => {
    cacheService.get.mockResolvedValue(null);
    cacheService.set.mockResolvedValue(true);

    const result = await suggestService.suggestMovies('space movies', 'en');

    expect(result).toEqual(expect.arrayContaining(['Interstellar', 'Inception', '2001: A Space Odyssey']));
    expect(cacheService.get).toHaveBeenCalledWith('cache:suggest:mock_hash:en');
    expect(cacheService.set).toHaveBeenCalledWith('cache:suggest:mock_hash:en', result, 86400);
  });

  // Test 2: Concurrency p-limit and soft-fail mapping
  test('should map movie metadata concurrently and filter soft-fails cleanly', async () => {
    const mockTitles = ['Inception', 'Broken Movie', 'Interstellar'];
    
    // Inception resolves successfully
    tmdbService.searchMovie.mockImplementation(async (title) => {
      if (title === 'Inception') return { id: 1, title: 'Inception' };
      if (title === 'Interstellar') return { id: 2, title: 'Interstellar' };
      if (title === 'Broken Movie') throw new Error('Simulated network drop');
      return null;
    });

    tmdbService.getMovieTrailer.mockResolvedValue('https://youtube.com/watch?v=mock');
    tmdbService.getMovieProviders.mockResolvedValue([{ name: 'Netflix' }]);

    const results = await suggestService.resolveMovieMetadata(mockTitles, 'en');

    // 'Broken Movie' should soft-fail and be skipped entirely
    expect(results).toHaveLength(2);
    expect(results[0].title).toBe('Inception');
    expect(results[1].title).toBe('Interstellar');
    
    // Asserts that TMDB methods were called for the valid movies
    expect(tmdbService.searchMovie).toHaveBeenCalledTimes(3);
    expect(tmdbService.getMovieTrailer).toHaveBeenCalledTimes(2);
  });
});
