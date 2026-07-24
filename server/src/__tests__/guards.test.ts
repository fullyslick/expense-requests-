import type { ExpenseRequest, User } from 'shared/types';
import { ForbiddenError, InvalidTransitionError } from '../errors';
import { assertAssignedApprover, assertOwner, assertStatus } from '../services/guards';

const alice: User = { id: 'u_alice', name: 'Alice', role: 'employee', managerId: 'u_carol' };
const bob: User = { id: 'u_bob', name: 'Bob', role: 'employee', managerId: 'u_mallory' };
const carol: User = { id: 'u_carol', name: 'Carol', role: 'manager', managerId: 'u_peggy' };

const draftRequest: ExpenseRequest = {
  id: 'REQ-001',
  requesterId: 'u_alice',
  values: {
    expenseType: 'Travel',
    amountCents: 4500,
    description: 'Taxi to the airport',
    billable: false,
  },
  events: [{ type: 'created', at: '2026-01-01T00:00:00.000Z', actorId: 'u_alice' }],
};

const submittedRequest: ExpenseRequest = {
  ...draftRequest,
  id: 'REQ-002',
  events: [
    ...draftRequest.events,
    {
      type: 'submitted',
      at: '2026-01-02T00:00:00.000Z',
      actorId: 'u_alice',
      approverId: 'u_carol',
    },
  ],
};

describe('assertOwner', () => {
  it('passes for the owner', () => {
    expect(() => assertOwner(alice, draftRequest)).not.toThrow();
  });

  it('throws ForbiddenError for a non-owner', () => {
    expect(() => assertOwner(bob, draftRequest)).toThrow(ForbiddenError);
  });
});

describe('assertStatus', () => {
  it('passes when the derived status matches', () => {
    expect(() => assertStatus(draftRequest, 'Draft')).not.toThrow();
    expect(() => assertStatus(submittedRequest, 'Submitted')).not.toThrow();
  });

  it('throws InvalidTransitionError on a mismatch', () => {
    expect(() => assertStatus(submittedRequest, 'Draft')).toThrow(InvalidTransitionError);
  });
});

describe('assertAssignedApprover', () => {
  it('passes for the assigned approver', () => {
    expect(() => assertAssignedApprover(carol, submittedRequest)).not.toThrow();
  });

  it('throws ForbiddenError for anyone else, including the requester', () => {
    expect(() => assertAssignedApprover(bob, submittedRequest)).toThrow(ForbiddenError);
    expect(() => assertAssignedApprover(alice, submittedRequest)).toThrow(ForbiddenError);
  });

  it('throws ForbiddenError when there is no approver yet (e.g. still a Draft)', () => {
    expect(() => assertAssignedApprover(carol, draftRequest)).toThrow(ForbiddenError);
  });
});