/**
 * Calendar Types
 */

export interface Calendar {
  id: string;
  title: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  calendar: string;
  startDate: string;
  endDate: string;
  notes?: string;
  location?: string;
  url?: string;
  isAllDay: boolean;
}

export interface EventsReadResult {
  calendars: Calendar[];
  events: CalendarEvent[];
}

export interface DeleteResult {
  id: string;
  deleted: boolean;
}
