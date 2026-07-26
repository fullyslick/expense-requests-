import { MemoryRouter } from 'react-router-dom';

import RequestList from './RequestList';
import { render, screen, within } from '@testing-library/react';
import type { ExpenseRequestResponse } from 'shared/types';
import { describe, expect, it, vi } from 'vitest';

// Stubs the hook rather than fetch: the page's contract is "given this data,
// render these rows", and client.test.ts already covers the fetch layer.
const useApiQuery = vi.hoisted(() => vi.fn());
vi.mock('@/api/useApiQuery', () => ({ useApiQuery }));

function requestFixture(overrides: Partial<ExpenseRequestResponse> = {}): ExpenseRequestResponse {
  return {
    id: 'REQ-001',
    requesterId: 'u_alice',
    requesterName: 'Alice',
    status: 'Draft',
    values: {
      expenseType: 'Travel',
      amountCents: 45000,
      description: 'Customer onsite',
      billable: false,
    },
    events: [{ type: 'created', at: '2026-05-01T09:00:00.000Z', actorId: 'u_alice' }],
    ...overrides,
  };
}

function renderList(result: Partial<ReturnType<typeof useApiQuery>>) {
  useApiQuery.mockReturnValue({ data: null, loading: false, error: null, ...result });
  return render(
    <MemoryRouter>
      <RequestList />
    </MemoryRouter>,
  );
}

describe('RequestList', () => {
  it('renders a row per request with formatted amount, status, requester and date', () => {
    renderList({ data: [requestFixture()] });

    const row = screen.getByRole('row', { name: /REQ-001/ });
    expect(within(row).getByRole('link', { name: 'REQ-001' })).toHaveAttribute(
      'href',
      '/requests/REQ-001',
    );
    expect(within(row).getByText('Travel')).toBeInTheDocument();
    expect(within(row).getByText('$450.00')).toBeInTheDocument();
    expect(within(row).getByText('Draft')).toBeInTheDocument();
    expect(within(row).getByText('Alice')).toBeInTheDocument();
    expect(within(row).getByText('May 1, 2026')).toBeInTheDocument();
  });

  it('renders each derived status', () => {
    renderList({
      data: [
        requestFixture({ id: 'REQ-001', status: 'Draft' }),
        requestFixture({ id: 'REQ-002', status: 'Submitted' }),
        requestFixture({ id: 'REQ-003', status: 'Approved' }),
        requestFixture({ id: 'REQ-004', status: 'Rejected' }),
      ],
    });

    for (const status of ['Draft', 'Submitted', 'Approved', 'Rejected']) {
      expect(screen.getByText(status)).toBeInTheDocument();
    }
    expect(screen.getByText('Showing 4 requests')).toBeInTheDocument();
  });

  it('falls back to a dash for values a draft has not filled in yet', () => {
    renderList({ data: [requestFixture({ values: {}, events: [] })] });

    const row = screen.getByRole('row', { name: /REQ-001/ });
    expect(within(row).getAllByText('—')).toHaveLength(3);
  });

  it('singularises the count for one request', () => {
    renderList({ data: [requestFixture()] });
    expect(screen.getByText('Showing 1 request')).toBeInTheDocument();
  });

  it('shows a loading line while fetching', () => {
    renderList({ loading: true });
    expect(screen.getByText('Loading requests...')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows the error message when the fetch fails', () => {
    renderList({ error: new Error('Something went wrong') });
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('links the New Request button to the create route', () => {
    renderList({ data: [] });
    expect(screen.getByRole('link', { name: /New Request/ })).toHaveAttribute(
      'href',
      '/requests/new',
    );
  });
});
