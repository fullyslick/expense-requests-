import type { NextFunction, Request, Response } from 'express';
import {
  ForbiddenError,
  InvalidTransitionError,
  NoEligibleApproverError,
  NotFoundError,
  ValidationError,
} from '../errors';
import { errorHandler } from '../middleware/errorHandler';

function createMockResponse() {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const req = {} as Request;
const next = jest.fn() as NextFunction;

describe('errorHandler', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('maps NotFoundError to 404 with { error, message }', () => {
    const res = createMockResponse();
    errorHandler(new NotFoundError('Request not found'), req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'NOT_FOUND', message: 'Request not found' });
  });

  it('maps ForbiddenError to 403 with { error, message }', () => {
    const res = createMockResponse();
    errorHandler(new ForbiddenError('Only the owner can edit this request'), req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'FORBIDDEN',
      message: 'Only the owner can edit this request',
    });
  });

  it('maps InvalidTransitionError to 409 with { error, message }', () => {
    const res = createMockResponse();
    errorHandler(new InvalidTransitionError('Only a Draft can be submitted'), req, res, next);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: 'INVALID_TRANSITION',
      message: 'Only a Draft can be submitted',
    });
  });

  it('maps NoEligibleApproverError to 400 with { error, message }', () => {
    const res = createMockResponse();
    errorHandler(new NoEligibleApproverError('u_trent'), req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'NO_ELIGIBLE_APPROVER',
      message: expect.stringContaining('u_trent'),
    });
  });

  it('maps ValidationError to 400 with { error, fieldErrors } — no message key', () => {
    const res = createMockResponse();
    const fieldErrors = { amountCents: ['Must be at least 0'], client: ['Required'] };
    errorHandler(new ValidationError(fieldErrors), req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'VALIDATION_FAILED', fieldErrors });
  });

  it('maps an unknown error to a generic 500 without leaking its message', () => {
    const res = createMockResponse();
    const secret = new Error('column "ssn" does not exist in table users');
    errorHandler(secret, req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    const [body] = (res.json as jest.Mock).mock.calls[0];
    expect(body.error).toBe('INTERNAL_SERVER_ERROR');
    expect(body.message).not.toContain('ssn');
    expect(body).not.toHaveProperty('stack');
  });

  it('maps a thrown non-Error value to the same generic 500', () => {
    const res = createMockResponse();
    errorHandler('a string was thrown, not an Error', req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Something went wrong',
    });
  });

  it('logs unknown errors server-side for debugging', () => {
    const res = createMockResponse();
    const secret = new Error('boom');
    errorHandler(secret, req, res, next);
    expect(consoleErrorSpy).toHaveBeenCalledWith(secret);
  });
});