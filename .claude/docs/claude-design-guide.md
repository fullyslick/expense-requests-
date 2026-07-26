# Claude Design Guide — Expense Requests UI

Use this to prototype the three core screens (List, Form, Detail) plus the app shell in Claude Design, using the **shadcn base theme**. Each section is copy-paste-ready. Run them as separate Claude Design sessions/screens — don't try to get one giant prompt to do everything.

**What Claude Design is for here:** layout, visual hierarchy, conditional-field UX, status colors, spacing. It should *not* decide business rules — those are already locked in `requirements.md` / `IMPLEMENTATION_PLAN.md`. Treat every prompt below as "make this look right," not "figure out what this should do."

---

## 0. Global brief — paste this first, in every session

Claude Design has no memory of your other sessions, so repeat this context block at the top of each prompt (or paste it once and keep the thread going if your session supports multiple screens).

```
I'm designing an internal expense-request tool. Use the shadcn/ui BASE theme
(neutral grays, not zinc/slate variants) — clean, minimal, admin-dashboard
aesthetic. Internal tool, not consumer-facing: no marketing polish, no
illustrations, no gradients, no dark hero sections.

Constraints:
- Only these shadcn primitives exist: Button, Input, Select, Checkbox,
  Textarea, Label, Table, Badge. Do NOT use a form-builder component or
  react-hook-form styling patterns — every field is hand-wired.
- Lists use a plain HTML <table>, not a data grid — no sorting UI, no
  column resize handles, no pagination controls beyond maybe a simple footer.
- Minimal color palette: neutral grays for structure, four status colors
  only (defined below), one accent color for primary actions.
- Output as a single self-contained HTML file with inline <style> (Tailwind
  utility classes are fine if you use the CDN), so I can screenshot it and
  reference the layout/spacing while I build the real React components.

Status badge colors (use exactly these, don't invent new ones):
- Draft: grey
- Submitted: blue
- Approved: green
- Rejected: red
```

---

## Screen 1 — Request List

```
Design a request list page for the expense tool described above.

Columns: Request ID, Expense Type, Amount (formatted as dollars, e.g.
"$450.00"), Status (as a colored badge), Requester Name, Created Date.

Include:
- A page header: "Expense Requests" with a primary "New Request" button
  top-right.
- A plain table, one row per request, rows look clickable (hover state).
- 4-5 sample rows showing a mix of all four statuses so I can see how the
  badges read next to each other.
- A simple current-user indicator in the top-right corner of the page —
  just a name and role label (e.g. "Alice · Employee"), no avatar needed.
- Empty state text for when there are zero requests (one line, not an
  illustration).

Keep it dense and scannable — this is a tool people check daily, not a
landing page.
```

**Expected artifact:** one HTML file, `list-page.html`. Should render a full page you can screenshot at desktop width (~1200px) and reference for table row height, badge shape, and header layout.

---

## Screen 2 — Request Form (the important one)

This is the screen worth spending the most time on, because the conditional logic is the actual UX challenge. Paste the field table directly — don't paraphrase it.

```
Design a create/edit form for an expense request, using the shadcn primitives
and constraints from before (no form-builder library, no shadcn/form).

Fields and their conditional rules:

| Field | Type | Rule |
|---|---|---|
| Expense type | dropdown (Travel / Software / Equipment / Meal / Other) | required |
| Amount | money input (dollars, e.g. "45.00") | required, can't be negative |
| Description | text | required |
| Billable to a client? | checkbox | — |
| Client | dropdown | appears, and is required, once "Billable" is checked |
| Extra justification | text | appears, and is required, once amount is $1,000 or more |
| Other reason | text | appears, and is required, when Expense type is "Other" |

Design it as an INTERACTIVE HTML mockup (real JS, not just static images) so
I can actually toggle the checkbox and change the dropdown and watch the
conditional fields appear/disappear — I want to feel the transition, not
just see a screenshot of one state.

Requirements:
- Conditional fields should slide/fade in below the field that triggers
  them, not jump the whole layout around.
- Show a subtle helper note near "Extra justification" like
  "Required for amounts $1,000 and over" so the rule is visible before
  it's required.
- Two action buttons at the bottom: "Save Draft" (secondary/outline style)
  and "Submit" (primary). Do NOT grey out Submit based on validity — it
  should always look clickable; validation errors render inline under the
  field instead.
- Show one field with a red inline error message under it (e.g. "Client is
  required") as a static example, so I can see the error state styling.
- A "Cancel" link back to the list, top-left.

Give me three interactive states in the same file if possible (toggle-able
via buttons at the top of the mockup, not separate files): (1) minimal
Travel expense under $1,000, (2) Billable + Other type showing 3 conditional
fields at once, (3) the error state.
```

