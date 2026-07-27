import type { HistoryEvent } from 'shared/types';

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const TIME_FORMAT = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
});

export function formatDate(iso: string): string {
  return DATE_FORMAT.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return `${DATE_FORMAT.format(date)} · ${TIME_FORMAT.format(date)}`;
}

export function createdAt(events: HistoryEvent[]): string | null {
  return events.find((event) => event.type === 'created')?.at ?? null;
}
