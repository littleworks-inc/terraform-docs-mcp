#!/usr/bin/env node
/// <reference lib="dom" />

// Import from the correct paths
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { generateTerraformConfig } from './generator.js';
import * as https from 'https';
// Import cheerio for better HTML parsing
import * as cheerio from 'cheerio';

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

interface DocInfo {
  documentation: string;
  examples: string[];
  attrs: Record<string, SchemaAttribute>;
  url: string;
}

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

// List available terraform generation tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  // Important: Use console.error instead of console.log
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

// Type guard to ensure provider arguments
function isProviderDocsArgs(args: any): args is ProviderDocsArgs {
  return typeof args === 'object' && args !== null && typeof args.provider === 'string';
}

// Type guard to ensure resource arguments
function isResourceSchemaArgs(args: any): args is ResourceSchemaArgs {
  return typeof args === 'object' && args !== null && 
         typeof args.provider === 'string' && 
         typeof args.resource === 'string';
}

// Type guard to ensure config arguments
function isGenerateConfigArgs(args: any): args is GenerateConfigArgs {
  return typeof args === 'object' && args !== null && 
         typeof args.provider === 'string' && 
         typeof args.resource === 'string';
}

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  console.error(`Executing tool: ${request.params.name}`);
  
  try {
    // Compatible response structure for both platforms
    let response: any = {
      // For cline.bot: content array is required
      content: []
    };
    
    if (request.params.name === "terraform_provider_docs") {
      // Type safety check
      if (!request.params.arguments || !isProviderDocsArgs(request.params.arguments)) {
        throw new Error("Invalid arguments: provider is required");
      }
      
      const providerInfo = await fetchProviderDocs(request.params.arguments);
      
      // For Claude Desktop: result property
      response.result = providerInfo;
      
      // For cline.bot: content array
      response.content = [
        {
          type: "text",
          text: `Documentation for ${request.params.arguments.provider}${request.params.arguments.resource ? '_' + request.params.arguments.resource : ''}:\n\n${providerInfo.documentation}\n\nExamples:\n${providerInfo.examples.join('\n\n')}`
        }
      ];
    }
    else if (request.params.name === "terraform_generate_config") {
      // Type safety check
      if (!request.params.arguments || !isGenerateConfigArgs(request.params.arguments)) {
        throw new Error("Invalid arguments: provider and resource are required");
      }
      
      const schema = await fetchResourceSchema(request.params.arguments);
      const terraformConfig = generateTerraformConfig(
        request.params.arguments.provider, 
        request.params.arguments.resource, 
        schema, 
        request.params.arguments.attributes || {}
      );
      
      // For Claude Desktop: result property
      response.result = terraformConfig;
      
      // For cline.bot: content array
      response.content = [
        {
          type: "text",
          text: `Generated Terraform Configuration:\n\n\`\`\`hcl\n${terraformConfig}\n\`\`\``
        }
      ];
    }
    else if (request.params.name === "terraform_resource_schema") {
      // Type safety check
      if (!request.params.arguments || !isResourceSchemaArgs(request.params.arguments)) {
        throw new Error("Invalid arguments: provider and resource are required");
      }
      
      const schema = await fetchResourceSchema(request.params.arguments);
      
      // For Claude Desktop: result property
      response.result = schema;
      
      // For cline.bot: content array
      response.content = [
        {
          type: "text",
          text: `Schema for ${request.params.arguments.provider}_${request.params.arguments.resource}:\n\n\`\`\`json\n${JSON.stringify(schema, null, 2)}\n\`\`\``
        }
      ];
    }
    else {
      // Error response for unknown tool
      response = {
        error: {
          message: `Unknown tool: ${request.params.name}`
        },
        content: [
          {
            type: "text",
            text: `Unknown tool: ${request.params.name}`
          }
        ]
      };
    }
    
    console.error(`Tool response: ${JSON.stringify(response)}`);
    return response;
  } catch (error: any) {
    console.error("Error executing tool:", error);
    return {
      error: {
        message: `Error executing tool: ${error.message}`
      },
      content: [
        {
          type: "text",
          text: `Error executing tool: ${error.message}`
        }
      ]
    };
  }
});

// HTTP request function to fetch documentation
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

// Get the correct Terraform Registry provider name
function getProviderSlug(provider: string): string {
  const providerMappings: Record<string, string> = {
    'azure': 'azurerm',
    'gcp': 'google',
    'google-cloud': 'google',
    'digitalocean': 'digitalocean',
    'aws': 'aws',
    'kubernetes': 'kubernetes',
    'k8s': 'kubernetes',
    'github': 'github',
    'gitlab': 'gitlab',
    'azuread': 'azuread',
    'cloudflare': 'cloudflare',
    'docker': 'docker',
    'helm': 'helm',
    'oci': 'oci',
    'oracle': 'oci',
    'vsphere': 'vsphere'
  };
  
  return providerMappings[provider.toLowerCase()] || provider.toLowerCase();
}

/**
 * Fetch provider documentation from Terraform Registry
 */
