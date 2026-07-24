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