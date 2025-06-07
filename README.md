# Terraform Docs MCP

A Model Context Protocol (MCP) server for Terraform documentation and configuration generation. This service helps AI assistants fetch Terraform provider documentation and generate Terraform configurations.

## Features

- Retrieve documentation for Terraform providers and resources
- Generate Terraform configurations based on provider and resource specifications
- Get schema information for Terraform resources

## Installation

```bash
npm install
npm run build
```

## Usage

This package can be used as an MCP server for any AI assistant that supports the Model Context Protocol.

### As a CLI Tool

```bash
npx terraform-docs-mcp
```

### Integration with AI Assistants

To configure this MCP server with AI assistants that support the Model Context Protocol:

1. Install and build the package
2. Configure the AI assistant to use this MCP server according to the assistant's documentation
3. With Claude Desktop, add to your claude_desktop_config.json:

```json
{
  "mcpServers": {
    "terraform-docs": {
      "command": "node",
      "args": ["path/to/terraform-docs-mcp/dist/index.js"]
    }
  }
}
```

### Docker Usage

Build and run with Docker:

```bash
# Build the Docker image
docker build -t terraform-docs-mcp .

# Test the MCP server
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | docker run --rm -i terraform-docs-mcp
```

### Integration with Claude Desktop (Docker)

```json
{
  "mcpServers": {
    "terraform-docs": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "terraform-docs-mcp"]
    }
  }
}
```

## 🛠️ Available Tools

The MCP server provides the following tools:

### 1. `terraform_provider_docs`
Retrieves documentation for a Terraform provider and its resources from multiple sources.

**Parameters:**
- `provider` (required) - Provider name (e.g., aws, azure, gcp)
- `resource` (optional) - Specific resource name (e.g., instance, bucket, vpc)
- `useGithub` (optional) - Whether to fetch additional examples from GitHub

**Example:**
```json
{
  "provider": "aws",
  "resource": "instance",
  "useGithub": true
}
```

### 2. `terraform_generate_config`
Generates complete Terraform configurations with best practices and intelligent defaults.

**Parameters:**
- `provider` (required) - Provider name (e.g., aws, azure, gcp)
- `resource` (required) - Resource type (e.g., instance, bucket, vpc)
- `attributes` (optional) - Custom resource attributes
- `useGithub` (optional) - Whether to use GitHub schema information

**Example:**
```json
{
  "provider": "aws",
  "resource": "s3_bucket",
  "attributes": {
    "bucket": "my-app-bucket",
    "versioning": {"enabled": true},
    "tags": {"Environment": "production"}
  }
}
```

### 3. `terraform_resource_schema`
Gets detailed schema information for Terraform resources from provider repositories.

**Parameters:**
- `provider` (required) - Provider name (e.g., aws, azure, gcp)
- `resource` (required) - Resource type (e.g., instance, bucket, vpc)
- `useGithub` (optional) - Whether to extract schema from GitHub

**Example:**
```json
{
  "provider": "aws",
  "resource": "s3_bucket",
  "useGithub": true
}
```

### 4. `terraform_github_info`
Gets GitHub repository information for Terraform providers.

**Parameters:**
- `provider` (required) - Provider name (e.g., aws, azure, gcp)

**Example:**
```json
{
  "provider": "aws"
}
```

## 🧪 Testing

### Direct Docker Commands

```bash
# List available tools
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | docker run --rm -i terraform-docs-mcp

# Generate AWS EC2 configuration
echo '{"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "terraform_generate_config", "arguments": {"provider": "aws", "resource": "instance", "attributes": {"instance_type": "t3.micro", "tags": {"Environment": "dev"}}}}}' | docker run --rm -i terraform-docs-mcp

# Get AWS S3 bucket schema
echo '{"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "terraform_resource_schema", "arguments": {"provider": "aws", "resource": "s3_bucket", "useGithub": true}}}' | docker run --rm -i terraform-docs-mcp

# Get provider documentation with examples
echo '{"jsonrpc": "2.0", "id": 4, "method": "tools/call", "params": {"name": "terraform_provider_docs", "arguments": {"provider": "aws", "resource": "instance", "useGithub": true}}}' | docker run --rm -i terraform-docs-mcp
```

### Using Claude Desktop

Once configured, you can ask Claude:
- *"What Terraform tools are available?"*
- *"Generate a Terraform configuration for an AWS EC2 instance"*
- *"Show me the schema for an AWS S3 bucket"*
- *"Create Terraform code for a Google Cloud compute instance"*
- *"Get documentation for Azure virtual machine resource"*

