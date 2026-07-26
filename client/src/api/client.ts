import { API_PREFIX, SERVER_PORT } from 'shared/constants';

const BASE_URL = `http://localhost:${SERVER_PORT}${API_PREFIX}`;

export type FieldErrors = Record<string, string[]>;

export class ApiError extends Error {
  status: number;
  code: string;
  fieldErrors?: FieldErrors;

  constructor(status: number, code: string, message: string, fieldErrors?: FieldErrors) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

// client.ts isn't a component, so it can't useContext — CurrentUserProvider
// pushes the id here on every change instead (ADR §6's "module-level
// variable" alternative), so this stays the one place request() reads it.
let currentUserId: string | null = null;

export function setCurrentUserId(id: string | null): void {
  currentUserId = id;
}

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (currentUserId) {
    headers['X-User-Id'] = currentUserId;
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      data.error ?? 'UNKNOWN_ERROR',
      data.message ?? 'Something went wrong',
      data.fieldErrors,
    );
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>('GET', path, undefined, signal),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
};