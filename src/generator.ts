/**
 * Enhanced Generator module for creating Terraform configurations
 * Provides more complete, best-practice Terraform configurations with better structure and comments
 */

export interface SchemaAttribute {
  description: string;
  required: boolean;
  type?: string;
  elem?: {
    type?: string;
  };
  nested?: Record<string, SchemaAttribute>;
}

export interface Schema {
  attributes: Record<string, SchemaAttribute>;
}

interface BlockType {
  name: string;
  attributes: Record<string, any>;
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
  
  // Start building the configuration with header comments
  let config = `# Terraform configuration for ${resourceType}\n`;
  config += `# Generated with terraform-docs-mcp\n\n`;
  
  // Add terraform block with required providers
  config += generateTerraformBlock(provider);
  
  // Add provider block with best practice configuration
  config += generateProviderBlock(provider, attributes);
  
  // Add locals block if needed for this resource type
  const localsBlock = generateLocalsBlock(provider, resource, attributes);
  if (localsBlock) {
    config += localsBlock;
  }
  
  // Add resource block
  config += `resource "${resourceType}" "${resourceName}" {\n`;
  
  // Extract and organize blocks and attributes
  const { simpleAttributes, blockAttributes } = categorizeAttributes(schema.attributes, attributes);
  
  // Add resource attributes based on schema and provided values
  const attributeLines = formatAttributes(simpleAttributes, attributes);
  config += attributeLines;
  
  // Add block attributes (nested blocks)
  if (Object.keys(blockAttributes).length > 0) {
    config += formatBlockAttributes(blockAttributes, attributes);
  }
  
  // Add lifecycle block if appropriate
  const lifecycleBlock = generateLifecycleBlock(provider, resource);
  if (lifecycleBlock) {
    config += lifecycleBlock;
  }
  
  // Add depends_on if needed
  const dependsOnBlock = generateDependsOnBlock(provider, resource, attributes);
  if (dependsOnBlock) {
    config += dependsOnBlock;
  }
  
  config += `}\n\n`;
  
  // Add outputs section if appropriate
  const outputs = generateOutputs(provider, resource, resourceName);
  if (outputs) {
    config += outputs;
  }
  
  return config;
}

/**
 * Generate the terraform block with required providers
 */
function generateTerraformBlock(provider: string): string {
  let block = `terraform {\n`;
  block += `  required_version = ">= 1.0.0"\n\n`;
  block += `  required_providers {\n`;
  
  // Handle provider-specific configurations
  if (provider === 'aws') {
    block += `    aws = {\n`;
    block += `      source  = "hashicorp/aws"\n`;
    block += `      version = ">= 4.0.0"\n`;
    block += `    }\n`;
  } else if (provider === 'azure' || provider === 'azurerm') {
    block += `    azurerm = {\n`;
    block += `      source  = "hashicorp/azurerm"\n`;
    block += `      version = ">= 3.0.0"\n`;
    block += `    }\n`;
  } else if (provider === 'google' || provider === 'gcp') {
    block += `    google = {\n`;
    block += `      source  = "hashicorp/google"\n`;
    block += `      version = ">= 4.0.0"\n`;
    block += `    }\n`;
  } else {
    block += `    ${provider} = {\n`;
    block += `      source  = "hashicorp/${provider}"\n`;
    block += `      version = ">= 1.0.0"\n`;
    block += `    }\n`;
  }
  
  block += `  }\n`;
  block += `}\n\n`;
  
  return block;
}

/**
 * Generate provider block with best practice configuration
 */
