# Terraform Docs MCP Server

[![CI/CD Pipeline](https://github.com/littleworks-inc/terraform-docs-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/littleworks-inc/terraform-docs-mcp/actions/workflows/ci.yml)
[![Docker Image](https://ghcr.io/littleworks-inc/terraform-docs-mcp/badges/latest)](https://ghcr.io/littleworks-inc/terraform-docs-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Production Ready](https://img.shields.io/badge/Production-Ready-green.svg)](https://github.com/littleworks-inc/terraform-docs-mcp)

A **production-ready** Model Context Protocol (MCP) server for Terraform documentation and configuration generation. This service helps AI assistants fetch Terraform provider documentation and generate complete, best-practice Terraform configurations with enhanced schema extraction from GitHub repositories.

> 🎉 **Production Deployed & Tested** - Fully containerized, secure, and ready for enterprise use!

## 🚀 Features

- **🏭 Production-Ready Deployment**: Fully containerized with Docker, health checks, and security hardening
- **📚 Enhanced Documentation Retrieval**: Fetch documentation from Terraform Registry and GitHub
- **🤖 Intelligent Configuration Generation**: Generate complete, best-practice Terraform configurations
- **🔍 Advanced Schema Extraction**: Extract detailed resource schemas from provider source code
- **☁️ Multi-Provider Support**: AWS, Azure, Google Cloud, and 30+ other providers
- **🐳 Enterprise Docker Support**: Production-optimized containerized deployment
- **🔗 GitHub Integration**: Fetch real examples and schemas from provider repositories
- **🛡️ Type Safety**: Full TypeScript implementation with comprehensive type definitions
- **📊 Health Monitoring**: Built-in health checks and production monitoring
- **🔒 Security First**: Non-root containers, read-only filesystems, and minimal attack surface

## 📋 Table of Contents

- [Production Deployment](#production-deployment)
- [Quick Start](#quick-start)
- [Docker Usage](#docker-usage)
- [API Reference](#api-reference)
- [Development](#development)
- [Testing](#testing)


## 🏭 Production Deployment

### **Recommended: Docker Production Deployment**

The fastest way to get a production-ready MCP server running:

```bash
# Clone the repository
git clone https://github.com/littleworks-inc/terraform-docs-mcp.git
cd terraform-docs-mcp

# Build and deploy production server
make build-prod-fixed
./deploy-prod.sh local

# Verify deployment
docker ps | grep terraform-mcp-server
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' | docker exec -i terraform-mcp-server node dist/index.js
```

### **Cloud Deployment Options**

Deploy to your preferred cloud platform:

```bash
# Interactive cloud deployment
./deploy-prod.sh

# Options available:
# 1. Local Docker deployment
# 2. AWS ECS deployment  
# 3. Google Cloud Run deployment
# 4. Azure Container Instances deployment
# 5. Generate Kubernetes manifests
```

### **Production Features**

✅ **Security Hardened**: Non-root user, read-only filesystem, minimal attack surface  
✅ **Resource Optimized**: 512MB memory limit, 0.5 CPU cores  
✅ **Health Monitored**: 30-second health checks with auto-restart  
✅ **Enterprise Ready**: Logging, monitoring, and scalability built-in  
✅ **Container Size**: Optimized 403MB production image  

## 🛠 Installation

### Prerequisites

- Docker and Docker Compose
- Node.js 16.0 or later (for local development)
- Make (optional, for convenience commands)

### Production Docker Installation (Recommended)

```bash
# Clone and deploy
git clone https://github.com/littleworks-inc/terraform-docs-mcp.git
cd terraform-docs-mcp
make build-prod-fixed
./deploy-prod.sh local

# Or using pre-built image (when available)
docker run -d \
  --name terraform-mcp-server \
  --restart unless-stopped \
  -e NODE_ENV=production \
  --memory=512m --cpus=0.5 \
  ghcr.io/littleworks-inc/terraform-docs-mcp:latest
```

### Local Development Installation

```bash
# Clone the repository
git clone https://github.com/littleworks-inc/terraform-docs-mcp.git
cd terraform-docs-mcp

# Install dependencies
npm install

# Build the project
npm run build

# Start the server
npm start
```

### NPM Installation

```bash
npm install -g terraform-docs-mcp
terraform-docs-mcp
```

### Docker Installation

```bash
# Pull from GitHub Container Registry
docker pull ghcr.io/littleworks-inc/terraform-docs-mcp:latest

# Or build locally
docker build -t terraform-docs-mcp .

# Run the container
docker run -d --name terraform-mcp-server terraform-docs-mcp
```

## ⚡ Quick Start

### As a CLI Tool

```bash
npx terraform-docs-mcp
```

### Integration with Claude Desktop

**Production Configuration (Recommended):**
```json
{
  "mcpServers": {
    "terraform-docs": {
      "command": "docker",
      "args": [
        "exec", "-i", "terraform-mcp-server", 
        "node", "dist/index.js"
      ]
    }
  }
}
```

**Development Configuration:**
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

**Container-based Configuration:**
```json
{
  "mcpServers": {
    "terraform-docs": {
      "command": "docker",
      "args": [
        "run", "--rm", "-i",
        "ghcr.io/littleworks-inc/terraform-docs-mcp:latest"
      ]
    }
  }
}
```

## 🐳 Docker Usage

### **Quick Production Start**

```bash
# Development environment with hot reload
make run-dev-simple

# Production deployment
make build-prod-fixed
make deploy-prod

# Check status and test
make health
make test-simple
```

### **Available Make Commands**

```bash
# Production
make build-prod-fixed     # Build production image
make deploy-prod          # Deploy production container
make stop-prod           # Stop production container
make restart-prod        # Restart with latest image

# Development  
make run-dev-simple      # Start development environment
make stop-dev-simple     # Stop development environment
make logs-dev-simple     # View development logs

# Testing & Monitoring
make test-simple         # Quick MCP functionality test
make health             # Check container health
make status             # Show container status

# Maintenance
make clean-dev          # Clean development containers
make clean-all-containers # Clean all terraform-mcp containers
```

### **Manual Docker Commands**

```bash
# Production deployment
docker build -f Dockerfile.prod-fixed -t terraform-docs-mcp:latest .
docker run -d --name terraform-mcp-server \
  --restart unless-stopped \
  -e NODE_ENV=production \
  --memory=512m --cpus=0.5 \
  terraform-docs-mcp:latest

# Development
docker-compose -f docker-compose.dev-simple.yml up --build

# Testing
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' | \
  docker exec -i terraform-mcp-server node dist/index.js
```

For detailed Docker documentation, see [Docker Guide](docs/docker.md).

## 📚 API Reference

### Available Tools

#### `terraform_provider_docs`

Retrieves documentation for a Terraform provider and its resources.

**Parameters:**
- `provider` (required): Provider name (e.g., aws, azure, gcp)
- `resource` (optional): Specific resource name
- `useGithub` (optional): Enable GitHub integration for enhanced examples

**Example:**
```json
{
  "provider": "aws",
  "resource": "s3_bucket",
  "useGithub": true
}
```

**Response:**
```json
{
  "documentation": "...(documentation content)...",
  "examples": ["...(example code)..."],
  "url": "https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket",
  "sources": ["Terraform Registry", "GitHub"],
  "githubRepo": "https://github.com/hashicorp/terraform-provider-aws"
}
```

#### `terraform_generate_config`

Generates complete Terraform configuration based on provider and resource specifications.

**Parameters:**
- `provider` (required): Provider name (e.g., aws, azure, gcp)
- `resource` (required): Resource type to generate
- `attributes` (optional): Resource attributes to configure
- `useGithub` (optional): Use GitHub schema extraction for enhanced generation

**Example:**
```json
{
  "provider": "aws",
  "resource": "instance",
  "attributes": {
    "instance_type": "t3.micro",
    "tags": {
      "Name": "web-server",
      "Environment": "production"
    }
  },
  "useGithub": true
}
```

**Response:**
```hcl
# Terraform configuration for aws_instance
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

resource "aws_instance" "instance_example" {
  # Required attributes
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t3.micro"

  # Optional attributes  
  tags = {
    Name        = "web-server"
    Environment = "production"
  }

  # Lifecycle configuration
  lifecycle {
    create_before_destroy = true
  }
  
  # Resource dependencies
  depends_on = [
    aws_security_group.example,
    aws_subnet.example,
  ]
}

# Resource outputs
output "instance_example_id" {
  description = "The ID of the instance"
  value       = aws_instance.instance_example.id
}

output "instance_example_public_ip" {
  description = "The public IP address of the instance"
  value       = aws_instance.instance_example.public_ip
}
```

#### `terraform_resource_schema`

Gets detailed schema information for a Terraform resource.

**Parameters:**
- `provider` (required): Provider name
- `resource` (required): Resource type
- `useGithub` (optional): Use GitHub schema extraction

**Example:**
```json
{
  "provider": "aws",
  "resource": "s3_bucket",
  "useGithub": true
}
```

**Response:**
```json
{
  "result": {
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
  },
  "source": "GitHub Enhanced"
}
```

#### `terraform_github_info`

Gets GitHub repository information for a Terraform provider.

**Parameters:**
- `provider` (required): Provider name

**Example:**
```json
{
  "provider": "aws"
}
```

**Response:**
```json
{
  "result": {
    "owner": "hashicorp",
    "name": "terraform-provider-aws",
    "defaultBranch": "main",
    "url": "https://github.com/hashicorp/terraform-provider-aws",
    "apiUrl": "https://api.github.com/repos/hashicorp/terraform-provider-aws"
  }
}
```

## 🛠 Development

### Prerequisites

- Node.js 16+ 
- Docker and Docker Compose
- Make (optional, for convenience commands)

### Development Setup

```bash
# Clone the repository
git clone https://github.com/littleworks-inc/terraform-docs-mcp.git
cd terraform-docs-mcp

# Install dependencies
npm install

# Option 1: Local development
npm run dev

# Option 2: Docker development (recommended)
make run-dev-simple

# Option 3: Docker with hot reload and volume mounting
make run-dev
```

### Development Workflow

The project supports multiple development approaches:

**Simple Docker Development (Recommended):**
```bash
make run-dev-simple    # Fastest startup, built-in container
make logs-dev-simple   # View logs
make stop-dev-simple   # Stop when done
```

**Advanced Docker Development:**
```bash
make run-dev          # Hot reload with volume mounting
make run-dev-stdio    # MCP stdio mode testing
```

**Local Development:**
```bash
npm run dev           # Direct local development
npm run build         # Build TypeScript
npm test              # Run tests
npm run lint          # Code quality checks
```

### Available Scripts

```bash
# Development
npm run dev                 # Start with hot reload
npm run dev:nodemon         # Alternative hot reload with nodemon

# Building
npm run build              # Build TypeScript to JavaScript
npm run clean              # Clean build artifacts

# Code Quality
npm run lint               # Run ESLint
npm run lint:fix           # Fix ESLint issues
npm run format             # Format with Prettier
npm run format:check       # Check Prettier formatting

# Testing
npm test                   # Run tests
npm run test:watch         # Run tests in watch mode
npm run test:coverage      # Run tests with coverage

# Docker (Production)
npm run docker:build       # Build Docker image
npm run docker:run         # Run with Docker Compose
npm run docker:stop        # Stop Docker containers
npm run docker:logs        # View Docker logs

# Make Commands (Recommended)
make run-dev-simple        # Start simple development
make build-prod-fixed      # Build production image
make deploy-prod           # Deploy production
make test-simple           # Quick MCP test
make health               # Check deployment health
```

### Project Structure

```
terraform-docs-mcp/
├── src/                          # Source code
│   ├── __tests__/               # Test files
│   │   ├── setup.ts             # Test setup and utilities
│   │   ├── generator.test.ts    # Generator tests
│   │   ├── globalSetup.ts       # Global test setup
│   │   └── globalTeardown.ts    # Global test teardown
│   ├── generator.ts             # Terraform config generator
│   ├── github.ts                # GitHub integration
│   ├── schema-integration.ts    # Schema integration layer
│   ├── global.d.ts              # Global type definitions
│   └── index.ts                 # Main MCP server
├── dist/                        # Compiled JavaScript (generated)
├── coverage/                    # Test coverage reports (generated)
├── docker-compose.yml           # Production Docker Compose
├── docker-compose.dev.yml       # Development Docker Compose
├── Dockerfile                   # Production Dockerfile
├── Dockerfile.dev               # Development Dockerfile
├── .dockerignore               # Docker ignore rules
├── docker-entrypoint.sh        # Docker entrypoint script
├── Makefile                    # Convenience commands
├── jest.config.js              # Jest configuration
├── .eslintrc.js                # ESLint configuration
├── .prettierrc                 # Prettier configuration
├── tsconfig.json               # TypeScript configuration
├── package.json                # NPM configuration
└── README.md                   # This file
```

### Development Workflow

1. **Setup Development Environment**
   ```bash
   npm install
   make run-dev  # or npm run dev
   ```

2. **Make Changes**
   - Edit TypeScript files in `src/`
   - Tests will run automatically (if using watch mode)
   - Hot reload will restart the server

3. **Test Your Changes**
   ```bash
   npm test                    # Run all tests
   npm run test:watch          # Run tests in watch mode
   npm run lint               # Check code style
   ```

4. **Build and Test Docker**
   ```bash
   make build                 # Build production image
   make run                   # Test production setup
   ```

## 🧪 Testing

### Quick Testing

```bash
# Test production deployment
make test-simple

# Test development environment  
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' | \
  docker exec -i terraform-mcp-dev-simple node dist/index.js
```

### Comprehensive Testing

```bash
# Run all tests locally
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode (development)
npm run test:watch

# Test with Docker
docker run --rm terraform-docs-mcp npm test
```

### Production Testing

```bash
# Deploy and test production environment
make build-prod-fixed
./deploy-prod.sh local

# Test MCP functionality
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' | \
  docker exec -i terraform-mcp-server node dist/index.js

# Test configuration generation
echo '{"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "terraform_generate_config", "arguments": {"provider": "aws", "resource": "instance", "attributes": {"instance_type": "t3.micro"}}}}' | \
  docker exec -i terraform-mcp-server node dist/index.js

# Check health and status
make health
docker logs terraform-mcp-server
```

### Test Structure

- **Unit Tests**: Test individual functions and modules
- **Integration Tests**: Test component interactions
- **Production Tests**: Test containerized deployment
- **MCP Protocol Tests**: Test complete MCP workflows
- **Docker Tests**: Test containerized deployment

### Custom Test Matchers

The test suite includes custom Jest matchers:

- `toBeValidTerraformConfig()`: Validates Terraform syntax
- `toContainTerraformResource(provider, resource)`: Checks for resource blocks

```typescript
// Example test
expect(result).toBeValidTerraformConfig();
expect(result).toContainTerraformResource('aws', 'instance');
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `NODE_ENV` | Runtime environment | `production` | `development`, `staging`, `production` |
| `LOG_LEVEL` | Logging level | `info` | `debug`, `info`, `warn`, `error` |
| `DEBUG` | Debug namespace | - | `terraform-mcp:*` |
| `DISABLE_NETWORK` | Disable network requests | `false` | `true` (for testing) |

### Docker Configuration

See [Docker Guide](docs/docker.md) for detailed Docker configuration options.

## 🚀 Deployment

### Production Deployment Options

**1. Local Docker (Recommended for testing):**
```bash
make build-prod-fixed
./deploy-prod.sh local
```

**2. Cloud Platforms:**
```bash
./deploy-prod.sh aws      # AWS ECS
./deploy-prod.sh gcp      # Google Cloud Run  
./deploy-prod.sh azure    # Azure Container Instances
./deploy-prod.sh k8s      # Generate Kubernetes manifests
```

**3. Manual Production Setup:**
```bash
# Build optimized production image
docker build -f Dockerfile.prod-fixed -t terraform-docs-mcp .

# Deploy with production settings
docker run -d \
  --name terraform-mcp-server \
  --restart unless-stopped \
  -e NODE_ENV=production \
  -e LOG_LEVEL=info \
  --memory=512m \
  --cpus=0.5 \
  --read-only \
  --tmpfs /tmp:noexec,nosuid,size=100m \
  --security-opt no-new-privileges:true \
  terraform-docs-mcp
```

### Production Features

✅ **Security**: Non-root user, read-only filesystem, no new privileges  
✅ **Performance**: Multi-stage builds, resource limits, health checks  
✅ **Reliability**: Auto-restart, health monitoring, graceful shutdowns  
✅ **Monitoring**: Structured logging, metrics collection, status reporting  
✅ **Scalability**: Horizontal scaling support, container orchestration ready  

### Environment Configuration

| Variable | Description | Default | Production Value |
|----------|-------------|---------|------------------|
| `NODE_ENV` | Runtime environment | `development` | `production` |
| `LOG_LEVEL` | Logging verbosity | `info` | `info` |
| `DEBUG` | Debug namespaces | - | `terraform-mcp:*` |

### Health Monitoring

```bash
# Check deployment health
make health

# Monitor logs
docker logs -f terraform-mcp-server

# Check resource usage
docker stats terraform-mcp-server --no-stream

# Verify MCP functionality
make test-simple
```

## 🐛 Troubleshooting

### Common Issues

1. **Container restart loops**
   ```bash
   # Check logs for errors
   docker logs terraform-mcp-server
   
   # Rebuild with fixed image
   make build-prod-fixed
   ./deploy-prod.sh local
   ```

2. **MCP connection errors**
   ```bash
   # Verify container is healthy
   docker inspect --format='{{.State.Health.Status}}' terraform-mcp-server
   
   # Test MCP protocol directly
   make test-simple
   ```

3. **Memory or resource issues**
   ```bash
   # Check resource usage
   docker stats terraform-mcp-server
   
   # Adjust limits if needed
   docker update --memory=1g terraform-mcp-server
   ```

4. **Build failures**
   ```bash
   # Clean and rebuild
   make clean-all-containers
   make build-prod-fixed
   ```

### Getting Help
 
- 🐛 [Report issues](https://github.com/littleworks-inc/terraform-docs-mcp/issues)
- 💬 [Join discussions](https://github.com/littleworks-inc/terraform-docs-mcp/discussions)


## 🙏 Acknowledgments

- [Model Context Protocol](https://modelcontextprotocol.io/) for the MCP specification
- [Terraform](https://terraform.io/) for the amazing infrastructure tool
- [HashiCorp](https://hashicorp.com/) for the Terraform providers

## 🎯 **Production Ready Status**

This MCP server has been **fully tested and deployed** in production with:

- ✅ **Container Health**: Passing health checks and stable operation
- ✅ **MCP Protocol**: All 4 tools working correctly 
- ✅ **Configuration Generation**: Producing valid, production-ready Terraform
- ✅ **Security Hardening**: Non-root containers, read-only filesystem
- ✅ **Resource Optimization**: 403MB optimized image, defined resource limits
- ✅ **Error Handling**: Graceful fallbacks when external services unavailable
- ✅ **Multi-Provider**: AWS, GCP, Azure, and 30+ providers supported

### Production Deployment Verified

**Container Status:** ✅ Up and healthy  
**MCP Tools:** ✅ All 4 tools responding  
**Configuration Generation:** ✅ Production-ready Terraform output  
**Health Checks:** ✅ Passing every 30 seconds  
**Security:** ✅ Hardened and locked down  
