/**
 * EventKit CLI Executor
 * Executes the Swift CLI binary and parses JSON output
 */

import { execFile, type ExecFileException } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Binary name
const BINARY_NAME = 'macos-mcp-bridge';

interface CliSuccessResponse<T> {
  status: 'success';
  result: T;
}

interface CliErrorResponse {
  status: 'error';
  message: string;
}

type CliResponse<T> = CliSuccessResponse<T> | CliErrorResponse;

/**
 * Permission domains for macOS
 */
export type PermissionDomain = 'calendars' | 'reminders' | 'contacts';

/**
 * Custom error for permission issues
 */
export class CliPermissionError extends Error {
  constructor(
    message: string,
    public readonly domain: PermissionDomain
  ) {
    super(message);
    this.name = 'CliPermissionError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

const execFilePromise = (
  cliPath: string,
  args: string[]
): Promise<{ stdout: string; stderr: string }> =>
  new Promise((resolve, reject) => {
    execFile(cliPath, args, { maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        const execError = error as ExecFileException & {
          stdout?: string | Buffer;
          stderr?: string | Buffer;
        };
        execError.stdout = stdout;
        execError.stderr = stderr;
        reject(execError);
        return;
      }
      resolve({ stdout, stderr });
    });
  });

/**
 * Find the CLI binary path
 */
function findBinaryPath(): string {
  // Look in the project's bin directory
  const projectRoot = path.resolve(__dirname, '..', '..');
  const possiblePaths = [
    path.join(projectRoot, 'bin', BINARY_NAME),
    path.join(projectRoot, 'build', 'bin', BINARY_NAME),
  ];

  for (const binPath of possiblePaths) {
    if (existsSync(binPath)) {
      return binPath;
    }
  }

  throw new Error(
    `EventKit CLI binary not found. Please run 'npm run build:swift' first. Searched: ${possiblePaths.join(', ')}`
  );
}

const bufferToString = (data?: string | Buffer | null): string | null => {
  if (typeof data === 'string') return data;
  if (Buffer.isBuffer(data)) return data.toString('utf8');
  return data == null ? null : String(data);
};

const PERMISSION_KEYWORDS = ['permission', 'authoriz'];

const CALENDAR_ACTIONS = new Set([
  'read-calendars',
  'read-events',
  'get-event',
  'create-event',
  'update-event',
  'delete-event',
]);

const CONTACT_ACTIONS = new Set(['resolve-contact']);

const extractAction = (args: string[]): string | undefined => {
  const actionIndex = args.indexOf('--action');
  if (actionIndex >= 0 && actionIndex + 1 < args.length) {
    return args[actionIndex + 1];
  }
  return undefined;
};

const inferDomainFromArgs = (args: string[]): PermissionDomain => {
  const action = extractAction(args);
  if (action && CALENDAR_ACTIONS.has(action)) {
    return 'calendars';
  }
  if (action && CONTACT_ACTIONS.has(action)) {
    return 'contacts';
  }
  return 'reminders';
};

const detectPermissionDomain = (
  message: string,
  args: string[]
): PermissionDomain | null => {
  const lower = message.toLowerCase();
  const mentionsPermission = PERMISSION_KEYWORDS.some((keyword) =>
    lower.includes(keyword)
  );
  if (!mentionsPermission) {
    return null;
  }
  if (lower.includes('reminder')) return 'reminders';
  if (lower.includes('calendar')) return 'calendars';
  if (lower.includes('contact')) return 'contacts';
  return inferDomainFromArgs(args);
};

const parseCliOutput = <T>(output: string, args: string[]): T => {
  let parsed: CliResponse<T>;
  try {
    parsed = JSON.parse(output) as CliResponse<T>;
  } catch (_error) {
    throw new Error('EventKit CLI execution failed: Invalid CLI output');
  }

  if (parsed.status === 'success') {
    return parsed.result;
  }

  const domain = detectPermissionDomain(parsed.message, args);
  if (domain) {
    throw new CliPermissionError(parsed.message, domain);
  }
  throw new Error(parsed.message);
};

const runCli = async <T>(cliPath: string, args: string[]): Promise<T> => {
  try {
    const { stdout } = await execFilePromise(cliPath, args);
    const normalized = bufferToString(stdout);
    if (!normalized) {
      throw new Error('EventKit CLI execution failed: Empty CLI output');
    }
    return parseCliOutput(normalized, args);
  } catch (error) {
    const execError = error as ExecFileException & {
      stdout?: string | Buffer;
    };
    const normalized = bufferToString(execError?.stdout);
    if (normalized) {
      return parseCliOutput(normalized, args);
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`EventKit CLI execution failed: ${errorMessage}`);
  }
};

/**
 * Executes the EventKit CLI binary with the given arguments.
 * @param args - An array of arguments to pass to the CLI.
 * @returns The parsed JSON result from the CLI.
 * @throws An error if the CLI execution fails or returns an error status.
 */
export async function executeCli<T>(args: string[]): Promise<T> {
  const cliPath = findBinaryPath();
  return runCli<T>(cliPath, args);
}
