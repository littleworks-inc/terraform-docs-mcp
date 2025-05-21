// src/utils/http.ts
import * as https from 'https';
import { Logger } from './logger.js';

const logger = new Logger('HTTP');

/**
 * Options for HTTP requests
 */
export interface HttpRequestOptions {
  hostname: string;
  path: string;
  method?: string;
  headers?: Record<string, string>;
  timeout?: number;
}

/**
 * HTTP response
 */
export interface HttpResponse {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

/**
 * Make an HTTP request
 */
export async function httpRequest(options: HttpRequestOptions): Promise<HttpResponse> {
  return new Promise<HttpResponse>((resolve, reject) => {
    const requestOptions: https.RequestOptions = {
      hostname: options.hostname,
      path: options.path,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: options.timeout || 30000 // Default 30s timeout
    };
    
    logger.debug(`HTTP ${requestOptions.method} ${requestOptions.hostname}${requestOptions.path}`);
    
    const req = https.request(requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const response: HttpResponse = {
          statusCode: res.statusCode || 0,
          headers: res.headers,
          body: data
        };
        
        logger.debug(`HTTP response: ${response.statusCode}`);
        resolve(response);
      });
    });
    
    req.on('error', (err) => {
      logger.error(`HTTP request error`, err);
      reject(err);
    });
    
    req.on('timeout', () => {
      logger.error(`HTTP request timeout: ${requestOptions.hostname}${requestOptions.path}`);
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

/**
 * Simple HTTP GET request
 */
export async function httpGet(url: string, headers?: Record<string, string>): Promise<string> {
  // Parse URL
  const urlObj = new URL(url);
  
  const options: HttpRequestOptions = {
    hostname: urlObj.hostname,
    path: `${urlObj.pathname}${urlObj.search}`,
    method: 'GET',
    headers
  };
  
  const response = await httpRequest(options);
  
  if (response.statusCode >= 200 && response.statusCode < 300) {
    return response.body;
  }
  
  throw new Error(`HTTP error: ${response.statusCode}`);
}