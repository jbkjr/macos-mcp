/**
 * Messages Module
 * Exports and tool registration for iMessage/SMS functionality
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { wrapToolHandler } from '../utils/mcp-helpers.js';
import { MessagesService } from './service.js';
import {
  listMessageChatsSchema,
  getMessageChatSchema,
  listMessagesSchema,
  getMessageSchema,
  searchMessagesSchema,
  sendMessageSchema,
  listMessageAttachmentsSchema,
  getMessageAttachmentSchema,
} from './tools.js';

export { MessagesService } from './service.js';
export * from './types.js';
export * from './tools.js';

/**
 * Register message tools with the MCP server
 */
export function registerMessageTools(server: McpServer): void {
  const service = new MessagesService();

  // Chat tools
  server.tool(
    'list_message_chats',
    'List iMessage/SMS conversations with participants and last message. ' +
      'Note: Only locally-cached messages are available when Messages in iCloud is enabled.',
    listMessageChatsSchema.shape,
    wrapToolHandler(async (params) => service.listChats(params))
  );

  server.tool(
    'get_message_chat',
    'Get details of a specific chat/conversation by ID, including participants',
    getMessageChatSchema.shape,
    wrapToolHandler(async (params) => {
      const chat = service.getChat(params.id);
      if (!chat) {
        throw new Error(`Chat with ID '${params.id}' not found`);
      }
      return chat;
    })
  );

  // Message tools
  server.tool(
    'list_messages',
    'List iMessage/SMS messages with optional filters (chat, contact name, date range, sender). ' +
      'Use "contact" to filter by name (automatically resolves to chat IDs). ' +
      'Returns most recent messages first.',
    listMessagesSchema.shape,
    wrapToolHandler(async (params) => service.listMessages(params))
  );

  server.tool(
    'get_message',
    'Get a single iMessage/SMS message by ID',
    getMessageSchema.shape,
    wrapToolHandler(async (params) => {
      const message = service.getMessage(params.id);
      if (!message) {
        throw new Error(`Message with ID '${params.id}' not found`);
      }
      return message;
    })
  );

  server.tool(
    'search_messages',
    'Search iMessage/SMS messages by text content. ' +
      'Use "contact" to filter by name (automatically resolves to chat IDs). ' +
      'Note: Only searches locally-cached messages.',
    searchMessagesSchema.shape,
    wrapToolHandler(async (params) => service.searchMessages(params))
  );

  // Send tool
  server.tool(
    'send_message',
    'Send an iMessage or SMS. Accepts phone number, email, or contact name. ' +
      'Requires an existing conversation with the recipient. ' +
      'Requires Automation permission for Messages.app.',
    sendMessageSchema.shape,
    wrapToolHandler(async (params) => {
      const result = await service.sendMessage(params);
      if (!result.success) {
        throw new Error(result.error || 'Failed to send message');
      }
      return result;
    })
  );

  // Attachment tools
  server.tool(
    'list_message_attachments',
    'List attachments from iMessage/SMS messages. ' +
      'Returns metadata including file paths - files must be read separately.',
    listMessageAttachmentsSchema.shape,
    wrapToolHandler(async (params) => service.listAttachments(params))
  );

  server.tool(
    'get_message_attachment',
    'Get metadata for a specific message attachment by ID, including file path',
    getMessageAttachmentSchema.shape,
    wrapToolHandler(async (params) => {
      const attachment = service.getAttachment(params.id);
      if (!attachment) {
        throw new Error(`Attachment with ID '${params.id}' not found`);
      }
      return attachment;
    })
  );
}
