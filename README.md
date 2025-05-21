# Terraform Docs MCP

A Model Context Protocol (MCP) server for Terraform documentation and configuration generation. This service helps AI assistants fetch Terraform provider documentation and generate Terraform configurations.

## Features

- Retrieve documentation for Terraform providers and resources
- Generate Terraform configurations based on provider and resource specifications
- Get schema information for Terraform resources
- Enhanced GitHub integration for improved schema extraction
- Secure API requests with authentication and rate limiting
- Performance optimization through caching

## Installation

```bash
# Install dependencies
npm install

# Build the project
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

## Available Tools

The MCP server provides the following tools:

### terraform_provider_docs

Retrieves documentation for a Terraform provider and its resources.

**Input parameters:**
- `provider` (required): The name of the provider (e.g., aws, azure, gcp)
- `resource` (optional): The specific resource to get documentation for
- `useGithub` (optional): Whether to use GitHub as an additional source for documentation

**Example request:**
```json
{
  "provider": "aws",
  "resource": "s3_bucket",
  "useGithub": true
}
```

**Example response:**
```json
{
  "documentation": "...(documentation content)...",
  "examples": ["...(example code)..."],
  "url": "https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket",
  "sources": ["Terraform Registry", "GitHub"],
  "githubRepo": "https://github.com/hashicorp/terraform-provider-aws"
}
```

**Example usage:**
```
# Ask the AI assistant
Get documentation for the AWS S3 bucket Terraform resource
```

### terraform_generate_config

Generates Terraform configuration based on provider and resource.

**Input parameters:**
- `provider` (required): The name of the provider (e.g., aws, azure, gcp)
- `resource` (required): The resource to generate configuration for
- `attributes` (optional): Resource attributes to configure
- `useGithub` (optional): Whether to use GitHub schema information

**Example request:**
```json
{
  "provider": "aws",
  "resource": "instance",
  "attributes": {
    "instance_type": "t2.micro",
    "tags": {
      "Name": "web-server",
      "Environment": "production"
    }
  },
  "useGithub": true
}
```

**Example response:**
```
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
      Project = "example-project"
      Environment = "dev"
      ManagedBy = "terraform"
    }
  }
}

resource "aws_instance" "instance_example" {
  # Required attributes
  ami = "ami-0c55b159cbfafe1f0"
  instance_type = "t2.micro"
  
  # Optional attributes
  tags = {
    Name = "web-server"
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

**Example usage:**
```
# Ask the AI assistant
Generate a Terraform configuration for an AWS EC2 instance with t2.micro instance type and tags for environment=production
```

### terraform_resource_schema

Gets the schema for a Terraform resource.

**Input parameters:**
- `provider` (required): The name of the provider (e.g., aws, azure, gcp)
- `resource` (required): The resource to get schema for
- `useGithub` (optional): Whether to use GitHub as the source for schema information

**Example request:**
```json
{
  "provider": "aws",
  "resource": "s3_bucket",
  "useGithub": true
}
```

**Example response:**
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
  },
  "source": "GitHub Enhanced"
}
```

**Example usage:**
```
# Ask the AI assistant
What attributes are available for an AWS S3 bucket in Terraform?
```

### terraform_github_info

Gets GitHub repository information for a Terraform provider.

**Input parameters:**
- `provider` (required): The name of the provider (e.g., aws, azure, gcp)

**Example request:**
```json
{
  "provider": "aws"
}
```

**Example response:**
```json
{
  "owner": "hashicorp",
  "name": "terraform-provider-aws",
  "defaultBranch": "main",
  "url": "https://github.com/hashicorp/terraform-provider-aws",
  "apiUrl": "https://api.github.com/repos/hashicorp/terraform-provider-aws"
}
```

## Security and Performance Configuration

This tool interacts with GitHub APIs to fetch Terraform provider documentation and schemas. To enhance security and improve performance, you can configure the following environment variables:

### GitHub Authentication

It's recommended to configure a GitHub token to increase API rate limits and avoid throttling:

```bash
export GITHUB_TOKEN=your_github_token
```

To create a GitHub token, visit: https://github.com/settings/tokens

### Rate Limiting

Configure the maximum number of GitHub API requests per minute:

```bash
export GITHUB_REQUESTS_PER_MINUTE=60
```

### Retry Configuration

Set the maximum number of retries and delay between retries:

```bash
export GITHUB_MAX_RETRIES=3
export GITHUB_RETRY_DELAY=1000 # milliseconds
```

### Caching

Enable or disable response caching:

```bash
export CACHE_ENABLED=true
export CACHE_TTL=3600000 # Cache time-to-live in milliseconds (1 hour)
export CACHE_MAX_SIZE=100 # Maximum number of items in cache
```

### Logging Level

Configure the logging verbosity:

```bash
export LOG_LEVEL=info # Options: error, warn, info, debug
```

## Example Terraform Configurations

### AWS S3 Bucket with Versioning

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
      Project = "example-project"
      Environment = "dev"
      ManagedBy = "terraform"
    }
  }
}

locals {
  # Format consistent bucket name with environment
  bucket_name = "example-bucket-${var.environment}"
  
  # Common tags that will be applied to all resources
  common_tags = {
    Environment = var.environment
    Project     = "example-project"
    ManagedBy   = "terraform"
  }
}

resource "aws_s3_bucket" "s3_bucket_example" {
  # Required attributes
  bucket = "example-bucket-12345"
  
  # Optional attributes
  # The canned ACL to apply
  acl = "private"
  
  # A state of versioning
  versioning {
    enabled = true
  }
  
  # Tags to assign to the resource
  tags = {
    Name = "example-bucket"
    Environment = "dev"
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

### GCP Compute Instance

```hcl
# Terraform configuration for google_compute_instance
# Generated with terraform-docs-mcp

