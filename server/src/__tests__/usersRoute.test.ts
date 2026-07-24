import request from 'supertest';
import app from '../index';

describe('GET /api/users', () => {
  it('returns all six seed users for a known X-User-Id', async () => {
    const res = await request(app).get('/api/users').set('X-User-Id', 'u_alice');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(6);
    expect(res.body.map((user: { id: string }) => user.id)).toContain('u_alice');
  });

  it('returns 401 when X-User-Id is missing', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  it('returns 401 for an unknown X-User-Id', async () => {
    const res = await request(app).get('/api/users').set('X-User-Id', 'u_does_not_exist');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });
});