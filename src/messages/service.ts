/**
 * Messages Service
 * Business logic for iMessage/SMS operations via SQLite and AppleScript
 */

import { getDatabase, macosTimestampToISO, isoToMacosTimestamp } from './database.js';
import { getMessageText } from './parser.js';
import { runAppleScript, escapeForAppleScript } from '../utils/applescript.js';
import { executeCli } from '../utils/eventkit-cli.js';
import type {
  MessageChat,
  Message,
  MessageAttachment,
  MessageHandle,
  Contact,
  SendMessageResult,
} from './types.js';

const FULL_DISK_ACCESS_ERROR =
  'Cannot open Messages database. Full Disk Access is required.\n\n' +
  'Please grant Full Disk Access in:\n' +
  'System Settings > Privacy & Security > Full Disk Access';

function wrapDatabaseError(error: unknown): never {
  if (error instanceof Error && error.message.includes('SQLITE_CANTOPEN')) {
    throw new Error(FULL_DISK_ACCESS_ERROR);
  }
  throw error;
}

function executeQuery<T>(query: string, params: unknown[] = []): T[] {
  try {
    const db = getDatabase();
    return db.prepare(query).all(...params) as T[];
  } catch (error) {
    wrapDatabaseError(error);
  }
}

function executeQueryOne<T>(query: string, params: unknown[] = []): T | undefined {
  try {
    const db = getDatabase();
    return db.prepare(query).get(...params) as T | undefined;
  } catch (error) {
    wrapDatabaseError(error);
  }
}

interface ChatRow {
  ROWID: number;
  guid: string;
  chat_identifier: string;
  display_name: string | null;
  style: number;
}

interface HandleRow {
  ROWID: number;
  id: string;
  service: string;
}

interface MessageRow {
  ROWID: number;
  guid: string;
  text: string | null;
  attributedBody: Buffer | null;
  date: number;
  is_from_me: number;
  handle_id: number;
  cache_has_attachments: number;
  chat_id?: number;
}

interface AttachmentRow {
  ROWID: number;
  guid: string;
  filename: string | null;
  mime_type: string | null;
  transfer_name: string | null;
  total_bytes: number | null;
  message_id?: number;
}

export class MessagesService {
  /**
   * List all chats/conversations
   */
  listChats(options?: { limit?: number }): MessageChat[] {
    const limit = options?.limit ?? 50;

    const query = `
      SELECT DISTINCT
        c.ROWID,
        c.guid,
        c.chat_identifier,
        c.display_name,
        c.style
      FROM chat c
      LEFT JOIN chat_message_join cmj ON cmj.chat_id = c.ROWID
      LEFT JOIN message m ON m.ROWID = cmj.message_id
      GROUP BY c.ROWID
      ORDER BY MAX(m.date) DESC
      LIMIT ?
    `;

    const rows = executeQuery<ChatRow>(query, [limit]);

    return rows.map((row) => {
      const participants = this.getChatParticipants(row.ROWID);
      const lastMessage = this.getLastMessageForChat(row.ROWID);

      return {
        id: String(row.ROWID),
        guid: row.guid,
        chatIdentifier: row.chat_identifier,
        displayName: row.display_name || undefined,
        isGroup: row.style === 43, // 43 = group chat, 45 = individual
        participants,
        lastMessageDate: lastMessage?.date,
        lastMessageText: lastMessage?.text,
      };
    });
  }

  /**
   * Get a single chat by ID
   */
  getChat(id: string): MessageChat | undefined {
    const query = `
      SELECT ROWID, guid, chat_identifier, display_name, style
      FROM chat
      WHERE ROWID = ?
    `;

    const row = executeQueryOne<ChatRow>(query, [parseInt(id, 10)]);
    if (!row) {
      return undefined;
    }

    const participants = this.getChatParticipants(row.ROWID);
    const lastMessage = this.getLastMessageForChat(row.ROWID);

    return {
      id: String(row.ROWID),
      guid: row.guid,
      chatIdentifier: row.chat_identifier,
      displayName: row.display_name || undefined,
      isGroup: row.style === 43,
      participants,
      lastMessageDate: lastMessage?.date,
      lastMessageText: lastMessage?.text,
    };
  }

