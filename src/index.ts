#!/usr/bin/env node

// Import from the correct paths
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import * as https from 'https';

// Create server with proper arguments
const server = new Server(
  { 
    name: "terraform-docs-mcp", 
    version: "0.1.0" 
  },
  { 
    capabilities: { 
      tools: {} 
    } 
  }
);

// Define TypeScript interfaces for better type safety
interface ProviderDocsArgs {
  provider: string;
  resource?: string;
}

interface GenerateConfigArgs {
  provider: string;
  resource: string;
  attributes?: Record<string, any>;
}

interface ResourceSchemaArgs {
  provider: string;
  resource: string;
}

interface SchemaAttribute {
  description: string;
  required: boolean;
  type?: string;
}

interface Schema {
  attributes: Record<string, SchemaAttribute>;
}

// List available terraform generation tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.error("Listing available Terraform tools");
  
  return {
    tools: [
      {
        name: "terraform_provider_docs",
        description: "Retrieve documentation for a Terraform provider and its resources",
        inputSchema: {
          type: "object",
          properties: {
            provider: { 
              type: "string", 
              description: "Provider name (e.g., aws, azure, gcp)", 
            },
            resource: { 
              type: "string", 
              description: "Resource name (e.g., instance, bucket, vpc)", 
            }
          },
          required: ["provider"]
        }
      },
      {
        name: "terraform_generate_config",
        description: "Generate Terraform configuration based on provider and resource",
        inputSchema: {
          type: "object",
          properties: {
            provider: { 
              type: "string", 
              description: "Provider name (e.g., aws, azure, gcp)", 
            },
            resource: { 
              type: "string", 
              description: "Resource name (e.g., instance, bucket, vpc)", 
            },
            attributes: { 
              type: "object", 
              description: "Resource attributes to configure", 
            }
          },
          required: ["provider", "resource"]
        }
      },
      {
        name: "terraform_resource_schema",
        description: "Get the schema for a Terraform resource",
        inputSchema: {
          type: "object",
          properties: {
            provider: { 
              type: "string", 
              description: "Provider name (e.g., aws, azure, gcp)", 
            },
            resource: { 
              type: "string", 
              description: "Resource name (e.g., instance, bucket, vpc)", 
            }
          },
          required: ["provider", "resource"]
        }
      }
    ]
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
  console.error(`Executing tool: ${request.params.name}`);
  
  try {
    if (request.params.name === "terraform_provider_docs") {
      return await fetchProviderDocs(request.params.arguments);
    }
    
    if (request.params.name === "terraform_generate_config") {
      return await generateTerraformConfiguration(request.params.arguments);
    }
    
    if (request.params.name === "terraform_resource_schema") {
      return await fetchResourceSchema(request.params.arguments);
    }
    
    return {
      error: {
        message: `Unknown tool: ${request.params.name}`
      }
    };
  } catch (error: any) {
    console.error("Error executing tool:", error);
    return {
      error: {
        message: `Error executing tool: ${error.message}`
      }
    };
  }
});

// Simple HTTP request function that doesn't use axios
function httpGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve(data);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Extract text from HTML
function extractText(html: string, selector: string): string {
  // A simple implementation that looks for content in the main-content div
  const contentStart = html.indexOf(selector);
  if (contentStart === -1) return '';
  
  const startIdx = html.indexOf('>', contentStart) + 1;
  const endIdx = html.indexOf('</div>', startIdx);
  
  return html.substring(startIdx, endIdx).trim();
}

// Extract examples from HTML
function extractExamples(html: string): string[] {
  const examples: string[] = [];
  let searchPos = 0;
  
  // Look for code blocks with the 'highlight' class
  while (true) {
    const highlightPos = html.indexOf('highlight', searchPos);
    if (highlightPos === -1) break;
    
    const startPos = html.indexOf('>', highlightPos) + 1;
    const endPos = html.indexOf('</pre>', startPos);
    
    if (startPos > 0 && endPos > startPos) {
      examples.push(html.substring(startPos, endPos).trim());
      searchPos = endPos;
    } else {
      break;
    }
  }
  
  return examples;
}

