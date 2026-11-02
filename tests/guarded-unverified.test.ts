import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { connect, text } from './helpers.js';

// The real executeCli runs against a fake `open`, so no bridge can launch.
vi.mock('node:child_process', () => ({ execFile: vi.fn(), execFileSync: vi.fn(), execSync: vi.fn() }));
vi.mock('node:fs', () => ({ existsSync: vi.fn(() => true) }));
vi.mock('node:fs/promises', () => ({ mkdtemp: vi.fn(async () => '/mock-tmp'), rm: vi.fn(async () => {}), readFile: vi.fn(async () => '') }));

const NOW = Date.parse('2026-10-30T12:00:00Z');
const CREATE = { calendar_id: 'cal', title: 'Private title', start: '2026-11-01T10:00:00-07:00', end: '2026-11-01T11:00:00-07:00', time_zone: 'America/Denver', is_all_day: false };
const CALLS: [string, Record<string, unknown>, { event_id: string | null; calendar_id: string | null }][] = [
  ['guarded_calendar_create_event', CREATE, { event_id: null, calendar_id: 'cal' }],
  ['guarded_calendar_reschedule_event', { event_id: 'evt', start: CREATE.start, end: CREATE.end, time_zone: CREATE.time_zone }, { event_id: 'evt', calendar_id: null }],
  ['guarded_calendar_update_event', { event_id: 'evt', title: 'Private title' }, { event_id: 'evt', calendar_id: null }],
];

function bridgeWrites(stdout: string) {
  vi.mocked(readFile).mockImplementation((async (file: string) => (String(file).endsWith('stdout') ? stdout : '')) as typeof readFile);
}
function openExits(error: Error | null = null) {
  vi.mocked(execFile).mockImplementation(((...args: unknown[]) => { (args.at(-1) as (e: Error | null) => void)(error); return {}; }) as never);
}

describe('guarded calendar writes whose answer is lost', () => {
  let client: Client;
  let close: () => Promise<void>;
  beforeAll(async () => { ({ client, close } = await connect()); });
  afterAll(async () => { await close(); });
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'Date'], now: NOW });
    vi.mocked(existsSync).mockReturnValue(true);
    openExits();
  });
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

  async function call(name: string, args: Record<string, unknown>) {
    const pending = client.callTool({ name, arguments: args }, undefined, { timeout: 1e8 });
    await vi.advanceTimersByTimeAsync(400_000);
    return pending;
  }

  function expectUnverified(result: Awaited<ReturnType<typeof call>>, ids: { event_id: string | null; calendar_id: string | null }) {
    // Not isError: the gateway host records `previous`, and the gateway adds its no-retry note, only on a result.
    expect(result.isError).toBeFalsy();
    const body = JSON.parse(text(result));
    expect(body).toMatchObject({ outcome: 'unverified', ...ids, changed_fields: [], previous: {} });
    expect(body.reason).toMatch(/retry/i);
    expect(body.reason).not.toContain('Private title');
    expect(body.reason.length).toBeLessThanOrEqual(2000);
  }

  for (const [name, args, ids] of CALLS) {
    it(`${name}: empty output is unverified`, async () => {
      bridgeWrites('');
      expectUnverified(await call(name, args), ids);
    });
    it(`${name}: unparseable output is unverified`, async () => {
      bridgeWrites('{"status":"success","result":{"outco');
      expectUnverified(await call(name, args), ids);
    });
    it(`${name}: a result that is not the guarded shape is unverified`, async () => {
      bridgeWrites('{"status":"success","result":{"outcome":"saved"}}');
      expectUnverified(await call(name, args), ids);
    });
    it(`${name}: a failed open is unverified, without the payload in the reason`, async () => {
      bridgeWrites('');
      openExits(new Error(`Command failed: /usr/bin/open --args ${JSON.stringify(args)}`));
      expectUnverified(await call(name, args), ids);
    });
  }

  it('passes a real answer through untouched, undo record included', async () => {
    const answer = { outcome: 'saved', event_id: 'evt', calendar_id: 'cal', changed_fields: ['title'], previous: { title: 'old' } };
    bridgeWrites(JSON.stringify({ status: 'success', result: answer }));
    expect(JSON.parse(text(await call('guarded_calendar_update_event', { event_id: 'evt', title: 'x' })))).toEqual(answer);
    const refused = { outcome: 'refused', event_id: null, calendar_id: null, changed_fields: [], previous: {}, reason: 'not allowlisted' };
    bridgeWrites(JSON.stringify({ status: 'success', result: refused }));
    expect(JSON.parse(text(await call('guarded_calendar_create_event', CREATE)))).toEqual(refused);
  });

  it('a bridge that was never installed is a plain error: nothing can have been saved', async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    const result = await call('guarded_calendar_create_event', CREATE);
    expect(result.isError).toBe(true);
    expect(text(result)).toContain('not found');
    expect(execFile).not.toHaveBeenCalled();
  });

  it('input the schema refuses is still a plain error before any launch', async () => {
    const result = await call('guarded_calendar_create_event', { ...CREATE, title: '' });
    expect(result.isError).toBe(true);
    expect(execFile).not.toHaveBeenCalled();
  });
});
