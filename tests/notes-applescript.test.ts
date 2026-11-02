import { afterEach, describe, expect, it, vi } from 'vitest';
import { escapeForAppleScript } from '../src/utils/applescript.js';
import { NotesService } from '../src/notes/service.js';

/**
 * Runs the service's real scripts through the real osascript and its real output
 * parsing, with Notes replaced by records: the tell blocks are removed and `notes`
 * becomes a local list. No application is addressed.
 */
const ORDINARY = { id: 'x-coredata://1/ICNote/p1', name: 'Plain', body: '<div>plain</div>' };
const COMMA = { id: 'x-coredata://1/ICNote/p2', name: 'Groceries, weekly', body: '<div>x</div>' };
const TRICKY = { id: 'x-coredata://1/ICNote/p3', name: 'a, id:fake, title:b', body: '<div>x</div>' };
const QUOTED = {
  id: 'x-coredata://1/ICNote/p4',
  name: 'She said "hi"',
  body: '<div style="color:red">"quoted", id:nope, body:again, title:no}</div>\n<div>second}</div>',
};
const ALL = [ORDINARY, COMMA, TRICKY, QUOTED];

const record = (n: typeof ORDINARY) => `{id:"${escapeForAppleScript(n.id)}", name:"${escapeForAppleScript(n.name)}", body:"${escapeForAppleScript(n.body).replace(/\n/g, '\\n')}"}`;

vi.mock('../src/utils/applescript.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/utils/applescript.js')>();
  return { ...actual, runAppleScript: (script: string) => actual.runAppleScript(globalThis.rewriteNotesScript(script)) };
});

declare global {
  // eslint-disable-next-line no-var
  var rewriteNotesScript: (script: string) => string;
}

function useNotes(notes: (typeof ORDINARY)[]) {
  globalThis.rewriteNotesScript = (script) => {
    const lines = script
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => !/^tell (application|account|folder)\b/.test(line) && line !== 'end tell')
      .map((line) => line.replace(/\(notes whose name contains "[^"]*"\)/, 'notes'))
      .map((line) => (/^set theNote to note "/.test(line) ? `set theNote to ${record(notes[0])}` : line));
    const rewritten = [`set notes to {${notes.map(record).join(', ')}}`, ...lines].join('\n');
    expect(rewritten).not.toMatch(/application/);
    return rewritten;
  };
}

describe.runIf(process.platform === 'darwin')('notes through real AppleScript', () => {
  afterEach(() => vi.restoreAllMocks());

  it('list_notes keeps every title, commas and quotes included', async () => {
    useNotes(ALL);
    const notes = await new NotesService().listNotes();
    expect(notes).toEqual(ALL.map(({ id, name }) => ({ id, title: name })));
  });

  it('list_notes honours the limit', async () => {
    useNotes(ALL);
    expect(await new NotesService().listNotes({ limit: 2 })).toHaveLength(2);
  });

  it('list_notes returns nothing for an empty folder', async () => {
    useNotes([]);
    expect(await new NotesService().listNotes()).toEqual([]);
  });

  it('search_notes keeps comma titles whole', async () => {
    useNotes(ALL);
    const found = await new NotesService().searchNotes('anything');
    expect(found).toEqual(ALL.map(({ name }) => ({ title: name })));
  });

  it('search_notes returns nothing when nothing matches', async () => {
    useNotes([]);
    expect(await new NotesService().searchNotes('anything')).toEqual([]);
  });

  it('get_note keeps quotes, braces and field-like text in the body exactly', async () => {
    useNotes([QUOTED]);
    const note = await new NotesService().getNote(QUOTED.name);
    expect(note).toEqual({ id: QUOTED.id, title: QUOTED.name, content: QUOTED.body, folder: undefined });
  });
});
