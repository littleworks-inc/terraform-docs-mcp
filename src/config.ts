// src/config.ts
/**
 * Application configuration
 */

// Default values
const DEFAULT_CONFIG = {
  // GitHub API settings
  github: {
    useAuth: false,
    token: '',
    requestsPerMinute: 60, // GitHub's default unauthenticated rate limit is 60 requests per hour
    maxRetries: 3,
    retryDelay: 1000 // ms
  },
  // Cache settings
  cache: {
    enabled: true,
    ttl: 3600000, // 1 hour in ms
    maxSize: 100 // Max number of items to cache
  },
  // Logging
  logging: {
    level: 'info' // 'error', 'warn', 'info', 'debug'
  }
};

// Type for the configuration
export interface AppConfig {
  github: {
    useAuth: boolean;
    token: string;
    requestsPerMinute: number;
    maxRetries: number;
    retryDelay: number;
  };
  cache: {
    enabled: boolean;
    ttl: number;
    maxSize: number;
  };
  logging: {
    level: string;
  };
}

/**
 * Load configuration from environment variables
 */
function loadConfig(): AppConfig {
  const config = { ...DEFAULT_CONFIG };
  
  // GitHub configuration
  if (process.env.GITHUB_TOKEN) {
    config.github.token = process.env.GITHUB_TOKEN;
    config.github.useAuth = true;
  }
  
  if (process.env.GITHUB_REQUESTS_PER_MINUTE) {
    config.github.requestsPerMinute = parseInt(process.env.GITHUB_REQUESTS_PER_MINUTE, 10);
  }
  
  if (process.env.GITHUB_MAX_RETRIES) {
    config.github.maxRetries = parseInt(process.env.GITHUB_MAX_RETRIES, 10);
  }
  
  if (process.env.GITHUB_RETRY_DELAY) {
    config.github.retryDelay = parseInt(process.env.GITHUB_RETRY_DELAY, 10);
  }
  
  // Cache configuration
  if (process.env.CACHE_ENABLED) {
    config.cache.enabled = process.env.CACHE_ENABLED.toLowerCase() === 'true';
  }
  
  if (process.env.CACHE_TTL) {
    config.cache.ttl = parseInt(process.env.CACHE_TTL, 10);
  }
  
  if (process.env.CACHE_MAX_SIZE) {
    config.cache.maxSize = parseInt(process.env.CACHE_MAX_SIZE, 10);
  }
  
  // Logging configuration
  if (process.env.LOG_LEVEL) {
    config.logging.level = process.env.LOG_LEVEL.toLowerCase();
  }
  
  return config;
}

// Export the configuration
export const config = loadConfig();