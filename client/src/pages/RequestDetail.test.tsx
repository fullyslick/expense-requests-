import { MemoryRouter, Route, Routes } from 'react-router-dom';

import RequestDetail from './RequestDetail';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ExpenseRequestResponse, User } from 'shared/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useApiQuery = vi.hoisted(() => vi.fn());
vi.mock('@/api/useApiQuery', () => ({ useApiQuery }));

const post = vi.hoisted(() => vi.fn());
vi.mock('@/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/client')>()),
  api: { get: vi.fn(), post, patch: vi.fn() },
}));

const currentUser = vi.hoisted(() => ({ value: null as unknown as User | null }));
vi.mock('@/context/CurrentUser', () => ({
  useCurrentUser: () => ({ currentUser: currentUser.value }),
}));

const { ApiError } = await import('@/api/client');

const USERS: User[] = [
  { id: 'u_alice', name: 'Alice', role: 'employee', managerId: 'u_carol' },
  { id: 'u_carol', name: 'Carol', role: 'manager', managerId: null },
];

const refetch = vi.fn();

function requestFixture(overrides: Partial<ExpenseRequestResponse> = {}): ExpenseRequestResponse {
  return {
    id: 'REQ-002',
    requesterId: 'u_alice',
    requesterName: 'Alice',
    status: 'Submitted',
    approverId: 'u_carol',
    values: {
      expenseType: 'Travel',
      amountCents: 124000,
      description: 'Denver kickoff',
      billable: false,
    },
    events: [
      { type: 'created', at: '2026-07-20T12:14:00.000Z', actorId: 'u_alice' },
      {
        type: 'submitted',
        at: '2026-07-22T12:02:00.000Z',
        actorId: 'u_alice',
        approverId: 'u_carol',
      },
    ],
    ...overrides,
  };
}

