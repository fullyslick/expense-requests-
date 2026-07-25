# AI Usage & Planning Process

I started by asking Claude to generate an Architecture Decision Record (ADR) and an Implementation Plan based on the task requirements and my tech stack. I reviewed and refined the ADR before accepting it. The Implementation Plan, derived from the ADR and requirements, serves as a tracking tool for both me and Claude throughout development.

Deviations from the plan are expected as edge cases or more streamlined approaches surface during implementation.

I created a minimal CLAUDE.md file containing the ADR and Implementation Plan to give Claude Code the project context it needs. This was enough as a starting point — I'll layer in more specific instructions as the project takes shape.

# Scaffolding The BE and Shared

I worked with Claude Code to scaffold the backend and shared workspaces incrementally. For the backend, I requested a TypeScript + Express setup with tsx for development and Jest + Supertest for testing. Claude set up the server package with proper configuration files (tsconfig.json, jest.config.js), a minimal Express app with export for testing, and a smoke test. Root scripts (dev:server, test) were wired to workspace commands and verified to work locally. Claude flagged that ESLint configuration currently targets client globals and would need a Node globals override for the server in a follow-up.

For the shared folder, I requested a minimal workspace setup with no build step, allowing both client and server to compile directly from source. Claude created the necessary package.json (private, ESM) and base tsconfig.json, leaving the folder ready for Phase 1 (types, validation, money handling) to add actual implementation files.

The approach was incremental—asking for specific implementations, verifying each piece works before moving forward, and noting areas to revisit rather than trying to implement everything at once.

**Prompt to Output Example**


**Implement this part `/server`: TypeScript, Express, `tsx` for dev, Jest + Supertest as dev deps and Root scripts: `dev:server`, `test`, skip dev:client for now**
```md
Everything's implemented and verified:

- server/package.json — Express (dependency), plus typescript, tsx, jest, ts-jest, supertest, and matching @types/* as devDependencies. dev script runs tsx watch src/index.ts, test
  runs jest.
- server/tsconfig.json — strict TS config, CommonJS output (kept default module system so ts-jest/supertest needed no ESM config).
- server/jest.config.js — ts-jest preset, node test environment.
- server/src/index.ts — minimal Express app returning hello world on GET /, exported for Supertest, only calls .listen() when run directly.
- server/src/__tests__/index.test.ts — Supertest smoke test.
- Root package.json — dev:server and test are now real (npm run dev --workspace=server, npm test --workspaces --if-present); dev:client stays as the inert placeholder since client
  is skipped for now.

Verified: npm install, npm test (1 passing), and npm run dev:server (curl'd localhost:4000 → hello world) all work; eslint . still runs clean.

One thing to note for later: the current eslint.config.js only sets globals.browser and pulls in React-specific plugins, so it's not really linting server/src correctly yet (no    
Node globals). Worth adding a server/** override with globals.node and no React plugins when you're ready — didn't do it now since it wasn't asked for.
```

# Defining Core Data Types
I have defined the types manually with few small refinements from Claude and at the end I asked it to verify them against the ADR and Implementation plan.

**Prompt to Output Example**

**Check the @ADR.md and @IMPLEMENTATION_PLAN.md step: [ ] `shared/types.ts`: `User`, `RequestValues`, `HistoryEvent` (discriminated union on `type`), `ExpenseRequest`, `Status`      
check if types for the seeded data is properly implemented.**

