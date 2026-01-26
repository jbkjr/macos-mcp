/**
 * Messages Database
 * SQLite connection and helpers for reading chat.db
 */

import Database from 'better-sqlite3';
import { homedir } from 'node:os';
import { existsSync } from 'node:fs';
import path from 'node:path';

// macOS epoch starts at 2001-01-01 00:00:00 UTC
const MACOS_EPOCH_OFFSET = 978307200;

// chat.db uses nanoseconds for timestamps
const NANOSECONDS_PER_SECOND = 1e9;

/**
 * Convert macOS timestamp (nanoseconds since 2001-01-01) to ISO 8601 string
 */
export function macosTimestampToISO(nanoseconds: number | null): string | undefined {
  if (nanoseconds === null || nanoseconds === 0) {
    return undefined;
  }
  const unixSeconds = nanoseconds / NANOSECONDS_PER_SECOND + MACOS_EPOCH_OFFSET;
  return new Date(unixSeconds * 1000).toISOString();
}

/**
 * Convert ISO 8601 string to macOS timestamp (nanoseconds since 2001-01-01)
 */
export function isoToMacosTimestamp(isoString: string): number {
  const date = new Date(isoString);
  const unixSeconds = date.getTime() / 1000;
  return (unixSeconds - MACOS_EPOCH_OFFSET) * NANOSECONDS_PER_SECOND;
}

/**
 * Get the path to the Messages chat.db
 */
export function getChatDbPath(): string {
  return path.join(homedir(), 'Library', 'Messages', 'chat.db');
}

/**
 * Check if chat.db exists and is accessible
 */
export function chatDbExists(): boolean {
  return existsSync(getChatDbPath());
}

let dbInstance: Database.Database | null = null;

/**
 * Get a read-only connection to chat.db
 * Returns a cached connection for efficiency
 */
export function getDatabase(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = getChatDbPath();

  if (!chatDbExists()) {
    throw new Error(
      `Messages database not found at ${dbPath}. ` +
        'Ensure Messages.app has been used on this Mac.'
    );
  }

  try {
    // Open in read-only mode to avoid conflicts with Messages.app
    dbInstance = new Database(dbPath, { readonly: true });
    return dbInstance;
  } catch (error) {
    if (error instanceof Error && error.message.includes('SQLITE_CANTOPEN')) {
      throw new Error(
        'Cannot open Messages database. Full Disk Access is required.\n\n' +
          'Please grant Full Disk Access to this application in:\n' +
          'System Settings > Privacy & Security > Full Disk Access'
      );
    }
    throw error;
  }
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
