import type { User } from 'shared/types';
import { ForbiddenError, InvalidTransitionError } from '../errors';
import { approveRequest, createDraft, rejectRequest, submitRequest } from '../services/requests.service';

const alice: User = { id: 'u_alice', name: 'Alice', role: 'employee', managerId: 'u_carol' };
const bob: User = { id: 'u_bob', name: 'Bob', role: 'employee', managerId: 'u_mallory' };
const carol: User = { id: 'u_carol', name: 'Carol', role: 'manager', managerId: 'u_peggy' };

const validValues = {
  expenseType: 'Travel',
  amountCents: 5000,
  description: 'Taxi to the airport',
  billable: false,
};

function submittedByAlice() {
  const draft = createDraft(alice, validValues);
  return submitRequest(alice, draft.id).id;
}

describe('approveRequest', () => {
  it("approves when Carol is the assigned approver, appending an 'approved' event", () => {
    const id = submittedByAlice();
    const approved = approveRequest(carol, id);
    expect(approved.events.at(-1)).toEqual({
      type: 'approved',
      at: expect.any(String),
      actorId: 'u_carol',
    });
  });

  it('throws ForbiddenError when a non-approver tries to approve', () => {
    const id = submittedByAlice();
    expect(() => approveRequest(bob, id)).toThrow(ForbiddenError);
  });

  it('throws ForbiddenError when the requester tries to approve their own request', () => {
    const id = submittedByAlice();
    expect(() => approveRequest(alice, id)).toThrow(ForbiddenError);
  });

  it('throws InvalidTransitionError when approving an already-Approved request', () => {
    const id = submittedByAlice();
    approveRequest(carol, id);
    expect(() => approveRequest(carol, id)).toThrow(InvalidTransitionError);
  });
});

describe('rejectRequest', () => {
  it("rejects when Carol is the assigned approver, appending a 'rejected' event", () => {
    const id = submittedByAlice();
    const rejected = rejectRequest(carol, id);
    expect(rejected.events.at(-1)).toEqual({
      type: 'rejected',
      at: expect.any(String),
      actorId: 'u_carol',
    });
  });

  it('throws ForbiddenError when a non-approver tries to reject', () => {
    const id = submittedByAlice();
    expect(() => rejectRequest(bob, id)).toThrow(ForbiddenError);
  });

  it('throws ForbiddenError when the requester tries to reject their own request', () => {
    const id = submittedByAlice();
    expect(() => rejectRequest(alice, id)).toThrow(ForbiddenError);
  });

  it('throws InvalidTransitionError when rejecting an already-Approved request', () => {
    const id = submittedByAlice();
    approveRequest(carol, id);
    expect(() => rejectRequest(carol, id)).toThrow(InvalidTransitionError);
  });
});