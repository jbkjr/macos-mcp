# macos-mcp

Unified MCP server for macOS Calendar, Reminders, and Notes. Provides 24 tools for interacting with native macOS apps.

## Requirements

- macOS 12.0+
- Node.js 18+
- Swift 5.9+ (included with Xcode)

## Installation

```bash
git clone https://github.com/jbkjr/macos-mcp.git
cd macos-mcp
npm install
npm run build:all  # Builds both TypeScript and Swift
```

## Usage

Add to your Claude Code configuration (`~/.claude.json`):

```json
{
  "mcpServers": {
    "macos": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/macos-mcp/build/index.js"]
    }
  }
}
```

Replace `/path/to/macos-mcp` with the actual path where you cloned the repository.

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
npm test           # Run tests
npm run dev        # Watch mode
npm run build      # Build TypeScript only
npm run build:swift  # Build Swift only
```

## Permissions

On first use, macOS will prompt for Calendar and Reminders access. Grant these in:
- System Settings > Privacy & Security > Calendars
- System Settings > Privacy & Security > Reminders

Notes access is granted via Automation permissions for `osascript`.

## License

MIT
