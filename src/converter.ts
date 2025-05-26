/**
 * Terraform Resource to Module Converter
 * Converts existing Terraform configurations and state resources to reusable modules
 */

import { generateModuleStructure, ModuleConfig, ResourceConfig, ProviderRequirement } from './utils/module-templates.js';

/**
 * Resource configuration details in Terraform state format
 */
export interface StateResource {
  type: string;
  name: string;
  provider: string;
  instances: {
    attributes: Record<string, any>;
    sensitive_attributes?: string[];
  }[];
}

/**
 * Re-export ProviderRequirement interface for consumers
 */
export { ProviderRequirement } from './utils/module-templates.js';

/**
 * Configuration for module conversion
 */
export interface ConversionConfig {
  moduleName: string;
  description: string;
  resources: StateResource[];
  parameterizeNames?: string[];
  parameterizeCommonAttributes?: boolean;
  providerRequirements?: ProviderRequirement[];
  outputDirectory?: string;
}

/**
 * Configuration extraction options
 */
export interface ExtractionOptions {
  /** Whether to redact sensitive values */
  redactSensitiveValues?: boolean;
  /** Resource attribute paths to exclude */
  excludeAttributes?: string[];
  /** Whether to extract managed resources */
  extractResources?: boolean;
  /** Whether to extract data sources */
  extractDataSources?: boolean;
  /** Whether to extract providers */
  extractProviders?: boolean;
}

/**
 * Extracted Terraform configuration
 */
export interface ExtractedConfig {
  resources: StateResource[];
  providers: ProviderRequirement[];
  dependencies?: Record<string, string[]>;
}

/**
 * Convert Terraform state resources to a reusable module
 */
