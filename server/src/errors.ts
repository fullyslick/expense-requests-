// The single source of truth for the API's error contract (ADR §6):
//
//   400  { error: 'VALIDATION_FAILED',    fieldErrors: {...} }
//   400  { error: 'NO_ELIGIBLE_APPROVER', message: '...' }
//   403  { error: 'FORBIDDEN',            message: '...' }
//   404  { error: 'NOT_FOUND',            message: '...' }
//   409  { error: 'INVALID_TRANSITION',   message: '...' }
//
// Every domain error carries its own `status` (HTTP status code) and `code`
// (the `error` field in the response body) so that middleware/errorHandler.ts
// (Phase 4, next) can map any DomainError to a response without a switch
// statement — it just reads `err.status` and `err.code` off whatever it caught.

export abstract class DomainError extends Error {
  abstract readonly status: number;
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends DomainError {
  readonly status = 404;
  readonly code = 'NOT_FOUND';
}

export class ForbiddenError extends DomainError {
  readonly status = 403;
  readonly code = 'FORBIDDEN';
}

export class InvalidTransitionError extends DomainError {
  readonly status = 409;
  readonly code = 'INVALID_TRANSITION';
}

// Matches the shape of Zod's `error.flatten().fieldErrors` (ADR §9), which is
// what services/requests.service.ts (Phase 7) will pass in directly.
export type FieldErrors = Record<string, string[]>;

export class ValidationError extends DomainError {
  readonly status = 400;
  readonly code = 'VALIDATION_FAILED';
  readonly fieldErrors: FieldErrors;

  constructor(fieldErrors: FieldErrors) {
    super('Validation failed');
    this.fieldErrors = fieldErrors;
  }
}

// Thrown by pickApprover (server/src/logic/pickApprover.ts) when routing
// finds nobody eligible to approve a request — see NOTES.md "Approver
// Routing" for the Mallory/Trent cases this actually guards against. Defined
// here rather than in logic/ so the same class carries both the pure routing
// failure AND its HTTP mapping; logic/ importing this is fine under guardrail
// 11 since errors.ts isn't routes/, services/, or store.ts.
export class NoEligibleApproverError extends DomainError {
  readonly status = 400;
  readonly code = 'NO_ELIGIBLE_APPROVER';

  constructor(requesterId: string) {
    super(`No eligible approver for requester "${requesterId}"`);
  }
}