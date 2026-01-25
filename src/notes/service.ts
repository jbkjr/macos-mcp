/**
 * Notes Service
 * Business logic for Apple Notes operations via AppleScript
 */

import { runAppleScript, escapeForAppleScript } from '../utils/applescript.js';
import { markdownToHtml } from '../utils/markdown.js';
import type { Note, NoteFolder, NoteSearchResult, DeleteResult } from './types.js';

const ICLOUD_ACCOUNT = 'iCloud';

/**
 * Format content for AppleScript compatibility
 * Converts markdown to HTML and escapes for AppleScript
 */
function formatContent(content: string): string {
  if (!content) return '';
  return escapeForAppleScript(markdownToHtml(content));
}

/**
 * Builds an AppleScript command with optional folder context.
 * Reduces duplication across note operations.
 */
function buildNotesScript(folder: string | undefined, innerScript: string): string {
  const accountBlock = `tell account "${ICLOUD_ACCOUNT}"`;
  if (folder) {
    const escapedFolder = escapeForAppleScript(folder);
    return `
      tell application "Notes"
        ${accountBlock}
          tell folder "${escapedFolder}"
            ${innerScript}
          end tell
        end tell
      end tell
    `;
  }
  return `
    tell application "Notes"
      ${accountBlock}
        ${innerScript}
      end tell
    end tell
  `;
}

/**
 * Executes an AppleScript and throws on failure.
 */
function executeScript(script: string, errorPrefix: string): string {
  const result = runAppleScript(script);
  if (!result.success) {
    throw new Error(`${errorPrefix}: ${result.error}`);
  }
  return result.output;
}

export class NotesService {
  async listFolders(): Promise<NoteFolder[]> {
    const script = `
      tell application "Notes"
        tell account "${ICLOUD_ACCOUNT}"
          set folderList to {}
          repeat with f in folders
            set end of folderList to {id:(id of f), name:(name of f)}
          end repeat
          return folderList
        end tell
      end tell
    `;
    const output = executeScript(script, 'Failed to list folders');
    return this.parseFolderList(output);
  }

  async createFolder(name: string, parentFolder?: string): Promise<NoteFolder> {
    const escapedName = escapeForAppleScript(name);
    const script = parentFolder
      ? `
      tell application "Notes"
        tell account "${ICLOUD_ACCOUNT}"
          tell folder "${escapeForAppleScript(parentFolder)}"
            set newFolder to make new folder with properties {name:"${escapedName}"}
            return {id:(id of newFolder), name:(name of newFolder)}
          end tell
        end tell
      end tell
    `
      : `
      tell application "Notes"
        tell account "${ICLOUD_ACCOUNT}"
          set newFolder to make new folder with properties {name:"${escapedName}"}
          return {id:(id of newFolder), name:(name of newFolder)}
        end tell
      end tell
    `;
    const output = executeScript(script, 'Failed to create folder');
    return {
      id: this.extractValue(output, 'id') || Date.now().toString(),
      name: name,
    };
  }

  async deleteFolder(name: string): Promise<DeleteResult> {
    const escapedName = escapeForAppleScript(name);
    const script = `
      tell application "Notes"
        tell account "${ICLOUD_ACCOUNT}"
          delete folder "${escapedName}"
        end tell
      end tell
    `;
    executeScript(script, 'Failed to delete folder');
    return { deleted: true, name };
  }

  async listNotes(options?: { folder?: string; limit?: number }): Promise<Note[]> {
    const limit = options?.limit || 100;
    const innerScript = `
      set noteList to {}
      set noteCount to 0
      repeat with n in notes
        if noteCount < ${limit} then
          set end of noteList to {id:(id of n), title:(name of n)}
          set noteCount to noteCount + 1
        end if
      end repeat
      return noteList
    `;
    const script = buildNotesScript(options?.folder, innerScript);
    const output = executeScript(script, 'Failed to list notes');
    return this.parseNoteList(output);
  }

  async getNote(title: string, folder?: string): Promise<Note> {
    const escapedTitle = escapeForAppleScript(title);
    const innerScript = `
      set theNote to note "${escapedTitle}"
      return {id:(id of theNote), title:(name of theNote), body:(body of theNote)}
    `;
    const script = buildNotesScript(folder, innerScript);
    const output = executeScript(script, 'Failed to get note');
    return {
      id: this.extractValue(output, 'id') || '',
      title: title,
      content: this.extractBody(output),
      folder: folder,
    };
  }

