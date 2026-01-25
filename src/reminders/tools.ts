/**
 * Reminders Tool Definitions
 */

import { z } from 'zod';

// Due within options
const dueWithinOptions = ['today', 'tomorrow', 'this-week', 'overdue', 'no-date'] as const;

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
});

export const updateReminderSchema = z.object({
  id: z.string().describe('The unique identifier of the reminder to update'),
  title: z.string().optional().describe('New title for the reminder'),
  targetList: z.string().optional().describe('Move reminder to a different list'),
  notes: z.string().optional().describe('New notes for the reminder'),
  url: z.string().optional().describe('New URL for the reminder (empty string to remove)'),
  dueDate: z.string().optional().describe("New due date (format: 'YYYY-MM-DD HH:mm:ss' or ISO 8601, empty string to remove)"),
  completed: z.boolean().optional().describe('Mark the reminder as completed or not'),
});

export const deleteReminderSchema = z.object({
  id: z.string().describe('The unique identifier of the reminder to delete'),
});
