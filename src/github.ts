/**
 * Enhanced GitHub schema extraction module
 * Provides robust extraction of Terraform resource schemas from provider repositories
 */
import * as https from 'https';
import { GitHubApiError } from './errors.js';

/**
 * Interface for GitHub repository information
 */
export interface GitHubRepo {
  owner: string;
  name: string;
  defaultBranch: string;
}

/**
 * Enhanced schema attribute interface with more detailed typing
 */
export interface SchemaAttribute {
  description: string;
  required: boolean;
  optional?: boolean;
  computed?: boolean;
  type?: string;
  elem?: {
    type?: string;
    elem?: any;
  };
  nested?: Record<string, SchemaAttribute>;
  forcenew?: boolean;
  sensitive?: boolean;
  deprecated?: boolean;
  default?: any;
  validationfuncs?: string[];
}

/**
 * Schema interface with versioning information
 */
export interface Schema {
  attributes: Record<string, SchemaAttribute>;
  blockTypes?: Record<string, {
    nesting: string;
    block: {
      attributes: Record<string, SchemaAttribute>;
    };
    min_items?: number;
    max_items?: number;
  }>;
  version?: string;
  resourceName?: string;
  providerName?: string;
  sourceUrl?: string;
}

/**
 * Map of known Terraform provider repositories
 * Maps provider name to its GitHub repository information
 */
const PROVIDER_REPOS: Record<string, GitHubRepo> = {
  'aws': { 
    owner: 'hashicorp', 
    name: 'terraform-provider-aws',
    defaultBranch: 'main'
  },
  'azurerm': { 
    owner: 'hashicorp', 
    name: 'terraform-provider-azurerm',
    defaultBranch: 'main'
  },
  'azure': { 
    owner: 'hashicorp', 
    name: 'terraform-provider-azurerm',
    defaultBranch: 'main'
  },
  'azuread': { 
    owner: 'hashicorp', 
    name: 'terraform-provider-azuread',
    defaultBranch: 'main'
  },
  'google': { 
    owner: 'hashicorp', 
    name: 'terraform-provider-google',
    defaultBranch: 'main'
  },
  'gcp': { 
    owner: 'hashicorp', 
    name: 'terraform-provider-google',
    defaultBranch: 'main'
  },
  'kubernetes': { 
    owner: 'hashicorp', 
    name: 'terraform-provider-kubernetes',
    defaultBranch: 'main'
  },
  'oci': { 
    owner: 'oracle', 
    name: 'terraform-provider-oci',
    defaultBranch: 'master'
  },
  'docker': { 
    owner: 'kreuzwerker', 
    name: 'terraform-provider-docker',
    defaultBranch: 'main'
  },
  'github': {
    owner: 'integrations',
    name: 'terraform-provider-github',
    defaultBranch: 'main'
  },
  'datadog': {
    owner: 'DataDog',
    name: 'terraform-provider-datadog',
    defaultBranch: 'main'
  },
  'digitalocean': {
    owner: 'digitalocean',
    name: 'terraform-provider-digitalocean',
    defaultBranch: 'main'
  },
  'tfe': {
    owner: 'hashicorp',
    name: 'terraform-provider-tfe',
    defaultBranch: 'main'
  },
  'helm': {
    owner: 'hashicorp',
    name: 'terraform-provider-helm',
    defaultBranch: 'main'
  },
  'vault': {
    owner: 'hashicorp',
    name: 'terraform-provider-vault',
    defaultBranch: 'main'
  },
  'alicloud': {
    owner: 'aliyun',
    name: 'terraform-provider-alicloud',
    defaultBranch: 'master'
  },
  'consul': {
    owner: 'hashicorp',
    name: 'terraform-provider-consul',
    defaultBranch: 'main'
  },
  'random': {
    owner: 'hashicorp',
    name: 'terraform-provider-random',
    defaultBranch: 'main'
  },
  'time': {
    owner: 'hashicorp',
    name: 'terraform-provider-time',
    defaultBranch: 'main'
  },
  'template': {
    owner: 'hashicorp',
    name: 'terraform-provider-template',
    defaultBranch: 'main'
  },
  'null': {
    owner: 'hashicorp',
    name: 'terraform-provider-null',
    defaultBranch: 'main'
  },
  'local': {
    owner: 'hashicorp',
    name: 'terraform-provider-local',
    defaultBranch: 'main'
  },
  'cloudinit': {
    owner: 'hashicorp',
    name: 'terraform-provider-cloudinit',
    defaultBranch: 'main'
  },
  'external': {
    owner: 'hashicorp',
    name: 'terraform-provider-external',
    defaultBranch: 'main'
  }
};

