// src/api/github.ts
import { config } from '../config/index.js';
import { githubApiCache, githubContentCache } from '../utils/cache.js';
import { githubRateLimiter } from '../utils/rateLimiter.js';
import { httpRequest, HttpRequestOptions } from '../utils/http.js';
import { GitHubApiError } from '../errors/index.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('GitHubAPI');

/**
 * GitHub API response
 */
export interface GitHubApiResponse<T> {
  data: T;
  headers: Record<string, string | string[] | undefined>;
  statusCode: number;
}

/**
 * GitHub API client
 */
export class GitHubApiClient {
  /**
   * Make an authenticated API request to GitHub
   */
  async apiRequest<T>(path: string, method: string = 'GET'): Promise<GitHubApiResponse<T>> {
    // Check cache first
    const cacheKey = `api-${method}-${path}`;
    const cachedData = githubApiCache.get(cacheKey) as GitHubApiResponse<T> | undefined;
    if (cachedData) {
      return cachedData;
    }
    
    // Acquire rate limit permit
    await githubRateLimiter.acquire();
    
    let retries = 0;
    
    while (retries <= config.github.maxRetries) {
      try {
        const options: HttpRequestOptions = {
          hostname: 'api.github.com',
          path,
          method,
          headers: {
            'User-Agent': 'terraform-docs-mcp',
            'Accept': 'application/vnd.github.v3+json'
          }
        };
        
        // Add authentication if configured
        if (config.github.useAuth && config.github.token) {
          options.headers!['Authorization'] = `token ${config.github.token}`;
        }
        
        const response = await httpRequest(options);
        
        // Check for rate limit headers
        const remainingRequests = response.headers['x-ratelimit-remaining'];
        if (remainingRequests && parseInt(remainingRequests as string, 10) === 0) {
          const resetTime = response.headers['x-ratelimit-reset'];
          if (resetTime) {
            const resetTimestamp = parseInt(resetTime as string, 10) * 1000;
            const waitTime = resetTimestamp - Date.now();
            logger.warn(`GitHub API rate limit exceeded. Resets in ${Math.ceil(waitTime / 1000)} seconds.`);
          }
        }
        
        // Check for error status codes
        if (response.statusCode >= 400) {
          // Special handling for rate limiting
          if (response.statusCode === 403 && response.headers['x-ratelimit-remaining'] === '0') {
            throw new GitHubApiError('GitHub API rate limit exceeded', path, response.statusCode);
          }
          
          // Handle other errors
          try {
            const parsedError = JSON.parse(response.body);
            throw new GitHubApiError(
              parsedError.message || 'Unknown GitHub API error',
              path,
              response.statusCode
            );
          } catch (parseError) {
            throw new GitHubApiError(`HTTP Error: ${response.statusCode}`, path, response.statusCode);
          }
        }
        
        // Parse response body
        let data: T;
        try {
          data = JSON.parse(response.body) as T;
        } catch (error) {
          throw new GitHubApiError(
            `Failed to parse GitHub API response: ${error instanceof Error ? error.message : 'Unknown error'}`,
            path
          );
        }
        
        const result: GitHubApiResponse<T> = {
          data,
          headers: response.headers,
          statusCode: response.statusCode
        };
        
        // Cache successful responses
        githubApiCache.set(cacheKey, result);
        
        return result;
      } catch (error) {
        // Determine if we should retry
        if (
          error instanceof GitHubApiError && 
          error.statusCode && 
          [429, 500, 502, 503, 504].includes(error.statusCode) &&
          retries < config.github.maxRetries
        ) {
          // Exponential backoff
          const delay = Math.pow(2, retries) * config.github.retryDelay;
          logger.warn(`Retrying GitHub API request in ${delay}ms (attempt ${retries + 1}/${config.github.maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          retries++;
        } else {
          throw error;
        }
      }
    }
    
    throw new GitHubApiError(`GitHub API request failed after ${config.github.maxRetries} retries`, path);
  }
  
  /**
   * Get raw content from GitHub
   */
  async getRawContent(owner: string, repo: string, branch: string, path: string): Promise<string> {
    // Check cache first
    const cacheKey = `raw-${owner}-${repo}-${branch}-${path}`;
    const cachedData = githubContentCache.get(cacheKey);
    if (cachedData) {
      return cachedData;
    }
    
    // Acquire rate limit permit
    await githubRateLimiter.acquire();
    
    let retries = 0;
    
    while (retries <= config.github.maxRetries) {
      try {
        const fullPath = `/${owner}/${repo}/${branch}/${path}`;
        const options: HttpRequestOptions = {
          hostname: 'raw.githubusercontent.com',
          path: fullPath,
          method: 'GET',
          headers: {
            'User-Agent': 'terraform-docs-mcp'
          }
        };
        
        // Add authentication if configured
        if (config.github.useAuth && config.github.token) {
          options.headers!['Authorization'] = `token ${config.github.token}`;
        }
        
        const response = await httpRequest(options);
        
        if (response.statusCode >= 200 && response.statusCode < 300) {
          // Cache successful responses
          githubContentCache.set(cacheKey, response.body);
          return response.body;
        } else {
          throw new GitHubApiError(
            `Failed to fetch raw content: HTTP ${response.statusCode}`,
            fullPath,
            response.statusCode
          );
        }
      } catch (error) {
        // Determine if we should retry
        if (
          error instanceof GitHubApiError && 
          error.statusCode && 
          [429, 500, 502, 503, 504].includes(error.statusCode) &&
          retries < config.github.maxRetries
        ) {
          // Exponential backoff
          const delay = Math.pow(2, retries) * config.github.retryDelay;
          logger.warn(`Retrying GitHub raw content request in ${delay}ms (attempt ${retries + 1}/${config.github.maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          retries++;
        } else {
          throw error;
        }
      }
    }
    
    throw new GitHubApiError(`GitHub raw content request failed after ${config.github.maxRetries} retries`, `/${owner}/${repo}/${branch}/${path}`);
  }
}

// Export a singleton instance
export const githubApi = new GitHubApiClient();