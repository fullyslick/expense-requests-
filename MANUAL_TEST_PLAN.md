# Manual Test Plan — Expense Requests

Run order matters within a section, not across sections. **The store is in-memory and mutable** — several tests permanently change seed rows. Restart the server (`npm run dev:server`) whenever a step says *reset*, or whenever a result looks wrong for a seed row you touched earlier.

---

## 0. Pre-flight

| Check | Expected |
|---|---|
| `npm test` from root | all green, count noted in NOTES.md |
| `npm run dev:server` | listening on `:4000` |
| `npm run dev:client` | serving on `:5173` |
| Open `/requests` | 4 rows render |

### Cast

| User | id | role | manager |
|---|---|---|---|
| Alice | `u_alice` | employee | Carol |
| Bob | `u_bob` | employee | Mallory |
| Carol | `u_carol` | manager | Peggy |
| Mallory | `u_mallory` | manager | Peggy |
| Peggy | `u_peggy` | manager | — (null) |
| Trent | `u_trent` | finance | Peggy |

### Seed baseline (assert this after every restart)

| ID | Requester | Amount | Status | Approver |
|---|---|---|---|---|
| REQ-001 | Alice | $450.00 | Draft | — |
| REQ-002 | Alice | $42.00 | Submitted | Carol |
| REQ-003 | Bob | $1,250.00 | Approved | Trent |
| REQ-004 | Mallory | $600.00 | Draft | — |

If REQ-001 shows `$45000` or `$4.50`, the cents formatter is wrong — stop and fix before continuing.

---

## 1. List page

1. Load `/requests` as Alice. → Four rows, IDs/type/amount/status/requester/created all populated.
2. Check badge colours: REQ-001 grey, REQ-002 blue, REQ-003 green.
3. Click a row. → Navigates to `/requests/REQ-001`; browser Back returns to the list.
4. Click **New Expense Request**. → `/requests/new`, empty form.
5. Switch user in the header to Carol. → Same four rows (everyone sees everything); header shows **Carol · manager**.
6. Hard-refresh. → Still Carol (localStorage persisted).

---

## 2. Conditional fields (client-side visibility)

On `/requests/new`, with nothing else filled:

| Action | Expected |
|---|---|
| Check **Billable to a client?** | Client select appears |
| Uncheck it | Client select disappears |
| Type amount `999.99` | No Extra justification field |
| Change amount to `1000` | Extra justification appears |
| Change amount to `1000.00` | Still visible (string→cents parses to 100000) |
| Back to `999` | Field disappears |
| Set Expense type = **Other** | Other reason appears |
| Set Expense type = **Travel** | Other reason disappears |
| Check billable **and** amount `1500` **and** type Other | All three conditionals visible at once |

**Boundary is `>= 100000` cents.** Test `999.99` and `1000.00` explicitly, not `900` and `2000`.

---

## 3. Draft save (no validation)

1. As Alice on `/requests/new`, fill **only** Description = `partial draft`. Click **Save Draft**.
   - → Succeeds. No validation errors. URL replaces to `/requests/REQ-005` (or next id).
2. Go to the list. → New row, status **Draft**, requester Alice.
3. Open it, click **Edit**, set Amount = `45.00`, Save Draft.
4. Reload the page. → Amount shows `$45.00`, **not** `$0.45` and not `45.00` raw.
   - *This is the dollars→cents-on-every-write check. A regression here shows up only after reload.*
5. Edit again, change **only** the Description. Save. → Amount still `$45.00` (partial merge, not overwrite).

---

## 4. Submit validation (server is authoritative)

Create a fresh draft as Alice for each case below (or reuse one, editing between attempts).

| Set up | Click Submit | Expected |
|---|---|---|
| Everything empty | Submit | Inline errors on Expense type, Amount, Description. **No network call** (check DevTools Network tab). |
| Type=Travel, Amount=`50`, Description=`x`, Billable checked, Client empty | Submit | Error on Client field |
| Type=Travel, Amount=`1200`, Description=`x`, no justification | Submit | Error on Extra justification |
| Type=Other, Amount=`50`, Description=`x`, no Other reason | Submit | Error on Other reason |
| Amount = `-5` | Submit | Amount error, no request sent |
| Amount = `abc` | Submit | Amount error, no `NaN` reaches the server |

