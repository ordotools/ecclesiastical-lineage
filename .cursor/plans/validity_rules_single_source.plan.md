---
name: Validity rules single source
overview: Put canonical validity/lineage rules in a single place; document them in table form (your 8 rules); have frontend, backend, and clergy form reference that source.
todos:
  - id: doc-validity-rules
    content: Add docs/VALIDITY_RULES.md with terminology, rules 1-8, and tables A-D
    status: completed
  - id: create-validity-rules-js
    content: Create static/js/validity-rules.js with constants and pure functions (getEffectiveStatus, isValidForGivingOrders, etc.)
    status: completed
  - id: refactor-status-inheritance
    content: Refactor status-inheritance.js to import and use validity-rules.js
    status: completed
  - id: refactor-editor-validation-impact
    content: Refactor editor-validation-impact.js to import and use validity-rules.js; align computeValidityPerRange with rules 1a/1b/2
    status: completed
  - id: mirror-editor-py
    content: Mirror validity logic in routes/editor.py (or document match to validity-rules.js)
    status: completed
  - id: apply-rules-6-8
    content: Apply rules 6 and 8 in dropdown restrictions and presumed validity when bishop fails rule 7
    status: completed
isProject: false
---

# Validity rules: single source of truth

## To-dos

- Add `docs/VALIDITY_RULES.md` with terminology, rules 1–8, and tables A–D
- Create `static/js/validity-rules.js` with constants and pure functions (getEffectiveStatus, isValidForGivingOrders, etc.)
- Refactor `status-inheritance.js` to import and use `validity-rules.js`
- Refactor `editor-validation-impact.js` to import and use `validity-rules.js`; align `computeValidityPerRange` with rules 1a/1b/2
- Mirror validity logic in `routes/editor.py` (or document "must match validity-rules.js")
- Apply rules 6 and 8 in dropdown restrictions and presumed validity when bishop fails rule 7

## Recommendation: single place for rules

**Yes — the rules should live in one place that all code references.** That gives one place to update when rules change, no drift between frontend/backend/validation panel, and a clear spec.

Proposed approach:

1. **Canonical doc**: `docs/VALIDITY_RULES.md` — the rules and tables below (authoritative for humans and code comments).
2. **Executable source**: One JS module (e.g. `static/js/validity-rules.js`) that exports terminology constants, status priority, "counts as valid" set, and functions: `getEffectiveStatus(record)`, `isValidForGivingOrders(effective)`, `canGiveOrdersValidlyInRange(orders, rangeIndex)`, presumed-validity / allowed-validity (rules 6–8).
3. **Consumers**: [status-inheritance.js](static/js/status-inheritance.js) and [editor-validation-impact.js](static/js/editor-validation-impact.js) import from `validity-rules.js`; [routes/editor.py](routes/editor.py) mirrors the same logic in Python (comment: "see docs/VALIDITY_RULES.md and validity-rules.js").

---

## Terminology (used in rules below)


| Term in rules   | Meaning in data                                                                                          |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| **Valid**       | Effective status `valid` or `sub_conditione`                                                             |
| **Invalid**     | Effective status `doubtfully_valid`, `invalid`, or `doubtful_event` (i.e. not "valid" for giving orders) |
| **Give orders** | Consecrate or ordain (perform an ordination or consecration on another)                                  |


---

## Your 8 rules (canonical)

### Rule 1 – Requirements to give orders validly in a range

To validly give orders in a given range, clergy must have (1) a valid ordination and (2) a valid consecration.


| Sub-rule | Statement                                                                                                           |
| -------- | ------------------------------------------------------------------------------------------------------------------- |
| 1a       | The valid ordination of the clergy giving orders must be received **before** the valid consecration.                |
| 1b       | Both the valid ordination and the valid consecration must have been received **before** he can give orders validly. |


Implementation: for each range, require at least one prior ordination and one prior consecration with effective in {valid, sub_conditione}, with the first valid ordination before the first valid consecration in time.

### Rule 2 – Chronological order

The only valid sequence: **valid ordination** (of clergy giving orders) **< valid consecration** (of clergy giving orders) **< orders given to another**. Timeline built by date enforces this.

### Rule 3 – Validly receiving consecration

To validly receive consecration, a clergy must have a previous valid ordination and his consecrator must be valid per rules 1 and 2.

### Rule 4 – Who can validly give orders

Only those who pass rules 1–3 can validly give orders; they pass with valid or sub conditione orders.

### Rule 5 – Check before giving orders

In determining whether clergy can give orders validly: they must have at least one valid ordination and one valid consecration before they give orders. (Same as 1/1b.)

### Rule 6 – Inheritance of status onto orders given


