const { handleSuggest } = require('../suggest.controller');
const suggestService = require('../../services/suggest.service');
const tmdbService = require('../../services/tmdb.service');
const cacheService = require('../../services/cache.service');

jest.mock('../../services/suggest.service', () => ({
  suggestMovies: jest.fn()
}));

jest.mock('../../services/tmdb.service', () => ({
  searchMovie: jest.fn(),
  getMovieTrailer: jest.fn(),
  getMovieProviders: jest.fn()
}));

jest.mock('../../services/cache.service', () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  hashPrompt: jest.fn(val => 'mock_hash')
}));

describe('Suggest Controller Chunked Streaming Suite', () => {
  let req, res, next;
  let writtenChunks = [];

  beforeEach(() => {
    jest.clearAllMocks();
    writtenChunks = [];

    req = {
      body: {
        prompt: 'sci-fi movies',
        locale: 'en'
      },
      query: {}
    };

    res = {
      statusCode: 200,
      headersSent: false,
      setHeader: jest.fn(),
      write: jest.fn(chunk => {
        writtenChunks.push(JSON.parse(chunk.trim()));
        return true;
      }),
      end: jest.fn()
    };

    next = jest.fn();
  });

  test('should stream HTTP chunked NDJSON successfully with titles and movie payloads', async () => {
    const mockTitles = ['Inception'];
    suggestService.suggestMovies.mockResolvedValue(mockTitles);

    const mockMovie = { id: 1, title: 'Inception', year: 2010 };
    tmdbService.searchMovie.mockResolvedValue(mockMovie);
    tmdbService.getMovieTrailer.mockResolvedValue('https://youtube.com/trailer');
    tmdbService.getMovieProviders.mockResolvedValue([{ name: 'Netflix', type: 'flatrate' }]);

    await handleSuggest(req, res, next);

    // Verify response headers are set for chunked transfer
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json; charset=utf-8');
    expect(res.setHeader).toHaveBeenCalledWith('Transfer-Encoding', 'chunked');
    expect(res.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');

    // Verify chunk count and structures
    expect(writtenChunks).toHaveLength(3);
    expect(writtenChunks[0]).toEqual({ type: 'titles', data: mockTitles });
    expect(writtenChunks[1]).toEqual({
      type: 'movie',
      data: {
        ...mockMovie,
        trailer: 'https://youtube.com/trailer',
        providers: [{ name: 'Netflix', type: 'flatrate' }]
      }
    });
    expect(writtenChunks[2]).toEqual({ type: 'done' });
    
    expect(res.end).toHaveBeenCalled();
  });

  test('should sweep cache keys if bypassCache is requested', async () => {
    req.body.bypassCache = true;
    suggestService.suggestMovies.mockResolvedValue(['Inception']);
    tmdbService.searchMovie.mockResolvedValue({ id: 1, title: 'Inception' });
    tmdbService.getMovieTrailer.mockResolvedValue('');
    tmdbService.getMovieProviders.mockResolvedValue([]);

    await handleSuggest(req, res, next);

    // Assert cache evictions were triggered
    expect(cacheService.del).toHaveBeenCalledWith('cache:suggest:mock_hash:en');
    expect(cacheService.del).toHaveBeenCalledWith('cache:movie:search:mock_hash:en');
    expect(cacheService.del).toHaveBeenCalledWith('cache:movie:detail:1:en');
  });
});
