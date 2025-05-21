// src/services/cacheService.ts
import { Cache } from '../utils/cache.js';
import { config } from '../config/index.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('CacheService');

/**
 * Service for managing caches
 */
export class CacheService {
  private caches: Map<string, Cache<any>> = new Map();
  
  /**
   * Get or create a cache
   */
  getCache<T>(name: string): Cache<T> {
    if (!this.caches.has(name)) {
      logger.info(`Creating new cache: ${name}`);
      this.caches.set(name, new Cache<T>(config.cache.ttl, config.cache.maxSize));
    }
    
    return this.caches.get(name) as Cache<T>;
  }
  
  /**
   * Clear all caches
   */
  clearAll(): void {
    logger.info(`Clearing all caches`);
    for (const cache of this.caches.values()) {
      cache.clear();
    }
  }
  
  /**
   * Clear a specific cache
   */
  clear(name: string): void {
    logger.info(`Clearing cache: ${name}`);
    const cache = this.caches.get(name);
    if (cache) {
      cache.clear();
    }
  }
  
  /**
   * Get cache statistics
   */
  getStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const [name, cache] of this.caches.entries()) {
      stats[name] = cache.size();
    }
    return stats;
  }
}

// Export a singleton instance
export const cacheService = new CacheService();

// Export standard caches for common use
export const githubApiCache = cacheService.getCache<any>('githubApi');
export const githubContentCache = cacheService.getCache<string>('githubContent');
export const schemaCache = cacheService.getCache<any>('schema');