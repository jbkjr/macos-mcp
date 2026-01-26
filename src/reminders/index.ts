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
import type { DueWithinOption } from './types.js';

export { RemindersService } from './service.js';
export * from './types.js';
export * from './tools.js';

/**
 * Register reminder tools with the MCP server
 */
export function registerReminderTools(server: McpServer): void {
  const service = new RemindersService();

  // List tools
  server.tool(
    'list_reminder_lists',
    'List all reminder lists',
    listReminderListsSchema.shape,
    wrapToolHandler(async () => service.listLists())
  );

  server.tool(
    'create_reminder_list',
    'Create a new reminder list',
    createReminderListSchema.shape,
    wrapToolHandler(async (params) => service.createList(params.name))
  );

  server.tool(
    'rename_reminder_list',
    'Rename an existing reminder list',
    renameReminderListSchema.shape,
    wrapToolHandler(async (params) => service.renameList(params.name, params.newName))
  );

  server.tool(
    'delete_reminder_list',
    'Delete a reminder list',
    deleteReminderListSchema.shape,
    wrapToolHandler(async (params) => service.deleteList(params.name))
  );

  // Reminder tools
  server.tool(
    'list_reminders',
    'List reminders with optional filters (list, search, due date range)',
    listRemindersSchema.shape,
    wrapToolHandler(async (params) => {
      return service.listReminders({
        ...params,
        dueWithin: params.dueWithin as DueWithinOption | undefined,
      });
    })
  );

  server.tool(
    'get_reminder',
    'Get a single reminder by ID',
    getReminderSchema.shape,
    wrapToolHandler(async (params) => service.getReminder(params.id))
  );

  server.tool(
    'create_reminder',
    'Create a new reminder with optional recurrence (daily, weekly, monthly, yearly)',
    createReminderSchema.shape,
    wrapToolHandler(async (params) => service.createReminder(params))
  );

  server.tool(
    'update_reminder',
    'Update an existing reminder (title, notes, due date, completion status, recurrence). Set recurrence to null to remove.',
    updateReminderSchema.shape,
    wrapToolHandler(async (params) => {
      const { id, ...updates } = params;
      return service.updateReminder(id, updates);
    })
  );

  server.tool(
    'delete_reminder',
    'Delete a reminder by ID',
    deleteReminderSchema.shape,
    wrapToolHandler(async (params) => service.deleteReminder(params.id))
  );
}
