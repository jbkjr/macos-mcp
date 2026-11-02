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

  describe('recipient by name', () => {
    const doe = { fullName: 'John Doe', phoneNumbers: [{ number: NUMBER }, { number: '+15555550101' }], emailAddresses: [] };
    const send = (recipient: string) => client.callTool({ name: 'send_message', arguments: { recipient, text: 'hi' } });
    const expectRefused = (result: Awaited<ReturnType<typeof send>>, message: string) => {
      expect(result.isError).toBe(true);
      expect(text(result)).toContain(message);
      expect(runAppleScriptWithArgs).not.toHaveBeenCalled();
    };

    it('sends to a single contact whose full name matches exactly, using the number it reports', async () => {
      vi.mocked(executeCli).mockResolvedValue({ contacts: [doe] });
      const result = await send('John Doe');
      expect(result.isError).toBeFalsy();
      expect(vi.mocked(runAppleScriptWithArgs).mock.calls[0][1]).toEqual([NUMBER, 'hi']);
      expect(JSON.parse(text(result)).recipient).toBe(NUMBER);
    });

    it.each(['John', 'Doe', 'john doe', 'John  Doe', 'Jon Doe'])('refuses %j when the only fuzzy hit is not an exact match', async (name) => {
      vi.mocked(executeCli).mockResolvedValue({ contacts: [doe] });
      expectRefused(await send(name), 'John Doe');
    });

    it('refuses several exact matches, listing them', async () => {
      vi.mocked(executeCli).mockResolvedValue({ contacts: [doe, { ...doe, phoneNumbers: [{ number: '+15555550102' }] }] });
      expectRefused(await send('John Doe'), 'Multiple contacts');
    });

    it('refuses when nothing matches', async () => {
      vi.mocked(executeCli).mockResolvedValue({ contacts: [] });
      expectRefused(await send('Nobody Here'), 'No contact found');
    });

    it('refuses when the resolver fails, and never falls back to the raw name', async () => {
      vi.mocked(executeCli).mockRejectedValue(new Error('EventKit CLI execution failed: timed out'));
      expectRefused(await send('John Doe'), 'nothing was sent');
    });

    it('refuses an exact match with no phone or email', async () => {
      vi.mocked(executeCli).mockResolvedValue({ contacts: [{ ...doe, phoneNumbers: [] }] });
      expectRefused(await send('John Doe'), 'no phone numbers');
    });

    it('treats something that only contains @ as a name, not an address', async () => {
      vi.mocked(executeCli).mockResolvedValue({ contacts: [] });
      expectRefused(await send('Jack @ Home'), 'No contact found');
      expect(executeCli).toHaveBeenCalled();
    });

    it('sends to a phone or email directly without consulting contacts', async () => {
      for (const recipient of [NUMBER, '(555) 555-0100', 'someone@example.com']) {
        expect((await send(recipient)).isError).toBeFalsy();
      }
      expect(executeCli).not.toHaveBeenCalled();
      expect(runAppleScriptWithArgs).toHaveBeenCalledTimes(3);
    });
  });
});
