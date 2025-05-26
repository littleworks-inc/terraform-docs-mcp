#!/usr/bin/env node
/// <reference lib="dom" />

// Import statements at the top of index.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

import { ApiSchemaAttribute, ApiSchema, isDefined, assertDefined, safeArrayAccess } from './types/common.js';


// Import the generator types explicitly
import { generateTerraformConfig, Schema as GeneratorSchema, SchemaAttribute as GeneratorSchemaAttribute } from './generator.js';

// Import enhanced services
import { getConfig } from './config/index.js';
import { githubService } from './github.js';
import { httpClient } from './services/http-client.js';
import { ErrorHandler, GitHubApiError, SchemaParseError, ConfigGenerationError, ProviderNotSupportedError, ValidationError, ResourceNotFoundError } from './errors/index.js';

// Import schema integration
import {
  fetchEnhancedResourceSchema,
  fetchSchemaAndGenerateConfig,
  isValidSchema
} from './schema-integration.js';

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

// Our API schema attribute format (what we return to the client)
interface ApiSchemaAttribute {
  description: string;
  required: boolean;
  type?: string;
  nested?: boolean;
}

interface ApiSchema {
  attributes: Record<string, ApiSchemaAttribute>;
}

interface GithubInfoArgs {
  provider: string;
}

// Get configuration instance
const config = getConfig();

// Create server with proper arguments
const server = new Server(
  { 
    name: config.server.name, 
    version: config.server.version 
  },
  { 
    capabilities: { 
      tools: {} 
    } 
  }
);

// List available terraform generation tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.error(`[${new Date().toISOString()}] Listing available Terraform tools`);
  
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
              default: false
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
              default: true
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
              default: true
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

// Handle tool execution with enhanced error handling
server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
  const startTime = Date.now();
  console.error(`[${new Date().toISOString()}] Executing tool: ${request.params.name}`);
  
  try {
    // Input validation
    if (!request.params?.name) {
      throw new ValidationError('Tool name is required', 'name', request.params?.name);
    }

    if (!request.params?.arguments) {
      throw new ValidationError('Tool arguments are required', 'arguments', request.params?.arguments);
    }

    // Validate tool-specific arguments
    validateToolArguments(request.params.name, request.params.arguments);

    let response;
    
    switch (request.params.name) {
      case "terraform_provider_docs":
        response = await fetchProviderDocsWithErrorHandling(request.params.arguments);
        break;
        
      case "terraform_generate_config":
        response = await generateTerraformConfigurationWithErrorHandling(request.params.arguments);
        break;
        
      case "terraform_resource_schema":
        response = await fetchResourceSchemaWithErrorHandling(request.params.arguments);
        break;
        
      case "terraform_github_info":
        response = await fetchGithubInfoWithErrorHandling(request.params.arguments);
        break;
        
      default:
        throw new ValidationError(
          `Unknown tool: ${request.params.name}`,
          'toolName',
          request.params.name
        );
    }
    
    const duration = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] Tool completed in ${duration}ms: ${request.params.name}`);
    
    return response;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] Tool failed after ${duration}ms: ${request.params.name}`);
    
    ErrorHandler.logError(error, {
      tool: request.params.name,
      arguments: request.params.arguments,
      duration
    });
    
    return ErrorHandler.createErrorResponse(error);
  }
});

/**
 * Validate tool arguments
 */
function validateToolArguments(toolName: string, args: any): void {
  switch (toolName) {
    case 'terraform_provider_docs':
      if (!args.provider || typeof args.provider !== 'string') {
        throw new ValidationError('Provider is required and must be a string', 'provider', args.provider);
      }
      break;
      
    case 'terraform_generate_config':
      if (!args.provider || typeof args.provider !== 'string') {
        throw new ValidationError('Provider is required and must be a string', 'provider', args.provider);
      }
      if (!args.resource || typeof args.resource !== 'string') {
        throw new ValidationError('Resource is required and must be a string', 'resource', args.resource);
      }
      break;
      
    case 'terraform_resource_schema':
      if (!args.provider || typeof args.provider !== 'string') {
        throw new ValidationError('Provider is required and must be a string', 'provider', args.provider);
      }
      if (!args.resource || typeof args.resource !== 'string') {
        throw new ValidationError('Resource is required and must be a string', 'resource', args.resource);
      }
      break;
      
    case 'terraform_github_info':
      if (!args.provider || typeof args.provider !== 'string') {
        throw new ValidationError('Provider is required and must be a string', 'provider', args.provider);
      }
      break;
      
    default:
      throw new ValidationError(`Unknown tool: ${toolName}`, 'toolName', toolName);
  }
}