  /**
   * List messages with optional filters
   */
  listMessages(options?: {
    chatId?: string;
    limit?: number;
    beforeDate?: string;
    afterDate?: string;
    fromMe?: boolean;
  }): Message[] {
    const limit = options?.limit ?? 50;
    const params: unknown[] = [];
    let whereClause = '1=1';

    if (options?.chatId) {
      whereClause += ' AND cmj.chat_id = ?';
      params.push(parseInt(options.chatId, 10));
    }

    if (options?.beforeDate) {
      whereClause += ' AND m.date < ?';
      params.push(isoToMacosTimestamp(options.beforeDate));
    }

    if (options?.afterDate) {
      whereClause += ' AND m.date > ?';
      params.push(isoToMacosTimestamp(options.afterDate));
    }

    if (options?.fromMe !== undefined) {
      whereClause += ' AND m.is_from_me = ?';
      params.push(options.fromMe ? 1 : 0);
    }

    params.push(limit);

    const query = `
      SELECT
        m.ROWID,
        m.guid,
        m.text,
        m.attributedBody,
        m.date,
        m.is_from_me,
        m.handle_id,
        m.cache_has_attachments,
        cmj.chat_id
      FROM message m
      LEFT JOIN chat_message_join cmj ON cmj.message_id = m.ROWID
      WHERE ${whereClause}
      ORDER BY m.date DESC
      LIMIT ?
    `;

    const rows = executeQuery<MessageRow>(query, params);

    return rows.map((row) => this.rowToMessage(row));
  }

  /**
   * Get a single message by ID
   */
  getMessage(id: string): Message | undefined {
    const query = `
      SELECT
        m.ROWID,
        m.guid,
        m.text,
        m.attributedBody,
        m.date,
        m.is_from_me,
        m.handle_id,
        m.cache_has_attachments,
        cmj.chat_id
      FROM message m
      LEFT JOIN chat_message_join cmj ON cmj.message_id = m.ROWID
      WHERE m.ROWID = ?
    `;

    const row = executeQueryOne<MessageRow>(query, [parseInt(id, 10)]);
    if (!row) {
      return undefined;
    }

    return this.rowToMessage(row);
  }

  /**
   * Search messages by text content
   */
  searchMessages(options: {
    query: string;
    chatId?: string;
    limit?: number;
  }): Message[] {
    const limit = options.limit ?? 50;
    const searchPattern = `%${options.query}%`;
    const params: unknown[] = [searchPattern];
    let whereClause = 'm.text LIKE ?';

    if (options.chatId) {
      whereClause += ' AND cmj.chat_id = ?';
      params.push(parseInt(options.chatId, 10));
    }

    params.push(limit);

    const query = `
      SELECT
        m.ROWID,
        m.guid,
        m.text,
        m.attributedBody,
        m.date,
        m.is_from_me,
        m.handle_id,
        m.cache_has_attachments,
        cmj.chat_id
      FROM message m
      LEFT JOIN chat_message_join cmj ON cmj.message_id = m.ROWID
      WHERE ${whereClause}
      ORDER BY m.date DESC
      LIMIT ?
    `;

    const rows = executeQuery<MessageRow>(query, params);

    return rows.map((row) => this.rowToMessage(row));
  }

