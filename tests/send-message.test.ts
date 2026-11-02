import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { runAppleScriptWithArgs } from '../src/utils/applescript.js';
import { executeCli } from '../src/utils/eventkit-cli.js';
import { connect, text } from './helpers.js';

// Both seams are replaced, so no test here can reach Messages.app or Contacts.
vi.mock('../src/utils/eventkit-cli.js', () => ({ executeCli: vi.fn() }));
vi.mock('../src/utils/applescript.js', () => ({
  runAppleScript: vi.fn(),
  runAppleScriptWithArgs: vi.fn(() => ({ success: true, output: '' })),
  escapeForAppleScript: (value: string) => value,
}));

const NUMBER = '+15555550100';

describe('send_message', () => {
  let client: Client;
  let close: () => Promise<void>;
  beforeAll(async () => { ({ client, close } = await connect()); });
  afterAll(async () => { await close(); });
  beforeEach(() => {
    vi.mocked(executeCli).mockReset();
    vi.mocked(runAppleScriptWithArgs).mockClear();
  });

  it.each([
    ['blank lines', 'first\n\nthird\n\n\nsixth'],
    ['indentation', 'list:\n    - item\n\t- tabbed'],
    ['leading and trailing whitespace', '  padded  \n'],
    ['quotes and backslashes', 'say "hi" \\ it\'s fine'],
    ['script-like text', '" & (do shell script "x") & "'],
    ['carriage returns', 'a\r\nb'],
  ])('passes %s through exactly, as data rather than script', async (_label, body) => {
    const result = await client.callTool({ name: 'send_message', arguments: { recipient: NUMBER, text: body } });
    expect(result.isError).toBeFalsy();
    const [script, args] = vi.mocked(runAppleScriptWithArgs).mock.calls[0];
    expect(args).toEqual([NUMBER, body]);
    expect(script).not.toContain(NUMBER);
    expect(script).not.toContain(body);
    expect(JSON.parse(text(result)).message).toBe(body);
  });
});
