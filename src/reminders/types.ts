/**
 * Reminders Types
 */

export interface ReminderList {
  id: string;
  title: string;
}

export interface Reminder {
  id: string;
  title: string;
  isCompleted: boolean;
  list: string;
  notes?: string;
  url?: string;
  dueDate?: string;
}

export interface RemindersReadResult {
  lists: ReminderList[];
  reminders: Reminder[];
}

export interface DeleteResult {
  id: string;
  deleted: boolean;
}

export interface DeleteListResult {
  title: string;
  deleted: boolean;
}

export type DueWithinOption = 'today' | 'tomorrow' | 'this-week' | 'overdue' | 'no-date';
