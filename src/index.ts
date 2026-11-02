#!/usr/bin/env node
/**
 * macOS MCP Server
 * Unified MCP server for macOS Calendar, Reminders, and Notes
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createServer } from './server.js';

const server = createServer();

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('macOS MCP server started');
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
