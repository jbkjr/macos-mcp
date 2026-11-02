import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { executeCli } from '../src/utils/eventkit-cli.js';
import { connect, text } from './helpers.js';

vi.mock('../src/utils/eventkit-cli.js', () => ({ executeCli: vi.fn() }));

const ID = '11111111-2222-3333-4444-555555555555';
const v = '--completed';
const phone = [{ label: v, number: v }];
const CALLS: [string, Record<string, unknown>][] = [
  ['list_calendar_events', { filterCalendar: v, search: v }],
  ['create_calendar_event', { title: v, startDate: '2026-11-02', endDate: '2026-11-03', targetCalendar: v, notes: v, location: v, isAllDay: true }],
  ['update_calendar_event', { id: ID, title: v, targetCalendar: v, notes: v, location: v, url: v, isAllDay: false }],
  ['create_reminder_list', { name: v }],
  ['rename_reminder_list', { name: v, newName: v }],
  ['list_reminders', { filterList: v, showCompleted: false, search: v }],
  ['create_reminder', { title: v, targetList: v, notes: v, recurrence: { frequency: 'daily' } }],
  ['update_reminder', { id: ID, title: v, targetList: v, notes: v, url: '', dueDate: '', completed: false, recurrence: null }],
  ['search_contacts', { name: v, phone: v, email: v }],
  ['list_contacts', { groupId: v, limit: 5 }],
  ['create_contact', { givenName: v, note: v, birthday: v, phoneNumbers: phone }],
  ['update_contact', { id: ID, givenName: v, birthday: '', note: v, phoneNumbers: phone }],
];

// The bridge's parser (swift/Sources/BridgeCore/Arguments.swift) requires exactly this shape.
describe('bridge argv', () => {
  let client: Client;
  let close: () => Promise<void>;
  beforeAll(async () => { ({ client, close } = await connect()); });
  afterAll(async () => { await close(); });
  beforeEach(() => { vi.mocked(executeCli).mockReset(); vi.mocked(executeCli).mockResolvedValue({ contacts: [] }); });

  it.each(CALLS)('%s sends only --flag value pairs, with dashed values in value position', async (name, args) => {
    const result = await client.callTool({ name, arguments: args });
    expect(result.isError, text(result)).toBeFalsy();
    const argv = vi.mocked(executeCli).mock.calls[0][0];
    expect(argv.length % 2).toBe(0);
    const flags = argv.filter((_, index) => index % 2 === 0);
    for (const flag of flags) expect(flag).toMatch(/^--[A-Za-z]+$/);
    expect(new Set(flags).size).toBe(flags.length);
    expect(flags).not.toContain(name === 'update_reminder' ? '--isAllDay' : '--completed');
  });
});
