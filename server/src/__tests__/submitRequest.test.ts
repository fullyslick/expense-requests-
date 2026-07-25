import type { User } from 'shared/types';
import { ForbiddenError, InvalidTransitionError, NoEligibleApproverError, ValidationError } from '../errors';
import { createDraft, submitRequest } from '../services/requests.service';

const alice: User = { id: 'u_alice', name: 'Alice', role: 'employee', managerId: 'u_carol' };
const bob: User = { id: 'u_bob', name: 'Bob', role: 'employee', managerId: 'u_mallory' };
const trent: User = { id: 'u_trent', name: 'Trent', role: 'finance', managerId: 'u_peggy' };

const validValues = {
  expenseType: 'Travel',
  amountCents: 5000,
  description: 'Taxi to the airport',
  billable: false,
};

describe('submitRequest', () => {
  it('submits a valid draft under $1,000, routing to the manager', () => {
    const draft = createDraft(alice, validValues);
    const submitted = submitRequest(alice, draft.id);

    expect(submitted.events.at(-1)).toEqual({
      type: 'submitted',
      at: expect.any(String),
      actorId: 'u_alice',
      approverId: 'u_carol',
    });
  });

  it('submits a valid draft at/over $1,000, routing to finance', () => {
    const draft = createDraft(bob, {
      ...validValues,
      amountCents: 125000,
      additionalJustification: 'Annual renewal, cheaper than monthly',
    });
    const submitted = submitRequest(bob, draft.id);

    expect(submitted.events.at(-1)).toMatchObject({ type: 'submitted', approverId: 'u_trent' });
  });

  it('rejects billable without a client', () => {
    const draft = createDraft(alice, { ...validValues, billable: true });
    expect(() => submitRequest(alice, draft.id)).toThrow(ValidationError);

    try {
      submitRequest(alice, draft.id);
      throw new Error('expected submitRequest to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).fieldErrors.client).toBeDefined();
    }
  });

  it('rejects amount >= $1,000 without additional justification', () => {
    const draft = createDraft(alice, { ...validValues, amountCents: 100000 });
    try {
      submitRequest(alice, draft.id);
      throw new Error('expected submitRequest to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).fieldErrors.additionalJustification).toBeDefined();
    }
  });

  it('rejects expenseType Other without otherReason', () => {
    const draft = createDraft(alice, { ...validValues, expenseType: 'Other' });
    try {
      submitRequest(alice, draft.id);
      throw new Error('expected submitRequest to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).fieldErrors.otherReason).toBeDefined();
    }
  });

  it('throws ForbiddenError when submitting someone else\'s draft', () => {
    const draft = createDraft(alice, validValues);
    expect(() => submitRequest(bob, draft.id)).toThrow(ForbiddenError);
  });

  it('throws InvalidTransitionError when submitting an already-Submitted request', () => {
    const draft = createDraft(alice, validValues);
    submitRequest(alice, draft.id);
    expect(() => submitRequest(alice, draft.id)).toThrow(InvalidTransitionError);
  });

  it('throws NoEligibleApproverError when Trent (finance) submits >= $1,000', () => {
    const draft = createDraft(trent, {
      ...validValues,
      amountCents: 150000,
      additionalJustification: 'Large finance-team purchase',
    });
    expect(() => submitRequest(trent, draft.id)).toThrow(NoEligibleApproverError);
  });
});