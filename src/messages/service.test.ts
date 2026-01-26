/**
 * Messages Service Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MessagesService } from './service.js';

// Mock the database module
vi.mock('./database.js', () => ({
  getDatabase: vi.fn(),
  macosTimestampToISO: vi.fn((ts) => ts ? new Date(ts / 1e9 * 1000 + 978307200000).toISOString() : undefined),
  isoToMacosTimestamp: vi.fn((iso) => (new Date(iso).getTime() / 1000 - 978307200) * 1e9),
}));

// Mock the parser module - return actual text from the text column or empty string
vi.mock('./parser.js', async () => {
  return {
    getMessageText: (text: string | null, _blob: Buffer | null) => text || '',
  };
});

// Mock the applescript module
vi.mock('../utils/applescript.js', () => ({
  runAppleScript: vi.fn(),
  escapeForAppleScript: vi.fn((str) => str),
}));

// Mock the CLI executor
vi.mock('../utils/eventkit-cli.js', () => ({
  executeCli: vi.fn(),
}));

describe('MessagesService', () => {
  let service: MessagesService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDb: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockStmt: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let getDatabaseMock: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let runAppleScriptMock: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let executeCliMock: any;

  beforeEach(async () => {
    service = new MessagesService();

    // Set up database mock
    mockStmt = {
      all: vi.fn(),
      get: vi.fn(),
    };
    mockDb = {
      prepare: vi.fn(() => mockStmt),
    };

    const dbModule = await import('./database.js');
    getDatabaseMock = dbModule.getDatabase;
    getDatabaseMock.mockReturnValue(mockDb);

    const asModule = await import('../utils/applescript.js');
    runAppleScriptMock = asModule.runAppleScript;

    const cliModule = await import('../utils/eventkit-cli.js');
    executeCliMock = cliModule.executeCli;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('listChats', () => {
    it('should return list of chats', async () => {
      const mockChats = [
        { ROWID: 1, guid: 'chat-1', chat_identifier: '+1234567890', display_name: null, style: 45 },
        { ROWID: 2, guid: 'chat-2', chat_identifier: 'chat123', display_name: 'Family', style: 43 },
      ];
      mockStmt.all.mockReturnValueOnce(mockChats);
      // Mock participants query (empty for simplicity)
      mockStmt.all.mockReturnValue([]);
      // Mock last message query
      mockStmt.get.mockReturnValue(null);

      const result = await service.listChats();

      expect(getDatabaseMock).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1');
      expect(result[0].isGroup).toBe(false);
      expect(result[1].isGroup).toBe(true);
      expect(result[1].displayName).toBe('Family');
    });

    it('should respect limit parameter', async () => {
      mockStmt.all.mockReturnValueOnce([]);

      await service.listChats({ limit: 10 });

      expect(mockDb.prepare).toHaveBeenCalled();
      const query = mockDb.prepare.mock.calls[0][0];
      expect(query).toContain('LIMIT ?');
    });
  });

  describe('getChat', () => {
    it('should return single chat by ID', async () => {
      const mockChat = { ROWID: 1, guid: 'chat-1', chat_identifier: '+1234567890', display_name: null, style: 45 };
      mockStmt.get.mockReturnValueOnce(mockChat);
      // Mock participants
      mockStmt.all.mockReturnValueOnce([{ ROWID: 1, id: '+1234567890', service: 'iMessage' }]);
      // Mock last message
      mockStmt.get.mockReturnValueOnce({ date: 1700000000000000000, text: 'Hello', attributedBody: null });

      const result = await service.getChat('1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('1');
      expect(result?.participants).toHaveLength(1);
    });

    it('should return undefined for non-existent chat', async () => {
      mockStmt.get.mockReturnValueOnce(undefined);

      const result = await service.getChat('999');

      expect(result).toBeUndefined();
    });
  });

  describe('listMessages', () => {
    it('should return list of messages', async () => {
      const mockMessages = [
        { ROWID: 1, guid: 'msg-1', text: 'Hello', attributedBody: null, date: 1700000000000000000, is_from_me: 1, handle_id: 0, cache_has_attachments: 0, chat_id: 1 },
        { ROWID: 2, guid: 'msg-2', text: 'Hi there', attributedBody: null, date: 1700000001000000000, is_from_me: 0, handle_id: 1, cache_has_attachments: 0, chat_id: 1 },
      ];
      mockStmt.all.mockReturnValueOnce(mockMessages);

      const result = await service.listMessages();

      expect(result).toHaveLength(2);
      expect(result[0].text).toBe('Hello');
      expect(result[0].isFromMe).toBe(true);
    });

    it('should filter by chatId', async () => {
      mockStmt.all.mockReturnValueOnce([]);

      await service.listMessages({ chatId: '1' });

      const query = mockDb.prepare.mock.calls[0][0];
      expect(query).toContain('cmj.chat_id = ?');
    });

    it('should filter by fromMe', async () => {
      mockStmt.all.mockReturnValueOnce([]);

      await service.listMessages({ fromMe: true });

      const query = mockDb.prepare.mock.calls[0][0];
      expect(query).toContain('m.is_from_me = ?');
    });

    it('should filter by contact name', async () => {
      // Mock contact resolution
      executeCliMock.mockResolvedValue({
        contacts: [
          { id: 'contact-1', fullName: 'John Doe', phoneNumbers: [{ label: 'mobile', number: '+1234567890' }], emailAddresses: [{ label: 'home', email: 'john@example.com' }] },
        ],
      });
      // Mock getChatIdsByIdentifiers query - returns chat IDs
      mockStmt.all.mockReturnValueOnce([{ chat_id: 1 }, { chat_id: 2 }]);
      // Mock the actual messages query
      mockStmt.all.mockReturnValueOnce([
        { ROWID: 1, guid: 'msg-1', text: 'Hello', attributedBody: null, date: 1700000000000000000, is_from_me: 1, handle_id: 0, cache_has_attachments: 0, chat_id: 1 },
      ]);

      const result = await service.listMessages({ contact: 'John Doe' });

      expect(executeCliMock).toHaveBeenCalledWith(['--action', 'resolve-contact', '--name', 'John Doe']);
      expect(result).toHaveLength(1);
      // Verify the query includes chat_id IN clause
      const queries = mockDb.prepare.mock.calls.map((c: string[]) => c[0]);
      expect(queries.some((q: string) => q.includes('chat_id IN'))).toBe(true);
    });

    it('should return empty array when contact not found', async () => {
      executeCliMock.mockResolvedValue({ contacts: [] });

      const result = await service.listMessages({ contact: 'Unknown Person' });

      expect(result).toHaveLength(0);
    });

    it('should return empty array when contact has no matching chats', async () => {
      executeCliMock.mockResolvedValue({
        contacts: [
          { id: 'contact-1', fullName: 'John Doe', phoneNumbers: [{ label: 'mobile', number: '+1234567890' }], emailAddresses: [] },
        ],
      });
      // Mock getChatIdsByIdentifiers returning empty (no chats with this contact)
      mockStmt.all.mockReturnValueOnce([]);

      const result = await service.listMessages({ contact: 'John Doe' });

      expect(result).toHaveLength(0);
    });
  });

  describe('getMessage', () => {
    it('should return single message by ID', async () => {
      const mockMessage = { ROWID: 1, guid: 'msg-1', text: 'Hello', attributedBody: null, date: 1700000000000000000, is_from_me: 1, handle_id: 0, cache_has_attachments: 0, chat_id: 1 };
      mockStmt.get.mockReturnValueOnce(mockMessage);

      const result = await service.getMessage('1');

      expect(result).toBeDefined();
      expect(result?.text).toBe('Hello');
    });

    it('should return undefined for non-existent message', async () => {
      mockStmt.get.mockReturnValueOnce(undefined);

      const result = await service.getMessage('999');

      expect(result).toBeUndefined();
    });
  });

  describe('searchMessages', () => {
    it('should search messages by text', async () => {
      const mockMessages = [
        { ROWID: 1, guid: 'msg-1', text: 'Hello world', attributedBody: null, date: 1700000000000000000, is_from_me: 1, handle_id: 0, cache_has_attachments: 0, chat_id: 1 },
      ];
      mockStmt.all.mockReturnValueOnce(mockMessages);

      const result = await service.searchMessages({ query: 'world' });

      expect(result).toHaveLength(1);
      const query = mockDb.prepare.mock.calls[0][0];
      expect(query).toContain('m.text LIKE ?');
    });

    it('should search messages filtered by contact name', async () => {
      // Mock contact resolution
      executeCliMock.mockResolvedValue({
        contacts: [
          { id: 'contact-1', fullName: 'Jane Smith', phoneNumbers: [{ label: 'mobile', number: '+0987654321' }], emailAddresses: [] },
        ],
      });
      // Mock getChatIdsByIdentifiers query
      mockStmt.all.mockReturnValueOnce([{ chat_id: 3 }]);
      // Mock the actual search query
      mockStmt.all.mockReturnValueOnce([
        { ROWID: 5, guid: 'msg-5', text: 'Hello from Jane', attributedBody: null, date: 1700000000000000000, is_from_me: 0, handle_id: 1, cache_has_attachments: 0, chat_id: 3 },
      ]);

      const result = await service.searchMessages({ query: 'Hello', contact: 'Jane Smith' });

      expect(executeCliMock).toHaveBeenCalledWith(['--action', 'resolve-contact', '--name', 'Jane Smith']);
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('Hello from Jane');
    });

    it('should return empty array when searching with unknown contact', async () => {
      executeCliMock.mockResolvedValue({ contacts: [] });

      const result = await service.searchMessages({ query: 'hello', contact: 'Nobody' });

      expect(result).toHaveLength(0);
    });

    it('should return empty array when contact has no matching chats', async () => {
      executeCliMock.mockResolvedValue({
        contacts: [
          { id: 'contact-1', fullName: 'Jane Smith', phoneNumbers: [{ label: 'mobile', number: '+0987654321' }], emailAddresses: [] },
        ],
      });
      // No chats with this contact
      mockStmt.all.mockReturnValueOnce([]);

      const result = await service.searchMessages({ query: 'hello', contact: 'Jane Smith' });

      expect(result).toHaveLength(0);
    });
  });

  describe('listAttachments', () => {
    it('should return list of attachments', async () => {
      const mockAttachments = [
        { ROWID: 1, guid: 'att-1', filename: '/path/to/file.jpg', mime_type: 'image/jpeg', transfer_name: 'file.jpg', total_bytes: 1024, message_id: 1 },
      ];
      mockStmt.all.mockReturnValueOnce(mockAttachments);

      const result = await service.listAttachments();

      expect(result).toHaveLength(1);
      expect(result[0].filename).toBe('/path/to/file.jpg');
    });
  });

  describe('getAttachment', () => {
    it('should return single attachment by ID', async () => {
      const mockAttachment = { ROWID: 1, guid: 'att-1', filename: '/path/to/file.jpg', mime_type: 'image/jpeg', transfer_name: 'file.jpg', total_bytes: 1024, message_id: 1 };
      mockStmt.get.mockReturnValueOnce(mockAttachment);

      const result = await service.getAttachment('1');

      expect(result).toBeDefined();
      expect(result?.mimeType).toBe('image/jpeg');
    });
  });

  describe('resolveContact', () => {
    it('should resolve contact by name', async () => {
      executeCliMock.mockResolvedValue({
        contacts: [
          { id: 'contact-1', fullName: 'John Doe', phoneNumbers: [{ label: 'mobile', number: '+1234567890' }], emailAddresses: [] },
        ],
      });

      const result = await service.resolveContact({ name: 'John' });

      expect(executeCliMock).toHaveBeenCalledWith(['--action', 'resolve-contact', '--name', 'John']);
      expect(result).toHaveLength(1);
      expect(result[0].fullName).toBe('John Doe');
    });

    it('should throw if no search criteria provided', async () => {
      await expect(service.resolveContact({})).rejects.toThrow('Must provide name, phone, or email');
    });
  });

  describe('sendMessage', () => {
    it('should send message to phone number', async () => {
      runAppleScriptMock.mockReturnValue({ success: true, output: '' });

      const result = await service.sendMessage({
        recipient: '+1234567890',
        text: 'Hello!',
      });

      expect(result.success).toBe(true);
      expect(result.recipient).toBe('+1234567890');
      expect(runAppleScriptMock).toHaveBeenCalled();
    });

    it('should resolve contact name before sending', async () => {
      executeCliMock.mockResolvedValue({
        contacts: [
          { id: 'contact-1', fullName: 'John Doe', phoneNumbers: [{ label: 'mobile', number: '+1234567890' }], emailAddresses: [] },
        ],
      });
      runAppleScriptMock.mockReturnValue({ success: true, output: '' });

      const result = await service.sendMessage({
        recipient: 'John Doe',
        text: 'Hello!',
      });

      expect(executeCliMock).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.recipient).toBe('+1234567890');
    });

    it('should fail if multiple contacts match', async () => {
      executeCliMock.mockResolvedValue({
        contacts: [
          { id: 'contact-1', fullName: 'John Doe', phoneNumbers: [{ number: '+1234567890' }], emailAddresses: [] },
          { id: 'contact-2', fullName: 'John Smith', phoneNumbers: [{ number: '+0987654321' }], emailAddresses: [] },
        ],
      });

      const result = await service.sendMessage({
        recipient: 'John',
        text: 'Hello!',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Multiple contacts found');
    });

    it('should fail if no contact found', async () => {
      executeCliMock.mockResolvedValue({ contacts: [] });

      const result = await service.sendMessage({
        recipient: 'Unknown Person',
        text: 'Hello!',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No contact found');
    });

    it('should handle AppleScript errors', async () => {
      runAppleScriptMock.mockReturnValue({ success: false, output: '', error: 'Some error' });

      const result = await service.sendMessage({
        recipient: '+1234567890',
        text: 'Hello!',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Some error');
    });
  });
});
