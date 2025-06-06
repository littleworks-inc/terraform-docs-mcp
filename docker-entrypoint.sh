#!/bin/bash
set -e

# Docker entrypoint script for Terraform MCP Server
# This script handles initialization and graceful startup

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

# Function to check if the application is ready
check_app_ready() {
    if [ -f "/app/dist/index.js" ]; then
        return 0
    else
        return 1
    fi
}

# Function to handle graceful shutdown
graceful_shutdown() {
    log "Received shutdown signal, shutting down gracefully..."
    if [ ! -z "$APP_PID" ]; then
        kill -TERM "$APP_PID" 2>/dev/null || true
        wait "$APP_PID" 2>/dev/null || true
    fi
    log "Shutdown complete"
    exit 0
}

# Set up signal handlers
trap graceful_shutdown SIGTERM SIGINT

# Main initialization
main() {
    log "Starting Terraform MCP Server..."
    
    # Check if application files exist
    if ! check_app_ready; then
        error "Application files not found in /app/dist/"
        exit 1
    fi
    
    # Set default environment if not specified
    export NODE_ENV=${NODE_ENV:-production}
    log "Environment: $NODE_ENV"
    
    # If no arguments provided, run the default application
    if [ $# -eq 0 ]; then
        log "Starting MCP server with default configuration"
        exec node /app/dist/index.js
    else
        # Execute the provided command
        log "Executing custom command: $*"
        exec "$@"
    fi
}

# Run main function with all arguments
main "$@"