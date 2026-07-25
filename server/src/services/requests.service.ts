import { requestValuesSchema } from 'shared/validation';
import { NotFoundError, ValidationError } from '../errors';
import { pickApprover } from '../logic/pickApprover';
import * as store from '../store';
import { assertOwner, assertStatus } from './guards';
import type { ExpenseRequest, RequestValues, User } from 'shared/types';

// Record (not a plain array) so TS enforces every RequestValues key is
// listed here — add a field to RequestValues and this won't compile until
// it's added here too, keeping the allowlist in sync with the type by
// construction rather than by remembering to update two places.
const VALUES_KEYS: Record<keyof RequestValues, true> = {
  expenseType: true,
  amountCents: true,
  description: true,
  billable: true,
  client: true,
  additionalJustification: true,
  otherReason: true,
};

// The mass-assignment guard: the client must never be able to
// set `status`, `requesterId`, or `approverId`. A body like
// `{ requesterId: 'u_carol', status: 'Approved' }` could otherwise steal
// ownership of a request or skip the approval workflow entirely — this is
// exactly what `Object.assign(request.values, req.body)` would let happen.
// pickValues only ever copies the seven known RequestValues keys out of the
// body, one by one, so anything else is silently never read. createDraft and
// updateDraft (below) are meant to be the only callers of this function —
// nothing else should ever read req.body directly.
export function pickValues(body: unknown): Partial<RequestValues> {
  if (typeof body !== 'object' || body === null) {
    return {};
  }

  const source = body as Record<string, unknown>;
  const result: Partial<Record<keyof RequestValues, unknown>> = {};

  for (const key of Object.keys(VALUES_KEYS) as (keyof RequestValues)[]) {
    if (key in source) {
      result[key] = source[key];
    }
  }

  return result as Partial<RequestValues>;
}

export function createDraft(actor: User, body: unknown): ExpenseRequest {
  const request: ExpenseRequest = {
    id: store.generateRequestId(),
    requesterId: actor.id,
    values: pickValues(body),
    events: [{ type: 'created', at: new Date().toISOString(), actorId: actor.id }],
  };
  return store.saveRequest(request);
}

export function updateDraft(actor: User, id: string, body: unknown): ExpenseRequest {
  const request = getRequest(id);
  assertOwner(actor, request);
  assertStatus(request, 'Draft');

  request.values = { ...request.values, ...pickValues(body) };
  return store.saveRequest(request);
}

export function submitRequest(actor: User, id: string): ExpenseRequest {
  const request = getRequest(id);
  assertOwner(actor, request);
  assertStatus(request, 'Draft');

  const result = requestValuesSchema.safeParse(request.values);
  if (!result.success) {
    throw new ValidationError(result.error.flatten().fieldErrors);
  }

  const approverId = pickApprover(actor, result.data.amountCents, store.listUsers());

  request.events.push({
    type: 'submitted',
    at: new Date().toISOString(),
    actorId: actor.id,
    approverId,
  });
  return store.saveRequest(request);
}

export function listRequests(): ExpenseRequest[] {
  return store.listRequests();
}

export function getRequest(id: string): ExpenseRequest {
  const request = store.getRequestById(id);
  if (!request) {
    throw new NotFoundError('Request not found');
  }
  return request;
}