function generateProviderBlock(provider: string, attributes: Record<string, any>): string {
  let block = `provider "${getNormalizedProviderName(provider)}" {\n`;
  
  // Handle provider-specific configurations
  if (provider === 'aws') {
    block += `  region = "${attributes.region || "us-west-2"}"\n`;
    
    // Add optional provider attributes
    if (attributes.profile) {
      block += `  profile = "${attributes.profile}"\n`;
    }
    
    if (attributes.assume_role) {
      block += `  assume_role {\n`;
      block += `    role_arn = "${attributes.assume_role.role_arn || "arn:aws:iam::123456789012:role/example"}"\n`;
      block += `  }\n`;
    }
    
    // Add default tags if provided or generate example
    if (attributes.default_tags || Math.random() > 0.5) {
      block += `  default_tags {\n`;
      block += `    tags = {\n`;
      
      const defaultTags = attributes.default_tags || {
        Project: "example-project",
        Environment: "dev",
        ManagedBy: "terraform"
      };
      
      for (const [key, value] of Object.entries(defaultTags)) {
        block += `      ${key} = "${value}"\n`;
      }
      
      block += `    }\n`;
      block += `  }\n`;
    }
  } else if (provider === 'azure' || provider === 'azurerm') {
    block += `  features {}\n`;
    
    if (attributes.subscription_id) {
      block += `  subscription_id = "${attributes.subscription_id}"\n`;
    }
    
    if (attributes.tenant_id) {
      block += `  tenant_id = "${attributes.tenant_id}"\n`;
    }
  } else if (provider === 'google' || provider === 'gcp') {
    block += `  project = "${attributes.project || "my-project-id"}"\n`;
    block += `  region  = "${attributes.region || "us-central1"}"\n`;
    
    if (attributes.zone) {
      block += `  zone    = "${attributes.zone}"\n`;
    }
  } else {
    // Generic provider attributes
    for (const [key, value] of Object.entries(attributes)) {
      if (typeof value === 'string') {
        block += `  ${key} = "${value}"\n`;
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        block += `  ${key} = ${value}\n`;
      }
    }
  }
  
  block += `}\n\n`;
  
  return block;
}

/**
 * Generate locals block if needed for this resource type
 */
function generateLocalsBlock(provider: string, resource: string, attributes: Record<string, any>): string | null {
  // Only generate locals for specific resource types or when helpful
  const needsLocals = 
    (provider === 'aws' && ['lambda_function', 's3_bucket', 'ecs_service'].includes(resource)) ||
    (provider === 'azurerm' && ['virtual_machine', 'app_service'].includes(resource));
  
  if (!needsLocals) {
    return null;
  }
  
  let block = `locals {\n`;
  
  if (provider === 'aws' && resource === 's3_bucket') {
    const bucketName = attributes.bucket || "example-bucket";
    block += `  # Format consistent bucket name with environment\n`;
    block += `  bucket_name = "${bucketName}-\${var.environment}"\n`;
    block += `  \n`;
    block += `  # Common tags that will be applied to all resources\n`;
    block += `  common_tags = {\n`;
    block += `    Environment = var.environment\n`;
    block += `    Project     = "example-project"\n`;
    block += `    ManagedBy   = "terraform"\n`;
    block += `  }\n`;
  } else if (provider === 'aws' && resource === 'lambda_function') {
    block += `  # Lambda function settings\n`;
    block += `  function_name = "example-function-\${var.environment}"\n`;
    block += `  handler       = "index.handler"\n`;
    block += `  runtime       = "nodejs16.x"\n`;
    block += `  timeout       = 30\n`;
    block += `  memory_size   = 128\n`;
  }
  
  block += `}\n\n`;
  
  return block;
}

/**
 * Return the normalized provider name for use in provider blocks
 */
function getNormalizedProviderName(provider: string): string {
  if (provider === 'gcp') {
    return 'google';
  } else if (provider === 'azure') {
    return 'azurerm';
  }
  return provider;
}

/**
 * Format resource name to a valid Terraform identifier
 */
function formatResourceName(resource: string): string {
  // Replace hyphens with underscores and make it descriptive
  const baseName = resource.replace(/-/g, '_');
  
  // Ensure the name is unique and descriptive
  return `${baseName}_example`;
}

/**
 * Categorize attributes into simple attributes and block attributes
 */
