// src/errors.ts
/**
 * Base error class for the application
 */
export class TerraformDocsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    // Restore prototype chain in Node.js
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when GitHub API requests fail
 */
export class GitHubApiError extends TerraformDocsError {
  constructor(message: string, public readonly path?: string, public readonly statusCode?: number) {
    super(`GitHub API Error: ${message}${path ? ` (path: ${path})` : ''}${statusCode ? ` (status: ${statusCode})` : ''}`);
  }
}

/**
 * Error thrown when schema parsing fails
 */
export class SchemaParsingError extends TerraformDocsError {
  constructor(message: string, public readonly provider?: string, public readonly resource?: string) {
    super(`Schema Parsing Error: ${message}${provider ? ` (provider: ${provider})` : ''}${resource ? ` (resource: ${resource})` : ''}`);
  }
}

/**
 * Error thrown when config generation fails
 */
export class ConfigGenerationError extends TerraformDocsError {
  constructor(message: string, public readonly provider?: string, public readonly resource?: string) {
    super(`Config Generation Error: ${message}${provider ? ` (provider: ${provider})` : ''}${resource ? ` (resource: ${resource})` : ''}`);
  }
}

/**
 * Error thrown when resource information cannot be found
 */
export class ResourceNotFoundError extends TerraformDocsError {
  constructor(public readonly provider: string, public readonly resource: string) {
    super(`Resource Not Found: ${provider}_${resource}`);
  }
}

/**
 * Error thrown when provider information cannot be found
 */
export class ProviderNotFoundError extends TerraformDocsError {
  constructor(public readonly provider: string) {
    super(`Provider Not Found: ${provider}`);
  }
}