import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { connect } from './helpers.js';

vi.mock('../src/utils/eventkit-cli.js', () => ({ executeCli: vi.fn() }));

const GOLDEN = new URL('./golden/tools-list.json', import.meta.url);

/**
 * mcp-gateway pins these (audit "Cross-repo contracts"; its src/workers.ts verifyContract):
 * `sent` must all be advertised and `required` must stay within `alwaysSent`. Stated here
 * separately so regenerating the golden file cannot quietly break the gateway.
 */
const GATEWAY: Record<string, { sent: string[]; alwaysSent: string[] }> = {
  list_calendars: { sent: [], alwaysSent: [] },
  list_calendar_events: { sent: ['startDate', 'endDate', 'filterCalendar', 'search'], alwaysSent: ['startDate', 'endDate'] },
  get_calendar_event: { sent: ['id'], alwaysSent: ['id'] },
  list_reminder_lists: { sent: [], alwaysSent: [] },
  list_reminders: { sent: ['filterList', 'showCompleted', 'search', 'dueWithin', 'priority'], alwaysSent: ['showCompleted'] },
  get_reminder: { sent: ['id'], alwaysSent: ['id'] },
  create_reminder: { sent: ['title', 'notes', 'dueDate', 'targetList', 'priority'], alwaysSent: ['title'] },
  update_reminder: { sent: ['id', 'title', 'notes', 'dueDate', 'targetList', 'completed'], alwaysSent: ['id'] },
  guarded_calendar_create_event: { sent: ['calendar_id', 'title', 'start', 'end', 'time_zone', 'is_all_day', 'notes', 'location'], alwaysSent: ['calendar_id', 'title', 'start', 'end', 'time_zone', 'is_all_day'] },
  guarded_calendar_reschedule_event: { sent: ['event_id', 'start', 'end', 'time_zone'], alwaysSent: ['event_id', 'start', 'end', 'time_zone'] },
  guarded_calendar_update_event: { sent: ['event_id', 'title', 'notes', 'location'], alwaysSent: ['event_id'] },
};

describe('tools/list', () => {
  let client: Client;
  let close: () => Promise<void>;
  beforeAll(async () => { ({ client, close } = await connect()); });
  afterAll(async () => { await close(); });

  // Regenerate on an intended change with: UPDATE_GOLDEN=1 npx vitest run tests/tools-list.test.ts
  it('matches the golden file', async () => {
    const actual = `${JSON.stringify({ instructions: client.getInstructions(), tools: (await client.listTools()).tools }, null, 2)}\n`;
    if (process.env.UPDATE_GOLDEN || !existsSync(GOLDEN)) writeFileSync(GOLDEN, actual);
    expect(actual).toBe(readFileSync(GOLDEN, 'utf8'));
  });

  it('keeps all 42 tool names', async () => {
    expect((await client.listTools()).tools).toHaveLength(42);
  });

  it.each(Object.entries(GATEWAY))('keeps the gateway contract for %s', async (name, { sent, alwaysSent }) => {
    const tool = (await client.listTools()).tools.find((t) => t.name === name);
    expect(tool?.inputSchema.type).toBe('object');
    expect(Object.keys(tool?.inputSchema.properties ?? {})).toEqual(expect.arrayContaining(sent));
    for (const key of tool?.inputSchema.required ?? []) expect(alwaysSent).toContain(key);
  });
});
