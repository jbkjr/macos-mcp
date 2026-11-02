/**
 * Contacts Module
 * Exports and tool registration for macOS Contacts functionality
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { wrapToolHandler } from '../utils/mcp-helpers.js';
import { ContactsService } from './service.js';
import {
  searchContactsSchema,
  getContactSchema,
  listContactsSchema,
  listContactGroupsSchema,
  createContactSchema,
  updateContactSchema,
  deleteContactSchema,
} from './tools.js';

export { ContactsService } from './service.js';
export * from './types.js';
export * from './tools.js';

/**
 * Register contact tools with the MCP server
 */
export function registerContactTools(server: McpServer): void {
  const service = new ContactsService();

  server.registerTool(
    'search_contacts',
    {
      description: 'Search contacts by name, phone number, or email address. ' +
      'Returns matching contacts with full details. ' +
      'Requires Contacts permission.',
      inputSchema: searchContactsSchema,
    },
    wrapToolHandler(async (params) => {
      if (!params.name && !params.phone && !params.email) {
        throw new Error('Must provide name, phone, or email to search contacts');
      }
      return service.searchContacts(params);
    })
  );

  server.registerTool(
    'get_contact',
    {
      description: 'Get a single contact by ID with full details',
      inputSchema: getContactSchema,
    },
    wrapToolHandler(async (params) => service.getContact(params.id))
  );

  server.registerTool(
    'list_contacts',
    {
      description: 'List contacts, optionally filtered by group. Returns up to limit contacts (default: 200).',
      inputSchema: listContactsSchema,
    },
    wrapToolHandler(async (params) => service.listContacts(params))
  );

  server.registerTool(
    'list_contact_groups',
    {
      description: 'List all contact groups',
      inputSchema: listContactGroupsSchema,
    },
    wrapToolHandler(async () => service.listGroups())
  );

  server.registerTool(
    'create_contact',
    {
      description: 'Create a new contact. At least one of givenName, familyName, or organizationName should be provided.',
      inputSchema: createContactSchema,
    },
    wrapToolHandler(async (params) => service.createContact(params))
  );

  server.registerTool(
    'update_contact',
    {
      description: 'Update an existing contact. Array fields (phones, emails, addresses, URLs) replace all existing values when provided.',
      inputSchema: updateContactSchema,
    },
    wrapToolHandler(async (params) => {
      const { id, ...updates } = params;
      return service.updateContact(id, updates);
    })
  );

  server.registerTool(
    'delete_contact',
    {
      description: 'Delete a contact by ID',
      inputSchema: deleteContactSchema,
    },
    wrapToolHandler(async (params) => service.deleteContact(params.id))
  );
}
