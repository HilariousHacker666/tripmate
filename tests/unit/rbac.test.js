let db;

jest.mock('../../src/services/auditService', () => ({
  logAudit: jest.fn()
}));

const dbModule = require('../../src/db');
const Database = require('better-sqlite3');
const { initSchema } = require('../../src/db');
let requireTripRole;

describe('Unit Test: RBAC Middleware (requireTripRole)', () => {
  beforeAll(() => {
    // In-memory isolated database
    db = new Database(':memory:');
    initSchema(db);

    jest.spyOn(dbModule, 'getDb').mockImplementation(() => db);
    requireTripRole = require('../../src/middleware/rbac').requireTripRole;

    // Seed test user and trip
    db.prepare("INSERT INTO Users (id, email, password_hash, name) VALUES ('u-owner', 'o@test.local', 'hash', 'Owner')").run();
    db.prepare("INSERT INTO Users (id, email, password_hash, name) VALUES ('u-editor', 'e@test.local', 'hash', 'Editor')").run();
    db.prepare("INSERT INTO Users (id, email, password_hash, name) VALUES ('u-viewer', 'v@test.local', 'hash', 'Viewer')").run();
    db.prepare("INSERT INTO Users (id, email, password_hash, name) VALUES ('u-stranger', 's@test.local', 'hash', 'Stranger')").run();

    db.prepare("INSERT INTO Trips (id, title, start_date, end_date, budget, owner_id) VALUES ('t-1', 'Test Trip', '2026-01-01', '2026-01-05', 1000, 'u-owner')").run();

    db.prepare("INSERT INTO TripMembers (id, trip_id, user_id, role) VALUES ('m-1', 't-1', 'u-owner', 'OWNER')").run();
    db.prepare("INSERT INTO TripMembers (id, trip_id, user_id, role) VALUES ('m-2', 't-1', 'u-editor', 'EDITOR')").run();
    db.prepare("INSERT INTO TripMembers (id, trip_id, user_id, role) VALUES ('m-3', 't-1', 'u-viewer', 'VIEWER')").run();
  });

  afterAll(() => {
    jest.restoreAllMocks();
    db.close();
  });

  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  test('UT-01: OWNER is permitted when role requires OWNER', () => {
    const req = {
      params: { tripId: 't-1' },
      user: { id: 'u-owner' },
      method: 'DELETE',
      originalUrl: '/api/trips/t-1',
      get: () => 'Jest'
    };
    const res = mockRes();
    const next = jest.fn();

    const middleware = requireTripRole(['OWNER']);
    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.tripRole).toBe('OWNER');
  });

  test('UT-02: EDITOR is denied (403) when role requires OWNER', () => {
    const req = {
      params: { tripId: 't-1' },
      user: { id: 'u-editor' },
      method: 'DELETE',
      originalUrl: '/api/trips/t-1',
      get: () => 'Jest'
    };
    const res = mockRes();
    const next = jest.fn();

    const middleware = requireTripRole(['OWNER']);
    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: expect.stringContaining('Forbidden')
    }));
  });

  test('UT-03: VIEWER is denied (403) when role requires OWNER or EDITOR', () => {
    const req = {
      params: { tripId: 't-1' },
      user: { id: 'u-viewer' },
      method: 'POST',
      originalUrl: '/api/trips/t-1/expenses',
      get: () => 'Jest'
    };
    const res = mockRes();
    const next = jest.fn();

    const middleware = requireTripRole(['OWNER', 'EDITOR']);
    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('UT-04: Non-collaborator gets 404 (preventing trip existence enumeration)', () => {
    const req = {
      params: { tripId: 't-1' },
      user: { id: 'u-stranger' },
      method: 'GET',
      originalUrl: '/api/trips/t-1',
      get: () => 'Jest'
    };
    const res = mockRes();
    const next = jest.fn();

    const middleware = requireTripRole(['OWNER', 'EDITOR', 'VIEWER']);
    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: 'Trip not found.'
    }));
  });
});