export function convertStateToModule(config: ConversionConfig): Record<string, string> {
  try {
    // Build the module configuration
    const moduleConfig = buildModuleConfig(config);
    
    // Generate the module structure
    const moduleStructure = generateModuleStructure(moduleConfig);
    
    // Convert ModuleStructure to Record<string, string>
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(moduleStructure)) {
      result[key] = value;
    }
    
    // Add examples if we can generate them
    const example = generateModuleExample(moduleConfig);
    if (example) {
      result['examples/example.tf'] = example;
    }
    
    return result;
  } catch (error) {
    console.error('Error in convertStateToModule:', error);
    throw new Error(`Failed to convert state to module: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Build a module configuration from conversion config
 */
function buildModuleConfig(config: ConversionConfig): ModuleConfig {
  const resourceConfigs: ResourceConfig[] = [];
  
  // Process resources to build module components
  config.resources.forEach(stateResource => {
    // Skip data sources unless explicit
    if (stateResource.type.startsWith('data.') && !config.parameterizeNames?.includes(stateResource.name)) {
      return;
    }
    
    // Get the first instance's attributes or default to empty
    const attributes = stateResource.instances[0]?.attributes || {};
    
    // Determine which attributes to parameterize
    const parameterizeAttributes = determineParameterizedAttributes(
      stateResource,
      config.parameterizeNames || [],
      config.parameterizeCommonAttributes || false
    );
    
    const resourceConfig: ResourceConfig = {
      type: stateResource.type,
      name: stateResource.name,
      attributes,
      parameterizeAttributes,
    };
    
    resourceConfigs.push(resourceConfig);
  });
  
  // Extract provider requirements
  const providerRequirements = config.providerRequirements || 
    extractProviderRequirements(config.resources);
  
  return {
    moduleName: config.moduleName,
    description: config.description,
    resources: resourceConfigs,
    providerRequirements,
    variableDefaults: generateVariableDefaults(resourceConfigs)
  };
}

/**
 * Determine which attributes should be parameterized in the module
 */
function determineParameterizedAttributes(
  resource: StateResource,
  parameterizeNames: string[],
  parameterizeCommonAttributes: boolean
): string[] {
  const parameterizedAttributes: string[] = [];
  const attributes = resource.instances[0]?.attributes || {};
  
  // Check if specific resource is targeted for full parameterization
  const isResourceFullyParameterized = parameterizeNames.includes(resource.name) ||
                                      parameterizeNames.includes(`${resource.type}.${resource.name}`);
  
  // Attributes that are commonly parameterized
  const commonParameterizedAttributes = [
    'name', 'tags', 'region', 'zone', 'location', 
    'environment', 'project', 'instance_type', 'size',
    'tier', 'sku', 'enabled'
  ];
  
  // Always parameterize these attributes
  const alwaysParameterize = ['name', 'tags'];
  
  Object.keys(attributes).forEach(key => {
    // Skip computed or managed attributes
    if (key === 'id' || key === 'arn' || key === 'created_at' || key === 'updated_at') {
      return;
    }
    
    // Always parameterize certain attributes
    if (alwaysParameterize.includes(key)) {
      parameterizedAttributes.push(key);
      return;
    }
    
    // If resource is fully parameterized, include all meaningful attributes
    if (isResourceFullyParameterized) {
      parameterizedAttributes.push(key);
      return;
    }
    
    // Parameterize common attributes if requested
    if (parameterizeCommonAttributes && commonParameterizedAttributes.includes(key)) {
      parameterizedAttributes.push(key);
      return;
    }
    
    // Always parameterize attributes with specific keywords
    if (key.includes('name') || key.includes('id') || key.endsWith('_enabled')) {
      parameterizedAttributes.push(key);
      return;
    }
  });
  
  return parameterizedAttributes;
}

/**
 * Extract provider requirements from resources
 */
function extractProviderRequirements(resources: StateResource[]): ProviderRequirement[] {
  const uniqueProviders = new Map<string, ProviderRequirement>();
  
  resources.forEach(resource => {
    // Extract provider name from resource 
    const providerParts = resource.provider.split('/');
    const providerName = providerParts[providerParts.length - 1].split('.')[0];
    
    if (!uniqueProviders.has(providerName)) {
      uniqueProviders.set(providerName, {
        name: providerName,
        source: `hashicorp/${providerName}`,
        version: '>= 1.0.0' // Default version constraint
      });
    }
  });
  
  return Array.from(uniqueProviders.values());
}

/**
 * Generate default values for variables based on resource attributes
 */
function generateVariableDefaults(resources: ResourceConfig[]): Record<string, any> {
  const defaults: Record<string, any> = {
    // Common defaults
    name_prefix: 'example',
    tags: {
      'Terraform': 'true',
      'Environment': 'dev'
    }
  };
  
  resources.forEach(resource => {
    if (resource.parameterizeAttributes) {
      resource.parameterizeAttributes.forEach(attr => {
        // Don't override existing defaults
        if (!(attr in defaults) && attr in resource.attributes) {
          defaults[attr] = resource.attributes[attr];
        }
      });
    }
  });
  
  return defaults;
}

/**
 * Generate an example of using the module
 */
function generateModuleExample(config: ModuleConfig): string {
  try {
    let example = `# Example usage of the ${config.moduleName} module\n\n`;
    
    // Add provider blocks
    config.providerRequirements.forEach(provider => {
      example += `provider "${provider.name}" {\n`;
      
      if (provider.name === 'aws') {
        example += `  region = "us-west-2"\n`;
      } else if (provider.name === 'google' || provider.name === 'gcp') {
        example += `  project = "my-project-id"\n`;
        example += `  region  = "us-central1"\n`;
      } else if (provider.name === 'azurerm') {
        example += `  features {}\n`;
      }
      
      example += `}\n\n`;
    });
    
    // Module block
    example += `module "${config.moduleName}" {\n`;
    example += `  source = "../" # Path to module\n\n`;
    
    // Add variable inputs
    const variablesAdded = new Set<string>();
    
    example += `  # Required variables\n`;
    config.resources.forEach(resource => {
      if (resource.parameterizeAttributes) {
        resource.parameterizeAttributes.forEach(attr => {
          if (!variablesAdded.has(attr)) {
            if (attr === 'tags') {
              example += `  tags = {\n`;
              example += `    Name        = "example"\n`;
              example += `    Environment = "dev"\n`;
              example += `    Terraform   = "true"\n`;
              example += `  }\n`;
            } else if (attr === 'name' || attr === 'name_prefix') {
              example += `  ${attr} = "example-${resource.type.split('_').pop()}"\n`;
            } else if (attr.endsWith('_enabled') || attr.startsWith('enable_')) {
              example += `  ${attr} = true\n`;
            } else if (config.variableDefaults && attr in config.variableDefaults) {
              const value = config.variableDefaults[attr];
              if (typeof value === 'string') {
                example += `  ${attr} = "${value}"\n`;
              } else if (typeof value === 'boolean' || typeof value === 'number') {
                example += `  ${attr} = ${value}\n`;
              } else if (Array.isArray(value)) {
                example += `  ${attr} = ${JSON.stringify(value)}\n`;
              } else if (typeof value === 'object' && value !== null) {
                example += `  ${attr} = ${JSON.stringify(value, null, 2).replace(/"/g, '"').replace(/\n/g, '\n  ')}\n`;
              }
            }
            variablesAdded.add(attr);
          }
        });
      }
    });
    
    example += `}\n\n`;
    
    // Add output examples
    example += `# Example outputs\n`;
    example += `output "${config.moduleName}_id" {\n`;
    example += `  value = module.${config.moduleName}.id\n`;
    example += `}\n`;
    
    return example;
  } catch (error) {
    console.error('Error generating module example:', error);
    return '';
  }
}