// Extract attributes from documentation HTML
function extractAttributes(html: string): Record<string, SchemaAttribute> {
  const attributes: Record<string, SchemaAttribute> = {};
  
  // Look for argument tables in the HTML
  const argumentTableStart = html.indexOf('Arguments Reference');
  if (argumentTableStart === -1) return attributes;
  
  const tableStart = html.indexOf('<table', argumentTableStart);
  if (tableStart === -1) return attributes;
  
  const tableEnd = html.indexOf('</table>', tableStart);
  if (tableEnd === -1) return attributes;
  
  const tableContent = html.substring(tableStart, tableEnd);
  
  // Parse rows from the table
  const rows = tableContent.split('<tr>').slice(1); // Skip header
  
  for (const row of rows) {
    const cells = row.split('<td>').slice(1).map(cell => cell.split('</td>')[0].trim());
    if (cells.length >= 2) {
      const name = cells[0].replace(/<[^>]*>/g, '').trim();
      const description = cells[1].replace(/<[^>]*>/g, '').trim();
      const required = description.toLowerCase().includes('required');
      const type = cells.length >= 3 ? cells[2].replace(/<[^>]*>/g, '').trim() : undefined;
      
      if (name) {
        attributes[name] = {
          description,
          required,
          type
        };
      }
    }
  }
  
  return attributes;
}

/**
 * Fetch provider documentation from Terraform Registry
 */
async function fetchProviderDocs(args: ProviderDocsArgs) {
  const { provider, resource } = args;
  
  try {
    let url = `https://registry.terraform.io/providers/hashicorp/${provider}/latest/docs`;
    
    if (resource) {
      url += `/resources/${resource}`;
    }
    
    console.error(`Fetching documentation from: ${url}`);
    
    // Fetch the HTML content
    const html = await httpGet(url);
    
    // Extract main content
    const docs = extractText(html, 'main-content');
    
    // Extract code examples
    const examples = extractExamples(html);
    
    return {
      result: {
        documentation: docs || `Documentation for ${provider}${resource ? `_${resource}` : ''}`,
        examples: examples,
        url: url
      }
    };
  } catch (error: any) {
    console.error("Error fetching provider docs:", error);
    return {
      error: {
        message: `Failed to fetch provider documentation: ${error.message}`
      }
    };
  }
}

/**
 * Generate Terraform configuration based on provider and resource
 */
async function generateTerraformConfiguration(args: GenerateConfigArgs) {
  const { provider, resource, attributes = {} } = args;
  
  try {
    console.error(`Generating Terraform configuration for ${provider}_${resource}`);
    
    // First, get the resource schema
    const schemaResponse = await fetchResourceSchema({ provider, resource });
    
    if (schemaResponse.error) {
      return schemaResponse;
    }
    
    const schema = schemaResponse.result;
    
    // Generate Terraform configuration
    const configuration = generateConfig(provider, resource, schema, attributes);
    
    return {
      result: configuration
    };
  } catch (error: any) {
    console.error("Error generating Terraform configuration:", error);
    return {
      error: {
        message: `Failed to generate Terraform configuration: ${error.message}`
      }
    };
  }
}

/**
 * Fetch resource schema from Terraform Registry
 */
async function fetchResourceSchema(args: ResourceSchemaArgs) {
  const { provider, resource } = args;
  
  try {
    // Form the URL to the resource documentation
    const url = `https://registry.terraform.io/providers/hashicorp/${provider}/latest/docs/resources/${resource}`;
    
    console.error(`Fetching schema from: ${url}`);
    
    // Fetch the HTML content
    const html = await httpGet(url);
    
    // Extract attributes from the documentation
    const attributes = extractAttributes(html);
    
    // If no attributes were found, provide some defaults
    if (Object.keys(attributes).length === 0) {
      // Use provider-specific defaults if we know them
      if (provider === 'aws' && resource === 'instance') {
        attributes.ami = {
          description: "The AMI to use for the instance",
          required: true,
          type: "string"
        };
        attributes.instance_type = {
          description: "The instance type to use",
          required: true,
          type: "string"
        };
      } else if (provider === 'aws' && resource === 's3_bucket') {
        attributes.bucket = {
          description: "The name of the bucket",
          required: true,
          type: "string"
        };
        attributes.acl = {
          description: "The canned ACL to apply",
          required: false,
          type: "string"
        };
      } else {
        // Generic defaults
        attributes.name = {
          description: "The name of the resource",
          required: true,
          type: "string"
        };
      }
    }
    
    // Create the schema
    const schema: Schema = {
      attributes
    };
    
    return {
      result: schema
    };
  } catch (error: any) {
    console.error("Error fetching resource schema:", error);
    return {
      error: {
        message: `Failed to fetch resource schema: ${error.message}`
      }
    };
  }
}

