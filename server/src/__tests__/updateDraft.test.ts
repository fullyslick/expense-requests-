import type { User } from 'shared/types';
import { ForbiddenError, InvalidTransitionError } from '../errors';
import { createDraft, getRequest, updateDraft } from '../services/requests.service';

const alice: User = { id: 'u_alice', name: 'Alice', role: 'employee', managerId: 'u_carol' };
const bob: User = { id: 'u_bob', name: 'Bob', role: 'employee', managerId: 'u_carol' };

describe('updateDraft', () => {
  it('merges known values fields into the existing draft', () => {
    const draft = createDraft(alice, { description: 'Taxi' });
    const updated = updateDraft(alice, draft.id, { amountCents: 5000 });
    expect(updated.values).toEqual({ description: 'Taxi', amountCents: 5000 });
  });

  it('overwrites a field already present on the draft', () => {
    const draft = createDraft(alice, { description: 'Taxi' });
    const updated = updateDraft(alice, draft.id, { description: 'Uber' });
    expect(updated.values).toEqual({ description: 'Uber' });
  });

  it('leaves values not present in the body untouched', () => {
    const draft = createDraft(alice, { description: 'Taxi', amountCents: 1000 });
    const updated = updateDraft(alice, draft.id, { description: 'Uber' });
    expect(updated.values).toEqual({ description: 'Uber', amountCents: 1000 });
  });

  it('drops unknown fields, never allowing status/requesterId/approverId through', () => {
    const draft = createDraft(alice, {});
    const updated = updateDraft(alice, draft.id, {
      description: 'Uber',
      status: 'Approved',
      requesterId: 'u_bob',
      approverId: 'u_carol',
    });
    expect(updated.values).toEqual({ description: 'Uber' });
    expect(updated.requesterId).toBe('u_alice');
  });

  it('persists the update in the store', () => {
    const draft = createDraft(alice, {});
    updateDraft(alice, draft.id, { description: 'Uber' });
    expect(getRequest(draft.id).values).toEqual({ description: 'Uber' });
  });

  it('throws ForbiddenError when the actor is not the owner', () => {
    const draft = createDraft(alice, {});
    expect(() => updateDraft(bob, draft.id, { description: 'Uber' })).toThrow(ForbiddenError);
  });

  it('throws InvalidTransitionError for a non-Draft request', () => {
    expect(() => updateDraft(alice, 'REQ-002', { description: 'Uber' })).toThrow(
      InvalidTransitionError,
    );
  });
});