import type { ExpenseRequest, User } from '../../shared/types';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const usersPath = join(__dirname, '..', 'data', 'users.json');
const requestsPath = join(__dirname, '..', 'data', 'requests.json');

function seedUsers(): Map<string, User> {
  const seed = JSON.parse(readFileSync(usersPath, 'utf-8')) as User[];
  return new Map(seed.map((user) => [user.id, user]));
}

function seedRequests(): Map<string, ExpenseRequest> {
  const seed = JSON.parse(readFileSync(requestsPath, 'utf-8')) as ExpenseRequest[];
  return new Map(seed.map((request) => [request.id, request]));
}

export const users = seedUsers();
export const requests = seedRequests();
