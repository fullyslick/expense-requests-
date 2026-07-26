# Implementation Plan — Expense Requests

**Companion doc:** `ADR.md` — the *why* behind every decision here.

---

## How to use this document

Re-read the **Guardrails** section below before starting any phase, and again whenever a phase touches validation, authorization, or status.

---

## Guardrails — invariants that must never be violated

These come from the requirements and the ADR. Violating any one of them is a correctness bug, not a style preference.

1. **Money is whole cents, everywhere.** `$12.50` is `1250`. The only place dollars exist is the form input and the display formatter. One conversion utility in `/shared`, used by both.
2. **The $1,000 threshold is `>= 100000` cents.** Applies to both the extra-justification rule and the routing rule. Test `99999` and `100000` explicitly.
3. **No `status` field is ever stored.** Status is derived from the last event. Writes append events; they never set a status.
4. **The client never sets `status`, `requesterId`, or `approverId`.** Handlers read body fields by explicit allowlist. Never `Object.assign(x, req.body)`, never spread the body.
5. **Every rule is enforced server-side.** Assume every request is a hostile `curl`. Client-side checks are UX only.
6. **Drafts skip validation. Submit runs it.** PATCH accepts a partial, invalid object without complaint.
7. **Only the owner** can edit or submit. **Only the assigned approver** can approve or reject. Both checked against `req.currentUser.id`.
8. **Zod validates field shape only.** `pickApprover()` and status transitions are hand-written functions. Never express routing as a schema refinement.
9. **No form builder, no workflow engine.** shadcn primitives only — do not run `shadcn add form`.
10. **No database.** In-memory behind the `store` module.
11. **Layering is one-directional.** `routes → services → logic → store`. A route never touches the store or `logic/` directly. A service never sees `req` or `res` — it throws typed errors instead. `logic/` imports nothing from the other three.

---

## Target file layout

```
/
├── package.json                 # npm workspaces root
├── ADR.md
├── IMPLEMENTATION_PLAN.md
├── NOTES.md                     # started in Phase 0, not at the end
├── shared/
│   ├── types.ts                 # User, ExpenseRequest, HistoryEvent, Status
│   ├── validation.ts            # Zod schema + conditional rules
│   └── money.ts                 # dollars <-> cents
├── server/
│   ├── package.json
│   ├── data/                    # pristine seed JSON, never written to
│   │   ├── users.json
│   │   └── requests.json
│   └── src/
│       ├── index.ts                    # express app bootstrap
│       ├── store.ts                    # list / getById / save
│       ├── errors.ts                   # typed domain errors
│       ├── middleware/
│       │   ├── auth.ts                 # X-User-Id -> req.currentUser
│       │   └── errorHandler.ts         # domain error -> HTTP status
│       ├── logic/                      # PURE — no store, no express
│       │   ├── deriveStatus.ts
│       │   └── pickApprover.ts
│       ├── services/                   # RULES — store access, no express
│       │   ├── guards.ts               # assertOwner, assertStatus, ...
│       │   ├── requests.service.ts     # createDraft, updateDraft, submitRequest,
│       │   │                           #   approveRequest, rejectRequest
│       │   └── serialize.ts            # toResponse()
│       ├── routes/                     # WIRING — thin handlers only
│       │   ├── users.ts
│       │   └── requests.ts
│       └── __tests__/
└── client/
    ├── package.json
    └── src/
        ├── main.tsx
        ├── api/
        │   ├── client.ts         # fetch wrapper, X-User-Id, ApiError parsing
        │   └── useApiQuery.ts    # read-only hook: data/loading/error/refetch
        ├── context/CurrentUser.tsx
        ├── components/
        └── pages/
            ├── RequestList.tsx
            ├── RequestForm.tsx
            └── RequestDetail.tsx
```

---

## The four layers

Express route callbacks *are* controllers, so there is no separate controller layer — that would be a file of three-line pass-throughs. Four layers instead:

| Layer | Owns | Never contains | Tested with |
|---|---|---|---|
| `routes/` | URL wiring, `req` → args, response shape | any rule, any store call | Supertest (a few) |
| `services/` | authorization, orchestration, appending events | `req` / `res` / status codes | plain Jest calls |
| `logic/` | validation, routing, status derivation — **pure** | store, express, dates from `Date.now()` | plain Jest calls |
| `store.ts` | the in-memory `Map`s (keyed by id) | rules of any kind | one smoke test |

