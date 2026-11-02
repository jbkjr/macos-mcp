/**
 * Notes Module
 * Exports and tool registration for Apple Notes functionality
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { wrapToolHandler } from '../utils/mcp-helpers.js';
import { NotesService } from './service.js';
import {
  listNoteFoldersSchema,
  createNoteFolderSchema,
  deleteNoteFolderSchema,
  listNotesSchema,
  getNoteSchema,
  createNoteSchema,
  updateNoteSchema,
  deleteNoteSchema,
  searchNotesSchema,
} from './tools.js';

export { NotesService } from './service.js';
export * from './types.js';
export * from './tools.js';

/**
 * Register notes tools with the MCP server
 */
export function registerNoteTools(server: McpServer): void {
  const service = new NotesService();

  // Folder tools
  server.registerTool(
    'list_note_folders',
    {
      description: 'List all folders in Apple Notes',
      inputSchema: listNoteFoldersSchema,
    },
    wrapToolHandler(async () => service.listFolders())
  );

  server.registerTool(
    'create_note_folder',
    {
      description: 'Create a new folder in Apple Notes',
      inputSchema: createNoteFolderSchema,
    },
    wrapToolHandler(async (params) => service.createFolder(params.name, params.parentFolder))
  );

  server.registerTool(
    'delete_note_folder',
    {
      description: 'Delete a folder from Apple Notes',
      inputSchema: deleteNoteFolderSchema,
    },
    wrapToolHandler(async (params) => service.deleteFolder(params.name))
  );

  // Note tools
  server.registerTool(
    'list_notes',
    {
      description: 'List notes in Apple Notes (optionally filtered by folder)',
      inputSchema: listNotesSchema,
    },
    wrapToolHandler(async (params) => service.listNotes(params))
  );

  server.registerTool(
    'get_note',
    {
      description: 'Get the content of a note by title',
      inputSchema: getNoteSchema,
    },
    wrapToolHandler(async (params) => service.getNote(params.title, params.folder))
  );

  server.registerTool(
    'create_note',
    {
      description: 'Create a new note in Apple Notes (supports Markdown content)',
      inputSchema: createNoteSchema,
    },
    wrapToolHandler(async (params) => service.createNote(params))
  );

  server.registerTool(
    'update_note',
    {
      description: 'Update an existing note in Apple Notes',
      inputSchema: updateNoteSchema,
    },
    wrapToolHandler(async (params) => service.updateNote(params))
  );

  server.registerTool(
    'delete_note',
    {
      description: 'Delete a note from Apple Notes',
      inputSchema: deleteNoteSchema,
    },
    wrapToolHandler(async (params) => service.deleteNote(params.title, params.folder))
  );

  server.registerTool(
    'search_notes',
    {
      description: 'Search for notes by title',
      inputSchema: searchNotesSchema,
    },
    wrapToolHandler(async (params) => service.searchNotes(params.query, params.folder))
  );
}
