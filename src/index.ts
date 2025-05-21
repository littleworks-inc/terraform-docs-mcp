#!/usr/bin/env node
// @ts-ignore - shebang line
/// <reference lib="dom" />

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { config } from './config/index.js';
import { 
  TerraformDocsError, 
  GitHubApiError, 
  SchemaParsingError, 
  ConfigGenerationError,
  ResourceNotFoundError,
  ProviderNotFoundError
} from './errors/index.js';
import { 
  ProviderDocsArgs, 
  GenerateConfigArgs, 
  ResourceSchemaArgs, 
  GithubInfoArgs 
} from './models/index.js';
import { 
  fetchProviderDocs, 
  generateTerraformConfiguration, 
  fetchResourceSchema, 
  fetchGithubInfo 
} from './tools/index.js';
import { Logger } from './utils/logger.js';
import { cacheService } from './services/index.js';

const logger = new Logger('Main');

// Log startup information
logger.info(`Starting terraform-docs-mcp with configuration:`);
logger.info(`- GitHub Auth: ${config.github.useAuth ? 'Enabled' : 'Disabled'}`);
logger.info(`- Rate Limit: ${config.github.requestsPerMinute} requests per minute`);
logger.info(`- Caching: ${config.cache.enabled ? 'Enabled' : 'Disabled'}`);
logger.info(`- Log Level: ${config.logging.level}`);

if (!config.github.useAuth) {
  logger.warn("GitHub token not configured. API rate limits will be restricted.");
  logger.warn("To configure a token, set the GITHUB_TOKEN environment variable.");
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
  logger.info("Listing available Terraform tools");
  
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
  logger.info(`Executing tool: ${request.params.name}`);
  
  try {
    let response;
    
    if (request.params.name === "terraform_provider_docs") {
      response = await fetchProviderDocs(request.params.arguments as ProviderDocsArgs);
    }
    else if (request.params.name === "terraform_generate_config") {
      response = await generateTerraformConfiguration(request.params.arguments as GenerateConfigArgs);
    }
    else if (request.params.name === "terraform_resource_schema") {
      response = await fetchResourceSchema(request.params.arguments as ResourceSchemaArgs);
    }
    else if (request.params.name === "terraform_github_info") {
      response = await fetchGithubInfo(request.params.arguments as GithubInfoArgs);
    }
    else {
      return {
        error: {
          message: `Unknown tool: ${request.params.name}`,
          type: 'UnknownToolError'
        }
      };
    }
    
    logger.debug(`Tool response: ${JSON.stringify(response)}`);
    return response;
  } catch (error) {
    logger.error("Error executing tool", error);
    
    // Format error response based on error type
    if (error instanceof TerraformDocsError) {
      // Create a details object with proper type checking
      const details: Record<string, unknown> = {};
      
      // Only add properties that actually exist
      if (error instanceof GitHubApiError) {
        if (error.path !== undefined) details.path = error.path;
        if (error.statusCode !== undefined) details.statusCode = error.statusCode;
      }
      
      if (error instanceof SchemaParsingError || error instanceof ConfigGenerationError) {
        if ((error as SchemaParsingError).provider !== undefined) {
          details.provider = (error as SchemaParsingError).provider;
        }
        if ((error as SchemaParsingError).resource !== undefined) {
          details.resource = (error as SchemaParsingError).resource;
        }
      }
      
      if (error instanceof ResourceNotFoundError || error instanceof ProviderNotFoundError) {
        details.provider = error.provider;
        if ((error as ResourceNotFoundError).resource !== undefined) {
          details.resource = (error as ResourceNotFoundError).resource;
        }
      }
      
      return {
        error: {
          message: error.message,
          type: error.name,
          details: Object.keys(details).length > 0 ? details : undefined
        }
      };
    }
    
    // Generic error handling
    return {
      error: {
        message: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        type: 'UnexpectedError'
      }
    };
  }
});

// Create a stdio server for MCP
function createStdioServer(server: Server) {
  const transport = new StdioServerTransport();
  
  return {
    async start() {
      await server.connect(transport);
      logger.info("MCP Server started successfully!");
    }
  };
}

const stdioServer = createStdioServer(server);
stdioServer.start().catch((error: any) => {
  logger.error("Error starting server", error);
  process.exit(1);
});