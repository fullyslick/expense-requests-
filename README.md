# Expense Requests

An internal expense-request tool: submit an expense, have it routed to the right approver, and track it through Draft → Submitted → Approved/Rejected.

See `ADR.md` for the architecture and rationale, `IMPLEMENTATION_PLAN.md` for the phase-by-phase build log, and `NOTES.md` for run instructions, design choices, and AI usage notes.

## Prerequisites

- Node.js `>=24.18.0`
- npm `>=11.16.0`

## Install

From the repo root (npm workspaces cover `/client`, `/server`, and `/shared` in one install):

```bash
npm install
```

## Run

Two dev servers, run in separate terminals:

```bash
npm run dev:server   # Express API on http://localhost:4000
npm run dev:client   # Vite dev server on http://localhost:5173
```

The client is not yet wired to call the API (frontend build is in progress — see `IMPLEMENTATION_PLAN.md` Part B). Until then, exercise the API directly:

```bash
curl -H 'X-User-Id: u_alice' http://localhost:4000/api/requests
```

`X-User-Id` is the app's fake-auth header — every request needs one of the seed user ids (`u_alice`, `u_bob`, `u_carol`, `u_mallory`, `u_peggy`, `u_trent`). See `server/data/users.json` for the full list and `ADR.md` §6 for why a header stands in for real auth here.

## Test

```bash
npm test
```

Runs Jest across `/server` and `/shared`, and Vitest across `/client`, one workspace at a time.

## Lint / format

```bash
npm run lint           # eslint, whole repo
npm run format:check   # prettier --check, whole repo
npm run format          # prettier --write, whole repo
```

## Project layout

```
/
├── shared/    # types, Zod validation schema, money utils — imported by both sides, no build step
├── server/    # Express API, in-memory store seeded from server/data/*.json
└── client/    # Vite + React + TypeScript, Tailwind + shadcn primitives
```
