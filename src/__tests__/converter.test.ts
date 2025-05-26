/**
 * Unit tests for the Terraform converter functionality
 */

// Import Jest functions
import { describe, test, expect } from '@jest/globals';

// Import the functions to test
import { 
  convertStateToModule, 
  extractFromState, 
  extractFromHcl, 
  ConversionConfig 
} from '../converter.js';

// Sample state content for testing
const sampleStateContent = `{
  "version": 4,
  "terraform_version": "1.0.0",
  "serial": 1,
  "lineage": "example-lineage",
  "outputs": {},
  "resources": [
    {
      "mode": "managed",
      "type": "aws_s3_bucket",
      "name": "example",
      "provider": "provider[\"registry.terraform.io/hashicorp/aws\"]",
      "instances": [
        {
          "schema_version": 0,
          "attributes": {
            "id": "example-bucket",
            "bucket": "example-bucket",
            "acl": "private",
            "tags": {
              "Environment": "Dev",
              "Name": "Example bucket"
            },
            "versioning": [
              {
                "enabled": true,
                "mfa_delete": false
              }
            ]
          },
          "sensitive_attributes": [
            "acl"
          ]
        }
      ]
    }
  ]
}`;

// Sample HCL content for testing
const sampleHclContent = `
provider "aws" {
  region = "us-west-2"
}

resource "aws_s3_bucket" "example" {
  bucket = "example-bucket"
  acl    = "private"
  
  tags = {
    Name        = "Example bucket"
    Environment = "Dev"
  }
  
  versioning {
    enabled    = true
    mfa_delete = false
  }
}
`;

describe('State Extraction', () => {
  test('extracts resources from state content', () => {
    const result = extractFromState(sampleStateContent, {});
    
    expect(result.resources).toHaveLength(1);
    expect(result.resources[0].type).toBe('aws_s3_bucket');
    expect(result.resources[0].name).toBe('example');
    
    // Check attributes were extracted correctly
    const attributes = result.resources[0].instances[0].attributes;
    expect(attributes.bucket).toBe('example-bucket');
    expect(attributes.tags.Environment).toBe('Dev');
  });

  test('redacts sensitive values', () => {
    const result = extractFromState(sampleStateContent, { redactSensitiveValues: true });
    
    const attributes = result.resources[0].instances[0].attributes;
    expect(attributes.acl).toBe('***SENSITIVE***');
  });
  
  test('excludes specified attributes', () => {
    const result = extractFromState(sampleStateContent, { 
      excludeAttributes: ['bucket', 'tags'] 
    });
    
    const attributes = result.resources[0].instances[0].attributes;
    expect(attributes.bucket).toBeUndefined();
    expect(attributes.tags).toBeUndefined();
    expect(attributes.acl).toBe('private');
  });
});

describe('HCL Extraction', () => {
  test('extracts resources from HCL content', () => {
    const result = extractFromHcl(sampleHclContent, {});
    
    expect(result.resources.length).toBeGreaterThan(0);
    
    const s3Bucket = result.resources.find(r => 
      r.type === 'aws_s3_bucket' && r.name === 'example'
    );
    
    expect(s3Bucket).toBeDefined();
    if (s3Bucket) {
      expect(s3Bucket.instances[0].attributes.bucket).toBe('example-bucket');
    }
  });
  
  test('extracts provider information', () => {
    const result = extractFromHcl(sampleHclContent, { extractProviders: true });
    
    expect(result.providers.length).toBeGreaterThan(0);
    
    const awsProvider = result.providers.find(p => p.name === 'aws');
    expect(awsProvider).toBeDefined();
  });
});

describe('Module Conversion', () => {
  test('converts state to module files', () => {
    // First extract from state
    const extracted = extractFromState(sampleStateContent, {});
    
    // Then create a conversion config
    const conversionConfig: ConversionConfig = {
      moduleName: 's3_bucket',
      description: 'A Terraform module for creating S3 buckets',
      resources: extracted.resources,
      parameterizeCommonAttributes: true
    };
    
    // Convert to module
    const moduleFiles = convertStateToModule(conversionConfig);
    
    // Verify required files are generated
    expect(moduleFiles['main.tf']).toBeDefined();
    expect(moduleFiles['variables.tf']).toBeDefined();
    expect(moduleFiles['outputs.tf']).toBeDefined();
    expect(moduleFiles['versions.tf']).toBeDefined();
    expect(moduleFiles['README.md']).toBeDefined();
    
    // Check content of files
    expect(moduleFiles['main.tf']).toContain('resource "aws_s3_bucket"');
    expect(moduleFiles['variables.tf']).toContain('variable "bucket"');
    expect(moduleFiles['outputs.tf']).toContain('output "s3_bucket_id"');
    expect(moduleFiles['versions.tf']).toContain('required_providers');
    expect(moduleFiles['README.md']).toContain('S3 Bucket Terraform Module');
  });
  
  test('parameterizes specified attributes', () => {
    // Extract from state
    const extracted = extractFromState(sampleStateContent, {});
    
    // Create conversion config with specific parameterization
    const conversionConfig: ConversionConfig = {
      moduleName: 's3_bucket',
      description: 'A Terraform module for creating S3 buckets',
      resources: extracted.resources,
      parameterizeNames: ['example'],
      parameterizeCommonAttributes: false
    };
    
    // Convert to module
    const moduleFiles = convertStateToModule(conversionConfig);
    
    // Verify that specific attributes were parameterized
    expect(moduleFiles['main.tf']).toContain('bucket = var.bucket');
    expect(moduleFiles['variables.tf']).toContain('variable "bucket"');
  });
});