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

  server.tool(
    'search_contacts',
    'Search contacts by name, phone number, or email address. ' +
      'Returns matching contacts with full details. ' +
      'Requires Contacts permission.',
    searchContactsSchema.shape,
    wrapToolHandler(async (params) => {
      if (!params.name && !params.phone && !params.email) {
        throw new Error('Must provide name, phone, or email to search contacts');
      }
      return service.searchContacts(params);
    })
  );

  server.tool(
    'get_contact',
    'Get a single contact by ID with full details',
    getContactSchema.shape,
    wrapToolHandler(async (params) => service.getContact(params.id))
  );

  server.tool(
    'list_contacts',
    'List contacts, optionally filtered by group. Returns up to limit contacts (default: 200).',
    listContactsSchema.shape,
    wrapToolHandler(async (params) => service.listContacts(params))
  );

  server.tool(
    'list_contact_groups',
    'List all contact groups',
    listContactGroupsSchema.shape,
    wrapToolHandler(async () => service.listGroups())
  );

  server.tool(
    'create_contact',
    'Create a new contact. At least one of givenName, familyName, or organizationName should be provided.',
    createContactSchema.shape,
    wrapToolHandler(async (params) => service.createContact(params))
  );

  server.tool(
    'update_contact',
    'Update an existing contact. Array fields (phones, emails, addresses, URLs) replace all existing values when provided.',
    updateContactSchema.shape,
    wrapToolHandler(async (params) => {
      const { id, ...updates } = params;
      return service.updateContact(id, updates);
    })
  );

  server.tool(
    'delete_contact',
    'Delete a contact by ID',
    deleteContactSchema.shape,
    wrapToolHandler(async (params) => service.deleteContact(params.id))
  );
}
