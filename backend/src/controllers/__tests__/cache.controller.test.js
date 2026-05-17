const { handleInvalidate } = require('../cache.controller');
const cacheService = require('../../services/cache.service');

jest.mock('../../services/cache.service', () => ({
  scanAndDelete: jest.fn()
}));

describe('Cache Controller Administrative Sweep Suite', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      body: {},
      query: {}
    };

    res = {
      statusCode: 200,
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    next = jest.fn();
  });

  test('should return 400 if pattern is missing', async () => {
    await handleInvalidate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Validation failed'
      })
    );
  });

  test('should sweep cache matching glob pattern and return evicted count', async () => {
    req.body.pattern = 'cache:suggest:*';
    cacheService.scanAndDelete.mockResolvedValue(5);

    await handleInvalidate(req, res, next);

    expect(cacheService.scanAndDelete).toHaveBeenCalledWith('cache:suggest:*');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      status: 'success',
      evictedKeys: 5
    });
  });

  test('should handle service errors gracefully returning 500', async () => {
    req.body.pattern = 'cache:suggest:*';
    cacheService.scanAndDelete.mockRejectedValue(new Error('Redis partition offline'));

    await handleInvalidate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Internal Server Error'
      })
    );
  });
});
