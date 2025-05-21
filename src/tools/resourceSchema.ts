// src/tools/resourceSchema.ts
import { schemaService } from '../services/schemaService.js';
import { Logger } from '../utils/logger.js';
import { ResourceSchemaArgs } from '../models/index.js';
import { SchemaParsingError } from '../errors/index.js';

const logger = new Logger('ResourceSchema');

/**
 * Fetch resource schema
 */
export async function fetchResourceSchema(args: ResourceSchemaArgs) {
  const { provider, resource, useGithub = true } = args;
  
  try {
    logger.info(`Fetching schema for: ${provider}_${resource}`);
    
    // Fetch enhanced schema
    const generatorSchema = await schemaService.fetchEnhancedResourceSchema(provider, resource, useGithub);
    
    // Convert to API format
    const apiSchema = schemaService.convertToApiSchema(generatorSchema);
    
    return {
      result: apiSchema,
      source: useGithub ? "GitHub Enhanced" : "Basic Schema"
    };
  } catch (error) {
    logger.error(`Error fetching resource schema`, error);
    
    if (error instanceof SchemaParsingError) {
      throw error;
    }
    
    throw new SchemaParsingError(
      `Failed to fetch resource schema: ${error instanceof Error ? error.message : 'Unknown error'}`,
      provider,
      resource
    );
  }
}