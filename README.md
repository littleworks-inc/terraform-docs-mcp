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

## Available Tools

The MCP server provides the following tools:

### terraform_provider_docs

Retrieves documentation for a Terraform provider and its resources.

**Input parameters:**
- `provider` (required): The name of the provider (e.g., aws, azure, gcp)
- `resource` (optional): The specific resource to get documentation for

**Example request:**
```json
{
  "provider": "aws",
  "resource": "s3_bucket"
}
```

**Example response:**
```json
{
  "documentation": "...(documentation content)...",
  "examples": ["...(example code)..."],
  "url": "https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket"
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
  }
}
```

**Example response:**
```
# Terraform configuration for aws_instance

provider "aws" {
  region = "us-west-2"
}

resource "aws_instance" "instance_example" {
  ami = "example-id"
  instance_type = "t2.micro"
  
  tags = {
    Name = "web-server"
    Environment = "production"
  }
  
  # Example lifecycle block
  lifecycle {
    create_before_destroy = true
  }
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

**Example request:**
```json
{
  "provider": "aws",
  "resource": "s3_bucket"
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
    }
  }
}
```

**Example usage:**
```
# Ask the AI assistant
What attributes are available for an AWS S3 bucket in Terraform?
```

## Example Terraform Configurations

### AWS S3 Bucket with Versioning

```hcl
# Terraform configuration for aws_s3_bucket

provider "aws" {
  region = "us-west-2"
}

resource "aws_s3_bucket" "s3_bucket_example" {
  bucket = "example-bucket-name"
  
  versioning {
    enabled = true
  }
  
  tags = {
    Name = "example-bucket"
    Environment = "dev"
  }
}
```

### GCP Compute Instance

```hcl
# Terraform configuration for gcp_compute_instance

provider "gcp" {
  project = "my-project-id"
}

resource "gcp_compute_instance" "compute_instance_example" {
  name = "example-instance"
  machine_type = "e2-medium"
  zone = "us-central1-a"
  
  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-10"
    }
  }
  
  network_interface {
    network = "default"
    access_config {
      // Ephemeral IP
    }
  }
  
  tags = ["web", "dev"]
}
```

### Azure Virtual Machine

```hcl
# Terraform configuration for azure_virtual_machine

provider "azure" {
  features {}
}

resource "azure_virtual_machine" "virtual_machine_example" {
  name                  = "example-vm"
  location              = "East US"
  resource_group_name   = "example-resources"
  network_interface_ids = ["${azure_network_interface.example.id}"]
  vm_size               = "Standard_DS1_v2"

  storage_image_reference {
    publisher = "Canonical"
    offer     = "UbuntuServer"
    sku       = "16.04-LTS"
    version   = "latest"
  }
  
  storage_os_disk {
    name              = "myosdisk1"
    caching           = "ReadWrite"
    create_option     = "FromImage"
    managed_disk_type = "Standard_LRS"
  }
  
  os_profile {
    computer_name  = "hostname"
    admin_username = "adminuser"
    admin_password = "Password1234!"
  }
  
  tags = {
    environment = "staging"
  }
}
```

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start the server
npm start
```

## License

MIT