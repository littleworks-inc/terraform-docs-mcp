/**
 * Custom error classes for better error handling and debugging
 */

/**
 * Base error class for all application errors
 */
export abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;

  constructor(
    message: string,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON for logging
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      context: this.context,
      stack: this.stack
    };
  }
}

/**
 * GitHub API related errors
 */
export class GitHubApiError extends AppError {
  readonly code = 'GITHUB_API_ERROR';
  readonly statusCode = 502;

  constructor(
    message: string,
    public readonly httpStatusCode?: number,
    public readonly rateLimit?: {
      remaining: number;
      resetTime: number;
    },
    context?: Record<string, any>
  ) {
    super(message, context);
  }
}

/**
 * Rate limiting errors
 */
export class RateLimitError extends AppError {
  readonly code = 'RATE_LIMIT_ERROR';
  readonly statusCode = 429;

  constructor(
    message: string,
    public readonly retryAfter: number,
    context?: Record<string, any>
  ) {
    super(message, context);
  }
}

/**
 * Schema parsing errors
 */
export class SchemaParseError extends AppError {
  readonly code = 'SCHEMA_PARSE_ERROR';
  readonly statusCode = 400;

  constructor(
    message: string,
    public readonly provider: string,
    public readonly resource: string,
    context?: Record<string, any>
  ) {
    super(message, context);
  }
}

/**
 * Configuration generation errors
 */
export class ConfigGenerationError extends AppError {
  readonly code = 'CONFIG_GENERATION_ERROR';
  readonly statusCode = 400;

  constructor(
    message: string,
    public readonly provider: string,
    public readonly resource: string,
    context?: Record<string, any>
  ) {
    super(message, context);
  }
}

/**
 * Provider not supported errors
 */
export class ProviderNotSupportedError extends AppError {
  readonly code = 'PROVIDER_NOT_SUPPORTED';
  readonly statusCode = 400;

  constructor(
    provider: string,
    supportedProviders: string[],
    context?: Record<string, any>
  ) {
    super(
      `Provider '${provider}' is not supported. Supported providers: ${supportedProviders.join(', ')}`,
      context
    );
  }
}

/**
 * Cache errors
 */
export class CacheError extends AppError {
  readonly code = 'CACHE_ERROR';
  readonly statusCode = 500;

  constructor(
    message: string,
    public readonly operation: 'get' | 'set' | 'delete' | 'clear',
    context?: Record<string, any>
  ) {
    super(message, context);
  }
}

/**
 * Validation errors
 */
export class ValidationError extends AppError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;

  constructor(
    message: string,
    public readonly field: string,
    public readonly value: any,
    context?: Record<string, any>
  ) {
    super(message, context);
  }
}

/**
 * Timeout errors
 */
export class TimeoutError extends AppError {
  readonly code = 'TIMEOUT_ERROR';
  readonly statusCode = 408;

  constructor(
    message: string,
    public readonly timeoutMs: number,
    context?: Record<string, any>
  ) {
    super(message, context);
  }
}

/**
 * Resource not found errors
 */
export class ResourceNotFoundError extends AppError {
  readonly code = 'RESOURCE_NOT_FOUND';
  readonly statusCode = 404;

  constructor(
    resourceType: string,
    identifier: string,
    context?: Record<string, any>
  ) {
    super(`${resourceType} '${identifier}' not found`, context);
  }
}

/**
 * Error handler utility
 */
export class ErrorHandler {
  /**
   * Check if error is an instance of AppError
   */
  static isAppError(error: any): error is AppError {
    return error instanceof AppError;
  }

  /**
   * Convert any error to AppError
   */
  static toAppError(error: any, context?: Record<string, any>): AppError {
    if (ErrorHandler.isAppError(error)) {
      return error;
    }

    // Handle known error types
    if (error.name === 'TimeoutError') {
      return new TimeoutError(
        error.message || 'Request timeout',
        error.timeout || 0,
        context
      );
    }

    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return new GitHubApiError(
        `Network error: ${error.message}`,
        undefined,
        undefined,
        { ...context, originalError: error }
      );
    }

    // Generic error
    return new class extends AppError {
      readonly code = 'UNKNOWN_ERROR';
      readonly statusCode = 500;
    }(
      error.message || 'An unknown error occurred',
      { ...context, originalError: error }
    );
  }

  /**
   * Log error with appropriate level
   */
  static logError(error: any, context?: Record<string, any>): void {
    const appError = ErrorHandler.toAppError(error, context);
    
    const logData = {
      ...appError.toJSON(),
      timestamp: new Date().toISOString()
    };

    // Use console.error for MCP server (logs go to stderr)
    if (appError.statusCode >= 500) {
      console.error('CRITICAL ERROR:', JSON.stringify(logData, null, 2));
    } else if (appError.statusCode >= 400) {
      console.error('ERROR:', JSON.stringify(logData, null, 2));
    } else {
      console.error('WARNING:', JSON.stringify(logData, null, 2));
    }
  }

  /**
   * Create error response for MCP
   */
  static createErrorResponse(error: any, context?: Record<string, any>) {
    const appError = ErrorHandler.toAppError(error, context);
    
    return {
      error: {
        code: appError.code,
        message: appError.message,
        details: appError.context
      }
    };
  }
}

/**
 * Async wrapper for better error handling
 */
export function asyncHandler<T extends any[], R>(
  fn: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      ErrorHandler.logError(error, { function: fn.name, args });
      throw ErrorHandler.toAppError(error);
    }
  };
}

/**
 * Schema parsing errors (alias for backward compatibility)
 */
export class SchemaParsingError extends SchemaParseError {
  constructor(
    message: string,
    provider: string,
    resource: string,
    context?: Record<string, any>
  ) {
    super(message, provider, resource, context);
  }
}

/**
 * Provider not found errors 
 */
export class ProviderNotFoundError extends AppError {
  readonly code = 'PROVIDER_NOT_FOUND';
  readonly statusCode = 404;

  constructor(
    provider: string,
    context?: Record<string, any>
  ) {
    super(`Provider '${provider}' not found`, context);
  }
}