terraform {
  required_version = ">= 1.0.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 4.0.0"
    }
  }
}

provider "google" {
  project = "my-project-id"
  region  = "us-central1"
}

resource "google_compute_instance" "compute_instance_example" {
  # Required attributes
  name = "example-instance"
  machine_type = "e2-medium"
  zone = "us-central1-a"
  
  # Boot disk for the instance
  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-11"
    }
  }
  
  # Networks to attach to the instance
  network_interface {
    network = "default"
    
    access_config {
      // Ephemeral IP
    }
  }
  
  # Optional attributes
  # Tags to assign to the resource
  tags = ["web", "dev"]
  
  # Lifecycle configuration
  lifecycle {
    create_before_destroy = true
  }
}

# Resource outputs
output "compute_instance_example_id" {
  description = "The ID of the created resource"
  value       = google_compute_instance.compute_instance_example.id
}
```

### Azure Virtual Machine

```hcl
# Terraform configuration for azurerm_virtual_machine
# Generated with terraform-docs-mcp

terraform {
  required_version = ">= 1.0.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = ">= 3.0.0"
    }
  }
}

provider "azurerm" {
  features {}
}

resource "azurerm_virtual_machine" "virtual_machine_example" {
  # Required attributes
  name                  = "example-vm"
  location              = "East US"
  resource_group_name   = "example-resources"
  vm_size               = "Standard_DS1_v2"
  network_interface_ids = ["${azurerm_network_interface.example.id}"]

  # Storage image reference
  storage_image_reference {
    publisher = "Canonical"
    offer     = "UbuntuServer"
    sku       = "16.04-LTS"
    version   = "latest"
  }
  
  # OS disk configuration
  storage_os_disk {
    name              = "myosdisk1"
    caching           = "ReadWrite"
    create_option     = "FromImage"
    managed_disk_type = "Standard_LRS"
  }
  
  # OS profile
  os_profile {
    computer_name  = "hostname"
    admin_username = "adminuser"
    admin_password = "Password1234!"
  }
  
  # Optional attributes
  # Tags to assign to the resource
  tags = {
    environment = "staging"
  }
  
  # Lifecycle configuration
  lifecycle {
    create_before_destroy = true
  }
  
  # Resource dependencies
  depends_on = [
    azurerm_network_interface.example,
    azurerm_resource_group.example,
  ]
}

# Resource outputs
output "virtual_machine_example_id" {
  description = "The ID of the virtual machine"
  value       = azurerm_virtual_machine.virtual_machine_example.id
}
```

## Error Handling

The application provides detailed error messages for troubleshooting:

- `GitHubApiError`: Issues with GitHub API requests, including rate limiting
- `SchemaParsingError`: Problems extracting or parsing Terraform resource schemas
- `ConfigGenerationError`: Errors generating Terraform configurations
- `ResourceNotFoundError`: Requested resource could not be found
- `ProviderNotFoundError`: Requested provider could not be found

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start the server
npm start
```

## Best Practices

When using this tool:

1. Configure a GitHub token for increased API rate limits
2. Use caching to improve performance and reduce API calls
3. Provide specific resource attributes when generating configurations
4. Enable GitHub integration for better schema extraction
5. Use the appropriate tool for your needs (schema, docs, or config generation)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT