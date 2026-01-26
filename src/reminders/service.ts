/**
 * Reminders Service
 * Business logic for reminder operations via Swift CLI
 */

import { executeCli } from '../utils/eventkit-cli.js';
import type {
  Reminder,
  ReminderList,
  RemindersReadResult,
  DeleteResult,
  DeleteListResult,
  DueWithinOption,
  RecurrenceRule,
  ReminderPriority,
} from './types.js';

/**
 * Adds optional arguments to a CLI args array.
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

export class RemindersService {
  async listLists(): Promise<ReminderList[]> {
    return executeCli<ReminderList[]>(['--action', 'read-lists']);
  }

  async createList(name: string): Promise<ReminderList> {
    return executeCli<ReminderList>(['--action', 'create-list', '--name', name]);
  }

  async renameList(currentName: string, newName: string): Promise<ReminderList> {
    return executeCli<ReminderList>([
      '--action', 'update-list',
      '--name', currentName,
      '--newName', newName,
    ]);
  }

  async deleteList(name: string): Promise<DeleteListResult> {
    return executeCli<DeleteListResult>(['--action', 'delete-list', '--name', name]);
  }

  async listReminders(options?: {
    filterList?: string;
    showCompleted?: boolean;
    search?: string;
    dueWithin?: DueWithinOption;
    priority?: ReminderPriority;
  }): Promise<RemindersReadResult> {
    const args = ['--action', 'read-reminders'];
    if (options) {
      addOptionalArgs(args, options, {
        filterList: '--filterList',
        showCompleted: '--showCompleted',
        search: '--search',
        dueWithin: '--dueWithin',
        priority: '--priority',
      });
    }
    return executeCli<RemindersReadResult>(args);
  }

  async getReminder(id: string): Promise<Reminder> {
    return executeCli<Reminder>(['--action', 'get-reminder', '--id', id]);
  }

  async createReminder(options: {
    title: string;
    targetList?: string;
    notes?: string;
    url?: string;
    dueDate?: string;
    recurrence?: RecurrenceRule;
    priority?: ReminderPriority;
  }): Promise<Reminder> {
    const args = ['--action', 'create-reminder', '--title', options.title];
    const { recurrence, ...restOptions } = options;
    addOptionalArgs(args, restOptions, {
      targetList: '--targetList',
      notes: '--note',
      url: '--url',
      dueDate: '--dueDate',
      priority: '--priority',
    });
    if (recurrence) {
      args.push('--recurrence', JSON.stringify(recurrence));
    }
    return executeCli<Reminder>(args);
  }

  async updateReminder(
    id: string,
    updates: {
      title?: string;
      targetList?: string;
      notes?: string;
      url?: string;
      dueDate?: string;
      completed?: boolean;
      recurrence?: RecurrenceRule | null;
      priority?: ReminderPriority;
    }
  ): Promise<Reminder> {
    const args = ['--action', 'update-reminder', '--id', id];
    const { recurrence, ...restUpdates } = updates;
    addOptionalArgs(args, restUpdates, {
      title: '--title',
      targetList: '--targetList',
      notes: '--note',
      url: '--url',
      dueDate: '--dueDate',
      completed: '--completed',
      priority: '--priority',
    });
    if (recurrence !== undefined) {
      args.push('--recurrence', recurrence === null ? '' : JSON.stringify(recurrence));
    }
    return executeCli<Reminder>(args);
  }

  async deleteReminder(id: string): Promise<DeleteResult> {
    return executeCli<DeleteResult>(['--action', 'delete-reminder', '--id', id]);
  }
}
