const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const config = require('../../src/config');
const { getDb } = require('../../src/db');

describe('Negative Security Test Suite (Exam Security Focus)', () => {
  let ownerToken;
  let unauthorizedToken;
  let csrfToken;
  let ownerTripId;

  beforeAll(async () => {
    const initRes = await request(app).get('/health');
    const cookies = initRes.headers['set-cookie'] || [];
    const csrfCookie = cookies.find(c => c.startsWith('XSRF-TOKEN='));
    csrfToken = csrfCookie ? csrfCookie.split(';')[0].split('=')[1] : 'token';

    // Login Owner
    const ownerLogin = await request(app)
      .post('/api/auth/login')
      .set('x-csrf-token', csrfToken)
      .set('Cookie', `XSRF-TOKEN=${csrfToken}`)
      .send({ email: 'owner@tripmate.local', password: 'StrongPassword123!' });
    ownerToken = ownerLogin.body.token;

    // Login Unauthorized User (Viewer who has no access to newly created trip)
    const strangerLogin = await request(app)
      .post('/api/auth/login')
      .set('x-csrf-token', csrfToken)
      .set('Cookie', `XSRF-TOKEN=${csrfToken}`)
      .send({ email: 'viewer@tripmate.local', password: 'StrongPassword123!' });
    unauthorizedToken = strangerLogin.body.token;

    // Owner creates a private trip
    const tripRes = await request(app)
      .post('/api/trips')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-csrf-token', csrfToken)
      .set('Cookie', `XSRF-TOKEN=${csrfToken}`)
      .send({
        title: 'Top Secret Executive Retreat',
        startDate: '2026-11-20',
        endDate: '2026-11-25',
        budget: 10000
      });
    ownerTripId = tripRes.body.data.id;
  });

  // 1. IDOR / Existence Leakage Test
  test('SEC-01 [IDOR]: User B accessing User A private trip receives 404 (NOT 403)', async () => {
    const res = await request(app)
      .get(`/api/trips/${ownerTripId}`)
      .set('Authorization', `Bearer ${unauthorizedToken}`);

    // Must be 404 to prevent resource discovery/enumeration
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Trip not found.');
  });

  // 2. Privilege Escalation Prevention
  test('SEC-02 [Privilege Escalation]: Unauthorized user cannot promote themselves or invite others', async () => {
    const res = await request(app)
      .post(`/api/trips/${ownerTripId}/collaborators`)
      .set('Authorization', `Bearer ${unauthorizedToken}`)
      .set('x-csrf-token', csrfToken)
      .set('Cookie', `XSRF-TOKEN=${csrfToken}`)
      .send({
        email: 'attacker@evil.local',
        role: 'OWNER'
      });

    expect(res.status).toBe(404); // Returns 404 since trip is not accessible
  });

  // 3. SQL Injection Resistance
  test('SEC-03 [SQLi]: Injection payload in expense description is safely stored as literal', async () => {
    const sqlPayload = "Dinner'); DROP TABLE Users; --";
    const res = await request(app)
      .post(`/api/trips/${ownerTripId}/expenses`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-csrf-token', csrfToken)
      .set('Cookie', `XSRF-TOKEN=${csrfToken}`)
      .send({
        amount: 55.00,
        currency: 'USD',
        category: 'Food',
        description: sqlPayload,
        paid_by: 'Owner',
        date: '2026-11-21'
      });

    expect(res.status).toBe(201);
    
    // Verify Users table still exists and query succeeds
    const db = getDb();
    const userCheck = db.prepare('SELECT COUNT(*) as count FROM Users').get();
    expect(userCheck.count).toBeGreaterThan(0);
  });

  // 4. Stored XSS Prevention / HTML Sanitization
  test('SEC-04 [XSS]: XSS script tag payload in trip title is sanitized/escaped', async () => {
    const xssPayload = '<script>alert("XSS")</script>Paris Tour';
    const res = await request(app)
      .post('/api/trips')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-csrf-token', csrfToken)
      .set('Cookie', `XSRF-TOKEN=${csrfToken}`)
      .send({
        title: xssPayload,
        startDate: '2026-12-01',
        endDate: '2026-12-05',
        budget: 2000
      });

    expect(res.status).toBe(201);
    // express-validator escape() turns < into &lt;
    expect(res.body.data.title).toContain('&lt;script&gt;');
  });

  // 5. Expired / Forged JWT Token
  test('SEC-05 [JWT Forgery]: Request with forged JWT signature is rejected with 401', async () => {
    const fakeToken = jwt.sign({ userId: 'u-hacker' }, 'wrong-secret-key-123456');

    const res = await request(app)
      .get('/api/trips')
      .set('Authorization', `Bearer ${fakeToken}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  // 6. Missing or Invalid CSRF Token
  test('SEC-06 [CSRF]: State-changing POST without CSRF token is rejected with 403', async () => {
    const res = await request(app)
      .post('/api/trips')
      .set('Authorization', `Bearer ${ownerToken}`)
      // No x-csrf-token header supplied
      .send({
        title: 'Trip Without CSRF',
        startDate: '2026-12-01',
        endDate: '2026-12-05',
        budget: 1000
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('CSRF token');
  });

  // 7. Last Owner Protection
  test('SEC-07 [Last Owner Demotion]: System prevents removing or demoting the last OWNER', async () => {
    // Look up owner user id
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${ownerToken}`);
    const ownerId = meRes.body.user.id;

    const res = await request(app)
      .delete(`/api/trips/${ownerTripId}/collaborators/${ownerId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-csrf-token', csrfToken)
      .set('Cookie', `XSRF-TOKEN=${csrfToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Cannot remove the last OWNER');
  });
});
