import { deriveStatus, getApproverId } from '../logic/deriveStatus';
import type { HistoryEvent } from 'shared/types';

const createdEvent: HistoryEvent = {
  type: 'created',
  at: '2026-01-01T00:00:00.000Z',
  actorId: 'u_alice',
};
const submittedEvent: HistoryEvent = {
  type: 'submitted',
  at: '2026-01-02T00:00:00.000Z',
  actorId: 'u_alice',
  approverId: 'u_carol',
};
const approvedEvent: HistoryEvent = {
  type: 'approved',
  at: '2026-01-03T00:00:00.000Z',
  actorId: 'u_carol',
};
const rejectedEvent: HistoryEvent = {
  type: 'rejected',
  at: '2026-01-03T00:00:00.000Z',
  actorId: 'u_carol',
};

describe('deriveStatus', () => {
  it('maps a solo created event to Draft', () => {
    expect(deriveStatus([createdEvent])).toBe('Draft');
  });

  it('maps a solo submitted event to Submitted', () => {
    expect(deriveStatus([submittedEvent])).toBe('Submitted');
  });

  it('maps a solo approved event to Approved', () => {
    expect(deriveStatus([approvedEvent])).toBe('Approved');
  });

  it('maps a solo rejected event to Rejected', () => {
    expect(deriveStatus([rejectedEvent])).toBe('Rejected');
  });

  it('uses the last event when multiple events are in order', () => {
    expect(deriveStatus([createdEvent, submittedEvent, approvedEvent])).toBe('Approved');
  });

  it('reflects a submitted-then-rejected sequence as Rejected', () => {
    expect(deriveStatus([createdEvent, submittedEvent, rejectedEvent])).toBe('Rejected');
  });

  it('defaults to Draft for an empty event array', () => {
    expect(deriveStatus([])).toBe('Draft');
  });
});

describe('getApproverId', () => {
  it('returns undefined when there is no submitted event', () => {
    expect(getApproverId([createdEvent])).toBeUndefined();
  });

  it('returns undefined for an empty event array', () => {
    expect(getApproverId([])).toBeUndefined();
  });

  it('returns the approverId from the most recent submitted event', () => {
    expect(getApproverId([createdEvent, submittedEvent])).toBe('u_carol');
  });

  it('still returns the approver after approval or rejection', () => {
    expect(getApproverId([createdEvent, submittedEvent, approvedEvent])).toBe('u_carol');
    expect(getApproverId([createdEvent, submittedEvent, rejectedEvent])).toBe('u_carol');
  });

  it('picks the latest submitted event when there are several (e.g. resubmit)', () => {
    const secondSubmit: HistoryEvent = {
      type: 'submitted',
      at: '2026-01-04T00:00:00.000Z',
      actorId: 'u_alice',
      approverId: 'u_trent',
    };
    expect(getApproverId([createdEvent, submittedEvent, rejectedEvent, secondSubmit])).toBe(
      'u_trent',
    );
  });
});
