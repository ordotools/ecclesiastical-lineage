---
name: Unknown ordination before consecration
overview: Frontend validity logic sorts unknown-date events last (t=Infinity), so a valid ordination with unknown date ends up after a dated consecration. Align the frontend with Rule 2 and the backend by sorting unknown-date events earliest so ordination precedes consecration.
todos:
  - id: sort-key-unknown-earliest
    content: In validity-rules.js getOrderSortKey use t = -Infinity when dateUnknown and no year so unknown-date events sort first
    status: completed
  - id: type-order-tiebreak
    content: Keep typeOrder (ordination 0, consecration 1) so same-t events sort ordination before consecration
    status: completed
  - id: optional-event-date-sort
    content: Optional in getEventDateSortValue use -Infinity for unknown for consistency with getOrderSortKey
    status: pending
  - id: verify-tests
    content: Run or update tests (e.g. test_editor_v2_rows_tree, validity-rules) for new sort order
    status: pending
isProject: false
---

# Presume ordination before consecration when date unknown

## Root cause

In [editor_v2/static/v2-scripts/validity-rules.js](editor_v2/static/v2-scripts/validity-rules.js), **unknown-date events are sorted last**:

- `getOrderSortKey()` (lines 281–291): when `dateInfo.dateUnknown` is true and there is no year, it returns `{ t: Infinity, typeOrder }`. So unknown-date events get `t = Infinity` and sort after any known date.
- `buildOrdersFromClergy()` builds the list and sorts by `sortKey.t` then `sortKey.typeOrder`. So with one **ordination (unknown date)** and one **consecration (e.g. 1981)**, the order becomes: consecration first (1981), ordination second (Infinity).
- `canGiveOrdersValidlyInRange()` (lines 115–141) requires at least one prior valid ordination and one prior valid consecration with **firstValidOrdinationIndex < firstValidConsecrationIndex**. With the current sort, that fails (ordination index > consecration index), so every range is invalid.

Backend is already correct: [services/validation_cascade.py](services/validation_cascade.py) `_event_sort_key()` treats `details_unknown` as earliest. [docs/VALIDITY_RULES.md](docs/VALIDITY_RULES.md): "When dates are unknown, assume the bishop received ordination before consecration (Rule 2)."

## Intended behavior

- When date is unknown (no date, or date_unknown and no year), treat the event as **earliest** in the timeline so unknown-date ordination sorts before unknown-date consecration (typeOrder) and before any known-date events.
- Result: after the consecration (known date), the bishop has both a prior valid ordination and a prior valid consecration in the correct order, so "can give orders validly" is true for ranges after the consecration.

## Implementation

**1. Change sort key for unknown dates in `validity-rules.js`**

In `getOrderSortKey(dateInfo, type)` (around 281–291):

- When `dateInfo.dateUnknown` is true and `dateInfo.year` is null/undefined, use `**t = -Infinity**` instead of `Infinity`, so unknown-date events sort **first**.
- Keep existing behavior when `dateInfo.dateUnknown` is true but `dateInfo.year` is set (use year as `t`).
- Keep `typeOrder`: ordination = 0, consecration = 1, so when two events share the same `t`, ordination sorts before consecration.

**2. Optional: align `getEventDateSortValue`** for unknown to use -Infinity for consistency.

**3. No backend or form changes** — backend and form already correct.

## Verification

- Bishop with one ordination (valid, date unknown) and one consecration (valid, known date): sorted orders should be [ordination, consecration]; range index 2 = after consecration = valid.
- Update or confirm tests that depend on sort order for unknown dates.