| Source effective status | Resulting orders given |
| ----------------------- | ---------------------- |
| invalid                 | invalid                |
| doubtfully_valid        | doubtfully_valid       |
| doubtful_event          | doubtfully_valid       |


### Rule 7 – When orders are valid

If at the time of giving orders the bishop has at least one valid ordination and one valid consecration, the orders are valid (act of giving is valid; orders can still be marked valid/doubtfully valid/invalid per rule 6).

### Rule 8 – When bishop does not satisfy rule 7 (presumed validity)

If the bishop does **not** have at least one valid ordination and one valid consecration at the time of giving orders, the presumed validity of the orders given is the "most valid" of the invalid options: **doubtfully_valid > doubtful_event > invalid**. So when restricting what validity an ordination/consecration can have when the bishop is invalid: allow only one value — invalid → [invalid]; doubtfully_valid or doubtful_event → [doubtfully_valid].

---

## Tables for implementation (single reference)

### A. Effective status (from record / dropdown)


| Priority (worse = higher) | Effective status | DB/UI                                             | Validity dropdown           |
| ------------------------- | ---------------- | ------------------------------------------------- | --------------------------- |
| 4                         | invalid          | is_invalid / validity='invalid'                   | invalid                     |
| 3                         | doubtfully_valid | is_doubtfully_valid / validity='doubtfully_valid' | doubtfully_valid            |
| 2                         | doubtful_event   | is_doubtful_event                                 | (maps to valid in dropdown) |
| 1                         | sub_conditione   | is_sub_conditione                                 | (maps to valid in dropdown) |
| 0                         | valid            | none of above                                     | valid                       |


**"Valid" for giving orders** = effective in {valid, sub_conditione}. **"Invalid"** = effective in {doubtfully_valid, doubtful_event, invalid}.

### B. Can give orders validly in a range (rules 1, 1a, 1b, 2, 5)


| Condition                                                                                                              | canValidlyOrdain | canValidlyConsecrate |
| ---------------------------------------------------------------------------------------------------------------------- | ---------------- | -------------------- |
| At least one prior valid ordination and at least one prior valid consecration (ordination before consecration in time) | true             | true                 |
| Otherwise                                                                                                              | false            | false                |


Current code: `canValidlyOrdain` = has valid ordination in range; `canValidlyConsecrate` = has valid ordination **and** valid consecration in range. Timeline is date-ordered so ordination-before-consecration is implicit. Confirm "prior" means strictly before the range.

### C. Presumed validity when bishop is invalid (rules 6, 8)


| Bishop's worst status  | Allowed validity for orders they give          |
| ---------------------- | ---------------------------------------------- |
| invalid                | invalid only                                   |
| doubtfully_valid       | doubtfully_valid only                          |
| doubtful_event         | doubtfully_valid only                          |
| valid / sub_conditione | (bishop valid; all options allowed per rule 7) |


### D. Where the rules live today (before single-source refactor)


| Location                                                                       | What it defines                                                                                                                                 |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| [static/js/status-inheritance.js](static/js/status-inheritance.js)             | Frontend: STATUS_PRIORITY, getEffectiveStatus, getWorstStatus, mapWorstStatusToAllowedEffective, getAllowed*Statuses, applyValidityRestrictions |
| [static/js/editor-validation-impact.js](static/js/editor-validation-impact.js) | computeValidityPerRange, canClergyValidlyOrdain/Consecrate, buildSyntheticBishopSummaryFromForm                                                 |
| [routes/editor.py](routes/editor.py)                                           | Backend: _get_effective_status, _get_bishop_summary, _get_worst_status, bulk validity update                                                    |
| [models.py](models.py)                                                         | was_bishop_on(date), get_primary_ordination/consecration                                                                                        |


---

## Implementation steps

1. **Add `docs/VALIDITY_RULES.md`** with the rules and tables above (terminology, rules 1–8, tables A–D).
2. **Introduce single executable source**: Create `static/js/validity-rules.js` exporting constants and pure functions implementing tables A–C and rules 1–8. Refactor [status-inheritance.js](static/js/status-inheritance.js) and [editor-validation-impact.js](static/js/editor-validation-impact.js) to import and use it. Refactor [routes/editor.py](routes/editor.py) to mirror the same logic (or document "must match validity-rules.js").
3. **Align timeline with rules 1a/1b/2**: Ensure `computeValidityPerRange` requires at least one valid ordination and one valid consecration **before** the range, with ordination before consecration in time.
4. **Apply rules 6 and 8** in dropdown restrictions and in any "presumed validity" when a bishop who fails rule 7 is selected (table C).
5. **Keep `docs/VALIDITY_RULES.md`** and the single JS module in sync whenever rules change.

