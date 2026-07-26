import { MemoryRouter } from 'react-router-dom';

import RequestForm from './RequestForm';
import { CurrentUserProvider } from '@/context/CurrentUser';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

// No route params, so the form is in create mode and useApiQuery gets a null
// path — these tests never reach the network.
function renderForm() {
  render(
    <MemoryRouter>
      <CurrentUserProvider>
        <RequestForm />
      </CurrentUserProvider>
    </MemoryRouter>,
  );
}

// Queried by label, which doubles as the assertion that every control is
// actually bound to its <Label> — a broken htmlFor fails these outright.
const amount = () => screen.getByLabelText('Amount');
const otherReason = () => screen.queryByLabelText('Other reason');
const justification = () => screen.queryByLabelText('Extra justification');
const clientSelect = () => screen.queryByLabelText('Client');

// By role, not label: Base UI pairs the visible checkbox with an aria-hidden
// native input carrying the same id, so a label query matches both. The role
// query skips the hidden one and asserts the accessible name at the same time.
const billableCheckbox = () => screen.getByRole('checkbox', { name: 'Billable to a client?' });

function typeAmount(value: string) {
  fireEvent.change(amount(), { target: { value } });
}

// Base UI commits a selection on the full pointer sequence — a bare click opens
// the popup but never lands on the item, leaving the value unchanged.
function chooseExpenseType(name: string) {
  fireEvent.click(screen.getByLabelText('Expense Type'));
  const option = screen.getByRole('option', { name });
  fireEvent.pointerDown(option);
  fireEvent.pointerUp(option);
  fireEvent.click(option);
}

describe('RequestForm conditional visibility', () => {
  it('hides all three conditional fields on a blank form', () => {
    renderForm();

    expect(otherReason()).not.toBeInTheDocument();
    expect(justification()).not.toBeInTheDocument();
    expect(clientSelect()).not.toBeInTheDocument();
  });

  it('shows the client select only while billable is checked', () => {
    renderForm();

    fireEvent.click(billableCheckbox());
    expect(clientSelect()).toBeInTheDocument();

    fireEvent.click(billableCheckbox());
    expect(clientSelect()).not.toBeInTheDocument();
  });

  // The threshold is >= 100000 cents — guardrail #2 asks for both sides of the
  // boundary explicitly rather than a round number somewhere in the middle.
  it('shows extra justification at exactly $1,000 but not a cent below', () => {
    renderForm();

    typeAmount('999.99');
    expect(justification()).not.toBeInTheDocument();

    typeAmount('1000.00');
    expect(justification()).toBeInTheDocument();
  });

  it('treats an amount dollarsToCents rejects as below the threshold', () => {
    renderForm();

    typeAmount('1500');
    expect(justification()).toBeInTheDocument();

    // Three decimals: the number input accepts it, dollarsToCents throws on it.
    // The guard has to swallow that rather than take the whole render down.
    typeAmount('1500.555');
    expect(justification()).not.toBeInTheDocument();
  });

  it('hides extra justification again when the amount is cleared', () => {
    renderForm();

    typeAmount('2500');
    expect(justification()).toBeInTheDocument();

    typeAmount('');
    expect(justification()).not.toBeInTheDocument();
  });

  it('shows the other-reason field only while expense type is Other', () => {
    renderForm();

    chooseExpenseType('Other');
    expect(otherReason()).toBeInTheDocument();

    chooseExpenseType('Travel');
    expect(otherReason()).not.toBeInTheDocument();
  });

  it('drives each conditional field from its own trigger', () => {
    renderForm();

    typeAmount('2500');
    expect(justification()).toBeInTheDocument();
    expect(otherReason()).not.toBeInTheDocument();
    expect(clientSelect()).not.toBeInTheDocument();

    chooseExpenseType('Other');
    fireEvent.click(billableCheckbox());
    expect(justification()).toBeInTheDocument();
    expect(otherReason()).toBeInTheDocument();
    expect(clientSelect()).toBeInTheDocument();
  });
});
