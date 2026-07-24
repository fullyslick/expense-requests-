import { requestValuesSchema } from '../validation';

function fieldErrors(result: ReturnType<typeof requestValuesSchema.safeParse>) {
  if (result.success) return {};
  return result.error.flatten().fieldErrors;
}

const validBase = {
  expenseType: 'Travel' as const,
  amountCents: 4500,
  description: 'Taxi to the airport',
  billable: false,
};

describe('requestValuesSchema — base rules', () => {
  it('accepts a minimal valid request', () => {
    expect(requestValuesSchema.safeParse(validBase).success).toBe(true);
  });

  it('rejects an unknown expenseType', () => {
    const result = requestValuesSchema.safeParse({ ...validBase, expenseType: 'Golf' });
    expect(result.success).toBe(false);
    expect(fieldErrors(result).expenseType).toBeDefined();
  });

  it('rejects a negative amount', () => {
    const result = requestValuesSchema.safeParse({ ...validBase, amountCents: -100 });
    expect(result.success).toBe(false);
    expect(fieldErrors(result).amountCents).toBeDefined();
  });

  it('rejects a non-integer amount', () => {
    const result = requestValuesSchema.safeParse({ ...validBase, amountCents: 45.5 });
    expect(result.success).toBe(false);
    expect(fieldErrors(result).amountCents).toBeDefined();
  });

  it('rejects an empty description', () => {
    const result = requestValuesSchema.safeParse({ ...validBase, description: '' });
    expect(result.success).toBe(false);
    expect(fieldErrors(result).description).toBeDefined();
  });

  it('rejects a missing description', () => {
    const withoutDescription = {
      expenseType: validBase.expenseType,
      amountCents: validBase.amountCents,
      billable: validBase.billable,
    };
    const result = requestValuesSchema.safeParse(withoutDescription);
    expect(result.success).toBe(false);
    expect(fieldErrors(result).description).toBeDefined();
  });
});

describe('requestValuesSchema — conditional: client required when billable', () => {
  it('fires when billable is true and client is missing', () => {
    const result = requestValuesSchema.safeParse({ ...validBase, billable: true });
    expect(result.success).toBe(false);
    expect(fieldErrors(result).client).toBeDefined();
  });

  it('clears when billable is true and client is provided', () => {
    const result = requestValuesSchema.safeParse({
      ...validBase,
      billable: true,
      client: 'Acme',
    });
    expect(result.success).toBe(true);
  });

  it('does not fire when billable is false, even without a client', () => {
    const result = requestValuesSchema.safeParse({ ...validBase, billable: false });
    expect(result.success).toBe(true);
  });
});

describe('requestValuesSchema — conditional: additionalJustification required at >= $1,000', () => {
  it('does not require justification at 99999 cents', () => {
    const result = requestValuesSchema.safeParse({ ...validBase, amountCents: 99999 });
    expect(result.success).toBe(true);
  });

  it('fires at exactly 100000 cents with no justification', () => {
    const result = requestValuesSchema.safeParse({ ...validBase, amountCents: 100000 });
    expect(result.success).toBe(false);
    expect(fieldErrors(result).additionalJustification).toBeDefined();
  });

  it('clears at 100000 cents when justification is provided', () => {
    const result = requestValuesSchema.safeParse({
      ...validBase,
      amountCents: 100000,
      additionalJustification: 'Annual license renewal, cheaper than monthly',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a whitespace-only justification at the threshold', () => {
    const result = requestValuesSchema.safeParse({
      ...validBase,
      amountCents: 100000,
      additionalJustification: '   ',
    });
    expect(result.success).toBe(false);
    expect(fieldErrors(result).additionalJustification).toBeDefined();
  });
});

describe('requestValuesSchema — conditional: otherReason required when expenseType is Other', () => {
  it('fires when expenseType is Other and otherReason is missing', () => {
    const result = requestValuesSchema.safeParse({ ...validBase, expenseType: 'Other' });
    expect(result.success).toBe(false);
    expect(fieldErrors(result).otherReason).toBeDefined();
  });

  it('clears when expenseType is Other and otherReason is provided', () => {
    const result = requestValuesSchema.safeParse({
      ...validBase,
      expenseType: 'Other',
      otherReason: 'Team-building event supplies',
    });
    expect(result.success).toBe(true);
  });

  it('does not fire for a non-Other expenseType', () => {
    const result = requestValuesSchema.safeParse({ ...validBase, expenseType: 'Meal' });
    expect(result.success).toBe(true);
  });
});

describe('requestValuesSchema — multiple conditionals at once', () => {
  it('reports every missing conditional field together', () => {
    const result = requestValuesSchema.safeParse({
      expenseType: 'Other',
      amountCents: 150000,
      description: 'Conference sponsorship',
      billable: true,
    });
    expect(result.success).toBe(false);
    const errors = fieldErrors(result);
    expect(errors.client).toBeDefined();
    expect(errors.additionalJustification).toBeDefined();
    expect(errors.otherReason).toBeDefined();
  });
});
