/**
 * Server assembly, separate from the stdio entry point so tests can drive the
 * real tool surface over an in-memory transport.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { registerCalendarTools } from './calendar/index.js';
import { registerReminderTools } from './reminders/index.js';
import { registerNoteTools } from './notes/index.js';
import { registerMessageTools } from './messages/index.js';
import { registerContactTools } from './contacts/index.js';

export function createServer(): McpServer {
  const server = new McpServer(
    {
      name: 'macos-mcp',
      version: '1.0.0',
      description: 'Unified MCP server for macOS Calendar, Reminders, Notes, Messages, and Contacts',
    },
    {
      instructions: 'When passing dates/times, use local time by default (e.g. "2026-03-20 09:00:00") without timezone offsets. Only include timezone information if the user explicitly specifies one.',
    },
  );

  registerCalendarTools(server);
  registerReminderTools(server);
  registerNoteTools(server);
  registerMessageTools(server);
  registerContactTools(server);

  return server;
}
