// src/models/index.ts
/**
 * Core data models for the application
 */

/**
 * GitHub repository information
 */
export interface GitHubRepo {
  owner: string;
  name: string;
  defaultBranch: string;
}

/**
 * Schema attribute for Terraform resource
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
 * Schema for Terraform resource
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
 * Generator schema attribute
 */
export interface GeneratorSchemaAttribute {
  description: string;
  required: boolean;
  type?: string;
  elem?: {
    type?: string;
  };
  nested?: Record<string, GeneratorSchemaAttribute>;
}

/**
 * Schema for Terraform config generation
 */
export interface GeneratorSchema {
  attributes: Record<string, GeneratorSchemaAttribute>;
}

/**
 * API schema attribute format
 */
export interface ApiSchemaAttribute {
  description: string;
  required: boolean;
  type?: string;
  nested?: boolean;
}

/**
 * API schema format
 */
export interface ApiSchema {
  attributes: Record<string, ApiSchemaAttribute>;
}

/**
 * Tool input parameters
 */
export interface ProviderDocsArgs {
  provider: string;
  resource?: string;
  useGithub?: boolean;
}

export interface GenerateConfigArgs {
  provider: string;
  resource: string;
  attributes?: Record<string, any>;
  useGithub?: boolean;
}

export interface ResourceSchemaArgs {
  provider: string;
  resource: string;
  useGithub?: boolean;
}

export interface GithubInfoArgs {
  provider: string;
}