/**
 * Calendar Service
 * Business logic for calendar operations via Swift CLI
 */

import { guardedResultOrUnverified, parseGuardedCreate, parseGuardedReschedule, parseGuardedUpdate, unverifiedGuardedResult, type GuardedCalendarResult } from './guarded.js';
import { BRIDGE_NOT_INSTALLED, executeCli } from '../utils/eventkit-cli.js';
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

/**
 * Once the bridge may have launched, a lost or unreadable answer means the save may
 * have happened. That is `unverified`, never a plain error a caller might retry.
 */
async function runGuarded(action: string, request: { event_id?: string; calendar_id?: string }): Promise<GuardedCalendarResult> {
  const ids = { event_id: request.event_id ?? null, calendar_id: request.calendar_id ?? null };
  try {
    return guardedResultOrUnverified(await executeCli<unknown>(['--action', action, JSON.stringify(request)]), ids);
  } catch (error) {
    if ((error as { code?: string }).code === BRIDGE_NOT_INSTALLED) throw error;
    return unverifiedGuardedResult(ids);
  }
}

export class CalendarService {
  async guardedCreateEvent(input: unknown): Promise<GuardedCalendarResult> {
    return runGuarded('guarded-calendar-create-event', parseGuardedCreate(input));
  }
  async guardedRescheduleEvent(input: unknown): Promise<GuardedCalendarResult> {
    return runGuarded('guarded-calendar-reschedule-event', parseGuardedReschedule(input));
  }
  async guardedUpdateEvent(input: unknown): Promise<GuardedCalendarResult> {
    return runGuarded('guarded-calendar-update-event', parseGuardedUpdate(input));
  }

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
