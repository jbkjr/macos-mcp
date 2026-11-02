import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { closeDatabase, getChatDbPath } from '../src/messages/database.js';
import { executeCli } from '../src/utils/eventkit-cli.js';
import { connect, text } from './helpers.js';

// Only Contacts is faked. The SQL, timestamps and attributedBody decoding are real,
// against a chat.db built here from the columns Apple's private schema uses.
vi.mock('../src/utils/eventkit-cli.js', () => ({ executeCli: vi.fn() }));

const SCHEMA = `
  CREATE TABLE handle (ROWID INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL, service TEXT NOT NULL);
  CREATE TABLE chat (ROWID INTEGER PRIMARY KEY AUTOINCREMENT, guid TEXT NOT NULL UNIQUE, style INTEGER, chat_identifier TEXT, display_name TEXT);
  CREATE TABLE message (ROWID INTEGER PRIMARY KEY AUTOINCREMENT, guid TEXT NOT NULL UNIQUE, text TEXT, attributedBody BLOB, handle_id INTEGER DEFAULT 0, date INTEGER, is_from_me INTEGER DEFAULT 0, cache_has_attachments INTEGER DEFAULT 0);
  CREATE TABLE attachment (ROWID INTEGER PRIMARY KEY AUTOINCREMENT, guid TEXT NOT NULL UNIQUE, filename TEXT, mime_type TEXT, transfer_name TEXT, total_bytes INTEGER);
  CREATE TABLE chat_handle_join (chat_id INTEGER, handle_id INTEGER, UNIQUE(chat_id, handle_id));
  CREATE TABLE chat_message_join (chat_id INTEGER, message_id INTEGER, message_date INTEGER, PRIMARY KEY (chat_id, message_id));
  CREATE TABLE message_attachment_join (message_id INTEGER, attachment_id INTEGER, UNIQUE(message_id, attachment_id));
`;

const ALICE = '+15555550100';
const BOB = 'bob@example.com';
const nanos = (iso: string) => (Date.parse(iso) / 1000 - 978307200) * 1e9;
const typedBody = 'Only in attributedBody, a body longer than thirty-two characters';
const attributedBody = Buffer.concat([
  Buffer.from('streamtyped'), Buffer.alloc(5), Buffer.from('NSString'), Buffer.alloc(5), Buffer.from([typedBody.length]), Buffer.from(typedBody), Buffer.alloc(5),
]);

