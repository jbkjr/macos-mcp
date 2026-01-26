/**
 * Reminders Types
 */

export interface ReminderList {
  id: string;
  title: string;
}

/**
 * Day of week for recurrence rules.
 * dayOfWeek: 1=Sunday, 2=Monday, ..., 7=Saturday (matches EKRecurrenceDayOfWeek)
 * weekNumber: For monthly/yearly rules, specifies which occurrence (1-5, or -1 for last)
 */
export interface DayOfWeek {
  dayOfWeek: number;
  weekNumber?: number;
}

/**
 * Recurrence end condition.
 */
export interface RecurrenceEnd {
  type: 'never' | 'date' | 'count';
  date?: string;   // ISO 8601 when type='date'
  count?: number;  // when type='count'
}

/**
 * Recurrence rule for repeating reminders.
 * Maps to EKRecurrenceRule in EventKit.
 */
export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;  // e.g., 2 = every 2 weeks (default: 1)

  // Optional constraints (availability depends on frequency)
  daysOfTheWeek?: DayOfWeek[];      // weekly/monthly/yearly
  daysOfTheMonth?: number[];         // monthly only - 1-31, negative = from end
  monthsOfTheYear?: number[];        // yearly only - 1-12
  weeksOfTheYear?: number[];         // yearly only - 1-53, negative from end
  daysOfTheYear?: number[];          // yearly only - 1-366, negative from end
  setPositions?: number[];           // filter occurrences

  end?: RecurrenceEnd;
}

export interface Reminder {
  id: string;
  title: string;
  isCompleted: boolean;
  list: string;
  notes?: string;
  url?: string;
  dueDate?: string;
  recurrence?: RecurrenceRule;
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