**Expected artifact:** `request-form.html`, self-contained with inline `<script>` — this is the one place it's worth asking for working interactivity instead of a static mockup, since the whole point is seeing the conditional-field behavior.

---

## Screen 3 — Request Detail / History

```
Design a detail page for a single expense request, using the same theme
and primitives.

Layout:
- Header: Request ID + status badge, large and clear.
- A two-column or stacked field summary: expense type, amount, description,
  billable/client if applicable, extra justification if applicable —
  labeled clearly, read-only styling (not form inputs).
- "Assigned approver: [Name]" shown only when status is Submitted.
- A vertical history timeline below the fields: each entry shows an icon
  or dot, the action ("Created", "Submitted", "Approved", "Rejected"), the
  actor's name, and a timestamp. Style it like a simple activity log, not
  a fancy stepper — connecting line between entries is enough.
- Action buttons area, top-right, conditionally shown (mock BOTH states in
  the same file with a toggle):
  (a) Approve / Reject buttons (green/red, side by side) — for when the
      viewer is the assigned approver and status is Submitted
  (b) Edit button — for when the viewer is the requester and status is Draft
  (c) neither — for a read-only viewer, just show the fields and history
      with no action buttons at all

Same dense, internal-tool feel as the list page — no card shadows or
excessive whitespace.
```

**Expected artifact:** `request-detail.html`, with the toggle for the three viewer states so you can see all permission-based button combinations without regenerating.

---

## Optional — App Shell / Header

Only bother with this if you want the user-switcher to look right, since it appears on every page.

```
Design just the app header/navbar for the expense tool: app name on the
left, and on the right a dropdown showing the current user's name and role
(e.g. "Carol · Manager") with a chevron, that expands to show 6 sample
users to switch between (Alice-Employee, Bob-Employee, Carol-Manager,
Mallory-Manager, Peggy-Manager, Trent-Finance). Same shadcn base theme,
minimal.
```

**Expected artifact:** `app-header.html` — small, just for spacing/dropdown reference.

---

## Exporting into your actual codebase

Claude Design's HTML output is a **layout and spacing reference**, not code you paste in directly — your real components need to be actual shadcn primitives wired to React state and your Zod schema. When translating:

| In the mockup | Becomes in your code |
|---|---|
| `<select>` styled as shadcn | `<Select>` from `@/components/ui/select` |
| Checkbox | `<Checkbox>` from `@/components/ui/checkbox`, controlled by `useState` |
| Conditional field show/hide via JS | `{billable && <ClientField />}` — plain React conditional rendering |
| Status badge colors | `<Badge>` with a `variant` or className map keyed by status string |
| Table | shadcn `<Table>` primitives — `TableHeader`, `TableRow`, `TableCell` |
| The interactive form JS | Discard entirely — replace with your actual `useState` + submit handler per Phase 12 of the implementation plan |

Use the mockup for: spacing scale, badge shapes/colors, how conditional fields animate in, error message placement, timeline styling. Don't use it for: any actual validation logic, the button-disabled behavior (your spec in the ADR §9 is deliberately different from most default form UX — button stays enabled, errors render inline), or state management.

---

## What NOT to ask Claude Design for

- Business rules, the approver-routing logic, or anything from `pickApprover()` — that's pure backend logic, not UI.
- A form-builder pattern or anything that auto-generates fields from a schema — the assignment forbids that, and it'd fight your hand-wired `useState` approach anyway.
- Data-grid features (sort, filter UI, pagination) unless you're doing the search/filter stretch goal.
- Auth/login screens — you're using a header user-switcher, not a login flow.