/**
 * Extract Terraform configuration from state file content
 */
export function extractFromState(stateContent: string, options: ExtractionOptions = {}): ExtractedConfig {
  try {
    // Parse state file
    const state = JSON.parse(stateContent);
    const resources: StateResource[] = [];
    const providers: ProviderRequirement[] = [];
    
    // Process resources from state
    if (state.resources && Array.isArray(state.resources) && options.extractResources !== false) {
      for (const resource of state.resources) {
        // Skip data sources if not requested
        if (resource.mode === 'data' && !options.extractDataSources) {
          continue;
        }
        
        // Normalize resource type
        let resourceType = resource.type;
        if (resource.mode === 'data') {
          resourceType = `data.${resourceType}`;
        }
        
        // Extract instances
        const instances = resource.instances.map((instance: any) => {
          let attributes = { ...instance.attributes };
          
          // Filter out excluded attributes
          if (options.excludeAttributes && options.excludeAttributes.length > 0) {
            attributes = filterAttributes(attributes, options.excludeAttributes);
          }
          
          // Redact sensitive values if requested
          if (options.redactSensitiveValues && instance.sensitive_attributes) {
            attributes = redactSensitiveValues(attributes, instance.sensitive_attributes);
          }
          
          return {
            attributes,
            sensitive_attributes: instance.sensitive_attributes || []
          };
        });
        
        // Create state resource
        resources.push({
          type: resourceType,
          name: resource.name,
          provider: resource.provider,
          instances
        });
      }
    }
    
    // Extract provider configurations if requested
    if (options.extractProviders && state.provider_config) {
      for (const [providerKey, config] of Object.entries<any>(state.provider_config)) {
        const providerParts = providerKey.split('.');
        const providerName = providerParts[0];
        
        providers.push({
          name: providerName,
          source: `hashicorp/${providerName}`,
          version: '>= 1.0.0' // Default since state doesn't store version constraints
        });
      }
    }
    
    return {
      resources,
      providers,
      dependencies: extractDependencies(state)
    };
  } catch (error) {
    console.error('Error extracting from state:', error);
    throw new Error(`Failed to extract from state: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract resource dependencies from state
 */
function extractDependencies(state: any): Record<string, string[]> {
  const dependencies: Record<string, string[]> = {};
  
  if (!state.resources || !Array.isArray(state.resources)) {
    return dependencies;
  }
  
  // Process each resource
  for (const resource of state.resources) {
    for (const instance of resource.instances) {
      const resourceKey = `${resource.type}.${resource.name}`;
      
      // Check for dependencies
      if (instance.dependencies && Array.isArray(instance.dependencies)) {
        dependencies[resourceKey] = instance.dependencies;
      }
    }
  }
  
  return dependencies;
}

/**
 * Filter out excluded attributes from resource
 */
function filterAttributes(attributes: Record<string, any>, excludePatterns: string[]): Record<string, any> {
  const result: Record<string, any> = {};
  
  // Keep only attributes that don't match any exclude pattern
  for (const [key, value] of Object.entries(attributes)) {
    let shouldExclude = false;
    
    for (const pattern of excludePatterns) {
      if (pattern === key || 
          (pattern.endsWith('*') && key.startsWith(pattern.slice(0, -1))) ||
          (pattern.startsWith('*') && key.endsWith(pattern.slice(1)))) {
        shouldExclude = true;
        break;
      }
    }
    
    if (!shouldExclude) {
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * Redact sensitive values in attributes
 */
function redactSensitiveValues(
  attributes: Record<string, any>, 
  sensitiveAttributes: string[]
): Record<string, any> {
  const result = { ...attributes };
  
  for (const path of sensitiveAttributes) {
    const parts = path.split('.');
    let current: any = result;
    
    // Navigate to the parent object of the sensitive attribute
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (current[part] === undefined) {
        break;
      }
      current = current[part];
    }
    
    // Redact the sensitive value
    const lastPart = parts[parts.length - 1];
    if (current && typeof current === 'object' && lastPart in current) {
      current[lastPart] = "***SENSITIVE***";
    }
  }
  
  return result;
}

/**
 * Extract Terraform configuration from HCL configuration content
 * This is a simplified implementation - a full implementation would require a proper HCL parser
 */
export function extractFromHcl(hclContent: string, options: ExtractionOptions = {}): ExtractedConfig {
  try {
    const resources: StateResource[] = [];
    const providers: ProviderRequirement[] = [];
    
    // Extract resource blocks
    if (options.extractResources !== false) {
      const resourceRegex = /resource\s+"([^"]+)"\s+"([^"]+)"\s+{([^}]+)}/g;
      let match;
      
      while ((match = resourceRegex.exec(hclContent)) !== null) {
        const resourceType = match[1];
        const resourceName = match[2];
        const resourceBlock = match[3];
        
        // Extract attributes
        const attributes = extractAttributesFromHcl(resourceBlock);
        
        resources.push({
          type: resourceType,
          name: resourceName,
          provider: guessProviderFromType(resourceType),
          instances: [{ attributes }]
        });
      }
    }
    
    // Extract data blocks if requested
    if (options.extractDataSources) {
      const dataRegex = /data\s+"([^"]+)"\s+"([^"]+)"\s+{([^}]+)}/g;
      let match;
      
      while ((match = dataRegex.exec(hclContent)) !== null) {
        const dataType = match[1];
        const dataName = match[2];
        const dataBlock = match[3];
        
        // Extract attributes
        const attributes = extractAttributesFromHcl(dataBlock);
        
        resources.push({
          type: `data.${dataType}`,
          name: dataName,
          provider: guessProviderFromType(dataType),
          instances: [{ attributes }]
        });
      }
    }
    
    // Extract provider blocks if requested
    if (options.extractProviders) {
      const providerRegex = /provider\s+"([^"]+)"\s+{([^}]+)}/g;
      let match;
      
      while ((match = providerRegex.exec(hclContent)) !== null) {
        const providerName = match[1];
        
        // Extract version constraints from required_providers block
        const versionConstraint = extractProviderVersion(hclContent, providerName);
        
        providers.push({
          name: providerName,
          source: `hashicorp/${providerName}`,
          version: versionConstraint || '>= 1.0.0'
        });
      }
    }
    
    return {
      resources,
      providers
    };
  } catch (error) {
    console.error('Error extracting from HCL:', error);
    throw new Error(`Failed to extract from HCL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract attributes from an HCL block
 * This is a simplified implementation
 */
function extractAttributesFromHcl(block: string): Record<string, any> {
  const attributes: Record<string, any> = {};
  
  // Extract simple attributes
  const attrRegex = /(\w+)\s*=\s*("([^"]*)"|(\d+)|true|false)/g;
  let match;
  
  while ((match = attrRegex.exec(block)) !== null) {
    const key = match[1];
    
    if (match[3] !== undefined) {
      // String value
      attributes[key] = match[3];
    } else if (match[4] !== undefined) {
      // Number value
      attributes[key] = parseInt(match[4], 10);
    } else if (match[2] === 'true') {
      attributes[key] = true;
    } else if (match[2] === 'false') {
      attributes[key] = false;
    }
  }
  
  return attributes;
}

/**
 * Guess provider from resource type
 */
function guessProviderFromType(resourceType: string): string {
  const providerPart = resourceType.split('_')[0];
  return `registry.terraform.io/hashicorp/${providerPart}`;
}

/**
 * Extract provider version from required_providers block
 */
function extractProviderVersion(hclContent: string, providerName: string): string | null {
  const versionRegex = new RegExp(`${providerName}\\s*=\\s*{[^}]*version\\s*=\\s*"([^"]*)"`, 'i');
  const match = versionRegex.exec(hclContent);
  
  return match ? match[1] : null;
}