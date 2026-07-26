import { deriveStatus, getApproverId } from '../logic/deriveStatus';
import { getUserById } from '../store';
import type { ExpenseRequest, ExpenseRequestResponse } from 'shared/types';

export function toResponse(request: ExpenseRequest): ExpenseRequestResponse {
  return {
    ...request,
    status: deriveStatus(request.events),
    approverId: getApproverId(request.events),
    // Joined here so the list page renders a name without fetching /users and
    // zipping the two together. Falls back to the id because a missing user is
    // a seed-data bug, not something worth 500ing a read over.
    requesterName: getUserById(request.requesterId)?.name ?? request.requesterId,
  };
}
