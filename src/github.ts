/**
 * GitHub integration for Terraform providers
 */
import * as https from 'https';

/**
 * Interface for GitHub repository information
 */
export interface GitHubRepo {
  owner: string;
  name: string;
  defaultBranch: string;
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
  // Add more providers as needed
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
          const parsedData = JSON.parse(data);
          resolve(parsedData);
        } catch (error) {
          // Handle parsing error with proper type annotation
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          reject(new Error(`Failed to parse GitHub API response: ${errorMessage}`));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * HTTP request function for raw GitHub content
 */
export function githubRawGet(owner: string, repo: string, branch: string, path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'raw.githubusercontent.com',
      path: `/${owner}/${repo}/${branch}/${path}`,
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
        resolve(data);
      });
    }).on('error', (err) => {
      reject(err);
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
 * Fetch provider resource examples from GitHub repository
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
      `website/docs/resources/${resource}.html.markdown`,
      `website/docs/r/${resource}.html.markdown`
    ];
    
    for (const path of possiblePaths) {
      try {
        const content = await githubRawGet(repo.owner, repo.name, repo.defaultBranch, path);
        
        // For HTML/Markdown files, extract code blocks
        if (path.endsWith('.html.markdown') || path.endsWith('.md')) {
          return extractCodeBlocks(content);
        }
        
        // For directory examples, we've fetched the example directly
        return [content];
      } catch (e) {
        // Continue to next path if this one fails
        continue;
      }
    }
    
    return [];
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
  const codeBlockRegex = /```(?:terraform|hcl)([\s\S]*?)```/g;
  
  let match;
  while ((match = codeBlockRegex.exec(markdownContent)) !== null) {
    codeBlocks.push(match[1].trim());
  }
  
  return codeBlocks;
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
 * Fetch resource schema from GitHub repository
 */
export async function fetchResourceSchemaFromGithub(provider: string, resource: string): Promise<any> {
  try {
    const repo = await getRepoOrDiscover(provider);
    if (!repo) {
      throw new Error(`Could not find GitHub repository for provider: ${provider}`);
    }
    
    // Try different common paths for schema definitions
    const possiblePaths = [
      `internal/service/${resource}/schema.go`,
      `internal/services/${resource}/schema.go`,
      `internal/provider/resource_${resource}.go`,
      `${resource}/resource_${provider}_${resource}.go`
    ];
    
    for (const path of possiblePaths) {
      try {
        const content = await githubRawGet(repo.owner, repo.name, repo.defaultBranch, path);
        
        // Parse Go code to extract schema information
        return parseGoSchemaDefinition(content, resource);
      } catch (e) {
        // Continue to next path if this one fails
        continue;
      }
    }
    
    throw new Error(`Could not find schema definition for ${provider}_${resource} in GitHub repository`);
  } catch (error) {
    console.error(`Failed to fetch resource schema from GitHub: ${error}`);
    throw error;
  }
}

/**
 * Parse Go code to extract schema definition
 * This is a very simplified parser and would need to be much more robust in a production environment
 */
function parseGoSchemaDefinition(goCode: string, resource: string): any {
  // Very simplified schema extraction
  const schema: any = {
    attributes: {}
  };
  
  // Look for schema definition lines
  const schemaBlockRegex = /Schema:\s*map\[string\]\*schema\.Schema\{([\s\S]*?)\}/g;
  const attributeRegex = /"([^"]+)":\s*\{([\s\S]*?)(?="},|\},|"[^"]+":)/g;
  const requiredRegex = /Required:\s*true/;
  const optionalRegex = /Optional:\s*true/;
  const typeRegex = /Type:\s*schema\.([\w]+)/;
  const descriptionRegex = /Description:\s*"([^"]+)"/;
  
  let schemaMatch;
  if ((schemaMatch = schemaBlockRegex.exec(goCode)) !== null) {
    const schemaBlock = schemaMatch[1];
    
    let attributeMatch;
    while ((attributeMatch = attributeRegex.exec(schemaBlock)) !== null) {
      const attributeName = attributeMatch[1];
      const attributeDefinition = attributeMatch[2];
      
      const required = requiredRegex.test(attributeDefinition);
      const typeMatch = typeRegex.exec(attributeDefinition);
      const descriptionMatch = descriptionRegex.exec(attributeDefinition);
      
      schema.attributes[attributeName] = {
        required: required || false,
        type: typeMatch ? typeMatch[1].toLowerCase() : 'string',
        description: descriptionMatch ? descriptionMatch[1] : `${attributeName} for ${resource}`
      };
    }
  }
  
  return schema;
}