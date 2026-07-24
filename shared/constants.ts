// The $1,000 threshold — applies to both the "additional
// justification" validation rule (shared/validation.ts) and the approver
// routing rule (server/src/logic/pickApprover.ts). Single source of truth so
// the two rules can't silently drift to different cents values.
export const THOUSAND_DOLLARS_IN_CENTS = 100_000;
