import { useEffect, useState } from 'react';

import { Link, useNavigate, useParams } from 'react-router-dom';

import { ApiError, type FieldErrors, api } from '@/api/client';
import { useApiQuery } from '@/api/useApiQuery';
import { useCurrentUser } from '@/context/CurrentUser';
import { ChevronLeft } from 'lucide-react';
import { THOUSAND_DOLLARS_IN_CENTS } from 'shared/constants';
import { centsToDollarString, dollarsToCents } from 'shared/money';
import {
  CLIENTS,
  type Client,
  EXPENSE_TYPES,
  type ExpenseRequestResponse,
  type ExpenseType,
  type RequestValues,
} from 'shared/types';
import { requestValuesSchema } from 'shared/validation';

import { Button } from '@/components/ui/button';
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

// Keyed by the RequestValues field the server reports errors against; the value
// is the DOM id to focus. Ordered top-to-bottom so "the first bad field" means
// the first one the user would actually reach.
const FIELD_INPUT_IDS: Array<[keyof RequestValues, string]> = [
  ['expenseType', 'expenseType'],
  ['otherReason', 'otherReason'],
  ['amountCents', 'amount'],
  ['additionalJustification', 'additionalJustification'],
  ['description', 'description'],
  ['billable', 'billable'],
  ['client', 'client'],
];

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

// Derived in one place so the payload can't disagree with what's on screen —
// a hidden field must not be persisted just because its state lingers.
function conditionals(values: FormValues) {
  const cents = amountInCents(values.amount);

  return {
    cents,
    showOtherReason: values.expenseType === 'Other',
    showAdditionalJustification: cents !== null && cents >= THOUSAND_DOLLARS_IN_CENTS,
    showClient: values.billable,
  };
}

// Dollars convert here, so both Save Draft and Submit persist cents. Converting
// only on the submit path would write "45.00" into a field typed
// `amountCents: number` and hand it back wrong on the next load.
function toRequestValues(values: FormValues): Partial<RequestValues> {
  const { cents, showOtherReason, showAdditionalJustification, showClient } = conditionals(values);

  return {
    ...(values.expenseType ? { expenseType: values.expenseType } : {}),
    ...(cents !== null ? { amountCents: cents } : {}),
    description: values.description,
    billable: values.billable,
    ...(showClient && values.client ? { client: values.client } : {}),
    ...(showAdditionalJustification
      ? { additionalJustification: values.additionalJustification }
      : {}),
    ...(showOtherReason ? { otherReason: values.otherReason } : {}),
  };
}

function toFormValues(values: Partial<RequestValues>): FormValues {
  return {
    expenseType: values.expenseType ?? null,
    otherReason: values.otherReason ?? '',
    amount: values.amountCents === undefined ? '' : centsToDollarString(values.amountCents),
    additionalJustification: values.additionalJustification ?? '',
    description: values.description ?? '',
    billable: values.billable ?? false,
    client: values.client ?? null,
  };
}

function focusFirstError(fieldErrors: FieldErrors) {
  const first = FIELD_INPUT_IDS.find(([field]) => fieldErrors[field]?.length);
  if (first) {
    document.getElementById(first[1])?.focus();
  }
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) {
    return null;
  }
  return <p className="text-sm text-destructive">{errors[0]}</p>;
}

