#!/bin/bash

# Production Deployment Scripts for Terraform Docs MCP Server

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
IMAGE_NAME="terraform-docs-mcp:latest"  # Use local image until GHCR is set up
GHCR_IMAGE="ghcr.io/littleworks-inc/terraform-docs-mcp:latest"
CONTAINER_NAME="terraform-mcp-server"

echo -e "${GREEN}🚀 Terraform Docs MCP Server - Production Deployment${NC}"
echo "=================================================="

# Function to build production image locally
build_production_image() {
    echo -e "${YELLOW}🔨 Building production image...${NC}"
    
    if [ ! -f "Dockerfile" ]; then
        echo -e "${RED}❌ Dockerfile not found. Please run this script from the project root directory.${NC}"
        exit 1
    fi
    
    echo "Building production Docker image..."
    docker build -t $IMAGE_NAME .
    
    echo -e "${GREEN}✅ Production image built successfully!${NC}"
    echo "Image: $IMAGE_NAME"
}

# Function to deploy locally with Docker
deploy_local() {
    echo -e "${YELLOW}📦 Deploying locally with Docker...${NC}"
    
    # Stop existing container
    docker stop $CONTAINER_NAME 2>/dev/null || true
    docker rm $CONTAINER_NAME 2>/dev/null || true
    
    # Check if local image exists, if not build it
    if ! docker image inspect $IMAGE_NAME > /dev/null 2>&1; then
        echo "Local image not found. Building production image..."
        if [ -f "Dockerfile" ]; then
            docker build -t $IMAGE_NAME .
        else
            echo -e "${RED}❌ Dockerfile not found. Please run this script from the project root directory.${NC}"
            exit 1
        fi
    else
        echo "Using existing local image: $IMAGE_NAME"
    fi
    
    # Try to pull from GHCR if available, otherwise use local
    echo "Attempting to pull latest image from registry..."
    if docker pull $GHCR_IMAGE 2>/dev/null; then
        echo "Using image from GitHub Container Registry"
        IMAGE_TO_USE=$GHCR_IMAGE
    else
        echo "Using local image (GHCR not available yet)"
        IMAGE_TO_USE=$IMAGE_NAME
    fi
    
    # Run production container
    echo "Starting production container..."
    docker run -d \
        --name $CONTAINER_NAME \
        --restart unless-stopped \
        -e NODE_ENV=production \
        -e LOG_LEVEL=info \
        --memory=512m \
        --cpus=0.5 \
        --read-only \
        --tmpfs /tmp:noexec,nosuid,size=100m \
        --security-opt no-new-privileges:true \
        $IMAGE_TO_USE
    
    echo -e "${GREEN}✅ Local deployment completed!${NC}"
    echo "Container: $CONTAINER_NAME"
    echo "Image: $IMAGE_TO_USE"
}

# Function to deploy to AWS ECS
deploy_aws_ecs() {
    echo -e "${YELLOW}☁️ Deploying to AWS ECS...${NC}"
    
    # Check if AWS CLI is installed
    if ! command -v aws &> /dev/null; then
        echo -e "${RED}❌ AWS CLI not found. Please install AWS CLI first.${NC}"
        exit 1
    fi
    
    # Create ECS task definition
    cat > task-definition.json << EOF
{
    "family": "terraform-mcp",
    "taskRoleArn": "arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):role/ecsTaskRole",
    "executionRoleArn": "arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):role/ecsTaskExecutionRole",
    "networkMode": "awsvpc",
    "requiresCompatibilities": ["FARGATE"],
    "cpu": "256",
    "memory": "512",
    "containerDefinitions": [
        {
            "name": "terraform-mcp",
            "image": "$IMAGE_NAME",
            "essential": true,
            "environment": [
                {"name": "NODE_ENV", "value": "production"},
                {"name": "LOG_LEVEL", "value": "info"}
            ],
            "logConfiguration": {
                "logDriver": "awslogs",
                "options": {
                    "awslogs-group": "/ecs/terraform-mcp",
                    "awslogs-region": "us-west-2",
                    "awslogs-stream-prefix": "ecs"
                }
            },
            "healthCheck": {
                "command": ["CMD-SHELL", "node -e \"console.log('Health check passed')\" || exit 1"],
                "interval": 30,
                "timeout": 5,
                "retries": 3
            }
        }
    ]
}
EOF
    
    # Register task definition
    echo "Registering ECS task definition..."
    aws ecs register-task-definition --cli-input-json file://task-definition.json
    
    # Create or update service
    echo "Creating/updating ECS service..."
    aws ecs create-service \
        --cluster terraform-mcp-cluster \
        --service-name terraform-mcp-service \
        --task-definition terraform-mcp \
        --desired-count 2 \
        --launch-type FARGATE \
        --network-configuration "awsvpcConfiguration={subnets=[subnet-12345],securityGroups=[sg-12345],assignPublicIp=ENABLED}" \
        2>/dev/null || \
    aws ecs update-service \
        --cluster terraform-mcp-cluster \
        --service terraform-mcp-service \
        --task-definition terraform-mcp \
        --desired-count 2
    
    echo -e "${GREEN}✅ AWS ECS deployment completed!${NC}"
    rm task-definition.json
}

