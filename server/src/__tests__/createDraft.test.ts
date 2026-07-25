import type { User } from 'shared/types';
import { createDraft, getRequest } from '../services/requests.service';

const alice: User = { id: 'u_alice', name: 'Alice', role: 'employee', managerId: 'u_carol' };

describe('createDraft', () => {
  it('sets requesterId from the actor, never from the body', () => {
    const request = createDraft(alice, { requesterId: 'u_bob' });
    expect(request.requesterId).toBe('u_alice');
  });

  it('appends a single created event with the actor as actorId', () => {
    const request = createDraft(alice, {});
    expect(request.events).toEqual([
      { type: 'created', at: expect.any(String), actorId: 'u_alice' },
    ]);
  });

  it('allows an empty draft — no validation on create', () => {
    const request = createDraft(alice, {});
    expect(request.values).toEqual({});
  });

  it('picks only known values fields out of the body, dropping the rest', () => {
    const request = createDraft(alice, {
      description: 'Taxi to the airport',
      status: 'Approved',
      approverId: 'u_carol',
    });
    expect(request.values).toEqual({ description: 'Taxi to the airport' });
  });

  it('persists the draft in the store under a freshly generated id', () => {
    const request = createDraft(alice, { description: 'Hotel' });
    expect(getRequest(request.id)).toEqual(request);
  });
});