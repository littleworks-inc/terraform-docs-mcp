# Terraform Docs MCP

A Model Context Protocol (MCP) server for Terraform documentation and configuration generation. This service helps AI assistants fetch Terraform provider documentation and generate production-ready Terraform configurations with intelligent defaults and best practices.

## Features

- 🔍 **Smart Documentation Retrieval** - Fetch provider and resource documentation from multiple sources
- 🏗️ **Intelligent Configuration Generation** - Create complete, production-ready Terraform configurations
- 📊 **Schema Extraction** - Get detailed resource schemas with validation information
- 🌐 **Multi-Source Data** - Combines Terraform Registry, GitHub repositories, and local fallbacks
- 🔧 **Best Practices** - Generated configs follow Terraform best practices with proper structure
- 🎯 **Provider-Specific Optimizations** - Smart defaults for AWS, Azure, Google Cloud, and more

## Prerequisites

- Node.js >= 16.0.0
- npm (comes with Node.js)
- Internet connection (for fetching live schemas and documentation)
- Git (for development)

## Installation

```bash
# Clone the repository
git clone <your-repository-url>
cd terraform-docs-mcp

# Install dependencies
npm install

# Build the project
npm run build
```

The build process creates executable files in the `dist/` directory and makes them executable.

## Usage

### Integration with Claude Desktop

This is the primary way to use the MCP server:

1. **Ensure the project is built**:
   ```bash
   npm run build
   ```

2. **Add to your Claude Desktop configuration**:
   
   Edit your `claude_desktop_config.json` file (location varies by OS):
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Linux**: `~/.config/Claude/claude_desktop_config.json`

   ```json
   {
     "mcpServers": {
       "terraform-docs": {
         "command": "node",
         "args": ["/absolute/path/to/terraform-docs-mcp/dist/index.js"]
       }
     }
   }
   ```

   **Important**: Use the absolute path to your project directory.

3. **Restart Claude Desktop**

4. **Test the integration**:
   Ask Claude: "What Terraform tools do you have available?"

### Natural Language Usage with Claude

Once configured, you can ask Claude natural language questions:

#### Configuration Generation
- *"Generate a Terraform configuration for an AWS S3 bucket with versioning enabled"*
- *"Create an AWS EC2 instance configuration with t3.micro type and custom tags"*
- *"Show me a Google Cloud Compute instance setup with a custom boot disk"*
- *"Generate an Azure virtual machine configuration for development"*

#### Documentation and Schema
- *"What attributes are available for AWS RDS databases?"*
- *"Show me documentation for Google Cloud Storage buckets"*
- *"Get the schema for Azure virtual networks"*
- *"What are the required fields for AWS Lambda functions?"*

#### Provider Information
- *"What's the GitHub repository for the AWS Terraform provider?"*
- *"Get repository information for the Azure provider"*

### CLI Usage (Advanced)

```bash
# Run as a standalone CLI tool
npx terraform-docs-mcp

# Or run the compiled version directly
node dist/index.js
```

## Available Tools

The MCP server provides these tools for AI assistants:

### `terraform_provider_docs`
Retrieves documentation for a Terraform provider and its resources.

**Parameters:**
- `provider` (required): Provider name (e.g., aws, azure, gcp)
- `resource` (optional): Specific resource name (e.g., s3_bucket, instance)
- `useGithub` (optional): Whether to use GitHub as additional source (default: false)

**Example with Claude:**
*"Get documentation for AWS S3 bucket resources"*

### `terraform_generate_config`
Generates complete Terraform configuration based on provider and resource specifications.

**Parameters:**
- `provider` (required): Provider name (e.g., aws, azure, gcp)
- `resource` (required): Resource name (e.g., instance, bucket, vpc)
- `attributes` (optional): Resource attributes to configure
- `useGithub` (optional): Whether to use GitHub schema information (default: true)

**Example with Claude:**
*"Generate a Terraform configuration for an AWS EC2 instance with instance type t3.micro and environment tag set to production"*

