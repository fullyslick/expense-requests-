import {
  ForbiddenError,
  InvalidTransitionError,
  NoEligibleApproverError,
  NotFoundError,
  ValidationError,
} from '../errors';

// Locks down the ADR §6 error contract table — status + code are what
// middleware/errorHandler.ts (Phase 4, next) will read off any caught error
// to build the response, so a drift here is a drift in the actual API shape.
describe('domain errors', () => {
  it('NotFoundError is a 404 NOT_FOUND', () => {
    const error = new NotFoundError('Request not found');
    expect(error.status).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error).toBeInstanceOf(Error);
  });

  it('ForbiddenError is a 403 FORBIDDEN', () => {
    const error = new ForbiddenError('Only the owner can edit this request');
    expect(error.status).toBe(403);
    expect(error.code).toBe('FORBIDDEN');
  });

  it('InvalidTransitionError is a 409 INVALID_TRANSITION', () => {
    const error = new InvalidTransitionError('Only a Draft can be submitted');
    expect(error.status).toBe(409);
    expect(error.code).toBe('INVALID_TRANSITION');
  });

  it('ValidationError is a 400 VALIDATION_FAILED and carries fieldErrors', () => {
    const fieldErrors = { amountCents: ['Must be at least 0'], client: ['Required'] };
    const error = new ValidationError(fieldErrors);
    expect(error.status).toBe(400);
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.fieldErrors).toBe(fieldErrors);
  });

  it('NoEligibleApproverError is a 400 NO_ELIGIBLE_APPROVER', () => {
    const error = new NoEligibleApproverError('u_trent');
    expect(error.status).toBe(400);
    expect(error.code).toBe('NO_ELIGIBLE_APPROVER');
    expect(error.message).toContain('u_trent');
  });

  it('each error class carries its own status/code (a switch is never needed)', () => {
    const errors = [
      new NotFoundError('x'),
      new ForbiddenError('x'),
      new InvalidTransitionError('x'),
      new ValidationError({}),
      new NoEligibleApproverError('u_trent'),
    ];
    const statusAndCodePairs = errors.map((error) => `${error.status}:${error.code}`);
    // No two error types should collapse onto the same status+code pair.
    expect(new Set(statusAndCodePairs).size).toBe(errors.length);
  });
});