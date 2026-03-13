# Validity rules (canonical)

Canonical reference for lineage/validity rules. Code should implement these rules; see `static/js/validity-rules.js` and `routes/editor.py`.

---

## Terminology (used in rules below)

| Term in rules   | Meaning in data                                                                                          |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| **Valid**       | Effective status `valid` or `sub_conditione`                                                             |
| **Invalid**     | Effective status `doubtfully_valid`, `invalid`, or `doubtful_event` (i.e. not "valid" for giving orders) |
| **Give orders** | Consecrate or ordain (perform an ordination or consecration on another)                                  |

---

## Rules 1–8 (canonical)

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

### Details unknown (reliable data presumption)

When a record has `details_unknown=True` and no date/year for an ordination or consecration, the system applies a **reliable-data presumption** so that lineage and validity are not unduly downgraded. The following semantics apply:

| # | Semantics | Meaning |
|---|-----------|--------|
| 1 | **Valid unless stated otherwise** | Events with `details_unknown=True` keep default effective status (valid when no invalid/doubtful flags set). |
| 2 | **Ordination before consecration** | When dates are unknown, assume the bishop received ordination before consecration (Rule 2). |
| 3 | **Children always valid unless stated otherwise** | When the bishop has only details-unknown events (or they count as "before" the child), descendant events get `new_validity='valid'` unless explicitly marked otherwise. |
| 4 | **Children's orders after parent's unknown consecration** | Treat a bishop's details-unknown event as occurring "before" any child event in cascade logic. |

Implementation: backend (`services/validation_cascade.py`) and frontend (`static/js/editor-ranges-validity.js`) treat details-unknown with no date/year as earliest in sort order so ordination is considered before consecration and before any child event.

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

### D. Where the rules live (reference)

| Location                                                                       | What it defines                                                                                                                                 |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| [static/js/status-inheritance.js](../static/js/status-inheritance.js)         | Frontend: STATUS_PRIORITY, getEffectiveStatus, getWorstStatus, mapWorstStatusToAllowedEffective, getAllowed*Statuses, applyValidityRestrictions |
| [static/js/editor-validation-impact.js](../static/js/editor-validation-impact.js) | computeValidityPerRange, canClergyValidlyOrdain/Consecrate, buildSyntheticBishopSummaryFromForm                                                 |
| [routes/editor.py](../routes/editor.py)                                        | Backend: _get_effective_status, _get_bishop_summary, _get_worst_status, bulk validity update                                                    |
| [models.py](../models.py)                                                      | was_bishop_on(date), get_primary_ordination/consecration                                                                                        |
