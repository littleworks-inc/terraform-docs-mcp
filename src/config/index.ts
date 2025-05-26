/**
 * Configuration management for the Terraform Docs MCP server
 * Centralizes all configuration options with sensible defaults
 */

export interface AppConfig {
  server: {
    name: string;
    version: string;
    logLevel: 'error' | 'warn' | 'info' | 'debug';
  };
  
  github: {
    baseUrl: string;
    apiUrl: string;
    userAgent: string;
    timeout: number;
    maxRetries: number;
    retryDelay: number;
  };
  
  rateLimit: {
    requestsPerHour: number;
    requestsPerMinute: number;
    minInterval: number;
  };
  
  cache: {
    maxSize: number;
    defaultTtl: number;
    cleanupInterval: number;
    ttl: {
      schema: number;
      docs: number;
      repoInfo: number;
      examples: number;
      errorResponse: number;
    };
  };
  
  terraform: {
    registryBaseUrl: string;
    defaultRegion: {
      aws: string;
      google: string;
      azure: string;
    };
  };
  
  providers: {
    supportedProviders: string[];
    aliasMap: Record<string, string>;
  };
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: AppConfig = {
  server: {
    name: 'terraform-docs-mcp',
    version: '0.1.0',
    logLevel: 'error'
  },
  
  github: {
    baseUrl: 'https://github.com',
    apiUrl: 'https://api.github.com',
    userAgent: 'terraform-docs-mcp/0.1.0',
    timeout: 10000, // 10 seconds
    maxRetries: 3,
    retryDelay: 1000 // 1 second
  },
  
  rateLimit: {
    requestsPerHour: 50, // Conservative limit (GitHub allows 60 for unauthenticated)
    requestsPerMinute: 8, // Conservative limit
    minInterval: 1000 // 1 second between requests
  },
  
  cache: {
    maxSize: 1000,
    defaultTtl: 60 * 60 * 1000, // 1 hour
    cleanupInterval: 10 * 60 * 1000, // 10 minutes
    ttl: {
      schema: 24 * 60 * 60 * 1000,      // 24 hours
      docs: 6 * 60 * 60 * 1000,        // 6 hours
      repoInfo: 7 * 24 * 60 * 60 * 1000, // 1 week
      examples: 12 * 60 * 60 * 1000,    // 12 hours
      errorResponse: 5 * 60 * 1000      // 5 minutes
    }
  },
  
  terraform: {
    registryBaseUrl: 'https://registry.terraform.io',
    defaultRegion: {
      aws: 'us-west-2',
      google: 'us-central1',
      azure: 'East US'
    }
  },
  
  providers: {
    supportedProviders: [
      'aws', 'azurerm', 'azure', 'google', 'gcp', 'kubernetes',
      'docker', 'github', 'datadog', 'digitalocean', 'helm',
      'vault', 'consul', 'random', 'time', 'null', 'local'
    ],
    aliasMap: {
      'gcp': 'google',
      'azure': 'azurerm'
    }
  }
};

/**
 * Configuration class with environment variable support
 */
export class Config {
  private config: AppConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  /**
   * Load configuration from environment variables and defaults
   */
  private loadConfig(): AppConfig {
    const config = JSON.parse(JSON.stringify(DEFAULT_CONFIG)); // Deep clone
    
    // Override with environment variables if available
    if (process.env.LOG_LEVEL) {
      config.server.logLevel = process.env.LOG_LEVEL as any;
    }
    
    if (process.env.GITHUB_TIMEOUT) {
      config.github.timeout = parseInt(process.env.GITHUB_TIMEOUT, 10);
    }
    
    if (process.env.RATE_LIMIT_PER_HOUR) {
      config.rateLimit.requestsPerHour = parseInt(process.env.RATE_LIMIT_PER_HOUR, 10);
    }
    
    if (process.env.RATE_LIMIT_PER_MINUTE) {
      config.rateLimit.requestsPerMinute = parseInt(process.env.RATE_LIMIT_PER_MINUTE, 10);
    }
    
    if (process.env.CACHE_MAX_SIZE) {
      config.cache.maxSize = parseInt(process.env.CACHE_MAX_SIZE, 10);
    }
    
    if (process.env.CACHE_TTL_HOURS) {
      const hours = parseInt(process.env.CACHE_TTL_HOURS, 10);
      config.cache.defaultTtl = hours * 60 * 60 * 1000;
    }
    
    return config;
  }

  /**
   * Get server configuration
   */
  get server() {
    return this.config.server;
  }

  /**
   * Get GitHub configuration
   */
  get github() {
    return this.config.github;
  }

  /**
   * Get rate limiting configuration
   */
  get rateLimit() {
    return this.config.rateLimit;
  }

  /**
   * Get cache configuration
   */
  get cache() {
    return this.config.cache;
  }

  /**
   * Get Terraform configuration
   */
  get terraform() {
    return this.config.terraform;
  }

  /**
   * Get providers configuration
   */
  get providers() {
    return this.config.providers;
  }

  /**
   * Get normalized provider name
   */
  getNormalizedProvider(provider: string): string {
    return this.config.providers.aliasMap[provider] || provider;
  }

  /**
   * Check if provider is supported
   */
  isProviderSupported(provider: string): boolean {
    const normalized = this.getNormalizedProvider(provider);
    return this.config.providers.supportedProviders.includes(normalized);
  }

  /**
   * Get default region for provider
   */
  getDefaultRegion(provider: string): string {
    const normalized = this.getNormalizedProvider(provider);
    return this.config.terraform.defaultRegion[normalized as keyof typeof this.config.terraform.defaultRegion] || 'us-west-2';
  }

  /**
   * Get full configuration (for debugging)
   */
  getAll(): AppConfig {
    return JSON.parse(JSON.stringify(this.config)); // Return deep clone
  }

  /**
   * Update configuration at runtime
   */
  update(updates: Partial<AppConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

// Singleton instance
let configInstance: Config;

/**
 * Get configuration instance
 */
export function getConfig(): Config {
  if (!configInstance) {
    configInstance = new Config();
  }
  return configInstance;
}

/**
 * Provider repository mappings with enhanced information
 */
export const PROVIDER_REPOS: Record<string, GitHubRepo> = {
  'aws': { 
    owner: 'hashicorp', 
    name: 'terraform-provider-aws',
    defaultBranch: 'main',
    schemaPatterns: [
      'internal/service/{resource}/resource_{resource}.go',
      'internal/service/{resource}/resource_aws_{resource}.go'
    ]
  },
  'azurerm': { 
    owner: 'hashicorp', 
    name: 'terraform-provider-azurerm',
    defaultBranch: 'main',
    schemaPatterns: [
      'internal/services/{resource}/resource_arm_{resource}.go',
      'internal/services/{resource}/{resource}_resource.go'
    ]
  },
  'google': { 
    owner: 'hashicorp', 
    name: 'terraform-provider-google',
    defaultBranch: 'main',
    schemaPatterns: [
      'google/resource_{resource}.go',
      'google/services/{resource}/resource_{resource}.go'
    ]
  },
  'kubernetes': { 
    owner: 'hashicorp', 
    name: 'terraform-provider-kubernetes',
    defaultBranch: 'main',
    schemaPatterns: [
      'internal/provider/resource_{resource}.go'
    ]
  }
};

// Singleton instance
let configInstance: Config;

/**
 * Get configuration instance
 */
export function getConfig(): Config {
  if (!configInstance) {
    configInstance = new Config();
  }
  return configInstance;
}

// Export singleton instance for backward compatibility
export const config = getConfig();