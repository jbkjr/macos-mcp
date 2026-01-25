/**
 * Calendar Tool Schema Tests
 */

import { describe, it, expect } from 'vitest';
import {
  listCalendarsSchema,
  listCalendarEventsSchema,
  getCalendarEventSchema,
  createCalendarEventSchema,
  updateCalendarEventSchema,
  deleteCalendarEventSchema,
} from './tools.js';

describe('Calendar Tool Schemas', () => {
  describe('listCalendarsSchema', () => {
    it('should accept empty object', () => {
      const result = listCalendarsSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('listCalendarEventsSchema', () => {
    it('should accept empty object', () => {
      const result = listCalendarEventsSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should accept all optional filters', () => {
      const result = listCalendarEventsSchema.safeParse({
        filterCalendar: 'Work',
        search: 'meeting',
        startDate: '2025-01-01',
        endDate: '2025-01-31',
      });
      expect(result.success).toBe(true);
    });

    it('should accept partial filters', () => {
      const result = listCalendarEventsSchema.safeParse({
        search: 'meeting',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('getCalendarEventSchema', () => {
    it('should require id', () => {
      const result = getCalendarEventSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should accept valid id', () => {
      const result = getCalendarEventSchema.safeParse({
        id: 'event-123',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('createCalendarEventSchema', () => {
    it('should require title, startDate, and endDate', () => {
      const result = createCalendarEventSchema.safeParse({});
      expect(result.success).toBe(false);

      const result2 = createCalendarEventSchema.safeParse({ title: 'Test' });
      expect(result2.success).toBe(false);
    });

    it('should accept required fields only', () => {
      const result = createCalendarEventSchema.safeParse({
        title: 'Meeting',
        startDate: '2025-01-25T10:00:00',
        endDate: '2025-01-25T11:00:00',
      });
      expect(result.success).toBe(true);
    });

    it('should accept all fields', () => {
      const result = createCalendarEventSchema.safeParse({
        title: 'Meeting',
        startDate: '2025-01-25T10:00:00',
        endDate: '2025-01-25T11:00:00',
        targetCalendar: 'Work',
        notes: 'Important meeting',
        location: 'Conference Room',
        url: 'https://example.com',
        isAllDay: false,
      });
      expect(result.success).toBe(true);
    });

    it('should validate URL format', () => {
      const result = createCalendarEventSchema.safeParse({
        title: 'Meeting',
        startDate: '2025-01-25',
        endDate: '2025-01-25',
        url: 'not-a-url',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('updateCalendarEventSchema', () => {
    it('should require id', () => {
      const result = updateCalendarEventSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should accept id only', () => {
      const result = updateCalendarEventSchema.safeParse({
        id: 'event-123',
      });
      expect(result.success).toBe(true);
    });

    it('should accept all update fields', () => {
      const result = updateCalendarEventSchema.safeParse({
        id: 'event-123',
        title: 'Updated Meeting',
        startDate: '2025-01-26T10:00:00',
        endDate: '2025-01-26T11:00:00',
        targetCalendar: 'Personal',
        notes: 'Updated notes',
        location: 'New location',
        url: '',
        isAllDay: true,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('deleteCalendarEventSchema', () => {
    it('should require id', () => {
      const result = deleteCalendarEventSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should accept valid id', () => {
      const result = deleteCalendarEventSchema.safeParse({
        id: 'event-123',
      });
      expect(result.success).toBe(true);
    });
  });
});