/**
 * Generate Terraform configuration based on provider, resource, schema and attributes
 */
function generateConfig(
  provider: string,
  resource: string,
  schema: Schema,
  attributes: Record<string, any> = {}
): string {
  // Format the resource name
  const resourceType = `${provider}_${resource}`;
  const resourceName = resource.replace(/-/g, '_');
  
  // Start building the configuration
  let config = `# Terraform configuration for ${resourceType}\n\n`;
  
  // Add provider block
  config += `provider "${provider}" {\n`;
  
  // Common provider attributes
  if (provider === 'aws') {
    config += `  region = "${attributes.region || "us-west-2"}"\n`;
  } else if (provider === 'azurerm') {
    config += `  features {}\n`;
  } else if (provider === 'google') {
    config += `  project = "${attributes.project || "my-project-id"}"\n`;
  }
  
  config += `}\n\n`;
  
  // Add resource block
  config += `resource "${resourceType}" "${resourceName}_example" {\n`;
  
  // Add required attributes
  const requiredAttrs = Object.entries(schema.attributes)
    .filter(([_, attr]) => attr.required);
    
  for (const [name, attr] of requiredAttrs) {
    const value = getAttributeValue(name, attr, attributes);
    if (value !== null) {
      config += `  ${name} = ${value}\n`;
    }
  }
  
  // Add optional attributes that have been provided
  const optionalAttrs = Object.entries(schema.attributes)
    .filter(([_, attr]) => !attr.required)
    .filter(([name]) => name in attributes);
    
  if (optionalAttrs.length > 0) {
    config += '\n  # Optional attributes\n';
    
    for (const [name, attr] of optionalAttrs) {
      const value = getAttributeValue(name, attr, attributes);
      if (value !== null) {
        config += `  ${name} = ${value}\n`;
      }
    }
  }
  
  // Add tags if they exist
  if (attributes.tags && typeof attributes.tags === 'object') {
    config += '\n  tags = {\n';
    for (const [key, value] of Object.entries(attributes.tags)) {
      config += `    ${key} = "${value}"\n`;
    }
    config += '  }\n';
  }
  
  config += `}\n`;
  
  return config;
}

/**
 * Get the formatted value for an attribute
 */
function getAttributeValue(
  name: string,
  attr: SchemaAttribute,
  attributes: Record<string, any>
): string | null {
  // If the value is explicitly provided, use it
  if (name in attributes) {
    const value = attributes[name];
    
    // Format the value based on its type
    if (typeof value === 'string') {
      return `"${value}"`;
    } else if (typeof value === 'number') {
      return value.toString();
    } else if (typeof value === 'boolean') {
      return value.toString();
    } else if (Array.isArray(value)) {
      return formatArray(value);
    } else if (typeof value === 'object' && value !== null && name !== 'tags') {
      return formatObject(value);
    }
    
    return `"${value}"`;
  }
  
  // Provide reasonable defaults based on attribute name and context
  switch (name) {
    case 'name':
      return `"example-resource"`;
    case 'ami':
      return `"ami-12345678"`;
    case 'instance_type':
      return `"t2.micro"`;
    case 'bucket':
      return `"example-terraform-bucket"`;
    case 'acl':
      return `"private"`;
    case 'zone':
      return `"us-central1-a"`;
    case 'machine_type':
      return `"e2-medium"`;
    default:
      // For other required attributes, provide a placeholder
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

// Create a stdio server for MCP
const transport = new StdioServerTransport();
server.connect(transport).then(() => {
  console.error("MCP Server started successfully!");
}).catch((error: any) => {
  console.error("Error starting server:", error);
  process.exit(1);
});