  /**
   * List attachments with optional filters
   */
  listAttachments(options?: {
    chatId?: string;
    messageId?: string;
    limit?: number;
  }): MessageAttachment[] {
    const limit = options?.limit ?? 50;
    const params: unknown[] = [];
    let whereClause = '1=1';

    if (options?.messageId) {
      whereClause += ' AND maj.message_id = ?';
      params.push(parseInt(options.messageId, 10));
    }

    if (options?.chatId) {
      whereClause += ' AND cmj.chat_id = ?';
      params.push(parseInt(options.chatId, 10));
    }

    params.push(limit);

    const query = `
      SELECT DISTINCT
        a.ROWID,
        a.guid,
        a.filename,
        a.mime_type,
        a.transfer_name,
        a.total_bytes,
        maj.message_id
      FROM attachment a
      JOIN message_attachment_join maj ON maj.attachment_id = a.ROWID
      JOIN message m ON m.ROWID = maj.message_id
      LEFT JOIN chat_message_join cmj ON cmj.message_id = m.ROWID
      WHERE ${whereClause}
      ORDER BY m.date DESC
      LIMIT ?
    `;

    const rows = executeQuery<AttachmentRow>(query, params);

    return rows.map((row) => this.rowToAttachment(row));
  }

  /**
   * Get a single attachment by ID
   */
  getAttachment(id: string): MessageAttachment | undefined {
    const query = `
      SELECT
        a.ROWID,
        a.guid,
        a.filename,
        a.mime_type,
        a.transfer_name,
        a.total_bytes,
        maj.message_id
      FROM attachment a
      LEFT JOIN message_attachment_join maj ON maj.attachment_id = a.ROWID
      WHERE a.ROWID = ?
    `;

    const row = executeQueryOne<AttachmentRow>(query, [parseInt(id, 10)]);
    if (!row) {
      return undefined;
    }

    return this.rowToAttachment(row);
  }

  /**
   * Resolve a contact by name, phone, or email
   * Uses the Swift CLI to access the Contacts framework
   */
  async resolveContact(options: {
    name?: string;
    phone?: string;
    email?: string;
  }): Promise<Contact[]> {
    const args = ['--action', 'resolve-contact'];

    if (options.name) {
      args.push('--name', options.name);
    } else if (options.phone) {
      args.push('--phone', options.phone);
    } else if (options.email) {
      args.push('--email', options.email);
    } else {
      throw new Error('Must provide name, phone, or email to resolve contact');
    }

    interface ContactsResult {
      contacts: Contact[];
    }

    const result = await executeCli<ContactsResult>(args);
    return result.contacts;
  }

  /**
   * Send a message to a recipient
   *
   * Note: This uses AppleScript and requires:
   * 1. An existing conversation with the recipient
   * 2. Automation permission for Messages.app
   */
  async sendMessage(options: {
    recipient: string; // phone number, email, or contact name
    text: string;
  }): Promise<SendMessageResult> {
    let targetIdentifier = options.recipient;

    // If recipient looks like a name (not a phone/email), try to resolve it
    if (!this.isPhoneOrEmail(options.recipient)) {
      try {
        const contacts = await this.resolveContact({ name: options.recipient });
        if (contacts.length === 0) {
          return {
            success: false,
            recipient: options.recipient,
            error: `No contact found with name "${options.recipient}"`,
          };
        }
        if (contacts.length > 1) {
          const contactList = contacts
            .map((c) => {
              const phones = c.phoneNumbers.map((p) => p.number).join(', ');
              return `${c.fullName}: ${phones}`;
            })
            .join('\n');
          return {
            success: false,
            recipient: options.recipient,
            error: `Multiple contacts found. Please specify the phone number directly:\n${contactList}`,
          };
        }
        // Use the first phone number of the single match
        if (contacts[0].phoneNumbers.length > 0) {
          targetIdentifier = contacts[0].phoneNumbers[0].number;
        } else if (contacts[0].emailAddresses.length > 0) {
          targetIdentifier = contacts[0].emailAddresses[0].email;
        } else {
          return {
            success: false,
            recipient: options.recipient,
            error: `Contact "${options.recipient}" has no phone numbers or email addresses`,
          };
        }
      } catch (error) {
        // If contact resolution fails, try sending with the original identifier
        console.error('Contact resolution failed:', error);
      }
    }

    const escapedText = escapeForAppleScript(options.text);
    const escapedRecipient = escapeForAppleScript(targetIdentifier);

    // AppleScript to send a message via Messages.app
    const script = `
      tell application "Messages"
        set targetService to id of 1st account whose service type = iMessage
        set targetBuddy to participant "${escapedRecipient}" of account id targetService
        send "${escapedText}" to targetBuddy
      end tell
    `;

    const result = runAppleScript(script);

    if (result.success) {
      return {
        success: true,
        recipient: targetIdentifier,
        message: options.text,
      };
    }

    // Handle common errors
    let errorMessage = result.error || 'Unknown error';
    if (errorMessage.includes('participant')) {
      errorMessage = `Cannot find conversation with "${targetIdentifier}". ` +
        'Make sure you have an existing conversation with this recipient.';
    } else if (errorMessage.includes('Automation')) {
      errorMessage = 'Automation permission required.\n\n' +
        'Please grant Automation permission in:\n' +
        'System Settings > Privacy & Security > Automation > Messages';
    }

    return {
      success: false,
      recipient: targetIdentifier,
      error: errorMessage,
    };
  }

