export type User = {
  id: string;
  name: string;
  role: 'employee' | 'manager' | 'finance';
  managerId: string | null;
};

export const EXPENSE_TYPES = ['Travel', 'Software', 'Equipment', 'Meal', 'Other'] as const;
export type ExpenseType = (typeof EXPENSE_TYPES)[number];

export const CLIENTS = ['Acme', 'Globex', 'Initech', 'Contoso'] as const;

export type Client = (typeof CLIENTS)[number];

export const HISTORY_EVENT_TYPES = ['created', 'submitted', 'approved', 'rejected'] as const;

export type HistoryEventType = (typeof HISTORY_EVENT_TYPES)[number];

export const STATUSES = ['Draft', 'Submitted', 'Approved', 'Rejected'] as const;
export type Status = (typeof STATUSES)[number];

export type HistoryEvent =
  | { type: 'created'; at: string; actorId: string }
  | { type: 'submitted'; at: string; actorId: string; approverId: string }
  | { type: 'approved'; at: string; actorId: string }
  | { type: 'rejected'; at: string; actorId: string };

export type RequestValues = {
  expenseType: ExpenseType;
  amountCents: number;
  description: string;
  billable: boolean;
  client?: Client;
  additionalJustification?: string;
  otherReason?: string;
};

export type ExpenseRequest = {
  id: string;
  requesterId: string;
  values: RequestValues;
  events: HistoryEvent[];
};