function categorizeAttributes(
  schemaAttributes: Record<string, SchemaAttribute>,
  providedAttributes: Record<string, any> = {}
): { simpleAttributes: Record<string, SchemaAttribute>, blockAttributes: Record<string, SchemaAttribute> } {
  const simpleAttributes: Record<string, SchemaAttribute> = {};
  const blockAttributes: Record<string, SchemaAttribute> = {};
  
  for (const [name, attr] of Object.entries(schemaAttributes)) {
    // Consider an attribute as a block if:
    // 1. It has a type of 'set', 'list', or 'map' with nested elements
    // 2. It has explicit nested attributes
    // 3. It's provided as a complex object in providedAttributes
    if (
      (attr.type === 'set' || attr.type === 'list' || attr.type === 'map') && attr.elem ||
      attr.nested ||
      (providedAttributes[name] && typeof providedAttributes[name] === 'object' && !Array.isArray(providedAttributes[name]))
    ) {
      blockAttributes[name] = attr;
    } else {
      simpleAttributes[name] = attr;
    }
  }
  
  return { simpleAttributes, blockAttributes };
}

/**
 * Format simple attributes based on schema and provided values
 */
function formatAttributes(
  schemaAttributes: Record<string, SchemaAttribute>,
  providedAttributes: Record<string, any> = {}
): string {
  let result = '';
  
  // Group attributes by required/optional status
  const requiredAttrs = Object.entries(schemaAttributes)
    .filter(([_, attr]) => attr.required);
    
  const optionalAttrs = Object.entries(schemaAttributes)
    .filter(([_, attr]) => !attr.required)
    .filter(([name]) => name in providedAttributes || Math.random() > 0.7); // Include some optional attrs randomly
  
  // Process required attributes first with a comment
  if (requiredAttrs.length > 0) {
    result += `  # Required attributes\n`;
    
    for (const [name, attr] of requiredAttrs) {
      const value = getAttributeValue(name, attr, providedAttributes);
      if (value !== null) {
        result += `  ${name} = ${value}\n`;
      }
    }
    
    result += '\n';
  }
  
  // Then process optional attributes that have been provided
  if (optionalAttrs.length > 0) {
    result += `  # Optional attributes\n`;
    
    for (const [name, attr] of optionalAttrs) {
      const value = getAttributeValue(name, attr, providedAttributes);
      if (value !== null) {
        // Add description as a comment
        if (attr.description) {
          result += `  # ${attr.description}\n`;
        }
        result += `  ${name} = ${value}\n`;
      }
    }
    
    result += '\n';
  }
  
  return result;
}

/**
 * Format block attributes (nested structures)
 */
function formatBlockAttributes(
  blockAttributes: Record<string, SchemaAttribute>,
  providedAttributes: Record<string, any> = {}
): string {
  let result = '';
  
  for (const [blockName, blockAttr] of Object.entries(blockAttributes)) {
    // Get the provided block or create a default one
    const providedBlock = providedAttributes[blockName] || {};
    
    // Add a comment for the block based on its description
    if (blockAttr.description) {
      result += `  # ${blockAttr.description}\n`;
    }
    
    // Handle different types of blocks
    if (blockAttr.type === 'set' || blockAttr.type === 'list') {
      // For set/list blocks, we might have multiple instances
      if (Array.isArray(providedBlock)) {
        for (const blockInstance of providedBlock) {
          result += formatSingleBlock(blockName, blockInstance);
        }
      } else {
        // Create at least one block
        result += formatSingleBlock(blockName, providedBlock);
      }
    } else {
      // For simple blocks
      result += formatSingleBlock(blockName, providedBlock);
    }
  }
  
  return result;
}

/**
 * Format a single block instance
 */
