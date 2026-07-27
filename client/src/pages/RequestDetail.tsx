import { useState } from 'react';

import { Link, useParams } from 'react-router-dom';

import { api } from '@/api/client';
import { useApiQuery } from '@/api/useApiQuery';
import { useCurrentUser } from '@/context/CurrentUser';
import { createdAt, formatDate, formatDateTime } from '@/lib/format';
import { ChevronLeft } from 'lucide-react';
import { centsToDisplay } from 'shared/money';
import type { ExpenseRequestResponse, HistoryEvent, HistoryEventType, User } from 'shared/types';

import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';

const EMPTY = '—';

const EVENT_LABELS: Record<HistoryEventType, string> = {
  created: 'Created',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
};

const EVENT_DOTS: Record<HistoryEventType, string> = {
  created: 'bg-neutral-400',
  submitted: 'bg-blue-500',
  approved: 'bg-green-600',
  rejected: 'bg-red-600',
};

function Detail({
  label,
  wide = false,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={wide ? 'col-span-2' : undefined}>
      <dt className="text-[11.5px] font-medium tracking-[0.03em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-sm">{children}</dd>
    </div>
  );
}

function HistoryTimeline({
  events,
  nameOf,
}: {
  events: HistoryEvent[];
  nameOf: (id: string) => string;
}) {
  return (
    <ol>
      {events.map((event, index) => (
        <li key={`${event.type}-${event.at}`} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className={`mt-1 size-2.5 shrink-0 rounded-full ${EVENT_DOTS[event.type]}`} />
            <span
              className={`mt-0.5 w-px flex-1 ${index === events.length - 1 ? 'bg-transparent' : 'bg-border'}`}
            />
          </div>
          <div className="pb-5">
            <p className="text-sm">
              <span className="font-medium">{EVENT_LABELS[event.type]}</span> by{' '}
              {nameOf(event.actorId)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(event.at)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function RequestDetail() {
  const { id } = useParams();
  const { currentUser } = useCurrentUser();

  const { data, error, refetch } = useApiQuery<ExpenseRequestResponse>(`/requests/${id}`);
  const { data: users } = useApiQuery<User[]>('/users');

  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Mirrors decide(actor, id, ...) in the service layer: the two calls differ
  // only in the path.
  async function decide(action: 'approve' | 'reject') {
    setActing(true);
    setActionError(null);
    try {
      await api.post(`/requests/${id}/${action}`);
      refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setActing(false);
    }
  }

  // Keyed on `data`, not `loading`: refetch() after a decision must let the
  // history grow in place rather than blanking the page back to a spinner.
  // currentUser is null until AppHeader hydrates it, and deciding the button
  // gates against an undefined id hides them from the person they belong to.
  if (!data || !currentUser) {
    return error ? (
      <p className="text-sm text-destructive">{error.message}</p>
    ) : (
      <p className="text-sm text-muted-foreground">Loading request...</p>
    );
  }

  const nameOf = (userId: string) => users?.find((user) => user.id === userId)?.name ?? userId;

  const created = createdAt(data.events);
  const canDecide = data.status === 'Submitted' && currentUser.id === data.approverId;
  const canEdit = data.status === 'Draft' && currentUser.id === data.requesterId;

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5">
      <Link
        to="/requests"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Back to requests
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tabular-nums">{data.id}</h1>
          <StatusBadge status={data.status} />
        </div>

        {canDecide && (
          <div className="flex gap-2">
            <Button
              className="rounded-sm bg-green-600 px-4 text-white hover:bg-green-700"
              onClick={() => decide('approve')}
              disabled={acting}
            >
              Approve
            </Button>
            <Button
              variant="outline"
              className="rounded-sm border-red-600 px-4 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => decide('reject')}
              disabled={acting}
            >
              Reject
            </Button>
          </div>
        )}

        {canEdit && (
          <Button
            variant="outline"
            className="rounded-sm px-4"
            render={<Link to={`/requests/${data.id}/edit`} />}
            nativeButton={false}
          >
            Edit
          </Button>
        )}
      </div>

      {actionError && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {actionError}
        </p>
      )}

      <div className="rounded-lg border bg-card p-6">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5">
          <Detail label="Expense Type">{data.values.expenseType ?? EMPTY}</Detail>
          <Detail label="Amount">
            <span className="font-medium tabular-nums">
              {data.values.amountCents === undefined
                ? EMPTY
                : centsToDisplay(data.values.amountCents)}
            </span>
          </Detail>
          <Detail label="Requester">{data.requesterName}</Detail>
          <Detail label="Created">
            <span className="tabular-nums">{created ? formatDate(created) : EMPTY}</span>
          </Detail>

          {data.values.billable && <Detail label="Client">{data.values.client ?? EMPTY}</Detail>}

          {data.status === 'Submitted' && data.approverId && (
            <Detail label="Assigned Approver">{nameOf(data.approverId)}</Detail>
          )}

          {data.values.otherReason && (
            <Detail label="Other Reason" wide>
              {data.values.otherReason}
            </Detail>
          )}

          <Detail label="Description" wide>
            <span className="leading-relaxed text-neutral-700">{data.values.description || EMPTY}</span>
          </Detail>

          {data.values.additionalJustification && (
            <Detail label="Extra Justification" wide>
              <span className="leading-relaxed text-neutral-700">{data.values.additionalJustification}</span>
            </Detail>
          )}
        </dl>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-sm font-semibold">History</h2>
        <HistoryTimeline events={data.events} nameOf={nameOf} />
      </div>
    </div>
  );
}
