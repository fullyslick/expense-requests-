import app from '../index';
import request from 'supertest';

const draftValues = {
  expenseType: 'Travel',
  amountCents: 5000,
  description: 'Taxi to the airport',
  billable: false,
};

describe('lifecycle: create → PATCH → submit → approve', () => {
  it('walks a request through every status, growing history at each step', async () => {
    const created = await request(app)
      .post('/api/requests')
      .set('X-User-Id', 'u_alice')
      .send(draftValues);
    expect(created.status).toBe(200);
    expect(created.body.status).toBe('Draft');
    expect(created.body.events).toHaveLength(1);
    const id = created.body.id;

    const patched = await request(app)
      .patch(`/api/requests/${id}`)
      .set('X-User-Id', 'u_alice')
      .send({ description: 'Taxi to the airport, receipt attached' });
    expect(patched.status).toBe(200);
    expect(patched.body.status).toBe('Draft');
    expect(patched.body.events).toHaveLength(1);
    expect(patched.body.values.description).toBe('Taxi to the airport, receipt attached');

    const submitted = await request(app)
      .post(`/api/requests/${id}/submit`)
      .set('X-User-Id', 'u_alice');
    expect(submitted.status).toBe(200);
    expect(submitted.body.status).toBe('Submitted');
    expect(submitted.body.approverId).toBe('u_carol');
    expect(submitted.body.events).toHaveLength(2);

    const approved = await request(app)
      .post(`/api/requests/${id}/approve`)
      .set('X-User-Id', 'u_carol');
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe('Approved');
    expect(approved.body.events).toHaveLength(3);
  });
});

describe('rejection path: create → submit → reject', () => {
  it('walks a request to Rejected', async () => {
    const created = await request(app)
      .post('/api/requests')
      .set('X-User-Id', 'u_alice')
      .send(draftValues);
    const id = created.body.id;

    await request(app).post(`/api/requests/${id}/submit`).set('X-User-Id', 'u_alice');

    const rejected = await request(app)
      .post(`/api/requests/${id}/reject`)
      .set('X-User-Id', 'u_carol');
    expect(rejected.status).toBe(200);
    expect(rejected.body.status).toBe('Rejected');
    expect(rejected.body.events).toHaveLength(3);
  });
});

describe('security sweep', () => {
  it('no auth header → 401', async () => {
    const res = await request(app).get('/api/requests');
    expect(res.status).toBe(401);
  });

  it("submit another user's draft → 403", async () => {
    const created = await request(app)
      .post('/api/requests')
      .set('X-User-Id', 'u_alice')
      .send(draftValues);

    const res = await request(app)
      .post(`/api/requests/${created.body.id}/submit`)
      .set('X-User-Id', 'u_bob');

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  it('approve as a non-approver → 403', async () => {
    const created = await request(app)
      .post('/api/requests')
      .set('X-User-Id', 'u_alice')
      .send(draftValues);
    const id = created.body.id;
    await request(app).post(`/api/requests/${id}/submit`).set('X-User-Id', 'u_alice');

    const res = await request(app).post(`/api/requests/${id}/approve`).set('X-User-Id', 'u_bob');

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  it('approve as the requester → 403', async () => {
    const created = await request(app)
      .post('/api/requests')
      .set('X-User-Id', 'u_alice')
      .send(draftValues);
    const id = created.body.id;
    await request(app).post(`/api/requests/${id}/submit`).set('X-User-Id', 'u_alice');

    const res = await request(app).post(`/api/requests/${id}/approve`).set('X-User-Id', 'u_alice');

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  it('PATCH a non-Draft → 409', async () => {
    const created = await request(app)
      .post('/api/requests')
      .set('X-User-Id', 'u_alice')
      .send(draftValues);
    const id = created.body.id;
    await request(app).post(`/api/requests/${id}/submit`).set('X-User-Id', 'u_alice');

    const res = await request(app)
      .patch(`/api/requests/${id}`)
      .set('X-User-Id', 'u_alice')
      .send({ description: 'edited after submit' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('INVALID_TRANSITION');
  });

  it('POST/PATCH with status/requesterId/approverId in the body → ignored', async () => {
    const created = await request(app)
      .post('/api/requests')
      .set('X-User-Id', 'u_alice')
      .send({ ...draftValues, status: 'Approved', requesterId: 'u_bob', approverId: 'u_carol' });

    expect(created.body.requesterId).toBe('u_alice');
    expect(created.body.status).toBe('Draft');
    expect(created.body.approverId).toBeUndefined();

    const patched = await request(app)
      .patch(`/api/requests/${created.body.id}`)
      .set('X-User-Id', 'u_alice')
      .send({ status: 'Approved', requesterId: 'u_bob', approverId: 'u_carol' });

    expect(patched.body.requesterId).toBe('u_alice');
    expect(patched.body.status).toBe('Draft');
    expect(patched.body.approverId).toBeUndefined();
  });
});

describe('history entries', () => {
  it('carry actorId and at on every transition', async () => {
    const created = await request(app)
      .post('/api/requests')
      .set('X-User-Id', 'u_alice')
      .send(draftValues);
    const id = created.body.id;

    await request(app).post(`/api/requests/${id}/submit`).set('X-User-Id', 'u_alice');
    const approved = await request(app)
      .post(`/api/requests/${id}/approve`)
      .set('X-User-Id', 'u_carol');

    for (const event of approved.body.events) {
      expect(typeof event.actorId).toBe('string');
      expect(typeof event.at).toBe('string');
    }
  });
});