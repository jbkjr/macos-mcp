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
  server.tool(
    'list_note_folders',
    'List all folders in Apple Notes',
    listNoteFoldersSchema.shape,
    wrapToolHandler(async () => service.listFolders())
  );

  server.tool(
    'create_note_folder',
    'Create a new folder in Apple Notes',
    createNoteFolderSchema.shape,
    wrapToolHandler(async (params) => service.createFolder(params.name, params.parentFolder))
  );

  server.tool(
    'delete_note_folder',
    'Delete a folder from Apple Notes',
    deleteNoteFolderSchema.shape,
    wrapToolHandler(async (params) => service.deleteFolder(params.name))
  );

  // Note tools
  server.tool(
    'list_notes',
    'List notes in Apple Notes (optionally filtered by folder)',
    listNotesSchema.shape,
    wrapToolHandler(async (params) => service.listNotes(params))
  );

  server.tool(
    'get_note',
    'Get the content of a note by title',
    getNoteSchema.shape,
    wrapToolHandler(async (params) => service.getNote(params.title, params.folder))
  );

  server.tool(
    'create_note',
    'Create a new note in Apple Notes (supports Markdown content)',
    createNoteSchema.shape,
    wrapToolHandler(async (params) => service.createNote(params))
  );

  server.tool(
    'update_note',
    'Update an existing note in Apple Notes',
    updateNoteSchema.shape,
    wrapToolHandler(async (params) => service.updateNote(params))
  );

  server.tool(
    'delete_note',
    'Delete a note from Apple Notes',
    deleteNoteSchema.shape,
    wrapToolHandler(async (params) => service.deleteNote(params.title, params.folder))
  );

  server.tool(
    'search_notes',
    'Search for notes by title',
    searchNotesSchema.shape,
    wrapToolHandler(async (params) => service.searchNotes(params.query, params.folder))
  );
}
