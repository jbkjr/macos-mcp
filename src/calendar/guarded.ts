/** Guarded inputs are deliberately separate from the generic, local calendar tools. */
import { z } from 'zod';

const DAY = 86_400_000;
const forbidden = /[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}\p{Default_Ignorable_Code_Point}]/u;

function plainString(limit: number, notes = false) {
  return z.string().refine((value) => Array.from(value).length <= limit, `Must contain at most ${limit} Unicode characters`)
    .refine((value) => !forbidden.test(notes ? value.replace(/[\n\t]/g, '') : value), 'Control, invisible and malformed Unicode characters are forbidden');
}

const identifier = plainString(1024).refine((value) => value.length > 0, 'Identifier is required');
const title = plainString(300).refine((value) => value.length > 0, 'Title must not be empty');

function validZone(zone: string): boolean {
  if (zone !== 'UTC' && zone !== 'GMT' && !/^[A-Za-z_+-]+(?:\/[A-Za-z0-9_+.-]+)+$/.test(zone)) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: zone }).format(0); return true; } catch { return false; }
}

const timeZone = z.string().max(100).refine(validZone, 'An explicit IANA time zone is required').nullable();
const dateText = z.string().max(40);

export const guardedCalendarCreateEventSchema = z.object({
  calendar_id: identifier,
  title,
  start: dateText.describe('RFC 3339 with offset for timed events; YYYY-MM-DD for all-day events'),
  end: dateText.describe('Exclusive end; RFC 3339 with offset or YYYY-MM-DD matching start'),
  time_zone: timeZone.describe('Timed events use this zone; all-day dates float in the Mac system default zone'),
  is_all_day: z.boolean(),
  notes: plainString(4000, true).optional(),
  location: plainString(500).optional(),
}).strict();

export const guardedCalendarRescheduleEventSchema = z.object({
  event_id: identifier,
  start: dateText,
  end: dateText.describe('Exclusive end; preserve the event’s existing all-day/timed kind'),
  time_zone: timeZone.describe('Timed events use this zone; all-day dates float in the Mac system default zone'),
}).strict();

export const guardedCalendarUpdateEventSchema = z.object({
  event_id: identifier,
  title: title.optional(),
  notes: plainString(4000, true).optional().describe('Empty string clears notes; omission preserves them'),
  location: plainString(500).optional().describe('Empty string clears location; omission preserves it'),
}).strict();

export type GuardedCreateInput = z.infer<typeof guardedCalendarCreateEventSchema>;
export type GuardedRescheduleInput = z.infer<typeof guardedCalendarRescheduleEventSchema>;
export type GuardedUpdateInput = z.infer<typeof guardedCalendarUpdateEventSchema>;

function dateParts(date: Date, zone: string): number[] {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  return ['year', 'month', 'day', 'hour', 'minute', 'second'].map((key) => Number(parts.find((part) => part.type === key)?.value));
}

function civilMillis(values: number[]): number {
  const [year, month, day, hour = 0, minute = 0, second = 0] = values;
  // setUTCFullYear avoids Date.UTC's special treatment of years 00–99.
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);
  const actual = [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()];
  if (actual.some((value, index) => value !== [...values, 0, 0, 0].slice(0, 6)[index])) throw new Error('Invalid calendar date');
  return date.getTime();
}

function parseTimed(value: string, zone: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match || match[8] === '-00:00') throw new Error('Timed events require RFC 3339 with a known offset');
  const values = match.slice(1, 7).map(Number);
  const civil = civilMillis(values);
  const offset = match[8] === 'Z' ? 0 : (match[8][0] === '-' ? -1 : 1) * (Number(match[8].slice(1, 3)) * 60 + Number(match[8].slice(4)));
  if (match[8] !== 'Z' && (Number(match[8].slice(1, 3)) > 23 || Number(match[8].slice(4)) > 59)) throw new Error('Invalid UTC offset');
  const instant = civil - offset * 60_000 + Number((match[7] ?? '').padEnd(3, '0'));
  if (dateParts(new Date(instant), zone).some((part, index) => part !== values[index])) throw new Error('Offset does not match the IANA zone, or local time does not exist');
  return instant;
}

function parseAllDay(value: string, zone: string): { civil: number; instant: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error('All-day events require YYYY-MM-DD with an exclusive end');
  const values = match.slice(1).map(Number);
  const civil = civilMillis(values);
  let instant = civil;
  for (let i = 0; i < 3; i++) {
    const local = dateParts(new Date(instant), zone);
    instant += civil - civilMillis(local);
  }
  if (dateParts(new Date(instant), zone).some((part, index) => part !== [...values, 0, 0, 0][index])) throw new Error('All-day date does not resolve to midnight in its IANA zone');
  return { civil, instant };
}

