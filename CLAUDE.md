# macos-mcp

MCP server providing programmatic access to macOS Calendar, Reminders, and Notes.

## Architecture

```
MCP Client (Claude, etc.)
    ↓
TypeScript MCP Server (src/)
    ├── Calendar → Swift CLI (EventKit)
    ├── Reminders → Swift CLI (EventKit)
    └── Notes → AppleScript
```

- **TypeScript layer**: MCP server with Zod validation, organized by module (calendar/, reminders/, notes/)
- **Swift CLI** (`swift/Sources/MacOSMCPBridge/main.swift`): Single binary handling Calendar and Reminders via EventKit framework
- **AppleScript** (`src/utils/applescript.ts`): Notes interactions via osascript

## Build

```bash
npm run build:all    # Build both TypeScript and Swift
npm run build        # TypeScript only
npm run build:swift  # Swift only
npm test             # Run Vitest tests
```

Swift binary compiles to `bin/macos-mcp-bridge`.

## Adding New Tools

1. Define types in `src/<module>/types.ts`
2. Add Zod schemas in `src/<module>/tools.ts`
3. Implement service functions in `src/<module>/service.ts`
4. Register tools in `src/<module>/index.ts`
5. For Calendar/Reminders: add Swift command handling in `swift/Sources/MacOSMCPBridge/main.swift`

## Conventions

- All tool inputs validated with Zod schemas
- Dates use ISO 8601 format with timezone support
- Service functions return typed results, errors wrapped by `wrapServiceCall` helper
- Tests use Vitest with mocked system calls
