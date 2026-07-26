import { Link, useNavigate } from 'react-router-dom';

import { useApiQuery } from '@/api/useApiQuery';
import { createdAt, formatDate } from '@/lib/format';
import { Plus } from 'lucide-react';
import { centsToDisplay } from 'shared/money';
import type { ExpenseRequestResponse } from 'shared/types';

import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const EMPTY = '—';

export default function RequestList() {
  const { data, loading, error } = useApiQuery<ExpenseRequestResponse[]>('/requests');
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-end">
        {/* The mockup shows no visible page title, but the route still needs a
            heading to be navigable by screen reader. */}
        <h1 className="sr-only">Requests</h1>
        <Button className="rounded-sm" render={<Link to="/requests/new" />} nativeButton={false}>
          <Plus />
          New Request
        </Button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading requests...</p>}
      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {data && (
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow className="[&>th]:h-11 [&>th]:text-xs [&>th]:font-medium [&>th]:tracking-wider [&>th]:uppercase [&>th]:text-muted-foreground">
                <TableHead className="pl-4">Request ID</TableHead>
                <TableHead>Expense Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Requester</TableHead>
                <TableHead className="pr-4">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No requests yet.
                  </TableCell>
                </TableRow>
              )}
              {data.map((request) => {
                const created = createdAt(request.events);
                return (
                  <TableRow
                    key={request.id}
                    // The anchor in the ID cell is what makes a row reachable by
                    // keyboard; this handler only widens the click target.
                    onClick={() => navigate(`/requests/${request.id}`)}
                    className="cursor-pointer [&>td]:py-3"
                  >
                    <TableCell className="pl-4 font-medium">
                      <Link to={`/requests/${request.id}`} className="hover:underline">
                        {request.id}
                      </Link>
                    </TableCell>
                    <TableCell>{request.values.expenseType ?? EMPTY}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {request.values.amountCents === undefined
                        ? EMPTY
                        : centsToDisplay(request.values.amountCents)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={request.status} />
                    </TableCell>
                    <TableCell>{request.requesterName}</TableCell>
                    <TableCell className="pr-4 text-muted-foreground">
                      {created ? formatDate(created) : EMPTY}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {data && data.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Showing {data.length} {data.length === 1 ? 'request' : 'requests'}
        </p>
      )}
    </div>
  );
}
