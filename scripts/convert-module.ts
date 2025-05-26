#!/usr/bin/env node
/**
 * Command-line script to convert Terraform state or configuration to a module
 * Usage:
 *   npx ts-node scripts/convert-to-module.ts --state state.json --name my_module --output ./modules
 *   npx ts-node scripts/convert-to-module.ts --config main.tf --name my_module --output ./modules
 */

import * as fs from 'fs';
import * as path from 'path';
import { 
  convertStateToModule, 
  extractFromState, 
  extractFromHcl, 
  ConversionConfig, 
  ExtractionOptions 
} from '../src/converter.js';

// Parse command line arguments
const args = process.argv.slice(2);
let stateFile = '';
let configFile = '';
let moduleName = '';
let description = 'A Terraform module generated from existing resources';
let outputDir = './module';
let parameterizeCommon = true;
let redactSensitive = true;

// Parse arguments
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  
  if (arg === '--state' && i + 1 < args.length) {
    stateFile = args[++i];
  } else if (arg === '--config' && i + 1 < args.length) {
    configFile = args[++i];
  } else if (arg === '--name' && i + 1 < args.length) {
    moduleName = args[++i];
  } else if (arg === '--description' && i + 1 < args.length) {
    description = args[++i];
  } else if (arg === '--output' && i + 1 < args.length) {
    outputDir = args[++i];
  } else if (arg === '--no-parameterize-common') {
    parameterizeCommon = false;
  } else if (arg === '--no-redact-sensitive') {
    redactSensitive = false;
  } else if (arg === '--help') {
    printHelp();
    process.exit(0);
  }
}

// Validate required arguments
if (!moduleName) {
  console.error('Error: Module name is required (--name)');
  printHelp();
  process.exit(1);
}

if (!stateFile && !configFile) {
  console.error('Error: Either state file (--state) or config file (--config) is required');
  printHelp();
  process.exit(1);
}

// Main execution
async function main() {
  try {
    let resources = [];
    let providers = [];
    
    const extractionOptions: ExtractionOptions = {
      redactSensitiveValues: redactSensitive,
      extractResources: true,
      extractDataSources: true,
      extractProviders: true
    };
    
    // Extract from state file if provided
    if (stateFile) {
      console.log(`Reading state file: ${stateFile}`);
      const stateContent = fs.readFileSync(stateFile, 'utf-8');
      const extracted = extractFromState(stateContent, extractionOptions);
      resources = extracted.resources;
      providers = extracted.providers;
    } 
    // Extract from config file if provided
    else if (configFile) {
      console.log(`Reading config file: ${configFile}`);
      const configContent = fs.readFileSync(configFile, 'utf-8');
      const extracted = extractFromHcl(configContent, extractionOptions);
      resources = extracted.resources;
      providers = extracted.providers;
    }
    
    // Check if we have resources to convert
    if (resources.length === 0) {
      console.error('No resources found in the provided file');
      process.exit(1);
    }
    
    console.log(`Found ${resources.length} resources to convert`);
    
    // Create conversion config
    const conversionConfig: ConversionConfig = {
      moduleName,
      description,
      resources,
      parameterizeCommonAttributes: parameterizeCommon,
      providerRequirements: providers
    };
    
    // Convert state to module
    console.log('Converting to module...');
    const moduleFiles = convertStateToModule(conversionConfig);
    
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Create examples directory if needed
    const examplesDir = path.join(outputDir, 'examples');
    if (!fs.existsSync(examplesDir) && Object.keys(moduleFiles).some(file => file.startsWith('examples/'))) {
      fs.mkdirSync(examplesDir, { recursive: true });
    }
    
    // Write files
    console.log(`Writing module files to: ${outputDir}`);
    for (const [filename, content] of Object.entries(moduleFiles)) {
      const filePath = path.join(outputDir, filename);
      
      // Create directory if needed
      const fileDir = path.dirname(filePath);
      if (!fs.existsSync(fileDir)) {
        fs.mkdirSync(fileDir, { recursive: true });
      }
      
      // Write file
      fs.writeFileSync(filePath, content);
      console.log(`- Created ${filename}`);
    }
    
    console.log('Done! Module successfully created.');
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
Terraform State to Module Converter

Usage:
  npx ts-node scripts/convert-to-module.ts [options]

Options:
  --state <file>             Path to Terraform state file (JSON format)
  --config <file>            Path to Terraform config file (HCL format)
  --name <name>              Name of the module to create
  --description <desc>       Description of the module (default: auto-generated)
  --output <dir>             Output directory (default: ./module)
  --no-parameterize-common   Disable automatic parameterization of common attributes
  --no-redact-sensitive      Disable redaction of sensitive values
  --help                     Display this help message

Examples:
  npx ts-node scripts/convert-to-module.ts --state terraform.tfstate --name vpc_module --output ./modules/vpc
  npx ts-node scripts/convert-to-module.ts --config main.tf --name vpc_module --description "VPC networking module"
  `);
}

// Run the main function
main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});