import request from 'supertest';
import app from '../index';

describe('GET /api/requests', () => {
  it('returns 401 without X-User-Id', async () => {
    const res = await request(app).get('/api/requests');
    expect(res.status).toBe(401);
  });

  it('returns all four seed requests with derived status and approverId', async () => {
    const res = await request(app).get('/api/requests').set('X-User-Id', 'u_alice');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(4);

    const byId = Object.fromEntries(res.body.map((r: { id: string }) => [r.id, r]));
    expect(byId['REQ-001'].status).toBe('Draft');
    expect(byId['REQ-001'].approverId).toBeUndefined();
    expect(byId['REQ-002'].status).toBe('Submitted');
    expect(byId['REQ-002'].approverId).toBe('u_carol');
    expect(byId['REQ-003'].status).toBe('Approved');
  });
});

describe('GET /api/requests/:id', () => {
  it('returns 401 without X-User-Id', async () => {
    const res = await request(app).get('/api/requests/REQ-001');
    expect(res.status).toBe(401);
  });

  it('returns the matching request with derived status', async () => {
    const res = await request(app).get('/api/requests/REQ-002').set('X-User-Id', 'u_alice');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('REQ-002');
    expect(res.body.status).toBe('Submitted');
    expect(res.body.approverId).toBe('u_carol');
  });

  it('returns 404 NOT_FOUND for an unknown id', async () => {
    const res = await request(app).get('/api/requests/nope').set('X-User-Id', 'u_alice');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });
});