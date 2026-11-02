/**
 * Messages Tool Definitions
 * Zod schemas for iMessage/SMS MCP tools
 */

import { z } from 'zod';

import { strictObject } from '../utils/strict.js';

// Chat tools
export const listMessageChatsSchema = strictObject({
  limit: z.number().optional().describe('Maximum number of chats to return (default: 50)'),
});

export const getMessageChatSchema = strictObject({
  id: z.string().describe('The unique identifier of the chat'),
});

// Message tools
export const listMessagesSchema = strictObject({
  chatId: z.string().optional().describe('Filter messages by chat ID'),
  contact: z.string().optional().describe('Filter by contact name, phone, or email (resolves to chat IDs automatically)'),
  limit: z.number().optional().describe('Maximum number of messages to return (default: 50)'),
  beforeDate: z.string().optional().describe('Filter messages before this date (ISO 8601)'),
  afterDate: z.string().optional().describe('Filter messages after this date (ISO 8601)'),
  fromMe: z.boolean().optional().describe('Filter to only messages sent by me (true) or received (false)'),
});

export const getMessageSchema = strictObject({
  id: z.string().describe('The unique identifier of the message'),
});

export const searchMessagesSchema = strictObject({
  query: z.string().describe('Search term to find in message text'),
  chatId: z.string().optional().describe('Filter search to a specific chat'),
  contact: z.string().optional().describe('Filter by contact name, phone, or email (resolves to chat IDs automatically)'),
  limit: z.number().optional().describe('Maximum number of results (default: 50)'),
});

// Send tool
export const sendMessageSchema = strictObject({
  recipient: z
    .string()
    .describe(
      'Phone number, email, or contact name. A name must be the exact full name of a single contact, or the send is refused.'
    ),
  text: z.string().describe('The message text to send'),
});

// Attachment tools
export const listMessageAttachmentsSchema = strictObject({
  chatId: z.string().optional().describe('Filter attachments by chat ID'),
  messageId: z.string().optional().describe('Filter attachments by message ID'),
  limit: z.number().optional().describe('Maximum number of attachments to return (default: 50)'),
});

export const getMessageAttachmentSchema = strictObject({
  id: z.string().describe('The unique identifier of the attachment'),
});
