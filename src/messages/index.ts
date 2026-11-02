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
  server.registerTool(
    'list_message_chats',
    {
      description: 'List iMessage/SMS conversations with participants and last message. ' +
      'Note: Only locally-cached messages are available when Messages in iCloud is enabled.',
      inputSchema: listMessageChatsSchema,
    },
    wrapToolHandler(async (params) => service.listChats(params))
  );

  server.registerTool(
    'get_message_chat',
    {
      description: 'Get details of a specific chat/conversation by ID, including participants',
      inputSchema: getMessageChatSchema,
    },
    wrapToolHandler(async (params) => {
      const chat = service.getChat(params.id);
      if (!chat) {
        throw new Error(`Chat with ID '${params.id}' not found`);
      }
      return chat;
    })
  );

  // Message tools
  server.registerTool(
    'list_messages',
    {
      description: 'List iMessage/SMS messages with optional filters (chat, contact name, date range, sender). ' +
      'Use "contact" to filter by name (automatically resolves to chat IDs). ' +
      'Returns most recent messages first.',
      inputSchema: listMessagesSchema,
    },
    wrapToolHandler(async (params) => service.listMessages(params))
  );

  server.registerTool(
    'get_message',
    {
      description: 'Get a single iMessage/SMS message by ID',
      inputSchema: getMessageSchema,
    },
    wrapToolHandler(async (params) => {
      const message = service.getMessage(params.id);
      if (!message) {
        throw new Error(`Message with ID '${params.id}' not found`);
      }
      return message;
    })
  );

  server.registerTool(
    'search_messages',
    {
      description: 'Search iMessage/SMS messages by text content. ' +
      'Use "contact" to filter by name (automatically resolves to chat IDs). ' +
      'Note: Only searches locally-cached messages.',
      inputSchema: searchMessagesSchema,
    },
    wrapToolHandler(async (params) => service.searchMessages(params))
  );

  // Send tool
  server.registerTool(
    'send_message',
    {
      description: 'Send an iMessage or SMS. Accepts phone number, email, or the exact full name of a contact. ' +
      'Requires an existing conversation with the recipient. ' +
      'Requires Automation permission for Messages.app.',
      inputSchema: sendMessageSchema,
    },
    wrapToolHandler(async (params) => {
      const result = await service.sendMessage(params);
      if (!result.success) {
        throw new Error(result.error || 'Failed to send message');
      }
      return result;
    })
  );

  // Attachment tools
  server.registerTool(
    'list_message_attachments',
    {
      description: 'List attachments from iMessage/SMS messages. ' +
      'Returns metadata including file paths - files must be read separately.',
      inputSchema: listMessageAttachmentsSchema,
    },
    wrapToolHandler(async (params) => service.listAttachments(params))
  );

  server.registerTool(
    'get_message_attachment',
    {
      description: 'Get metadata for a specific message attachment by ID, including file path',
      inputSchema: getMessageAttachmentSchema,
    },
    wrapToolHandler(async (params) => {
      const attachment = service.getAttachment(params.id);
      if (!attachment) {
        throw new Error(`Attachment with ID '${params.id}' not found`);
      }
      return attachment;
    })
  );
}
