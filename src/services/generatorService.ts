// src/services/generatorService.ts
import { Schema, GeneratorSchema, GeneratorSchemaAttribute } from '../models/index.js';
import { ConfigGenerationError } from '../errors/index.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('GeneratorService');

/**
 * Service for generating Terraform configurations
 */
export class GeneratorService {
  /**
   * Generate Terraform configuration based on provider, resource, schema and attributes
   */
  generateTerraformConfig(
    provider: string,
    resource: string,
    schema: GeneratorSchema,
    attributes: Record<string, any> = {}
  ): string {
    try {
      // Format the resource name to match Terraform convention
      const resourceType = `${provider}_${resource}`;
      const resourceName = this.formatResourceName(resource);
      
      // Start building the configuration with header comments
      let config = `# Terraform configuration for ${resourceType}\n`;
      config += `# Generated with terraform-docs-mcp\n\n`;
      
      // Add terraform block with required providers
      config += this.generateTerraformBlock(provider);
      
      // Add provider block with best practice configuration
      config += this.generateProviderBlock(provider, attributes);
      
      // Add locals block if needed for this resource type
      const localsBlock = this.generateLocalsBlock(provider, resource, attributes);
      if (localsBlock) {
        config += localsBlock;
      }
      
      // Add resource block
      config += `resource "${resourceType}" "${resourceName}" {\n`;
      
      // Extract and organize blocks and attributes
      const { simpleAttributes, blockAttributes } = this.categorizeAttributes(schema.attributes, attributes);
      
      // Add resource attributes based on schema and provided values
      const attributeLines = this.formatAttributes(simpleAttributes, attributes);
      config += attributeLines;
      
      // Add block attributes (nested blocks)
      if (Object.keys(blockAttributes).length > 0) {
        config += this.formatBlockAttributes(blockAttributes, attributes);
      }
      
      // Add lifecycle block if appropriate
      const lifecycleBlock = this.generateLifecycleBlock(provider, resource);
      if (lifecycleBlock) {
        config += lifecycleBlock;
      }
      
      // Add depends_on if needed
      const dependsOnBlock = this.generateDependsOnBlock(provider, resource, attributes);
      if (dependsOnBlock) {
        config += dependsOnBlock;
      }
      
      config += `}\n\n`;
      
      // Add outputs section if appropriate
      const outputs = this.generateOutputs(provider, resource, resourceName);
      if (outputs) {
        config += outputs;
      }
      
      return config;
    } catch (error) {
      throw new ConfigGenerationError(
        `Failed to generate Terraform configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
        provider,
        resource
      );
    }
  }
  
  // Other private methods from generator.ts
  // Format resource name, generate blocks, etc.
  
  /**
   * Format resource name to a valid Terraform identifier
   */
  private formatResourceName(resource: string): string {
    // Replace hyphens with underscores and make it descriptive
    const baseName = resource.replace(/-/g, '_');
    
    // Ensure the name is unique and descriptive
    return `${baseName}_example`;
  }
  
  /**
   * Generate the terraform block with required providers
   */
  private generateTerraformBlock(provider: string): string {
    // Implementation omitted for brevity
    return '';
  }
  
  /**
   * Generate provider block with best practice configuration
   */
  private generateProviderBlock(provider: string, attributes: Record<string, any>): string {
    // Implementation omitted for brevity
    return '';
  }
  
  /**
   * Generate locals block if needed for this resource type
   */
  private generateLocalsBlock(provider: string, resource: string, attributes: Record<string, any>): string | null {
    // Implementation omitted for brevity
    return null;
  }
  
  /**
   * Categorize attributes into simple attributes and block attributes
   */
  private categorizeAttributes(
    schemaAttributes: Record<string, GeneratorSchemaAttribute>,
    providedAttributes: Record<string, any> = {}
  ): { simpleAttributes: Record<string, GeneratorSchemaAttribute>, blockAttributes: Record<string, GeneratorSchemaAttribute> } {
    // Implementation omitted for brevity
    return { simpleAttributes: {}, blockAttributes: {} };
  }
  
  /**
   * Format simple attributes based on schema and provided values
   */
  private formatAttributes(
    schemaAttributes: Record<string, GeneratorSchemaAttribute>,
    providedAttributes: Record<string, any> = {}
  ): string {
    // Implementation omitted for brevity
    return '';
  }
  
  /**
   * Format block attributes (nested structures)
   */
  private formatBlockAttributes(
    blockAttributes: Record<string, GeneratorSchemaAttribute>,
    providedAttributes: Record<string, any> = {}
  ): string {
    // Implementation omitted for brevity
    return '';
  }
  
  /**
   * Generate lifecycle block if appropriate
   */
  private generateLifecycleBlock(provider: string, resource: string): string | null {
    // Implementation omitted for brevity
    return null;
  }
  
  /**
   * Generate depends_on block if needed
   */
  private generateDependsOnBlock(provider: string, resource: string, attributes: Record<string, any>): string | null {
    // Implementation omitted for brevity
    return null;
  }
  
  /**
   * Generate outputs section if appropriate
   */
  private generateOutputs(provider: string, resource: string, resourceName: string): string | null {
    // Implementation omitted for brevity
    return null;
  }
}

// Export a singleton instance
export const generatorService = new GeneratorService();