  // ============ Private Helpers ============

  private getChatParticipants(chatRowId: number): MessageHandle[] {
    const query = `
      SELECT h.ROWID, h.id, h.service
      FROM handle h
      JOIN chat_handle_join chj ON chj.handle_id = h.ROWID
      WHERE chj.chat_id = ?
    `;

    const rows = executeQuery<HandleRow>(query, [chatRowId]);

    return rows.map((row) => ({
      id: String(row.ROWID),
      identifier: row.id,
      service: row.service,
    }));
  }

  private getLastMessageForChat(chatRowId: number): { date?: string; text?: string } | null {
    const query = `
      SELECT m.date, m.text, m.attributedBody
      FROM message m
      JOIN chat_message_join cmj ON cmj.message_id = m.ROWID
      WHERE cmj.chat_id = ?
      ORDER BY m.date DESC
      LIMIT 1
    `;

    const row = executeQueryOne<{ date: number; text: string | null; attributedBody: Buffer | null }>(
      query,
      [chatRowId]
    );

    if (!row) {
      return null;
    }

    return {
      date: macosTimestampToISO(row.date),
      text: getMessageText(row.text, row.attributedBody) || undefined,
    };
  }

  private rowToMessage(row: MessageRow): Message {
    const text = getMessageText(row.text, row.attributedBody);
    const senderHandle = row.is_from_me === 0 ? this.getHandleIdentifier(row.handle_id) : undefined;

    return {
      id: String(row.ROWID),
      guid: row.guid,
      text: text || '',
      date: macosTimestampToISO(row.date) || new Date().toISOString(),
      isFromMe: row.is_from_me === 1,
      chatId: row.chat_id ? String(row.chat_id) : '',
      senderHandle,
      hasAttachments: row.cache_has_attachments === 1,
    };
  }

  private getHandleIdentifier(handleId: number): string | undefined {
    if (!handleId) return undefined;

    const query = 'SELECT id FROM handle WHERE ROWID = ?';
    const row = executeQueryOne<{ id: string }>(query, [handleId]);
    return row?.id;
  }

  private rowToAttachment(row: AttachmentRow): MessageAttachment {
    return {
      id: String(row.ROWID),
      guid: row.guid,
      filename: row.filename || '',
      mimeType: row.mime_type || undefined,
      transferName: row.transfer_name || undefined,
      totalBytes: row.total_bytes || undefined,
      messageId: row.message_id ? String(row.message_id) : '',
    };
  }

  private isPhoneOrEmail(str: string): boolean {
    // Phone: starts with +, or contains mostly digits
    const phonePattern = /^[+]?\d[\d\s\-().]+$/;
    // Email: contains @
    const emailPattern = /@/;

    return phonePattern.test(str) || emailPattern.test(str);
  }
}