6. Fix the last error and Submit. → Errors clear **as you type** (re-validate on change after first attempt), button never permanently disabled.
7. During the in-flight submit, the button is disabled; afterward it re-enables.

### 4b. The orphan-draft check (Phase 12's "not optional" case)

1. Restart server. Note the list has 4 rows.
2. As Alice, `/requests/new` → fill a **valid** form, then temporarily break it server-side-only: fill everything valid, click Submit, and force a 400 by checking Billable and picking a client, then clearing the client *after* the first POST if the UI allows it. Simpler reliable version: submit once with a deliberately invalid field so the server 400s (bypass the client check by editing the value in DevTools if the client blocks it).
3. Fix the field, Submit again. → Success.
4. Return to the list. → Exactly **one** new request exists, not two.

---

## 5. Approver routing — every branch

For each row: create a draft as the given user with the given amount, satisfy all conditional fields, Submit, then open the detail page and read **Assigned Approver**.

| # | Submit as | Amount | Expected approver | Why |
|---|---|---|---|---|
| 1 | Alice | $450.00 | **Carol** | under $1,000 → manager |
| 2 | Alice | $999.99 | **Carol** | boundary, still manager |
| 3 | Alice | $1,000.00 | **Trent** | boundary, ≥ $1,000 → finance |
| 4 | Bob | $1,250.00 | **Trent** | finance |
| 5 | Bob | $600.00 | **Mallory** | manager |
| 6 | Mallory | $600.00 | **Peggy** | a manager routes to *her* manager, never herself |
| 7 | Peggy | $500.00 | **Trent** | `managerId: null` → falls back to finance |
| 8 | Trent | $500.00 | **Peggy** | finance user under threshold → his own manager |
| 9 | **Trent** | **$1,500.00** | **refused** | finance would be himself → `NO_ELIGIBLE_APPROVER` |

