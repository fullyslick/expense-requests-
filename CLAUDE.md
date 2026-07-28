# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working method

Before any task, read the **Guardrails** section of `IMPLEMENTATION_PLAN.md` — 11 invariants that are correctness bugs when violated, not style preferences. Re-read them whenever a task touches validation, authorization, or status.

Work the phases in `IMPLEMENTATION_PLAN.md` in order. Do not start a phase until the previous phase's **Verify** step passes. Architectural rationale for every decision lives in `ADR.md`; when the plan says *what*, the ADR says *why*.

Two things happen at the end of each phase, and both are expected as part of the work:

- Tick the phase's checkboxes in `IMPLEMENTATION_PLAN.md`.
- Append a narrative section to `NOTES.md` covering what was built, decisions made, and anything that surprised you. `NOTES.md` is a graded deliverable, not an afterthought — it is written as the work happens, in the author's first-person voice.

`NOTES.md` opens with four summary sections (Design Choices, Tradeoffs, What Was Tested,
What's Next) before the chronological journal starts — keep new narrative in the journal
and only touch the summaries when a decision or a test count actually changes.
`MANUAL_TEST_PLAN.md` is the manual counterpart to the automated suite: twelve sections
including a hostile-`curl` sweep with one case per guardrail. Update it when behaviour it
asserts changes.

## Commands

```bash
npm install            # once, from the root — npm workspaces cover client/server/shared
npm run dev:server     # Express API, http://localhost:4000
npm run dev:client     # Vite dev server, http://localhost:5173
npm test               # all three workspaces
npm run lint           # eslint, whole repo
npm run format         # prettier --write, whole repo
                       # ⚠️  only run when intentionally formatting — will modify all unformatted files
```

`prettier --check` already fails on files nobody has touched in a while (`api/client.ts`,
`api/useApiQuery.ts`, `api/client.test.ts`, `NOTES.md`, `IMPLEMENTATION_PLAN.md`). A
failure there isn't necessarily from your change — check `git diff` before reformatting,
because a repo-wide `npm run format` buries a small change under hundreds of lines.

Per-workspace and single tests:

```bash
npm test --workspace=server                    # Jest
npm test --workspace=client                    # Vitest
npm test --workspace=client -- RequestDetail   # one client test file by name pattern

cd server && npx jest submitRequest            # one server test file by name pattern
cd server && npx jest -t 'falls back to finance'  # one server test case by name
```

Run Jest from inside `server/`, not from the root with `--rootDir server` — that flag
skips `server/jest.config.js`, so ts-jest never loads and every `.ts` test dies on the
first `import`.

Type-checking is not part of `npm test` — run it separately when touching types:

```bash
cd server && npx tsc --noEmit
cd client && npx tsc -b
```

Client tests are Vitest + React Testing Library — one convention they all follow, plus two jsdom traps that cost real time to rediscover:

- **Page tests stub `@/api/useApiQuery`, not `fetch`.** A page's contract is "given this data, render this"; `api/client.test.ts` already covers the fetch layer against a stubbed `global.fetch`.
- **`setupTests.ts` is load-bearing.** It registers `afterEach(cleanup)` explicitly — RTL only self-registers that under `globals: true`, and this project imports `describe`/`it`/`expect` by hand — and polyfills `PointerEvent` plus `hasPointerCapture`/`scrollIntoView`/`ResizeObserver`, which every Base UI primitive needs in jsdom.
- **Base UI Select commits on a full pointer sequence.** `fireEvent.click(option)` alone opens the popup and silently leaves the value unchanged; fire `pointerDown` → `pointerUp` → `click`. The Checkbox renders two elements sharing one accessible name, so query it by role, not `getByLabelText`.

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

Four routes. **`/requests/:id` is the read-only detail page and `/requests/:id/edit` is
the form** — IMPLEMENTATION_PLAN.md Phase 12 says edit mode lives at `/requests/:id`,
but Phase 10 had already given that URL to the detail page and both can't own it. The
ADR's actual requirement is that the form holds an id before `/submit` runs, so a
retry PATCHes instead of creating an orphan draft; which path spells that id is
incidental. Don't "fix" this back to match the plan's literal text.

The `@/*` alias maps to `client/src/*` and must stay declared in **both** `client/tsconfig.json` and `client/tsconfig.app.json` — the shadcn CLI only reads the top-level one, and writes files into a literal `@/` folder if it's missing there.

## Design validation

Mockups live in `client/public/design-mockups/` and are served by the client dev
server (`npm run dev:client` first) — there is no top-level `/design` directory:

http://localhost:5173/design-mockups/list-page.html
http://localhost:5173/design-mockups/request-form.html
http://localhost:5173/design-mockups/detail-page-and-history.html
http://localhost:5173/design-mockups/app-header.html

After changing any frontend page, do a validation pass using Chrome (run `/chrome`
first if not already connected):

1. Open the live route (e.g. localhost:5173/requests) in a tab.
2. Open the matching mockup URL above in another tab.
3. Compare: status badge colors, table column order, spacing/hierarchy,
   button placement, error state rendering.
4. For request-form.html specifically: click the "Billable" checkbox and
   change "Expense type" to "Other" in the LIVE app, and confirm the
   conditional fields appear/disappear as they do in the mockup's demo.

The mockups are self-extracting JS bundles, so their markup is not readable with
`Read` and hidden conditional fields don't screenshot. To read one's real labels
and styles, pull the `__bundler/template` script tag out of the HTML and
`JSON.parse` it.

Report deviations, don't silently "fix" them against the mockup.

**If the mockup and the spec (`.claude/docs/requirments.md`, note the spelling) or
`ADR.md` disagree, the spec wins.**
Known case: ADR §9 says Submit is disabled only while in-flight, never for
invalidity — don't match the mockup if it shows otherwise.

## Conventions

- **Comments are terse and explain *why*, not *what*.** Most code carries none. Reserve them for the one line whose reasoning isn't obvious from reading it.
- **Tests own their state.** The store is a module-level `Map` shared across every test in a file and is not reset between tests. Build fixtures through `createDraft`/`submitRequest` rather than mutating seed rows (`REQ-001`…`REQ-004`), so test order never matters.
- **Commit messages** are short and imperative, no conventional-commit prefixes: `Add createDraft`, `Mount auth on /api/* and add GET /api/users`.
- `server/data/*.json` is pristine seed data, read at boot and never written back to.

