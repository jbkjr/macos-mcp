/**
 * Reminders Tool Definitions
 */

import { z } from 'zod';

// Due within options
const dueWithinOptions = ['today', 'tomorrow', 'this-week', 'overdue', 'no-date'] as const;

// Recurrence schemas
export const dayOfWeekSchema = z.object({
  dayOfWeek: z.number().int().min(1).max(7).describe('Day of week: 1=Sunday, 2=Monday, ..., 7=Saturday'),
  weekNumber: z.number().int().min(-1).max(5).optional().describe('For monthly/yearly: 1-5 or -1 (last)'),
});

export const recurrenceEndSchema = z.object({
  type: z.enum(['never', 'date', 'count']).describe('End condition type'),
  date: z.string().optional().describe('ISO 8601 date when type="date"'),
  count: z.number().int().positive().optional().describe('Number of occurrences when type="count"'),
});

export const recurrenceRuleSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']).describe('Recurrence frequency'),
  interval: z.number().int().positive().default(1).describe('Interval between occurrences (e.g., 2 = every 2 weeks)'),
  daysOfTheWeek: z.array(dayOfWeekSchema).optional().describe('Days of week (weekly/monthly/yearly)'),
  daysOfTheMonth: z.array(z.number().int().min(-31).max(31)).optional().describe('Days of month (monthly only, 1-31, negative from end)'),
  monthsOfTheYear: z.array(z.number().int().min(1).max(12)).optional().describe('Months of year (yearly only, 1-12)'),
  weeksOfTheYear: z.array(z.number().int().min(-53).max(53)).optional().describe('Weeks of year (yearly only, 1-53, negative from end)'),
  daysOfTheYear: z.array(z.number().int().min(-366).max(366)).optional().describe('Days of year (yearly only, 1-366, negative from end)'),
  setPositions: z.array(z.number().int().min(-366).max(366)).optional().describe('Filter occurrences (e.g., [1, -1] = first and last)'),
  end: recurrenceEndSchema.optional().describe('End condition'),
});

// List tools
export const listReminderListsSchema = z.object({});

export const createReminderListSchema = z.object({
  name: z.string().describe('The name for the new reminder list'),
});

export const renameReminderListSchema = z.object({
  name: z.string().describe('The current name of the list to rename'),
  newName: z.string().describe('The new name for the list'),
});

export const deleteReminderListSchema = z.object({
  name: z.string().describe('The name of the list to delete'),
});

// Reminder tools
export const listRemindersSchema = z.object({
  filterList: z.string().optional().describe('Filter reminders by list name'),
  showCompleted: z.boolean().optional().describe('Include completed reminders (default: false)'),
  search: z.string().optional().describe('Search term to filter reminders by title or notes'),
  dueWithin: z.enum(dueWithinOptions).optional().describe('Filter reminders by due date range'),
});

export const getReminderSchema = z.object({
  id: z.string().describe('The unique identifier of the reminder'),
});

export const createReminderSchema = z.object({
  title: z.string().describe('The title of the reminder'),
  targetList: z.string().optional().describe('The list to create the reminder in (defaults to default list)'),
  notes: z.string().optional().describe('Additional notes for the reminder'),
  url: z.string().url().optional().describe('A URL to associate with the reminder'),
  dueDate: z.string().optional().describe("Due date (format: 'YYYY-MM-DD HH:mm:ss' or ISO 8601)"),
  recurrence: recurrenceRuleSchema.optional().describe('Recurrence rule for repeating reminders'),
});

export const updateReminderSchema = z.object({
  id: z.string().describe('The unique identifier of the reminder to update'),
  title: z.string().optional().describe('New title for the reminder'),
  targetList: z.string().optional().describe('Move reminder to a different list'),
  notes: z.string().optional().describe('New notes for the reminder'),
  url: z.string().optional().describe('New URL for the reminder (empty string to remove)'),
  dueDate: z.string().optional().describe("New due date (format: 'YYYY-MM-DD HH:mm:ss' or ISO 8601, empty string to remove)"),
  completed: z.boolean().optional().describe('Mark the reminder as completed or not'),
  recurrence: recurrenceRuleSchema.nullable().optional().describe('Recurrence rule (null to remove, object to set/update)'),
});

export const deleteReminderSchema = z.object({
  id: z.string().describe('The unique identifier of the reminder to delete'),
});