async function fetchProviderDocs(args: ProviderDocsArgs): Promise<DocInfo> {
  const { provider, resource } = args;
  
  try {
    // Map provider name to Terraform Registry format
    const providerSlug = getProviderSlug(provider);
    
    // Construct URL for documentation
    let url = `https://registry.terraform.io/providers/hashicorp/${providerSlug}/latest/docs`;
    
    if (resource) {
      url += `/resources/${resource}`;
    }
    
    console.error(`Fetching documentation from: ${url}`);
    
    const html = await httpGet(url);
    
    // Use cheerio for better HTML parsing
    const $ = cheerio.load(html);
    const documentation = $('.main-content').text().trim();
    
    // Extract code examples
    const examples: string[] = [];
    $('.highlight pre').each((i, element) => {
      examples.push($(element).text().trim());
    });
    
    // Extract attribute descriptions
    const attrs: Record<string, SchemaAttribute> = {};
    
    // Find argument section - often has a heading like "Argument Reference"
    $('.main-content h2, .main-content h3').each((i, element) => {
      const heading = $(element).text().trim();
      if (heading.includes('Argument') || heading.includes('Arguments')) {
        let currentElement = $(element).next();
        
        // Extract attribute information from lists after the heading
        while (currentElement.length && !currentElement.is('h2, h3')) {
          if (currentElement.is('ul, dl')) {
            currentElement.find('li, dt').each((j, item) => {
              const itemText = $(item).text().trim();
              
              // Parse attribute information: typically in format "name - (Required|Optional) description"
              const nameMatch = itemText.match(/^`?([a-zA-Z0-9_]+)`?\s*-\s*/);
              
              if (nameMatch) {
                const name = nameMatch[1];
                const required = itemText.includes('(Required)');
                const description = itemText.replace(/^`?([a-zA-Z0-9_]+)`?\s*-\s*(\(Required\)|\(Optional\))?/, '').trim();
                
                // Guess the type from the description
                let type = 'string'; // Default type
                if (description.includes('list') || description.includes('array')) {
                  type = 'list';
                } else if (description.includes('map') || description.includes('object')) {
                  type = 'map';
                } else if (description.includes('boolean') || description.includes('true') || description.includes('false')) {
                  type = 'boolean';
                } else if (description.includes('number') || description.includes('integer')) {
                  type = 'number';
                }
                
                attrs[name] = {
                  description,
                  required,
                  type
                };
              }
            });
          }
          currentElement = currentElement.next();
        }
      }
    });
    
    return {
      documentation: documentation || "Documentation content could not be extracted",
      examples: examples,
      attrs: attrs,
      url: url
    };
  } catch (error: any) {
    console.error("Error fetching provider docs:", error);
    throw new Error(`Failed to fetch provider documentation: ${error.message}`);
  }
}

/**
 * Fetch resource schema by parsing Terraform documentation
 */
async function fetchResourceSchema(args: ResourceSchemaArgs): Promise<Schema> {
  const { provider, resource } = args;
  
  try {
    console.error(`Fetching schema for: ${provider}_${resource}`);
    
    // Get documentation which includes argument information
    const docInfo = await fetchProviderDocs({ provider, resource });
    
    // Create schema object from extracted attributes
    const schema: Schema = {
      attributes: docInfo.attrs || {}
    };
    
    // If no attributes were extracted, add a generic fallback schema
    if (Object.keys(schema.attributes).length === 0) {
      console.error(`No schema attributes found for ${provider}_${resource}, using generic schema`);
      
      // Add a name attribute as a generic fallback
      schema.attributes = {
        name: {
          description: `The name of the ${resource}`,
          required: true,
          type: "string"
        }
      };
      
      // Add likely common attributes based on resource name pattern recognition
      if (resource.includes('bucket') || resource.includes('storage')) {
        schema.attributes.location = {
          description: "The location/region for the resource",
          required: true,
          type: "string"
        };
      }
      
      if (resource.includes('instance') || resource.includes('vm') || resource.includes('machine')) {
        schema.attributes.size = {
          description: "The size/type of the virtual machine",
          required: true,
          type: "string"
        };
        schema.attributes.location = {
          description: "The location/region for the resource",
          required: true,
          type: "string"
        };
      }
      
      // Always add tags as a common attribute
      schema.attributes.tags = {
        description: "Tags to assign to the resource",
        required: false,
        type: "map"
      };
    }
    
    return schema;
  } catch (error: any) {
    console.error("Error fetching resource schema:", error);
    
    // Return a minimal generic schema on error
    return {
      attributes: {
        name: {
          description: `Name for the ${resource}`,
          required: true,
          type: "string"
        }
      }
    };
  }
}

// Create a stdio server for MCP
function createStdioServer(server: Server) {
  const transport = new StdioServerTransport();
  
  return {
    async start() {
      await server.connect(transport);
      console.error("MCP Server started successfully!");
    }
  };
}

const stdioServer = createStdioServer(server);
stdioServer.start().catch((error: any) => {
  console.error("Error starting server:", error);
  process.exit(1);
});