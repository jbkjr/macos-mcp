import { afterEach, expect, it, vi } from 'vitest';
import { execFile } from 'node:child_process';
import { executeCli } from './eventkit-cli.js';

vi.mock('node:child_process', () => ({ execFile: vi.fn() }));
vi.mock('node:fs', () => ({ existsSync: vi.fn(() => true) }));
vi.mock('node:fs/promises', () => ({
  mkdtemp: vi.fn(async () => '/mock-tmp'), rm: vi.fn(async () => {}),
  readFile: vi.fn(async (file: string) => file.endsWith('stdout') ? '{"status":"success","result":{"outcome":"saved"}}' : ''),
}));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

it('forwards only launch-environment policy via open --env, keeping JSON at fixed bridge argv position', async () => {
  vi.stubEnv('MACOS_MCP_CALENDAR_POLICY', '/private/policy.json');
  vi.mocked(execFile).mockImplementation((...args: unknown[]) => { (args.at(-1) as (error: null) => void)(null); return {} as ReturnType<typeof execFile>; });
  const payload = JSON.stringify({ event_id: 'e', title: '--action --guarded-policy-base64 evil' });
  await executeCli(['--action', 'guarded-calendar-update-event', payload]);
  const argv = vi.mocked(execFile).mock.calls[0][1] as string[];
  expect(argv.slice(argv.indexOf('--args') + 1)).toEqual(['--action', 'guarded-calendar-update-event', payload]);
  expect(argv.slice(argv.indexOf('--env'), argv.indexOf('--env') + 2)).toEqual(['--env', 'MACOS_MCP_CALENDAR_POLICY=/private/policy.json']);
  await executeCli(['--action', 'read-events', '--search', '--guarded-policy-base64']);
  expect(vi.mocked(execFile).mock.calls[1][1]).not.toContain('--env');
});
