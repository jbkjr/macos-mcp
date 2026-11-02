/**
 * EventKit CLI Executor
 * Executes the Swift CLI binary and parses JSON output
 */

import { execFile, type ExecFileException } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Binary name
const BINARY_NAME = 'macos-mcp-bridge';
// App bundle wrapper. Preferred over the bare binary: launching it through
// LaunchServices makes it its own TCC "responsible process", so macOS keys
// Calendar/Reminders/Contacts consent to its bundle ID instead of to whichever
// node binary spawned it (a path that changes on every node upgrade).
const APP_BUNDLE_NAME = 'MacOSMCPBridge.app';

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
 * Whole-call budget, long enough for someone to answer a TCC prompt. The bridge's
 * own watchdog (bridgeWatchdogSeconds, 150 s) fires first when the bridge has one.
 */
const BRIDGE_TIMEOUT_MS = 180_000;

const timedOut = () => new Error(`Bridge timed out after ${BRIDGE_TIMEOUT_MS / 1000} s`);

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

/**
 * Launch the .app bundle via LaunchServices (`open -W -n`) and collect its
 * output through temp files. Direct execFile of the binary inherits the
 * parent's TCC identity and gets denied without a prompt on macOS 14+.
 */
const execViaLaunchServices = async (
  appPath: string,
  args: string[]
): Promise<{ stdout: string; stderr: string }> => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'macos-mcp-bridge-'));
  const outPath = path.join(tmpDir, 'stdout');
  const errPath = path.join(tmpDir, 'stderr');
  try {
    // `-W` (wait) races with fast-exiting apps: open can fail with
    // "Unable to block on applications (initial call to kevent() failed)"
    // after the bridge has already finished. So treat that specific failure
    // as non-fatal and poll the output file until it holds complete JSON.
    const started = Date.now();
    let raced = false;
    await new Promise<void>((resolve, reject) => {
      execFile(
        '/usr/bin/open',
        ['-W', '-n', '--stdout', outPath, '--stderr', errPath,
          // Forward launch configuration as environment, never bridge argv.
          ...(args[1]?.startsWith('guarded-calendar-') ? ['--env', `MACOS_MCP_CALENDAR_POLICY=${process.env.MACOS_MCP_CALENDAR_POLICY ?? ''}`] : []),
          appPath, '--args', ...args],
        { maxBuffer: 1024 * 1024, timeout: BRIDGE_TIMEOUT_MS },
        (error) => {
          if (error?.killed) {
            reject(timedOut());
            return;
          }
          if (error && !/Unable to block on applications/.test(String(error.message))) {
            reject(error);
            return;
          }
          raced = error !== null;
          resolve();
        }
      );
    });
    // After a race the bridge may still be running, perhaps behind a TCC prompt.
    const deadline = raced ? started + BRIDGE_TIMEOUT_MS : Date.now() + 15_000;
    let stdout = '';
    for (;;) {
      stdout = existsSync(outPath) ? await readFile(outPath, 'utf8') : '';
      const trimmed = stdout.trim();
      if (trimmed.length > 0) {
        try {
          JSON.parse(trimmed);
          break;
        } catch {
          // partial write; keep polling
        }
      }
      if (Date.now() > deadline) break;
      await new Promise((r) => setTimeout(r, 40));
    }
    const stderr = existsSync(errPath) ? await readFile(errPath, 'utf8') : '';
    return { stdout, stderr };
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
};

const execFilePromise = (
  cliPath: string,
  args: string[]
): Promise<{ stdout: string; stderr: string }> =>
  cliPath.endsWith('.app')
    ? execViaLaunchServices(cliPath, args)
    : new Promise((resolve, reject) => {
    execFile(cliPath, args, { maxBuffer: 50 * 1024 * 1024, timeout: BRIDGE_TIMEOUT_MS }, (error, stdout, stderr) => {
      if (error?.killed) {
        reject(timedOut());
        return;
      }
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

/** Error code when no bridge exists to launch, so nothing can have happened. */
export const BRIDGE_NOT_INSTALLED = 'BRIDGE_NOT_INSTALLED';

/**
 * Find the CLI binary path
 */
function findBinaryPath(): string {
  // Look in the project's bin directory
  const projectRoot = path.resolve(__dirname, '..', '..');
  const possiblePaths = [
    path.join(projectRoot, 'bin', APP_BUNDLE_NAME),
    path.join(projectRoot, 'bin', BINARY_NAME),
    path.join(projectRoot, 'build', 'bin', BINARY_NAME),
  ];

  for (const binPath of possiblePaths) {
    if (existsSync(binPath)) {
      return binPath;
    }
  }

  throw Object.assign(
    new Error(
      `EventKit CLI binary not found. Please run 'npm run build:swift' first. Searched: ${possiblePaths.join(', ')}`
    ),
    { code: BRIDGE_NOT_INSTALLED }
  );
}

const bufferToString = (data?: string | Buffer | null): string | null => {
  if (typeof data === 'string') return data;
  if (Buffer.isBuffer(data)) return data.toString('utf8');
  return data == null ? null : String(data);
};

const PERMISSION_KEYWORDS = ['permission', 'authoriz'];

const CALENDAR_ACTIONS = new Set([
  'guarded-calendar-create-event',
  'guarded-calendar-reschedule-event',
  'guarded-calendar-update-event',
  'read-calendars',
  'read-events',
  'get-event',
  'create-event',
  'update-event',
  'delete-event',
]);

const CONTACT_ACTIONS = new Set([
  'resolve-contact',
  'search-contacts',
  'get-contact',
  'list-contacts',
  'list-contact-groups',
  'create-contact',
  'update-contact',
  'delete-contact',
]);

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
