/**
 * Notes Service Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock AppleScript executor BEFORE importing the service
vi.mock('../utils/applescript.js', () => ({
  runAppleScript: vi.fn(),
  escapeForAppleScript: (str: string) => str.replace(/\\/g, '\\\\').replace(/"/g, '\\"'),
}));

// Mock markdown converter
vi.mock('../utils/markdown.js', () => ({
  markdownToHtml: (md: string) => `<html>${md}</html>`,
}));

// Import after mocks are set up
import { NotesService } from './service.js';

describe('NotesService', () => {
  let service: NotesService;
  let runAppleScriptMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    service = new NotesService();
    const applescriptModule = await import('../utils/applescript.js');
    runAppleScriptMock = applescriptModule.runAppleScript as unknown as ReturnType<typeof vi.fn>;
    runAppleScriptMock.mockReset();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // Folder operations
  describe('listFolders', () => {
    it('should return list of folders', async () => {
      runAppleScriptMock.mockReturnValue({
        success: true,
        output: 'id:folder-1, name:Work, id:folder-2, name:Personal',
      });

      const result = await service.listFolders();

      expect(runAppleScriptMock).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 'folder-1', name: 'Work' });
      expect(result[1]).toEqual({ id: 'folder-2', name: 'Personal' });
    });

    it('should return empty array when no folders', async () => {
      runAppleScriptMock.mockReturnValue({
        success: true,
        output: '{}',
      });

      const result = await service.listFolders();

      expect(result).toEqual([]);
    });

    it('should throw error on failure', async () => {
      runAppleScriptMock.mockReturnValue({
        success: false,
        output: '',
        error: 'AppleScript error',
      });

      await expect(service.listFolders()).rejects.toThrow('Failed to list folders');
    });
  });

  describe('createFolder', () => {
    it('should create a new folder', async () => {
      runAppleScriptMock.mockReturnValue({
        success: true,
        output: '{id:"new-folder", name:"New Folder"}',
      });

      const result = await service.createFolder('New Folder');

      expect(runAppleScriptMock).toHaveBeenCalled();
      expect(result.name).toBe('New Folder');
    });

    it('should escape special characters in folder name', async () => {
      runAppleScriptMock.mockReturnValue({
        success: true,
        output: '{id:"folder", name:"Folder \\"Test\\""}',
      });

      await service.createFolder('Folder "Test"');

      const callArg = runAppleScriptMock.mock.calls[0][0] as string;
      expect(callArg).toContain('Folder \\"Test\\"');
    });
  });

  describe('deleteFolder', () => {
    it('should delete a folder', async () => {
      runAppleScriptMock.mockReturnValue({
        success: true,
        output: '',
      });

      const result = await service.deleteFolder('Old Folder');

      expect(runAppleScriptMock).toHaveBeenCalled();
      expect(result).toEqual({ deleted: true, name: 'Old Folder' });
    });
  });

  // Note operations
  describe('listNotes', () => {
    it('should return list of notes', async () => {
      runAppleScriptMock.mockReturnValue({
        success: true,
        output: 'id:note-1, title:Note 1, id:note-2, title:Note 2',
      });

      const result = await service.listNotes();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 'note-1', title: 'Note 1' });
    });

    it('should filter by folder', async () => {
      runAppleScriptMock.mockReturnValue({
        success: true,
        output: 'id:note-1, title:Note 1',
      });

      await service.listNotes({ folder: 'Work' });

      const callArg = runAppleScriptMock.mock.calls[0][0] as string;
      expect(callArg).toContain('folder "Work"');
    });

    it('should respect limit parameter', async () => {
      runAppleScriptMock.mockReturnValue({
        success: true,
        output: '{}',
      });

      await service.listNotes({ limit: 50 });

      const callArg = runAppleScriptMock.mock.calls[0][0] as string;
      expect(callArg).toContain('50');
    });
  });

  describe('getNote', () => {
    it('should return note content', async () => {
      runAppleScriptMock.mockReturnValue({
        success: true,
        output: '{id:"note-1", title:"Test Note", body:"Content here"}',
      });

      const result = await service.getNote('Test Note');

      expect(result.title).toBe('Test Note');
      expect(result.content).toBe('Content here');
    });

    it('should get note from specific folder', async () => {
      runAppleScriptMock.mockReturnValue({
        success: true,
        output: '{id:"note-1", title:"Note", body:"Content"}',
      });

      await service.getNote('Note', 'Work');

      const callArg = runAppleScriptMock.mock.calls[0][0] as string;
      expect(callArg).toContain('folder "Work"');
    });
  });

  describe('createNote', () => {
    it('should create a note with required fields', async () => {
      runAppleScriptMock.mockReturnValue({
        success: true,
        output: 'note-new-1',
      });

      const result = await service.createNote({
        title: 'New Note',
        content: 'Note content',
      });

      expect(runAppleScriptMock).toHaveBeenCalled();
      expect(result.title).toBe('New Note');
      expect(result.content).toBe('Note content');
    });

    it('should create note in specific folder', async () => {
      runAppleScriptMock.mockReturnValue({
        success: true,
        output: 'note-id',
      });

      await service.createNote({
        title: 'Note',
        content: 'Content',
        folder: 'Work',
      });

      const callArg = runAppleScriptMock.mock.calls[0][0] as string;
      expect(callArg).toContain('folder "Work"');
    });

    it('should include tags in content', async () => {
      runAppleScriptMock.mockReturnValue({
        success: true,
        output: 'note-id',
      });

      await service.createNote({
        title: 'Note',
        content: 'Content',
        tags: ['important', 'work'],
      });

      const callArg = runAppleScriptMock.mock.calls[0][0] as string;
      expect(callArg).toContain('#important');
      expect(callArg).toContain('#work');
    });
  });

  describe('updateNote', () => {
    it('should update note content', async () => {
      runAppleScriptMock.mockReturnValue({
        success: true,
        output: 'note-id',
      });

      const result = await service.updateNote({
        title: 'Note Title',
        newContent: 'Updated content',
      });

      expect(result.title).toBe('Note Title');
      expect(result.content).toBe('Updated content');
    });

    it('should update note in specific folder', async () => {
      runAppleScriptMock.mockReturnValue({
        success: true,
        output: 'note-id',
      });

      await service.updateNote({
        title: 'Note',
        newContent: 'Content',
        folder: 'Personal',
      });

      const callArg = runAppleScriptMock.mock.calls[0][0] as string;
      expect(callArg).toContain('folder "Personal"');
    });
  });

  describe('deleteNote', () => {
    it('should delete a note', async () => {
      runAppleScriptMock.mockReturnValue({
        success: true,
        output: '',
      });

      const result = await service.deleteNote('Note to Delete');

      expect(result).toEqual({ deleted: true, title: 'Note to Delete' });
    });

    it('should delete note from specific folder', async () => {
      runAppleScriptMock.mockReturnValue({
        success: true,
        output: '',
      });

      await service.deleteNote('Note', 'Work');

      const callArg = runAppleScriptMock.mock.calls[0][0] as string;
      expect(callArg).toContain('folder "Work"');
    });
  });

  describe('searchNotes', () => {
    it('should return matching notes', async () => {
      runAppleScriptMock.mockReturnValue({
        success: true,
        output: 'Note 1, Note 2, Note 3',
      });

      const result = await service.searchNotes('test');

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ title: 'Note 1' });
      expect(result[1]).toEqual({ title: 'Note 2' });
    });

    it('should return empty array for no matches', async () => {
      runAppleScriptMock.mockReturnValue({
        success: true,
        output: '',
      });

      const result = await service.searchNotes('nonexistent');

      expect(result).toEqual([]);
    });

    it('should escape search query', async () => {
      runAppleScriptMock.mockReturnValue({
        success: true,
        output: '',
      });

      await service.searchNotes('test "query"');

      const callArg = runAppleScriptMock.mock.calls[0][0] as string;
      expect(callArg).toContain('test \\"query\\"');
    });
  });
});
