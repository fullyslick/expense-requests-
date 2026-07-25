import { pickValues } from '../services/requests.service';

describe('pickValues', () => {
  it('returns an empty object for an empty body', () => {
    expect(pickValues({})).toEqual({});
  });

  it('returns an empty object for non-object bodies', () => {
    expect(pickValues(null)).toEqual({});
    expect(pickValues(undefined)).toEqual({});
    expect(pickValues('a string')).toEqual({});
    expect(pickValues(42)).toEqual({});
  });

  it('picks only the seven known RequestValues keys', () => {
    const result = pickValues({
      expenseType: 'Travel',
      amountCents: 4500,
      description: 'Taxi to the airport',
      billable: true,
      client: 'Acme',
      additionalJustification: 'x',
      otherReason: 'y',
    });
    expect(result).toEqual({
      expenseType: 'Travel',
      amountCents: 4500,
      description: 'Taxi to the airport',
      billable: true,
      client: 'Acme',
      additionalJustification: 'x',
      otherReason: 'y',
    });
  });

  it('drops mass-assignment fields like status, requesterId, and approverId', () => {
    const result = pickValues({
      description: 'Lunch',
      status: 'Approved',
      requesterId: 'u_bob',
      approverId: 'u_carol',
      id: 'REQ-999',
    });
    expect(result).toEqual({ description: 'Lunch' });
  });

  it('drops unrelated/unknown fields', () => {
    const result = pickValues({ description: 'Lunch', notARealField: 'whatever' });
    expect(result).toEqual({ description: 'Lunch' });
  });

  it('passes through only the fields present, for a partial update', () => {
    expect(pickValues({ description: 'Updated description' })).toEqual({
      description: 'Updated description',
    });
  });
});