/**
 * Utility function for extracting text from HTML (improved)
 */
function extractText(html: string, selector: string): string {
  try {
    // A more robust implementation for extracting main content
    let content = '';
    
    // Try to find main content area
    const mainContentStart = html.indexOf('<main');
    if (mainContentStart !== -1) {
      const mainStart = html.indexOf('>', mainContentStart) + 1;
      const mainEnd = html.indexOf('</main>', mainStart);
      if (mainEnd !== -1) {
        content = html.substring(mainStart, mainEnd);
      }
    }
    
    // Fallback to div with main-content class
    if (!content) {
      const divStart = html.indexOf('class="main-content"');
      if (divStart !== -1) {
        const contentStart = html.lastIndexOf('<', divStart);
        const contentEnd = html.indexOf('</div>', contentStart);
        if (contentEnd !== -1) {
          content = html.substring(contentStart, contentEnd);
        }
      }
    }
    
    // Clean up HTML tags and return plain text
    return content
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  } catch (error) {
    console.error('Error extracting text from HTML:', error);
    return '';
  }
}

/**
 * Extract examples from HTML (improved)
 */
function extractExamples(html: string): string[] {
  const examples: string[] = [];
  
  try {
    const codePatterns = [
      /<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi,
      /<code[^>]*class="[^"]*language-hcl[^"]*"[^>]*>([\s\S]*?)<\/code>/gi,
      /<code[^>]*class="[^"]*language-terraform[^"]*"[^>]*>([\s\S]*?)<\/code>/gi,
      /<div[^>]*class="[^"]*highlight[^"]*"[^>]*>([\s\S]*?)<\/div>/gi
    ];
    
    for (const pattern of codePatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const codeMatch = safeArrayAccess(match, 1);
        if (!codeMatch) continue;
        
        const code = codeMatch
          .replace(/<[^>]*>/g, '')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .trim();
        
        if (code && (
          code.includes('resource ') || 
          code.includes('provider ') || 
          code.includes('data ') ||
          code.includes('variable ')
        )) {
          examples.push(code);
        }
      }
    }
  } catch (error) {
    console.error('Error extracting examples from HTML:', error);
  }
  
  return [...new Set(examples)];
}

/**
 * Create a fallback schema for common resources when GitHub extraction fails
 */
function createFallbackSchema(provider: string, resource: string): ApiSchema {
  const schema: ApiSchema = {
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
      Object.assign(schema.attributes, {
        ami: {
          description: "The AMI to use for the instance",
          required: true,
          type: "string"
        },
        instance_type: {
          description: "The instance type to use",
          required: true,
          type: "string"
        },
        subnet_id: {
          description: "The VPC Subnet ID to launch in",
          required: false,
          type: "string"
        },
        vpc_security_group_ids: {
          description: "A list of security group IDs to associate with",
          required: false,
          type: "list"
        }
      });
    } else if (resource === 's3_bucket') {
      Object.assign(schema.attributes, {
        bucket: {
          description: "The name of the bucket",
          required: true,
          type: "string"
        },
        acl: {
          description: "The canned ACL to apply",
          required: false,
          type: "string"
        },
        versioning: {
          description: "A state of versioning",
          required: false,
          type: "list",
          nested: true
        }
      });
    }
  } else if (provider === 'google' || provider === 'gcp') {
    if (resource === 'compute_instance') {
      Object.assign(schema.attributes, {
        machine_type: {
          description: "The machine type to create",
          required: true,
          type: "string"
        },
        zone: {
          description: "The zone that the machine should be created in",
          required: true,
          type: "string"
        },
        boot_disk: {
          description: "The boot disk for the instance",
          required: true,
          type: "list",
          nested: true
        },
        network_interface: {
          description: "Networks to attach to the instance",
          required: true,
          type: "list",
          nested: true
        }
      });
    }
  } else if (provider === 'azurerm' || provider === 'azure') {
    Object.assign(schema.attributes, {
      location: {
        description: "The Azure Region where the resource should exist",
        required: true,
        type: "string"
      },
      resource_group_name: {
        description: "The name of the Resource Group where the resource should exist",
        required: true,
        type: "string"
      }
    });
    
    if (resource === 'virtual_machine') {
      Object.assign(schema.attributes, {
        vm_size: {
          description: "The size of the Virtual Machine",
          required: true,
          type: "string"
        },
        network_interface_ids: {
          description: "A list of Network Interface ID's which should be associated with the Virtual Machine",
          required: true,
          type: "list"
        }
      });
    }
  }
  
  return schema;
}

