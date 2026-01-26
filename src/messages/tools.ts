/**
 * Messages Tool Definitions
 * Zod schemas for iMessage/SMS MCP tools
 */

import { z } from 'zod';

// Chat tools
export const listMessageChatsSchema = z.object({
  limit: z.number().optional().describe('Maximum number of chats to return (default: 50)'),
});

export const getMessageChatSchema = z.object({
  id: z.string().describe('The unique identifier of the chat'),
});

// Message tools
export const listMessagesSchema = z.object({
  chatId: z.string().optional().describe('Filter messages by chat ID'),
  limit: z.number().optional().describe('Maximum number of messages to return (default: 50)'),
  beforeDate: z.string().optional().describe('Filter messages before this date (ISO 8601)'),
  afterDate: z.string().optional().describe('Filter messages after this date (ISO 8601)'),
  fromMe: z.boolean().optional().describe('Filter to only messages sent by me (true) or received (false)'),
});

export const getMessageSchema = z.object({
  id: z.string().describe('The unique identifier of the message'),
});

export const searchMessagesSchema = z.object({
  query: z.string().describe('Search term to find in message text'),
  chatId: z.string().optional().describe('Filter search to a specific chat'),
  limit: z.number().optional().describe('Maximum number of results (default: 50)'),
});

// Send tool
export const sendMessageSchema = z.object({
  recipient: z
    .string()
    .describe(
      'Phone number, email, or contact name. For contact names, a single matching contact is required.'
    ),
  text: z.string().describe('The message text to send'),
});

// Contact tool
export const resolveContactSchema = z.object({
  name: z.string().optional().describe('Search contacts by name'),
  phone: z.string().optional().describe('Search contacts by phone number'),
  email: z.string().optional().describe('Search contacts by email address'),
});

// Attachment tools
export const listMessageAttachmentsSchema = z.object({
  chatId: z.string().optional().describe('Filter attachments by chat ID'),
  messageId: z.string().optional().describe('Filter attachments by message ID'),
  limit: z.number().optional().describe('Maximum number of attachments to return (default: 50)'),
});

export const getMessageAttachmentSchema = z.object({
  id: z.string().describe('The unique identifier of the attachment'),
});
