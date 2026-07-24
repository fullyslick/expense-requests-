import type { ExpenseRequest } from 'shared/types';
import { NotFoundError } from '../errors';
import * as store from '../store';

export function listRequests(): ExpenseRequest[] {
  return store.listRequests();
}

export function getRequest(id: string): ExpenseRequest {
  const request = store.getRequestById(id);
  if (!request) {
    throw new NotFoundError('Request not found');
  }
  return request;
}