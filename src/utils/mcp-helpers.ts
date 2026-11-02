/**
 * MCP Tool Helpers
 * Shared utilities for MCP tool registration
 */

/**
 * MCP tool result type compatible with the SDK's CallToolResult.
 * The index signature allows for additional properties required by the SDK.
 */
interface ToolResult {
  [key: string]: unknown;
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

/** Bridge not-found errors all read "... ID '<id>' not found". */
const ID_NOT_FOUND = /\bID '.*' not found/;
const FULL_ID_HINT =
  ' IDs must be given in full, exactly as a list or get tool returned them (a full UUID for reminders, not a prefix); prefixes are not matched.';

/**
 * Wraps an async handler function with standardized JSON output and error handling.
 * Reduces boilerplate in tool registrations.
 */
export function wrapToolHandler<T, R>(
  handler: (params: T) => Promise<R>
): (params: T) => Promise<ToolResult> {
  return async (params: T): Promise<ToolResult> => {
    try {
      const result = await handler(params);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      let message = error instanceof Error ? error.message : String(error);
      if (ID_NOT_FOUND.test(message)) message += FULL_ID_HINT;
      return {
        content: [{ type: 'text', text: `Error: ${message}` }],
        isError: true,
      };
    }
  };
}