function formatSingleBlock(blockName: string, attributes: Record<string, any> = {}): string {
  let result = `  ${blockName} {\n`;
  
  for (const [attrName, attrValue] of Object.entries(attributes)) {
    if (typeof attrValue === 'string') {
      result += `    ${attrName} = "${attrValue}"\n`;
    } else if (typeof attrValue === 'number' || typeof attrValue === 'boolean') {
      result += `    ${attrName} = ${attrValue}\n`;
    } else if (Array.isArray(attrValue)) {
      result += `    ${attrName} = ${formatArray(attrValue)}\n`;
    } else if (typeof attrValue === 'object' && attrValue !== null) {
      // Nested block
      result += `    ${attrName} {\n`;
      for (const [nestedName, nestedValue] of Object.entries(attrValue)) {
        if (typeof nestedValue === 'string') {
          result += `      ${nestedName} = "${nestedValue}"\n`;
        } else if (typeof nestedValue === 'number' || typeof nestedValue === 'boolean') {
          result += `      ${nestedName} = ${nestedValue}\n`;
        } else if (Array.isArray(nestedValue)) {
          result += `      ${nestedName} = ${formatArray(nestedValue)}\n`;
        }
      }
      result += `    }\n`;
    }
  }
  
  result += `  }\n\n`;
  return result;
}

/**
 * Generate lifecycle block if appropriate for the resource
 */
function generateLifecycleBlock(provider: string, resource: string): string | null {
  // Resources that commonly need lifecycle blocks
  const needsLifecycle = [
    'aws_instance',
    'aws_security_group',
    'aws_lambda_function',
    'aws_autoscaling_group',
    'azurerm_virtual_machine',
    'google_compute_instance'
  ];
  
  const resourceType = `${provider}_${resource}`;
  
  if (needsLifecycle.includes(resourceType)) {
    let block = '\n  # Lifecycle configuration\n';
    block += '  lifecycle {\n';
    
    if (resourceType === 'aws_instance' || resourceType === 'azurerm_virtual_machine' || resourceType === 'google_compute_instance') {
      block += '    create_before_destroy = true\n';
    } else if (resourceType === 'aws_security_group') {
      block += '    create_before_destroy = true\n';
    } else if (resourceType === 'aws_lambda_function') {
      block += '    ignore_changes = [\n';
      block += '      # Ignore changes to the function source code hash\n';
      block += '      source_code_hash,\n';
      block += '    ]\n';
    } else if (resourceType === 'aws_autoscaling_group') {
      block += '    ignore_changes = [\n';
      block += '      # Ignore changes to the desired capacity when managed by external systems\n';
      block += '      desired_capacity,\n';
      block += '    ]\n';
    }
    
    block += '  }\n';
    return block;
  }
  
  return null;
}

/**
 * Generate depends_on block if needed
 */
function generateDependsOnBlock(provider: string, resource: string, attributes: Record<string, any>): string | null {
  // Resources that commonly need depends_on blocks
  const resourceType = `${provider}_${resource}`;
  
  const dependencyMap: Record<string, string[]> = {
    'aws_instance': ['aws_security_group.example', 'aws_subnet.example'],
    'aws_lambda_function': ['aws_iam_role.lambda_role', 'aws_cloudwatch_log_group.lambda_logs'],
    'aws_s3_bucket_policy': ['aws_s3_bucket.example'],
    'azurerm_virtual_machine': ['azurerm_network_interface.example', 'azurerm_resource_group.example']
  };
  
  if (dependencyMap[resourceType]) {
    let block = '\n  # Resource dependencies\n';
    block += '  depends_on = [\n';
    
    for (const dependency of dependencyMap[resourceType]) {
      block += `    ${dependency},\n`;
    }
    
    block += '  ]\n';
    return block;
  }
  
  return null;
}

/**
 * Generate outputs section if appropriate
 */
