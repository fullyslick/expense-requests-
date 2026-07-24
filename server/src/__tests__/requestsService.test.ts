import { NotFoundError } from '../errors';
import { getRequest, listRequests } from '../services/requests.service';

describe('listRequests', () => {
  it('returns all four seed requests', () => {
    const requests = listRequests();
    expect(requests).toHaveLength(4);
    expect(requests.map((request) => request.id)).toEqual(
      expect.arrayContaining(['REQ-001', 'REQ-002', 'REQ-003', 'REQ-004']),
    );
  });
});

describe('getRequest', () => {
  it('returns the matching request', () => {
    const request = getRequest('REQ-001');
    expect(request.requesterId).toBe('u_alice');
  });

  it('throws NotFoundError for an unknown id', () => {
    expect(() => getRequest('nope')).toThrow(NotFoundError);
  });
});