#!/usr/bin/env node
/**
 * macOS MCP Server
 * Unified MCP server for macOS Calendar, Reminders, and Notes
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { registerCalendarTools } from './calendar/index.js';
import { registerReminderTools } from './reminders/index.js';
import { registerNoteTools } from './notes/index.js';
import { registerMessageTools } from './messages/index.js';

// Create MCP server
const server = new McpServer(
  {
    name: 'macos-mcp',
    version: '1.0.0',
    description: 'Unified MCP server for macOS Calendar, Reminders, Notes, and Messages',
  },
  {
    instructions: 'When passing dates/times, use local time by default (e.g. "2026-03-20 09:00:00") without timezone offsets. Only include timezone information if the user explicitly specifies one.',
  },
);

// Register all tools
registerCalendarTools(server);
registerReminderTools(server);
registerNoteTools(server);
registerMessageTools(server);

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
