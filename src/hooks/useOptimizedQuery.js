import { useState, useEffect, useCallback, useRef } from 'react';
import { queryCache, getCacheKey } from '../utils/cacheUtils';

/**
 * Custom hook for optimized Firebase queries with caching
 *
 * @param {Function} queryFn - Async function that performs the query
 * @param {Array} dependencies - Dependencies that trigger re-fetch
 * @param {Object} options - Configuration options
 * @returns {Object} { data, loading, error, refetch }
 *
 * @example
 * const { data: posts, loading, error, refetch } = useOptimizedQuery(
 *   () => getPosts(),
 *   [],
 *   { cacheKey: 'posts:all', cacheTTL: 5 * 60 * 1000 }
 * );
 */
export const useOptimizedQuery = (queryFn, dependencies = [], options = {}) => {
  const {
    cacheKey = null,
    cacheTTL = 5 * 60 * 1000, // 5 minutes
    enabled = true,
    onSuccess = null,
    onError = null
  } = options;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isMountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let result;

      // Check cache if cacheKey provided
      if (cacheKey) {
        const cached = queryCache.get(cacheKey);
        if (cached) {
          result = cached;
        }
      }

      // Fetch from Firebase if not cached
      if (!result) {
        result = await queryFn();

        // Cache result if cacheKey provided
        if (cacheKey) {
          queryCache.set(cacheKey, result, cacheTTL);
        }
      }

      if (isMountedRef.current) {
        setData(result);
        setLoading(false);
        if (onSuccess) onSuccess(result);
      }
    } catch (err) {
      console.error('Query error:', err);
      if (isMountedRef.current) {
        setError(err);
        setLoading(false);
        if (onError) onError(err);
      }
    }
  }, [queryFn, enabled, cacheKey, cacheTTL, onSuccess, onError]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchData();

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchData, ...dependencies]);

  const refetch = useCallback(() => {
    // Invalidate cache and refetch
    if (cacheKey) {
      queryCache.invalidate(cacheKey);
    }
    return fetchData();
  }, [fetchData, cacheKey]);

  return { data, loading, error, refetch };
};

/**
 * Hook for infinite scroll / pagination
 */
export const usePaginatedQuery = (paginatedQueryInstance, dependencies = []) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    try {
      setLoading(true);
      setError(null);

      const newResults = await paginatedQueryInstance.fetchNext();
      setData(prev => [...prev, ...newResults]);
      setHasMore(paginatedQueryInstance.canFetchMore());
      setLoading(false);
    } catch (err) {
      console.error('Pagination error:', err);
      setError(err);
      setLoading(false);
    }
  }, [paginatedQueryInstance, loading, hasMore]);

  const reset = useCallback(() => {
    paginatedQueryInstance.reset();
    setData([]);
    setHasMore(true);
    setError(null);
  }, [paginatedQueryInstance]);

  // Initial load
  useEffect(() => {
    reset();
    loadMore();
  }, dependencies);

  return { data, loading, error, hasMore, loadMore, reset };
};
