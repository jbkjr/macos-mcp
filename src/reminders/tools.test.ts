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
      const validOptions = ['today', 'tomorrow', 'this-week', 'overdue', 'no-date'];
      for (const option of validOptions) {
        const result = listRemindersSchema.safeParse({ dueWithin: option });
        expect(result.success).toBe(true);
      }

      const invalid = listRemindersSchema.safeParse({ dueWithin: 'invalid' });
      expect(invalid.success).toBe(false);
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
});
