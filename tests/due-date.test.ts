import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { executeCli } from '../src/utils/eventkit-cli.js';
import { connect, text } from './helpers.js';

vi.mock('../src/utils/eventkit-cli.js', () => ({ executeCli: vi.fn() }));

const cases = JSON.parse(readFileSync(new URL('./fixtures/due-date-cases.json', import.meta.url), 'utf8')) as { accepted: string[]; refused: string[] };
const ID = '11111111-2222-3333-4444-555555555555';

describe('reminder due dates', () => {
  let client: Client;
  let close: () => Promise<void>;
  beforeAll(async () => { ({ client, close } = await connect()); });
  afterAll(async () => { await close(); });
  beforeEach(() => { vi.mocked(executeCli).mockReset(); vi.mocked(executeCli).mockResolvedValue({}); });

  it.each(cases.refused)('refuses %j and never reaches the bridge', async (dueDate) => {
    for (const [name, args] of [['update_reminder', { id: ID, dueDate }], ['create_reminder', { title: 'a', dueDate }]] as const) {
      const result = await client.callTool({ name, arguments: args });
      expect(result.isError, name).toBe(true);
      expect(text(result), name).toContain('dueDate');
    }
    expect(executeCli).not.toHaveBeenCalled();
  });

  it.each(cases.accepted)('accepts %j', async (dueDate) => {
    const result = await client.callTool({ name: 'update_reminder', arguments: { id: ID, dueDate } });
    expect(result.isError).toBeFalsy();
    expect(vi.mocked(executeCli).mock.calls[0][0]).toContain(dueDate);
  });

  it('still clears a due date with an empty string on update, and create treats it as no date', async () => {
    expect((await client.callTool({ name: 'update_reminder', arguments: { id: ID, dueDate: '' } })).isError).toBeFalsy();
    expect(vi.mocked(executeCli).mock.calls[0][0]).toEqual(['--action', 'update-reminder', '--id', ID, '--dueDate', '']);
    expect((await client.callTool({ name: 'create_reminder', arguments: { title: 'a', dueDate: '' } })).isError).toBeFalsy();
  });
});
