/**
 * Calendar Service Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CalendarService } from './service.js';

// Mock the CLI executor
vi.mock('../utils/eventkit-cli.js', () => ({
  executeCli: vi.fn(),
}));

describe('CalendarService', () => {
  let service: CalendarService;
  let executeCliMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    service = new CalendarService();
    const cliModule = await import('../utils/eventkit-cli.js');
    executeCliMock = cliModule.executeCli as unknown as ReturnType<typeof vi.fn>;
    executeCliMock.mockReset();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('listCalendars', () => {
    it('should return list of calendars', async () => {
      const mockCalendars = [
        { id: 'cal-1', title: 'Work' },
        { id: 'cal-2', title: 'Personal' },
      ];
      executeCliMock.mockResolvedValue(mockCalendars);

      const result = await service.listCalendars();

      expect(executeCliMock).toHaveBeenCalledWith(['--action', 'read-calendars']);
      expect(result).toEqual(mockCalendars);
    });

    it('should propagate errors from CLI', async () => {
      executeCliMock.mockRejectedValue(new Error('CLI error'));

      await expect(service.listCalendars()).rejects.toThrow('CLI error');
    });
  });

  describe('listEvents', () => {
    it('should return events without filters', async () => {
      const mockResult = {
        calendars: [{ id: 'cal-1', title: 'Work' }],
        events: [{ id: 'evt-1', title: 'Meeting', calendar: 'Work', startDate: '2025-01-25T10:00:00', endDate: '2025-01-25T11:00:00', isAllDay: false }],
      };
      executeCliMock.mockResolvedValue(mockResult);

      const result = await service.listEvents();

      expect(executeCliMock).toHaveBeenCalledWith(['--action', 'read-events']);
      expect(result).toEqual(mockResult);
    });

    it('should include filter parameters', async () => {
      executeCliMock.mockResolvedValue({ calendars: [], events: [] });

      await service.listEvents({
        filterCalendar: 'Work',
        search: 'meeting',
        startDate: '2025-01-01',
        endDate: '2025-01-31',
      });

      expect(executeCliMock).toHaveBeenCalledWith([
        '--action', 'read-events',
        '--filterCalendar', 'Work',
        '--search', 'meeting',
        '--startDate', '2025-01-01',
        '--endDate', '2025-01-31',
      ]);
    });

    it('should only include provided filters', async () => {
      executeCliMock.mockResolvedValue({ calendars: [], events: [] });

      await service.listEvents({ search: 'test' });

      expect(executeCliMock).toHaveBeenCalledWith([
        '--action', 'read-events',
        '--search', 'test',
      ]);
    });
  });

  describe('getEvent', () => {
    it('should return single event by ID', async () => {
      const mockEvent = {
        id: 'evt-1',
        title: 'Meeting',
        calendar: 'Work',
        startDate: '2025-01-25T10:00:00',
        endDate: '2025-01-25T11:00:00',
        isAllDay: false,
      };
      executeCliMock.mockResolvedValue(mockEvent);

      const result = await service.getEvent('evt-1');

      expect(executeCliMock).toHaveBeenCalledWith(['--action', 'get-event', '--id', 'evt-1']);
      expect(result).toEqual(mockEvent);
    });
  });

  describe('createEvent', () => {
    it('should create event with required fields', async () => {
      const mockEvent = {
        id: 'new-evt-1',
        title: 'New Meeting',
        calendar: 'Work',
        startDate: '2025-01-25T10:00:00',
        endDate: '2025-01-25T11:00:00',
        isAllDay: false,
      };
      executeCliMock.mockResolvedValue(mockEvent);

      const result = await service.createEvent({
        title: 'New Meeting',
        startDate: '2025-01-25T10:00:00',
        endDate: '2025-01-25T11:00:00',
      });

      expect(executeCliMock).toHaveBeenCalledWith([
        '--action', 'create-event',
        '--title', 'New Meeting',
        '--startDate', '2025-01-25T10:00:00',
        '--endDate', '2025-01-25T11:00:00',
      ]);
      expect(result).toEqual(mockEvent);
    });

    it('should include optional fields', async () => {
      executeCliMock.mockResolvedValue({});

      await service.createEvent({
        title: 'Event',
        startDate: '2025-01-25',
        endDate: '2025-01-25',
        targetCalendar: 'Personal',
        notes: 'Some notes',
        location: 'Office',
        url: 'https://example.com',
        isAllDay: true,
      });

      expect(executeCliMock).toHaveBeenCalledWith([
        '--action', 'create-event',
        '--title', 'Event',
        '--startDate', '2025-01-25',
        '--endDate', '2025-01-25',
        '--targetCalendar', 'Personal',
        '--note', 'Some notes',
        '--location', 'Office',
        '--url', 'https://example.com',
        '--isAllDay', 'true',
      ]);
    });
  });

  describe('updateEvent', () => {
    it('should update event with ID', async () => {
      const mockEvent = {
        id: 'evt-1',
        title: 'Updated Meeting',
        calendar: 'Work',
        startDate: '2025-01-25T10:00:00',
        endDate: '2025-01-25T11:00:00',
        isAllDay: false,
      };
      executeCliMock.mockResolvedValue(mockEvent);

      const result = await service.updateEvent('evt-1', { title: 'Updated Meeting' });

      expect(executeCliMock).toHaveBeenCalledWith([
        '--action', 'update-event',
        '--id', 'evt-1',
        '--title', 'Updated Meeting',
      ]);
      expect(result).toEqual(mockEvent);
    });

    it('should include all update fields', async () => {
      executeCliMock.mockResolvedValue({});

      await service.updateEvent('evt-1', {
        title: 'New Title',
        startDate: '2025-01-26',
        endDate: '2025-01-26',
        targetCalendar: 'Personal',
        notes: 'Updated notes',
        location: 'New location',
        url: '',
        isAllDay: false,
      });

      expect(executeCliMock).toHaveBeenCalledWith([
        '--action', 'update-event',
        '--id', 'evt-1',
        '--title', 'New Title',
        '--startDate', '2025-01-26',
        '--endDate', '2025-01-26',
        '--targetCalendar', 'Personal',
        '--note', 'Updated notes',
        '--location', 'New location',
        '--url', '',
        '--isAllDay', 'false',
      ]);
    });
  });

  describe('deleteEvent', () => {
    it('should delete event by ID', async () => {
      const mockResult = { id: 'evt-1', deleted: true };
      executeCliMock.mockResolvedValue(mockResult);

      const result = await service.deleteEvent('evt-1');

      expect(executeCliMock).toHaveBeenCalledWith(['--action', 'delete-event', '--id', 'evt-1']);
      expect(result).toEqual(mockResult);
    });
  });
});