A handler stays this thin:

```ts
router.post('/:id/submit', (req, res, next) => {
  try {
    res.json(toResponse(submitRequest(req.currentUser, req.params.id)));
  } catch (err) { next(err); }
});
```

...because the service holds what's actually being graded:

```ts
// services/requests.service.ts
export function submitRequest(actor: User, id: string): ExpenseRequest {
  const request = store.getRequestById(id);
  if (!request) throw new NotFoundError('Request not found');

  assertOwner(actor, request);
  assertStatus(request, 'Draft');

  const result = requestSchema.safeParse(request.values);
  if (!result.success) throw new ValidationError(result.error.flatten().fieldErrors);

  const approverId = pickApprover(actor, request.values.amountCents, store.listUsers());

  request.events.push({
    type: 'submitted', at: new Date().toISOString(),
    actorId: actor.id, approverId,
  });
  return store.saveRequest(request);
}
```

**Why this earns its ~10 minutes:**

- **Guards get written once.** `assertOwner`, `assertStatus`, `assertAssignedApprover` are used across five endpoints. Inlined in handlers they'd be copy-pasted, and copy-paste is where the one missing check hides.
- **Rule tests need no HTTP.** `submitRequest(alice, 'REQ-001')` is a direct function call — fast, and the failure message points at the rule instead of at a status code.
- **The walkthrough has one file.** "Every authorization rule in this system lives in `requests.service.ts`" beats scrolling a router.

**What makes it work:** typed errors thrown by services and mapped to HTTP by a single middleware (Phase 4). Without that, services would need `res` and the separation collapses.

**What to resist:** no repository interface over the store, no DI container, no `BaseController`, no `services/` subfolder per entity. Eight endpoints don't justify it.
¬
---

# Part A — Backend

## Phase 0 — Scaffold

- [x] Root `package.json` with npm workspaces: `["client", "server", "shared"]`
- [x] Root scripts: `dev:server`, `test`
- [x] Root scripts `dev:client`,
- [x] `/server`: TypeScript, Express, `tsx` for dev, Jest + Supertest as dev deps
- [x] `/client`: Vite + React + TypeScript
- [x] `/shared`: `package.json` + `tsconfig.json`, no build step (both sides compile from source)
- [x] Copy `users.json` and `requests.json` into `/server/data`
- [x] Verify both apps start and return a hello-world
- [x] Create `NOTES.md` with the run instructions **now**, while they're fresh

> **Simpler option if workspaces fight you:** drop the root package, install in `/client` and `/server` independently, and reference `/shared` through a tsconfig path alias in both. Note the choice in `NOTES.md`.

**Verify:** `npm install` at root succeeds; both dev servers boot.
**Commit:** `chore: project scaffolding`

---

## Phase 1 — Shared contracts

- [x] `shared/types.ts`: `User`, `RequestValues`, `HistoryEvent` (discriminated union on `type`), `ExpenseRequest`, `Status`
- [x] `shared/money.ts`: `dollarsToCents(input: string): number`, `centsToDisplay(cents: number): string`
- [x] `shared/validation.ts`: Zod schema — base rules + `superRefine` for the three conditionals
- [x] Export `EXPENSE_TYPES` and `CLIENTS` (`Acme`, `Globex`, `Initech`, `Contoso`) as shared constants

**Rules to encode (from the requirements table):**

| Field | Rule |
|---|---|
| `expenseType` | required, one of Travel / Software / Equipment / Meal / Other |
| `amountCents` | required, integer, `>= 0` |
| `description` | required, non-empty |
| `billable` | optional boolean |
| `client` | required when `billable === true` |
| `additionalJustification` | required when `amountCents >= 100000` |
| `otherReason` | required when `expenseType === 'Other'` |

- [x] **Tests** — `money.ts`: `"12.50" → 1250`, `"0" → 0`, `"1000" → 100000`, round-trip, and a `.1 + .2` style float case
- [x] **Tests** — validation: each conditional fires when it should and clears when satisfied; negative amount rejected; `99999` needs no justification, `100000` does; empty description rejected

**Verify:** `npm test` green.
**Commit:** `feat: shared types, money utils, and zod validation schema`

