const tmdbService = require('../tmdb.service');
const cacheService = require('../cache.service');

jest.mock('../cache.service', () => ({
  get: jest.fn(),
  set: jest.fn(),
  hashPrompt: jest.fn(val => val.trim().toLowerCase())
}));

describe('TMDB Service Caching & Resolver Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return cached details on cache hit during movie search', async () => {
    const cachedMovie = { id: 123, title: 'Inception', year: 2010 };
    cacheService.get.mockResolvedValue(cachedMovie);

    const result = await tmdbService.searchMovie('Inception', 'en');

    expect(result).toEqual(cachedMovie);
    expect(cacheService.get).toHaveBeenCalledWith('cache:movie:search:inception:en');
    expect(cacheService.set).not.toHaveBeenCalled();
  });

  test('should resolve and cache movie details on cache miss', async () => {
    cacheService.get.mockResolvedValue(null);
    cacheService.set.mockResolvedValue(true);

    const result = await tmdbService.searchMovie('Inception', 'en');

    expect(result).toBeDefined();
    expect(result.title).toBe('Inception');
    expect(cacheService.get).toHaveBeenCalledWith('cache:movie:search:inception:en');
    expect(cacheService.set).toHaveBeenCalledTimes(2); // Search cache key and detail cache key
  });

  test('should return cached trailer on cache hit', async () => {
    cacheService.get.mockResolvedValue('https://youtube.com/watch?v=123');

    const trailer = await tmdbService.getMovieTrailer(27205, 'en');

    expect(trailer).toBe('https://youtube.com/watch?v=123');
    expect(cacheService.get).toHaveBeenCalledWith('cache:movie:trailer:27205:en');
    expect(cacheService.set).not.toHaveBeenCalled();
  });

  test('should return cached providers on cache hit', async () => {
    const mockProvs = [{ name: 'Netflix', type: 'flatrate' }];
    cacheService.get.mockResolvedValue(mockProvs);

    const providers = await tmdbService.getMovieProviders(27205, 'en');

    expect(providers).toEqual(mockProvs);
    expect(cacheService.get).toHaveBeenCalledWith('cache:movie:providers:27205:en');
    expect(cacheService.set).not.toHaveBeenCalled();
  });
});
