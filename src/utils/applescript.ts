/**
 * AppleScript Executor
 * Executes AppleScript commands for Notes integration
 */

import { execFileSync, execSync } from 'node:child_process';

export interface AppleScriptResult {
  success: boolean;
  output: string;
  error?: string;
  /** The script was killed at the time limit, so whatever it was doing may have happened. */
  timedOut?: boolean;
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
 * Runs a script whose `on run argv` handler receives `args` as data. Values are
 * never spliced into script text, so they arrive byte for byte. Use this for
 * anything where whitespace matters: runAppleScript's line splitting trims it.
 * @param script - AppleScript source with an `on run argv` handler
 * @param args - Values for argv
 * @returns Object containing success status and output/error
 */
export function runAppleScriptWithArgs(script: string, args: string[]): AppleScriptResult {
  try {
    const output = execFileSync('/usr/bin/osascript', ['-e', script, '--', ...args], {
      encoding: 'utf8',
      // Long enough for someone to answer an Automation prompt.
      timeout: 120000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { success: true, output: output.replace(/\n$/, '') };
  } catch (error) {
    // error.message holds the command line, and so the values: report stderr only.
    const stderr = (error as { stderr?: string }).stderr?.trim();
    const timedOut = Boolean((error as { signal?: string }).signal);
    const message = stderr || (timedOut ? 'AppleScript timed out' : 'AppleScript execution failed');
    console.error('AppleScript execution failed:', message);
    return { success: false, output: '', error: message, ...(timedOut ? { timedOut } : {}) };
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
