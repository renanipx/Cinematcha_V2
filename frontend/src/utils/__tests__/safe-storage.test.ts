import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { safeStorage } from '../safe-storage';

describe('safeStorage Utility', () => {
  let localStorageMock: Record<string, string> = {};

  beforeEach(() => {
    localStorageMock = {};
    vi.stubGlobal('window', {
      localStorage: {
        getItem: vi.fn((key: string) => localStorageMock[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          localStorageMock[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete localStorageMock[key];
        }),
        length: 0,
        key: vi.fn((index: number) => Object.keys(localStorageMock)[index] || null)
      }
    });
    // Dynamically adjust length on length access
    Object.defineProperty(window.localStorage, 'length', {
      get: () => Object.keys(localStorageMock).length
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('should successfully write and read back serialized objects', () => {
    const data = { name: 'Interstellar', year: 2014 };
    const success = safeStorage.setItem('test_key', data);
    expect(success).toBe(true);
    expect(window.localStorage.setItem).toHaveBeenCalledWith('test_key', JSON.stringify(data));

    const read = safeStorage.getItem('test_key', null);
    expect(read).toEqual(data);
  });

  it('should return default value when reading a missing key', () => {
    const read = safeStorage.getItem('missing_key', 'default_val');
    expect(read).toBe('default_val');
  });

  it('should gracefully handle QuotaExceededError and return false without crashing', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    vi.spyOn(window.localStorage, 'setItem').mockImplementationOnce(() => {
      const err = new DOMException('Quota exceeded', 'QuotaExceededError');
      Object.defineProperty(err, 'name', { value: 'QuotaExceededError' });
      throw err;
    });

    const success = safeStorage.setItem('heavy_key', { data: 'large' });
    expect(success).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
  });
});