function seed(file: string) {
  const db = new Database(file);
  db.exec(SCHEMA);
  db.prepare('INSERT INTO handle (ROWID, id, service) VALUES (?, ?, ?)').run(1, ALICE, 'iMessage');
  db.prepare('INSERT INTO handle (ROWID, id, service) VALUES (?, ?, ?)').run(2, BOB, 'iMessage');
  const chat = db.prepare('INSERT INTO chat (ROWID, guid, style, chat_identifier, display_name) VALUES (?, ?, ?, ?, ?)');
  chat.run(1, 'iMessage;-;alice', 45, ALICE, null);
  chat.run(2, 'iMessage;+;group', 43, 'chat123', 'Scratch group');
  chat.run(3, 'iMessage;-;silent', 45, 'silent@example.com', null);
  const joinHandle = db.prepare('INSERT INTO chat_handle_join VALUES (?, ?)');
  joinHandle.run(1, 1); joinHandle.run(2, 1); joinHandle.run(2, 2);
  const message = db.prepare('INSERT INTO message (ROWID, guid, text, attributedBody, handle_id, date, is_from_me, cache_has_attachments) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const joinMessage = db.prepare('INSERT INTO chat_message_join VALUES (?, ?, ?)');
  const rows: [number, number, string | null, Buffer | null, number, string, number, number][] = [
    [1, 1, 'hello from alice', null, 1, '2026-01-01T10:00:00Z', 0, 0],
    [2, 1, 'hello back', null, 0, '2026-01-02T10:00:00Z', 1, 0],
    [3, 1, null, attributedBody, 1, '2026-01-03T10:00:00Z', 0, 0],
    [4, 2, 'group photo', null, 2, '2026-01-04T10:00:00Z', 0, 1],
    [5, 2, 'latest in group', null, 0, '2026-01-05T10:00:00Z', 1, 0],
  ];
  for (const [id, chatId, body, blob, handle, date, fromMe, hasAttachment] of rows) {
    message.run(id, `msg-${id}`, body, blob, handle, nanos(date), fromMe, hasAttachment);
    joinMessage.run(chatId, id, nanos(date));
  }
  db.prepare('INSERT INTO attachment VALUES (?, ?, ?, ?, ?, ?)').run(1, 'att-1', '~/Library/Messages/Attachments/a.jpg', 'image/jpeg', 'a.jpg', 1234);
  db.prepare('INSERT INTO message_attachment_join VALUES (?, ?)').run(4, 1);
  db.close();
}

describe('Messages SQL against a synthetic chat.db', () => {
  let home: string;
  let client: Client;
  let close: () => Promise<void>;
  const call = async <T>(name: string, args: Record<string, unknown> = {}): Promise<T> => {
    const result = await client.callTool({ name, arguments: args });
    expect(result.isError, text(result)).toBeFalsy();
    return JSON.parse(text(result)) as T;
  };
  const ids = (messages: { id: string }[]) => messages.map((m) => m.id);

  beforeAll(async () => {
    home = mkdtempSync(path.join(tmpdir(), 'macos-mcp-chatdb-'));
    vi.stubEnv('HOME', home);
    // Refuse to go on if the real database could be what opens.
    expect(getChatDbPath().startsWith(home)).toBe(true);
    mkdirSync(path.dirname(getChatDbPath()), { recursive: true });
    seed(getChatDbPath());
    ({ client, close } = await connect());
  });
  afterAll(async () => {
    await close();
    closeDatabase();
    vi.unstubAllEnvs();
    rmSync(home, { recursive: true, force: true });
  });
  beforeEach(() => { vi.mocked(executeCli).mockReset(); });

  it('list_message_chats orders by latest message, with participants and decoded last text', async () => {
    const chats = await call<Record<string, unknown>[]>('list_message_chats');
    expect(chats.map((c) => c.id).slice(0, 2)).toEqual(['2', '1']);
    expect(chats[0]).toMatchObject({ isGroup: true, displayName: 'Scratch group', lastMessageText: 'latest in group', lastMessageDate: '2026-01-05T10:00:00.000Z' });
    expect((chats[0].participants as { identifier: string }[]).map((p) => p.identifier).sort()).toEqual([ALICE, BOB].sort());
    expect(chats[1]).toMatchObject({ isGroup: false, chatIdentifier: ALICE, lastMessageText: typedBody });
    expect(await call<unknown[]>('list_message_chats', { limit: 1 })).toHaveLength(1);
  });

  it('get_message_chat finds a chat and reports a missing one', async () => {
    expect(await call('get_message_chat', { id: '3' })).toMatchObject({ chatIdentifier: 'silent@example.com', participants: [] });
    const missing = await client.callTool({ name: 'get_message_chat', arguments: { id: '99' } });
    expect(missing.isError).toBe(true);
  });

  it('list_messages applies each filter, most recent first', async () => {
    type M = { id: string };
    expect(ids(await call<M[]>('list_messages'))).toEqual(['5', '4', '3', '2', '1']);
    expect(ids(await call<M[]>('list_messages', { limit: 2 }))).toEqual(['5', '4']);
    expect(ids(await call<M[]>('list_messages', { chatId: '1' }))).toEqual(['3', '2', '1']);
    expect(ids(await call<M[]>('list_messages', { fromMe: true }))).toEqual(['5', '2']);
    expect(ids(await call<M[]>('list_messages', { fromMe: false }))).toEqual(['4', '3', '1']);
    expect(ids(await call<M[]>('list_messages', { afterDate: '2026-01-03T12:00:00Z' }))).toEqual(['5', '4']);
    expect(ids(await call<M[]>('list_messages', { beforeDate: '2026-01-02T12:00:00Z' }))).toEqual(['2', '1']);
    expect(ids(await call<M[]>('list_messages', { chatId: '1', fromMe: false, beforeDate: '2026-01-02T00:00:00Z' }))).toEqual(['1']);
  });

  it('list_messages resolves a contact to their chats', async () => {
    vi.mocked(executeCli).mockResolvedValue({ contacts: [{ fullName: 'Bob', phoneNumbers: [], emailAddresses: [{ email: BOB }] }] });
    expect(ids(await call<{ id: string }[]>('list_messages', { contact: 'Bob' }))).toEqual(['5', '4']);
    vi.mocked(executeCli).mockResolvedValue({ contacts: [] });
    expect(await call('list_messages', { contact: 'Nobody' })).toEqual([]);
  });

  it('get_message returns every field, decoding attributedBody', async () => {
    expect(await call('get_message', { id: '3' })).toEqual({
      id: '3', guid: 'msg-3', text: typedBody, date: '2026-01-03T10:00:00.000Z', isFromMe: false, chatId: '1', senderHandle: ALICE, hasAttachments: false,
    });
    expect(await call('get_message', { id: '2' })).toMatchObject({ isFromMe: true, text: 'hello back' });
    expect(await call('get_message', { id: '4' })).toMatchObject({ senderHandle: BOB, hasAttachments: true, chatId: '2' });
    expect((await client.callTool({ name: 'get_message', arguments: { id: '99' } })).isError).toBe(true);
  });

  it('search_messages matches text, within a chat when asked', async () => {
    type M = { id: string };
    expect(ids(await call<M[]>('search_messages', { query: 'hello' }))).toEqual(['2', '1']);
    expect(ids(await call<M[]>('search_messages', { query: 'group' }))).toEqual(['5', '4']);
    expect(ids(await call<M[]>('search_messages', { query: 'group', chatId: '1' }))).toEqual([]);
    expect(ids(await call<M[]>('search_messages', { query: 'hello', limit: 1 }))).toEqual(['2']);
  });

  it('attachments list and get, by chat and by message', async () => {
    const expected = { id: '1', guid: 'att-1', filename: '~/Library/Messages/Attachments/a.jpg', mimeType: 'image/jpeg', transferName: 'a.jpg', totalBytes: 1234, messageId: '4' };
    expect(await call('list_message_attachments')).toEqual([expected]);
    expect(await call('list_message_attachments', { chatId: '2' })).toEqual([expected]);
    expect(await call('list_message_attachments', { messageId: '4' })).toEqual([expected]);
    expect(await call('list_message_attachments', { chatId: '1' })).toEqual([]);
    expect(await call('get_message_attachment', { id: '1' })).toEqual(expected);
    expect((await client.callTool({ name: 'get_message_attachment', arguments: { id: '99' } })).isError).toBe(true);
  });
});
