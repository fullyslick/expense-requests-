import type { ExpenseRequest, Status, User } from 'shared/types';
import { ForbiddenError, InvalidTransitionError } from '../errors';
import { deriveStatus, getApproverId } from '../logic/deriveStatus';

export function assertOwner(actor: User, request: ExpenseRequest): void {
  if (actor.id !== request.requesterId) {
    throw new ForbiddenError('Only the requester can perform this action');
  }
}

export function assertStatus(request: ExpenseRequest, expected: Status): void {
  const status = deriveStatus(request.events);
  if (status !== expected) {
    throw new InvalidTransitionError(`Request must be ${expected}, but is ${status}`);
  }
}

export function assertAssignedApprover(actor: User, request: ExpenseRequest): void {
  const approverId = getApproverId(request.events);
  // undefined approverId (e.g. still a Draft) never matches an actor.id, so this also rejects requests with no approver yet.
  if (actor.id !== approverId) {
    throw new ForbiddenError('Only the assigned approver can perform this action');
  }
}