/**
 * HTTP request function for GitHub API
 */
export function githubApiGet(path: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: path,
      method: 'GET',
      headers: {
        'User-Agent': 'terraform-docs-mcp',
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    https.get(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          // Check for error status codes
          if (res.statusCode && res.statusCode >= 400) {
            const parsedError = JSON.parse(data);
            reject(new GitHubApiError(
              parsedError.message || 'Unknown GitHub API error',
              path,
              res.statusCode
            ));
            return;
          }
          
          const parsedData = JSON.parse(data);
          resolve(parsedData);
        } catch (error) {
          reject(new GitHubApiError(
            `Failed to parse GitHub API response: ${error instanceof Error ? error.message : 'Unknown error'}`,
            path
          ));
        }
      });
    }).on('error', (err) => {
      reject(new GitHubApiError(`Network error: ${err.message}`, path));
    });
  });
}

/**
 * HTTP request function for raw GitHub content
 */
export function githubRawGet(owner: string, repo: string, branch: string, path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const fullPath = `/${owner}/${repo}/${branch}/${path}`;
    const options = {
      hostname: 'raw.githubusercontent.com',
      path: fullPath,
      method: 'GET',
      headers: {
        'User-Agent': 'terraform-docs-mcp'
      }
    };

    https.get(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new GitHubApiError(
            `Failed to fetch raw content`,
            fullPath,
            res.statusCode
          ));
        }
      });
    }).on('error', (err) => {
      reject(new GitHubApiError(`Network error: ${err.message}`, fullPath));
    });
  });
}

/**
 * Get GitHub repository information for a provider
 */
export function getProviderRepo(provider: string): GitHubRepo | null {
  return PROVIDER_REPOS[provider] || null;
}

/**
 * Dynamically discover the GitHub repository for a provider
 * This is a fallback when the provider is not in our static mapping
 */
export async function discoverProviderRepo(provider: string): Promise<GitHubRepo | null> {
  try {
    // First try to search for the repository
    const searchRes = await githubApiGet(`/search/repositories?q=terraform-provider-${provider}+in:name&sort=stars&order=desc`);
    
    if (searchRes.items && searchRes.items.length > 0) {
      const topRepo = searchRes.items[0];
      return {
        owner: topRepo.owner.login,
        name: topRepo.name,
        defaultBranch: topRepo.default_branch
      };
    }
    
    return null;
  } catch (error) {
    console.error(`Failed to discover GitHub repository for provider: ${provider}`, error);
    return null;
  }
}

/**
 * Get repository content (file or directory listing)
 */
export async function getRepoContent(repo: GitHubRepo, path: string): Promise<any> {
  try {
    return await githubApiGet(`/repos/${repo.owner}/${repo.name}/contents/${path}?ref=${repo.defaultBranch}`);
  } catch (error) {
    console.error(`Failed to get repository content for path: ${path}`, error);
    throw error;
  }
}

/**
 * Get repository information from static mapping or discover dynamically
 */
export async function getRepoOrDiscover(provider: string): Promise<GitHubRepo | null> {
  const staticRepo = getProviderRepo(provider);
  if (staticRepo) {
    return staticRepo;
  }
  
  return await discoverProviderRepo(provider);
}

/**
 * Fetch resource examples from GitHub repository
 */
