---
name: Details unknown validation semantics
overview: Adjust validation and cascade so "details unknown" events are presumed valid, ordination-before-consecration is assumed, and children of such parents are valid unless individually stated otherwise; document in validation cascade and VALIDITY_RULES.
todos:
  - id: cascade-event-sort-key
    content: In validation_cascade.py, make _event_sort_key return (date.min, True) for details_unknown with no date/year so bishop events count as before child events
    status: completed
  - id: cascade-doc-note
    content: Add docstring/comment in validation_cascade.py on details-unknown presumption (valid, ordination before consecration, children valid unless stated otherwise)
    status: completed
  - id: doc-validity-rules
    content: Add subsection "Details unknown (reliable data presumption)" to docs/VALIDITY_RULES.md with the four semantics
    status: completed
  - id: doc-form-fields
    content: Optional one-line note in docs/CLERGY_FORM_FIELDS.md on cascade/validity for details_unknown
    status: completed
  - id: frontend-get-date
    content: In editor-ranges-validity.js, have getDateFromRecord expose details-unknown-with-no-date so it can be treated as earliest
    status: completed
  - id: frontend-sort-key
    content: In editor-ranges-validity.js, getOrderSortKey and getEventDateSortValue treat details-unknown no-date as earliest (ordination before consecration)
    status: completed
  - id: frontend-boundaries
    content: In editor-ranges-validity.js, ensure range boundaries place details-unknown events in first range so canValidlyOrdain/Consecrate match backend
    status: completed
  - id: optional-panel-note
    content: Optional add short note in right panel when parent has details_unknown (panel_right or right-panel JS)
    status: completed
isProject: false
---

# Details unknown validation semantics

## To-dos

- **cascade-event-sort-key**: In `services/validation_cascade.py`, make `_event_sort_key` return `(date.min, True)` for records with `details_unknown=True` and no date/year so bishop events count as "before" child events.
- **cascade-doc-note**: Add docstring/comment in `validation_cascade.py` on details-unknown presumption (valid, ordination before consecration, children valid unless stated otherwise).
- **doc-validity-rules**: Add subsection "Details unknown (reliable data presumption)" to `docs/VALIDITY_RULES.md` with the four semantics.
- **doc-form-fields**: Optional one-line note in `docs/CLERGY_FORM_FIELDS.md` on cascade/validity for details_unknown.
- **frontend-get-date**: In `static/js/editor-ranges-validity.js`, have `getDateFromRecord` expose details-unknown-with-no-date so it can be treated as earliest.
- **frontend-sort-key**: In `editor-ranges-validity.js`, `getOrderSortKey` and `getEventDateSortValue` treat details-unknown no-date as earliest (ordination before consecration).
- **frontend-boundaries**: In `editor-ranges-validity.js`, ensure range boundaries place details-unknown events in first range so `canValidlyOrdain`/`canValidlyConsecrate` match backend.
- **optional-panel-note**: Optional: add short note in right panel when parent has details_unknown (panel_right or right-panel JS).

## Current behavior (problem)

- In [services/validation_cascade.py](services/validation_cascade.py), `_event_sort_key(record)` returns `(None, False)` when a record has no `date` and no `year`. It does **not** consider `details_unknown`.
- `_strictly_before(sort_key, event_date_key)` then treats "unknown" bishop events as **not** before the child's event (`known=False` → returns False). So a bishop who only has details-unknown ordination/consecration is treated as having no valid ordination/consecration "before" giving orders, and their descendants get downgraded.
- Frontend [static/js/editor-ranges-validity.js](static/js/editor-ranges-validity.js): `getDateFromRecord` does not use `details_unknown`; when there is no date/year, `getOrderSortKey` uses `t: Infinity`, so those events sort last.

## Target semantics (reliable-data presumption)

1. **Valid unless stated otherwise** — Events with `details_unknown=True` keep default effective status (valid when no invalid/doubtful flags set).
2. **Ordination before consecration** — When dates are unknown, assume the bishop received ordination before consecration (Rule 2).
3. **Children always valid unless stated otherwise** — When the bishop has only details-unknown events (or they count as "before" the child), descendant events get `new_validity='valid'` unless explicitly marked otherwise.
4. **Children's orders after parent's unknown consecration** — Treat a bishop's details-unknown event as occurring "before" any child event in cascade logic.

## Implementation summary

- **Backend**: `_event_sort_key` return `(date.min, True)` for details_unknown + no date/year; add doc note in [services/validation_cascade.py](services/validation_cascade.py).
- **Frontend**: [static/js/editor-ranges-validity.js](static/js/editor-ranges-validity.js) — `getDateFromRecord`, `getOrderSortKey`, `getEventDateSortValue` (and boundary logic) so details_unknown = earliest, ordination before consecration.
- **Docs**: [docs/VALIDITY_RULES.md](docs/VALIDITY_RULES.md) new subsection; optionally [docs/CLERGY_FORM_FIELDS.md](docs/CLERGY_FORM_FIELDS.md).
- **Optional**: Note in right panel when parent has details_unknown ([editor_v2/templates/editor_v2/snippets/panel_right.html](editor_v2/templates/editor_v2/snippets/panel_right.html) or right-panel JS).
