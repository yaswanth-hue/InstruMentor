import {
  query,
  collection,
  orderBy,
  limit,
  startAfter,
  getDocs
} from 'firebase/firestore';

/**
 * Paginated query helper for Firestore
 * Reduces initial load time and memory usage
 */
export class PaginatedQuery {
  constructor(db, collectionName, pageSize = 20, orderByField = 'timestamp', orderDirection = 'desc') {
    this.db = db;
    this.collectionName = collectionName;
    this.pageSize = pageSize;
    this.orderByField = orderByField;
    this.orderDirection = orderDirection;
    this.lastDoc = null;
    this.hasMore = true;
    this.allResults = [];
  }

  /**
   * Fetch next page of results
   */
  async fetchNext(additionalConstraints = []) {
    if (!this.hasMore) {
      return [];
    }

    try {
      const constraints = [
        orderBy(this.orderByField, this.orderDirection),
        limit(this.pageSize)
      ];

      // Add any additional where clauses
      const fullConstraints = [...additionalConstraints, ...constraints];

      // Add startAfter for pagination
      if (this.lastDoc) {
        fullConstraints.push(startAfter(this.lastDoc));
      }

      const q = query(collection(this.db, this.collectionName), ...fullConstraints);
      const snapshot = await getDocs(q);

      const results = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Update pagination state
      if (snapshot.docs.length < this.pageSize) {
        this.hasMore = false;
      }

      if (snapshot.docs.length > 0) {
        this.lastDoc = snapshot.docs[snapshot.docs.length - 1];
        this.allResults.push(...results);
      }

      return results;
    } catch (error) {
      console.error('Error fetching paginated results:', error);
      throw error;
    }
  }

  /**
   * Reset pagination to start from beginning
   */
  reset() {
    this.lastDoc = null;
    this.hasMore = true;
    this.allResults = [];
  }

  /**
   * Get all fetched results so far
   */
  getAllResults() {
    return this.allResults;
  }

  /**
   * Check if more results available
   */
  canFetchMore() {
    return this.hasMore;
  }
}

/**
 * Simple hook-friendly paginated fetch function
 */
export const createPaginatedFetcher = (db, collectionName, options = {}) => {
  const {
    pageSize = 20,
    orderByField = 'timestamp',
    orderDirection = 'desc'
  } = options;

  return new PaginatedQuery(db, collectionName, pageSize, orderByField, orderDirection);
};
