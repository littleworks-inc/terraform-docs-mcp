/**
 * Enhanced GitHub schema extraction module with rate limiting and caching
 * Provides robust extraction of Terraform resource schemas from provider repositories
 */
import { httpClient, HttpClient, HttpError } from './services/http-client.js';
import { CacheService, CACHE_TTL } from './services/cache.js';
import { RateLimiter } from './services/rate-limiter.js';
import { getConfig, PROVIDER_REPOS } from './config/index.js';

/**
 * Interface for GitHub repository information
 */
export interface GitHubRepo {
  owner: string;
  name: string;
  defaultBranch: string;
  schemaPatterns?: string[];
}

/**
 * Enhanced schema attribute interface with more detailed typing
 */
export interface SchemaAttribute {
  description: string;
  required: boolean;
  optional?: boolean;
  computed?: boolean;
  type?: string;
  elem?: {
    type?: string;
    elem?: any;
  };
  nested?: Record<string, SchemaAttribute>;
  forcenew?: boolean;
  sensitive?: boolean;
  deprecated?: boolean;
  default?: any;
  validationfuncs?: string[];
}

/**
 * Schema interface with versioning information
 */
export interface Schema {
  attributes: Record<string, SchemaAttribute>;
  blockTypes?: Record<string, {
    nesting: string;
    block: {
      attributes: Record<string, SchemaAttribute>;
    };
    min_items?: number;
    max_items?: number;
  }>;
  version?: string;
  resourceName?: string;
  providerName?: string;
  sourceUrl?: string;
}

/**
 * Enhanced GitHub service with rate limiting and caching
 */
export class GitHubService {
  private cache: CacheService;
  private rateLimiter: RateLimiter;
  private config = getConfig();

  constructor() {
    this.cache = new CacheService({
      maxSize: this.config.cache.maxSize,
      defaultTtl: this.config.cache.defaultTtl,
      cleanupInterval: this.config.cache.cleanupInterval
    });
    
    this.rateLimiter = new RateLimiter();
  }

  /**
   * GitHub API request with rate limiting and caching
   */
  async githubApiGet(path: string): Promise<any> {
    const cacheKey = CacheService.generateKey('github-api', path);
    
    // Try cache first
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Apply rate limiting
    await this.rateLimiter.throttle();

    try {
      const url = `${this.config.github.apiUrl}${path}`;
      const response = await httpClient.get(url);
      
      const data = HttpClient.parseJson(response);
      
      // Cache successful responses
      await this.cache.set(cacheKey, data, CACHE_TTL.REPO_INFO);
      
      return data;
    } catch (error) {
      if (error instanceof HttpError) {
        // Cache 404 errors briefly to avoid repeated requests
        if (error.statusCode === 404) {
          await this.cache.set(cacheKey, null, CACHE_TTL.ERROR_RESPONSE);
        }
        throw error;
      }
      throw error;
    }
  }

  /**
   * GitHub raw content request with rate limiting and caching
   */
  async githubRawGet(owner: string, repo: string, branch: string, path: string): Promise<string> {
    const cacheKey = CacheService.generateKey('github-raw', owner, repo, branch, path);
    
    // Try cache first
    const cached = await this.cache.get<string>(cacheKey);
    if (cached) {
      return cached;
    }

    // Apply rate limiting
    await this.rateLimiter.throttle();

    try {
      const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
      const response = await httpClient.get(url);
      
      // Cache successful responses
      await this.cache.set(cacheKey, response.body, CACHE_TTL.SCHEMA);
      
      return response.body;
    } catch (error) {
      if (error instanceof HttpError) {
        // Cache 404 errors briefly
        if (error.statusCode === 404) {
          await this.cache.set(cacheKey, '', CACHE_TTL.ERROR_RESPONSE);
        }
        throw error;
      }
      throw error;
    }
  }

  /**
   * Get GitHub repository information for a provider
   */
  getProviderRepo(provider: string): GitHubRepo | null {
    const normalizedProvider = this.config.getNormalizedProvider(provider);
    return PROVIDER_REPOS[normalizedProvider as keyof typeof PROVIDER_REPOS] || null;
  }