## 📋 Supported Providers

The MCP server dynamically supports any Terraform provider by fetching information from official sources:

### 🔥 **Popular Providers:**
- **AWS** (`aws`) - Amazon Web Services
- **Azure** (`azurerm`, `azure`) - Microsoft Azure  
- **Google Cloud** (`google`, `gcp`) - Google Cloud Platform
- **Kubernetes** (`kubernetes`) - Kubernetes resources
- **Docker** (`docker`) - Docker containers and images
- **GitHub** (`github`) - GitHub repositories and resources

### 🌐 **Additional Providers:**
- **Oracle Cloud** (`oci`) - Oracle Cloud Infrastructure
- **DigitalOcean** (`digitalocean`) - DigitalOcean resources
- **DataDog** (`datadog`) - DataDog monitoring
- **Terraform Cloud** (`tfe`) - Terraform Enterprise/Cloud
- **Vault** (`vault`) - HashiCorp Vault
- **Consul** (`consul`) - HashiCorp Consul
- **Helm** (`helm`) - Kubernetes Helm charts

### 🛠️ **Utility Providers:**
- **Random** (`random`) - Random values generation
- **Time** (`time`) - Time-based resources
- **Local** (`local`) - Local file operations
- **Null** (`null`) - Null resources for triggers
- **External** (`external`) - External data sources

**Note:** The server automatically discovers provider repositories and fetches live schemas, so it supports any publicly available Terraform provider.

## 🏗️ Architecture

### 🔄 **Data Flow:**
1. **Request** → MCP Server receives tool call
2. **Discovery** → Locates provider GitHub repository
3. **Schema Extraction** → Fetches resource schemas from source code
4. **Documentation** → Retrieves examples from Terraform Registry
5. **Generation** → Creates optimized Terraform configurations
6. **Response** → Returns comprehensive results

### 📁 **Project Structure:**
```
terraform-docs-mcp/
├── src/
│   ├── index.ts              # Main MCP server entry point
│   ├── generator.ts          # Terraform configuration generator
│   ├── github.ts            # GitHub integration and schema extraction
│   ├── schema-integration.ts # Schema processing and integration
│   └── global.d.ts          # TypeScript type definitions
├── docker/
│   ├── Dockerfile           # Multi-stage Docker build
│   └── .dockerignore        # Docker build exclusions
├── dist/                    # Compiled JavaScript output
├── package.json             # Node.js dependencies and scripts
├── tsconfig.json           # TypeScript configuration
└── README.md               # This file
```

## 🚀 Development

### **Local Development:**
```bash
# Clone repository
git clone <repository-url>
cd terraform-docs-mcp

# Install dependencies
npm install

# Build TypeScript
npm run build

# Start development server
npm start
```

### **Docker Development:**
```bash
# Build development image
docker build -t terraform-docs-mcp-dev .

# Run with volume mount for live editing
docker run --rm -it -v $(pwd):/app -w /app node:18-alpine sh

# Rebuild and test
docker build -t terraform-docs-mcp . && echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | docker run --rm -i terraform-docs-mcp
```

### **Available Scripts:**
```bash
npm run build          # Compile TypeScript
npm run start          # Start MCP server
npm run docker:build   # Build Docker image
npm run docker:run     # Run Docker container
npm run docker:dev     # Development shell
```

## 🎯 Key Benefits

### ✨ **Dynamic & Live Data:**
- 🔄 **No Hardcoded Values** - All data fetched from live sources
- 📊 **Real Schemas** - Extracted from official provider repositories
- 📖 **Live Documentation** - From Terraform Registry and GitHub
- 🎯 **Up-to-date Examples** - Real code from provider maintainers

### 🐳 **Production Ready:**
- 📦 **Containerized** - Consistent deployment across environments
- 🔒 **Secure** - Non-root container execution
- ⚡ **Fast** - Optimized Alpine Linux base image
- 🛡️ **Reliable** - Health checks and proper signal handling

### 🧠 **AI-Optimized:**
- 🤖 **MCP Protocol** - Native integration with AI assistants
- 📋 **Structured Output** - Clean JSON responses for AI processing
- 🎨 **Best Practices** - Generated code follows Terraform conventions
- 🔧 **Flexible** - Supports any provider and resource combination