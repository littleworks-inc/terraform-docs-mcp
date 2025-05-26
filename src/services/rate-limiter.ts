/**
 * Rate Limiter Service for GitHub API calls
 * Implements intelligent throttling to stay within GitHub's rate limits
 */

export interface RateLimitInfo {
  remaining: number;
  resetTime: number;
  limit: number;
}

export class RateLimiter {
  private lastRequest = 0;
  private requestCount = 0;
  private resetTime = Date.now() + (60 * 60 * 1000); // Reset every hour
  
  // Conservative limits for unauthenticated requests
  private readonly MIN_INTERVAL = 1000; // 1 second between requests
  private readonly MAX_REQUESTS_PER_HOUR = 50; // Conservative limit (GitHub allows 60)
  private readonly MAX_REQUESTS_PER_MINUTE = 8; // Conservative limit
  
  private minuteRequestCount = 0;
  private minuteResetTime = Date.now() + (60 * 1000);

  /**
   * Throttle requests to respect GitHub rate limits
   */
  async throttle(): Promise<void> {
    const now = Date.now();
    
    // Reset hourly counter
    if (now > this.resetTime) {
      this.requestCount = 0;
      this.resetTime = now + (60 * 60 * 1000);
    }
    
    // Reset minute counter
    if (now > this.minuteResetTime) {
      this.minuteRequestCount = 0;
      this.minuteResetTime = now + (60 * 1000);
    }
    
    // Check if we've hit hourly limit
    if (this.requestCount >= this.MAX_REQUESTS_PER_HOUR) {
      const waitTime = this.resetTime - now;
      console.error(`Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)} seconds...`);
      await this.sleep(waitTime);
      return this.throttle(); // Retry after reset
    }
    
    // Check if we've hit minute limit
    if (this.minuteRequestCount >= this.MAX_REQUESTS_PER_MINUTE) {
      const waitTime = this.minuteResetTime - now;
      console.error(`Minute rate limit reached. Waiting ${Math.ceil(waitTime / 1000)} seconds...`);
      await this.sleep(waitTime);
      return this.throttle(); // Retry after reset
    }
    
    // Ensure minimum interval between requests
    const timeSinceLastRequest = now - this.lastRequest;
    if (timeSinceLastRequest < this.MIN_INTERVAL) {
      const waitTime = this.MIN_INTERVAL - timeSinceLastRequest;
      await this.sleep(waitTime);
    }
    
    // Update counters
    this.requestCount++;
    this.minuteRequestCount++;
    this.lastRequest = Date.now();
  }

  /**
   * Check if we can make a request without waiting
   */
  canMakeRequest(): boolean {
    const now = Date.now();
    
    // Check hourly limit
    if (now > this.resetTime) {
      this.requestCount = 0;
      this.resetTime = now + (60 * 60 * 1000);
    }
    
    // Check minute limit
    if (now > this.minuteResetTime) {
      this.minuteRequestCount = 0;
      this.minuteResetTime = now + (60 * 1000);
    }
    
    return this.requestCount < this.MAX_REQUESTS_PER_HOUR && 
           this.minuteRequestCount < this.MAX_REQUESTS_PER_MINUTE &&
           (Date.now() - this.lastRequest) >= this.MIN_INTERVAL;
  }

  /**
   * Get current rate limit status
   */
  getRateLimitInfo(): RateLimitInfo {
    return {
      remaining: Math.min(
        this.MAX_REQUESTS_PER_HOUR - this.requestCount,
        this.MAX_REQUESTS_PER_MINUTE - this.minuteRequestCount
      ),
      resetTime: Math.min(this.resetTime, this.minuteResetTime),
      limit: this.MAX_REQUESTS_PER_HOUR
    };
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Reset all counters (useful for testing)
   */
  reset(): void {
    this.requestCount = 0;
    this.minuteRequestCount = 0;
    this.lastRequest = 0;
    this.resetTime = Date.now() + (60 * 60 * 1000);
    this.minuteResetTime = Date.now() + (60 * 1000);
  }
}