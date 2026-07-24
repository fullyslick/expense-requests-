import type { NextFunction, Request, Response } from 'express';
import type { User } from 'shared/types';
import { UnauthorizedError } from '../errors';
import * as store from '../store';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- required syntax for augmenting Express's Request type
  namespace Express {
    interface Request {
      currentUser: User;
    }
  }
}

export function auth(req: Request, _res: Response, next: NextFunction): void {
  const userId = req.header('X-User-Id');
  const user = userId ? store.getUserById(userId) : undefined;

  // Missing header and unknown id both mean "no resolvable user", so both
  // hit the same 401 path.
  if (!user) {
    next(new UnauthorizedError('Missing or unknown X-User-Id'));
    return;
  }

  req.currentUser = user;
  next();
}