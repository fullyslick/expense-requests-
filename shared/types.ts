export const USER_ROLES = ['employee', 'manager', 'finance'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export type User = {
  id: string;
  name: string;
  role: UserRole;
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
  // Partial, not RequestValues: a Draft is legally incomplete (guardrail #6 —
  // "Drafts skip validation. Submit runs it."). The full RequestValues shape
  // is only guaranteed once shared/validation.ts's requestValuesSchema has
  // accepted it, at submit time.
  values: Partial<RequestValues>;
  events: HistoryEvent[];
};
