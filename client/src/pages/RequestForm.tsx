import { useState } from 'react';

import { Link } from 'react-router-dom';

import { ChevronLeft } from 'lucide-react';
import { THOUSAND_DOLLARS_IN_CENTS } from 'shared/constants';
import { dollarsToCents } from 'shared/money';
import { CLIENTS, type Client, EXPENSE_TYPES, type ExpenseType } from 'shared/types';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

type FormValues = {
  expenseType: ExpenseType | null;
  otherReason: string;
  // A dollar string, not cents — the input is the one place dollars exist.
  amount: string;
  additionalJustification: string;
  description: string;
  billable: boolean;
  client: Client | null;
};

const EMPTY_VALUES: FormValues = {
  expenseType: null,
  otherReason: '',
  amount: '',
  additionalJustification: '',
  description: '',
  billable: false,
  client: null,
};

const FIELD_CLASS = 'flex flex-col gap-2';

// dollarsToCents throws on anything half-typed ("12.", "1,"), which must not
// take down a render — an unparseable amount simply hasn't crossed the
// threshold yet.
function amountInCents(amount: string): number | null {
  try {
    return dollarsToCents(amount);
  } catch {
    return null;
  }
}

export default function RequestForm() {
  const [values, setValues] = useState<FormValues>(EMPTY_VALUES);

  function setField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const cents = amountInCents(values.amount);

  // The three conditional rules, mirroring shared/validation.ts's superRefine.
  // Visibility only — the server still enforces each one on submit.
  const showOtherReason = values.expenseType === 'Other';
  const showAdditionalJustification = cents !== null && cents >= THOUSAND_DOLLARS_IN_CENTS;
  const showClient = values.billable;

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-3">
      <Link
        to="/requests"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Back to requests
      </Link>

      <h1 className="text-xl font-semibold">New Expense Request</h1>

      <div className="flex flex-col gap-5 rounded-xl border bg-card p-6">
        <div className={FIELD_CLASS}>
          <Label htmlFor="expenseType">Expense Type</Label>
          <Select
            value={values.expenseType}
            onValueChange={(value) => setField('expenseType', value as ExpenseType | null)}
          >
            <SelectTrigger id="expenseType" className="w-full">
              <SelectValue placeholder="Select type..." />
            </SelectTrigger>
            <SelectContent>
              {EXPENSE_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {showOtherReason && (
          <div className={FIELD_CLASS}>
            <Label htmlFor="otherReason">Other reason</Label>
            <Input
              id="otherReason"
              value={values.otherReason}
              onChange={(event) => setField('otherReason', event.target.value)}
              placeholder="Describe the expense type"
            />
          </div>
        )}

        <div className={FIELD_CLASS}>
          <Label htmlFor="amount">Amount</Label>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">
              $
            </span>
            <Input
              id="amount"
              type="number"
              value={values.amount}
              onChange={(event) => setField('amount', event.target.value)}
              placeholder="0.00"
              inputMode="decimal"
              className="pl-6"
            />
          </div>
        </div>

        {showAdditionalJustification && (
          <div className={FIELD_CLASS}>
            <Label htmlFor="additionalJustification">Extra justification</Label>
            <Textarea
              id="additionalJustification"
              value={values.additionalJustification}
              onChange={(event) => setField('additionalJustification', event.target.value)}
              placeholder="Explain the business need for this expense"
            />
          </div>
        )}

        <div className={FIELD_CLASS}>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={values.description}
            onChange={(event) => setField('description', event.target.value)}
            placeholder="What was this expense for?"
          />
        </div>

        <div className="flex w-fit items-center gap-2.5">
          <Checkbox
            id="billable"
            checked={values.billable}
            onCheckedChange={(checked) => setField('billable', checked)}
          />
          <Label htmlFor="billable">Billable to a client?</Label>
        </div>

        {showClient && (
          <div className={FIELD_CLASS}>
            <Label htmlFor="client">Client</Label>
            <Select
              value={values.client}
              onValueChange={(value) => setField('client', value as Client | null)}
            >
              <SelectTrigger id="client" className="w-full">
                <SelectValue placeholder="Select client..." />
              </SelectTrigger>
              <SelectContent>
                {CLIENTS.map((client) => (
                  <SelectItem key={client} value={client}>
                    {client}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  );
}
