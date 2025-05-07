/**
 * Generator module for creating Terraform configurations
 */

export interface SchemaAttribute {
    description: string;
    required: boolean;
    type?: string;
  }
  
  export interface Schema {
    attributes: Record<string, SchemaAttribute>;
  }
  
  /**
   * Generate Terraform configuration based on provider, resource, schema and attributes
   */
  export function generateTerraformConfig(
    provider: string,
    resource: string,
    schema: Schema,
    attributes: Record<string, any> = {}
  ): string {
    // Format the resource name to match Terraform convention
    const resourceType = `${provider}_${resource}`;
    const resourceName = formatResourceName(resource);
    
    // Start building the configuration
    let config = `# Terraform configuration for ${resourceType}\n\n`;
    
    // Add provider block
    config += `provider "${provider}" {\n`;
    
    // Common provider attributes (would be customized based on provider)
    if (provider === 'aws') {
      config += `  region = "${attributes.region || "us-west-2"}"\n`;
    } else if (provider === 'azure') {
      config += `  features {}\n`;
    } else if (provider === 'gcp') {
      config += `  project = "${attributes.project || "my-project-id"}"\n`;
    }
    
    config += `}\n\n`;
    
    // Add resource block
    config += `resource "${resourceType}" "${resourceName}" {\n`;
    
    // Add resource attributes based on schema and provided values
    const attributeLines = formatAttributes(schema.attributes, attributes);
    config += attributeLines;
    
    config += `}\n`;
    
    return config;
  }
  
  /**
   * Format resource name to a valid Terraform identifier
   */
  function formatResourceName(resource: string): string {
    // Replace hyphens with underscores and make it descriptive
    return `${resource.replace(/-/g, '_')}_example`;
  }
  
  /**
   * Format attributes based on schema and provided values
   */
  function formatAttributes(
    schemaAttributes: Record<string, SchemaAttribute>,
    providedAttributes: Record<string, any> = {}
  ): string {
    let result = '';
    
    // Process required attributes first
    const requiredAttrs = Object.entries(schemaAttributes)
      .filter(([_, attr]) => attr.required);
      
    for (const [name, attr] of requiredAttrs) {
      const value = getAttributeValue(name, attr, providedAttributes);
      if (value !== null) {
        result += `  ${name} = ${value}\n`;
      }
    }
    
    // Then process optional attributes that have been provided
    const optionalAttrs = Object.entries(schemaAttributes)
      .filter(([_, attr]) => !attr.required)
      .filter(([name]) => name in providedAttributes);
      
    if (optionalAttrs.length > 0) {
      result += '\n  # Optional attributes\n';
      
      for (const [name, attr] of optionalAttrs) {
        const value = getAttributeValue(name, attr, providedAttributes);
        if (value !== null) {
          result += `  ${name} = ${value}\n`;
        }
      }
    }
    
    // Add common attributes for specific resource types
    result += addCommonAttributes(providedAttributes);
    
    return result;
  }
  
  /**
   * Get the formatted value for an attribute
   */
  function getAttributeValue(
    name: string,
    attr: SchemaAttribute,
    providedAttributes: Record<string, any>
  ): string | null {
    // If the value is explicitly provided, use it
    if (name in providedAttributes) {
      const value = providedAttributes[name];
      
      // Format the value based on its type
      if (typeof value === 'string') {
        return `"${value}"`;
      } else if (typeof value === 'number') {
        return value.toString();
      } else if (typeof value === 'boolean') {
        return value.toString();
      } else if (Array.isArray(value)) {
        return formatArray(value);
      } else if (typeof value === 'object' && value !== null) {
        return formatObject(value);
      }
      
      return `"${value}"`;
    }
    
    // Provide reasonable defaults based on attribute name and context
    switch (name) {
      case 'name':
        return `"example-resource"`;
      case 'tags':
        return formatObject({ Name: "example", Environment: "dev" });
      default:
        // For required attributes, provide a placeholder
        if (attr.required) {
          // Different defaults based on typical attribute types
          if (name.includes('id')) {
            return `"example-id"`;
          } else if (name.includes('arn')) {
            return `"arn:aws:example:region:account-id:resource/example"`;
          } else if (name.includes('type')) {
            return `"standard"`;
          }
          
          return `"TODO: required-value-for-${name}"`;
        }
        
        // Skip optional attributes if not provided
        return null;
    }
  }
  
  /**
   * Format an array value
   */
  function formatArray(array: any[]): string {
    if (array.length === 0) {
      return '[]';
    }
    
    const items = array.map(item => {
      if (typeof item === 'string') {
        return `"${item}"`;
      } else if (typeof item === 'number') {
        return item.toString();
      } else if (typeof item === 'boolean') {
        return item.toString();
      } else if (typeof item === 'object' && item !== null) {
        return formatObject(item);
      }
      return `"${item}"`;
    });
    
    return `[\n    ${items.join(',\n    ')}\n  ]`;
  }
  
  /**
   * Format an object value
   */
  function formatObject(obj: Record<string, any>): string {
    if (Object.keys(obj).length === 0) {
      return '{}';
    }
    
    const entries = Object.entries(obj).map(([key, value]) => {
      if (typeof value === 'string') {
        return `    ${key} = "${value}"`;
      } else if (typeof value === 'number') {
        return `    ${key} = ${value}`;
      } else if (typeof value === 'boolean') {
        return `    ${key} = ${value}`;
      } else if (Array.isArray(value)) {
        return `    ${key} = ${formatArray(value)}`;
      } else if (typeof value === 'object' && value !== null) {
        return `    ${key} = ${formatObject(value)}`;
      }
      return `    ${key} = "${value}"`;
    });
    
    return `{\n${entries.join('\n')}\n  }`;
  }
  
  /**
   * Add common attributes for specific resource types
   */
  function addCommonAttributes(attributes: Record<string, any>): string {
    const resourceType = attributes._resource_type;
    let result = '';
    
    // Add custom blocks based on resource type
    if (resourceType === 'aws_instance') {
      result += '\n  # Example lifecycle block\n';
      result += '  lifecycle {\n';
      result += '    create_before_destroy = true\n';
      result += '  }\n';
    }
    
    return result;
  }