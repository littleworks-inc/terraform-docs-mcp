// src/tools/githubInfo.ts
import { githubService } from '../services/githubService.js';
import { Logger } from '../utils/logger.js';
import { GithubInfoArgs } from '../models/index.js';
import { ProviderNotFoundError } from '../errors/index.js';

const logger = new Logger('GithubInfo');

/**
 * Fetch GitHub repository information for a provider
 */
export async function fetchGithubInfo(args: GithubInfoArgs) {
  const { provider } = args;
  
  try {
    logger.info(`Fetching GitHub info for provider: ${provider}`);
    
    const repo = await githubService.getRepoInfo(provider);
    
    if (!repo) {
      throw new ProviderNotFoundError(provider);
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
  } catch (error) {
    logger.error(`Error fetching GitHub info`, error);
    
    if (error instanceof ProviderNotFoundError) {
      throw error;
    }
    
    throw new ProviderNotFoundError(provider);
  }
}