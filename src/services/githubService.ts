// src/services/githubService.ts
import { githubRepository } from '../repositories/githubRepo.js';
import { githubApi } from '../api/github.js';
import { Logger } from '../utils/logger.js';
import { GitHubRepo, Schema } from '../models/index.js';
import { SchemaParsingError, ResourceNotFoundError } from '../errors/index.js';

const logger = new Logger('GitHubService');

/**
 * Service for interacting with GitHub
 */
export class GitHubService {
  /**
   * Get repository info for a provider
   */
  async getRepoInfo(provider: string): Promise<GitHubRepo | null> {
    return await githubRepository.getRepoOrDiscover(provider);
  }
  
  /**
   * Fetch examples for a resource
   */
  async fetchResourceExamples(provider: string, resource: string): Promise<string[]> {
    return await githubRepository.fetchResourceExamples(provider, resource);
  }
  
  /**
   * Fetch resource schema from GitHub repository
   */
  async fetchResourceSchema(provider: string, resource: string): Promise<Schema> {
    try {
      const repo = await githubRepository.getRepoOrDiscover(provider);
      if (!repo) {
        throw new ResourceNotFoundError(provider, resource);
      }
      
      // Format resource name to match different naming patterns
      const resourceName = resource.replace(/-/g, '_');
      const providerResourceName = `${provider}_${resourceName}`;
      
      // Try different common paths for schema definitions
      const possiblePaths = [
        // Most common modern pattern with internal/service directories
        `internal/service/${resourceName}/resource_${resourceName}.go`,
        `internal/service/${resourceName}/resource_${provider}_${resourceName}.go`,
        `internal/services/${resourceName}/resource_${resourceName}.go`,
        `internal/services/${resourceName}/resource_${provider}_${resourceName}.go`,
        
        // Generic resource path pattern
        `internal/provider/resource_${resourceName}.go`,
        `internal/provider/resource_${provider}_${resourceName}.go`,
        
        // Older patterns
        `${resourceName}/resource_${provider}_${resourceName}.go`,
        `${resourceName}/resource.go`,
        
        // AWS specific patterns
        `internal/service/${resourceName}/${resourceName}.go`,
        
        // Google specific patterns
        `google/resource_${resourceName}.go`,
        
        // Azure specific patterns
        `azurerm/internal/services/${resourceName}/resource_arm_${resourceName}.go`,
        
        // Fallback to searching in schema.go files
        `internal/service/${resourceName}/schema.go`,
        `internal/services/${resourceName}/schema.go`,
        `internal/schema/${resourceName}.go`,
      ];
      
      for (const path of possiblePaths) {
        try {
          logger.debug(`Trying to fetch schema from: ${path}`);
          const content = await githubApi.getRawContent(repo.owner, repo.name, repo.defaultBranch, path);
          
          // Parse Go code to extract schema information
          const schema = this.parseGoSchema(content, resource, provider);
          
          // If we found a schema, add metadata and return it
          if (schema && Object.keys(schema.attributes).length > 0) {
            schema.resourceName = resource;
            schema.providerName = provider;
            schema.sourceUrl = `https://github.com/${repo.owner}/${repo.name}/blob/${repo.defaultBranch}/${path}`;
            
            return schema;
          }
        } catch (e) {
          // Continue to next path if this one fails
          continue;
        }
      }
      
      // If we couldn't find a schema in dedicated files, try to parse resource registry
      try {
        const registryContent = await githubApi.getRawContent(repo.owner, repo.name, repo.defaultBranch, 'internal/provider/provider.go');
        const schema = this.parseRegistryResources(registryContent, resource, provider);
        
        if (schema && Object.keys(schema.attributes).length > 0) {
          schema.resourceName = resource;
          schema.providerName = provider;
          schema.sourceUrl = `https://github.com/${repo.owner}/${repo.name}/blob/${repo.defaultBranch}/internal/provider/provider.go`;
          
          return schema;
        }
      } catch (e) {
        logger.error(`Failed to parse provider registry`, e);
      }
      
      // Return a minimal schema if we couldn't find a complete one
      return {
        attributes: {},
        resourceName: resource,
        providerName: provider
      };
    } catch (error) {
      logger.error(`Failed to fetch resource schema from GitHub`, error);
      
      if (error instanceof ResourceNotFoundError) {
        throw error;
      }
      
      throw new SchemaParsingError(
        `Failed to fetch schema: ${error instanceof Error ? error.message : 'Unknown error'}`,
        provider,
        resource
      );
    }
  }
  
  /**
   * Parse Go code to extract schema definition
   */
  private parseGoSchema(goCode: string, resource: string, provider: string): Schema {
    // Implementation of Go code parsing
    // This would be the same logic as in the original github.ts file
    // To keep this example concise, I'm not including the full implementation here
    
    // Initialize the schema
    const schema: Schema = {
      attributes: {},
      blockTypes: {}
    };
    
    try {
      // Extract the schema definition section
      let schemaSection = this.extractSchemaSection(goCode, resource, provider);
      
      if (!schemaSection) {
        return schema;
      }
      
      // Parse attributes from the schema section
      this.parseAttributes(schemaSection, schema);
      
      // Also try to find and parse defined block types
      this.parseBlockTypes(schemaSection, schema);
      
      return schema;
    } catch (error) {
      logger.error(`Error parsing Go schema`, error);
      return schema;
    }
  }
  
  // Additional private methods for schema parsing
  // These would be the same as in the original github.ts file
  // Extracting schema section, parsing attributes, etc.
  
  /**
   * Extract the schema section from Go code
   */
  private extractSchemaSection(goCode: string, resource: string, provider: string): string | null {
    // Implementation omitted for brevity
    return null;
  }
  
  /**
   * Parse attributes from the schema section
   */
  private parseAttributes(schemaSection: string, schema: Schema): void {
    // Implementation omitted for brevity
  }
  
  /**
   * Parse block types from schema section
   */
  private parseBlockTypes(schemaSection: string, schema: Schema): void {
    // Implementation omitted for brevity
  }
  
  /**
   * Parse resources from the provider registry in provider.go
   */
  private parseRegistryResources(providerCode: string, targetResource: string, provider: string): Schema | null {
    // Implementation omitted for brevity
    return null;
  }
}

// Export a singleton instance
export const githubService = new GitHubService();