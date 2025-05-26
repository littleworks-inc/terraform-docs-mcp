/**
 * Utilities for generating Terraform module templates
 * Provides structured templates for creating reusable modules from existing resources
 */

/**
 * Main module directory structure
 */
export interface ModuleStructure {
  [key: string]: string;
  'main.tf': string;
  'variables.tf': string;
  'outputs.tf': string;
  'versions.tf': string;
  'README.md': string;
}

/**
 * Configuration for module template generation
 */
export interface ModuleConfig {
  moduleName: string;
  description: string;
  resources: ResourceConfig[];
  providerRequirements: ProviderRequirement[];
  variableDefaults?: Record<string, any>;
  examples?: string[];
}

/**
 * Resource configuration for module generation
 */
export interface ResourceConfig {
  type: string;         // Resource type (e.g., aws_s3_bucket)
  name: string;         // Resource name in the module (e.g., this)
  attributes: Record<string, any>; // Resource attributes
  parameterizeAttributes?: string[]; // Attributes to convert to variables
}

/**
 * Terraform provider requirement
 */
export interface ProviderRequirement {
  name: string;         // Provider name (e.g., aws)
  source?: string;      // Provider source (e.g., hashicorp/aws)
  version?: string;     // Provider version constraint (e.g., >= 4.0.0)
}

/**
 * Generate a complete module structure for a given configuration
 */
export function generateModuleStructure(config: ModuleConfig): ModuleStructure {
  return {
    'main.tf': generateMainTf(config),
    'variables.tf': generateVariablesTf(config),
    'outputs.tf': generateOutputsTf(config),
    'versions.tf': generateVersionsTf(config),
    'README.md': generateReadme(config)
  };
}

/**
 * Generate main.tf file content with resources
 */
function generateMainTf(config: ModuleConfig): string {
  let content = `# Main resource definitions for ${config.moduleName} module\n\n`;
  
  // Generate resource blocks
  config.resources.forEach(resource => {
    content += `resource "${resource.type}" "${resource.name}" {\n`;
    
    // Process attributes, replacing values with variable references if they're parameterized
    Object.entries(resource.attributes).forEach(([key, value]) => {
      const isParameterized = resource.parameterizeAttributes?.includes(key);
      
      if (isParameterized) {
        // Convert the attribute to use a variable
        const varName = `${key}`;
        content += `  ${key} = var.${varName}\n`;
      } else if (typeof value === 'object' && value !== null) {
        // Handle nested blocks
        content += processNestedBlock(key, value, 2);
      } else {
        // Regular attribute
        content += formatAttribute(key, value, 2);
      }
    });
    
    content += `}\n\n`;
  });
  
  return content;
}

/**
 * Process a nested block in Terraform configuration
 */
function processNestedBlock(key: string, value: any, indent: number): string {
  let content = '';
  const indentStr = ' '.repeat(indent);
  
  if (Array.isArray(value)) {
    // Handle array of blocks
    value.forEach(item => {
      content += `${indentStr}${key} {\n`;
      if (typeof item === 'object' && item !== null) {
        Object.entries(item).forEach(([nestedKey, nestedValue]) => {
          if (typeof nestedValue === 'object' && nestedValue !== null) {
            content += processNestedBlock(nestedKey, nestedValue, indent + 2);
          } else {
            content += formatAttribute(nestedKey, nestedValue, indent + 2);
          }
        });
      }
      content += `${indentStr}}\n\n`;
    });
  } else {
    // Handle single block
    content += `${indentStr}${key} {\n`;
    if (typeof value === 'object' && value !== null) {
      Object.entries(value).forEach(([nestedKey, nestedValue]) => {
        if (typeof nestedValue === 'object' && nestedValue !== null) {
          content += processNestedBlock(nestedKey, nestedValue, indent + 2);
        } else {
          content += formatAttribute(nestedKey, nestedValue, indent + 2);
        }
      });
    }
    content += `${indentStr}}\n\n`;
  }
  
  return content;
}

/**
 * Format a Terraform attribute with proper indentation
 */
function formatAttribute(key: string, value: any, indent: number): string {
  const indentStr = ' '.repeat(indent);
  
  if (typeof value === 'string') {
    // String value - use quotes
    return `${indentStr}${key} = "${value}"\n`;
  } else if (Array.isArray(value)) {
    // Array value
    return `${indentStr}${key} = ${JSON.stringify(value).replace(/"/g, '\"')}\n`;
  } else if (typeof value === 'boolean' || typeof value === 'number') {
    // Boolean or number - no quotes
    return `${indentStr}${key} = ${value}\n`;
  } else {
    // Default case, convert to string with quotes
    return `${indentStr}${key} = "${String(value)}"\n`;
  }
}