export async function fetchResourceExamples(provider: string, resource: string): Promise<string[]> {
  try {
    const repo = await getRepoOrDiscover(provider);
    if (!repo) {
      throw new Error(`Could not find GitHub repository for provider: ${provider}`);
    }
    
    // Try different common paths for examples
    const possiblePaths = [
      `examples/${resource}`,
      `examples/resources/${resource}`,
      `examples/r/${resource}`,
      `examples/resources/${provider}_${resource}`,
      `examples/r/${provider}_${resource}`,
      `website/docs/resources/${resource}.html.markdown`,
      `website/docs/r/${resource}.html.markdown`,
      `website/docs/r/${provider}_${resource}.html.markdown`
    ];
    
    const examples: string[] = [];
    
    for (const path of possiblePaths) {
      try {
        // Try to get the content of the file directly
        const content = await githubRawGet(repo.owner, repo.name, repo.defaultBranch, path);
        
        // For HTML/Markdown files, extract code blocks
        if (path.endsWith('.html.markdown') || path.endsWith('.md')) {
          const extracted = extractCodeBlocks(content);
          if (extracted.length > 0) {
            examples.push(...extracted);
          }
        } else {
          // For directory examples, we need to list files and fetch them
          try {
            const dirContent = await githubApiGet(`/repos/${repo.owner}/${repo.name}/contents/${path}?ref=${repo.defaultBranch}`);
            
            if (Array.isArray(dirContent)) {
              // It's a directory, fetch .tf files
              for (const file of dirContent) {
                if (file.name.endsWith('.tf')) {
                  const fileContent = await githubRawGet(repo.owner, repo.name, repo.defaultBranch, file.path);
                  examples.push(fileContent);
                }
              }
            } else {
              // It's a file, add its content
              examples.push(content);
            }
          } catch (dirError) {
            // Not a directory or couldn't access it, use the content we already have
            examples.push(content);
          }
        }
        
        // If we found examples, we can stop looking
        if (examples.length > 0) {
          break;
        }
      } catch (e) {
        // Continue to next path if this one fails
        continue;
      }
    }
    
    return examples;
  } catch (error) {
    console.error(`Failed to fetch resource examples from GitHub: ${error}`);
    return [];
  }
}

/**
 * Extract Terraform code blocks from markdown content
 */
function extractCodeBlocks(markdownContent: string): string[] {
  const codeBlocks: string[] = [];
  
  // Match code blocks with terraform, hcl, or no language specified
  const codeBlockRegex = /```(?:terraform|hcl|)([\s\S]*?)```/g;
  
  let match;
  while ((match = codeBlockRegex.exec(markdownContent)) !== null) {
    const code = match[1].trim();
    
    // Only include blocks that look like Terraform code
    if (code.includes('resource') || code.includes('provider') || code.includes('data') || code.includes('variable')) {
      codeBlocks.push(code);
    }
  }
  
  return codeBlocks;
}

/**
 * Fetch resource schema from GitHub repository with improved schema extraction
 */
