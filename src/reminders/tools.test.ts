/**
 * Reminders Tool Schema Tests
 */

import { describe, it, expect } from 'vitest';
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
  dayOfWeekSchema,
  recurrenceEndSchema,
  recurrenceRuleSchema,
} from './tools.js';

describe('Reminders Tool Schemas', () => {
  // List schemas
  describe('listReminderListsSchema', () => {
    it('should accept empty object', () => {
      const result = listReminderListsSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('createReminderListSchema', () => {
    it('should require name', () => {
      const result = createReminderListSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should accept valid name', () => {
      const result = createReminderListSchema.safeParse({ name: 'Shopping' });
      expect(result.success).toBe(true);
    });
  });

  describe('renameReminderListSchema', () => {
    it('should require name and newName', () => {
      const result = renameReminderListSchema.safeParse({});
      expect(result.success).toBe(false);

      const result2 = renameReminderListSchema.safeParse({ name: 'Old' });
      expect(result2.success).toBe(false);
    });

    it('should accept both names', () => {
      const result = renameReminderListSchema.safeParse({
        name: 'Old Name',
        newName: 'New Name',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('deleteReminderListSchema', () => {
    it('should require name', () => {
      const result = deleteReminderListSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should accept valid name', () => {
      const result = deleteReminderListSchema.safeParse({ name: 'To Delete' });
      expect(result.success).toBe(true);
    });
  });

  // Reminder schemas
  describe('listRemindersSchema', () => {
    it('should accept empty object', () => {
      const result = listRemindersSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should accept all optional filters', () => {
      const result = listRemindersSchema.safeParse({
        filterList: 'Work',
        showCompleted: true,
        search: 'task',
        dueWithin: 'today',
      });
      expect(result.success).toBe(true);
    });

    it('should validate dueWithin enum', () => {
      const validOptions = ['today', 'tomorrow', 'this-week', 'overdue', 'no-date', 'scheduled'];
      for (const option of validOptions) {
        const result = listRemindersSchema.safeParse({ dueWithin: option });
        expect(result.success).toBe(true);
      }

      const invalid = listRemindersSchema.safeParse({ dueWithin: 'invalid' });
      expect(invalid.success).toBe(false);
    });

    it('should validate priority enum', () => {
      const validOptions = ['none', 'low', 'medium', 'high'];
      for (const option of validOptions) {
        const result = listRemindersSchema.safeParse({ priority: option });
        expect(result.success).toBe(true);
      }

      const invalid = listRemindersSchema.safeParse({ priority: 'invalid' });
      expect(invalid.success).toBe(false);
    });

    it('should accept priority filter', () => {
      const result = listRemindersSchema.safeParse({
        filterList: 'Work',
        priority: 'high',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('getReminderSchema', () => {
    it('should require id', () => {
      const result = getReminderSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should accept valid id', () => {
      const result = getReminderSchema.safeParse({ id: 'reminder-123' });
      expect(result.success).toBe(true);
    });
  });

  describe('createReminderSchema', () => {
    it('should require title', () => {
      const result = createReminderSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should accept title only', () => {
      const result = createReminderSchema.safeParse({ title: 'New Task' });
      expect(result.success).toBe(true);
    });

    it('should accept all fields', () => {
      const result = createReminderSchema.safeParse({
        title: 'Task',
        targetList: 'Work',
        notes: 'Important task',
        url: 'https://example.com',
        dueDate: '2025-01-25T10:00:00',
      });
      expect(result.success).toBe(true);
    });

    it('should validate URL format', () => {
      const result = createReminderSchema.safeParse({
        title: 'Task',
        url: 'not-a-url',
      });
      expect(result.success).toBe(false);
    });

    it('should accept valid priority', () => {
      const validPriorities = ['none', 'low', 'medium', 'high'];
      for (const priority of validPriorities) {
        const result = createReminderSchema.safeParse({ title: 'Task', priority });
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid priority', () => {
      const result = createReminderSchema.safeParse({ title: 'Task', priority: 'urgent' });
      expect(result.success).toBe(false);
    });
  });

  describe('updateReminderSchema', () => {
    it('should require id', () => {
      const result = updateReminderSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should accept id only', () => {
      const result = updateReminderSchema.safeParse({ id: 'reminder-123' });
      expect(result.success).toBe(true);
    });

    it('should accept all update fields', () => {
      const result = updateReminderSchema.safeParse({
        id: 'reminder-123',
        title: 'Updated Task',
        targetList: 'Personal',
        notes: 'Updated notes',
        url: 'https://example.com',
        dueDate: '2025-01-26',
        completed: true,
      });
      expect(result.success).toBe(true);
    });

    it('should accept empty strings for clearing fields', () => {
      const result = updateReminderSchema.safeParse({
        id: 'reminder-123',
        notes: '',
        url: '',
        dueDate: '',
      });
      expect(result.success).toBe(true);
    });

    it('should accept valid priority', () => {
      const result = updateReminderSchema.safeParse({
        id: 'reminder-123',
        priority: 'high',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid priority', () => {
      const result = updateReminderSchema.safeParse({
        id: 'reminder-123',
        priority: 'critical',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('deleteReminderSchema', () => {
    it('should require id', () => {
      const result = deleteReminderSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should accept valid id', () => {
      const result = deleteReminderSchema.safeParse({ id: 'reminder-123' });
      expect(result.success).toBe(true);
    });
  });

  // Recurrence schemas
  describe('dayOfWeekSchema', () => {
    it('should require dayOfWeek', () => {
      const result = dayOfWeekSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should accept valid dayOfWeek (1-7)', () => {
      for (let i = 1; i <= 7; i++) {
        const result = dayOfWeekSchema.safeParse({ dayOfWeek: i });
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid dayOfWeek', () => {
      expect(dayOfWeekSchema.safeParse({ dayOfWeek: 0 }).success).toBe(false);
      expect(dayOfWeekSchema.safeParse({ dayOfWeek: 8 }).success).toBe(false);
    });

    it('should accept optional weekNumber (-1 to 5)', () => {
      expect(dayOfWeekSchema.safeParse({ dayOfWeek: 2, weekNumber: 1 }).success).toBe(true);
      expect(dayOfWeekSchema.safeParse({ dayOfWeek: 2, weekNumber: -1 }).success).toBe(true);
      expect(dayOfWeekSchema.safeParse({ dayOfWeek: 2, weekNumber: 5 }).success).toBe(true);
    });

    it('should reject invalid weekNumber', () => {
      expect(dayOfWeekSchema.safeParse({ dayOfWeek: 2, weekNumber: 6 }).success).toBe(false);
      expect(dayOfWeekSchema.safeParse({ dayOfWeek: 2, weekNumber: -2 }).success).toBe(false);
    });
  });

  describe('recurrenceEndSchema', () => {
    it('should accept type "never"', () => {
      const result = recurrenceEndSchema.safeParse({ type: 'never' });
      expect(result.success).toBe(true);
    });

    it('should accept type "date" with date', () => {
      const result = recurrenceEndSchema.safeParse({ type: 'date', date: '2025-12-31T00:00:00Z' });
      expect(result.success).toBe(true);
    });

    it('should accept type "count" with count', () => {
      const result = recurrenceEndSchema.safeParse({ type: 'count', count: 10 });
      expect(result.success).toBe(true);
    });

    it('should reject invalid type', () => {
      const result = recurrenceEndSchema.safeParse({ type: 'invalid' });
      expect(result.success).toBe(false);
    });
  });

  describe('recurrenceRuleSchema', () => {
    it('should require frequency', () => {
      const result = recurrenceRuleSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should accept valid frequencies', () => {
      const frequencies = ['daily', 'weekly', 'monthly', 'yearly'] as const;
      for (const frequency of frequencies) {
        const result = recurrenceRuleSchema.safeParse({ frequency });
        expect(result.success).toBe(true);
      }
    });

    it('should default interval to 1', () => {
      const result = recurrenceRuleSchema.safeParse({ frequency: 'daily' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.interval).toBe(1);
      }
    });

    it('should accept daily recurrence', () => {
      const result = recurrenceRuleSchema.safeParse({
        frequency: 'daily',
        interval: 1,
      });
      expect(result.success).toBe(true);
    });

    it('should accept weekly recurrence with daysOfTheWeek', () => {
      const result = recurrenceRuleSchema.safeParse({
        frequency: 'weekly',
        interval: 1,
        daysOfTheWeek: [{ dayOfWeek: 2 }, { dayOfWeek: 4 }],
      });
      expect(result.success).toBe(true);
    });

    it('should accept monthly recurrence with daysOfTheMonth', () => {
      const result = recurrenceRuleSchema.safeParse({
        frequency: 'monthly',
        interval: 1,
        daysOfTheMonth: [15, -1],
      });
      expect(result.success).toBe(true);
    });

    it('should accept monthly recurrence with weekNumber (e.g., first Monday)', () => {
      const result = recurrenceRuleSchema.safeParse({
        frequency: 'monthly',
        interval: 1,
        daysOfTheWeek: [{ dayOfWeek: 2, weekNumber: 1 }],
      });
      expect(result.success).toBe(true);
    });

    it('should accept yearly recurrence with monthsOfTheYear', () => {
      const result = recurrenceRuleSchema.safeParse({
        frequency: 'yearly',
        interval: 1,
        monthsOfTheYear: [1, 6, 12],
      });
      expect(result.success).toBe(true);
    });

    it('should accept recurrence with end condition', () => {
      const result = recurrenceRuleSchema.safeParse({
        frequency: 'weekly',
        interval: 2,
        daysOfTheWeek: [{ dayOfWeek: 6 }],
        end: { type: 'count', count: 10 },
      });
      expect(result.success).toBe(true);
    });

    it('should accept setPositions', () => {
      const result = recurrenceRuleSchema.safeParse({
        frequency: 'monthly',
        interval: 1,
        daysOfTheWeek: [{ dayOfWeek: 2 }],
        setPositions: [1, -1],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('createReminderSchema with recurrence', () => {
    it('should accept reminder with recurrence', () => {
      const result = createReminderSchema.safeParse({
        title: 'Daily medication',
        dueDate: '2025-01-25T09:00:00',
        recurrence: { frequency: 'daily', interval: 1 },
      });
      expect(result.success).toBe(true);
    });

    it('should accept reminder without recurrence', () => {
      const result = createReminderSchema.safeParse({
        title: 'One-time task',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('updateReminderSchema with recurrence', () => {
    it('should accept null recurrence to remove', () => {
      const result = updateReminderSchema.safeParse({
        id: 'reminder-123',
        recurrence: null,
      });
      expect(result.success).toBe(true);
    });

    it('should accept recurrence object to set/update', () => {
      const result = updateReminderSchema.safeParse({
        id: 'reminder-123',
        recurrence: { frequency: 'weekly', interval: 1 },
      });
      expect(result.success).toBe(true);
    });
  });
});