/**
 * Fetch provider documentation with enhanced error handling
 */
async function fetchProviderDocsWithErrorHandling(args: ProviderDocsArgs) {
  const { provider, resource, useGithub = false } = args;
  
  // Validate provider
  if (!config.isProviderSupported(provider)) {
    throw new ProviderNotSupportedError(
      provider,
      config.providers.supportedProviders,
      { args }
    );
  }

  try {
    const normalizedProvider = config.getNormalizedProvider(provider);
    let registryUrl = `${config.terraform.registryBaseUrl}/providers/hashicorp/${normalizedProvider}/latest/docs`;
    
    if (resource) {
      registryUrl += `/resources/${resource}`;
    }
    
    console.error(`Fetching documentation from: ${registryUrl}`);
    
    // Get Registry documentation using our enhanced HTTP client
    const response = await httpClient.get(registryUrl);
    const docs = extractText(response.body, 'main-content');
    const registryExamples = extractExamples(response.body);
    
    let result: {
      documentation: string;
      examples: string[];
      url: string;
      sources: string[];
      githubRepo?: string;
      cacheInfo?: any;
    } = {
      documentation: docs || "Documentation content could not be extracted",
      examples: registryExamples,
      url: registryUrl,
      sources: ["Terraform Registry"]
    };
    
    // If GitHub integration is enabled, fetch additional examples
    if (useGithub && resource) {
      try {
        console.error(`Fetching GitHub examples for: ${normalizedProvider}_${resource}`);
        const githubExamples = await githubService.fetchResourceExamples(normalizedProvider, resource);
        
        if (githubExamples.length > 0) {
          result.examples = [...registryExamples, ...githubExamples];
          result.sources = [...result.sources, "GitHub"];
        }
        
        // Get GitHub repository info
        const repo = await githubService.getRepoOrDiscover(normalizedProvider);
        if (repo) {
          result.githubRepo = `https://github.com/${repo.owner}/${repo.name}`;
        }
      } catch (githubError) {
        // Log GitHub errors but don't fail the entire request
        ErrorHandler.logError(githubError, {
          context: 'GitHub integration',
          provider: normalizedProvider,
          resource
        });
      }
    }
    
    // Add cache statistics if available
    result.cacheInfo = githubService.getCacheStats();
    
    return { result };
  } catch (error: any) {
    if (error instanceof GitHubApiError) {
      throw error;
    }
    
    throw new GitHubApiError(
      `Failed to fetch provider documentation: ${error.message}`,
      error.statusCode,
      undefined,
      { provider, resource, useGithub }
    );
  }
}

/**
 * Generate Terraform configuration with enhanced error handling
 */
