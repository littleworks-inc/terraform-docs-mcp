// src/repositories/githubRepo.ts
import { GitHubRepo } from '../models/index.js';
import { githubApi } from '../api/github.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('GitHubRepository');

/**
 * Map of known Terraform provider repositories
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
  // ... other providers
};

/**
 * Repository for interacting with GitHub
 */
export class GitHubRepository {
  /**
   * Get repository information for a provider
   */
  getProviderRepo(provider: string): GitHubRepo | null {
    return PROVIDER_REPOS[provider] || null;
  }
  
  /**
   * Discover a provider repository dynamically
   */
  async discoverProviderRepo(provider: string): Promise<GitHubRepo | null> {
    try {
      logger.info(`Discovering GitHub repository for provider: ${provider}`);
      
      // Search for the repository
      const searchRes = await githubApi.apiRequest<{
        items?: Array<{
          owner: { login: string };
          name: string;
          default_branch: string;
        }>;
      }>(`/search/repositories?q=terraform-provider-${provider}+in:name&sort=stars&order=desc`);
      
      if (searchRes.data.items && searchRes.data.items.length > 0) {
        const topRepo = searchRes.data.items[0];
        return {
          owner: topRepo.owner.login,
          name: topRepo.name,
          defaultBranch: topRepo.default_branch
        };
      }
      
      logger.warn(`No GitHub repository found for provider: ${provider}`);
      return null;
    } catch (error) {
      logger.error(`Failed to discover GitHub repository for provider: ${provider}`, error);
      return null;
    // src/repositories/githubRepo.ts (continued)
    }
  }
  
  /**
   * Get repository information from static mapping or discover dynamically
   */
  async getRepoOrDiscover(provider: string): Promise<GitHubRepo | null> {
    const staticRepo = this.getProviderRepo(provider);
    if (staticRepo) {
      return staticRepo;
    }
    
    return await this.discoverProviderRepo(provider);
  }
  
  /**
   * Get repository content (file or directory listing)
   */
  async getRepoContent(repo: GitHubRepo, path: string): Promise<any> {
    try {
      const response = await githubApi.apiRequest(
        `/repos/${repo.owner}/${repo.name}/contents/${path}?ref=${repo.defaultBranch}`
      );
      return response.data;
    } catch (error) {
      logger.error(`Failed to get repository content for path: ${path}`, error);
      throw error;
    }
  }
  
  /**
   * Fetch resource examples from GitHub repository
   */
  async fetchResourceExamples(provider: string, resource: string): Promise<string[]> {
    try {
      const repo = await this.getRepoOrDiscover(provider);
      if (!repo) {
        throw new Error(`Could not find GitHub repository for provider: ${provider}`);
      }
      
      logger.info(`Fetching examples for ${provider}_${resource} from GitHub`);
      
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
          const content = await githubApi.getRawContent(repo.owner, repo.name, repo.defaultBranch, path);
          
          // For HTML/Markdown files, extract code blocks
          if (path.endsWith('.html.markdown') || path.endsWith('.md')) {
            const extracted = this.extractCodeBlocks(content);
            if (extracted.length > 0) {
              examples.push(...extracted);
            }
          } else {
            // For directory examples, we need to list files and fetch them
            try {
              const dirContent = await this.getRepoContent(repo, path);
              
              if (Array.isArray(dirContent)) {
                // It's a directory, fetch .tf files
                for (const file of dirContent) {
                  if (file.name.endsWith('.tf')) {
                    const fileContent = await githubApi.getRawContent(repo.owner, repo.name, repo.defaultBranch, file.path);
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
      logger.error(`Failed to fetch resource examples from GitHub`, error);
      return [];
    }
  }
  
  /**
   * Extract Terraform code blocks from markdown content
   */
  private extractCodeBlocks(markdownContent: string): string[] {
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
}

// Export a singleton instance
export const githubRepository = new GitHubRepository();