---

## Phase 2 — Store and seeding

- [x] `store.ts`: reads both JSON files at boot into module-level `Map<string, T>`s keyed by `id`
- [x] Expose `listRequests()`, `getRequestById(id)`, `saveRequest(req)`, `listUsers()`, `getUserById(id)`
  - `getRequestById`/`getUserById` → `map.get(id)`, O(1)
  - `saveRequest` → `map.set(request.id, request)`
  - `listRequests`/`listUsers` → `Array.from(map.values())`
- [x] ID generation for new requests (`REQ-005`, or a counter — keep it boring)
- [x] `/server/data/*.json` is read-only; nothing ever writes back to it

- [x] **One smoke test only:** four seed requests load, six users load, shapes satisfy the shared types

> Do not build a test suite for the store. The ADR lists it as explicitly not worth testing — it's a wrapper over a `Map`.

**Verify:** smoke test green.
**Commit:** `feat: in-memory store with seed loading`

---

## Phase 3 — Pure business logic ← the most important phase

Write these **before any route exists**. They have no Express dependency and no `req`/`res` in sight.

### `deriveStatus(events): Status`
- [x] Maps last event type → `Draft` / `Submitted` / `Approved` / `Rejected`
- [x] Companion `getApproverId(events)` — reads the most recent `submitted` event
- [x] **Tests:** each event type; multiple events in order; a submitted-then-rejected sequence; empty array