/** Add calendar days while preserving wall-clock context, including DST changes. */
function calendarDayBound(instant: number, days: number, zone: string): number {
  const sourceCivil = civilMillis(dateParts(new Date(instant), zone));
  const targetCivil = sourceCivil + days * DAY;
  const fraction = ((instant % 1000) + 1000) % 1000;
  // Sampling either side captures both offsets at folds/gaps and date-line changes.
  const offsets = new Set([instant, targetCivil - 2 * DAY, targetCivil, targetCivil + 2 * DAY].map((sample) => {
    const whole = Math.floor(sample / 1000) * 1000;
    return civilMillis(dateParts(new Date(whole), zone)) - whole;
  }));
  const candidates = [...offsets].map((offset) => targetCivil - offset);
  const exact = candidates.filter((candidate) => civilMillis(dateParts(new Date(candidate), zone)) === targetCivil);
  if (exact.length) return Math.min(...exact) + fraction;
  // Calendar arithmetic advances through a nonexistent local time rather than
  // admitting an impossible caller-supplied local time (which parseTimed rejects).
  const advanced = candidates.filter((candidate) => civilMillis(dateParts(new Date(candidate), zone)) > targetCivil);
  if (advanced.length) return Math.min(...advanced) + fraction;
  throw new Error('Calendar-day bound cannot resolve in its IANA zone');
}

/** Validation is repeated inside Swift against the current EventKit object. */
export function validateGuardedRange(start: string, end: string, zone: string | null, allDay: boolean, now = Date.now(), floatingZone = Intl.DateTimeFormat().resolvedOptions().timeZone): void {
  // All-day dates float in the Mac's default zone. Swift repeats this check.
  if (allDay) zone = floatingZone;
  if (!zone) throw new Error('Timed events require an IANA zone');
  let first: number, last: number;
  if (allDay) {
    const a = parseAllDay(start, zone), b = parseAllDay(end, zone);
    first = a.instant; last = b.instant;
  } else {
    first = parseTimed(start, zone); last = parseTimed(end, zone);
  }
  if (last <= first || last > calendarDayBound(first, 31, zone)) throw new Error('Event end must follow start by at most 31 calendar days');
  if (first < calendarDayBound(now, -365, zone) || first > calendarDayBound(now, 3650, zone)) throw new Error('Event start is outside the permitted range');
}

export function parseGuardedCreate(input: unknown): GuardedCreateInput {
  const parsed = guardedCalendarCreateEventSchema.parse(input);
  validateGuardedRange(parsed.start, parsed.end, parsed.time_zone, parsed.is_all_day);
  return parsed;
}

export function parseGuardedReschedule(input: unknown): GuardedRescheduleInput {
  const parsed = guardedCalendarRescheduleEventSchema.parse(input);
  validateGuardedRange(parsed.start, parsed.end, parsed.time_zone, /^\d{4}-\d{2}-\d{2}$/.test(parsed.start));
  return parsed;
}

export function parseGuardedUpdate(input: unknown): GuardedUpdateInput {
  const parsed = guardedCalendarUpdateEventSchema.parse(input);
  if (parsed.title === undefined && parsed.notes === undefined && parsed.location === undefined) throw new Error('At least one of title, notes or location is required');
  return parsed;
}

export interface GuardedCalendarResult {
  outcome: 'saved' | 'refused' | 'unverified';
  event_id: string | null;
  calendar_id: string | null;
  changed_fields: string[];
  previous: Record<string, string | boolean | null>;
  reason?: string;
}

type GuardedIds = Pick<GuardedCalendarResult, 'event_id' | 'calendar_id'>;

/** Carries nothing from the failure itself: its text can quote the request. */
export function unverifiedGuardedResult(ids: GuardedIds): GuardedCalendarResult {
  return {
    outcome: 'unverified',
    ...ids,
    changed_fields: [],
    previous: {},
    reason: "The bridge's answer was lost or unreadable, so the save could not be confirmed and the previous values are unavailable. The event may have changed. Inspect it before retrying; never automatically retry an unverified create.",
  };
}

const isIdentifier = (value: unknown) => value === null || typeof value === 'string';

export function guardedResultOrUnverified(result: unknown, ids: GuardedIds): GuardedCalendarResult {
  const r = result as Partial<GuardedCalendarResult> | null;
  const valid = r !== null && typeof r === 'object'
    && (r.outcome === 'saved' || r.outcome === 'refused' || r.outcome === 'unverified')
    && isIdentifier(r.event_id) && isIdentifier(r.calendar_id)
    && Array.isArray(r.changed_fields)
    && r.previous !== null && typeof r.previous === 'object' && !Array.isArray(r.previous);
  return valid ? (r as GuardedCalendarResult) : unverifiedGuardedResult(ids);
}