### `terraform_resource_schema`
Gets the detailed schema for a Terraform resource including all available attributes.

**Parameters:**
- `provider` (required): Provider name (e.g., aws, azure, gcp)
- `resource` (required): Resource name (e.g., s3_bucket, instance)
- `useGithub` (optional): Whether to use GitHub as schema source (default: true)

**Example with Claude:**
*"What attributes are available for an AWS S3 bucket?"*

### `terraform_github_info`
Gets GitHub repository information for a Terraform provider.

**Parameters:**
- `provider` (required): Provider name (e.g., aws, azure, gcp)

**Example with Claude:**
*"What's the GitHub repository for the AWS Terraform provider?"*

## Configuration

### Data Sources
The tool intelligently fetches data from multiple sources:

1. **Terraform Registry** (`registry.terraform.io`) - Official provider documentation
2. **GitHub Repositories** - Live schemas and examples from provider source code
3. **Local Fallbacks** - Basic schemas when external sources are unavailable

### Controlling Data Sources
You can control data source behavior:
- `useGithub: true` (default) - Fetch live schemas from GitHub repositories
- `useGithub: false` - Use only Terraform Registry and local fallback data
- Monitor debug output to see which sources are being used

### Supported Providers
The tool has built-in support for major providers:
- **AWS** (`aws`) - Amazon Web Services
- **Azure** (`azurerm`, `azure`) - Microsoft Azure
- **Google Cloud** (`google`, `gcp`) - Google Cloud Platform
- **Kubernetes** (`kubernetes`) - Kubernetes resources
- **Docker** (`docker`) - Docker containers
- **GitHub** (`github`) - GitHub resources
- And many more...

## Example Outputs

### Generated Terraform Configuration
When you ask for a configuration, you get complete, production-ready code:

```hcl
# Terraform configuration for aws_s3_bucket
# Generated with terraform-docs-mcp

terraform {
  required_version = ">= 1.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 4.0.0"
    }
  }
}

provider "aws" {
  region = "us-west-2"
  
  default_tags {
    tags = {
      Project     = "example-project"
      Environment = "dev"
      ManagedBy   = "terraform"
    }
  }
}

resource "aws_s3_bucket" "s3_bucket_example" {
  # Required attributes
  bucket = "example-bucket-12345"

  # Optional attributes
  tags = {
    Name        = "example"
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}

# Resource outputs
output "s3_bucket_example_id" {
  description = "The name of the bucket"
  value       = aws_s3_bucket.s3_bucket_example.id
}

output "s3_bucket_example_arn" {
  description = "The ARN of the bucket"
  value       = aws_s3_bucket.s3_bucket_example.arn
}
```

### Resource Schema Information
```json
{
  "attributes": {
    "bucket": {
      "description": "The name of the bucket",
      "required": true,
      "type": "string"
    },
    "acl": {
      "description": "The canned ACL to apply",
      "required": false,
      "type": "string"
    },
    "versioning": {
      "description": "A state of versioning",
      "required": false,
      "type": "list",
      "nested": true
    }
  }
}
```

## Testing

### Quick Integration Test

1. **Ensure Claude Desktop is configured** with the MCP server
2. **Ask Claude**: *"What Terraform tools do you have available?"*
3. **Expected response**: Claude should list the 4 available tools
4. **Test generation**: *"Generate a simple AWS S3 bucket configuration"*

### Manual Testing (Advanced)

```bash
# Start the MCP server in test mode
node dist/index.js 2> debug.log &

# In another terminal, send JSON-RPC requests:
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' | nc localhost <port>
```

### Debug Output
The server logs detailed information to stderr:
```bash
# View debug output
node dist/index.js 2>&1 | grep -E "(Fetching|Using|GitHub|source)"
```

Look for these indicators:
- `"source": "GitHub Enhanced"` - Data from GitHub repositories
- `"source": "Simulated Data"` - Local fallback data
- `"sources": ["Terraform Registry", "GitHub"]` - Multiple sources