/**
 * Generate variables.tf file content
 */
function generateVariablesTf(config: ModuleConfig): string {
  let content = `# Input variables for ${config.moduleName} module\n\n`;
  
  // Extract all parameterized attributes across resources
  const variables = new Set<string>();
  
  config.resources.forEach(resource => {
    if (resource.parameterizeAttributes) {
      resource.parameterizeAttributes.forEach(attr => {
        variables.add(attr);
      });
    }
  });
  
  // Add common variables
  variables.add('name_prefix');
  variables.add('tags');
  
  // Generate variable blocks
  Array.from(variables).sort().forEach(varName => {
    content += `variable "${varName}" {\n`;
    content += `  description = "The ${varName.replace(/_/g, ' ')} for the ${config.moduleName}"\n`;
    
    // Add type if we can determine it
    const type = determineVariableType(varName, config);
    if (type) {
      content += `  type        = ${type}\n`;
    }
    
    // Add default if provided
    if (config.variableDefaults && varName in config.variableDefaults) {
      const defaultValue = config.variableDefaults[varName];
      content += `  default     = ${formatDefaultValue(defaultValue)}\n`;
    }
    
    content += `}\n\n`;
  });
  
  return content;
}

/**
 * Determine the Terraform type for a variable based on its name and context
 */
function determineVariableType(varName: string, config: ModuleConfig): string | null {
  // Common variable types based on naming conventions
  if (varName === 'tags') {
    return 'map(string)';
  } else if (varName.endsWith('_enabled') || varName.startsWith('enable_')) {
    return 'bool';
  } else if (varName.endsWith('_count') || varName.endsWith('_size') || varName.endsWith('_port')) {
    return 'number';
  } else if (varName.endsWith('_arns') || varName.endsWith('_ids') || varName.endsWith('_names')) {
    return 'list(string)';
  }
  
  // Look at resource attributes if we can find the variable there
  for (const resource of config.resources) {
    if (resource.parameterizeAttributes?.includes(varName) && varName in resource.attributes) {
      const value = resource.attributes[varName];
      
      if (typeof value === 'string') {
        return 'string';
      } else if (typeof value === 'boolean') {
        return 'bool';
      } else if (typeof value === 'number') {
        return 'number';
      } else if (Array.isArray(value)) {
        // Try to determine list type
        if (value.length > 0) {
          if (typeof value[0] === 'string') {
            return 'list(string)';
          } else if (typeof value[0] === 'number') {
            return 'list(number)';
          }
        }
        return 'list(any)';
      } else if (typeof value === 'object' && value !== null) {
        return 'map(any)';
      }
    }
  }
  
  // Default to string if we can't determine
  return 'string';
}

/**
 * Format a default value for a Terraform variable
 */
function formatDefaultValue(value: any): string {
  if (typeof value === 'string') {
    return `"${value}"`;
  } else if (typeof value === 'boolean' || typeof value === 'number') {
    return String(value);
  } else if (Array.isArray(value)) {
    return `[${value.map(v => typeof v === 'string' ? `"${v}"` : String(v)).join(', ')}]`;
  } else if (typeof value === 'object' && value !== null) {
    // Format as a Terraform map
    const entries = Object.entries(value)
      .map(([k, v]) => `    ${k} = ${typeof v === 'string' ? `"${v}"` : String(v)}`)
      .join('\n');
    
    return `{\n${entries}\n  }`;
  }
  
  return 'null';
}

/**
 * Generate outputs.tf file content
 */
function generateOutputsTf(config: ModuleConfig): string {
  let content = `# Output variables for ${config.moduleName} module\n\n`;
  
  // Generate standard outputs for each resource
  config.resources.forEach(resource => {
    const resourceRef = `${resource.type}.${resource.name}`;
    const resourceType = resource.type.split('_').slice(1).join('_');
    
    // Output the resource ID
    content += `output "${resourceType}_id" {\n`;
    content += `  description = "The ID of the ${resourceType}"\n`;
    content += `  value       = ${resourceRef}.id\n`;
    content += `}\n\n`;
    
    // For specific resource types, add more specific outputs
    if (resource.type.includes('_bucket')) {
      content += `output "${resourceType}_arn" {\n`;
      content += `  description = "The ARN of the ${resourceType}"\n`;
      content += `  value       = ${resourceRef}.arn\n`;
      content += `}\n\n`;
    } else if (resource.type.includes('_instance')) {
      content += `output "${resourceType}_public_ip" {\n`;
      content += `  description = "The public IP of the ${resourceType}"\n`;
      content += `  value       = ${resourceRef}.public_ip\n`;
      content += `}\n\n`;
      
      content += `output "${resourceType}_private_ip" {\n`;
      content += `  description = "The private IP of the ${resourceType}"\n`;
      content += `  value       = ${resourceRef}.private_ip\n`;
      content += `}\n\n`;
    }
  });
  
  return content;
}

