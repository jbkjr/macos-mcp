import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { executeCli } from '../src/utils/eventkit-cli.js';
import { connect, text } from './helpers.js';

vi.mock('../src/utils/eventkit-cli.js', () => ({ executeCli: vi.fn() }));

const ID = '11111111-2222-3333-4444-555555555555';

/** Every argument the gateway can send: mcp-gateway src/catalog/{macos,reminders-write,calendar-write}.ts, host/macos_host.py. */
const GATEWAY_CALLS: [string, Record<string, unknown>][] = [
  ['list_calendars', {}],
  ['list_calendar_events', { startDate: '2026-11-01 00:00:00', endDate: '2026-11-08 00:00:00', filterCalendar: 'Home', search: 'x' }],
  ['get_calendar_event', { id: ID }],
  ['list_reminder_lists', {}],
  ['list_reminders', { filterList: 'Home', showCompleted: true, search: 'x', dueWithin: 'today', priority: 'high' }],
  ['get_reminder', { id: ID }],
  ['create_reminder', { title: 'a', notes: 'b', dueDate: '2026-11-02 09:00:00', targetList: 'Home', priority: 'low' }],
  ['create_reminder', { title: 'a', dueDate: '2026-11-02' }],
  ['update_reminder', { id: ID, title: 'a', notes: '', dueDate: '2026-11-02', targetList: 'Home' }],
  ['update_reminder', { id: ID, completed: true }],
  ['guarded_calendar_create_event', { calendar_id: 'c', title: 'a', start: '2026-11-02', end: '2026-11-03', time_zone: null, is_all_day: true, notes: 'n', location: 'l' }],
  ['guarded_calendar_reschedule_event', { event_id: 'e', start: '2026-11-02', end: '2026-11-03', time_zone: null }],
  ['guarded_calendar_update_event', { event_id: 'e', title: 'a', notes: 'n', location: 'l' }],
];

describe('strict tool inputs', () => {
  let client: Client;
  let close: () => Promise<void>;
  beforeAll(async () => { ({ client, close } = await connect()); });
  afterAll(async () => { await close(); });
  beforeEach(() => {
    vi.mocked(executeCli).mockReset();
    vi.mocked(executeCli).mockResolvedValue({ outcome: 'saved', event_id: 'e', calendar_id: 'c', changed_fields: [], previous: {} });
  });

  it('refuses the isCompleted pitfall, names the allowed keys and changes nothing', async () => {
    const result = await client.callTool({ name: 'update_reminder', arguments: { id: ID, isCompleted: true } });
    expect(result.isError).toBe(true);
    expect(text(result)).toContain('isCompleted');
    expect(text(result)).toContain('completed');
    expect(executeCli).not.toHaveBeenCalled();
  });

  it('refuses an unknown key on every tool', async () => {
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(42);
    for (const tool of tools) {
      expect(tool.inputSchema.additionalProperties, tool.name).toBe(false);
      const result = await client.callTool({ name: tool.name, arguments: { definitelyNotAParameter: 1 } });
      expect(result.isError, tool.name).toBe(true);
      expect(text(result), tool.name).toContain('definitelyNotAParameter');
    }
    expect(executeCli).not.toHaveBeenCalled();
  });

  it('refuses unknown keys in nested objects', async () => {
    const calls: [string, Record<string, unknown>][] = [
      ['create_reminder', { title: 'a', recurrence: { frequency: 'daily', every: 2 } }],
      ['create_reminder', { title: 'a', recurrence: { frequency: 'weekly', daysOfTheWeek: [{ dayOfWeek: 1, day: 2 }] } }],
      ['create_reminder', { title: 'a', recurrence: { frequency: 'daily', end: { type: 'count', after: 2 } } }],
      ['create_contact', { givenName: 'a', phoneNumbers: [{ number: '1', kind: 'x' }] }],
      ['create_contact', { givenName: 'a', emailAddresses: [{ email: 'a@b.c', kind: 'x' }] }],
      ['create_contact', { givenName: 'a', postalAddresses: [{ city: 'x', zip: '1' }] }],
      ['create_contact', { givenName: 'a', urlAddresses: [{ url: 'x', kind: 'x' }] }],
    ];
    for (const [name, args] of calls) {
      const result = await client.callTool({ name, arguments: args });
      expect(result.isError, JSON.stringify(args)).toBe(true);
    }
    expect(executeCli).not.toHaveBeenCalled();
  });

  it('still accepts every argument the gateway passes', async () => {
    for (const [name, args] of GATEWAY_CALLS) {
      vi.mocked(executeCli).mockClear();
      const result = await client.callTool({ name, arguments: args });
      expect(result.isError, `${name}: ${text(result)}`).toBeFalsy();
      expect(executeCli, name).toHaveBeenCalledTimes(1);
    }
  });

  it('still accepts a no-argument call with arguments omitted', async () => {
    for (const name of ['list_calendars', 'list_reminder_lists', 'list_reminders', 'list_contact_groups']) {
      const result = await client.callTool({ name });
      expect(result.isError, `${name}: ${text(result)}`).toBeFalsy();
    }
  });

  it('says IDs must be full UUIDs when one is not found', async () => {
    vi.mocked(executeCli).mockRejectedValue(new Error("ID 'ABC123' not found."));
    for (const [name, args] of [['update_reminder', { id: 'ABC123', completed: true }], ['get_reminder', { id: 'ABC123' }], ['delete_reminder', { id: 'ABC123' }], ['get_calendar_event', { id: 'ABC123' }], ['get_contact', { id: 'ABC123' }]] as const) {
      const result = await client.callTool({ name, arguments: args });
      expect(result.isError, name).toBe(true);
      expect(text(result), name).toContain('not found');
      expect(text(result), name).toContain('full UUID');
    }
  });
});
