/**
 * Calendar Service
 * Business logic for calendar operations via Swift CLI
 */

import { executeCli } from '../utils/eventkit-cli.js';
import type { Calendar, CalendarEvent, DeleteResult, EventsReadResult } from './types.js';

/**
 * Adds optional arguments to a CLI args array.
 * Handles both truthy string values and explicit boolean/undefined checks.
 */
function addOptionalArgs(
  args: string[],
  options: Record<string, string | boolean | undefined>,
  mapping: Record<string, string>
): void {
  for (const [key, flag] of Object.entries(mapping)) {
    const value = options[key];
    if (value !== undefined) {
      args.push(flag, String(value));
    }
  }
}

export class CalendarService {
  async listCalendars(): Promise<Calendar[]> {
    return executeCli<Calendar[]>(['--action', 'read-calendars']);
  }

  async listEvents(options?: {
    filterCalendar?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<EventsReadResult> {
    const args = ['--action', 'read-events'];
    if (options) {
      addOptionalArgs(args, options, {
        filterCalendar: '--filterCalendar',
        search: '--search',
        startDate: '--startDate',
        endDate: '--endDate',
      });
    }
    return executeCli<EventsReadResult>(args);
  }

  async getEvent(id: string): Promise<CalendarEvent> {
    return executeCli<CalendarEvent>(['--action', 'get-event', '--id', id]);
  }

  async createEvent(options: {
    title: string;
    startDate: string;
    endDate: string;
    targetCalendar?: string;
    notes?: string;
    location?: string;
    url?: string;
    isAllDay?: boolean;
  }): Promise<CalendarEvent> {
    const args = [
      '--action', 'create-event',
      '--title', options.title,
      '--startDate', options.startDate,
      '--endDate', options.endDate,
    ];
    addOptionalArgs(args, options, {
      targetCalendar: '--targetCalendar',
      notes: '--note',
      location: '--location',
      url: '--url',
      isAllDay: '--isAllDay',
    });
    return executeCli<CalendarEvent>(args);
  }

  async updateEvent(
    id: string,
    updates: {
      title?: string;
      startDate?: string;
      endDate?: string;
      targetCalendar?: string;
      notes?: string;
      location?: string;
      url?: string;
      isAllDay?: boolean;
    }
  ): Promise<CalendarEvent> {
    const args = ['--action', 'update-event', '--id', id];
    addOptionalArgs(args, updates, {
      title: '--title',
      startDate: '--startDate',
      endDate: '--endDate',
      targetCalendar: '--targetCalendar',
      notes: '--note',
      location: '--location',
      url: '--url',
      isAllDay: '--isAllDay',
    });
    return executeCli<CalendarEvent>(args);
  }

  async deleteEvent(id: string): Promise<DeleteResult> {
    return executeCli<DeleteResult>(['--action', 'delete-event', '--id', id]);
  }
}