/**
 * Generate versions.tf file content
 */
function generateVersionsTf(config: ModuleConfig): string {
  let content = `# Terraform version and provider requirements for ${config.moduleName} module\n\n`;
  
  content += `terraform {\n`;
  content += `  required_version = ">= 1.0.0"\n\n`;
  
  if (config.providerRequirements.length > 0) {
    content += `  required_providers {\n`;
    
    config.providerRequirements.forEach(provider => {
      content += `    ${provider.name} = {\n`;
      if (provider.source) {
        content += `      source  = "${provider.source}"\n`;
      } else {
        content += `      source  = "hashicorp/${provider.name}"\n`;
      }
      if (provider.version) {
        content += `      version = "${provider.version}"\n`;
      } else {
        content += `      version = ">= 1.0.0"\n`;
      }
      content += `    }\n`;
    });
    
    content += `  }\n`;
  }
  
  content += `}\n`;
  
  return content;
}

/**
 * Generate README.md file content
 */
function generateReadme(config: ModuleConfig): string {
  let content = `# ${titleCase(config.moduleName)} Terraform Module\n\n`;
  
  content += `## Description\n\n`;
  content += `${config.description}\n\n`;
  
  content += `## Requirements\n\n`;
  content += `| Name | Version |\n`;
  content += `|------|--------|\n`;
  content += `| terraform | >= 1.0.0 |\n`;
  
  config.providerRequirements.forEach(provider => {
    content += `| ${provider.name} | ${provider.version || '>= 1.0.0'} |\n`;
  });
  
  content += `\n## Resources\n\n`;
  content += `| Name | Type |\n`;
  content += `|------|------|\n`;
  
  config.resources.forEach(resource => {
    content += `| ${resource.type}.${resource.name} | resource |\n`;
  });
  
  content += `\n## Inputs\n\n`;
  content += `| Name | Description | Type | Default | Required |\n`;
  content += `|------|-------------|------|---------|:--------:|\n`;
  
  // Extract all parameterized attributes across resources
  const variables = new Set<string>();
  
  config.resources.forEach(resource => {
    if (resource.parameterizeAttributes) {
      resource.parameterizeAttributes.forEach(attr => {
        variables.add(attr);
      });
    }
  });
  
  // Add common variables
  variables.add('name_prefix');
  variables.add('tags');
  
  Array.from(variables).sort().forEach(varName => {
    const type = determineVariableType(varName, config) || 'string';
    const hasDefault = config.variableDefaults && varName in config.variableDefaults;
    const required = !hasDefault ? 'yes' : 'no';
    const defaultVal = hasDefault ? formatDefaultMarkdown(config.variableDefaults![varName]) : 'n/a';
    
    content += `| ${varName} | The ${varName.replace(/_/g, ' ')} for the ${config.moduleName} | ${type} | ${defaultVal} | ${required} |\n`;
  });
  
  content += `\n## Outputs\n\n`;
  content += `| Name | Description |\n`;
  content += `|------|-------------|\n`;
  
  config.resources.forEach(resource => {
    const resourceType = resource.type.split('_').slice(1).join('_');
    
    content += `| ${resourceType}_id | The ID of the ${resourceType} |\n`;
    
    if (resource.type.includes('_bucket')) {
      content += `| ${resourceType}_arn | The ARN of the ${resourceType} |\n`;
    } else if (resource.type.includes('_instance')) {
      content += `| ${resourceType}_public_ip | The public IP of the ${resourceType} |\n`;
      content += `| ${resourceType}_private_ip | The private IP of the ${resourceType} |\n`;
    }
  });
  
  if (config.examples && config.examples.length > 0) {
    content += `\n## Examples\n\n`;
    
    config.examples.forEach((example, index) => {
      content += `### Example ${index + 1}\n\n`;
      content += "```hcl\n";
      content += example;
      content += "\n```\n\n";
    });
  }
  
  return content;
}

/**
 * Format a default value for markdown display
 */
function formatDefaultMarkdown(value: any): string {
  if (value === null || value === undefined) {
    return 'null';
  } else if (typeof value === 'string') {
    return `\`"${value}"\``;
  } else if (typeof value === 'boolean' || typeof value === 'number') {
    return `\`${value}\``;
  } else if (Array.isArray(value)) {
    if (value.length === 0) {
      return '`[]`';
    } else {
      return '`[...]`';
    }
  } else if (typeof value === 'object') {
    return '`{...}`';
  }
  
  return String(value);
}

/**
 * Convert a string to Title Case
 */
function titleCase(str: string): string {
  return str
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}