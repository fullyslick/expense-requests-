import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../errors';
import { auth } from '../middleware/auth';

function createMockRequest(headerValue?: string): Request {
  return {
    header: (name: string) => (name === 'X-User-Id' ? headerValue : undefined),
  } as unknown as Request;
}

const res = {} as Response;

describe('auth middleware', () => {
  it('attaches req.currentUser and calls next() for a known user', () => {
    const req = createMockRequest('u_alice');
    const next = jest.fn() as NextFunction;

    auth(req, res, next);

    expect(req.currentUser?.name).toBe('Alice');
    expect(next).toHaveBeenCalledWith();
  });

  it('calls next(UnauthorizedError) when the header is missing', () => {
    const req = createMockRequest(undefined);
    const next = jest.fn() as NextFunction;

    auth(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    expect(req.currentUser).toBeUndefined();
  });

  it('calls next(UnauthorizedError) for an unknown user id', () => {
    const req = createMockRequest('u_does_not_exist');
    const next = jest.fn() as NextFunction;

    auth(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });
});