// The page runs two queries — the request and the users list — so the stub
// answers by path rather than returning one shape to both.
function renderDetail(
  request: Partial<ReturnType<typeof useApiQuery>>,
  { user = USERS[1] }: { user?: User | null } = {},
) {
  currentUser.value = user;
  useApiQuery.mockImplementation((path: string) =>
    path === '/users'
      ? { data: USERS, loading: false, error: null, refetch: vi.fn() }
      : { data: null, loading: false, error: null, refetch, ...request },
  );

  return render(
    <MemoryRouter initialEntries={['/requests/REQ-002']}>
      <Routes>
        <Route path="/requests/:id" element={<RequestDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  post.mockResolvedValue({});
});

describe('RequestDetail', () => {
  it('renders the values readably — dollars, type, status, requester', () => {
    renderDetail({ data: requestFixture() });

    const heading = screen.getByRole('heading', { name: 'REQ-002' });
    expect(within(heading.parentElement as HTMLElement).getByText('Submitted')).toBeInTheDocument();
    expect(screen.getByText('Travel')).toBeInTheDocument();
    expect(screen.getByText('$1,240.00')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Jul 20, 2026')).toBeInTheDocument();
    expect(screen.getByText('Denver kickoff')).toBeInTheDocument();
  });

  it('renders the conditional fields only when they carry a value', () => {
    renderDetail({
      data: requestFixture({
        values: {
          expenseType: 'Other',
          amountCents: 150000,
          description: 'Conference booth',
          billable: true,
          client: 'Globex',
          otherReason: 'Marketing spend',
          additionalJustification: 'Signed off by the department head',
        },
      }),
    });

    expect(screen.getByText('Globex')).toBeInTheDocument();
    expect(screen.getByText('Marketing spend')).toBeInTheDocument();
    expect(screen.getByText('Signed off by the department head')).toBeInTheDocument();
  });

  it('hides the client field when the request is not billable', () => {
    renderDetail({ data: requestFixture() });
    expect(screen.queryByText('Client')).not.toBeInTheDocument();
  });

  it('resolves each history event to an action, actor name and timestamp', () => {
    renderDetail({ data: requestFixture() });

    const entries = screen.getAllByRole('listitem');
    expect(entries).toHaveLength(2);
    expect(within(entries[0]).getByText('Created')).toBeInTheDocument();
    expect(entries[0]).toHaveTextContent('Created by Alice');
    expect(entries[1]).toHaveTextContent('Submitted by Alice');
    expect(entries[1]).toHaveTextContent('Jul 22, 2026');
  });

  it('falls back to the actor id when the user list has no match', () => {
    renderDetail({
      data: requestFixture({
        events: [{ type: 'created', at: '2026-07-20T16:14:00.000Z', actorId: 'u_ghost' }],
      }),
    });

    expect(screen.getByRole('listitem')).toHaveTextContent('Created by u_ghost');
  });

  it('shows the assigned approver name while Submitted', () => {
    renderDetail({ data: requestFixture() });
    expect(screen.getByText('Assigned Approver')).toBeInTheDocument();
  });

  it('hides the assigned approver once the request is decided', () => {
    renderDetail({ data: requestFixture({ status: 'Approved' }) });
    expect(screen.queryByText('Assigned Approver')).not.toBeInTheDocument();
  });

  it('shows Approve and Reject only to the assigned approver', () => {
    renderDetail({ data: requestFixture() });
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
  });

  it('hides Approve and Reject from everyone else', () => {
    renderDetail({ data: requestFixture() }, { user: USERS[0] });
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument();
  });

  it('hides Approve and Reject once the request is no longer Submitted', () => {
    renderDetail({ data: requestFixture({ status: 'Approved' }) });
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  });

  it('posts to the decision path and refetches so the history grows', async () => {
    renderDetail({ data: requestFixture() });
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    await waitFor(() => expect(post).toHaveBeenCalledWith('/requests/REQ-002/approve'));
    expect(refetch).toHaveBeenCalled();
  });

  it('rejects through the same helper, differing only in the path', async () => {
    renderDetail({ data: requestFixture() });
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));

    await waitFor(() => expect(post).toHaveBeenCalledWith('/requests/REQ-002/reject'));
  });

  it('disables both buttons while a decision is in flight', async () => {
    post.mockImplementation(() => new Promise(() => {}));
    renderDetail({ data: requestFixture() });
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled());
    expect(screen.getByRole('button', { name: 'Reject' })).toBeDisabled();
  });

  // A 403 or 409 has no field to attach to — it belongs in a banner.
  it('renders a decision failure as a banner and re-enables the buttons', async () => {
    post.mockRejectedValue(new ApiError(409, 'INVALID_STATUS', 'Request is not Submitted'));
    renderDetail({ data: requestFixture() });
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    expect(await screen.findByText('Request is not Submitted')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve' })).not.toBeDisabled();
  });

  // A 409 here almost always means someone else already decided it — the
  // stale copy on screen is worth refreshing even though the action failed.
  it('refetches after a failed decision too, since the failure means the copy on screen is stale', async () => {
    post.mockRejectedValue(new ApiError(409, 'INVALID_STATUS', 'Request is not Submitted'));
    renderDetail({ data: requestFixture() });
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    await screen.findByText('Request is not Submitted');
    expect(refetch).toHaveBeenCalled();
  });

  it('shows Edit only to the requester of a Draft', () => {
    renderDetail(
      { data: requestFixture({ status: 'Draft', approverId: undefined }) },
      {
        user: USERS[0],
      },
    );

    expect(screen.getByRole('button', { name: 'Edit' })).toHaveAttribute(
      'href',
      '/requests/REQ-002/edit',
    );
  });

  it('hides Edit from a non-owner, and from the owner once submitted', () => {
    renderDetail({ data: requestFixture({ status: 'Draft' }) });
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();

    renderDetail({ data: requestFixture() }, { user: USERS[0] });
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('waits for the current user before rendering, so gates never run against a null id', () => {
    renderDetail({ data: requestFixture() }, { user: null });
    expect(screen.getByText('Loading request...')).toBeInTheDocument();
  });

  it('shows the error message when the request cannot be loaded', () => {
    renderDetail({ error: new ApiError(404, 'NOT_FOUND', 'Request not found') });
    expect(screen.getByText('Request not found')).toBeInTheDocument();
  });
});
