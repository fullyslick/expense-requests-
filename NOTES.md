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