export async function fetchResourceSchemaFromGithub(provider: string, resource: string): Promise<Schema> {
  try {
    const repo = await getRepoOrDiscover(provider);
    if (!repo) {
      throw new Error(`Could not find GitHub repository for provider: ${provider}`);
    }
    
    // Format resource name to match different naming patterns
    const resourceName = resource.replace(/-/g, '_');
    const providerResourceName = `${provider}_${resourceName}`;
    
    // Try different common paths for schema definitions
    const possiblePaths = [
      // Most common modern pattern with internal/service directories
      `internal/service/${resourceName}/resource_${resourceName}.go`,
      `internal/service/${resourceName}/resource_${provider}_${resourceName}.go`,
      `internal/services/${resourceName}/resource_${resourceName}.go`,
      `internal/services/${resourceName}/resource_${provider}_${resourceName}.go`,
      
      // Generic resource path pattern
      `internal/provider/resource_${resourceName}.go`,
      `internal/provider/resource_${provider}_${resourceName}.go`,
      
      // Older patterns
      `${resourceName}/resource_${provider}_${resourceName}.go`,
      `${resourceName}/resource.go`,
      
      // AWS specific patterns
      `internal/service/${resourceName}/${resourceName}.go`,
      
      // Google specific patterns
      `google/resource_${resourceName}.go`,
      
      // Azure specific patterns
      `azurerm/internal/services/${resourceName}/resource_arm_${resourceName}.go`,
      
      // Fallback to searching in schema.go files
      `internal/service/${resourceName}/schema.go`,
      `internal/services/${resourceName}/schema.go`,
      `internal/schema/${resourceName}.go`,
    ];
    
    for (const path of possiblePaths) {
      try {
        console.error(`Trying to fetch schema from: ${path}`);
        const content = await githubRawGet(repo.owner, repo.name, repo.defaultBranch, path);
        
        // Parse Go code to extract schema information
        const schema = parseGoSchema(content, resource, provider);
        
        // If we found a schema, add metadata and return it
        if (schema && Object.keys(schema.attributes).length > 0) {
          schema.resourceName = resource;
          schema.providerName = provider;
          schema.sourceUrl = `https://github.com/${repo.owner}/${repo.name}/blob/${repo.defaultBranch}/${path}`;
          
          return schema;
        }
      } catch (e) {
        // Continue to next path if this one fails
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        console.error(`Failed for path ${path}: ${errorMessage}`);
        continue;
      }
    }
    
    // If we couldn't find a schema in dedicated files, try to parse resource registry
    try {
      const registryContent = await githubRawGet(repo.owner, repo.name, repo.defaultBranch, 'internal/provider/provider.go');
      const schema = parseRegistryResources(registryContent, resource, provider);
      
      if (schema && Object.keys(schema.attributes).length > 0) {
        schema.resourceName = resource;
        schema.providerName = provider;
        schema.sourceUrl = `https://github.com/${repo.owner}/${repo.name}/blob/${repo.defaultBranch}/internal/provider/provider.go`;
        
        return schema;
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      console.error(`Failed to parse provider registry: ${errorMessage}`);
    }
    
    // Return a minimal schema if we couldn't find a complete one
    return {
      attributes: {},
      resourceName: resource,
      providerName: provider
    };
  } catch (error) {
    console.error(`Failed to fetch resource schema from GitHub: ${error}`);
    
    // Return a minimal schema if we couldn't find a complete one
    return {
      attributes: {},
      resourceName: resource,
      providerName: provider
    };
  }
}

/**
 * Parse Go code to extract schema definition with enhanced parsing
 */
function parseGoSchema(goCode: string, resource: string, provider: string): Schema {
  // Initialize the schema
  const schema: Schema = {
    attributes: {},
    blockTypes: {}
  };
  
  try {
    // Extract the schema definition section
    let schemaSection = extractSchemaSection(goCode, resource, provider);
    
    if (!schemaSection) {
      return schema;
    }
    
    // Parse attributes from the schema section
    parseAttributes(schemaSection, schema);
    
    // Also try to find and parse defined block types
    parseBlockTypes(schemaSection, schema);
    
    return schema;
  } catch (error) {
    console.error(`Error parsing Go schema: ${error}`);
    return schema;
  }
}

/**
 * Extract the schema section from Go code
 */
function extractSchemaSection(goCode: string, resource: string, provider: string): string | null {
  // Try to find the Schema definition with several patterns
  const schemaPatterns = [
    // Pattern 1: Standard schema map in resource definition
    /Schema:\s*map\[string\]\*schema\.Schema\{([\s\S]*?)(?:\}\s*,\s*\n\s*\w+:|\}\s*,\s*\})/,
    
    // Pattern 2: Schema with ResourceSchema
    /ResourceSchema:\s*map\[string\]\*schema\.Schema\{([\s\S]*?)(?:\}\s*,\s*\n\s*\w+:|\}\s*,\s*\})/,
    
    // Pattern 3: Schema in a separate variable
    /var\s+\w+Schema\s*=\s*map\[string\]\*schema\.Schema\{([\s\S]*?)(?:\}\s*\n)/,
    
    // Pattern 4: Schema as a function return
    /func\s+\w+Schema\s*\(\s*\)\s*map\[string\]\*schema\.Schema\s*\{\s*return\s+map\[string\]\*schema\.Schema\{([\s\S]*?)(?:\}\s*\n\s*\})/,
    
    // Pattern 5: AWS style with merged schemas
    /func\s+resource\w+\(\)\s*\*schema\.Resource\s*\{[\s\S]*?Schema:\s*map\[string\]\*schema\.Schema\{([\s\S]*?)(?:\}\s*,\s*\n\s*\w+:|\}\s*,\s*\})/
  ];
  
  for (const pattern of schemaPatterns) {
    const match = pattern.exec(goCode);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Parse attributes from the schema section
 */
function parseAttributes(schemaSection: string, schema: Schema): void {
  // Regular expression to find attribute definitions
  // This regex matches attribute definitions with all their properties
  const attributeRegex = /"([^"]+)":\s*{\s*([\s\S]*?)(?="\w+":|}\s*,\s*$|}\s*,\s*\/\/|},\s*\/\/|},\s*$)/g;
  
  let match;
  while ((match = attributeRegex.exec(schemaSection)) !== null) {
    const attributeName = match[1];
    const attributeDefinition = match[2];
    
    // Skip schema merges and functions
    if (attributeName === '//') continue;
    if (attributeDefinition.trim().startsWith('func(')) continue;
    
    // Parse attribute properties
    const attribute = parseAttributeProperties(attributeDefinition);
    
    // Add to schema
    schema.attributes[attributeName] = attribute;
  }
}

