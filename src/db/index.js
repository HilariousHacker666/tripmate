const Database = require('better-sqlite3');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');

let dbInstance = null;

function getDb(customPath = null) {
  if (dbInstance && !customPath) {
    return dbInstance;
  }

  const dbFilePath = customPath || path.resolve(process.cwd(), config.dbFile);
  const db = new Database(dbFilePath);

  // Enforce WAL mode for better concurrency and foreign keys for referential integrity
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  initSchema(db);

  if (!customPath) {
    dbInstance = db;
  }
  return db;
}

function initSchema(db) {
  const schema = `
    -- Users table
    CREATE TABLE IF NOT EXISTS Users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      failed_login_attempts INTEGER DEFAULT 0,
      locked_until DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Trips table
    CREATE TABLE IF NOT EXISTS Trips (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      budget REAL DEFAULT 0.0,
      owner_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES Users(id) ON DELETE CASCADE
    );

    -- TripMembers table (Role based access: OWNER, EDITOR, VIEWER)
    CREATE TABLE IF NOT EXISTS TripMembers (
      id TEXT PRIMARY KEY,
      trip_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT CHECK(role IN ('OWNER', 'EDITOR', 'VIEWER')) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(trip_id, user_id),
      FOREIGN KEY (trip_id) REFERENCES Trips(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
    );

    -- Destinations table
    CREATE TABLE IF NOT EXISTS Destinations (
      id TEXT PRIMARY KEY,
      trip_id TEXT NOT NULL,
      name TEXT NOT NULL,
      country TEXT NOT NULL,
      arrival_date TEXT NOT NULL,
      departure_date TEXT NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trip_id) REFERENCES Trips(id) ON DELETE CASCADE
    );

    -- ItineraryItems table
    CREATE TABLE IF NOT EXISTS ItineraryItems (
      id TEXT PRIMARY KEY,
      trip_id TEXT NOT NULL,
      destination_id TEXT NOT NULL,
      day TEXT NOT NULL,
      time TEXT NOT NULL,
      title TEXT NOT NULL,
      location TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trip_id) REFERENCES Trips(id) ON DELETE CASCADE,
      FOREIGN KEY (destination_id) REFERENCES Destinations(id) ON DELETE CASCADE
    );

    -- Expenses table
    CREATE TABLE IF NOT EXISTS Expenses (
      id TEXT PRIMARY KEY,
      trip_id TEXT NOT NULL,
      amount REAL NOT NULL CHECK(amount > 0),
      currency TEXT NOT NULL DEFAULT 'USD',
      category TEXT NOT NULL CHECK(category IN ('Accommodation', 'Transport', 'Food', 'Activities', 'Shopping', 'Other')),
      description TEXT NOT NULL,
      paid_by TEXT NOT NULL,
      date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trip_id) REFERENCES Trips(id) ON DELETE CASCADE
    );

    -- AuditLogs table
    CREATE TABLE IF NOT EXISTS AuditLogs (
      id TEXT PRIMARY KEY,
      trip_id TEXT,
      user_id TEXT,
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      user_agent TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trip_id) REFERENCES Trips(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_trip_members ON TripMembers(trip_id, user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_trip ON AuditLogs(trip_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_trip ON Expenses(trip_id);
    CREATE INDEX IF NOT EXISTS idx_itinerary_trip ON ItineraryItems(trip_id);
    CREATE INDEX IF NOT EXISTS idx_destinations_trip ON Destinations(trip_id);
  `;

  db.exec(schema);
  logger.info('Database schema initialized successfully with WAL and Foreign Keys');
}

function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

module.exports = {
  getDb,
  closeDb,
  initSchema
};
