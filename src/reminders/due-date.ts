/**
 * Due Date Check
 * Mirrors parseDueDateArgument in swift/Sources/BridgeCore/Dates.swift, so a
 * bad date is refused here even by a bridge built before that check existed
 * (that bridge silently drops it on create and clears the date on update).
 * tests/fixtures/due-date-cases.json keeps the two in step.
 */

const DUE_DATE =
  /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{1,2})(?::(\d{1,2})(?:\.\d+)?)?)?\s*(?:Z|[+-](\d{2})(?::?(\d{2}))?)?$/;

export function isBridgeDueDate(value: string): boolean {
  const match = DUE_DATE.exec(value.trim());
  if (!match) return false;
  const [year, month, day, hour, minute, second, offsetHours, offsetMinutes] = match.slice(1).map(Number);
  // Date.UTC rolls impossible dates forward, which is how the mismatch is caught.
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return false;
  if (hour > 23 || minute > 59 || second > 59) return false;
  return !(offsetHours > 18 || (offsetHours === 18 && offsetMinutes > 0) || offsetMinutes > 59);
}
