import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { registerCalendarTools } from './index.js';
import { CalendarService } from './service.js';
import { executeCli } from '../utils/eventkit-cli.js';
import { parseGuardedCreate, parseGuardedReschedule, parseGuardedUpdate, validateGuardedRange } from './guarded.js';

vi.mock('../utils/eventkit-cli.js', () => ({ executeCli: vi.fn() }));
const create = { calendar_id: 'cal', title: 'event', start: '2026-11-01T10:00:00-07:00', end: '2026-11-01T11:00:00-07:00', time_zone: 'America/Denver', is_all_day: false };

describe('thin guarded calendar', () => {
  beforeEach(() => { vi.mocked(executeCli).mockReset(); vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-30T12:00:00Z')); });
  afterEach(() => { vi.restoreAllMocks(); });
  it('validates strict fields, text limits and controls', () => {
    expect(parseGuardedCreate(create)).toEqual(create);
    for (const patch of [{ request_id: 'old' }, { revision_token: 'old' }, { url: 'x' }, { title: 'a'.repeat(301) }, { location: 'a'.repeat(501) }, { notes: 'a'.repeat(4001) }, { title: 'a\u200bb' }, { title: 'a\nb' }, { notes: 'a\rb' }]) {
      expect(() => parseGuardedCreate({ ...create, ...patch })).toThrow();
    }
    expect(parseGuardedUpdate({ event_id: 'e', notes: 'a\n\tb', location: '' }).notes).toBe('a\n\tb');
    expect(() => parseGuardedUpdate({ event_id: 'e' })).toThrow();
    expect(() => parseGuardedUpdate({ event_id: 'e', title: 'x', start: create.start })).toThrow();
  });
  it('requires real RFC3339 dates, matching offsets, IANA zones and bounds', () => {
    for (const patch of [{ time_zone: null }, { time_zone: '-07:00' }, { start: '2026-11-01T10:00:00' }, { start: '2026-11-01T10:00:00-06:00' }, { end: create.start }, { end: '2026-12-03T10:00:00-07:00' }, { start: '2026-02-30T10:00:00-07:00' }]) {
      expect(() => parseGuardedCreate({ ...create, ...patch })).toThrow();
    }
    const now = Date.parse('2026-10-30T00:00:00Z');
    expect(() => validateGuardedRange('2025-01-01T00:00:00Z', '2025-01-02T00:00:00Z', 'UTC', false, now)).toThrow();
    expect(() => validateGuardedRange('2037-01-01T00:00:00Z', '2037-01-02T00:00:00Z', 'UTC', false, now)).toThrow();
    expect(() => validateGuardedRange('2027-03-14T02:30:00-07:00', '2027-03-14T04:00:00-06:00', 'America/Denver', false, now)).toThrow();
  });
  it('accepts floating date-only all-day values with a null zone and exclusive end', () => {
    const allDay = { ...create, start: '2026-11-01', end: '2026-11-02', time_zone: null, is_all_day: true };
    expect(parseGuardedCreate(allDay)).toEqual(allDay);
    expect(parseGuardedReschedule({ event_id: 'e', start: allDay.start, end: allDay.end, time_zone: null })).toBeDefined();
    expect(() => parseGuardedCreate({ ...allDay, end: allDay.start })).toThrow();
    expect(() => parseGuardedCreate({ ...allDay, start: create.start })).toThrow();
  });
  it('passes one fixed-position JSON payload without legacy flags', async () => {
    const service = new CalendarService(), title = '--action --guarded-policy-base64 malicious';
    await service.guardedCreateEvent({ ...create, title });
    await service.guardedRescheduleEvent({ event_id: 'e', start: create.start, end: create.end, time_zone: create.time_zone });
    await service.guardedUpdateEvent({ event_id: 'e', title });
    expect(vi.mocked(executeCli).mock.calls.map(([args]) => [args.length, args[0], args[1], JSON.parse(args[2])])).toEqual([
      [3, '--action', 'guarded-calendar-create-event', { ...create, title }],
      [3, '--action', 'guarded-calendar-reschedule-event', { event_id: 'e', start: create.start, end: create.end, time_zone: create.time_zone }],
      [3, '--action', 'guarded-calendar-update-event', { event_id: 'e', title }],
    ]);
  });
  it('rejects unknown fields through the actual MCP SDK registration', async () => {
    const server = new McpServer({ name: 'test', version: '1' }); registerCalendarTools(server);
    const client = new Client({ name: 'test', version: '1' });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(a), client.connect(b)]);
    try {
      const tools = await client.listTools();
      expect(tools.tools.filter(t => t.name.startsWith('guarded_'))).toHaveLength(3);
      const response = await client.callTool({ name: 'guarded_calendar_update_event', arguments: { event_id: 'e', title: 'x', calendar_id: 'other' } });
      expect(response.isError).toBe(true); expect(executeCli).not.toHaveBeenCalled();
    } finally { await client.close(); await server.close(); }
  });
});
