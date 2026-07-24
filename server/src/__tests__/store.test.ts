import {
  generateRequestId,
  getRequestById,
  getUserById,
  listRequests,
  listUsers,
  saveRequest,
} from '../store';

describe('store seeding', () => {
  it('loads all seed users, keyed by id', () => {
    expect(listUsers()).toHaveLength(6);
    expect(getUserById('u_alice')?.name).toBe('Alice');
    expect(getUserById('u_trent')?.role).toBe('finance');
  });

  it('loads all seed requests, keyed by id', () => {
    expect(listRequests()).toHaveLength(4);
    expect(getRequestById('REQ-001')?.requesterId).toBe('u_alice');
    expect(getRequestById('REQ-003')?.events).toHaveLength(3);
  });
});

describe('saveRequest', () => {
  it('overwrites an existing request in place, not a duplicate', () => {
    const existing = getRequestById('REQ-001');
    if (!existing) throw new Error('seed REQ-001 missing');

    const updated = {
      ...existing,
      values: { ...existing.values, description: 'updated description' },
    };
    saveRequest(updated);

    expect(listRequests()).toHaveLength(4);
    expect(getRequestById('REQ-001')?.values.description).toBe('updated description');
  });

  it('adds a new request under a freshly generated id', () => {
    const id = generateRequestId();

    saveRequest({
      id,
      requesterId: 'u_alice',
      values: {
        expenseType: 'Travel',
        amountCents: 1000,
        description: 'new draft',
        billable: false,
      },
      events: [],
    });

    expect(getRequestById(id)?.requesterId).toBe('u_alice');
    expect(listRequests()).toHaveLength(5);
  });
});