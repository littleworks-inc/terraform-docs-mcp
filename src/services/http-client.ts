/**
 * Enhanced HTTP Client with proper error handling, timeouts, and retries
 * Replaces the basic https.get implementation with a robust solution
 */

import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { getConfig } from '../config/index.js';

export interface HttpResponse {
  statusCode: number;
  statusMessage: string;
  headers: Record<string, string | string[]>;
  body: string;
  url: string;
}

export interface HttpRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  followRedirects?: boolean;
  maxRedirects?: number;
}

export class HttpError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public statusMessage: string,
    public response?: HttpResponse
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class TimeoutError extends Error {
  constructor(message: string, public timeout: number) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class HttpClient {
  private config = getConfig();

  /**
   * Make an HTTP GET request with proper error handling and retries
   */
  async get(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse> {
    return this.request(url, { ...options, method: 'GET' });
  }

  /**
   * Make an HTTP request with full configuration support
   */
  async request(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse> {
  const {
    method = 'GET',
    headers = {},
    timeout = this.config.github.timeout,
    maxRetries = this.config.github.maxRetries,
    retryDelay = this.config.github.retryDelay,
    followRedirects = true,
    maxRedirects = 5
  } = options;

  let lastError: Error = new Error('Request failed'); // Initialize with default error
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await this.makeRequest(url, {
        method,
        headers: {
          'User-Agent': this.config.github.userAgent,
          'Accept': 'application/vnd.github.v3+json',
          ...headers
        },
        timeout,
        followRedirects,
        maxRedirects
      });

      // Check for successful status codes
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return response;
      }

      // Handle specific error status codes
      if (response.statusCode === 404) {
        throw new HttpError(
          `Resource not found: ${url}`,
          response.statusCode,
          response.statusMessage,
          response
        );
      }

      if (response.statusCode === 403) {
        const rateLimitReset = response.headers['x-ratelimit-reset'];
        if (rateLimitReset) {
          const resetTime = parseInt(rateLimitReset as string, 10) * 1000;
          const waitTime = resetTime - Date.now();
          
          if (waitTime > 0 && waitTime < 60 * 60 * 1000) {
            console.error(`Rate limited. Waiting ${Math.ceil(waitTime / 1000)} seconds...`);
            await this.sleep(waitTime);
            continue;
          }
        }
        
        throw new HttpError(
          `Forbidden: ${url}. Possibly rate limited.`,
          response.statusCode,
          response.statusMessage,
          response
        );
      }

      if (response.statusCode >= 500) {
        lastError = new HttpError(
          `Server error: ${response.statusCode} ${response.statusMessage}`,
          response.statusCode,
          response.statusMessage,
          response
        );
      } else {
        throw new HttpError(
          `HTTP Error: ${response.statusCode} ${response.statusMessage}`,
          response.statusCode,
          response.statusMessage,
          response
        );
      }

    } catch (error) {
      lastError = error as Error;
      
      if (error instanceof HttpError && error.statusCode < 500) {
        throw error;
      }
      
      if (error instanceof TimeoutError) {
        lastError = error;
      }
    }

    if (attempt < maxRetries) {
      const delay = retryDelay * Math.pow(2, attempt);
      console.error(`Request failed (attempt ${attempt + 1}/${maxRetries + 1}). Retrying in ${delay}ms...`);
      await this.sleep(delay);
    }
  }

  throw lastError;
}

  /**
   * Make the actual HTTP request
   */
  private makeRequest(
    url: string,
    options: {
      method: string;
      headers: Record<string, string>;
      timeout: number;
      followRedirects: boolean;
      maxRedirects: number;
    }
  ): Promise<HttpResponse> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;

      const requestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: options.method,
        headers: options.headers,
        timeout: options.timeout
      };

      const req = client.request(requestOptions, (res) => {
        // Handle redirects
        if (options.followRedirects && 
            res.statusCode && 
            res.statusCode >= 300 && 
            res.statusCode < 400 && 
            res.headers.location) {
          
          if (options.maxRedirects <= 0) {
            reject(new Error('Too many redirects'));
            return;
          }

          // Follow redirect
          this.makeRequest(res.headers.location, {
            ...options,
            maxRedirects: options.maxRedirects - 1
          }).then(resolve).catch(reject);
          return;
        }

        let body = '';
        
        res.on('data', (chunk) => {
          body += chunk;
        });
        
        res.on('end', () => {
          const response: HttpResponse = {
            statusCode: res.statusCode || 0,
            statusMessage: res.statusMessage || '',
            headers: res.headers as Record<string, string | string[]>,
            body,
            url
          };
          
          resolve(response);
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new TimeoutError(
          `Request timeout after ${options.timeout}ms`,
          options.timeout
        ));
      });

      req.setTimeout(options.timeout);
      req.end();
    });
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Parse JSON response safely
   */
  static parseJson<T = any>(response: HttpResponse): T {
    try {
      return JSON.parse(response.body);
    } catch (error) {
      throw new Error(`Failed to parse JSON response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if response is JSON
   */
  static isJsonResponse(response: HttpResponse): boolean {
    const contentType = response.headers['content-type'];
    return typeof contentType === 'string' && 
           contentType.toLowerCase().includes('application/json');
  }
}

// Export singleton instance
export const httpClient = new HttpClient();