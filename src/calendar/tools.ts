/**
 * Calendar Tool Definitions
 */

import { z } from 'zod';

export const listCalendarsSchema = z.object({});

export const listCalendarEventsSchema = z.object({
  filterCalendar: z.string().optional().describe('Filter events by calendar name'),
  search: z.string().optional().describe('Search term to filter events by title, notes, or location'),
  startDate: z.string().optional().describe("Start date for filtering events (format: 'YYYY-MM-DD HH:mm:ss' or ISO 8601)"),
  endDate: z.string().optional().describe("End date for filtering events (format: 'YYYY-MM-DD HH:mm:ss' or ISO 8601)"),
});

export const getCalendarEventSchema = z.object({
  id: z.string().describe('The unique identifier of the event'),
});

export const createCalendarEventSchema = z.object({
  title: z.string().describe('The title of the event'),
  startDate: z.string().describe("Start date and time (format: 'YYYY-MM-DD HH:mm:ss' or ISO 8601)"),
  endDate: z.string().describe("End date and time (format: 'YYYY-MM-DD HH:mm:ss' or ISO 8601)"),
  targetCalendar: z.string().optional().describe('The calendar to create the event in (defaults to default calendar)'),
  notes: z.string().optional().describe('Additional notes for the event'),
  location: z.string().optional().describe('Location for the event'),
  url: z.string().url().optional().describe('A URL to associate with the event'),
  isAllDay: z.boolean().optional().describe('Whether this is an all-day event'),
});

export const updateCalendarEventSchema = z.object({
  id: z.string().describe('The unique identifier of the event to update'),
  title: z.string().optional().describe('New title for the event'),
  startDate: z.string().optional().describe("New start date and time (format: 'YYYY-MM-DD HH:mm:ss' or ISO 8601)"),
  endDate: z.string().optional().describe("New end date and time (format: 'YYYY-MM-DD HH:mm:ss' or ISO 8601)"),
  targetCalendar: z.string().optional().describe('Move event to a different calendar'),
  notes: z.string().optional().describe('New notes for the event'),
  location: z.string().optional().describe('New location for the event'),
  url: z.string().optional().describe('New URL for the event (empty string to remove)'),
  isAllDay: z.boolean().optional().describe('Whether this is an all-day event'),
});

export const deleteCalendarEventSchema = z.object({
  id: z.string().describe('The unique identifier of the event to delete'),
});