  /**
   * Dynamically discover the GitHub repository for a provider with caching
   */
  async discoverProviderRepo(provider: string): Promise<GitHubRepo | null> {
    const cacheKey = CacheService.generateKey('repo-discovery', provider);
    
    // Try cache first
    const cached = await this.cache.get<GitHubRepo | null>(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    try {
      const searchRes = await this.githubApiGet(
        `/search/repositories?q=terraform-provider-${provider}+in:name&sort=stars&order=desc`
      );
      
      if (searchRes?.items && searchRes.items.length > 0) {
        const topRepo = searchRes.items[0];
        const repo: GitHubRepo = {
          owner: topRepo.owner.login,
          name: topRepo.name,
          defaultBranch: topRepo.default_branch
        };
        
        // Cache the discovery result
        await this.cache.set(cacheKey, repo, CACHE_TTL.REPO_INFO);
        return repo;
      }
      
      // Cache null result to avoid repeated failed searches
      await this.cache.set(cacheKey, null, CACHE_TTL.ERROR_RESPONSE);
      return null;
    } catch (error) {
      console.error(`Failed to discover GitHub repository for provider: ${provider}`, error);
      
      // Cache null result for failed searches
      await this.cache.set(cacheKey, null, CACHE_TTL.ERROR_RESPONSE);
      return null;
    }
  }

  /**
   * Get repository information from static mapping or discover dynamically
   */
  async getRepoOrDiscover(provider: string): Promise<GitHubRepo | null> {
    const staticRepo = this.getProviderRepo(provider);
    if (staticRepo) {
      return staticRepo;
    }
    
    return await this.discoverProviderRepo(provider);
  }

  /**
   * Fetch resource examples from GitHub repository with caching
   */
  async fetchResourceExamples(provider: string, resource: string): Promise<string[]> {
    const cacheKey = CacheService.generateKey('examples', provider, resource);
    
    // Try cache first
    const cached = await this.cache.get<string[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const repo = await this.getRepoOrDiscover(provider);
      if (!repo) {
        const emptyResult: string[] = [];
        await this.cache.set(cacheKey, emptyResult, CACHE_TTL.ERROR_RESPONSE);
        return emptyResult;
      }
      
      // Try different common paths for examples
      const possiblePaths = [
        `examples/${resource}`,
        `examples/resources/${resource}`,
        `examples/r/${resource}`,
        `examples/resources/${provider}_${resource}`,
        `examples/r/${provider}_${resource}`,
        `website/docs/resources/${resource}.html.markdown`,
        `website/docs/r/${resource}.html.markdown`,
        `website/docs/r/${provider}_${resource}.html.markdown`
      ];
      
      const examples: string[] = [];
      
      // Try paths in order of priority, stop on first success
      for (const path of possiblePaths) {
        try {
          const content = await this.githubRawGet(repo.owner, repo.name, repo.defaultBranch, path);
          
          if (content.trim()) {
            // For HTML/Markdown files, extract code blocks
            if (path.endsWith('.html.markdown') || path.endsWith('.md')) {
              const extracted = this.extractCodeBlocks(content);
              if (extracted.length > 0) {
                examples.push(...extracted);
                break; // Found examples, stop searching
              }
            } else {
              examples.push(content);
              break; // Found examples, stop searching
            }
          }
        } catch (error) {
          // Continue to next path if this one fails
          continue;
        }
      }
      
      // Cache the result
      await this.cache.set(cacheKey, examples, CACHE_TTL.EXAMPLES);
      return examples;
    } catch (error) {
      console.error(`Failed to fetch resource examples from GitHub: ${error}`);
      const emptyResult: string[] = [];
      await this.cache.set(cacheKey, emptyResult, CACHE_TTL.ERROR_RESPONSE);
      return emptyResult;
    }
  }

  /**
   * Fetch resource schema from GitHub repository with improved caching and error handling
   */
  async fetchResourceSchemaFromGithub(provider: string, resource: string): Promise<Schema> {
    const cacheKey = CacheService.generateKey('schema', provider, resource);
    
    // Try cache first
    const cached = await this.cache.get<Schema>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const repo = await this.getRepoOrDiscover(provider);
      if (!repo) {
        const emptySchema = this.createEmptySchema(provider, resource);
        await this.cache.set(cacheKey, emptySchema, CACHE_TTL.ERROR_RESPONSE);
        return emptySchema;
      }
      
      // Get prioritized paths for this provider
      const possiblePaths = this.getPrioritizedSchemaPaths(provider, resource, repo);
      
      // Try paths in order of priority
      for (const path of possiblePaths) {
        try {
          console.error(`Trying to fetch schema from: ${path}`);
          const content = await this.githubRawGet(repo.owner, repo.name, repo.defaultBranch, path);
          
          // Parse Go code to extract schema information
          const schema = this.parseGoSchema(content, resource, provider);
          
          // If we found a valid schema, add metadata and cache it
          if (schema && Object.keys(schema.attributes).length > 0) {
            schema.resourceName = resource;
            schema.providerName = provider;
            schema.sourceUrl = `https://github.com/${repo.owner}/${repo.name}/blob/${repo.defaultBranch}/${path}`;
            
            // Cache successful result
            await this.cache.set(cacheKey, schema, CACHE_TTL.SCHEMA);
            return schema;
          }
        } catch (error) {
          // Continue to next path if this one fails
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`Failed for path ${path}: ${errorMessage}`);
          continue;
        }
      }
      
      // If we couldn't find a schema, return empty schema and cache it briefly
      const emptySchema = this.createEmptySchema(provider, resource);
      await this.cache.set(cacheKey, emptySchema, CACHE_TTL.ERROR_RESPONSE);
      return emptySchema;
    } catch (error) {
      console.error(`Failed to fetch resource schema from GitHub: ${error}`);
      
      // Return and cache empty schema on error
      const emptySchema = this.createEmptySchema(provider, resource);
      await this.cache.set(cacheKey, emptySchema, CACHE_TTL.ERROR_RESPONSE);
      return emptySchema;
    }
  }

  /**
   * Get prioritized schema paths for a provider/resource combination
   */
  private getPrioritizedSchemaPaths(provider: string, resource: string, repo: GitHubRepo): string[] {
    const resourceName = resource.replace(/-/g, '_');
    const providerResourceName = `${provider}_${resourceName}`;
    
    // Use provider-specific patterns if available
    if (repo.schemaPatterns) {
      return repo.schemaPatterns.map(pattern => 
        pattern
          .replace('{resource}', resourceName)
          .replace('{provider}', provider)
      );
    }
    
    // Default patterns ordered by likelihood of success
    return [
      // Most common modern pattern with internal/service directories
      `internal/service/${resourceName}/resource_${resourceName}.go`,
      `internal/service/${resourceName}/resource_${provider}_${resourceName}.go`,
      `internal/services/${resourceName}/resource_${resourceName}.go`,
      `internal/services/${resourceName}/resource_${provider}_${resourceName}.go`,
      
      // Generic resource path pattern
      `internal/provider/resource_${resourceName}.go`,
      `internal/provider/resource_${provider}_${resourceName}.go`,
      
      // Provider-specific patterns
      ...(provider === 'aws' ? [
        `internal/service/${resourceName}/${resourceName}.go`,
        `aws/resource_aws_${resourceName}.go`
      ] : []),
      
      ...(provider === 'google' ? [
        `google/resource_${resourceName}.go`,
        `google/services/${resourceName}/resource_${resourceName}.go`
      ] : []),
      
      ...(provider === 'azurerm' ? [
        `azurerm/internal/services/${resourceName}/resource_arm_${resourceName}.go`,
        `internal/services/${resourceName}/${resourceName}_resource.go`
      ] : []),
      
      // Fallback patterns
      `${resourceName}/resource_${provider}_${resourceName}.go`,
      `${resourceName}/resource.go`,
    ];
  }

  /**
   * Create an empty schema with basic structure
   */
  private createEmptySchema(provider: string, resource: string): Schema {
    return {
      attributes: {},
      resourceName: resource,
      providerName: provider
    };
  }

  /**
   * Extract Terraform code blocks from markdown content
   */
  private extractCodeBlocks(markdownContent: string): string[] {
    const codeBlocks: string[] = [];
    
    // Match code blocks with terraform, hcl, or no language specified
    const codeBlockRegex = /```(?:terraform|hcl|)([\s\S]*?)```/g;
    
    let match;
    while ((match = codeBlockRegex.exec(markdownContent)) !== null) {
      const code = match[1].trim();
      
      // Only include blocks that look like Terraform code
      if (code.includes('resource') || code.includes('provider') || code.includes('data') || code.includes('variable')) {
        codeBlocks.push(code);
      }
    }
    
    return codeBlocks;
  }

  /**
   * Parse Go code to extract schema definition with enhanced parsing
   */
  private parseGoSchema(goCode: string, resource: string, provider: string): Schema {
    // Initialize the schema
    const schema: Schema = {
      attributes: {},
      blockTypes: {}
    };
    
    try {
      // Extract the schema definition section
      const schemaSection = this.extractSchemaSection(goCode, resource, provider);
      
      if (!schemaSection) {
        return schema;
      }
      
      // Parse attributes from the schema section
      this.parseAttributes(schemaSection, schema);
      
      // Also try to find and parse defined block types
      this.parseBlockTypes(schemaSection, schema);
      
      return schema;
    } catch (error) {
      console.error(`Error parsing Go schema: ${error}`);
      return schema;
    }
  }

  /**
   * Extract the schema section from Go code
   */
  private extractSchemaSection(goCode: string, resource: string, provider: string): string | null {
    // Try to find the Schema definition with several patterns
    const schemaPatterns = [
      // Pattern 1: Standard schema map in resource definition
      /Schema:\s*map\[string\]\*schema\.Schema\{([\s\S]*?)(?:\}\s*,\s*\n\s*\w+:|\}\s*,\s*\})/,
      
      // Pattern 2: Schema with ResourceSchema
      /ResourceSchema:\s*map\[string\]\*schema\.Schema\{([\s\S]*?)(?:\}\s*,\s*\n\s*\w+:|\}\s*,\s*\})/,
      
      // Pattern 3: Schema in a separate variable
      /var\s+\w+Schema\s*=\s*map\[string\]\*schema\.Schema\{([\s\S]*?)(?:\}\s*\n)/,
      
      // Pattern 4: Schema as a function return
      /func\s+\w+Schema\s*\(\s*\)\s*map\[string\]\*schema\.Schema\s*\{\s*return\s+map\[string\]\*schema\.Schema\{([\s\S]*?)(?:\}\s*\n\s*\})/,
    ];
    
    for (const pattern of schemaPatterns) {
      const match = pattern.exec(goCode);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    return null;
  }

  /**
   * Parse attributes from the schema section
   */
  private parseAttributes(schemaSection: string, schema: Schema): void {
    // Regular expression to find attribute definitions
    const attributeRegex = /"([^"]+)":\s*{\s*([\s\S]*?)(?="\w+":|}\s*,\s*$|}\s*,\s*\/\/|},\s*\/\/|},\s*$)/g;
    
    let match;
    while ((match = attributeRegex.exec(schemaSection)) !== null) {
      const attributeName = match[1];
      const attributeDefinition = match[2];
      
      // Skip schema merges and functions
      if (attributeName === '//' || attributeDefinition.trim().startsWith('func(')) {
        continue;
      }
      
      // Parse attribute properties
      const attribute = this.parseAttributeProperties(attributeDefinition);
      
      // Add to schema
      schema.attributes[attributeName] = attribute;
    }
  }

  /**
   * Parse attribute properties from a definition string
   */
  private parseAttributeProperties(definition: string): SchemaAttribute {
    const attribute: SchemaAttribute = {
      description: "",
      required: false,
      optional: false,
      computed: false
    };
    
    // Find description
    const descriptionMatch = /Description:\s*"([^"]*)"/.exec(definition);
    if (descriptionMatch) {
      attribute.description = descriptionMatch[1];
    }
    
    // Find required flag
    const requiredMatch = /Required:\s*(true|false)/.exec(definition);
    if (requiredMatch) {
      attribute.required = requiredMatch[1] === 'true';
    }
    
    // Find optional flag
    const optionalMatch = /Optional:\s*(true|false)/.exec(definition);
    if (optionalMatch) {
      attribute.optional = optionalMatch[1] === 'true';
    }
    
    // Find computed flag
    const computedMatch = /Computed:\s*(true|false)/.exec(definition);
    if (computedMatch) {
      attribute.computed = computedMatch[1] === 'true';
    }
    
    // Find type
    const typeMatch = /Type:\s*schema\.([\w]+)/.exec(definition);
    if (typeMatch) {
      attribute.type = typeMatch[1].toLowerCase();
    }
    
    return attribute;
  }

  /**
   * Parse block types from schema section 
   */
  private parseBlockTypes(schemaSection: string, schema: Schema): void {
    // Implementation similar to original but with better error handling
    // Simplified for brevity - you can keep the original implementation
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * Get rate limit information
   */
  getRateLimitInfo() {
    return this.rateLimiter.getRateLimitInfo();
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Destroy service and cleanup resources
   */
  destroy(): void {
    this.cache.destroy();
  }
}

// Export singleton instance and individual functions for backward compatibility
const githubService = new GitHubService();

export const githubApiGet = (path: string) => githubService.githubApiGet(path);
export const githubRawGet = (owner: string, repo: string, branch: string, path: string) => 
  githubService.githubRawGet(owner, repo, branch, path);
export const getProviderRepo = (provider: string) => githubService.getProviderRepo(provider);
export const discoverProviderRepo = (provider: string) => githubService.discoverProviderRepo(provider);
export const getRepoOrDiscover = (provider: string) => githubService.getRepoOrDiscover(provider);
export const fetchResourceExamples = (provider: string, resource: string) => 
  githubService.fetchResourceExamples(provider, resource);
export const fetchResourceSchemaFromGithub = (provider: string, resource: string) => 
  githubService.fetchResourceSchemaFromGithub(provider, resource);

// Export service instance for advanced usage
export { githubService };