```md
Field-by-field, the shapes do line up with the seed data:                                                                                                                           
  - User ↔ users.json — id, name, role, managerId all match.                                                                                                                          
  - ExpenseRequest ↔ requests.json — id, requesterId, values, events all match.                                                                                                       
  - RequestValues — optional fields (client, additionalJustification, otherReason) are only present where the seed data has them (REQ-003 has additionalJustification, REQ-004 has    
  client), consistent with ?.                                                                                                                                                         
  - HistoryEvent discriminated union — submitted events in the seed carry approverId; created/approved/rejected don't. Matches the union exactly.                                     
                                                                                                                                                                                      
  What this means for Phase 2 (store.ts): when the store loads these JSON files at boot, it can't just assign them directly to User[] / ExpenseRequest[] — that assignment will only  
  "work" via an unchecked cast (as User[]), same as I had to do in the throwaway file to get it to compile. That's normal and expected for a seed-loader — the file layout in the plan
  already puts this concern in store.ts, not types.ts. Two options when you get there:                                                                                                
  1. Trust the seed data and cast: JSON.parse(...) as User[].                                                                                                                         
  2. Parse through the Zod schema (validation.ts, Phase 1) at boot for real runtime narrowing — more correct but arguably more than the "one smoke test" scope calls for at this      
  stage.                                                                                                                                                                              
                                                                                                                                                                                      
  So: the checkbox item itself — User, RequestValues, HistoryEvent (discriminated union), ExpenseRequest, Status — is correctly implemented in shared/types.ts. The                   
  seed-data/JSON-import friction you'd hit is a separate, expected concern that belongs to Phase 2, not a defect in Phase 1's types. 
```

# Seeding The Data
I decided to use Map instead of array for the in memory data. I might as well use just plain object but  a Map<string, ExpenseRequest> avoids prototype key collisions and provides a cleaner data-store API (.has(), .size, .delete()).
I asked Claude to update ADR and Implementation plan to reflect that and then implement the seeding as well.
Here we have the first deviation from the original plan. And its rather normal to polish the idea a bit during the implementation.

I asked Claude to implement teh rest of teh Phase 2 - the methods that operate on the seeded data and to test the methods.
Results were delivered as expected, but there is a unit test missing for saveRequest. I asked why and here is teh answer (after that I asked for the adding the test any way):

```md
Per the plan (IMPLEMENTATION_PLAN.md Phase 2) and the ADR, the store is explicitly scoped to one smoke test only, covering the seeding path — not the whole module. The ADR calls
  this out directly:                                                                      
                                                                                           
  ▎ Do not build a test suite for the store. The ADR lists it as explicitly not worth testing — it's a wrapper over a Map.
                                                                                                                                                                                      
  saveRequest is a one-line map.set(request.id, request), and generateRequestId is a one-line counter increment — both fall under that same "not worth testing" umbrella; they don't  
  contain any business rule that could silently break. That's also why I only smoke-tested them ad hoc in the terminal earlier rather than writing them into the suite.               
                                                                                                                                                                                      
  That said, if you'd rather have permanent regression coverage on saveRequest (e.g. verifying an update actually overwrites the existing entry, not just appends), I can add a couple
  of assertions to store.test.ts — it's a judgment call the plan leaves open, not a hard rule. Want me to add it?     
```

# Validation Schemas

Used Zod for server-side validation. First time using it. I chose it because it produces field-level errors with paths, which map directly to inline form errors in the UI. 
`superRefine` handles the three conditional rules (client when billable, justification when amount >= $1,000, other reason when type is "Other"). Two schemas: a loose one for draft saves and a strict one for submit.

**`billable` — `.optional()` vs `.default(false)`.** The requirements table lists no explicit rule for the "Billable to a client?" checkbox, so I initially modeled it as `z.boolean().optional()` in the Zod schema. Claude flagged a mismatch: `RequestValues.billable` in `shared/types.ts` is a required `boolean`, but the parsed Zod output would be `boolean | undefined` when the field is omitted.

I pointed out that the frontend checkbox will always send `billable` as `true` or `false` — never omitted — so in practice this gap only shows up for a hostile `curl` skipping the field entirely. Landed on `z.boolean().default(false)`: it stays non-required at the schema level (so a request without `billable` still parses instead of failing validation), but the *parsed* value is always a real `boolean`, matching `RequestValues` exactly and removing the type mismatch. Small thing, but a clean example of the client-can't-be-trusted principle applying even to a field with "no rule" — the server still needs a defined value to reason about, not just what the form happens to send.

# Data Model & Derived Status

No `status` field anywhere in storage — `store` only holds `{ id, requesterId, values, events }`. Status is a pure reducer, `deriveStatus(events)`, that reads the last event's `type` and maps it to `Draft` / `Submitted` / `Approved` / `Rejected`; a companion `getApproverId(events)` walks the history backward for the most recent `submitted` event. Both are computed on read and attached to the API response, never written.

