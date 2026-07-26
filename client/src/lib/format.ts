import type { HistoryEvent } from 'shared/types';

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

export function formatDate(iso: string): string {
  return DATE_FORMAT.format(new Date(iso));
}

export function createdAt(events: HistoryEvent[]): string | null {
  return events.find((event) => event.type === 'created')?.at ?? null;
}
