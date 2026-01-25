/**
 * Notes Types
 */

export interface NoteFolder {
  id: string;
  name: string;
}

export interface Note {
  id: string;
  title: string;
  content?: string;
  folder?: string;
  creationDate?: string;
  modificationDate?: string;
}

export interface NoteSearchResult {
  title: string;
  folder?: string;
}

export interface DeleteResult {
  deleted: boolean;
  title?: string;
  name?: string;
}
