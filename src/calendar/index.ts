/**
 * Calendar Module
 * Exports and tool registration for calendar functionality
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { wrapToolHandler } from '../utils/mcp-helpers.js';
import { CalendarService } from './service.js';
import { guardedCalendarCreateEventSchema, guardedCalendarRescheduleEventSchema, guardedCalendarUpdateEventSchema } from './guarded.js';
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

  // Full strict objects keep the SDK from silently stripping unknown fields.
  server.registerTool('guarded_calendar_create_event', {
    description: 'Save one guest-free, non-recurring event on an allowlisted calendar. All-day dates float and end is exclusive.',
    inputSchema: guardedCalendarCreateEventSchema,
  }, wrapToolHandler((params) => service.guardedCreateEvent(params)));
  server.registerTool('guarded_calendar_reschedule_event', {
    description: 'Replace start, end and time zone of one eligible event, preserving its calendar and all-day kind.',
    inputSchema: guardedCalendarRescheduleEventSchema,
  }, wrapToolHandler((params) => service.guardedRescheduleEvent(params)));
  server.registerTool('guarded_calendar_update_event', {
    description: 'Replace title, notes or location of one eligible event. Empty notes/location clears; omission preserves.',
    inputSchema: guardedCalendarUpdateEventSchema,
  }, wrapToolHandler((params) => service.guardedUpdateEvent(params)));

  server.registerTool(
    'list_calendars',
    {
      description: 'List all available calendars',
      inputSchema: listCalendarsSchema,
    },
    wrapToolHandler(async () => service.listCalendars())
  );

  server.registerTool(
    'list_calendar_events',
    {
      description: 'List calendar events with optional filters (calendar, search, date range)',
      inputSchema: listCalendarEventsSchema,
    },
    wrapToolHandler(async (params) => service.listEvents(params))
  );

  server.registerTool(
    'get_calendar_event',
    {
      description: 'Get a single calendar event by ID',
      inputSchema: getCalendarEventSchema,
    },
    wrapToolHandler(async (params) => service.getEvent(params.id))
  );

  server.registerTool(
    'create_calendar_event',
    {
      description: 'Create a new calendar event',
      inputSchema: createCalendarEventSchema,
    },
    wrapToolHandler(async (params) => service.createEvent(params))
  );

  server.registerTool(
    'update_calendar_event',
    {
      description: 'Update an existing calendar event',
      inputSchema: updateCalendarEventSchema,
    },
    wrapToolHandler(async (params) => {
      const { id, ...updates } = params;
      return service.updateEvent(id, updates);
    })
  );

  server.registerTool(
    'delete_calendar_event',
    {
      description: 'Delete a calendar event by ID',
      inputSchema: deleteCalendarEventSchema,
    },
    wrapToolHandler(async (params) => service.deleteEvent(params.id))
  );
}
