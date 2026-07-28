import * as store from '../store';
import type { User } from 'shared/types';

// A pass-through today, but routes are not allowed to reach the store
// directly (guardrail #11) — and any future rule about who may list users
// has exactly one place to live.
export function listUsers(): User[] {
  return store.listUsers();
}