Case 9 must show a **banner error**, not field errors, and the request must stay a **Draft** (reload the detail page to confirm the status didn't change and no `submitted` event was appended).

Cases 3 and 9 both need Extra justification filled, or you'll get a validation error instead of the routing result you're testing.

---

## 6. Permissions in the UI

Restart server first so REQ-002 is Submitted again.

| Step | Expected |
|---|---|
| Open REQ-002 as **Alice** (requester) | No Approve/Reject. No Edit (it's Submitted, not Draft). |
| Switch header to **Bob** | Still no buttons — read-only view |
| Switch to **Carol** (assigned approver) | Approve **and** Reject appear, in place, without navigating |
| Switch back to Alice | Buttons disappear again |
| Open REQ-001 as Alice | **Edit** visible (owner + Draft) |
| Open REQ-001 as Bob | No Edit |
| Open REQ-004 (Mallory's) as Mallory | Edit visible |
| Open REQ-003 (Approved) as Trent | No Approve/Reject — already decided |

---

## 7. Approve / reject and history

1. Open REQ-002 as Carol. Click **Approve**.
   - → Status flips to **Approved** in place. History gains a third entry: *Approved by Carol*, with a timestamp. No full page reload needed (`refetch`).
   - → Both buttons disabled while in flight.
2. Reload. → Still Approved; history has 3 entries: created (Alice), submitted (Alice), approved (Carol).
3. Every history entry shows a **name**, not a raw `u_carol` id, and a readable timestamp.
4. Restart server. Open REQ-002 as Carol, click **Reject**.
   - → Status **Rejected**, red badge, history shows *Rejected by Carol*.
5. As Alice, open the rejected REQ-002. → No Edit button (Rejected is final in core scope).

---

## 8. User switching / stale data

1. Open a detail page. Switch users rapidly: Alice → Carol → Alice → Bob.
2. → Header label and the action buttons always agree with each other. Nothing flickers to a previous user's view, and the buttons never end up showing Carol's Approve while the header says Alice.
   - *This is the manual stand-in for the `AbortController` test.*
3. Switch users while on the list page. → List refetches (watch the Network tab: a new `GET /api/requests` with the new `X-User-Id`).
4. Refresh mid-session. → Selected user survives.

---

## 9. Hostile curl — requirement 5

The UI can't reach these. Run them against a **freshly restarted** server. Base: `http://localhost:4000`.

```bash
H_ALICE='X-User-Id: u_alice'
H_BOB='X-User-Id: u_bob'
H_CAROL='X-User-Id: u_carol'
```

| # | Command | Expected |
|---|---|---|
| 1 | `curl -i localhost:4000/api/requests` (no header) | **401** `UNAUTHORIZED` |
| 2 | `curl -i -H 'X-User-Id: u_nobody' localhost:4000/api/requests` | **401** |
| 3 | `curl -i -H "$H_ALICE" localhost:4000/api/requests/REQ-999` | **404** `NOT_FOUND` |
| 4 | `curl -i -H "$H_BOB" -X PATCH -H 'Content-Type: application/json' -d '{"description":"hi"}' localhost:4000/api/requests/REQ-001` | **403** `FORBIDDEN` (Bob editing Alice's draft) |
| 5 | `curl -i -H "$H_ALICE" -X PATCH -H 'Content-Type: application/json' -d '{"description":"hi"}' localhost:4000/api/requests/REQ-002` | **409** `INVALID_TRANSITION` (Submitted, not Draft) |
| 6 | `curl -i -H "$H_BOB" -X POST localhost:4000/api/requests/REQ-001/submit` | **403** |
| 7 | `curl -i -H "$H_ALICE" -X POST localhost:4000/api/requests/REQ-002/submit` | **409** (already Submitted) |
| 8 | `curl -i -H "$H_BOB" -X POST localhost:4000/api/requests/REQ-002/approve` | **403** (not the assigned approver) |
| 9 | `curl -i -H "$H_ALICE" -X POST localhost:4000/api/requests/REQ-002/approve` | **403** (requester ≠ approver — self-approval blocked) |
| 10 | `curl -i -H "$H_CAROL" -X POST localhost:4000/api/requests/REQ-003/approve` | **409** (already Approved) |

### Mass assignment (guardrail #4)

```bash
curl -i -H "$H_ALICE" -H 'Content-Type: application/json' -X POST \
  -d '{"requesterId":"u_bob","approverId":"u_trent","status":"Approved",
       "expenseType":"Travel","amountCents":100,"description":"x"}' \
  localhost:4000/api/requests
```
→ 200/201 with `requesterId: "u_alice"`, `status: "Draft"`, `approverId` absent/null. The three injected fields took no effect.

Repeat the same body as a `PATCH` on the returned id → same result.

### Validation shape (feeds the form)

```bash
# create a billable draft with no client, then submit
curl -s -H "$H_ALICE" -H 'Content-Type: application/json' -X POST \
  -d '{"expenseType":"Travel","amountCents":5000,"description":"x","billable":true}' \
  localhost:4000/api/requests
curl -i -H "$H_ALICE" -X POST localhost:4000/api/requests/<newId>/submit
```
→ **400** `VALIDATION_FAILED` with `fieldErrors.client` present, keyed by the exact field name the form uses.

### Routing refusal

```bash
curl -s -H 'X-User-Id: u_trent' -H 'Content-Type: application/json' -X POST \
  -d '{"expenseType":"Software","amountCents":150000,"description":"x",
       "additionalJustification":"y"}' localhost:4000/api/requests
curl -i -H 'X-User-Id: u_trent' -X POST localhost:4000/api/requests/<newId>/submit
```
→ **400** `NO_ELIGIBLE_APPROVER`, and a follow-up `GET` on that id still shows `Draft` with one event.

---

## 10. Data-integrity sweep

After a full lifecycle (create → patch → submit → approve) on one request:

- `events.length` grew 1 → 1 → 2 → 3.
- Every event carries a real `actorId` and an ISO `at`.
- `status` in the response is never a stored field you set — grep the codebase: no `status:` assignment outside `deriveStatus`.
- The seed files in `server/data/` are byte-identical to git HEAD (`git status` clean). Nothing writes back to disk.

---

## 11. Known state resets

Restart the server before: §5 (needs clean drafts), §6, §7, §9. Note in NOTES.md that a restart resets to the four seed records — that's the intended tradeoff, not a bug.

---

## Gaps this plan deliberately doesn't cover

- **Concurrency.** Two simultaneous approvals on one request. The in-memory store isn't safe against it; single-user demo makes it moot. Name it as a known limitation rather than testing it.
- **Resubmit, comments, search.** Stretch goals only — add sections here if you build them.
- **Visual regression / a11y.** Out of scope for minimal styling.
