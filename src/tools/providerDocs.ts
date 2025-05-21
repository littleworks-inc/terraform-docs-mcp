// src/tools/providerDocs.ts
import { githubService } from '../services/githubService.js';
import { httpGet } from '../utils/http.js';
import { Logger } from '../utils/logger.js';
import { ProviderDocsArgs } from '../models/index.js';
import { ResourceNotFoundError, ProviderNotFoundError } from '../errors/index.js';

const logger = new Logger('ProviderDocs');

/**
 * Extract text from HTML
 */
function extractText(html: string, selector: string): string {
  // A very simple implementation - in a real scenario, you'd use a proper HTML parser
  const mainContentStart = html.indexOf('main-content');
  if (mainContentStart === -1) return '';
  
  const startIdx = html.indexOf('>', mainContentStart) + 1;
  const endIdx = html.indexOf('</div>', startIdx);
  
  return html.substring(startIdx, endIdx).trim();
}

/**
 * Extract examples from HTML
 */
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
 * Fetch Terraform provider documentation
 */
export async function fetchProviderDocs(args: ProviderDocsArgs) {
  const { provider, resource, useGithub = false } = args;
  
  try {
    // Validate provider
    if (!provider || provider.trim() === '') {
      throw new ProviderNotFoundError('Provider name cannot be empty');
    }
    
    let registryUrl = `https://registry.terraform.io/providers/hashicorp/${provider}/latest/docs`;
    
    if (resource) {
      registryUrl += `/resources/${resource}`;
    }
    
    logger.info(`Fetching documentation from: ${registryUrl}`);
    
    try {
      // Get Registry documentation
      const html = await httpGet(registryUrl);
      const docs = extractText(html, 'main-content');
      const registryExamples = extractExamples(html);
      
      if (!docs || docs.trim() === '') {
        throw new ResourceNotFoundError(provider, resource || 'provider documentation');
      }
      
      let result: {
        documentation: string;
        examples: string[];
        url: string;
        sources: string[];
        githubRepo?: string;
      } = {
        documentation: docs,
        examples: registryExamples,
        url: registryUrl,
        sources: ["Terraform Registry"]
      };
      
      // If GitHub integration is enabled, fetch additional examples
      if (useGithub && resource) {
        try {
          logger.info(`Fetching GitHub examples for: ${provider}_${resource}`);
          const githubExamples = await githubService.fetchResourceExamples(provider, resource);
          
          if (githubExamples.length > 0) {
            result.examples = [...registryExamples, ...githubExamples];
            result.sources = [...result.sources, "GitHub"];
          }
          
          // Get GitHub repository info
          const repo = await githubService.getRepoInfo(provider);
          if (repo) {
            result.githubRepo = `https://github.com/${repo.owner}/${repo.name}`;
          }
        } catch (githubError) {
          // Log but don't fail - GitHub integration is optional
          logger.error(`GitHub integration failed`, githubError);
        }
      }
      
      return { result };
    } catch (error) {
      if (error instanceof ResourceNotFoundError) {
        throw error;
      }
      
      logger.error(`Failed to fetch documentation`, error);
      throw error;
    }
  } catch (error) {
    logger.error(`Error in fetchProviderDocs`, error);
    throw error;
  }
}