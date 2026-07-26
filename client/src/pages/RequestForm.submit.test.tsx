import { MemoryRouter } from 'react-router-dom';

import RequestForm from './RequestForm';
import { CurrentUserProvider } from '@/context/CurrentUser';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));

// Only `api` is stubbed — ApiError stays real so the component's `instanceof`
// branch is the one actually under test, not a lookalike.
const post = vi.hoisted(() => vi.fn());
const patch = vi.hoisted(() => vi.fn());
vi.mock('@/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/client')>()),
  api: { get: vi.fn(), post, patch },
}));

const { ApiError } = await import('@/api/client');

function renderForm() {
  render(
    <MemoryRouter>
      <CurrentUserProvider>
        <RequestForm />
      </CurrentUserProvider>
    </MemoryRouter>,
  );
}

function fillValidForm() {
  fireEvent.click(screen.getByLabelText('Expense Type'));
  const option = screen.getByRole('option', { name: 'Travel' });
  fireEvent.pointerDown(option);
  fireEvent.pointerUp(option);
  fireEvent.click(option);

  fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '45.00' } });
  fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Client onsite' } });
}

const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
const saveDraft = () => fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));

beforeEach(() => {
  vi.clearAllMocks();
  post.mockImplementation(async (path: string) => (path === '/requests' ? { id: 'REQ-010' } : {}));
  patch.mockResolvedValue({ id: 'REQ-010' });
});

describe('RequestForm writes', () => {
  it('does not call the API when client validation fails', async () => {
    renderForm();
    submit();

    await screen.findByText('Description is required');
    expect(post).not.toHaveBeenCalled();
    expect(patch).not.toHaveBeenCalled();
  });

  it('leaves Submit enabled when client validation fails', async () => {
    renderForm();
    submit();

    await screen.findByText('Description is required');
    expect(screen.getByRole('button', { name: 'Submit' })).not.toBeDisabled();
  });

  // Guardrail #1: the wire format is whole cents, never the dollar string the
  // input holds.
  it('persists then submits, sending cents rather than dollars', async () => {
    renderForm();
    fillValidForm();
    submit();

    await waitFor(() => expect(post).toHaveBeenCalledWith('/requests/REQ-010/submit'));
    expect(post).toHaveBeenCalledWith('/requests', expect.objectContaining({ amountCents: 4500 }));
    expect(navigate).toHaveBeenCalledWith('/requests/REQ-010');
  });

  it('converts to cents on Save Draft too, and never calls submit', async () => {
    renderForm();
    fillValidForm();
    saveDraft();

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        '/requests',
        expect.objectContaining({ amountCents: 4500 }),
      ),
    );
    expect(post).not.toHaveBeenCalledWith('/requests/REQ-010/submit');
  });

  // The orphan-draft guard: a failed submit must not leave the retry creating a
  // second request. The id claimed by the first POST turns every later write
  // into a PATCH.
  it('retries a failed submit with PATCH instead of a second POST', async () => {
    post.mockImplementation(async (path: string) => {
      if (path === '/requests') return { id: 'REQ-010' };
      throw new ApiError(400, 'NO_ELIGIBLE_APPROVER', 'No eligible approver');
    });

    renderForm();
    fillValidForm();
    submit();
    await screen.findByText('No eligible approver');

    post.mockImplementation(async (path: string) =>
      path === '/requests' ? { id: 'REQ-010' } : {},
    );
    submit();
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/requests/REQ-010'));

    expect(post.mock.calls.filter(([path]) => path === '/requests')).toHaveLength(1);
    expect(patch).toHaveBeenCalledWith('/requests/REQ-010', expect.any(Object));
  });

  it('renders server fieldErrors inline', async () => {
    post.mockImplementation(async (path: string) => {
      if (path === '/requests') return { id: 'REQ-010' };
      throw new ApiError(400, 'VALIDATION_FAILED', 'Validation failed', {
        client: ['Client is required for billable expenses'],
      });
    });

    renderForm();
    fillValidForm();
    submit();

    expect(await screen.findByText('Client is required for billable expenses')).toBeInTheDocument();
  });

  it('re-enables Submit after a failure', async () => {
    post.mockImplementation(async (path: string) => {
      if (path === '/requests') return { id: 'REQ-010' };
      throw new ApiError(400, 'NO_ELIGIBLE_APPROVER', 'No eligible approver');
    });

    renderForm();
    fillValidForm();
    submit();

    await screen.findByText('No eligible approver');
    expect(screen.getByRole('button', { name: 'Submit' })).not.toBeDisabled();
  });
});
