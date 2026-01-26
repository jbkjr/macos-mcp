/**
 * Reminders Service Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RemindersService } from './service.js';

// Mock the CLI executor
vi.mock('../utils/eventkit-cli.js', () => ({
  executeCli: vi.fn(),
}));

describe('RemindersService', () => {
  let service: RemindersService;
  let executeCliMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    service = new RemindersService();
    const cliModule = await import('../utils/eventkit-cli.js');
    executeCliMock = cliModule.executeCli as unknown as ReturnType<typeof vi.fn>;
    executeCliMock.mockReset();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // List operations
  describe('listLists', () => {
    it('should return list of reminder lists', async () => {
      const mockLists = [
        { id: 'list-1', title: 'Work' },
        { id: 'list-2', title: 'Personal' },
      ];
      executeCliMock.mockResolvedValue(mockLists);

      const result = await service.listLists();

      expect(executeCliMock).toHaveBeenCalledWith(['--action', 'read-lists']);
      expect(result).toEqual(mockLists);
    });
  });

  describe('createList', () => {
    it('should create a new list', async () => {
      const mockList = { id: 'new-list', title: 'Shopping' };
      executeCliMock.mockResolvedValue(mockList);

      const result = await service.createList('Shopping');

      expect(executeCliMock).toHaveBeenCalledWith(['--action', 'create-list', '--name', 'Shopping']);
      expect(result).toEqual(mockList);
    });
  });

  describe('renameList', () => {
    it('should rename a list', async () => {
      const mockList = { id: 'list-1', title: 'New Name' };
      executeCliMock.mockResolvedValue(mockList);

      const result = await service.renameList('Old Name', 'New Name');

      expect(executeCliMock).toHaveBeenCalledWith([
        '--action', 'update-list',
        '--name', 'Old Name',
        '--newName', 'New Name',
      ]);
      expect(result).toEqual(mockList);
    });
  });

  describe('deleteList', () => {
    it('should delete a list', async () => {
      const mockResult = { title: 'To Delete', deleted: true };
      executeCliMock.mockResolvedValue(mockResult);

      const result = await service.deleteList('To Delete');

      expect(executeCliMock).toHaveBeenCalledWith(['--action', 'delete-list', '--name', 'To Delete']);
      expect(result).toEqual(mockResult);
    });
  });

  // Reminder operations
  describe('listReminders', () => {
    it('should return reminders without filters', async () => {
      const mockResult = {
        lists: [{ id: 'list-1', title: 'Work' }],
        reminders: [{ id: 'rem-1', title: 'Task 1', isCompleted: false, list: 'Work' }],
      };
      executeCliMock.mockResolvedValue(mockResult);

      const result = await service.listReminders();

      expect(executeCliMock).toHaveBeenCalledWith(['--action', 'read-reminders']);
      expect(result).toEqual(mockResult);
    });

    it('should include all filter parameters', async () => {
      executeCliMock.mockResolvedValue({ lists: [], reminders: [] });

      await service.listReminders({
        filterList: 'Work',
        showCompleted: true,
        search: 'task',
        dueWithin: 'today',
      });

      expect(executeCliMock).toHaveBeenCalledWith([
        '--action', 'read-reminders',
        '--filterList', 'Work',
        '--showCompleted', 'true',
        '--search', 'task',
        '--dueWithin', 'today',
      ]);
    });

    it('should handle different dueWithin options', async () => {
      const dueOptions = ['today', 'tomorrow', 'this-week', 'overdue', 'no-date'] as const;

      for (const option of dueOptions) {
        executeCliMock.mockResolvedValue({ lists: [], reminders: [] });

        await service.listReminders({ dueWithin: option });

        expect(executeCliMock).toHaveBeenCalledWith([
          '--action', 'read-reminders',
          '--dueWithin', option,
        ]);
      }
    });
  });

  describe('getReminder', () => {
    it('should return single reminder by ID', async () => {
      const mockReminder = {
        id: 'rem-1',
        title: 'Task 1',
        isCompleted: false,
        list: 'Work',
        notes: 'Some notes',
      };
      executeCliMock.mockResolvedValue(mockReminder);

      const result = await service.getReminder('rem-1');

      expect(executeCliMock).toHaveBeenCalledWith(['--action', 'get-reminder', '--id', 'rem-1']);
      expect(result).toEqual(mockReminder);
    });
  });

  describe('createReminder', () => {
    it('should create reminder with required fields', async () => {
      const mockReminder = {
        id: 'new-rem',
        title: 'New Task',
        isCompleted: false,
        list: 'Reminders',
      };
      executeCliMock.mockResolvedValue(mockReminder);

      const result = await service.createReminder({ title: 'New Task' });

      expect(executeCliMock).toHaveBeenCalledWith([
        '--action', 'create-reminder',
        '--title', 'New Task',
      ]);
      expect(result).toEqual(mockReminder);
    });

    it('should include optional fields', async () => {
      executeCliMock.mockResolvedValue({});

      await service.createReminder({
        title: 'Task',
        targetList: 'Work',
        notes: 'Important task',
        url: 'https://example.com',
        dueDate: '2025-01-25 10:00:00',
      });

      expect(executeCliMock).toHaveBeenCalledWith([
        '--action', 'create-reminder',
        '--title', 'Task',
        '--targetList', 'Work',
        '--note', 'Important task',
        '--url', 'https://example.com',
        '--dueDate', '2025-01-25 10:00:00',
      ]);
    });
  });

  describe('updateReminder', () => {
    it('should update reminder with ID', async () => {
      const mockReminder = {
        id: 'rem-1',
        title: 'Updated Task',
        isCompleted: false,
        list: 'Work',
      };
      executeCliMock.mockResolvedValue(mockReminder);

      const result = await service.updateReminder('rem-1', { title: 'Updated Task' });

      expect(executeCliMock).toHaveBeenCalledWith([
        '--action', 'update-reminder',
        '--id', 'rem-1',
        '--title', 'Updated Task',
      ]);
      expect(result).toEqual(mockReminder);
    });

    it('should include all update fields', async () => {
      executeCliMock.mockResolvedValue({});

      await service.updateReminder('rem-1', {
        title: 'New Title',
        targetList: 'Personal',
        notes: 'Updated notes',
        url: 'https://new.url',
        dueDate: '2025-01-26',
        completed: true,
      });

      expect(executeCliMock).toHaveBeenCalledWith([
        '--action', 'update-reminder',
        '--id', 'rem-1',
        '--title', 'New Title',
        '--targetList', 'Personal',
        '--note', 'Updated notes',
        '--url', 'https://new.url',
        '--dueDate', '2025-01-26',
        '--completed', 'true',
      ]);
    });

    it('should handle empty string for clearing fields', async () => {
      executeCliMock.mockResolvedValue({});

      await service.updateReminder('rem-1', {
        notes: '',
        url: '',
        dueDate: '',
      });

      expect(executeCliMock).toHaveBeenCalledWith([
        '--action', 'update-reminder',
        '--id', 'rem-1',
        '--note', '',
        '--url', '',
        '--dueDate', '',
      ]);
    });
  });

  describe('deleteReminder', () => {
    it('should delete reminder by ID', async () => {
      const mockResult = { id: 'rem-1', deleted: true };
      executeCliMock.mockResolvedValue(mockResult);

      const result = await service.deleteReminder('rem-1');

      expect(executeCliMock).toHaveBeenCalledWith(['--action', 'delete-reminder', '--id', 'rem-1']);
      expect(result).toEqual(mockResult);
    });
  });

  // Recurrence tests
  describe('createReminder with recurrence', () => {
    it('should serialize recurrence as JSON string', async () => {
      executeCliMock.mockResolvedValue({});

      const recurrence = { frequency: 'daily', interval: 1 };
      await service.createReminder({
        title: 'Daily task',
        recurrence: recurrence as any,
      });

      expect(executeCliMock).toHaveBeenCalledWith([
        '--action', 'create-reminder',
        '--title', 'Daily task',
        '--recurrence', JSON.stringify(recurrence),
      ]);
    });

    it('should serialize complex recurrence rule', async () => {
      executeCliMock.mockResolvedValue({});

      const recurrence = {
        frequency: 'weekly',
        interval: 2,
        daysOfTheWeek: [{ dayOfWeek: 2 }, { dayOfWeek: 4 }],
        end: { type: 'count', count: 10 },
      };
      await service.createReminder({
        title: 'Biweekly meeting',
        recurrence: recurrence as any,
      });

      expect(executeCliMock).toHaveBeenCalledWith([
        '--action', 'create-reminder',
        '--title', 'Biweekly meeting',
        '--recurrence', JSON.stringify(recurrence),
      ]);
    });

    it('should not include recurrence when not provided', async () => {
      executeCliMock.mockResolvedValue({});

      await service.createReminder({ title: 'One-time task' });

      expect(executeCliMock).toHaveBeenCalledWith([
        '--action', 'create-reminder',
        '--title', 'One-time task',
      ]);
    });
  });

  describe('updateReminder with recurrence', () => {
    it('should pass empty string to remove recurrence', async () => {
      executeCliMock.mockResolvedValue({});

      await service.updateReminder('rem-1', { recurrence: null });

      expect(executeCliMock).toHaveBeenCalledWith([
        '--action', 'update-reminder',
        '--id', 'rem-1',
        '--recurrence', '',
      ]);
    });

    it('should serialize recurrence to update', async () => {
      executeCliMock.mockResolvedValue({});

      const recurrence = { frequency: 'monthly', interval: 1 };
      await service.updateReminder('rem-1', { recurrence: recurrence as any });

      expect(executeCliMock).toHaveBeenCalledWith([
        '--action', 'update-reminder',
        '--id', 'rem-1',
        '--recurrence', JSON.stringify(recurrence),
      ]);
    });

    it('should not include recurrence when undefined', async () => {
      executeCliMock.mockResolvedValue({});

      await service.updateReminder('rem-1', { title: 'Updated' });

      expect(executeCliMock).toHaveBeenCalledWith([
        '--action', 'update-reminder',
        '--id', 'rem-1',
        '--title', 'Updated',
      ]);
    });
  });
});
