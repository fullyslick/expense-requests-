import { DomainError, ValidationError } from '../errors';
import type { NextFunction, Request, Response } from 'express';

// Mounted last in index.ts , after every route — this is the
// ONLY place a thrown/caught error becomes an HTTP response. Every
// DomainError subclass (server/src/errors.ts) already carries its own
// `status` and `code`, so nothing here needs a switch per error type; only
// ValidationError needs a special case, because its body carries
// `fieldErrors` instead of `message`, per the ADR §6 contract.
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ValidationError) {
    res.status(err.status).json({ error: err.code, fieldErrors: err.fieldErrors });
    return;
  }

  if (err instanceof DomainError) {
    res.status(err.status).json({ error: err.code, message: err.message });
    return;
  }

  // Unknown/unexpected error: log it server-side for debugging, but never
  // send err.message or err.stack back to the client — an unhandled error
  // could be anything (a DB driver error, a typo'd property access), and its
  // message may contain internals a hostile caller shouldn't get for free.
  console.error(err);
  res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'Something went wrong' });
}
