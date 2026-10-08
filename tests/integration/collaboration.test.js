const request = require('supertest');
const app = require('../../src/app');
const { getDb } = require('../../src/db');

describe('Integration Test: Collaboration Lifecycle & Role Progression', () => {
  let ownerToken;
  let viewerToken;
  let viewerUserId;
  let tripId;
  let csrfToken;

  beforeAll(async () => {
    // Obtain CSRF token from initial safe request
    const initRes = await request(app).get('/health');
    const cookies = initRes.headers['set-cookie'] || [];
    const csrfCookie = cookies.find(c => c.startsWith('XSRF-TOKEN='));
    if (csrfCookie) {
      csrfToken = csrfCookie.split(';')[0].split('=')[1];
    } else {
      csrfToken = 'test-token';
    }

    // Login Owner
    const ownerLogin = await request(app)
      .post('/api/auth/login')
      .set('x-csrf-token', csrfToken)
      .set('Cookie', `XSRF-TOKEN=${csrfToken}`)
      .send({
        email: 'owner@tripmate.local',
        password: 'StrongPassword123!'
      });
    ownerToken = ownerLogin.body.token;

    // Login Viewer
    const viewerLogin = await request(app)
      .post('/api/auth/login')
      .set('x-csrf-token', csrfToken)
      .set('Cookie', `XSRF-TOKEN=${csrfToken}`)
      .send({
        email: 'viewer@tripmate.local',
        password: 'StrongPassword123!'
      });
    viewerToken = viewerLogin.body.token;
    viewerUserId = viewerLogin.body.user.id;
  });

  test('IT-01: Owner creates a new collaborative trip', async () => {
    const res = await request(app)
      .post('/api/trips')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-csrf-token', csrfToken)
      .set('Cookie', `XSRF-TOKEN=${csrfToken}`)
      .send({
        title: 'Alpine Expedition 2026',
        description: 'Testing role progression workflow',
        startDate: '2026-12-01',
        endDate: '2026-12-10',
        budget: 5000
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    tripId = res.body.data.id;
  });

  test('IT-02: Owner shares the trip with collaborator as VIEWER', async () => {
    const res = await request(app)
      .post(`/api/trips/${tripId}/collaborators`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-csrf-token', csrfToken)
      .set('Cookie', `XSRF-TOKEN=${csrfToken}`)
      .send({
        email: 'viewer@tripmate.local',
        role: 'VIEWER'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  test('IT-03: VIEWER tries to add an expense and gets 403 Forbidden', async () => {
    const res = await request(app)
      .post(`/api/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .set('x-csrf-token', csrfToken)
      .set('Cookie', `XSRF-TOKEN=${csrfToken}`)
      .send({
        amount: 150.00,
        currency: 'USD',
        category: 'Food',
        description: 'Unauthorized expense attempt',
        paid_by: 'Viewer',
        date: '2026-12-02'
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Forbidden');
  });

  test('IT-04: Owner upgrades collaborator role from VIEWER to EDITOR', async () => {
    const res = await request(app)
      .put(`/api/trips/${tripId}/collaborators/${viewerUserId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-csrf-token', csrfToken)
      .set('Cookie', `XSRF-TOKEN=${csrfToken}`)
      .send({
        role: 'EDITOR'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('IT-05: Promoted EDITOR now successfully creates the expense', async () => {
    const res = await request(app)
      .post(`/api/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .set('x-csrf-token', csrfToken)
      .set('Cookie', `XSRF-TOKEN=${csrfToken}`)
      .send({
        amount: 150.00,
        currency: 'USD',
        category: 'Food',
        description: 'Approved team dinner',
        paid_by: 'Charlie',
        date: '2026-12-02'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.amount).toBe(150.00);
  });
});
