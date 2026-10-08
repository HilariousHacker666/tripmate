const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('./index');
const config = require('../config');
const logger = require('../utils/logger');

async function seed() {
  const db = getDb();
  logger.info('Starting TripMate database seed...');

  // Clear existing demo tables (safe for local development demo)
  db.exec(`
    DELETE FROM AuditLogs;
    DELETE FROM Expenses;
    DELETE FROM ItineraryItems;
    DELETE FROM Destinations;
    DELETE FROM TripMembers;
    DELETE FROM Trips;
    DELETE FROM Users;
  `);

  // Demo Password: StrongPassword123!
  const commonPassword = 'StrongPassword123!';
  const passwordHash = await bcrypt.hash(commonPassword, config.bcryptRounds);

  // 1. Create 3 Demo Users (owner, editor, viewer)
  const ownerId = uuidv4();
  const editorId = uuidv4();
  const viewerId = uuidv4();

  const insertUser = db.prepare(`
    INSERT INTO Users (id, email, password_hash, name)
    VALUES (?, ?, ?, ?)
  `);

  insertUser.run(ownerId, 'owner@tripmate.local', passwordHash, 'Alice (Owner)');
  insertUser.run(editorId, 'editor@tripmate.local', passwordHash, 'Bob (Editor)');
  insertUser.run(viewerId, 'viewer@tripmate.local', passwordHash, 'Charlie (Viewer)');

  // 2. Create Demo Trip
  const tripId = uuidv4();
  db.prepare(`
    INSERT INTO Trips (id, title, description, start_date, end_date, budget, owner_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    tripId,
    'Tokyo Tech & Culture Exploration 2026',
    'A collaborative trip to explore Akihabara, Shibuya, and cultural temples in Tokyo.',
    '2026-11-01',
    '2026-11-10',
    3500.00,
    ownerId
  );

  // 3. Assign Role Permissions in TripMembers
  const insertMember = db.prepare(`
    INSERT INTO TripMembers (id, trip_id, user_id, role)
    VALUES (?, ?, ?, ?)
  `);

  insertMember.run(uuidv4(), tripId, ownerId, 'OWNER');
  insertMember.run(uuidv4(), tripId, editorId, 'EDITOR');
  insertMember.run(uuidv4(), tripId, viewerId, 'VIEWER');

  // 4. Create Destinations
  const destShibuya = uuidv4();
  const destKyoto = uuidv4();
  const insertDest = db.prepare(`
    INSERT INTO Destinations (id, trip_id, name, country, arrival_date, departure_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertDest.run(destShibuya, tripId, 'Tokyo (Shibuya & Shinjuku)', 'Japan', '2026-11-01', '2026-11-06', 'Stay near Shibuya crossing');
  insertDest.run(destKyoto, tripId, 'Kyoto Historic District', 'Japan', '2026-11-06', '2026-11-10', 'Bullet train from Tokyo Central');

  // 5. Create Itinerary Items
  const insertItinerary = db.prepare(`
    INSERT INTO ItineraryItems (id, trip_id, destination_id, day, time, title, location, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertItinerary.run(uuidv4(), tripId, destShibuya, '2026-11-02', '09:00', 'Visit Meiji Shrine', 'Yoyogi Park', 'Traditional Shinto morning prayer');
  insertItinerary.run(uuidv4(), tripId, destShibuya, '2026-11-03', '14:00', 'Akihabara Tech Shopping', 'Akihabara Electric Town', 'Pick up retro electronics and hardware');
  insertItinerary.run(uuidv4(), tripId, destKyoto, '2026-11-07', '10:00', 'Fushimi Inari Taisha Walk', 'Fushimi Inari Shrine', 'Trek through the famous thousand Torii gates');

  // 6. Create Expenses
  const insertExpense = db.prepare(`
    INSERT INTO Expenses (id, trip_id, amount, currency, category, description, paid_by, date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertExpense.run(uuidv4(), tripId, 850.00, 'USD', 'Accommodation', 'Hotel Century Southern Tower', 'Alice', '2026-11-01');
  insertExpense.run(uuidv4(), tripId, 320.00, 'USD', 'Transport', '7-Day Japan Rail Pass', 'Bob', '2026-11-01');
  insertExpense.run(uuidv4(), tripId, 115.50, 'USD', 'Food', 'Sushi Dinner in Ginza', 'Alice', '2026-11-02');
  insertExpense.run(uuidv4(), tripId, 65.00, 'USD', 'Activities', 'Mori Art Museum Entrance', 'Bob', '2026-11-03');

  // 7. Seed Audit Logs
  const insertAudit = db.prepare(`
    INSERT INTO AuditLogs (id, trip_id, user_id, action, details, ip_address, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  insertAudit.run(uuidv4(), tripId, ownerId, 'TRIP_CREATE', JSON.stringify({ title: 'Tokyo Tech & Culture Exploration 2026' }), '127.0.0.1');
  insertAudit.run(uuidv4(), tripId, ownerId, 'COLLABORATOR_SHARE', JSON.stringify({ email: 'editor@tripmate.local', role: 'EDITOR' }), '127.0.0.1');
  insertAudit.run(uuidv4(), tripId, ownerId, 'COLLABORATOR_SHARE', JSON.stringify({ email: 'viewer@tripmate.local', role: 'VIEWER' }), '127.0.0.1');

  logger.info('Demo seed data populated successfully!');
  logger.info('--- DEMO ACCOUNTS (Password: StrongPassword123!) ---');
  logger.info('1. OWNER : owner@tripmate.local');
  logger.info('2. EDITOR: editor@tripmate.local');
  logger.info('3. VIEWER: viewer@tripmate.local');
  logger.info(`Demo Trip ID: ${tripId}`);
}

if (require.main === module) {
  seed().then(() => process.exit(0)).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { seed };
