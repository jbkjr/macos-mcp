/**
 * AppleScript Executor Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { escapeForAppleScript } from './applescript.js';

// Mock child_process
vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

describe('escapeForAppleScript', () => {
  it('should escape backslashes', () => {
    expect(escapeForAppleScript('path\\to\\file')).toBe('path\\\\to\\\\file');
  });

  it('should escape double quotes', () => {
    expect(escapeForAppleScript('He said "hello"')).toBe('He said \\"hello\\"');
  });

  it('should handle strings without special characters', () => {
    expect(escapeForAppleScript('simple text')).toBe('simple text');
  });

  it('should handle empty strings', () => {
    expect(escapeForAppleScript('')).toBe('');
  });

  it('should handle both backslashes and quotes', () => {
    expect(escapeForAppleScript('C:\\path\\"file"')).toBe('C:\\\\path\\\\\\"file\\"');
  });
});

describe('runAppleScript', () => {
  let execSyncMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const childProcess = await import('node:child_process');
    execSyncMock = childProcess.execSync as unknown as ReturnType<typeof vi.fn>;
    execSyncMock.mockReset();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should execute AppleScript and return success', async () => {
    execSyncMock.mockReturnValue('result');

    const { runAppleScript } = await import('./applescript.js');
    const result = runAppleScript('tell application "Notes" to get notes');

    expect(result.success).toBe(true);
    expect(result.output).toBe('result');
    expect(result.error).toBeUndefined();
  });

  it('should handle AppleScript errors', async () => {
    execSyncMock.mockImplementation(() => {
      throw new Error('AppleScript error');
    });

    const { runAppleScript } = await import('./applescript.js');
    const result = runAppleScript('invalid script');

    expect(result.success).toBe(false);
    expect(result.output).toBe('');
    expect(result.error).toContain('AppleScript error');
  });

  it('should split multiline scripts correctly', async () => {
    execSyncMock.mockReturnValue('');

    const { runAppleScript } = await import('./applescript.js');
    runAppleScript(`
      tell application "Notes"
        get notes
      end tell
    `);

    expect(execSyncMock).toHaveBeenCalledWith(
      expect.stringContaining('-e'),
      expect.any(Object)
    );
  });

  it('should handle single quote escaping in scripts', async () => {
    execSyncMock.mockReturnValue('');

    const { runAppleScript } = await import('./applescript.js');
    runAppleScript("get note \"It's a test\"");

    expect(execSyncMock).toHaveBeenCalled();
    const callArgs = execSyncMock.mock.calls[0][0] as string;
    expect(callArgs).toContain("'\\''");
  });

  it('should trim whitespace from output', async () => {
    execSyncMock.mockReturnValue('  result with spaces  \n');

    const { runAppleScript } = await import('./applescript.js');
    const result = runAppleScript('some script');

    expect(result.output).toBe('result with spaces');
  });
});
