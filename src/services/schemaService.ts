// src/services/schemaService.ts
import { githubService } from './githubService.js';
import { Logger } from '../utils/logger.js';
import { 
  Schema as GitHubSchema, 
  SchemaAttribute as GitHubSchemaAttribute,
  GeneratorSchema, 
  GeneratorSchemaAttribute,
  ApiSchema
} from '../models/index.js';
import { SchemaParsingError, ResourceNotFoundError } from '../errors/index.js';

const logger = new Logger('SchemaService');

/**
 * Service for handling Terraform resource schemas
 */
export class SchemaService {
  /**
   * Convert GitHub schema to Generator schema format
   */
  convertGitHubSchemaToGeneratorSchema(githubSchema: GitHubSchema): GeneratorSchema {
    try {
      const result: GeneratorSchema = {
        attributes: {}
      };
      
      // Process regular attributes
      for (const [name, attr] of Object.entries(githubSchema.attributes)) {
        result.attributes[name] = this.convertAttribute(attr);
      }
      
      // Process block types
      if (githubSchema.blockTypes) {
        for (const [blockName, blockType] of Object.entries(githubSchema.blockTypes)) {
          // Add block type as a complex attribute
          const blockAttr: GeneratorSchemaAttribute = {
            description: `Configuration block for ${blockName}`,
            required: blockType.min_items ? blockType.min_items > 0 : false,
            type: blockType.nesting.toLowerCase(),
            nested: {}
          };
          
          // Add nested attributes within the block
          for (const [nestedName, nestedAttr] of Object.entries(blockType.block.attributes)) {
            if (blockAttr.nested) {
              blockAttr.nested[nestedName] = this.convertAttribute(nestedAttr);
            }
          }
          
          result.attributes[blockName] = blockAttr;
        }
      }
      
      return result;
    } catch (error) {
      throw new SchemaParsingError(
        `Failed to convert GitHub schema to generator schema: ${error instanceof Error ? error.message : 'Unknown error'}`,
        githubSchema.providerName,
        githubSchema.resourceName
      );
    }
  }
  
  /**
   * Convert individual attribute from GitHub format to Generator format
   */
  private convertAttribute(githubAttr: GitHubSchemaAttribute): GeneratorSchemaAttribute {
    try {
      const result: GeneratorSchemaAttribute = {
        description: githubAttr.description || "",
        required: githubAttr.required || false
      };
      
      // Copy type
      if (githubAttr.type) {
        result.type = githubAttr.type;
      }
      
      // Handle element type for collections
      if (githubAttr.elem) {
        result.elem = { ...githubAttr.elem };
      }
      
      // Handle nested attributes
      if (githubAttr.nested) {
        result.nested = {};
        for (const [nestedName, nestedAttr] of Object.entries(githubAttr.nested)) {
          result.nested[nestedName] = this.convertAttribute(nestedAttr);
        }
      }
      
      return result;
    } catch (error) {
      throw new SchemaParsingError(
        `Failed to convert attribute: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
  
  /**
   * Check if a schema has useful content
   */
  isValidSchema(schema: GitHubSchema): boolean {
    // Check if it has any attributes
    if (Object.keys(schema.attributes).length === 0) {
      return false;
    }
    
    // Check for required attributes, which would indicate a more complete schema
    const hasRequiredAttrs = Object.values(schema.attributes).some(attr => attr.required);
    
    // Check for block types
    const hasBlocks = schema.blockTypes && Object.keys(schema.blockTypes).length > 0;
    
    return hasRequiredAttrs || hasBlocks || false;
  }
  
  /**
   * Fetch resource schema with enhanced extraction
   */
  async fetchEnhancedResourceSchema(
    provider: string, 
    resource: string,
    useGithub: boolean = true
  ): Promise<GeneratorSchema> {
    if (!useGithub) {
      // Return a basic schema if GitHub is not requested
      return this.createBasicSchema(provider, resource);
    }
    
    try {
      // Try to fetch from GitHub first
      const githubSchema = await githubService.fetchResourceSchema(provider, resource);
      
      // Check if the schema is valid and useful
      if (this.isValidSchema(githubSchema)) {
        return this.convertGitHubSchemaToGeneratorSchema(githubSchema);
      } else {
        logger.warn(`Schema for ${provider}_${resource} is not valid or incomplete, using fallback`);
        
        // Fallback to basic schema
        const basicSchema = this.createBasicSchema(provider, resource);
        
        // Merge any attributes we found from GitHub
        return {
          attributes: {
            ...this.convertGitHubSchemaToGeneratorSchema(githubSchema).attributes,
            ...basicSchema.attributes
          }
        };
      }
    } catch (error) {
      logger.error(`Error fetching enhanced schema: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Create a new error with proper context
      throw new SchemaParsingError(
        `Failed to fetch enhanced resource schema: ${error instanceof Error ? error.message : 'Unknown error'}`,
        provider,
        resource
      );
    }
  }
  
  /**
   * Convert generator schema to API schema format
   */
  convertToApiSchema(generatorSchema: GeneratorSchema): ApiSchema {
    const apiSchema: ApiSchema = {
      attributes: {}
    };
    
    for (const [name, attr] of Object.entries(generatorSchema.attributes)) {
      apiSchema.attributes[name] = {
        description: attr.description,
        required: attr.required,
        type: attr.type,
        nested: attr.nested ? true : undefined
      };
    }
    
    return apiSchema;
  }
  
  /**
   * Create a basic schema for common resources
   */
  createBasicSchema(provider: string, resource: string): GeneratorSchema {
    // Implementation omitted for brevity
    return {
      attributes: {}
    };
  }
}

// Export a singleton instance
export const schemaService = new SchemaService();