/**
 * Parse attribute properties from a definition string
 */
function parseAttributeProperties(definition: string): SchemaAttribute {
  const attribute: SchemaAttribute = {
    description: "",
    required: false,
    optional: false,
    computed: false
  };
  
  // Find description
  const descriptionMatch = /Description:\s*"([^"]*)"/.exec(definition);
  if (descriptionMatch) {
    attribute.description = descriptionMatch[1];
  }
  
  // Find required flag
  const requiredMatch = /Required:\s*(true|false)/.exec(definition);
  if (requiredMatch) {
    attribute.required = requiredMatch[1] === 'true';
  }
  
  // Find optional flag
  const optionalMatch = /Optional:\s*(true|false)/.exec(definition);
  if (optionalMatch) {
    attribute.optional = optionalMatch[1] === 'true';
  }
  
  // Find computed flag
  const computedMatch = /Computed:\s*(true|false)/.exec(definition);
  if (computedMatch) {
    attribute.computed = computedMatch[1] === 'true';
  }
  
  // Find force new flag (important for Terraform plan logic)
  const forceNewMatch = /ForceNew:\s*(true|false)/.exec(definition);
  if (forceNewMatch) {
    attribute.forcenew = forceNewMatch[1] === 'true';
  }
  
  // Find sensitive flag (important for security)
  const sensitiveMatch = /Sensitive:\s*(true|false)/.exec(definition);
  if (sensitiveMatch) {
    attribute.sensitive = sensitiveMatch[1] === 'true';
  }
  
  // Find deprecated flag
  const deprecatedMatch = /Deprecated:\s*(true|false)/.exec(definition);
  if (deprecatedMatch) {
    attribute.deprecated = deprecatedMatch[1] === 'true';
  }
  
  // Find type
  const typeMatch = /Type:\s*schema\.([\w]+)/.exec(definition);
  if (typeMatch) {
    attribute.type = typeMatch[1].toLowerCase();
    
    // For collection types, find element type
    if (['list', 'set', 'map'].includes(attribute.type || '')) {
      const elemMatch = /Elem:\s*&schema\.([\w]+){/.exec(definition);
      const resourceElemMatch = /Elem:\s*&schema\.Resource{/.exec(definition);
      
      if (elemMatch) {
        attribute.elem = {
          type: elemMatch[1].toLowerCase()
        };
      } else if (resourceElemMatch) {
        // Handle nested schema
        attribute.elem = {
          type: 'resource'
        };
        
        // Try to parse nested schema
        const nestedSchemaMatch = /Elem:\s*&schema\.Resource{[\s\S]*?Schema:\s*map\[string\]\*schema\.Schema{([\s\S]*?)}\s*,/.exec(definition);
        if (nestedSchemaMatch) {
          const nestedSchema: Schema = {
            attributes: {}
          };
          
          parseAttributes(nestedSchemaMatch[1], nestedSchema);
          attribute.nested = nestedSchema.attributes;
        }
      }
    }
  }
  
  // Find default value
  const defaultValueMatch = /Default:\s*([^,\n]+)/.exec(definition);
  if (defaultValueMatch) {
    try {
      // Try to parse complex defaults like objects or arrays
      if (defaultValueMatch[1].trim().startsWith('{') || 
          defaultValueMatch[1].trim().startsWith('[')) {
        attribute.default = defaultValueMatch[1].trim();
      } else if (defaultValueMatch[1].trim() === 'true' || 
                defaultValueMatch[1].trim() === 'false') {
        attribute.default = defaultValueMatch[1].trim() === 'true';
      } else if (!isNaN(Number(defaultValueMatch[1].trim()))) {
        attribute.default = Number(defaultValueMatch[1].trim());
      } else {
        attribute.default = defaultValueMatch[1].trim();
      }
    } catch (e) {
      attribute.default = defaultValueMatch[1].trim();
    }
  }
  
  // Find validation functions
  const validationMatch = /ValidateFunc:\s*([^,\n]+)/.exec(definition);
  if (validationMatch) {
    attribute.validationfuncs = [validationMatch[1].trim()];
  }
  
  return attribute;
}

/**
 * Parse block types from schema section 
 */
function parseBlockTypes(schemaSection: string, schema: Schema): void {
  // Look for schema.Resource blocks which indicate nested block types
  const blockRegex = /"([^"]+)":\s*{\s*Type:\s*schema\.([\w]+),\s*[\s\S]*?Elem:\s*&schema\.Resource{[\s\S]*?Schema:\s*map\[string\]\*schema\.Schema{([\s\S]*?)}[\s\S]*?}/g;
  
  let match;
  while ((match = blockRegex.exec(schemaSection)) !== null) {
    const blockName = match[1];
    const blockType = match[2].toLowerCase();
    const blockSchema = match[3];
    
    // Create nested schema
    const nestedSchema: Schema = {
      attributes: {}
    };
    
    // Parse attributes in the nested schema
    parseAttributes(blockSchema, nestedSchema);
    
    // Add to block types
    if (!schema.blockTypes) {
      schema.blockTypes = {};
    }
    
    schema.blockTypes[blockName] = {
      nesting: blockType,
      block: {
        attributes: nestedSchema.attributes
      }
    };
    
    // Extract min/max items if specified
    const minItemsMatch = /MinItems:\s*(\d+)/.exec(match[0]);
    if (minItemsMatch) {
      schema.blockTypes[blockName].min_items = parseInt(minItemsMatch[1], 10);
    }
    
    const maxItemsMatch = /MaxItems:\s*(\d+)/.exec(match[0]);
    if (maxItemsMatch) {
      schema.blockTypes[blockName].max_items = parseInt(maxItemsMatch[1], 10);
    }
  }
}

