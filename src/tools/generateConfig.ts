// src/tools/generateConfig.ts
import { generatorService } from '../services/generatorService.js';
import { schemaService } from '../services/schemaService.js';
import { Logger } from '../utils/logger.js';
import { GenerateConfigArgs } from '../models/index.js';
import { ConfigGenerationError, ResourceNotFoundError } from '../errors/index.js';

const logger = new Logger('GenerateConfig');

/**
 * Generate Terraform configuration
 */
export async function generateTerraformConfiguration(args: GenerateConfigArgs) {
  const { provider, resource, attributes = {}, useGithub = true } = args;
  
  try {
    logger.info(`Generating Terraform configuration for ${provider}_${resource}`);
    
    // Fetch schema
    const generatorSchema = await schemaService.fetchEnhancedResourceSchema(provider, resource, useGithub);
    
    // Generate provider-specific defaults
    const smartDefaults = generateProviderSpecificDefaults(provider,resource, generatorSchema);
    
    // Merge provided attributes with smart defaults
    const mergedAttributes = { ...smartDefaults, ...attributes };
    
    // Generate configuration
    const configuration = generatorService.generateTerraformConfig(
      provider, 
      resource, 
      generatorSchema, 
      mergedAttributes
    );
    
    return { result: configuration };
  } catch (error) {
    logger.error(`Error generating Terraform configuration`, error);
    
    if (error instanceof ResourceNotFoundError || error instanceof ConfigGenerationError) {
      throw error;
    }
    
    throw new ConfigGenerationError(
      `Failed to generate Terraform configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
      provider,
      resource
    );
  }
}

/**
 * Generate provider-specific smart defaults for attributes
 */
function generateProviderSpecificDefaults(provider: string, resource: string, schema: any): Record<string, any> {
  const defaults: Record<string, any> = {};
  
  // Add provider-specific defaults
  if (provider === 'aws') {
    if (resource === 'instance') {
      defaults.ami = "ami-0c55b159cbfafe1f0";
      defaults.instance_type = "t3.micro";
      defaults.tags = {
        Name: "example-instance",
        Environment: "dev"
      };
    } else if (resource === 's3_bucket') {
      defaults.bucket = `example-bucket-${Math.floor(Math.random() * 100000)}`;
      defaults.acl = "private";
      defaults.versioning = {
        enabled: true
      };
    }
  } else if (provider === 'google' || provider === 'gcp') {
    if (resource === 'compute_instance') {
      defaults.name = "example-instance";
      defaults.machine_type = "e2-medium";
      defaults.zone = "us-central1-a";
      defaults.boot_disk = {
        initialize_params: {
          image: "debian-cloud/debian-11"
        }
      };
      defaults.network_interface = {
        network: "default"
      };
    }
  } else if (provider === 'azurerm' || provider === 'azure') {
    if (resource === 'virtual_machine') {
      defaults.name = "example-vm";
      defaults.location = "East US";
      defaults.resource_group_name = "example-resources";
      defaults.vm_size = "Standard_DS1_v2";
    }
  }
  
  return defaults;
}