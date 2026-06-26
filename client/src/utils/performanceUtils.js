/**
 * Performance monitoring utilities
 * Helps track component render performance and identify bottlenecks
 */

/**
 * Log component render time (development only)
 */
export const measureRenderTime = (componentName) => {
  if (process.env.NODE_ENV !== 'development') return () => {};

  const startTime = performance.now();

  return () => {
    const endTime = performance.now();
    const renderTime = endTime - startTime;

    if (renderTime > 16) { // Flag renders slower than 60fps (16.67ms)
      console.warn(
        `🐌 Slow render: ${componentName} took ${renderTime.toFixed(2)}ms`
      );
    }
  };
};

/**
 * Debounce function for expensive operations
 */
export const debounce = (func, wait = 300) => {
  let timeout;

  const debounced = (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };

  debounced.cancel = () => clearTimeout(timeout);

  return debounced;
};

/**
 * Throttle function for scroll/resize handlers
 */
export const throttle = (func, limit = 100) => {
  let inThrottle;

  return (...args) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

/**
 * Lazy load images with Intersection Observer
 */
export const lazyLoadImage = (imageRef, src) => {
  if (!('IntersectionObserver' in window)) {
    // Fallback for browsers without Intersection Observer
    if (imageRef.current) {
      imageRef.current.src = src;
    }
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = src;
          observer.unobserve(img);
        }
      });
    },
    {
      rootMargin: '50px' // Start loading 50px before entering viewport
    }
  );

  if (imageRef.current) {
    observer.observe(imageRef.current);
  }

  return () => {
    if (imageRef.current) {
      observer.unobserve(imageRef.current);
    }
  };
};

/**
 * Measure and log query performance
 */
export const measureQueryTime = async (queryName, queryFn) => {
  const startTime = performance.now();

  try {
    const result = await queryFn();
    const endTime = performance.now();
    const queryTime = endTime - startTime;

    if (process.env.NODE_ENV === 'development') {
      const emoji = queryTime > 1000 ? '🐌' : queryTime > 500 ? '⚠️' : '✅';
      console.log(
        `${emoji} Query "${queryName}" took ${queryTime.toFixed(2)}ms`
      );
    }

    return result;
  } catch (error) {
    const endTime = performance.now();
    console.error(
      `❌ Query "${queryName}" failed after ${(endTime - startTime).toFixed(2)}ms:`,
      error
    );
    throw error;
  }
};

/**
 * Check if user is on slow connection
 */
export const isSlowConnection = () => {
  if (!('connection' in navigator)) return false;

  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  return connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g';
};

/**
 * Preload critical images
 */
export const preloadImages = (imageUrls) => {
  imageUrls.forEach((url) => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = url;
    document.head.appendChild(link);
  });
};

/**
 * Request idle callback wrapper with fallback
 */
export const requestIdleCallback =
  window.requestIdleCallback ||
  function (cb) {
    const start = Date.now();
    return setTimeout(() => {
      cb({
        didTimeout: false,
        timeRemaining: () => Math.max(0, 50 - (Date.now() - start))
      });
    }, 1);
  };

export const cancelIdleCallback =
  window.cancelIdleCallback || clearTimeout;
