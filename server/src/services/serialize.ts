import type { ExpenseRequest, Status } from 'shared/types';
import { deriveStatus, getApproverId } from '../logic/deriveStatus';

export type ExpenseRequestResponse = ExpenseRequest & {
  status: Status;
  approverId?: string;
};

export function toResponse(request: ExpenseRequest): ExpenseRequestResponse {
  return {
    ...request,
    status: deriveStatus(request.events),
    approverId: getApproverId(request.events),
  };
}