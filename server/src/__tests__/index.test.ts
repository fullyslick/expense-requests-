import request from 'supertest';
import app from '../index';

describe('GET /', () => {
  it('returns hello world', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toBe('hello world');
  });
});