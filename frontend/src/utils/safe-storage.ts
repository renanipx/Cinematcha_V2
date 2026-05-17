/**
 * Safe LocalStorage Utility with try-catch boundaries,
 * QuotaExceededError checking, and a bypass configuration switch.
 */

const getDisablePersistence = (): boolean => {
  try {
    // Check environment variable
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      if (import.meta.env.VITE_DISABLE_PERSISTENCE === 'true' || import.meta.env.VITE_DISABLE_PERSISTENCE === true) {
        return true;
      }
    }
  } catch (e) {
    // Fail silently in environments where import.meta is missing or throws
  }
  return false;
};

export const safeStorage = {
  /**
   * Set item in LocalStorage with quota checking and try-catch safety
   */
  setItem(key: string, value: any): boolean {
    if (getDisablePersistence()) {
      console.warn(`[STORAGE] Persistence is disabled via VITE_DISABLE_PERSISTENCE. Write skipped for key: ${key}`);
      return false;
    }

    try {
      const serialized = JSON.stringify(value);
      window.localStorage.setItem(key, serialized);
      return true;
    } catch (error: any) {
      console.error(`[STORAGE ERROR] Failed to write key "${key}":`, error);
      
      // Check for QuotaExceededError
      const isQuotaExceeded = 
        error instanceof DOMException && (
          // everything except Firefox
          error.code === 22 ||
          // Firefox
          error.code === 1014 ||
          // test name field
          error.name === 'QuotaExceededError' ||
          error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
        );

      if (isQuotaExceeded) {
        console.warn(`[STORAGE WARNING] LocalStorage Quota Exceeded! Key: ${key}. Graceful degradation triggered.`);
      }
      return false;
    }
  },

  /**
   * Get and parse item from LocalStorage
   */
  getItem<T>(key: string, defaultValue: T): T {
    if (getDisablePersistence()) {
      return defaultValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      if (item === null) return defaultValue;
      return JSON.parse(item) as T;
    } catch (error) {
      console.error(`[STORAGE ERROR] Failed to read key "${key}":`, error);
      return defaultValue;
    }
  },

  /**
   * Remove item from LocalStorage
   */
  removeItem(key: string): boolean {
    if (getDisablePersistence()) {
      return false;
    }

    try {
      window.localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`[STORAGE ERROR] Failed to remove key "${key}":`, error);
      return false;
    }
  },

  /**
   * Clear all matching Cinematcha namespaces
   */
  clearNamespace(prefix: string): void {
    if (getDisablePersistence()) {
      return;
    }

    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => window.localStorage.removeItem(key));
    } catch (error) {
      console.error('[STORAGE ERROR] Failed to clear namespace:', error);
    }
  }
};
