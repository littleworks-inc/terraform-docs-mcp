// src/utils/cache.ts
import { config } from '../config/index.js';
import { Logger } from './logger.js';

const logger = new Logger('Cache');

/**
 * A simple in-memory cache implementation
 */
export class Cache<T> {
  private cache: Map<string, { value: T; timestamp: number }> = new Map();
  
  constructor(private ttl: number = config.cache.ttl, private maxSize: number = config.cache.maxSize) {}
  
  /**
   * Get a value from the cache
   * @param key Cache key
   * @returns The cached value or undefined if not found
   */
  get(key: string): T | undefined {
    if (!config.cache.enabled) return undefined;
    
    const item = this.cache.get(key);
    if (!item) {
      logger.debug(`Cache miss: ${key}`);
      return undefined;
    }
    
    // Check if the item has expired
    if (Date.now() - item.timestamp > this.ttl) {
      logger.debug(`Cache expired: ${key}`);
      this.cache.delete(key);
      return undefined;
    }
    
    logger.debug(`Cache hit: ${key}`);
    return item.value;
  }
  
  /**
   * Set a value in the cache
   * @param key Cache key
   * @param value Value to cache
   */
  set(key: string, value: T): void {
    if (!config.cache.enabled) return;
    
    // If cache is full, remove the oldest item
    if (this.cache.size >= this.maxSize) {
      const oldestEntry = this.getOldestEntry();
      if (oldestEntry) {
        logger.debug(`Cache full, removing oldest entry: ${oldestEntry[0]}`);
        this.cache.delete(oldestEntry[0]); // Delete by key
      }
    }
    
    logger.debug(`Cache set: ${key}`);
    this.cache.set(key, { value, timestamp: Date.now() });
  }
  
  /**
   * Get the oldest entry in the cache
   * @returns The oldest [key, value] pair or undefined if cache is empty
   */
  private getOldestEntry(): [string, { value: T; timestamp: number }] | undefined {
    if (this.cache.size === 0) {
      return undefined;
    }
    
    let oldestKey: string | undefined = undefined;
    let oldestTimestamp = Date.now();
    
    // Find the entry with the oldest timestamp
    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestKey = key;
        oldestTimestamp = entry.timestamp;
      }
    }
    
    if (oldestKey === undefined) {
      // If we somehow couldn't find the oldest, just take the first one
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        const entry = this.cache.get(firstKey);
        if (entry) {
          return [firstKey, entry];
        }
      }
      return undefined;
    }
    
    const oldestEntry = this.cache.get(oldestKey);
    if (oldestEntry) {
      return [oldestKey, oldestEntry];
    }
    
    return undefined;
  }
  
  /**
   * Check if the cache contains a key
   * @param key Cache key
   * @returns True if the key exists and is not expired
   */
  has(key: string): boolean {
    if (!config.cache.enabled) return false;
    
    const item = this.cache.get(key);
    if (!item) return false;
    
    // Check if the item has expired
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }
  
  /**
   * Clear the cache
   */
  clear(): void {
    logger.debug(`Cache cleared, ${this.cache.size} entries removed`);
    this.cache.clear();
  }
  
  /**
   * Get the number of items in the cache
   */
  size(): number {
    return this.cache.size;
  }
}

// Export cache instances for different types
export const githubApiCache = new Cache<any>();
export const githubContentCache = new Cache<string>();