import { CLIENTS, EXPENSE_TYPES } from './types';
import { z } from 'zod';

const THOUSAND_DOLLARS_IN_CENTS = 100000;

const baseRequestValuesSchema = z.object({
  expenseType: z.enum(EXPENSE_TYPES),
  amountCents: z.number().int().gte(0),
  description: z.string().min(1, 'Description is required'),
  billable: z.boolean().default(false),
  client: z.enum(CLIENTS).optional(),
  additionalJustification: z.string().optional(),
  otherReason: z.string().optional(),
});

export const requestValuesSchema = baseRequestValuesSchema.superRefine((values, ctx) => {
  if (values.billable && !values.client) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['client'],
      message: 'Client is required for billable expenses',
    });
  }

  if (values.amountCents >= THOUSAND_DOLLARS_IN_CENTS && !values.additionalJustification?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['additionalJustification'],
      message: 'Additional justification is required for amounts of $1,000 or more',
    });
  }

  if (values.expenseType === 'Other' && !values.otherReason?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['otherReason'],
      message: 'A reason is required when expense type is Other',
    });
  }
});
