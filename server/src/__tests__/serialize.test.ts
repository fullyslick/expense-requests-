import type { ExpenseRequest } from 'shared/types';
import { toResponse } from '../services/serialize';

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

describe('toResponse', () => {
  it('attaches derived status without an approverId for a Draft', () => {
    const response = toResponse(draftRequest);
    expect(response.status).toBe('Draft');
    expect(response.approverId).toBeUndefined();
  });

  it('attaches derived status and approverId for a Submitted request', () => {
    const response = toResponse(submittedRequest);
    expect(response.status).toBe('Submitted');
    expect(response.approverId).toBe('u_carol');
  });

  it('passes through every original field unchanged', () => {
    const response = toResponse(submittedRequest);
    expect(response.id).toBe(submittedRequest.id);
    expect(response.requesterId).toBe(submittedRequest.requesterId);
    expect(response.values).toEqual(submittedRequest.values);
    expect(response.events).toEqual(submittedRequest.events);
  });
});