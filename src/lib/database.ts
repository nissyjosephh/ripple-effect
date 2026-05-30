import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('ripple.db');

export function initDatabase(): void {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS cached_events (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      fetched_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cached_reports (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      fetched_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pending_contributions (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pending_reports (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cached_leaderboard (
      id INTEGER PRIMARY KEY,
      data TEXT NOT NULL,
      scope TEXT NOT NULL,
      fetched_at INTEGER NOT NULL
    );
  `);
}

export { db };