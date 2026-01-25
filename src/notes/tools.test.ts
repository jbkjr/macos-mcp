/**
 * Notes Tool Schema Tests
 */

import { describe, it, expect } from 'vitest';
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

describe('Notes Tool Schemas', () => {
  // Folder schemas
  describe('listNoteFoldersSchema', () => {
    it('should accept empty object', () => {
      const result = listNoteFoldersSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('createNoteFolderSchema', () => {
    it('should require name', () => {
      const result = createNoteFolderSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should accept valid name', () => {
      const result = createNoteFolderSchema.safeParse({ name: 'New Folder' });
      expect(result.success).toBe(true);
    });
  });

  describe('deleteNoteFolderSchema', () => {
    it('should require name', () => {
      const result = deleteNoteFolderSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should accept valid name', () => {
      const result = deleteNoteFolderSchema.safeParse({ name: 'Old Folder' });
      expect(result.success).toBe(true);
    });
  });

  // Note schemas
  describe('listNotesSchema', () => {
    it('should accept empty object', () => {
      const result = listNotesSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should accept optional folder filter', () => {
      const result = listNotesSchema.safeParse({ folder: 'Work' });
      expect(result.success).toBe(true);
    });

    it('should accept optional limit', () => {
      const result = listNotesSchema.safeParse({ limit: 50 });
      expect(result.success).toBe(true);
    });

    it('should accept both filters', () => {
      const result = listNotesSchema.safeParse({
        folder: 'Work',
        limit: 50,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('getNoteSchema', () => {
    it('should require title', () => {
      const result = getNoteSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should accept title only', () => {
      const result = getNoteSchema.safeParse({ title: 'My Note' });
      expect(result.success).toBe(true);
    });

    it('should accept title with folder', () => {
      const result = getNoteSchema.safeParse({
        title: 'My Note',
        folder: 'Work',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('createNoteSchema', () => {
    it('should require title and content', () => {
      const result = createNoteSchema.safeParse({});
      expect(result.success).toBe(false);

      const result2 = createNoteSchema.safeParse({ title: 'Note' });
      expect(result2.success).toBe(false);
    });

    it('should accept required fields only', () => {
      const result = createNoteSchema.safeParse({
        title: 'My Note',
        content: 'Some content',
      });
      expect(result.success).toBe(true);
    });

    it('should accept all fields', () => {
      const result = createNoteSchema.safeParse({
        title: 'My Note',
        content: '# Heading\n\nContent here',
        folder: 'Work',
        tags: ['important', 'work'],
      });
      expect(result.success).toBe(true);
    });

    it('should accept empty tags array', () => {
      const result = createNoteSchema.safeParse({
        title: 'Note',
        content: 'Content',
        tags: [],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('updateNoteSchema', () => {
    it('should require title and newContent', () => {
      const result = updateNoteSchema.safeParse({});
      expect(result.success).toBe(false);

      const result2 = updateNoteSchema.safeParse({ title: 'Note' });
      expect(result2.success).toBe(false);
    });

    it('should accept required fields', () => {
      const result = updateNoteSchema.safeParse({
        title: 'My Note',
        newContent: 'Updated content',
      });
      expect(result.success).toBe(true);
    });

    it('should accept optional folder', () => {
      const result = updateNoteSchema.safeParse({
        title: 'My Note',
        newContent: 'Updated content',
        folder: 'Work',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('deleteNoteSchema', () => {
    it('should require title', () => {
      const result = deleteNoteSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should accept title only', () => {
      const result = deleteNoteSchema.safeParse({ title: 'Note to Delete' });
      expect(result.success).toBe(true);
    });

    it('should accept title with folder', () => {
      const result = deleteNoteSchema.safeParse({
        title: 'Note',
        folder: 'Work',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('searchNotesSchema', () => {
    it('should require query', () => {
      const result = searchNotesSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should accept valid query', () => {
      const result = searchNotesSchema.safeParse({ query: 'search term' });
      expect(result.success).toBe(true);
    });
  });
});