The point of doing it this way: requirement 6 says status must always match the latest action, and a stored field means remembering to update it in four different handlers — forget one and you get a silent bug. Deriving it makes that requirement true by construction instead of by discipline. Tested each event type, an ordered multi-event sequence, a submitted-then-rejected sequence, and the empty-array edge case; verified against the seed data too (REQ-002 comes back `Submitted` with approver `u_carol`, matching the ADR by hand).

I asked Claude to add more detailed comments to `deriveStatus.ts` since it's essential to the app's correctness — the first pass explained *what* each branch did, but not *why* the backward loop in `getApproverId` matters (it's there so a resubmit's later `submitted` event wins over an earlier one), so I asked for a second, more explicit pass on that specific line.

# Approver Routing

Asked for the same explicit-comments treatment on `pickApprover.ts`, since it's the one piece of business logic the requirements single out by name. Claude's version walked through the three-step algorithm as a doc comment: pick a natural candidate purely from the amount (manager under $1,000, finance at or above), fall back to finance if that candidate is missing or turns out to be the requester, then refuse the whole submission if even finance would be the requester. It also tied the two self-approval fallback steps directly to the seed data cases that actually exercise them — Mallory, a manager whose own manager is Peggy, must never end up approving herself; Trent, the only finance user, has nobody to fall back to if he submits a large expense of his own. A `NoEligibleApproverError` class lives alongside the function for now, since the typed error hierarchy (`errors.ts`) is Phase 4 work and doesn't exist yet.

I noticed the code declared its own local `THOUSAND_DOLLARS_IN_CENTS = 100000` with a comment claiming it was kept separate from `shared/validation.ts`'s copy "on purpose." I asked Claude to explain the reasoning — there wasn't one; it was just a duplicated magic number, exactly what guardrail #2 warns against (the $1,000 threshold applies to both the justification rule and the routing rule and shouldn't be able to drift). Fixed by extracting it into `shared/constants.ts` and importing it in both files.

I also asked Claude to check the finished implementation against `requirments.md` directly, not just the ADR derived from it. It confirmed every clause of requirement 3 maps to a specific line, and flagged one thing worth remembering for later: the requirement only routes "a valid request," so validate-then-route ordering is the service layer's job (Phase 7) — `pickApprover` itself has no opinion on validation and shouldn't.

The function's doc comment had grown long enough that it made more sense as narrative here than as a code comment — this section is that rewrite, and the source file now just carries a short pointer back to it instead of repeating the full walkthrough inline.

One more pass on this file: `pickApprover` was comparing `user.role === 'finance'` against a bare string literal. I pointed out `role` could be its own named type in `shared/types.ts`, same pattern as `ExpenseType`/`Client`, and asked Claude to use that type in the comparison instead of a hardcoded value, so there's one place the set of valid roles is defined. It added `USER_ROLES`/`UserRole` to `shared/types.ts`, switched `User.role` to use it, and in `pickApprover.ts` replaced the inline `'finance'` with a `FINANCE_ROLE: UserRole = 'finance'` constant — the point being that if `'finance'` ever gets renamed in `USER_ROLES`, that constant declaration fails to compile immediately, instead of the comparison just silently never matching anyone at runtime.

# Error Layer

Asked Claude to implement just the `errors.ts` piece of Phase 4: a `DomainError` base plus `NotFoundError`, `ForbiddenError`, `InvalidTransitionError`, `ValidationError`, and `NoEligibleApproverError`, each carrying its own `status` and `code` per the ADR's error contract table.

Before writing anything, it flagged a real collision: `pickApprover.ts` already had its own plain `NoEligibleApproverError` (no `status`/`code`, since `logic/` has no HTTP awareness), and Phase 4 wanted a second, HTTP-aware class with the same name and purpose. It asked how I wanted to handle it rather than picking silently. I went with consolidating — delete the local one, have `pickApprover.ts` import and throw the `errors.ts` version instead. That's also literally what the plan already hinted at in Phase 7 ("either thrown directly by `logic/` or wrapped here — pick one and be consistent"), and it doesn't break the one-directional layering rule, since `errors.ts` isn't `routes/`, `services/`, or `store.ts`.

