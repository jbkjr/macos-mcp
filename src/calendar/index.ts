/**
 * Calendar Module
 * Exports and tool registration for calendar functionality
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { wrapToolHandler } from '../utils/mcp-helpers.js';
import { CalendarService } from './service.js';
import {
  listCalendarsSchema,
  listCalendarEventsSchema,
  getCalendarEventSchema,
  createCalendarEventSchema,
  updateCalendarEventSchema,
  deleteCalendarEventSchema,
} from './tools.js';

export { CalendarService } from './service.js';
export * from './types.js';
export * from './tools.js';

/**
 * Register calendar tools with the MCP server
 */
export function registerCalendarTools(server: McpServer): void {
  const service = new CalendarService();

  server.tool(
    'list_calendars',
    'List all available calendars',
    listCalendarsSchema.shape,
    wrapToolHandler(async () => service.listCalendars())
  );

  server.tool(
    'list_calendar_events',
    'List calendar events with optional filters (calendar, search, date range)',
    listCalendarEventsSchema.shape,
    wrapToolHandler(async (params) => service.listEvents(params))
  );

  server.tool(
    'get_calendar_event',
    'Get a single calendar event by ID',
    getCalendarEventSchema.shape,
    wrapToolHandler(async (params) => service.getEvent(params.id))
  );

  server.tool(
    'create_calendar_event',
    'Create a new calendar event',
    createCalendarEventSchema.shape,
    wrapToolHandler(async (params) => service.createEvent(params))
  );

  server.tool(
    'update_calendar_event',
    'Update an existing calendar event',
    updateCalendarEventSchema.shape,
    wrapToolHandler(async (params) => {
      const { id, ...updates } = params;
      return service.updateEvent(id, updates);
    })
  );

  server.tool(
    'delete_calendar_event',
    'Delete a calendar event by ID',
    deleteCalendarEventSchema.shape,
    wrapToolHandler(async (params) => service.deleteEvent(params.id))
  );
}
