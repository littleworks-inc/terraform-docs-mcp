#!/usr/bin/env node
/// <reference lib="dom" />

// Import from the correct paths
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { generateTerraformConfig } from './generator.js';
import * as https from 'https';
import { 
  fetchResourceExamples, 
  fetchResourceSchemaFromGithub, 
  getRepoOrDiscover 
} from './github.js';

// Define TypeScript interfaces for better type safety
interface ProviderDocsArgs {
  provider: string;
  resource?: string;
  useGithub?: boolean;
}

interface GenerateConfigArgs {
  provider: string;
  resource: string;
  attributes?: Record<string, any>;
  useGithub?: boolean;
}

interface ResourceSchemaArgs {
  provider: string;
  resource: string;
  useGithub?: boolean;
}

interface SchemaAttribute {
  description: string;
  required: boolean;
  type?: string;
}

interface Schema {
  attributes: Record<string, SchemaAttribute>;
}

interface GithubInfoArgs {
  provider: string;
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
            },
            useGithub: {
              type: "boolean",
              description: "Whether to use GitHub as an additional source for documentation",
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
            },
            useGithub: {
              type: "boolean",
              description: "Whether to use GitHub schema information",
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
            },
            useGithub: {
              type: "boolean",
              description: "Whether to use GitHub as the source for schema information",
            }
          },
          required: ["provider", "resource"]
        }
      },
      {
        name: "terraform_github_info",
        description: "Get GitHub repository information for a Terraform provider",
        inputSchema: {
          type: "object",
          properties: {
            provider: {
              type: "string",
              description: "Provider name (e.g., aws, azure, gcp)",
            }
          },
          required: ["provider"]
        }
      }
    ]
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
  console.error(`Executing tool: ${request.params.name}`);
  
  try {
    let response;
    
    if (request.params.name === "terraform_provider_docs") {
      response = await fetchProviderDocs(request.params.arguments);
    }
    else if (request.params.name === "terraform_generate_config") {
      response = await generateTerraformConfiguration(request.params.arguments);
    }
    else if (request.params.name === "terraform_resource_schema") {
      response = await fetchResourceSchema(request.params.arguments);
    }
    else if (request.params.name === "terraform_github_info") {
      response = await fetchGithubInfo(request.params.arguments);
    }
    else {
      return {
        error: {
          message: `Unknown tool: ${request.params.name}`
        }
      };
    }
    
    console.error(`Tool response: ${JSON.stringify(response)}`);
    return response;
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

// Simple HTML parser that extracts text from HTML (very basic)
function extractText(html: string, selector: string): string {
  // A very simple implementation - in a real scenario, you'd use a proper HTML parser
  const mainContentStart = html.indexOf('main-content');
  if (mainContentStart === -1) return '';
  
  const startIdx = html.indexOf('>', mainContentStart) + 1;
  const endIdx = html.indexOf('</div>', startIdx);
  
  return html.substring(startIdx, endIdx).trim();
}

// Extract examples from HTML
function extractExamples(html: string): string[] {
  const examples: string[] = [];
  let searchPos = 0;
  
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

/**
 * Fetch provider documentation from Terraform Registry and/or GitHub
 */
async function fetchProviderDocs(args: ProviderDocsArgs) {
  const { provider, resource, useGithub = false } = args;
  
  try {
    let registryUrl = `https://registry.terraform.io/providers/hashicorp/${provider}/latest/docs`;
    
    if (resource) {
      registryUrl += `/resources/${resource}`;
    }
    
    console.error(`Fetching documentation from: ${registryUrl}`);
    
    // Get Registry documentation
    const html = await httpGet(registryUrl);
    const docs = extractText(html, 'main-content');
    const registryExamples = extractExamples(html);
    
    let result: {
      documentation: string;
      examples: string[];
      url: string;
      sources: string[];
      githubRepo?: string;
    } = {
      documentation: docs || "Documentation content could not be extracted",
      examples: registryExamples,
      url: registryUrl,
      sources: ["Terraform Registry"]
    };
    
    // If GitHub integration is enabled, fetch additional examples
    if (useGithub && resource) {
      console.error(`Fetching GitHub examples for: ${provider}_${resource}`);
      const githubExamples = await fetchResourceExamples(provider, resource);
      
      if (githubExamples.length > 0) {
        result.examples = [...registryExamples, ...githubExamples];
        result.sources = [...result.sources, "GitHub"];
      }
      
      // Get GitHub repository info
      const repo = await getRepoOrDiscover(provider);
      if (repo) {
        result.githubRepo = `https://github.com/${repo.owner}/${repo.name}`;
      }
    }
    
    return { result };
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
  const { provider, resource, attributes = {}, useGithub = false } = args;
  
  try {
    console.error(`Generating Terraform configuration for ${provider}_${resource}`);
    
    // Get the resource schema
    const schemaResponse = await fetchResourceSchema({ provider, resource, useGithub });
    
    if (schemaResponse.error) {
      return schemaResponse;
    }
    
    const schema = schemaResponse.result;
    
    // Generate Terraform configuration using the schema and provided attributes
    const configuration = generateTerraformConfig(provider, resource, schema, attributes);
    
    // Return the configuration
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
 * Fetch resource schema from simulated data or GitHub
 */
async function fetchResourceSchema(args: ResourceSchemaArgs) {
  const { provider, resource, useGithub = false } = args;
  
  try {
    console.error(`Fetching schema for: ${provider}_${resource}`);
    
    // If GitHub integration is enabled, try to fetch schema from there first
    if (useGithub) {
      try {
        console.error("Attempting to fetch schema from GitHub...");
        const githubSchema = await fetchResourceSchemaFromGithub(provider, resource);
        return {
          result: githubSchema,
          source: "GitHub"
        };
      } catch (githubError) {
        console.error("Failed to fetch schema from GitHub, falling back to simulated data:", githubError);
      }
    }
    
    // Create a simulated schema with a proper structure as fallback
    const schema: Schema = {
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
    if (provider === 'aws' && resource === 'instance') {
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
    } else if (provider === 'aws' && resource === 's3_bucket') {
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
    } else if (provider === 'gcp' && resource === 'compute_instance') {
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
    }
    
    return {
      result: schema,
      source: "Simulated Data"
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
 * Fetch GitHub repository information for a provider
 */
async function fetchGithubInfo(args: GithubInfoArgs) {
  const { provider } = args;
  
  try {
    console.error(`Fetching GitHub info for provider: ${provider}`);
    
    const repo = await getRepoOrDiscover(provider);
    
    if (!repo) {
      return {
        error: {
          message: `Could not find GitHub repository for provider: ${provider}`
        }
      };
    }
    
    return {
      result: {
        owner: repo.owner,
        name: repo.name,
        defaultBranch: repo.defaultBranch,
        url: `https://github.com/${repo.owner}/${repo.name}`,
        apiUrl: `https://api.github.com/repos/${repo.owner}/${repo.name}`
      }
    };
  } catch (error: any) {
    console.error("Error fetching GitHub info:", error);
    return {
      error: {
        message: `Failed to fetch GitHub repository information: ${error.message}`
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