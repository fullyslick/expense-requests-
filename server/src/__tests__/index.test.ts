import request from 'supertest';
import app from '../index';

describe('GET /', () => {
  it('returns hello world', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toBe('hello world');
  });

  it('sets a CORS header', async () => {
    const res = await request(app).get('/');
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });
});

describe('error handler wiring', () => {
  it('routes an error to the mounted error handler', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await request(app)
      .post('/')
      .set('Content-Type', 'application/json')
      .send('{not valid json');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'INTERNAL_SERVER_ERROR', message: 'Something went wrong' });

    consoleErrorSpy.mockRestore();
  });
});