### `pickApprover(requester, amountCents, users): string`
```
finance   = users.find(role === 'finance')
manager   = users.find(id === requester.managerId)
candidate = amountCents >= 100000 ? finance : manager

if (!candidate || candidate.id === requester.id) candidate = finance
if (!candidate || candidate.id === requester.id) throw NoEligibleApprover

return candidate.id
```
- [x] **Tests — all six branches:**
  - under threshold → manager (Alice $450 → Carol)
  - at/over threshold → finance (Bob $1250 → Trent)
  - exactly `100000` → finance, not manager
  - manager missing → falls back to finance
  - manager *is* the requester → falls back to finance
  - **Mallory $600** → Peggy, not herself (she's a manager with her own `managerId`)
  - **Trent (finance) $1500** → throws `NO_ELIGIBLE_APPROVER`

**Verify:** all logic tests green. These are the tests you'll walk a reviewer through.
**Commit:** `feat: status derivation and approver routing logic`

---

## Phase 4 — Express shell, typed errors, auth, users

Build the error layer **first** — every service in Phases 6–8 depends on it existing.

- [x] `errors.ts`: a `DomainError` base plus `NotFoundError`, `ForbiddenError`, `InvalidTransitionError`, `ValidationError` (carries `fieldErrors`), `NoEligibleApproverError`. Each declares its own `status` and `code`.
- [x] `middleware/errorHandler.ts`: single Express error handler. Known `DomainError` → its status and the contract below. Anything else → 500 with a generic message (never leak a stack).

```
400  { error: 'VALIDATION_FAILED',    fieldErrors: {...} }
400  { error: 'NO_ELIGIBLE_APPROVER', message: '...' }
401  { error: 'UNAUTHORIZED',         message: '...' }
403  { error: 'FORBIDDEN',            message: '...' }
404  { error: 'NOT_FOUND',            message: '...' }
409  { error: 'INVALID_TRANSITION',   message: '...' }
```

> Extended with 401 during implementation — the original table (and ADR §6) predates `middleware/auth.ts` and didn't have an entry for missing/unknown `X-User-Id`. See NOTES.md.

- [x] `services/guards.ts`: `assertOwner(actor, request)`, `assertStatus(request, expected)`, `assertAssignedApprover(actor, request)` — each throws the matching typed error
- [x] `services/serialize.ts`: `toResponse(request)` attaching derived `status` and `approverId`
- [x] `index.ts`: Express app, JSON body parser, `cors`, fixed port, error handler mounted **last**
- [x] `middleware/auth.ts`: read `X-User-Id`, resolve via `store.getUserById`, attach `req.currentUser`, else 401
- [x] Apply auth to all `/api/*` routes
- [x] `routes/users.ts`: `GET /api/users`

- [x] **Tests — guards, called directly, no HTTP:** `assertOwner` throws `ForbiddenError` for a non-owner and passes for the owner; `assertStatus` throws `InvalidTransitionError` on a mismatch
- [x] **Test:** missing `X-User-Id` → 401; unknown id → 401; valid id → 200

**Verify:** `curl -H 'X-User-Id: u_alice' localhost:PORT/api/users` returns six users; a route that throws `new ForbiddenError('x')` produces a 403 in the contract shape.
**Commit:** `feat: express shell, typed domain errors, auth middleware, users endpoint`

---

## Phase 5 — Request read endpoints

- [x] `requests.service.ts`: `listRequests()` and `getRequest(id)` — the latter throws `NotFoundError` rather than returning `undefined`
- [x] `routes/requests.ts`: `GET /api/requests` and `GET /api/requests/:id`, both one line through `toResponse`
- [x] `toResponse` is the **only** place derived fields get attached, so the response shape can't drift between endpoints

- [x] **Test (service):** `getRequest('nope')` throws `NotFoundError`
- [x] **Test:** list returns 4 seed records; REQ-001 is `Draft`, REQ-002 is `Submitted` with approver `u_carol`, REQ-003 is `Approved`

**Verify:** derived statuses match the seed data's event history.
**Commit:** `feat: request list and detail endpoints`

---

## Phase 6 — Create and update drafts

- [x] `pickValues(body)` helper — the **allowlist**. Returns only the seven known `values` keys. Every write path goes through it; nothing else ever reads `req.body`.
- [x] `createDraft(actor, body)` in the service
  - `requesterId` = `actor.id` (**never from body**)
  - appends `{ type: 'created', at: now, actorId: actor.id }`
  - **no validation** — an empty draft is legal
- [x] `updateDraft(actor, id, body)` in the service
  - `assertOwner` → `assertStatus(request, 'Draft')`
  - merges `pickValues(body)` into `values`
  - **no validation**
- [x] Routes: `POST /api/requests`, `PATCH /api/requests/:id` — thin handlers over the two service calls

- [x] **Tests (service, no HTTP):** `createDraft(alice, { requesterId: 'u_bob' })` still yields `u_alice`; `updateDraft(bob, 'REQ-001')` throws `ForbiddenError`; `updateDraft(alice, 'REQ-002')` throws `InvalidTransitionError`
- [x] **Tests (HTTP):**
  - create as Alice → `requesterId` is `u_alice` even if body says `u_bob`
  - body containing `status`, `approverId`, `requesterId` → all three ignored
  - PATCH someone else's draft → 403
  - PATCH a Submitted request (REQ-002) → 409
  - PATCH with only `{ description }` → other values untouched

**Verify:** the mass-assignment tests pass. This is guardrail #4 made real.
**Commit:** `feat: create and update draft requests with field allowlisting`

---

## Phase 7 — Submit and routing

- [x] `submitRequest(actor, id)` in `requests.service.ts` — the referece implementation is in **The four layers** section above. Order matters: fetch → `assertOwner` → `assertStatus('Draft')` → validate → `pickApprover` → append event → save.
- [x] Zod failure → `ValidationError(result.error.flatten().fieldErrors)`
- [x] `pickApprover` throwing → surfaces as `NoEligibleApproverError` (either thrown directly by `logic/` or wrapped here — pick one and be consistent)
- [x] `POST /api/requests/:id/submit` — thin handler

- [x] **Tests (service, no HTTP):** every rule below can be asserted by calling `submitRequest` directly and checking the thrown error type. Do these first — they're faster to write and the failures are clearer.
- [x] **Tests (HTTP, a subset):** confirm each error type maps to the right status and body shape
- [x] **Cases:**
  - valid draft under $1,000 → Submitted, approver is the manager
  - valid draft at/over $1,000 → approver is finance
  - billable without `client` → 400, `fieldErrors.client` present
  - amount ≥ $1,000 without justification → 400, `fieldErrors.additionalJustification` present
  - type `Other` without `otherReason` → 400
  - submitting someone else's draft → 403
  - submitting an already-Submitted request → 409
  - **Trent submits ≥ $1,000 → 400 `NO_ELIGIBLE_APPROVER`**

**Verify:** the field-error response shape is exactly what the form will consume.
**Commit:** `feat: submit endpoint with validation and server-side approver routing`

---

## Phase 8 — Approve and reject

- [x] `approveRequest(actor, id)` and `rejectRequest(actor, id)` — both are `assertAssignedApprover` → `assertStatus('Submitted')` → append event → save. If they end up identical apart from the event type, collapse them into one `decide(actor, id, 'approved' | 'rejected')` and keep two thin exports.
- [x] Note that `assertAssignedApprover` covers the self-approval case for free: the requester is never the approver, so no separate check is needed
- [x] Routes: `POST /api/requests/:id/approve`, `POST /api/requests/:id/reject`

- [x] **Tests (service first, then a couple over HTTP):**
  - Carol approves REQ-002 (she's the assigned approver) → `Approved`
  - Bob tries to approve REQ-002 → 403
  - **Alice tries to approve her own REQ-002 → 403** (she's the requester, not the approver)
  - approving an already-Approved request → 409
  - reject path mirrors approve

**Verify:** status changes are visible purely through the appended events.
**Commit:** `feat: approve and reject endpoints`

---

## Phase 9 — Integration and security tests

Supertest against the full app. With the rules already unit-tested at the service layer, this phase proves the **wiring** — that auth, guards, and the error handler are actually mounted and that a hostile `curl` hits them. Both layers matter: a perfect service that isn't wired into the router still fails requirement 5.

- [x] **Lifecycle:** create → PATCH → submit → approve, asserting status and history length at each step
- [x] **Rejection path:** create → submit → reject
- [x] **Security sweep** (one test per guardrail):
  - no auth header → 401
  - submit another user's draft → 403
  - approve as a non-approver → 403
  - approve as the requester → 403
  - PATCH a non-Draft → 409
  - POST/PATCH with `status`/`requesterId`/`approverId` in the body → ignored
- [x] History entries carry `actorId` and `at` on every transition

**Verify:** full suite green. Note the count in `NOTES.md`.
**Commit:** `test: lifecycle and security integration coverage`

> **Backend is done here.** If you're over budget, this is the safe place to stop and write `NOTES.md` — a complete, tested API with a rough UI beats the reverse.

---

# Part B — Frontend

## Phase 10 — Shell, context, API client

- [x] Tailwind + shadcn init. Add **primitives only**: `button input select checkbox textarea label table badge`
- [x] **Do not run `shadcn add form`** — guardrail #9
- [x] React Router in **Declarative mode**: `BrowserRouter` + `Routes`
  - `/requests` — list
  - `/requests/new` — create
  - `/requests/:id` — detail
- [x] `context/CurrentUser.tsx` — `CurrentUserProvider` holding the selected user; persist to `localStorage`
- [x] `api/client.ts` — `fetch` wrapper; injects `X-User-Id` (read from
  `localStorage`, the key the provider already persists to)
  - [x] `ApiError { status, code, message, fieldErrors? }` thrown on any non-2xx
  - [x] exports `api.get(path, signal?)`, `api.post(path, body?)`,
    `api.patch(path, body)`
- [x] `api/useApiQuery.ts` — **reads only**, ~25 lines,
  returns `{ data, loading, error, refetch }`
  - [x] deps `[path, currentUser.id, tick]` — the `currentUser.id` dep is what
    makes "switching users refetches the page" true
  - [x] `AbortController` in the effect, `abort()` in cleanup, swallow
    `AbortError` (superseded, not a failure)
  - [x] `path: string | null` so the form page can no-op in create mode
  - [x] no options bag, no cache, no dedupe, no retry
- [ ] Mutations do **not** go through the hook — imperative `api.post` /
  `api.patch` in click handlers, where in-flight state and `fieldErrors`
  live (ADR §9)
- [x] `useApiQuery` stays in `client/` — it imports React and reads the
  current-user context, so it is not `/shared` material
- [x] App header: user dropdown showing **name and role**, visible on every page; changing it refetches the current page

**Verify:** switching users in the header changes the header label, survives a refresh, and refetches the current page.
**Commit:** `feat: app shell, current-user context, and api client`

---

## Phase 11 — List page

- [x] Plain `<table>` — no data grid
- [x] Columns: ID, type, amount (formatted dollars), status badge, requester name, created date
- [x] Status badges: Draft grey, Submitted blue, Approved green, Rejected red
- [x] Rows link to `/requests/:id`
- [x] "New Request" button → `/requests/new`
- [x] Loading and error states (a line of text each is fine)

**Verify:** four seed rows render with correct derived statuses.
**Commit:** `feat: request list page`

---

## Phase 12 — Request form

The most intricate UI phase. Budget accordingly.

- [ ] Base fields: expense type select, amount input, description textarea, billable checkbox
- [ ] **Conditional visibility**, hand-wired from local state:
  - `client` select — appears when `billable` is checked
  - `additionalJustification` — appears when amount `>= $1,000`
  - `otherReason` — appears when type is `Other`
- [ ] Amount input holds a **dollar string** in local state; converts via
  `shared/money.ts` **on every write — Save Draft included**, not only on submit
  - [ ] Converting only on the submit path persists `"45.00"` into a field typed
    `amountCents: number` and hands it back wrong on reload
- [ ] Two actions: **Save Draft** (no validation) and **Submit**
- [ ] Edit mode at `/requests/:id`: load existing values, block editing unless owner **and** Draft

### Which write endpoint (create vs. edit mode)

The form has one branch that everything else depends on: **does it hold an id yet?**

- [ ] `POST /requests` — first write only, on `/requests/new`
- [ ] `PATCH /requests/:id` — every write after that, for the rest of the session
- [ ] As soon as `POST /requests` returns, store the id **and**
  `navigate('/requests/' + id, { replace: true })`
  - [ ] **Why this is not optional:** without it, a 400 from `/submit` leaves the
    user on `/requests/new` holding no id. They fix the field, click Submit
    again, and the retry fires a **second** `POST /requests` — an orphan draft
    per failed attempt. Four seed records become eight during your own demo.

### Submit button behaviour (ADR §9)

The order below is the order the code runs in. Don't reshuffle it — the API-call
mechanics sit *after* the gate that decides whether any call happens at all.

- [ ] Local state: `isSubmitting`, `fieldErrors`, `formError`
- [ ] Button disabled **only while in flight**, never because the form is invalid
- [ ] Click → client Zod validation
- [ ] **Invalid** → render field errors inline, focus the first bad field,
  **don't call the API**, button stays enabled
- [ ] Errors appear only after the first submit attempt, then re-validate on
  change so they clear as the user fixes them
- [ ] **Valid** → `setIsSubmitting(true)` → persist values (`POST` or `PATCH`
  per the branch above) → `POST /requests/:id/submit` (**no body**)
- [ ] `catch`: `err instanceof ApiError && err.fieldErrors` → `setFieldErrors`;
  otherwise `setFormError`. Re-enable the button either way (`finally`).
- [ ] **Success** → navigate to the detail page

> **Save and submit are two requests — deliberately.** Submit takes no body, so
> values must be persisted first. That means a failed submit still persists them:
> the draft keeps the newer values. This is the behaviour we want — the draft
> *is* the user's work-in-progress, and discarding it over a missing conditional
> field would be worse. The alternative (one `POST /submit` that accepts a body)
> collapses the two calls at the cost of two different ways to write the same
> fields. Name this in `NOTES.md` rather than "fixing" it. (ADR §9)

**Verify:** a billable request with no client shows the error from the *server* if you bypass the client check.
**Verify:** on `/requests/new`, trigger a server-side 400 on submit, fix the field, submit again — exactly **one** new request exists in the list afterwards.
**Commit:** `feat: request form with conditional fields and validation`

---

## Phase 13 — Detail page and history

- [ ] All fields rendered readably — dollars, human-readable type and status
- [ ] History timeline: each event with action, **actor name** (resolved from the users list), and timestamp
- [ ] Approve / Reject buttons — only when `currentUser.id === approverId` **and** status is `Submitted`
- [ ] One local `decide(action: 'approve' | 'reject')` helper — the two calls are
  identical apart from the path. Mirrors `decide(actor, id, ...)` in the
  service layer; a pleasant symmetry to point at in the walkthrough.
- [ ] Local `acting` boolean disables both buttons while either is in flight
- [ ] On success call `refetch()` from `useApiQuery` — the history grows in place
- [ ] Errors here render as a banner, not field errors — a 403/409 has no field
- [ ] Edit button — only when `currentUser.id === requesterId` **and** status is `Draft`
- [ ] Show the assigned approver's name when Submitted

**Verify:** open REQ-002 as Alice (no buttons), switch to Carol (buttons appear), approve, watch the history grow.
**Commit:** `feat: detail page with history timeline and approver actions`

---

## Phase 14 — Polish and NOTES.md

- [ ] Manual walkthrough: create as Alice → submit → switch to Carol → approve
- [ ] Try to break it in the UI: submit empty, submit billable with no client, approve your own request
- [ ] Fail a submit from `/requests/new`, fix, resubmit — confirm only **one**
  request was created
- [ ] Switch users rapidly on the detail page — nothing flickers to the wrong
  data (the manual stand-in for a `useApiQuery` abort test; see the note at the
  end of this document)
- [ ] Remove `console.log`s; fix TypeScript errors; `npm test` fully green
- [ ] Finish `NOTES.md`:
  - **Run instructions** — install + start for both apps
  - **Design choices** — routes/services/logic/store layering with no separate controller layer, and why; derived status; three pure functions; in-memory store as a swappable seam; allowlisted body fields; Declarative router; Context scoped to identity only
  - **Data fetching** — one ~25-line `useApiQuery` hook for the three read paths; writes are imperative `api.post` / `api.patch` calls in click handlers, because each has call-site-specific in-flight state, success behaviour, and error rendering. `AbortController` in the effect cleanup prevents a stale response landing after a user switch. No TanStack Query.
  - **Tradeoffs** — no persistence (restart resets); not concurrency-safe; deriving status costs a read; save-and-submit are two requests, so a failed submit still persists the draft's values (deliberate — see ADR §9)
  - **What was tested** — lift the table from ADR §10; give the test count
  - **The two sentences worth having verbatim:**
    - *Client-side validation is a UX convenience only — deleting it entirely would leave the app fully correct, because the server returns the same `fieldErrors`.*
    - *Zod validates field shape and the three conditional rules; approver routing and status transitions are hand-written, per the no-workflow-engine constraint.*
  - **What's next** — the stretch goals below, plus a real datastore and denormalized status column at scale
  - **AI usage** — what was AI-assisted, and at least one point where you disagreed with the AI and why

**Commit:** `docs: NOTES.md and final cleanup`

---

## Stretch goals — only after everything above is green

### S1 — Search and filter on the list (~10 min)
- [ ] Status filter dropdown; text search over description and type
- [ ] Client-side filtering is fine at this scale — say so in `NOTES.md`
- **Commit:** `feat: list filtering and search`

### S2 — Reject and resubmit (~20 min)
- [ ] `POST /api/requests/:id/resubmit` — owner only, `Rejected` only
- [ ] Re-validate, **recompute the approver** (the amount may have changed), append a `submitted` event
- [ ] Frontend: "Edit & Resubmit" on rejected requests for the owner
- [ ] Update the state machine diagram in the ADR
- **Commit:** `feat: reject and resubmit flow`

### S3 — Approval and rejection comments (~10 min)
- [ ] Optional `comment` on approve/reject, stored on the history event
- [ ] Rendered in the timeline; rejection comment visible to the owner while fixing
- **Commit:** `feat: approval and rejection comments`

---

**If you're running long, cut in this order:** Playwright E2E (never started) → RTL component tests → status badge colours → the edit-mode branch of the form (create-only is defensible if noted). **Never cut:** Phase 3, Phase 7, Phase 9, the `AbortController` cleanup in `useApiQuery`, or `NOTES.md`.

---

## Definition of done

- [ ] `npm test` green from the root
- [ ] Every guardrail above has at least one test asserting it
- [ ] A hostile `curl` cannot submit another user's draft, approve a request it isn't assigned, or set `status` / `requesterId` / `approverId`
- [ ] The full lifecycle works end-to-end in the browser with user switching
- [ ] `NOTES.md` answers: how to run, what you chose, what you traded away, what you tested, what's next, how AI was used
- [ ] Commit history shows incremental work, not one squashed commit

---

## Deliberately untested

`useApiQuery` gets no unit test. ADR §10 scopes RTL to a thin layer on the form —
conditional field visibility and server `fieldErrors` rendering next to the right
inputs. A hook test would need `renderHook` plus fetch mocking to assert
behaviour that any component test rendering a list already exercises. The abort
path is covered by the manual check in Phase 14: switch users rapidly on the
detail page and confirm nothing flickers to the wrong data.