  async createNote(options: {
    title: string;
    content: string;
    folder?: string;
    tags?: string[];
  }): Promise<Note> {
    const folder = options.folder || 'Notes'; // Default to "Notes" folder
    // Prepend title as H1 so Apple Notes styles it as title (large, bold)
    const contentWithTitle = `# ${options.title}\n${options.content}`;
    let finalContent = formatContent(contentWithTitle);
    if (options.tags && options.tags.length > 0) {
      const tagString = options.tags.map((t) => `#${t}`).join(' ');
      finalContent = `${finalContent}<br><br>${tagString}`;
    }
    const innerScript = `
      set newNote to make new note with properties {body:"${finalContent}"}
      return id of newNote
    `;
    const script = buildNotesScript(folder, innerScript);
    const output = executeScript(script, 'Failed to create note');
    return {
      id: output || Date.now().toString(),
      title: options.title,
      content: options.content,
      folder: folder,
    };
  }

  async updateNote(options: {
    title: string;
    newContent: string;
    newTitle?: string;
    folder?: string;
  }): Promise<Note> {
    const escapedTitle = escapeForAppleScript(options.title);
    const finalTitle = options.newTitle || options.title;
    // Prepend title as H1 so Apple Notes styles it as title (large, bold)
    const contentWithTitle = `# ${finalTitle}\n${options.newContent}`;
    const formattedContent = formatContent(contentWithTitle);
    const innerScript = `
      set theNote to note "${escapedTitle}"
      set body of theNote to "${formattedContent}"
      return id of theNote
    `;
    const script = buildNotesScript(options.folder, innerScript);
    const output = executeScript(script, 'Failed to update note');
    return {
      id: output || '',
      title: finalTitle,
      content: options.newContent,
      folder: options.folder,
    };
  }

  async deleteNote(title: string, folder?: string): Promise<DeleteResult> {
    const escapedTitle = escapeForAppleScript(title);
    const innerScript = `delete note "${escapedTitle}"`;
    const script = buildNotesScript(folder, innerScript);
    executeScript(script, 'Failed to delete note');
    return { deleted: true, title };
  }

  async searchNotes(query: string, folder?: string): Promise<NoteSearchResult[]> {
    const escapedQuery = escapeForAppleScript(query);

    // If no folder specified, search all notes in account
    if (!folder) {
      const script = `
        tell application "Notes"
          tell account "${ICLOUD_ACCOUNT}"
            set matchingNotes to {}
            repeat with n in (notes whose name contains "${escapedQuery}")
              set end of matchingNotes to name of n
            end repeat
            return matchingNotes
          end tell
        end tell
      `;
      const output = executeScript(script, 'Failed to search notes');
      return output
        .split(',')
        .filter(Boolean)
        .map((title) => ({ title: title.trim() }));
    }

    // If folder specified, search recursively including subfolders
    const escapedFolder = escapeForAppleScript(folder);
    const script = `
      on searchFolder(theFolder, searchQuery)
        tell application "Notes"
          set matchingNotes to {}
          repeat with n in (notes of theFolder whose name contains searchQuery)
            set end of matchingNotes to name of n
          end repeat
          repeat with subFolder in folders of theFolder
            set matchingNotes to matchingNotes & my searchFolder(subFolder, searchQuery)
          end repeat
          return matchingNotes
        end tell
      end searchFolder

      tell application "Notes"
        tell account "${ICLOUD_ACCOUNT}"
          set targetFolder to folder "${escapedFolder}"
          return my searchFolder(targetFolder, "${escapedQuery}")
        end tell
      end tell
    `;
    const output = executeScript(script, 'Failed to search notes');
    return output
      .split(',')
      .filter(Boolean)
      .map((title) => ({ title: title.trim() }));
  }

  private parseKeyValuePairs<T>(
    output: string,
    pattern: RegExp,
    transform: (match: RegExpMatchArray) => T
  ): T[] {
    if (!output || output === '{}') return [];
    const results: T[] = [];
    for (const match of output.matchAll(pattern)) {
      results.push(transform(match));
    }
    return results;
  }

  private cleanValue(value: string): string {
    return value.trim().replace(/"/g, '');
  }

  private parseFolderList(output: string): NoteFolder[] {
    // AppleScript returns flat format: id:xxx, name:yyy, id:aaa, name:bbb
    return this.parseKeyValuePairs(output, /id:([^,]+),\s*name:([^,]+?)(?=,\s*id:|$)/g, (match) => ({
      id: this.cleanValue(match[1]),
      name: this.cleanValue(match[2]),
    }));
  }

  private parseNoteList(output: string): Note[] {
    // AppleScript returns flat format: id:xxx, title:yyy, id:aaa, title:bbb
    return this.parseKeyValuePairs(output, /id:([^,]+),\s*title:([^,]+?)(?=,\s*id:|$)/g, (match) => ({
      id: this.cleanValue(match[1]),
      title: this.cleanValue(match[2]),
    }));
  }

  private extractValue(output: string, key: string): string | null {
    const match = output.match(new RegExp(`${key}:([^,}]+)`));
    return match ? this.cleanValue(match[1]) : null;
  }

  private extractBody(output: string): string {
    const match = output.match(/body:(.+?)\}?\s*$/s);
    return match ? this.cleanValue(match[1]).replace(/\}$/, '') : '';
  }
}
