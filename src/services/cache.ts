/**
 * Cache Service for storing API responses and computed data
 * Implements TTL-based caching with automatic cleanup
 */

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  key: string;
}

export interface CacheConfig {
  maxSize: number;
  defaultTtl: number;
  cleanupInterval: number;
}

export class CacheService {
  private cache = new Map<string, CacheEntry<any>>();
  private cleanupTimer: NodeJS.Timeout | null = null;
  
  private readonly config: CacheConfig = {
    maxSize: 1000,
    defaultTtl: 60 * 60 * 1000, // 1 hour default
    cleanupInterval: 10 * 60 * 1000 // Cleanup every 10 minutes
  };

  constructor(config?: Partial<CacheConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    this.startCleanupTimer();
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const actualTtl = ttl || this.config.defaultTtl;
    
    // If cache is full, remove oldest entries
    if (this.cache.size >= this.config.maxSize) {
      this.evictOldest();
    }
    
    const entry: CacheEntry<T> = {
      data: value,
      timestamp: Date.now(),
      ttl: actualTtl,
      key
    };
    
    this.cache.set(key, entry);
  }

  /**
   * Get or fetch pattern - returns cached value or fetches new one
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    
    if (cached !== null) {
      return cached;
    }
    
    const data = await fetcher();
    await this.set(key, data, ttl);
    return data;
  }

  /**
   * Check if key exists in cache and is valid
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }
    
    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Delete specific key from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now();
    const entries = Array.from(this.cache.values());
    
    const validEntries = entries.filter(entry => 
      now - entry.timestamp <= entry.ttl
    );
    
    const expiredEntries = entries.length - validEntries.length;
    
    return {
      totalEntries: entries.length,
      validEntries: validEntries.length,
      expiredEntries,
      cacheSize: this.cache.size,
      maxSize: this.config.maxSize,
      hitRate: this.calculateHitRate()
    };
  }

  /**
   * Generate cache key for API requests
   */
  static generateKey(prefix: string, ...parts: string[]): string {
    return `${prefix}:${parts.join(':')}`;
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
    
    if (keysToDelete.length > 0) {
      console.error(`Cache cleanup: removed ${keysToDelete.length} expired entries`);
    }
  }

  /**
   * Evict oldest entries when cache is full
   */
  private evictOldest(): void {
  const entries = Array.from(this.cache.entries());
  
  // Sort by timestamp (oldest first)
  entries.sort(([, a], [, b]) => a.timestamp - b.timestamp);
  
  // Remove 20% of entries
  const toRemove = Math.ceil(entries.length * 0.2);
  
  for (let i = 0; i < toRemove && i < entries.length; i++) {
    const entry = entries[i];
    if (entry && entry[0]) {
      const [key] = entry;
      this.cache.delete(key);
    }
  }
  
  console.error(`Cache eviction: removed ${toRemove} oldest entries`);
}

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Stop cleanup timer
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clear();
  }

  /**
   * Calculate cache hit rate (simplified)
   */
  private calculateHitRate(): number {
    // This is a simplified calculation
    // In a real implementation, you'd track hits/misses
    return 0; // Placeholder
  }
}

// Cache TTL constants
export const CACHE_TTL = {
  SCHEMA: 24 * 60 * 60 * 1000,      // 24 hours - schemas rarely change
  DOCS: 6 * 60 * 60 * 1000,        // 6 hours - docs change occasionally  
  REPO_INFO: 7 * 24 * 60 * 60 * 1000, // 1 week - repo info is stable
  EXAMPLES: 12 * 60 * 60 * 1000,    // 12 hours - examples change sometimes
  ERROR_RESPONSE: 5 * 60 * 1000,    // 5 minutes - retry errors quickly
} as const;