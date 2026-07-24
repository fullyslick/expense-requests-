import type { HistoryEvent, Status } from 'shared/types';

const STATUS_BY_EVENT_TYPE: Record<HistoryEvent['type'], Status> = {
  created: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
};

export function deriveStatus(events: HistoryEvent[]): Status {
  const lastEvent = events[events.length - 1];
  // No events shouldn't happen in practice (createDraft always appends one),
  // but a fresh request is a Draft by definition, so default rather than throw.
  if (!lastEvent) {
    return 'Draft';
  }
  return STATUS_BY_EVENT_TYPE[lastEvent.type];
}

export function getApproverId(events: HistoryEvent[]): string | undefined {
  // A rejected request can be fixed and resubmitted (stretch goal), which appends a
  // second 'submitted' event to the same history — e.g. [created, submitted, rejected,
  // submitted]. The approver may differ between the two (amount could have changed,
  // changing the routing), so we need the *latest* one, not just any one. Scanning
  // from the end and returning on the first match gives us that without extra state.
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (event.type === 'submitted') {
      return event.approverId;
    }
  }
  return undefined;
}