## Troubleshooting

### Common Issues

**❌ "Command not found" or tool not available in Claude**
- Verify the absolute path in `claude_desktop_config.json` is correct
- Ensure `dist/index.js` exists after running `npm run build`
- Check that the file has executable permissions
- Restart Claude Desktop after configuration changes

**❌ No response from tools**
- Check Claude Desktop logs (usually in `~/.claude/logs/` or similar)
- Verify MCP server configuration syntax in JSON file
- Test the server manually: `node dist/index.js`

**❌ Network-related errors**
- The tool requires internet access for GitHub and Terraform Registry
- Check your internet connection and firewall settings
- Corporate networks may block GitHub API access
- Use `useGithub: false` to disable external GitHub lookups

**❌ "Schema not found" or incomplete configurations**
- Not all providers/resources have complete schemas available
- The tool automatically falls back to basic schemas
- Try with `useGithub: false` for basic functionality
- Some newer or niche providers may have limited support

**❌ Permission denied on execution**
- Run `chmod +x dist/index.js` to make the file executable
- Ensure Node.js has proper permissions

### Debug Mode
Enable verbose debugging:
```bash
# Run with full debug output
DEBUG=* node dist/index.js 2> full-debug.log

# Filter for specific information
node dist/index.js 2>&1 | grep -E "(Error|source|Fetching)"
```

## Project Structure

```
terraform-docs-mcp/
├── src/
│   ├── index.ts              # Main MCP server and tool definitions
│   ├── generator.ts          # Terraform configuration generator
│   ├── github.ts            # GitHub API integration and schema extraction
│   ├── schema-integration.ts # Schema processing and conversion
│   └── global.d.ts          # TypeScript type definitions
├── dist/                    # Compiled JavaScript (generated by build)
├── package.json             # Node.js dependencies and scripts
├── package-lock.json        # Dependency lock file
├── tsconfig.json           # TypeScript compiler configuration
├── polyfill.ts             # Web streams polyfill
├── .gitignore              # Git ignore rules
├── .npmrc                  # npm configuration
└── README.md               # This file
```

## Development

### Setup for Development
```bash
# Clone and install
git clone <repository-url>
cd terraform-docs-mcp
npm install

# Development build (watches for changes)
npm run build

# Start in development mode
npm start
```

### Code Architecture

- **`src/index.ts`** - Main MCP server implementation with tool definitions and request handling
- **`src/generator.ts`** - Advanced Terraform configuration generator with best practices
- **`src/github.ts`** - GitHub API integration for fetching schemas and examples
- **`src/schema-integration.ts`** - Bridges GitHub schema extraction with configuration generation

### Adding New Providers

To add support for a new provider:

1. **Add provider repository** to `PROVIDER_REPOS` in `src/github.ts`:
   ```typescript
   'newprovider': { 
     owner: 'company', 
     name: 'terraform-provider-newprovider',
     defaultBranch: 'main'
   }
   ```

2. **Add provider-specific defaults** in `src/generator.ts` in the `generateProviderBlock()` function

3. **Test the new provider**:
   ```bash
   npm run build
   # Test with Claude: "Generate configuration for newprovider resource"
   ```

### Code Style and Best Practices

- **TypeScript** - Strongly typed with comprehensive interfaces
- **Modular Architecture** - Separated concerns across multiple files
- **Error Handling** - Graceful fallbacks when external services fail
- **Caching Strategy** - Intelligent use of local fallbacks
- **Documentation** - Comprehensive inline documentation

### Running Tests
```bash
# Build and run basic functionality test
npm run build
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' | node dist/index.js
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test thoroughly
4. Build and verify: `npm run build`
5. Test with Claude Desktop integration
6. Submit a pull request

## License

MIT

## Support

For issues, questions, or contributions:
1. Check the troubleshooting section above
2. Review debug logs for error details
3. Test with different providers and resources
4. Open an issue with detailed information about your setup and the problem