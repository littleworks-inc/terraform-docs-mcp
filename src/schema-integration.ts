/**
 * Integration between the enhanced schema extraction and configuration generator
 * This module bridges the GitHub schema extraction and the Terraform configuration generator
 */

import { fetchResourceSchemaFromGithub, SchemaAttribute as GitHubSchemaAttribute, Schema as GitHubSchema } from './github.js';
import { generateTerraformConfig, SchemaAttribute as GeneratorSchemaAttribute, Schema as GeneratorSchema } from './generator.js';

/**
 * Convert GitHub schema to Generator schema format
 */
export function convertGitHubSchemaToGeneratorSchema(githubSchema: GitHubSchema): GeneratorSchema {
  const result: GeneratorSchema = {
    attributes: {}
  };
  
  // Process regular attributes
  for (const [name, attr] of Object.entries(githubSchema.attributes)) {
    result.attributes[name] = convertAttribute(attr);
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
          blockAttr.nested[nestedName] = convertAttribute(nestedAttr);
        }
      }
      
      result.attributes[blockName] = blockAttr;
    }
  }
  
  return result;
}

/**
 * Convert individual attribute from GitHub format to Generator format
 */
function convertAttribute(githubAttr: GitHubSchemaAttribute): GeneratorSchemaAttribute {
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
      result.nested[nestedName] = convertAttribute(nestedAttr);
    }
  }
  
  return result;
}

/**
 * Generate provider-specific smart defaults for attributes
 */
function generateProviderSpecificDefaults(provider: string, resource: string, schema: GeneratorSchema): Record<string, any> {
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

/**
 * Fetch resource schema, convert it, and generate Terraform configuration
 */
export async function fetchSchemaAndGenerateConfig(
  provider: string,
  resource: string,
  attributes: Record<string, any> = {}
): Promise<string> {
  try {
    // Fetch schema from GitHub
    const githubSchema = await fetchResourceSchemaFromGithub(provider, resource);
    
    // Convert to generator schema format
    const generatorSchema = convertGitHubSchemaToGeneratorSchema(githubSchema);
    
    // Generate provider-specific defaults
    const smartDefaults = generateProviderSpecificDefaults(provider, resource, generatorSchema);
    
    // Merge provided attributes with smart defaults
    const mergedAttributes = { ...smartDefaults, ...attributes };
    
    // Generate configuration using the enhanced generator
    const config = generateTerraformConfig(provider, resource, generatorSchema, mergedAttributes);
    
    return config;
  } catch (error: any) {
    console.error(`Error in fetchSchemaAndGenerateConfig: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    // Fallback to direct generator if schema fetch fails
    return generateTerraformConfig(provider, resource, { attributes: {} }, attributes);
  }
}

/**
 * Helper function to determine if a schema has useful content
 */
export function isValidSchema(schema: GitHubSchema): boolean {
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
 * Enhanced schema fetching that tries multiple strategies
 */
export async function fetchEnhancedResourceSchema(
  provider: string, 
  resource: string,
  useGithub: boolean = true
): Promise<GeneratorSchema> {
  if (!useGithub) {
    // Return a basic schema if GitHub is not requested
    return createBasicSchema(provider, resource);
  }
  
  try {
    // Try to fetch from GitHub first
    const githubSchema = await fetchResourceSchemaFromGithub(provider, resource);
    
    // Check if the schema is valid and useful
    if (isValidSchema(githubSchema)) {
      return convertGitHubSchemaToGeneratorSchema(githubSchema);
    } else {
      // Fallback to registry lookup or basic schema
      const basicSchema = createBasicSchema(provider, resource);
      
      // Merge any attributes we found from GitHub
      return {
        attributes: {
          ...convertGitHubSchemaToGeneratorSchema(githubSchema).attributes,
          ...basicSchema.attributes
        }
      };
    }
  } catch (error: any) {
    console.error(`Error fetching enhanced schema: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return createBasicSchema(provider, resource);
  }
}

/**
 * Create a basic schema for common resources when GitHub extraction fails
 */
function createBasicSchema(provider: string, resource: string): GeneratorSchema {
  const schema: GeneratorSchema = {
    attributes: {
      name: {
        description: "The name of the resource",
        required: true,
        type: "string"
      },
      tags: {
        description: "Tags to assign to the resource",
        required: false,
        type: "map"
      }
    }
  };
  
  // Add provider-specific attributes
  if (provider === 'aws') {
    if (resource === 'instance') {
      schema.attributes.ami = {
        description: "The AMI to use for the instance",
        required: true,
        type: "string"
      };
      schema.attributes.instance_type = {
        description: "The instance type to use",
        required: true,
        type: "string"
      };
      schema.attributes.subnet_id = {
        description: "The VPC Subnet ID to launch in",
        required: false,
        type: "string"
      };
      schema.attributes.vpc_security_group_ids = {
        description: "A list of security group IDs to associate with",
        required: false,
        type: "list",
        elem: { type: "string" }
      };
    } else if (resource === 's3_bucket') {
      schema.attributes.bucket = {
        description: "The name of the bucket",
        required: true,
        type: "string"
      };
      schema.attributes.acl = {
        description: "The canned ACL to apply",
        required: false,
        type: "string"
      };
      schema.attributes.versioning = {
        description: "A state of versioning",
        required: false,
        type: "list",
        nested: {
          enabled: {
            description: "Whether versioning is enabled",
            required: true,
            type: "bool"
          },
          mfa_delete: {
            description: "Whether MFA delete is enabled",
            required: false,
            type: "bool"
          }
        }
      };
    }
  } else if (provider === 'google' || provider === 'gcp') {
    if (resource === 'compute_instance') {
      schema.attributes.machine_type = {
        description: "The machine type to create",
        required: true,
        type: "string"
      };
      schema.attributes.zone = {
        description: "The zone that the machine should be created in",
        required: true,
        type: "string"
      };
      schema.attributes.boot_disk = {
        description: "The boot disk for the instance",
        required: true,
        type: "list",
        nested: {
          initialize_params: {
            description: "Parameters for a new disk that will be created alongside the instance",
            required: false,
            type: "list",
            nested: {
              image: {
                description: "The image from which to initialize this disk",
                required: true,
                type: "string"
              }
            }
          }
        }
      };
      schema.attributes.network_interface = {
        description: "Networks to attach to the instance",
        required: true,
        type: "list",
        nested: {
          network: {
            description: "The name or self_link of the network to attach this interface to",
            required: false,
            type: "string"
          },
          subnetwork: {
            description: "The name or self_link of the subnetwork to attach this interface to",
            required: false,
            type: "string"
          },
          access_config: {
            description: "Access configurations, i.e. IPs via which this instance can be accessed via the Internet",
            required: false,
            type: "list",
            nested: {
              nat_ip: {
                description: "The IP address that will be 1:1 mapped to the instance's network ip",
                required: false,
                type: "string"
              },
              network_tier: {
                description: "The networking tier used for configuring this instance",
                required: false,
                type: "string"
              }
            }
          }
        }
      };
    }
  } else if (provider === 'azure' || provider === 'azurerm') {
    schema.attributes.location = {
      description: "The Azure Region where the resource should exist",
      required: true,
      type: "string"
    };
    schema.attributes.resource_group_name = {
      description: "The name of the Resource Group where the resource should exist",
      required: true,
      type: "string"
    };
  }
  
  return schema;
}