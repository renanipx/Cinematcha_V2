const cacheService = require('../cache.service');
const { getRedisClient, isRedisReady } = require('../../config/redis.config');

jest.mock('../../config/redis.config', () => ({
  getRedisClient: jest.fn(),
  isRedisReady: jest.fn()
}));

describe('Redis Cache Service Helper Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Test 1: Hashing Normalization
  test('should normalize and generate correct SHA-256 digests', () => {
    const input1 = '  Recommend some SPACE movies ';
    const input2 = 'recommend some space movies';
    const hash1 = cacheService.hashPrompt(input1);
    const hash2 = cacheService.hashPrompt(input2);

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/); // Standard SHA-256 hash formatting
  });

  // Test 2: GET/SET when Redis is offline (Fail-Safe verification)
  test('should return null on GET and false on SET when Redis is offline', async () => {
    isRedisReady.mockReturnValue(false);

    const getRes = await cacheService.get('cache:test:1');
    const setRes = await cacheService.set('cache:test:1', { test: true });

    expect(getRes).toBeNull();
    expect(setRes).toBe(false);
  });

  // Test 3: GET/SET when Redis is online (Serialization/Deserialization verification)
  test('should serialize and deserialize JSON objects correctly when Redis is online', async () => {
    isRedisReady.mockReturnValue(true);

    const mockRedisStore = {};
    const mockClient = {
      get: jest.fn(async (key) => mockRedisStore[key] || null),
      set: jest.fn(async (key, val, options) => {
        mockRedisStore[key] = val;
        return 'OK';
      })
    };
    getRedisClient.mockReturnValue(mockClient);

    const payload = { title: 'Inception', releaseYear: 2010 };
    const key = 'cache:movie:detail:123:en';

    const setRes = await cacheService.set(key, payload, 3600);
    expect(setRes).toBe(true);
    expect(mockClient.set).toHaveBeenCalledWith(key, JSON.stringify(payload), { EX: 3600 });

    const getRes = await cacheService.get(key);
    expect(getRes).toEqual(payload);
    expect(mockClient.get).toHaveBeenCalledWith(key);
  });

  // Test 4: DEL when Redis is online
  test('should trigger DEL operation successfully when online', async () => {
    isRedisReady.mockReturnValue(true);
    const mockClient = {
      del: jest.fn(async (key) => 1)
    };
    getRedisClient.mockReturnValue(mockClient);

    const res = await cacheService.del('cache:suggest:123');
    expect(res).toBe(true);
    expect(mockClient.del).toHaveBeenCalledWith('cache:suggest:123');
  });

  // Test 5: SCAN and Delete operation
  test('should sweep cache namespaces recursively using SCAN and del when online', async () => {
    isRedisReady.mockReturnValue(true);
    
    // Simulate first cursor returning keys and next cursor returning zero (completed)
    const mockClient = {
      scan: jest.fn()
        .mockResolvedValueOnce({ cursor: '42', keys: ['cache:test:1', 'cache:test:2'] })
        .mockResolvedValueOnce({ cursor: '0', keys: ['cache:test:3'] }),
      del: jest.fn().mockResolvedValue(1)
    };
    getRedisClient.mockReturnValue(mockClient);

    const deletedCount = await cacheService.scanAndDelete('cache:test:*');
    
    expect(deletedCount).toBe(3);
    expect(mockClient.scan).toHaveBeenCalledTimes(2);
    expect(mockClient.del).toHaveBeenCalledTimes(2);
  });
});
