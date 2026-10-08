const request = require('supertest');
const app = require('../../src/app');

describe('E2E System Test: Full Collaborative Travel-Planning Lifecycle', () => {
  let aliceToken;
  let bobToken;
  let csrfToken;
  let tripId;
  let destId;

  beforeAll(async () => {
    // Health and CSRF setup
    const initRes = await request(app).get('/health');
    const cookies = initRes.headers['set-cookie'] || [];
    const csrfCookie = cookies.find(c => c.startsWith('XSRF-TOKEN='));
    csrfToken = csrfCookie ? csrfCookie.split(';')[0].split('=')[1] : 'token';
  });

  test('E2E-01: Register two new users (Alice and Bob)', async () => {
    const unique = Date.now();
    // Register Alice
    const regAlice = await request(app)
      .post('/api/auth/register')
      .set('x-csrf-token', csrfToken)
      .set('Cookie', `XSRF-TOKEN=${csrfToken}`)
      .send({
        name: 'Alice SystemTest',
        email: `alice_${unique}@test.local`,
        password: 'StrongPassword123!'
      });
    expect(regAlice.status).toBe(201);

    // Register Bob
    const regBob = await request(app)
      .post('/api/auth/register')
      .set('x-csrf-token', csrfToken)
      .set('Cookie', `XSRF-TOKEN=${csrfToken}`)
      .send({
        name: 'Bob SystemTest',
        email: `bob_${unique}@test.local`,
        password: 'StrongPassword123!'
      });
    expect(regBob.status).toBe(201);

    // Login Alice
    const loginAlice = await request(app)
      .post('/api/auth/login')
      .set('x-csrf-token', csrfToken)
      .set('Cookie', `XSRF-TOKEN=${csrfToken}`)
      .send({
        email: `alice_${unique}@test.local`,
        password: 'StrongPassword123!'
      });
    expect(loginAlice.status).toBe(200);
    aliceToken = loginAlice.body.token;

    // Login Bob
    const loginBob = await request(app)
      .post('/api/auth/login')
      .set('x-csrf-token', csrfToken)
      .set('Cookie', `XSRF-TOKEN=${csrfToken}`)
      .send({
        email: `bob_${unique}@test.local`,
        password: 'StrongPassword123!'
      });
    expect(loginBob.status).toBe(200);
    bobToken = loginBob.body.token;
  });

  test('E2E-02: Alice creates a trip', async () => {
    const res = await request(app)
      .post('/api/trips')
      .set('Authorization', `Bearer ${aliceToken}`)
      .set('x-csrf-token', csrfToken)
      .set('Cookie', `XSRF-TOKEN=${csrfToken}`)
      .send({
        title: 'Nordic Aurora Exploration 2026',
        description: 'Chasing the northern lights in Tromso and Lofoten',
        startDate: '2026-12-15',
        endDate: '2026-12-25',
        budget: 4500
      });

    expect(res.status).toBe(201);
    tripId = res.body.data.id;
  });

  test('E2E-03: Alice adds a destination to the trip', async () => {
    const res = await request(app)
      .post(`/api/trips/${tripId}/destinations`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .set('x-csrf-token', csrfToken)
      .set('Cookie', `XSRF-TOKEN=${csrfToken}`)
      .send({
        name: 'Tromso Fjord Cabin',
        country: 'Norway',
        arrivalDate: '2026-12-15',
        departureDate: '2026-12-20',
        notes: 'Northern Lights photography base'
      });

    expect(res.status).toBe(201);
    destId = res.body.data.id;
  });

  test('E2E-04: Alice creates an itinerary activity linked to destination', async () => {
    const res = await request(app)
      .post(`/api/trips/${tripId}/itinerary`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .set('x-csrf-token', csrfToken)
      .set('Cookie', `XSRF-TOKEN=${csrfToken}`)
      .send({
        destinationId: destId,
        day: '2026-12-16',
        time: '18:00',
        title: 'Aurora Borealis Sled Tour',
        location: 'Kvaloya Wilderness',
        notes: 'Wear sub-zero thermal suits'
      });

    expect(res.status).toBe(201);
  });

  test('E2E-05: Alice records an expense for cabin lodging', async () => {
    const res = await request(app)
      .post(`/api/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .set('x-csrf-token', csrfToken)
      .set('Cookie', `XSRF-TOKEN=${csrfToken}`)
      .send({
        amount: 1200.00,
        currency: 'USD',
        category: 'Accommodation',
        description: 'Tromso Fjord Lodge Booking',
        paid_by: 'Alice',
        date: '2026-12-15'
      });

    expect(res.status).toBe(201);
  });

  test('E2E-06: Alice shares the trip with Bob as VIEWER', async () => {
    // Look up Bob's email from decoded me endpoint
    const bobMe = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${bobToken}`);

    const res = await request(app)
      .post(`/api/trips/${tripId}/collaborators`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .set('x-csrf-token', csrfToken)
      .set('Cookie', `XSRF-TOKEN=${csrfToken}`)
      .send({
        email: bobMe.body.user.email,
        role: 'VIEWER'
      });

    expect(res.status).toBe(201);
  });

  test('E2E-07: Bob logs in, lists trips, views Alice’s trip and verified read-only access', async () => {
    // Bob lists trips
    const listRes = await request(app)
      .get('/api/trips')
      .set('Authorization', `Bearer ${bobToken}`);

    expect(listRes.status).toBe(200);
    const found = listRes.body.data.find(t => t.id === tripId);
    expect(found).toBeDefined();
    expect(found.role).toBe('VIEWER');

    // Bob views trip detail
    const detailRes = await request(app)
      .get(`/api/trips/${tripId}`)
      .set('Authorization', `Bearer ${bobToken}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.title).toBe('Nordic Aurora Exploration 2026');

    // Bob verifies he cannot delete the trip
    const delRes = await request(app)
      .delete(`/api/trips/${tripId}`)
      .set('Authorization', `Bearer ${bobToken}`)
      .set('x-csrf-token', csrfToken)
      .set('Cookie', `XSRF-TOKEN=${csrfToken}`);
    expect(delRes.status).toBe(403);
  });
});
