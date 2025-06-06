#!/bin/bash

# Test script for Terraform Docs MCP Server
# Make sure the development container is running: make run-dev-simple

set -e

CONTAINER_NAME="terraform-mcp-dev-simple"
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🧪 Testing Terraform Docs MCP Server${NC}"
echo "Container: $CONTAINER_NAME"
echo ""

# Function to test MCP command
test_mcp_command() {
    local test_name="$1"
    local command="$2"
    
    echo -e "${YELLOW}Testing: $test_name${NC}"
    echo "Command: $command"
    echo ""
    
    # Try with built version first, fallback to tsx with source
    if echo "$command" | docker exec -i "$CONTAINER_NAME" node dist/index.js 2>/dev/null; then
        echo -e "${GREEN}✅ Test passed (using built version)${NC}"
    elif echo "$command" | docker exec -i "$CONTAINER_NAME" npx tsx src/index.ts 2>/dev/null; then
        echo -e "${GREEN}✅ Test passed (using tsx)${NC}"
    else
        echo -e "${RED}❌ Test failed${NC}"
        echo "Trying to build first..."
        docker exec "$CONTAINER_NAME" npm run build 2>/dev/null || true
        if echo "$command" | docker exec -i "$CONTAINER_NAME" node dist/index.js 2>/dev/null; then
            echo -e "${GREEN}✅ Test passed after build${NC}"
        else
            echo -e "${RED}❌ Test still failed${NC}"
        fi
    fi
    echo ""
    echo "----------------------------------------"
    echo ""
}

# Check if container is running
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    echo -e "${RED}❌ Container $CONTAINER_NAME is not running${NC}"
    echo "Please run: make run-dev-simple"
    exit 1
fi

echo -e "${GREEN}✅ Container is running${NC}"
echo ""

# Test 1: Initialize MCP connection
test_mcp_command "MCP Initialize" \
'{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "test-client", "version": "1.0.0"}}}'

# Test 2: List available tools
test_mcp_command "List Tools" \
'{"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}}'

# Test 3: Get AWS provider documentation
test_mcp_command "AWS Provider Docs" \
'{"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "terraform_provider_docs", "arguments": {"provider": "aws"}}}'

# Test 4: Get specific resource documentation
test_mcp_command "AWS S3 Bucket Docs" \
'{"jsonrpc": "2.0", "id": 4, "method": "tools/call", "params": {"name": "terraform_provider_docs", "arguments": {"provider": "aws", "resource": "s3_bucket"}}}'

# Test 5: Generate simple configuration
test_mcp_command "Generate AWS Instance Config" \
'{"jsonrpc": "2.0", "id": 5, "method": "tools/call", "params": {"name": "terraform_generate_config", "arguments": {"provider": "aws", "resource": "instance", "attributes": {"instance_type": "t3.micro"}}}}'

# Test 6: Generate configuration with tags
test_mcp_command "Generate AWS Instance with Tags" \
'{"jsonrpc": "2.0", "id": 6, "method": "tools/call", "params": {"name": "terraform_generate_config", "arguments": {"provider": "aws", "resource": "instance", "attributes": {"instance_type": "t3.micro", "tags": {"Name": "test-server", "Environment": "dev"}}}}}'

# Test 7: Get resource schema
test_mcp_command "Get AWS S3 Schema" \
'{"jsonrpc": "2.0", "id": 7, "method": "tools/call", "params": {"name": "terraform_resource_schema", "arguments": {"provider": "aws", "resource": "s3_bucket"}}}'

# Test 8: Test Google Cloud provider
test_mcp_command "Generate GCP Instance Config" \
'{"jsonrpc": "2.0", "id": 8, "method": "tools/call", "params": {"name": "terraform_generate_config", "arguments": {"provider": "gcp", "resource": "compute_instance", "attributes": {"machine_type": "e2-medium", "zone": "us-central1-a"}}}}'

# Test 9: Test Azure provider
test_mcp_command "Generate Azure VM Config" \
'{"jsonrpc": "2.0", "id": 9, "method": "tools/call", "params": {"name": "terraform_generate_config", "arguments": {"provider": "azurerm", "resource": "virtual_machine", "attributes": {"vm_size": "Standard_DS1_v2", "location": "East US"}}}}'

# Test 10: Get GitHub info for provider
test_mcp_command "Get GitHub Info for AWS Provider" \
'{"jsonrpc": "2.0", "id": 10, "method": "tools/call", "params": {"name": "terraform_github_info", "arguments": {"provider": "aws"}}}'

echo -e "${GREEN}🎉 All tests completed!${NC}"
echo ""
echo "To run individual tests, you can use commands like:"
echo "echo '{\"jsonrpc\": \"2.0\", \"id\": 1, \"method\": \"tools/list\", \"params\": {}}' | docker exec -i $CONTAINER_NAME node dist/index.js"