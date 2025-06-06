{
  "name": "terraform-docs-mcp",
  "version": "0.1.0",
  "description": "MCP server for Terraform documentation and configuration generation",
  "main": "dist/index.js",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "postbuild": "chmod +x dist/index.js",
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts",
    "dev:nodemon": "nodemon --exec tsx src/index.ts",
    "clean": "rm -rf dist",
    "lint": "eslint src/**/*.ts",
    "lint:fix": "eslint src/**/*.ts --fix",
    "format": "prettier --write src/**/*.ts",
    "format:check": "prettier --check src/**/*.ts",
    "test": "jest --config jest.config.cjs",
    "test:watch": "jest --config jest.config.cjs --watch",
    "test:coverage": "jest --config jest.config.cjs --coverage",
    "test:ci": "jest --config jest.config.cjs --ci --coverage --watchAll=false",
    "test:verbose": "jest --config jest.config.cjs --verbose",
    "docker:build": "docker build -t terraform-docs-mcp .",
    "docker:build-dev": "docker build -f Dockerfile.dev -t terraform-docs-mcp:dev .",
    "docker:run": "docker-compose up -d",
    "docker:run-dev": "docker-compose -f docker-compose.dev.yml up",
    "docker:stop": "docker-compose down",
    "docker:logs": "docker-compose logs -f",
    "docker:clean": "docker-compose down && docker rmi terraform-docs-mcp:latest terraform-docs-mcp:dev 2>/dev/null || true"
  },
  "bin": {
    "terraform-docs-mcp": "./dist/index.js"
  },
  "files": [
    "dist"
  ],
  "dependencies": {
    "@modelcontextprotocol/sdk": "0.6.0",
    "axios": "^1.6.5",
    "cheerio": "^1.0.0-rc.12",
    "node-fetch": "^2.7.0",
    "stream-browserify": "^3.0.0",
    "web-streams-polyfill": "^3.3.3"
  },
  "devDependencies": {
    "@types/node": "^20.11.24",
    "@types/node-fetch": "^2.6.12",
    "@types/jest": "^29.5.12",
    "@typescript-eslint/eslint-plugin": "^6.21.0",
    "@typescript-eslint/parser": "^6.21.0",
    "eslint": "^8.56.0",
    "eslint-config-prettier": "^9.1.0",
    "eslint-plugin-prettier": "^5.1.3",
    "jest": "^29.7.0",
    "jest-environment-node": "^29.7.0",
    "nodemon": "^3.0.3",
    "prettier": "^3.2.5",
    "ts-jest": "^29.1.2",
    "tsx": "^4.7.1",
    "typescript": "^5.3.3"
  },
  "engines": {
    "node": ">=16.0.0"
  },
  "keywords": [
    "terraform",
    "mcp",
    "model-context-protocol",
    "documentation",
    "configuration",
    "infrastructure",
    "docker"
  ],
  "author": "Littleworks Inc",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/littleworks-inc/terraform-docs-mcp.git"
  },
  "bugs": {
    "url": "https://github.com/littleworks-inc/terraform-docs-mcp/issues"
  },
  "homepage": "https://github.com/littleworks-inc/terraform-docs-mcp#readme"
}