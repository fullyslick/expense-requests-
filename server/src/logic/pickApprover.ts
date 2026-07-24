import { THOUSAND_DOLLARS_IN_CENTS } from 'shared/constants';
import type { User, UserRole } from 'shared/types';
import { NoEligibleApproverError } from '../errors';

// Typed against UserRole (shared/types.ts) rather than an inline 'finance'
// literal, so if that role is ever renamed there, this breaks at compile time
// instead of silently never matching anyone.
const FINANCE_ROLE: UserRole = 'finance';

/**
 * Decides who approves a submitted request: manager under $1,000, finance at
 * or above, falling back to finance if the natural candidate is missing or
 * would be the requester themselves, and refusing outright if even finance
 * would be the requester. See NOTES.md — "Approver Routing" — for the full
 * walkthrough, including why the Mallory and Trent seed cases (asserted in
 * pickApprover.test.ts) are what this fallback logic actually protects against.
 */
export function pickApprover(requester: User, amountCents: number, users: User[]): string {
  const finance = users.find((user) => user.role === FINANCE_ROLE);
  const manager = users.find((user) => user.id === requester.managerId);

  // Step 1 — natural candidate, decided purely by the amount threshold.
  let candidate = amountCents >= THOUSAND_DOLLARS_IN_CENTS ? finance : manager;

  // Step 2 — first self-approval guard + missing-candidate fallback.
  // Covers: no manager on file, and the Mallory-style "manager is self" case.
  if (!candidate || candidate.id === requester.id) {
    candidate = finance;
  }

  // Step 3 — same guard applied to the fallback. Covers: no finance user at
  // all, and the Trent-style "finance is self" case. If this still fails,
  // there is no eligible approver anywhere in the user list.
  if (!candidate || candidate.id === requester.id) {
    throw new NoEligibleApproverError(requester.id);
  }

  return candidate.id;
}