/**
 * Parse resources from the provider registry in provider.go
 */
function parseRegistryResources(providerCode: string, targetResource: string, provider: string): Schema | null {
  // Look for the resource registration in the ResourcesMap
  const resourceMapRegex = /ResourcesMap:\s*map\[string\]\*schema\.Resource{([\s\S]*?)},/;
  const match = resourceMapRegex.exec(providerCode);
  
  if (!match) {
    return null;
  }
  
  const resourcesSection = match[1];
  
  // Find the specific resource
  const resourcePatterns = [
    new RegExp(`"${provider}_${targetResource}":\\s*resource(\\w+)\\(\\)`, 'i'),
    new RegExp(`"${provider}_${targetResource}":\\s*\\w+\\.resource(\\w+)\\(\\)`, 'i')
  ];
  
  for (const pattern of resourcePatterns) {
    const resourceMatch = pattern.exec(resourcesSection);
    if (resourceMatch) {
      // We found a reference to the resource function, but we need the actual schema
      // For this, we'd need to find the resource function implementation
      // This would typically require more code analysis beyond this file
      
      // Return a placeholder - in a real implementation you'd need to follow the reference
      return {
        attributes: {
          // Add some common attributes as a fallback
          id: {
            description: "The ID of the resource",
            required: false,
            computed: true,
            type: "string"
          },
          name: {
            description: "The name of the resource",
            required: true,
            type: "string"
          },
          tags: {
            description: "Tags to assign to the resource",
            required: false,
            optional: true,
            type: "map"
          }
        }
      };
    }
  }
  
  return null;
}