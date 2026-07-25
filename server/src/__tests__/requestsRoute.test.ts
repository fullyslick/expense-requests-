import app from '../index';
import request from 'supertest';

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

describe('POST /api/requests', () => {
  it('creates a draft with requesterId from the auth header, never from the body', async () => {
    const res = await request(app)
      .post('/api/requests')
      .set('X-User-Id', 'u_alice')
      .send({ requesterId: 'u_bob', description: 'Taxi' });

    expect(res.status).toBe(200);
    expect(res.body.requesterId).toBe('u_alice');
    expect(res.body.values).toEqual({ description: 'Taxi' });
    expect(res.body.status).toBe('Draft');
  });

  it('ignores status/requesterId/approverId in the body', async () => {
    const res = await request(app)
      .post('/api/requests')
      .set('X-User-Id', 'u_alice')
      .send({ status: 'Approved', requesterId: 'u_bob', approverId: 'u_carol' });

    expect(res.status).toBe(200);
    expect(res.body.requesterId).toBe('u_alice');
    expect(res.body.status).toBe('Draft');
    expect(res.body.approverId).toBeUndefined();
  });

  it('returns 401 without X-User-Id', async () => {
    const res = await request(app).post('/api/requests').send({});
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/requests/:id', () => {
  it('merges known fields into an owned draft', async () => {
    const created = await request(app)
      .post('/api/requests')
      .set('X-User-Id', 'u_alice')
      .send({ description: 'Taxi' });

    const res = await request(app)
      .patch(`/api/requests/${created.body.id}`)
      .set('X-User-Id', 'u_alice')
      .send({ amountCents: 5000 });

    expect(res.status).toBe(200);
    expect(res.body.values).toEqual({ description: 'Taxi', amountCents: 5000 });
  });

  it('leaves other values untouched when the body has only one field', async () => {
    const created = await request(app)
      .post('/api/requests')
      .set('X-User-Id', 'u_alice')
      .send({ description: 'Taxi', amountCents: 5000 });

    const res = await request(app)
      .patch(`/api/requests/${created.body.id}`)
      .set('X-User-Id', 'u_alice')
      .send({ description: 'Uber' });

    expect(res.status).toBe(200);
    expect(res.body.values).toEqual({ description: 'Uber', amountCents: 5000 });
  });

  it("returns 403 when patching someone else's draft", async () => {
    const created = await request(app).post('/api/requests').set('X-User-Id', 'u_alice').send({});

    const res = await request(app)
      .patch(`/api/requests/${created.body.id}`)
      .set('X-User-Id', 'u_bob')
      .send({ description: 'Uber' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  it('returns 409 when patching a Submitted request', async () => {
    const res = await request(app)
      .patch('/api/requests/REQ-002')
      .set('X-User-Id', 'u_alice')
      .send({ description: 'Uber' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('INVALID_TRANSITION');
  });

  it('returns 401 without X-User-Id', async () => {
    const res = await request(app).patch('/api/requests/REQ-001').send({});
    expect(res.status).toBe(401);
  });
});

describe('POST /api/requests/:id/submit', () => {
  it('submits a valid draft and returns it Submitted with an approver', async () => {
    const created = await request(app)
      .post('/api/requests')
      .set('X-User-Id', 'u_alice')
      .send({
        expenseType: 'Travel',
        amountCents: 5000,
        description: 'Taxi',
        billable: false,
      });

    const res = await request(app)
      .post(`/api/requests/${created.body.id}/submit`)
      .set('X-User-Id', 'u_alice')
      .send();

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Submitted');
    expect(res.body.approverId).toBe('u_carol');
  });

  it('returns 400 VALIDATION_FAILED with fieldErrors when billable has no client', async () => {
    const created = await request(app)
      .post('/api/requests')
      .set('X-User-Id', 'u_alice')
      .send({
        expenseType: 'Travel',
        amountCents: 5000,
        description: 'Taxi',
        billable: true,
      });

    const res = await request(app)
      .post(`/api/requests/${created.body.id}/submit`)
      .set('X-User-Id', 'u_alice')
      .send();

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_FAILED');
    expect(res.body.fieldErrors.client).toBeDefined();
  });

  it('returns 403 when submitting someone else\'s draft', async () => {
    const created = await request(app)
      .post('/api/requests')
      .set('X-User-Id', 'u_alice')
      .send({
        expenseType: 'Travel',
        amountCents: 5000,
        description: 'Taxi',
        billable: false,
      });

    const res = await request(app)
      .post(`/api/requests/${created.body.id}/submit`)
      .set('X-User-Id', 'u_bob')
      .send();

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  it('returns 409 when submitting an already-Submitted request', async () => {
    const res = await request(app)
      .post('/api/requests/REQ-002/submit')
      .set('X-User-Id', 'u_alice')
      .send();

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('INVALID_TRANSITION');
  });

  it('returns 400 NO_ELIGIBLE_APPROVER when Trent submits >= $1,000', async () => {
    const created = await request(app)
      .post('/api/requests')
      .set('X-User-Id', 'u_trent')
      .send({
        expenseType: 'Software',
        amountCents: 150000,
        description: 'Large finance-team purchase',
        billable: false,
        additionalJustification: 'Needed for year-end close',
      });

    const res = await request(app)
      .post(`/api/requests/${created.body.id}/submit`)
      .set('X-User-Id', 'u_trent')
      .send();

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('NO_ELIGIBLE_APPROVER');
  });

  it('returns 401 without X-User-Id', async () => {
    const res = await request(app).post('/api/requests/REQ-001/submit').send();
    expect(res.status).toBe(401);
  });
});
