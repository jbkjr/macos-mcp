/**
 * Reminders Module
 * Exports and tool registration for reminders functionality
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { wrapToolHandler } from '../utils/mcp-helpers.js';
import { RemindersService } from './service.js';
import {
  listReminderListsSchema,
  createReminderListSchema,
  renameReminderListSchema,
  deleteReminderListSchema,
  listRemindersSchema,
  getReminderSchema,
  createReminderSchema,
  updateReminderSchema,
  deleteReminderSchema,
} from './tools.js';
import type { DueWithinOption, ReminderPriority } from './types.js';

export { RemindersService } from './service.js';
export * from './types.js';
export * from './tools.js';

/**
 * Register reminder tools with the MCP server
 */
export function registerReminderTools(server: McpServer): void {
  const service = new RemindersService();

  // List tools
  server.registerTool(
    'list_reminder_lists',
    {
      description: 'List all reminder lists',
      inputSchema: listReminderListsSchema,
    },
    wrapToolHandler(async () => service.listLists())
  );

  server.registerTool(
    'create_reminder_list',
    {
      description: 'Create a new reminder list',
      inputSchema: createReminderListSchema,
    },
    wrapToolHandler(async (params) => service.createList(params.name))
  );

  server.registerTool(
    'rename_reminder_list',
    {
      description: 'Rename an existing reminder list',
      inputSchema: renameReminderListSchema,
    },
    wrapToolHandler(async (params) => service.renameList(params.name, params.newName))
  );

  server.registerTool(
    'delete_reminder_list',
    {
      description: 'Delete a reminder list',
      inputSchema: deleteReminderListSchema,
    },
    wrapToolHandler(async (params) => service.deleteList(params.name))
  );

  // Reminder tools
  server.registerTool(
    'list_reminders',
    {
      description: 'List reminders with optional filters (list, search, due date range, priority)',
      inputSchema: listRemindersSchema,
    },
    wrapToolHandler(async (params) => {
      return service.listReminders({
        ...params,
        dueWithin: params.dueWithin as DueWithinOption | undefined,
        priority: params.priority as ReminderPriority | undefined,
      });
    })
  );

  server.registerTool(
    'get_reminder',
    {
      description: 'Get a single reminder by ID',
      inputSchema: getReminderSchema,
    },
    wrapToolHandler(async (params) => service.getReminder(params.id))
  );

  server.registerTool(
    'create_reminder',
    {
      description: 'Create a new reminder',
      inputSchema: createReminderSchema,
    },
    wrapToolHandler(async (params) => service.createReminder(params))
  );

  server.registerTool(
    'update_reminder',
    {
      description: 'Update an existing reminder',
      inputSchema: updateReminderSchema,
    },
    wrapToolHandler(async (params) => {
      const { id, ...updates } = params;
      return service.updateReminder(id, updates);
    })
  );

  server.registerTool(
    'delete_reminder',
    {
      description: 'Delete a reminder by ID',
      inputSchema: deleteReminderSchema,
    },
    wrapToolHandler(async (params) => service.deleteReminder(params.id))
  );
}
