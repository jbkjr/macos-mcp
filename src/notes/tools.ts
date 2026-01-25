/**
 * Notes Tool Definitions
 */

import { z } from 'zod';

// Folder tools
export const listNoteFoldersSchema = z.object({});

export const createNoteFolderSchema = z.object({
  name: z.string().describe('The name for the new folder'),
  parentFolder: z.string().optional().describe('Parent folder to create the new folder in (creates at root level if not specified)'),
});

export const deleteNoteFolderSchema = z.object({
  name: z.string().describe('The name of the folder to delete'),
});

// Note tools
export const listNotesSchema = z.object({
  folder: z.string().optional().describe('Filter notes by folder name'),
  limit: z.number().optional().describe('Maximum number of notes to return (default: 100)'),
});

export const getNoteSchema = z.object({
  title: z.string().describe('The exact title of the note'),
  folder: z.string().optional().describe('The folder containing the note'),
});

export const createNoteSchema = z.object({
  title: z.string().describe('The title of the note'),
  content: z.string().describe('The content of the note (supports Markdown)'),
  folder: z.string().optional().describe('The folder to create the note in (defaults to "Notes")'),
  tags: z.array(z.string()).optional().describe('Tags to add to the note'),
});

export const updateNoteSchema = z.object({
  title: z.string().describe('The title of the note to update'),
  newContent: z.string().describe('The new content for the note (supports Markdown)'),
  newTitle: z.string().optional().describe('New title for the note (preserves existing title if not specified)'),
  folder: z.string().optional().describe('The folder containing the note'),
});

export const deleteNoteSchema = z.object({
  title: z.string().describe('The title of the note to delete'),
  folder: z.string().optional().describe('The folder containing the note'),
});

export const searchNotesSchema = z.object({
  query: z.string().describe('Search query to find notes by title'),
  folder: z.string().optional().describe('Folder to search in (searches all notes if not specified)'),
});
