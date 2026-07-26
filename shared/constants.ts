// The $1,000 threshold — applies to both the "additional
// justification" validation rule (shared/validation.ts) and the approver
// routing rule (server/src/logic/pickApprover.ts). Single source of truth so
// the two rules can't silently drift to different cents values.
export const THOUSAND_DOLLARS_IN_CENTS = 100_000;

// Where the Express API listens (server/src/index.ts) and where
// client/src/api/client.ts points its fetch calls. Single source so the two
// processes can't drift to different ports/prefixes during local dev.
export const SERVER_PORT = 4000;
export const API_PREFIX = '/api';
