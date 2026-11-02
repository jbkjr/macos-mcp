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

const OK = '{"status":"success","result":[]}';
type Options = { timeout?: number };
type Callback = (error: Error | null, stdout?: string, stderr?: string) => void;

/** Honours the timeout option the way node does: without one, `open -W` waits forever. */
function hangingProcess() {
  vi.mocked(execFile).mockImplementation(((_file: string, _args: string[], options: Options, callback: Callback) => {
    if (options.timeout) setTimeout(() => callback(Object.assign(new Error('Command failed'), { killed: true, signal: 'SIGTERM' })), options.timeout);
    return {};
  }) as never);
}
function keventRace() {
  vi.mocked(execFile).mockImplementation(((_file: string, _args: string[], _options: Options, callback: Callback) => {
    callback(new Error('Unable to block on applications (initial call to kevent() failed)'));
    return {};
  }) as never);
}
function bridgeWritesAt(ms: number) {
  const ready = Date.now() + ms;
  vi.mocked(readFile).mockImplementation((async (file: string) => (String(file).endsWith('stdout') && Date.now() >= ready ? OK : '')) as typeof readFile);
}

describe('bridge calls cannot hang forever', () => {
  let client: Client;
  let close: () => Promise<void>;
  beforeAll(async () => { ({ client, close } = await connect()); });
  afterAll(async () => { await close(); });
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'Date'] });
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFile).mockReset();
    vi.mocked(readFile).mockResolvedValue('' as never);
  });
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

  async function settle<T>(pending: Promise<T>): Promise<T | 'still running'> {
    const outcome = Promise.race([pending, new Promise<'still running'>((resolve) => setTimeout(() => resolve('still running'), 1_000_000))]);
    await vi.advanceTimersByTimeAsync(1_000_000);
    return outcome;
  }
  const call = (name: string, args: Record<string, unknown> = {}) => client.callTool({ name, arguments: args }, undefined, { timeout: 1e8 });

  it('a hung open -W times out with an error', async () => {
    hangingProcess();
    const result = await settle(call('list_calendars'));
    expect(result).not.toBe('still running');
    expect((result as { isError?: boolean }).isError).toBe(true);
    expect(text(result)).toContain('timed out');
  });

  it('a hung bare binary times out too', async () => {
    hangingProcess();
    vi.mocked(existsSync).mockImplementation((file) => !String(file).endsWith('.app'));
    const result = await settle(call('list_calendars'));
    expect(result).not.toBe('still running');
    expect((result as { isError?: boolean }).isError).toBe(true);
  });

  it('allows long enough for someone to answer a TCC prompt', async () => {
    hangingProcess();
    await settle(call('list_calendars'));
    const options = vi.mocked(execFile).mock.calls[0][2] as Options;
    expect(options.timeout).toBeGreaterThanOrEqual(120_000);
  });

  it('after a kevent race, keeps waiting through a TCC prompt for the answer', async () => {
    keventRace();
    bridgeWritesAt(100_000);
    const result = await settle(call('list_calendars'));
    expect((result as { isError?: boolean }).isError).toBeFalsy();
    expect(JSON.parse(text(result))).toEqual([]);
  });

  it('after a kevent race with no answer, gives up rather than polling forever', async () => {
    keventRace();
    const result = await settle(call('list_calendars'));
    expect(result).not.toBe('still running');
    expect((result as { isError?: boolean }).isError).toBe(true);
  });

  it('a guarded write that times out is unverified, not an error', async () => {
    hangingProcess();
    const result = await settle(call('guarded_calendar_update_event', { event_id: 'evt', title: 'x' }));
    expect(result).not.toBe('still running');
    expect((result as { isError?: boolean }).isError).toBeFalsy();
    expect(JSON.parse(text(result))).toMatchObject({ outcome: 'unverified', event_id: 'evt' });
  });
});
