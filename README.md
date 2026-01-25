# macos-mcp

Unified MCP server for macOS Calendar, Reminders, and Notes. Provides 24 tools for interacting with native macOS apps.

## Installation

```bash
cd /Users/jbkjr/code/macos-mcp
npm install
npm run build:all  # Builds both TypeScript and Swift
```

## Usage

Add to `~/.claude.json`:

```json
{
  "mcpServers": {
    "macos": {
      "type": "stdio",
      "command": "node",
      "args": ["/Users/jbkjr/code/macos-mcp/build/index.js"]
    }
  }
}
```

## Tools

### Calendar (6 tools)
- `list_calendars` - List all calendars
- `list_calendar_events` - List events (filters: calendar, search, date range)
- `get_calendar_event` - Get single event by ID
- `create_calendar_event` - Create event
- `update_calendar_event` - Update event by ID
- `delete_calendar_event` - Delete event by ID

### Reminders (9 tools)
- `list_reminder_lists` - List all reminder lists
- `create_reminder_list` - Create new list
- `rename_reminder_list` - Rename existing list
- `delete_reminder_list` - Delete list
- `list_reminders` - List reminders (filters: list, completed, search, due date)
- `get_reminder` - Get single reminder by ID
- `create_reminder` - Create reminder
- `update_reminder` - Update reminder
- `delete_reminder` - Delete reminder by ID

### Notes (9 tools)
- `list_note_folders` - List all folders
- `create_note_folder` - Create new folder
- `delete_note_folder` - Delete folder
- `list_notes` - List notes (filters: folder, limit)
- `get_note` - Get note content by title
- `create_note` - Create note (supports Markdown)
- `update_note` - Update note content
- `delete_note` - Delete note
- `search_notes` - Search notes by query

## Architecture

```
┌─────────────────────────────────────────┐
│         TypeScript MCP Server           │
│  (@modelcontextprotocol/sdk + Zod)      │
└─────────────────┬───────────────────────┘
                  │
    ┌─────────────┼─────────────┐
    │             │             │
    ▼             ▼             ▼
┌─────────┐ ┌─────────┐ ┌─────────────┐
│ Swift   │ │ Swift   │ │ AppleScript │
│ CLI     │ │ CLI     │ │ (via Node)  │
│         │ │         │ │             │
│ Calendar│ │Reminders│ │   Notes     │
│EventKit │ │EventKit │ │             │
└─────────┘ └─────────┘ └─────────────┘
```

## Development

```bash
# Run tests
npm test

# Watch mode
npm run dev

# Build TypeScript only
npm run build

# Build Swift only
npm run build:swift
```

## Permissions

On first use, macOS will prompt for Calendar and Reminders access. Grant these in:
- System Settings > Privacy & Security > Calendars
- System Settings > Privacy & Security > Reminders

Notes access is granted via Automation permissions for `osascript`.
