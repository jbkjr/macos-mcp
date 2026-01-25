/**
 * AppleScript Executor
 * Executes AppleScript commands for Notes integration
 */

import { execSync } from 'node:child_process';

export interface AppleScriptResult {
  success: boolean;
  output: string;
  error?: string;
}

/**
 * Escapes a string for use in a shell single-quoted argument
 * @param str - The string to escape
 * @returns The escaped string safe for shell single quotes
 */
function escapeForShellSingleQuotes(str: string): string {
  // In single quotes, only single quotes need escaping: ' -> '\''
  return str.replace(/'/g, "'\\''");
}

/**
 * Executes an AppleScript command and returns the result
 * @param script - The AppleScript command to execute
 * @returns Object containing success status and output/error
 */
export function runAppleScript(script: string): AppleScriptResult {
  try {
    // Split script into lines and build multiple -e arguments
    // osascript requires each -e argument to be a separate line of the script
    const lines = script
      .trim()
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const args = lines
      .map((line) => `-e '${escapeForShellSingleQuotes(line)}'`)
      .join(' ');

    // Execute the AppleScript command
    const output = execSync(`osascript ${args}`, {
      encoding: 'utf8',
      timeout: 30000, // 30 second timeout for Notes operations
    });

    return {
      success: true,
      output: output.trim(),
    };
  } catch (error) {
    console.error('AppleScript execution failed:', error);

    return {
      success: false,
      output: '',
      error:
        error instanceof Error
          ? error.message
          : 'Unknown error occurred while executing AppleScript',
    };
  }
}

/**
 * Escapes a string for embedding in AppleScript
 * @param str - The string to escape
 * @returns The escaped string safe for AppleScript
 */
export function escapeForAppleScript(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
