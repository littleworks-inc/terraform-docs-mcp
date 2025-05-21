// src/utils/rateLimiter.ts
import { config } from '../config/index.js';
import { Logger } from './logger.js';

const logger = new Logger('RateLimiter');

/**
 * Simple rate limiter to control API request rates
 */
export class RateLimiter {
  private requestTimestamps: number[] = [];
  private requestQueue: (() => void)[] = [];
  private processing = false;
  
  constructor(private requestsPerMinute: number = config.github.requestsPerMinute) {}
  
  /**
   * Acquire a permit to make an API request
   * @returns A promise that resolves when a request can be made
   */
  async acquire(): Promise<void> {
    return new Promise<void>((resolve) => {
      // Add the request to the queue
      this.requestQueue.push(resolve);
      
      // Process the queue if not already processing
      if (!this.processing) {
        this.processQueue();
      }
    });
  }
  
  /**
   * Process the request queue according to rate limits
   */
  private async processQueue(): Promise<void> {
    if (this.requestQueue.length === 0) {
      this.processing = false;
      return;
    }
    
    this.processing = true;
    
    // Cleanup old timestamps (older than 1 minute)
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(
      timestamp => now - timestamp < 60000
    );
    
    // If we've made fewer requests than allowed, proceed immediately
    if (this.requestTimestamps.length < this.requestsPerMinute) {
      // Record the timestamp for this request
      this.requestTimestamps.push(now);
      
      // Resolve the next request in the queue
      const nextRequest = this.requestQueue.shift();
      if (nextRequest) {
        nextRequest();
      }
      
      // Continue processing the queue
      setImmediate(() => this.processQueue());
    } else {
      // We've hit the rate limit, wait for the oldest request to expire
      const oldestTimestamp = this.requestTimestamps[0];
      const timeToWait = Math.max(60000 - (now - oldestTimestamp), 0);
      
      logger.warn(`Rate limit reached. Waiting ${timeToWait}ms before next request. Queue size: ${this.requestQueue.length}`);
      setTimeout(() => this.processQueue(), timeToWait);
    }
  }
}

// Export a GitHub rate limiter instance
export const githubRateLimiter = new RateLimiter(config.github.requestsPerMinute);