export default function RequestForm() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useCurrentUser();

  // Frozen at mount: claiming an id after POST replaces the URL, and this must
  // not turn that into a refetch that clobbers what the user is still typing.
  const [loadId] = useState(routeId ?? null);
  const {
    data: existing,
    loading,
    error: loadError,
  } = useApiQuery<ExpenseRequestResponse>(loadId ? `/requests/${loadId}` : null);

  const [values, setValues] = useState<FormValues>(EMPTY_VALUES);
  const [requestId, setRequestId] = useState<string | null>(routeId ?? null);
  const [hydrated, setHydrated] = useState(!loadId);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (existing && !hydrated) {
      setValues(toFormValues(existing.values));
      setHydrated(true);
    }
  }, [existing, hydrated]);

  // Errors stay hidden until the first submit attempt, then re-run on every
  // change so they clear as the user fixes them. Validating an untouched empty
  // form is noisy and hostile (ADR §9).
  useEffect(() => {
    if (!submitAttempted) {
      return;
    }
    const result = requestValuesSchema.safeParse(toRequestValues(values));
    setFieldErrors(result.success ? {} : result.error.flatten().fieldErrors);
  }, [values, submitAttempted]);

  function setField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const { showOtherReason, showAdditionalJustification, showClient } = conditionals(values);
  const busy = isSubmitting || isSaving;

  // The server can reject a field this form isn't currently showing — a stale
  // client bundle whose rules have since tightened (ADR §11), or any rule the
  // client copy doesn't mirror. Without this, that rejection renders nowhere
  // and the submit just quietly fails.
  const shownErrorFields = new Set([
    'expenseType',
    'amountCents',
    'description',
    ...(showOtherReason ? ['otherReason'] : []),
    ...(showAdditionalJustification ? ['additionalJustification'] : []),
    ...(showClient ? ['client'] : []),
  ]);
  const unshownErrors = Object.entries(fieldErrors)
    .filter(([field, messages]) => messages?.length && !shownErrorFields.has(field))
    .flatMap(([, messages]) => messages ?? []);

  // Claims an id on the first write and holds it for the rest of the session,
  // so a failed submit retries with PATCH instead of creating an orphan draft.
  async function persist(): Promise<string> {
    const body = toRequestValues(values);

    if (requestId) {
      await api.patch(`/requests/${requestId}`, body);
      return requestId;
    }

    const created = await api.post<ExpenseRequestResponse>('/requests', body);
    setRequestId(created.id);
    navigate(`/requests/${created.id}/edit`, { replace: true });
    return created.id;
  }

  function handleWriteError(err: unknown) {
    if (err instanceof ApiError && err.fieldErrors) {
      setFieldErrors(err.fieldErrors);
      focusFirstError(err.fieldErrors);
      return;
    }
    setFormError(err instanceof Error ? err.message : 'Something went wrong');
  }

  // No validation — a draft is allowed to be incomplete (guardrail #6).
  async function handleSaveDraft() {
    setIsSaving(true);
    setFormError(null);
    try {
      await persist();
    } catch (err) {
      handleWriteError(err);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSubmit() {
    setSubmitAttempted(true);
    setFormError(null);

    const result = requestValuesSchema.safeParse(toRequestValues(values));
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      setFieldErrors(errors);
      focusFirstError(errors);
      return; // no API call, and the button stays enabled
    }

    setFieldErrors({});
    setIsSubmitting(true);
    try {
      const id = await persist();
      await api.post(`/requests/${id}/submit`);
      navigate(`/requests/${id}`);
    } catch (err) {
      handleWriteError(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Waits on currentUser too, not just the fetch: it is null until AppHeader
  // hydrates it from /api/users, and running the owner check against an
  // undefined id in that window tells the actual owner they aren't one.
  if (loadId && (loading || !currentUser)) {
    return <p className="text-sm text-muted-foreground">Loading request...</p>;
  }

  if (loadId && loadError) {
    return <p className="text-sm text-destructive">{loadError.message}</p>;
  }

  // Owner-and-Draft is enforced on the server too; this only avoids handing the
  // user a form whose every write would 403 or 409.
  if (existing) {
    const reason =
      existing.requesterId !== currentUser?.id
        ? 'Only the requester can edit this request.'
        : existing.status !== 'Draft'
          ? `A ${existing.status.toLowerCase()} request can no longer be edited.`
          : null;

    if (reason) {
      return (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted-foreground">{reason}</p>
          <Link to={`/requests/${existing.id}`} className="text-sm underline">
            View {existing.id}
          </Link>
        </div>
      );
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-3">
      <Link
        to="/requests"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Back to requests
      </Link>

      <h1 className="text-xl font-semibold">
        {requestId ? 'Edit Expense Request' : 'New Expense Request'}
      </h1>

      <div className="flex flex-col gap-5 rounded-xl border bg-card p-6">
        <div className={FIELD_CLASS}>
          <Label htmlFor="expenseType">Expense Type</Label>
          <Select
            value={values.expenseType}
            onValueChange={(value) => setField('expenseType', value as ExpenseType | null)}
          >
            <SelectTrigger
              id="expenseType"
              className="w-full"
              aria-invalid={!!fieldErrors.expenseType?.length}
            >
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
          <FieldError errors={fieldErrors.expenseType} />
        </div>

        {showOtherReason && (
          <div className={FIELD_CLASS}>
            <Label htmlFor="otherReason">Other reason</Label>
            <Input
              id="otherReason"
              value={values.otherReason}
              onChange={(event) => setField('otherReason', event.target.value)}
              placeholder="Describe the expense type"
              aria-invalid={!!fieldErrors.otherReason?.length}
            />
            <FieldError errors={fieldErrors.otherReason} />
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
              aria-invalid={!!fieldErrors.amountCents?.length}
            />
          </div>
          <FieldError errors={fieldErrors.amountCents} />
        </div>

        {showAdditionalJustification && (
          <div className={FIELD_CLASS}>
            <Label htmlFor="additionalJustification">Extra justification</Label>
            <Textarea
              id="additionalJustification"
              value={values.additionalJustification}
              onChange={(event) => setField('additionalJustification', event.target.value)}
              placeholder="Explain the business need for this expense"
              aria-invalid={!!fieldErrors.additionalJustification?.length}
            />
            <FieldError errors={fieldErrors.additionalJustification} />
          </div>
        )}

        <div className={FIELD_CLASS}>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={values.description}
            onChange={(event) => setField('description', event.target.value)}
            placeholder="What was this expense for?"
            aria-invalid={!!fieldErrors.description?.length}
          />
          <FieldError errors={fieldErrors.description} />
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
              <SelectTrigger
                id="client"
                className="w-full"
                aria-invalid={!!fieldErrors.client?.length}
              >
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
            <FieldError errors={fieldErrors.client} />
          </div>
        )}

        {formError && <p className="text-sm text-destructive">{formError}</p>}
        {unshownErrors.map((message) => (
          <p key={message} className="text-sm text-destructive">
            {message}
          </p>
        ))}

        <div className="flex items-center justify-end gap-2 border-t pt-5">
          <Button variant="outline" onClick={handleSaveDraft} disabled={busy}>
            {isSaving ? 'Saving...' : 'Save Draft'}
          </Button>
          {/* Disabled only while in flight, never for invalidity — a greyed-out
              button explains nothing and hides the server's own validation. */}
          <Button onClick={handleSubmit} disabled={busy}>
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </Button>
        </div>
      </div>
    </div>
  );
}
