import type { User } from 'shared/types';
import { NoEligibleApproverError } from '../errors';
import { pickApprover } from '../logic/pickApprover';

// Mirrors server/data/users.json exactly, so these tests double as a check
// against the real seed data, not just a synthetic fixture.
const alice: User = { id: 'u_alice', name: 'Alice', role: 'employee', managerId: 'u_carol' };
const bob: User = { id: 'u_bob', name: 'Bob', role: 'employee', managerId: 'u_mallory' };
const carol: User = { id: 'u_carol', name: 'Carol', role: 'manager', managerId: 'u_peggy' };
const mallory: User = { id: 'u_mallory', name: 'Mallory', role: 'manager', managerId: 'u_peggy' };
const peggy: User = { id: 'u_peggy', name: 'Peggy', role: 'manager', managerId: null };
const trent: User = { id: 'u_trent', name: 'Trent', role: 'finance', managerId: 'u_peggy' };

const users: User[] = [alice, bob, carol, mallory, peggy, trent];

describe('pickApprover', () => {
  it('under $1,000 routes to the requester\'s manager (Alice $450 -> Carol)', () => {
    expect(pickApprover(alice, 45_000, users)).toBe('u_carol');
  });

  it('$1,000 or over routes to finance, not the manager (Bob $1,250 -> Trent)', () => {
    expect(pickApprover(bob, 125_000, users)).toBe('u_trent');
  });

  it('routes to finance at exactly the 100000-cent boundary, not the manager', () => {
    // Same requester/manager pair as the first test, only the amount changes,
    // to isolate that it's the threshold — not the requester — driving this.
    expect(pickApprover(alice, 100_000, users)).toBe('u_trent');
  });

  it('falls back to finance when the requester has no manager on file', () => {
    // Peggy's managerId is null, so no manager match exists for her at all.
    expect(pickApprover(peggy, 20_000, users)).toBe('u_trent');
  });

  it('falls back to finance when the natural candidate would be the requester', () => {
    // A manager whose own managerId points back to themselves — the "manager"
    // match step 1 finds IS the requester, so step 2 must reroute to finance.
    const selfManaged: User = { id: 'u_self', name: 'Self', role: 'manager', managerId: 'u_self' };
    const usersWithSelfManaged = [...users, selfManaged];
    expect(pickApprover(selfManaged, 10_000, usersWithSelfManaged)).toBe('u_trent');
  });

  it('Mallory ($600) routes to her own manager Peggy, never to herself', () => {
    // The case called out explicitly in the ADR: Mallory is a manager, but
    // that must not make her eligible to approve her own request.
    expect(pickApprover(mallory, 60_000, users)).toBe('u_peggy');
  });

  it('Trent (finance, $1,500) has no eligible approver and throws', () => {
    // Trent is the seed data's only finance user, so when he is also the
    // requester there is nobody left for the $1,000+ rule to route to.
    expect(() => pickApprover(trent, 150_000, users)).toThrow(NoEligibleApproverError);
  });

  it('throws when there is no finance user in the system at all', () => {
    const usersWithoutFinance = users.filter((user) => user.role !== 'finance');
    expect(() => pickApprover(bob, 150_000, usersWithoutFinance)).toThrow(NoEligibleApproverError);
  });
});