async function generateTerraformConfigurationWithErrorHandling(args: GenerateConfigArgs) {
  const { provider, resource, attributes = {}, useGithub = true } = args;
  
  // Validate inputs
  if (!config.isProviderSupported(provider)) {
    throw new ProviderNotSupportedError(
      provider,
      config.providers.supportedProviders,
      { args }
    );
  }

  if (!resource || resource.trim().length === 0) {
    throw new ValidationError('Resource name is required', 'resource', resource);
  }

  try {
    const normalizedProvider = config.getNormalizedProvider(provider);
    console.error(`Generating Terraform configuration for ${normalizedProvider}_${resource}`);
    
    // Use the integrated schema and generation function for better configurations
    const configuration = await fetchSchemaAndGenerateConfig(normalizedProvider, resource, attributes);
    
    return {
      result: configuration,
      metadata: {
        provider: normalizedProvider,
        resource,
        useGithub,
        generatedAt: new Date().toISOString(),
        cacheStats: githubService.getCacheStats(),
        rateLimitInfo: githubService.getRateLimitInfo()
      }
    };
  } catch (error: any) {
    console.error("Error generating Terraform configuration:", error);
    
    // Try fallback generation method
    try {
      console.error("Using fallback generation method...");
      
      const schemaResponse = await fetchResourceSchemaWithErrorHandling({ 
        provider, 
        resource, 
        useGithub: false 
      });
      
      if ('error' in schemaResponse) {
        throw new ConfigGenerationError(
          `Both primary and fallback generation methods failed`,
          provider,
          resource,
          { originalError: error, fallbackError: schemaResponse.error }
        );
      }
      
      // Create basic generator schema from the API schema
      const generatorSchema: GeneratorSchema = {
        attributes: {}
      };
      
      // Convert API schema attributes to generator schema attributes
      for (const [name, attr] of Object.entries(schemaResponse.result.attributes)) {
        generatorSchema.attributes[name] = {
          description: attr.description || "",
          required: !!attr.required,
          type: attr.type || "string"
        };
      }
      
      // Add minimal nested structures for common provider/resource combinations
      if (provider === 'aws' && resource === 's3_bucket') {
        if (generatorSchema.attributes.versioning) {
          generatorSchema.attributes.versioning = {
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
      } else if ((provider === 'google' || provider === 'gcp') && resource === 'compute_instance') {
        generatorSchema.attributes.boot_disk = {
          description: "Boot disk for the instance",
          required: true,
          type: "list",
          nested: {
            initialize_params: {
              description: "Parameters for a new disk",
              required: false,
              type: "list",
              nested: {
                image: {
                  description: "The image to initialize from",
                  required: true,
                  type: "string"
                }
              }
            }
          }
        };
      }
      
      // Generate Terraform configuration using the generator schema
      const configuration = generateTerraformConfig(
        provider, 
        resource, 
        generatorSchema, 
        attributes
      );
      
      return {
        result: configuration,
        metadata: {
          provider,
          resource,
          useGithub: false,
          method: 'fallback',
          generatedAt: new Date().toISOString()
        }
      };
    } catch (fallbackError: any) {
      throw new ConfigGenerationError(
        `Failed to generate Terraform configuration: ${error.message}. Fallback also failed: ${fallbackError.message}`,
        provider,
        resource,
        { originalError: error, fallbackError }
      );
    }
  }
}

/**
 * Fetch resource schema with enhanced error handling
 */
async function fetchResourceSchemaWithErrorHandling(args: ResourceSchemaArgs) {
  const { provider, resource, useGithub = true } = args;
  
  // Validate inputs
  if (!config.isProviderSupported(provider)) {
    throw new ProviderNotSupportedError(
      provider,
      config.providers.supportedProviders,
      { args }
    );
  }

  if (!resource || resource.trim().length === 0) {
    throw new ValidationError('Resource name is required', 'resource', resource);
  }

  try {
    const normalizedProvider = config.getNormalizedProvider(provider);
    console.error(`Fetching schema for: ${normalizedProvider}_${resource}`);
    
    if (useGithub) {
      try {
        console.error("Using enhanced schema extraction...");
        
        // Use the enhanced schema fetching functionality
        const generatorSchema = await fetchEnhancedResourceSchema(normalizedProvider, resource, useGithub);
        
        // Convert the schema to our API format
        const apiSchema: ApiSchema = {
          attributes: Object.entries(generatorSchema.attributes).reduce((acc, [name, attr]) => {
            acc[name] = {
              description: attr.description,
              required: attr.required,
              type: attr.type || "string",
              nested: attr.nested ? true : undefined
            };
            
            return acc;
          }, {} as Record<string, ApiSchemaAttribute>)
        };
        
        return {
          result: apiSchema,
          metadata: {
            source: "GitHub Enhanced",
            provider: normalizedProvider,
            resource,
            cacheStats: githubService.getCacheStats(),
            rateLimitInfo: githubService.getRateLimitInfo()
          }
        };
      } catch (githubError) {
        console.error("Enhanced schema extraction failed, falling back to direct GitHub extraction:", githubError);
        
        // Try direct GitHub extraction as fallback
        try {
          const githubSchema = await githubService.fetchResourceSchemaFromGithub(normalizedProvider, resource);
          
          if (isValidSchema(githubSchema)) {
            const apiSchema: ApiSchema = {
              attributes: Object.entries(githubSchema.attributes).reduce((acc, [name, attr]) => {
                acc[name] = {
                  description: attr.description,
                  required: attr.required,
                  type: attr.type || "string",
                  nested: attr.nested ? true : undefined
                };
                
                return acc;
              }, {} as Record<string, ApiSchemaAttribute>)
            };
            
            return {
              result: apiSchema,
              metadata: {
                source: "GitHub Direct",
                provider: normalizedProvider,
                resource
              }
            };
          }
        } catch (directGithubError) {
          console.error("Direct GitHub schema extraction failed:", directGithubError);
        }
      }
    }
    
    // Fallback to simulated schema
    console.error("Using simulated schema data as fallback");
    
    const apiSchema: ApiSchema = createFallbackSchema(normalizedProvider, resource);
    
    return {
      result: apiSchema,
      metadata: {
        source: "Simulated Data",
        provider: normalizedProvider,
        resource
      }
    };
  } catch (error: any) {
    throw new SchemaParseError(
      `Failed to fetch resource schema: ${error.message}`,
      provider,
      resource,
      { originalError: error }
    );
  }
}

/**
 * Fetch GitHub repository information with error handling
 */
async function fetchGithubInfoWithErrorHandling(args: GithubInfoArgs) {
  const { provider } = args;
  
  if (!config.isProviderSupported(provider)) {
    throw new ProviderNotSupportedError(
      provider,
      config.providers.supportedProviders,
      { args }
    );
  }

  try {
    const normalizedProvider = config.getNormalizedProvider(provider);
    console.error(`Fetching GitHub info for provider: ${normalizedProvider}`);
    
    const repo = await githubService.getRepoOrDiscover(normalizedProvider);
    
    if (!repo) {
      throw new ResourceNotFoundError(
        'GitHub repository',
        `provider: ${normalizedProvider}`,
        { provider: normalizedProvider }
      );
    }
    
    return {
      result: {
        owner: repo.owner,
        name: repo.name,
        defaultBranch: repo.defaultBranch,
        url: `https://github.com/${repo.owner}/${repo.name}`,
        apiUrl: `https://api.github.com/repos/${repo.owner}/${repo.name}`,
        provider: normalizedProvider
      },
      metadata: {
        rateLimitInfo: githubService.getRateLimitInfo(),
        cacheStats: githubService.getCacheStats()
      }
    };
  } catch (error: any) {
    throw new GitHubApiError(
      `Failed to fetch GitHub repository information: ${error.message}`,
      undefined,
      undefined,
      { provider }
    );
  }
}

// Create a stdio server for MCP
function createStdioServer(server: Server) {
  const transport = new StdioServerTransport();
  
  return {
    async start() {
      await server.connect(transport);
      console.error(`[${new Date().toISOString()}] MCP Server started successfully!`);
      console.error(`[${new Date().toISOString()}] Configuration: ${JSON.stringify({
        rateLimitPerHour: config.rateLimit.requestsPerHour,
        cacheMaxSize: config.cache.maxSize,
        supportedProviders: config.providers.supportedProviders.length
      })}`);
    }
  };
}

function convertSchemaToApiFormat(schema: any): ApiSchema {
  const apiSchema: ApiSchema = {
    attributes: {}
  };

  if (schema && typeof schema === 'object' && schema.attributes) {
    for (const [name, attr] of Object.entries(schema.attributes)) {
      if (attr && typeof attr === 'object') {
        const attrObj = attr as any;
        apiSchema.attributes[name] = {
          description: attrObj.description || "",
          required: Boolean(attrObj.required),
          type: attrObj.type || "string",
          nested: attrObj.nested ? true : undefined
        } as ApiSchemaAttribute;
      }
    }
  }

  return apiSchema;
}

// Handle graceful shutdowns
process.on('SIGINT', () => {
  console.error(`[${new Date().toISOString()}] Received SIGINT, shutting down gracefully...`);
  githubService.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error(`[${new Date().toISOString()}] Received SIGTERM, shutting down gracefully...`);
  githubService.destroy();
  process.exit(0);
});

// Start the server
const stdioServer = createStdioServer(server);
stdioServer.start().catch((error: any) => {
  ErrorHandler.logError(error, { context: 'Server startup' });
  process.exit(1);
});