`DomainError` is abstract, forcing every subclass to declare `status`/`code` — the point being `middleware/errorHandler.ts` (next in Phase 4) can map any caught error generically by just reading those two fields off it, no switch statement needed. Added a small test file locking down the status/code pairs for all five classes, including one check that no two error types accidentally collapse onto the same `status:code` combination.

After `errorHandler.ts` (single Express error handler, ValidationError → `fieldErrors`, other DomainErrors → their own status/message, anything else → generic 500), I told Claude to stop writing detailed explanatory comments in code going forward — a few files had built up long "why" comments and it was more than this project needs.

Continued Phase 4 with `guards.ts` — `assertOwner`, `assertStatus`, `assertAssignedApprover`, each throwing the matching typed error from `errors.ts`. Straightforward given `deriveStatus`/`getApproverId` already existed to build on. I asked for a couple of minimal comments back afterward, on just the one line worth explaining (`assertAssignedApprover` rejecting a request with no approver yet is a side effect of `undefined` never equaling an `actor.id`, not a separate check) — a middle ground between the earlier "explicit and detailed" style and "no comments at all."

Then `serialize.ts` — `toResponse(request)` attaching `status` and `approverId` as computed fields, the one function that's allowed to do so per the plan's "only place derived fields get attached" rule. Kept it to exactly what Phase 4 asked for; the ADR's endpoint table mentions "requester name" alongside status for `GET /api/requests`, but that's Phase 11's job on the client, resolved against the separately-fetched users list, not something `toResponse` needs to carry.

Wire `index.ts`: `express.json()` and `cors()` mounted early, `errorHandler` mounted last so any thrown error — a `DomainError` or otherwise — funnels through the one error contract. CORS is wide open (`*`), which is fine here since CORS is a browser-only mechanism; it has no bearing on requirement 5's "enforce it even for a direct curl" guarantee, which is what `guards.ts` and `validation.ts` actually hold.

# Auth Middleware

Before `auth.ts`, I asked whether the plan bundling "apply auth to `/api/*`" and `routes/users.ts` into Phase 4 alongside the middleware still made sense, since routes felt like Phase 5+ territory. Claude's answer: it's one vertical slice, not scope creep — `GET /api/users` is deliberately the simplest possible route precisely so it can prove the auth+routing wiring works end-to-end (it's literally what the plan's own Verify step curls) before Phase 5 builds the busier request endpoints on top of the same mounted router.

That surfaced a real gap along the way: the ADR's error contract table only has 400/403/404/409, but the plan's own auth test wants 401s, and none of the five `DomainError` subclasses covered it. Asked how to handle it — consolidated on adding `UnauthorizedError` (401/`UNAUTHORIZED`) to `errors.ts` rather than having `auth.ts` build its own response inline, keeping every error on the same single-handler path.

Closed out Phase 4: `routes/users.ts` (`GET /api/users`) and `auth` mounted on all of `/api/*` in `index.ts`, so later routers inherit it for free. Verified live against the plan's own curl example — 6 users for a valid `X-User-Id`, 401 otherwise.

# Request Read Endpoints

Started Phase 5 with just `requests.service.ts`: `listRequests()` and `getRequest(id)`, the latter throwing `NotFoundError` instead of returning `undefined`. Kept both returning the raw `ExpenseRequest` shape — no derived `status`/`approverId` here, since `toResponse` stays the only place those get attached, per the plan's own rule about the response shape not drifting between endpoints. `routes/requests.ts` is next.

Closed out Phase 5 with `routes/requests.ts` — `GET /api/requests` and `GET /api/requests/:id`, both one line through `toResponse`, mounted on `/api/requests` in `index.ts` behind the same auth middleware. Verified against the plan's exact assertions live and in tests: REQ-001 comes back `Draft`, REQ-002 `Submitted` with approver `u_carol`, REQ-003 `Approved`, and an unknown id 404s with `NOT_FOUND`.

# Create & Update Draft