function generateOutputs(provider: string, resource: string, resourceName: string): string | null {
  const resourceType = `${provider}_${resource}`;
  
  // Skip outputs for some resource types that aren't usually directly referenced
  if (['aws_null_resource', 'aws_iam_policy_attachment'].includes(resourceType)) {
    return null;
  }
  
  let outputs = '# Resource outputs\n';
  
  if (provider === 'aws') {
    if (resource === 'instance') {
      outputs += `output "${resourceName}_id" {\n`;
      outputs += `  description = "The ID of the instance"\n`;
      outputs += `  value       = ${resourceType}.${resourceName}.id\n`;
      outputs += `}\n\n`;
      
      outputs += `output "${resourceName}_public_ip" {\n`;
      outputs += `  description = "The public IP address of the instance"\n`;
      outputs += `  value       = ${resourceType}.${resourceName}.public_ip\n`;
      outputs += `}\n\n`;
    } else if (resource === 's3_bucket') {
      outputs += `output "${resourceName}_id" {\n`;
      outputs += `  description = "The name of the bucket"\n`;
      outputs += `  value       = ${resourceType}.${resourceName}.id\n`;
      outputs += `}\n\n`;
      
      outputs += `output "${resourceName}_arn" {\n`;
      outputs += `  description = "The ARN of the bucket"\n`;
      outputs += `  value       = ${resourceType}.${resourceName}.arn\n`;
      outputs += `}\n\n`;
    }
  } else if (provider === 'azure' || provider === 'azurerm') {
    outputs += `output "${resourceName}_id" {\n`;
    outputs += `  description = "The ID of the ${resource.replace('_', ' ')}"\n`;
    outputs += `  value       = ${resourceType}.${resourceName}.id\n`;
    outputs += `}\n\n`;
  } else {
    // Generic output
    outputs += `output "${resourceName}_id" {\n`;
    outputs += `  description = "The ID of the created resource"\n`;
    outputs += `  value       = ${resourceType}.${resourceName}.id\n`;
    outputs += `}\n\n`;
  }
  
  return outputs;
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
  
  // Provide intelligent defaults based on attribute name and context
  return generateSmartDefaultValue(name, attr);
}

/**
 * Generate a smart default value based on attribute name and schema
 */
function generateSmartDefaultValue(name: string, attr: SchemaAttribute): string | null {
  // Skip generating values for certain attributes that should be explicitly provided
  const skipAttributes = ['access_key', 'secret_key', 'password', 'token'];
  if (skipAttributes.includes(name)) {
    return null;
  }
  
  // For required attributes, provide a good default
  if (attr.required) {
    if (name === 'name' || name.endsWith('_name')) {
      return `"example-${name.replace('_name', '')}"`;
    } else if (name === 'bucket') {
      return `"example-bucket-${Math.floor(Math.random() * 100000)}"`;
    } else if (name === 'ami' || name === 'image_id') {
      return `"ami-12345678"`;
    } else if (name === 'instance_type') {
      return `"t3.micro"`;
    } else if (name === 'region') {
      return `"us-west-2"`;
    } else if (name === 'zone' || name.endsWith('_zone')) {
      return `"us-central1-a"`;
    } else if (name === 'machine_type') {
      return `"e2-medium"`;
    } else if (name.includes('id') && !name.includes('_id')) {
      return `"example-id-${Math.floor(Math.random() * 10000)}"`;
    } else if (name.includes('arn')) {
      return `"arn:aws:service:region:account-id:resource/example"`;
    } else if (name.includes('cidr')) {
      return `"10.0.0.0/16"`;
    } else if (attr.type === 'string') {
      return `"example-value-for-${name}"`;
    } else if (attr.type === 'number') {
      return '42';
    } else if (attr.type === 'bool') {
      return 'true';
    }
    
    return `"required-value-for-${name}"`;
  }
  
  // For optional common attributes, provide good defaults
  if (name === 'tags' || name.endsWith('_tags')) {
    return formatObject({ 
      Name: "example", 
      Environment: "dev",
      ManagedBy: "terraform" 
    });
  } else if (name.includes('enabled') || name.includes('enable_')) {
    return 'true';
  } else if (name === 'description') {
    return `"Example resource created with Terraform"`;
  }
  
  // Skip optional attributes that don't have special handling
  return null;
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