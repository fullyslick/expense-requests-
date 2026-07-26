# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working method

Before any task, read the **Guardrails** section of `IMPLEMENTATION_PLAN.md` — 11 invariants that are correctness bugs when violated, not style preferences. Re-read them whenever a task touches validation, authorization, or status.

Work the phases in `IMPLEMENTATION_PLAN.md` in order. Do not start a phase until the previous phase's **Verify** step passes. Architectural rationale for every decision lives in `ADR.md`; when the plan says *what*, the ADR says *why*.

Two things happen at the end of each phase, and both are expected as part of the work:

- Tick the phase's checkboxes in `IMPLEMENTATION_PLAN.md`.
- Append a narrative section to `NOTES.md` covering what was built, decisions made, and anything that surprised you. `NOTES.md` is a graded deliverable, not an afterthought — it is written as the work happens, in the author's first-person voice.

## Commands

```bash
npm install            # once, from the root — npm workspaces cover client/server/shared
npm run dev:server     # Express API, http://localhost:4000
npm run dev:client     # Vite dev server, http://localhost:5173
npm test               # all three workspaces
npm run lint           # eslint, whole repo
npm run format         # prettier --write, whole repo
```

Per-workspace and single tests:

```bash
npm test --workspace=server                          # Jest
npx jest submitRequest --rootDir server              # one server test file by name pattern
npx jest -t 'routes to the manager' --rootDir server # one test case by name
npm test --workspace=client                          # Vitest
```

Type-checking is not part of `npm test` — run it separately when touching types:

```bash
cd server && npx tsc --noEmit
cd client && npx tsc -b
```

The client has no test files yet; its Vitest config sets `passWithNoTests` so the root `npm test` stays green until Phase 12/13 add component tests.

## Architecture

Three npm workspaces. `shared/` is plain `.ts` compiled from source by both sides — no build step — and resolves through the workspace symlink `node_modules/shared`, so server and client both import it as `shared/types`, `shared/validation`, etc.

### Server layering is one-directional and enforced by convention

`routes/ → services/ → logic/ → store.ts`

| Layer | Owns | Never contains |
|---|---|---|
| `routes/` | URL wiring, `req` → args | any rule, any store call |
| `services/` | authorization, orchestration, appending events | `req` / `res` / status codes |
| `logic/` | status derivation, approver routing — **pure** | store, express |
| `store.ts` | in-memory `Map`s keyed by id | rules of any kind |

A route never touches the store or `logic/` directly. A service never sees `req`/`res` — it throws a typed error instead. Handlers stay one line:

```ts
router.post('/:id/submit', (req, res, next) => {
  try {
    res.json(toResponse(submitRequest(req.currentUser, req.params.id)));
  } catch (err) { next(err); }
});
```

Resist adding a repository interface, a DI container, a `BaseController`, or a `services/` subfolder per entity. Eight endpoints don't justify it.

### Status is derived, never stored

Nothing in the store holds a `status` field — only `{ id, requesterId, values, events }`. `deriveStatus(events)` maps the last event's type to a `Status`; `getApproverId(events)` scans backward for the most recent `submitted` event. Writes **append an event**; they never set a status. `services/serialize.ts`'s `toResponse()` is the only place derived fields get attached to a response, so the shape can't drift between endpoints.

### Errors are typed and mapped in exactly one place

Every error in `server/src/errors.ts` extends an abstract `DomainError` carrying its own `status` and `code`. `middleware/errorHandler.ts` is mounted last and is the only place an error becomes an HTTP response — it reads `status`/`code` off whatever it caught, so no switch statement is needed. `ValidationError` is the one special case (its body carries `fieldErrors` instead of `message`). Unknown errors log server-side and return a generic 500; never leak a stack.

### Mass assignment is guarded by an allowlist

`pickValues(body)` in `requests.service.ts` copies only the seven known `RequestValues` keys out of a request body. It's typed as `Record<keyof RequestValues, true>` so adding a field to `RequestValues` fails to compile until the allowlist is updated too. `createDraft`/`updateDraft` are its only callers — nothing else should ever read `req.body`. `requesterId` comes from `req.currentUser.id`; `approverId` is computed by `pickApprover()` at submit time.

### Auth is fake, authorization is real

`middleware/auth.ts` reads the `X-User-Id` header, resolves it via `store.getUserById`, and attaches `req.currentUser` (401 otherwise). It occupies the slot a JWT would. Every ownership and approver check is enforced server-side against `req.currentUser.id` — assume every request is a hostile `curl`.

### Validation boundary

Zod (`shared/validation.ts`) validates **field shape only**, including the three conditional rules via `superRefine`. Approver routing and status transitions are hand-written functions with their own unit tests — never express routing as a schema refinement. Validation runs on submit only; drafts (POST/PATCH) accept partial, invalid objects without complaint.

Money is whole cents everywhere. `shared/money.ts` is the only conversion point, and `THOUSAND_DOLLARS_IN_CENTS` in `shared/constants.ts` is the single source for the `>= 100000` threshold used by both the justification rule and the routing rule.

## Client

Vite + React + TypeScript, Tailwind v4 (no config file — `@tailwindcss/vite` plugin plus `@import 'tailwindcss'`), shadcn **primitives only**. React Router runs in **Declarative mode** (`BrowserRouter` + `Routes`) — deliberately not Data or Framework mode, so Express stays the only server in the repo.

Do not run `shadcn add form`, and do not add `react-hook-form`. Conditional field visibility and validation are hand-wired from local state.

The `@/*` alias maps to `client/src/*` and must stay declared in **both** `client/tsconfig.json` and `client/tsconfig.app.json` — the shadcn CLI only reads the top-level one, and writes files into a literal `@/` folder if it's missing there.

## Conventions

- **Comments are terse and explain *why*, not *what*.** Most code carries none. Reserve them for the one line whose reasoning isn't obvious from reading it.
- **Tests own their state.** The store is a module-level `Map` shared across every test in a file and is not reset between tests. Build fixtures through `createDraft`/`submitRequest` rather than mutating seed rows (`REQ-001`…`REQ-004`), so test order never matters.
- **Commit messages** are short and imperative, no conventional-commit prefixes: `Add createDraft`, `Mount auth on /api/* and add GET /api/users`.
- `server/data/*.json` is pristine seed data, read at boot and never written back to.