Started Phase 6 with `pickValues(body)`, the mass-assignment allowlist (guardrail #4) — only the seven known `RequestValues` keys ever get copied out of a request body, so a client stuffing in `status`/`requesterId`/`approverId` just gets silently ignored. The allowlist itself is a `Record<keyof RequestValues, true>` rather than a plain array, same reasoning as `USER_ROLES`/`THOUSAND_DOLLARS_IN_CENTS` earlier — if a field is ever added to `RequestValues`, this won't compile until it's added here too.

I asked Claude to explain the purpose in plain terms first, then to turn that into a detailed comment on the function itself, since it's a security-relevant piece worth being explicit about in the code, not just in `NOTES.md`.

Then I questioned whether `pickValues` was really a "guard" and belonged in `guards.ts` next to `assertOwner`/`assertStatus`/`assertAssignedApprover` instead of `requests.service.ts`. Claude's answer: no — the guards all share one contract (`assert*(...) => void`, throw a `DomainError` or pass silently), while `pickValues` never throws, it transforms input into output. It's also tightly coupled to `RequestValues` specifically and only ever called by `createDraft`/`updateDraft`, both in this same file, versus the guards being reusable across every service function regardless of what `RequestValues` looks like. Kept it where it is.

Implementing `createDraft(actor, body)` surfaced a real type gap: `ExpenseRequest.values` was typed as the fully-required `RequestValues`, but `createDraft(alice, {})` has to produce `values: {}` — a legal empty Draft per guardrail #6 ("Drafts skip validation. Submit runs it."). `pickValues` returning `Partial<RequestValues>` just wouldn't fit into a field typed as the full shape.

I asked whether loosening `ExpenseRequest.values` to `Partial<RequestValues>` would conflict with the Zod schema, or whether PATCH runs validation. Neither — `requestValuesSchema` is a hand-written schema, not inferred from the TS type, so it already declares its own required fields independently; and per guardrail #6, no validation runs on create or update at all, only on submit (Phase 7, not built yet). So the two are cleanly decoupled: the TS type describes what's *stored* during a Draft's lifetime (possibly incomplete), the Zod schema describes what's required to *submit* — Partial<RequestValues> just makes the stored-side type honest about that. Confirmed it compiles clean with zero downstream breakage (every existing fully-populated fixture still satisfies a `Partial` type), then implemented `createDraft` on top of it.

Closed out Phase 6 with `updateDraft(actor, id, body)` (`assertOwner` → `assertStatus('Draft')`, then merges `pickValues(body)` into the existing `values`, no validation) and the two routes — `POST /api/requests` and `PATCH /api/requests/:id` — both thin handlers over the service calls, matching the pattern already set by Phase 5. Went back afterward to check test coverage against the plan's own list line by line and found one gap: the service tests covered "PATCH leaves other values untouched," but no HTTP-level test did. Added it — PATCH with only `{ description }` against a draft that also has `amountCents` set, asserting the amount survives in the response. 92 tests green, mass-assignment guarantees (guardrail #4) verified at both the service and HTTP layers.

# Submit and routing

Implemented `submitRequest(actor, id)` following the reference order from the plan's "four layers" section: fetch → `assertOwner` → `assertStatus('Draft')` → `requestValuesSchema.safeParse` → `pickApprover` → append a `submitted` event → save. Validation only runs here, never on create/update, so a Draft can sit half-filled indefinitely (guardrail #6) but can't be submitted until it actually satisfies the shape.

`pickApprover` throwing `NoEligibleApproverError` needed no wrapping — it already threw the HTTP-aware version straight out of `logic/` (decided back in the Error Layer work), so `submitRequest` just lets it propagate, consistent with the plan's "pick one and be consistent" note.

`POST /api/requests/:id/submit` is a one-line handler through `toResponse`, mounted alongside the other request routes and inheriting the same auth middleware.

Tested at both layers: `submitRequest.test.ts` calls the service directly for the full case list — under/over $1,000 routing, billable without client, amount without justification, `Other` without reason, non-owner 403, already-Submitted 409, and Trent (finance, no fallback) submitting over $1,000 → `NoEligibleApproverError`. A matching HTTP subset in `requestsRoute.test.ts` confirms the same cases map to the right status codes and body shape over Supertest — in particular that `fieldErrors` comes back exactly as the form will need to consume it. Verified live with curl too: a billable draft with no client 400s with `fieldErrors.client`, and Trent's oversized submission comes back `NO_ELIGIBLE_APPROVER`. 106 tests green.
