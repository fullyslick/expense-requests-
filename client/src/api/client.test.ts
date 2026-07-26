import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api, ApiError, setCurrentUserId } from './client';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('api client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    setCurrentUserId(null);
    vi.unstubAllGlobals();
  });

  it('sends X-User-Id once setCurrentUserId has been called', async () => {
    setCurrentUserId('u_alice');
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, []));

    await api.get('/requests');

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect((init?.headers as Record<string, string>)['X-User-Id']).toBe('u_alice');
  });

  it('omits X-User-Id when no user has been set', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, []));

    await api.get('/requests');

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect((init?.headers as Record<string, string>)['X-User-Id']).toBeUndefined();
  });

  it('only sets Content-Type when a body is sent', async () => {
    vi.mocked(fetch).mockImplementation(async () => jsonResponse(200, {}));

    await api.get('/requests');
    let [, init] = vi.mocked(fetch).mock.calls[0];
    expect((init?.headers as Record<string, string>)['Content-Type']).toBeUndefined();

    await api.post('/requests', { amountCents: 100 });
    [, init] = vi.mocked(fetch).mock.calls[1];
    expect((init?.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('resolves with the parsed JSON body on a 2xx response', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { id: 'req_1' }));

    const result = await api.get<{ id: string }>('/requests/req_1');

    expect(result).toEqual({ id: 'req_1' });
  });

  it('resolves with undefined on a 204 response', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));

    const result = await api.post('/requests/req_1/submit');

    expect(result).toBeUndefined();
  });

  it('throws ApiError with status/code/message/fieldErrors from a VALIDATION_FAILED body', async () => {
    const fieldErrors = { amountCents: ['Required'] };
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(400, { error: 'VALIDATION_FAILED', fieldErrors }),
    );

    await expect(api.post('/requests/req_1/submit')).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_FAILED',
      fieldErrors,
    });
  });

  it('throws ApiError with the message from a non-validation error body', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(403, { error: 'FORBIDDEN', message: 'Only the owner can edit this request' }),
    );

    await expect(api.patch('/requests/req_1', {})).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
      message: 'Only the owner can edit this request',
    });
  });

  it('falls back to UNKNOWN_ERROR when the error body is not JSON', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('not json', { status: 500 }));

    await expect(api.get('/requests')).rejects.toMatchObject({
      status: 500,
      code: 'UNKNOWN_ERROR',
    });
  });

  it('throws instances of ApiError', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(404, { error: 'NOT_FOUND', message: 'nope' }));

    await expect(api.get('/requests/missing')).rejects.toBeInstanceOf(ApiError);
  });
});