# Optimization Quick Reference

## Import Statements Cheat Sheet

```jsx
// Core React optimizations
import { memo, useCallback, useMemo, lazy, Suspense } from 'react';

// Components
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorBoundary from '../components/ErrorBoundary';

// Hooks
import { useOptimizedQuery, usePaginatedQuery } from '../hooks/useOptimizedQuery';

// Utilities
import { queryCache, getCacheKey, cachedQuery } from '../utils/cacheUtils';
import { createPaginatedFetcher, PaginatedQuery } from '../utils/paginationUtils';
import { debounce, throttle, measureQueryTime } from '../utils/performanceUtils';
```

---

## Common Patterns

### 1. Optimized Data Fetching
```jsx
const { data, loading, error, refetch } = useOptimizedQuery(
  () => getPosts(),
  [userId], // dependencies
  {
    cacheKey: getCacheKey('posts', userId),
    cacheTTL: 5 * 60 * 1000 // 5 minutes
  }
);

if (loading) return <LoadingSpinner />;
if (error) return <div>Error: {error.message}</div>;
```

### 2. Memoized Component
```jsx
const PostCard = memo(({ post, onLike, onComment }) => {
  return <div>{/* component JSX */}</div>;
});

PostCard.displayName = 'PostCard';
export default PostCard;
```

### 3. Memoized Callbacks
```jsx
const handleLike = useCallback((postId) => {
  likePost(postId);
  queryCache.invalidate(getCacheKey('posts', postId));
}, []);
```

### 4. Memoized Expensive Computations
```jsx
const filteredPosts = useMemo(() => {
  return posts.filter(p => p.userId === currentUserId);
}, [posts, currentUserId]);
```

### 5. Lazy Loading Routes
```jsx
const CoursesPage = lazy(() => import('./pages/CoursesPage'));

<Suspense fallback={<LoadingSpinner />}>
  <Routes>
    <Route path="/courses" element={<CoursesPage />} />
  </Routes>
</Suspense>
```

### 6. Error Boundaries
```jsx
<ErrorBoundary>
  <ComplexComponent />
</ErrorBoundary>
```

### 7. Pagination
```jsx
const paginator = createPaginatedFetcher(db, 'posts', { pageSize: 20 });

const { data, loading, hasMore, loadMore } = usePaginatedQuery(
  paginator,
  [instrument, level]
);

<button onClick={loadMore} disabled={loading || !hasMore}>
  Load More
</button>
```

### 8. Debounced Search
```jsx
const debouncedSearch = useMemo(
  () => debounce((term) => performSearch(term), 300),
  []
);

<input onChange={(e) => debouncedSearch(e.target.value)} />
```

### 9. Cache Invalidation
```jsx
const createPost = async (data) => {
  await addPost(data);

  // Invalidate all post caches
  queryCache.invalidatePattern('posts:');

  // Or invalidate specific cache
  queryCache.invalidate(getCacheKey('posts', 'all'));
};
```

### 10. Measure Performance
```jsx
const loadData = async () => {
  const data = await measureQueryTime('fetchPosts', () => getPosts());
  setData(data);
};
```

---

## When to Use What

| Situation | Solution | Why |
|-----------|----------|-----|
| Route component | `lazy()` + `Suspense` | Reduce initial bundle |
| Data fetching | `useOptimizedQuery` | Auto caching + loading states |
| Long list | `usePaginatedQuery` | Memory efficiency |
| Expensive component | `memo()` | Prevent unnecessary re-renders |
| Event handler prop | `useCallback()` | Stable reference for memo |
| Heavy calculation | `useMemo()` | Avoid recalculation |
| Search input | `debounce()` | Reduce API calls |
| Scroll handler | `throttle()` | Limit execution frequency |
| Loading state | `<LoadingSpinner />` | Consistent UX |
| Error-prone code | `<ErrorBoundary>` | Graceful error handling |

---

## Decision Tree

```
Need to fetch data?
├─ One-time fetch?
│  └─ Use useOptimizedQuery with cache
└─ Paginated data?
   └─ Use usePaginatedQuery

Creating a component?
├─ Receives props frequently?
│  └─ Wrap in memo()
└─ Passes callbacks down?
   └─ Use useCallback()

Heavy computation?
├─ On every render?
│  └─ Use useMemo()
└─ In query?
   └─ Use caching

Showing loading?
└─ Use <LoadingSpinner />

Error-prone component?
└─ Wrap in <ErrorBoundary>

Adding a route?
└─ Use lazy() + Suspense
```

---

## Performance Checklist

Before committing new code:

- [ ] Route components use `lazy()`?
- [ ] Data fetching uses `useOptimizedQuery`?
- [ ] Long lists use pagination?
- [ ] Expensive components wrapped in `memo()`?
- [ ] Event handlers use `useCallback()`?
- [ ] Heavy calculations use `useMemo()`?
- [ ] Loading states use `<LoadingSpinner />`?
- [ ] Cache invalidated after mutations?
- [ ] Components have proper error boundaries?

---

## File Locations

```
src/
├── components/
│   ├── LoadingSpinner.jsx        ← Loading UI
│   └── ErrorBoundary.jsx         ← Error handling
├── hooks/
│   └── useOptimizedQuery.js      ← Data fetching hooks
├── utils/
│   ├── cacheUtils.js             ← Cache management
│   ├── paginationUtils.js        ← Pagination helpers
│   └── performanceUtils.js       ← Performance utilities
└── context/
    └── DarkModeContext.jsx       ← Optimized context example
```

---

## Common Mistakes

### ❌ Don't
```jsx
// Creating new function on every render
<Button onClick={() => handleClick(id)} />

// Not invalidating cache after mutation
await createPost(data);
// User sees stale data

// Memoizing everything
const x = useMemo(() => 1 + 1, []); // Overkill

// Forgetting dependencies
const value = useMemo(() => compute(data), []); // Missing dependency
```

### ✅ Do
```jsx
// Memoize callbacks passed as props
const handleClick = useCallback(() => handleClick(id), [id]);
<Button onClick={handleClick} />

// Invalidate cache after changes
await createPost(data);
queryCache.invalidatePattern('posts:');

// Memoize only expensive operations
const filtered = useMemo(() => heavyFilter(data), [data]);

// Include all dependencies
const value = useMemo(() => compute(data), [data]);
```

---

## Debugging Tips

### Check if cache is working
```javascript
console.log('Cache size:', queryCache.cache.size);
console.log('Has key?', queryCache.has('posts:all'));
```

### Check render count
```jsx
const renderCount = useRef(0);
useEffect(() => {
  renderCount.current++;
  console.log('Rendered:', renderCount.current, 'times');
});
```

### Check bundle size
```bash
npm run build
# Check dist/assets/js/ folder
# Each chunk should be < 100KB gzipped
```

### Check lazy loading
```javascript
// Open Network tab
// Navigate to route
// Should see chunk load with name like "CoursesPage-[hash].js"
```

---

## Emergency Rollback

If something breaks:

```bash
# Revert to previous commit
git log --oneline  # Find commit before optimization
git revert <commit-hash>

# Or just disable specific features:
# - Remove lazy() and Suspense from App.jsx
# - Don't use new hooks/utils
# - Keep using old patterns
```

---

## Getting Help

1. **Read full guide**: `OPTIMIZATION_GUIDE.md`
2. **See examples**: Check `DarkModeToggle.jsx`, `DarkModeContext.jsx`
3. **Check utils**: Look at implementations in `src/utils/`
4. **Test locally**: Use DevTools Performance tab

---

*Keep this file open while coding for quick reference!*
