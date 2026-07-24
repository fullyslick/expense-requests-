import { requests, users } from '../store';

describe('store seeding', () => {
  it('loads all seed users into a Map keyed by id', () => {
    expect(users.size).toBe(6);
    expect(users.get('u_alice')?.name).toBe('Alice');
    expect(users.get('u_trent')?.role).toBe('finance');
  });

  it('loads all seed requests into a Map keyed by id', () => {
    expect(requests.size).toBe(4);
    expect(requests.get('REQ-001')?.requesterId).toBe('u_alice');
    expect(requests.get('REQ-003')?.events).toHaveLength(3);
  });
});