import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ExpenseRequest, User } from '../../shared/types';

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

const users = seedUsers();
const requests = seedRequests();

let nextRequestNumber = requests.size + 1;

export function listUsers(): User[] {
  return Array.from(users.values());
}

export function getUserById(id: string): User | undefined {
  return users.get(id);
}

export function listRequests(): ExpenseRequest[] {
  return Array.from(requests.values());
}

export function getRequestById(id: string): ExpenseRequest | undefined {
  return requests.get(id);
}

export function saveRequest(request: ExpenseRequest): ExpenseRequest {
  requests.set(request.id, request);
  return request;
}

export function generateRequestId(): string {
  const id = `REQ-${String(nextRequestNumber).padStart(3, '0')}`;
  nextRequestNumber += 1;
  return id;
}