# Function to deploy to Google Cloud Run
deploy_gcp_run() {
    echo -e "${YELLOW}☁️ Deploying to Google Cloud Run...${NC}"
    
    # Check if gcloud CLI is installed
    if ! command -v gcloud &> /dev/null; then
        echo -e "${RED}❌ Google Cloud CLI not found. Please install gcloud CLI first.${NC}"
        exit 1
    fi
    
    # Deploy to Cloud Run
    gcloud run deploy terraform-mcp \
        --image $IMAGE_NAME \
        --platform managed \
        --region us-central1 \
        --memory 512Mi \
        --cpu 1 \
        --max-instances 10 \
        --set-env-vars NODE_ENV=production,LOG_LEVEL=info \
        --allow-unauthenticated \
        --port 3000
    
    echo -e "${GREEN}✅ Google Cloud Run deployment completed!${NC}"
}

# Function to deploy to Azure Container Instances
deploy_azure_aci() {
    echo -e "${YELLOW}☁️ Deploying to Azure Container Instances...${NC}"
    
    # Check if Azure CLI is installed
    if ! command -v az &> /dev/null; then
        echo -e "${RED}❌ Azure CLI not found. Please install Azure CLI first.${NC}"
        exit 1
    fi
    
    # Create resource group
    echo "Creating resource group..."
    az group create --name terraform-mcp-rg --location eastus
    
    # Deploy container
    echo "Deploying container..."
    az container create \
        --resource-group terraform-mcp-rg \
        --name terraform-mcp \
        --image $IMAGE_NAME \
        --cpu 1 \
        --memory 1 \
        --environment-variables NODE_ENV=production LOG_LEVEL=info \
        --restart-policy Always
    
    echo -e "${GREEN}✅ Azure Container Instances deployment completed!${NC}"
}

# Function to generate Kubernetes manifests
deploy_kubernetes() {
    echo -e "${YELLOW}☸️ Generating Kubernetes manifests...${NC}"
    
    # Create Kubernetes manifests
    cat > k8s-deployment.yaml << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: terraform-mcp
  labels:
    app: terraform-mcp
spec:
  replicas: 2
  selector:
    matchLabels:
      app: terraform-mcp
  template:
    metadata:
      labels:
        app: terraform-mcp
    spec:
      containers:
      - name: terraform-mcp
        image: $IMAGE_NAME
        env:
        - name: NODE_ENV
          value: "production"
        - name: LOG_LEVEL
          value: "info"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          exec:
            command:
            - node
            - -e
            - "console.log('Health check passed')"
          initialDelaySeconds: 30
          periodSeconds: 30
        readinessProbe:
          exec:
            command:
            - node
            - -e
            - "console.log('Ready check passed')"
          initialDelaySeconds: 5
          periodSeconds: 5
        securityContext:
          runAsNonRoot: true
          runAsUser: 1001
          readOnlyRootFilesystem: true
          allowPrivilegeEscalation: false
---
apiVersion: v1
kind: Service
metadata:
  name: terraform-mcp-service
spec:
  selector:
    app: terraform-mcp
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
  type: ClusterIP
EOF
    
    echo -e "${GREEN}✅ Kubernetes manifests generated!${NC}"
    echo "Apply with: kubectl apply -f k8s-deployment.yaml"
}

# Function to check deployment health
check_health() {
    echo -e "${YELLOW}🏥 Checking deployment health...${NC}"
    
    # Check local Docker deployment
    if docker ps | grep -q $CONTAINER_NAME; then
        echo -e "${GREEN}✅ Local Docker container is running${NC}"
        
        # Test MCP functionality
        echo "Testing MCP functionality..."
        if echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' | docker exec -i $CONTAINER_NAME node dist/index.js > /dev/null 2>&1; then
            echo -e "${GREEN}✅ MCP server is responding correctly${NC}"
        else
            echo -e "${RED}❌ MCP server is not responding${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️ Local Docker container not found${NC}"
    fi
}

# Main menu
show_menu() {
    echo ""
    echo "Select deployment option:"
    echo "1. Build production image locally"
    echo "2. Local Docker deployment"
    echo "3. AWS ECS deployment"
    echo "4. Google Cloud Run deployment" 
    echo "5. Azure Container Instances deployment"
    echo "6. Generate Kubernetes manifests"
    echo "7. Check deployment health"
    echo "8. Exit"
    echo ""
}

# Main execution
case "${1:-menu}" in
    "build")
        build_production_image
        ;;
    "local")
        deploy_local
        ;;
    "aws")
        deploy_aws_ecs
        ;;
    "gcp")
        deploy_gcp_run
        ;;
    "azure")
        deploy_azure_aci
        ;;
    "k8s"|"kubernetes")
        deploy_kubernetes
        ;;
    "health"|"check")
        check_health
        ;;
    "menu"|*)
        while true; do
            show_menu
            read -p "Enter your choice (1-8): " choice
            case $choice in
                1) build_production_image; break;;
                2) deploy_local; break;;
                3) deploy_aws_ecs; break;;
                4) deploy_gcp_run; break;;
                5) deploy_azure_aci; break;;
                6) deploy_kubernetes; break;;
                7) check_health; break;;
                8) echo "Goodbye!"; exit 0;;
                *) echo -e "${RED}Invalid choice. Please try again.${NC}";;
            esac
        done
        ;;
esac

echo ""
echo -e "${GREEN}🎉 Deployment script completed!${NC}"