/**
 * Simple in-memory cache for Firebase queries
 * Reduces redundant network requests and improves performance
 */

class CacheManager {
  constructor(defaultTTL = 5 * 60 * 1000) { // 5 minutes default
    this.cache = new Map();
    this.defaultTTL = defaultTTL;
  }

  /**
   * Set cache entry with optional TTL (time to live)
   */
  set(key, value, ttl = this.defaultTTL) {
    const expiresAt = Date.now() + ttl;
    this.cache.set(key, { value, expiresAt });
  }

  /**
   * Get cached value if not expired
   */
  get(key) {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Check if cache has valid entry
   */
  has(key) {
    return this.get(key) !== null;
  }

  /**
   * Invalidate specific cache entry
   */
  invalidate(key) {
    this.cache.delete(key);
  }

  /**
   * Invalidate cache entries matching pattern
   */
  invalidatePattern(pattern) {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Clean expired entries
   */
  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

// Global cache instance
export const queryCache = new CacheManager();

// Cleanup expired entries every 10 minutes
setInterval(() => queryCache.cleanup(), 10 * 60 * 1000);

/**
 * Helper to generate cache keys
 */
export const getCacheKey = (collection, ...params) => {
  return `${collection}:${params.join(':')}`;
};

/**
 * Cached query wrapper
 */
export const cachedQuery = async (cacheKey, queryFn, ttl) => {
  // Check cache first
  const cached = queryCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Execute query
  const result = await queryFn();

  // Cache result
  queryCache.set(cacheKey, result, ttl);

  return result;
};
