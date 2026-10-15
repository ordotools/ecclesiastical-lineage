# Validity rules (canonical)

Canonical reference for lineage/validity rules. Code should implement these rules; see `editor_v2/static/v2-scripts/validity-rules.js` and `services/validation_cascade.py`.

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

If the bishop does **not** have at least one valid ordination and one valid consecration at the time of giving orders, the presumed validity of the orders given is the "most valid" of the invalid options: **doubtfully_valid > doubtful_event > invalid**. That presumed value is also the best value the orders can have: orders given can be no better than the giver, but may always be worse (e.g. a defect of form or intention in the act itself). So when restricting what validity an ordination/consecration can have when the bishop is invalid: invalid → [invalid]; doubtfully_valid or doubtful_event → [doubtfully_valid, invalid].

A side with no recorded events (e.g. a bishop whose priestly ordination was never entered) does not count toward the bishop's worst status; only recorded events can downgrade it.

### Descendant cascade ("update descendants")

For each descendant ordination/consecration, the bishop's status at that date gives a **cap** (valid, or Rule 8's presumed value).

| Record                                   | Result                                                     |
| ---------------------------------------- | ---------------------------------------------------------- |
| `is_inherited` (status came from bishop) | Follows the cap, so it can be cleared when the bishop is restored |
| Set explicitly (not inherited)           | Keeps its own status unless the cap is worse; never upgraded |

Any status the cascade writes is marked `is_inherited` (cleared when it writes `valid`). Changes propagate through all generations in one save. Implementation: `services/validation_cascade._propagate_validity`.

---

### Details unknown (reliable data presumption)

When a record has `details_unknown=True` and no date/year for an ordination or consecration, the system applies a **reliable-data presumption** so that lineage and validity are not unduly downgraded. The following semantics apply:


| #   | Semantics                                                 | Meaning                                                                                                                                                                                                                                                                                         |
| --- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Valid unless stated otherwise**                         | Events with `details_unknown=True` keep default effective status (valid when no invalid/doubtful flags set).                                                                                                                                                                                    |
| 2   | **Ordination before consecration**                        | When dates are unknown, assume the bishop received ordination before consecration (Rule 2).                                                                                                                                                                                                     |
| 3   | **Children always valid unless stated otherwise**         | When the bishop has only details-unknown events (or they count as "before" the child), descendant events get `new_validity='valid'` unless explicitly marked otherwise.                                                                                                                         |
| 4   | **Children's orders after parent's unknown consecration** | Treat a bishop's details-unknown event as occurring "before" any child event in cascade logic.                                                                                                                                                                                                  |
| 5   | **Fixed positions in orders history**                     | In a clergy member's orders history, a details-unknown ordination with no date/year is treated as the **first** record; a details-unknown consecration with no date/year is treated as the **second** record **when at least one ordination exists**, and always before any other consecration. |


Implementation: backend (`services/validation_cascade.py`) and frontend (`editor_v2/static/v2-scripts/validity-rules.js`, `EditorRangesValidity`) treat details-unknown with no date/year as earliest in sort order so ordination is considered before consecration and before any child event, and the orders history consistently places such an ordination in the first slot and such a consecration in the second slot (when an ordination exists) and before any other consecration.

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


Backend (`_bishop_summary_at_date`) applies the same test at the date of the order given, with these presumptions:

| Situation | Treated as |
| --- | --- |
| Clergy with no orders recorded at all (lineage root) | Valid bishop |
| Consecration(s) recorded, no ordination recorded | Validly ordained before the consecration |
| Ordination recorded, no consecration recorded | Not a bishop: orders given are invalid |
| Bishop's own event with no date/year | Before the order given |
| Order given with no date/year (incl. details unknown) | After all the bishop's own events |
| Order given with year only | End of that year (bishop's events earlier that year count as before) |
| Ordination and consecration with unknown/same dates | Ordination first (Rule 1a satisfied) |

### C. Presumed validity when bishop is invalid (rules 6, 8)


| Bishop's worst status  | Allowed validity for orders they give          |
| ---------------------- | ---------------------------------------------- |
| invalid                | invalid only                                   |
| doubtfully_valid       | doubtfully_valid or invalid                    |
| doubtful_event         | doubtfully_valid or invalid                    |
| valid / sub_conditione | all options if the bishop is valid (rule 7); otherwise invalid only (e.g. never consecrated, or consecrated before ordained) |


### D. Where the rules live (reference)


| Location | What it defines |
| --- | --- |
| [editor_v2/static/v2-scripts/validity-rules.js](../editor_v2/static/v2-scripts/validity-rules.js) | Frontend: Tables A–C (`EditorV2Validity`), ranges (`EditorRangesValidity`) |
| [editor_v2/static/v2-scripts/bishop-restrictions.js](../editor_v2/static/v2-scripts/bishop-restrictions.js) | Validity dropdown restriction per ordaining bishop/consecrator at the event date |
| [services/validation_cascade.py](../services/validation_cascade.py) | Backend: effective status, bishop summary at a date, descendant cascade, system tags |
| [routes/editor_v2.py](../routes/editor_v2.py) | `/editor/api/bishop-validity/<id>?date=&year=` |


--------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| [static/js/status-inheritance.js](../static/js/status-inheritance.js)             | Frontend: STATUS_PRIORITY, getEffectiveStatus, getWorstStatus, mapWorstStatusToAllowedEffective, getAllowed*Statuses, applyValidityRestrictions |
| [static/js/editor-validation-impact.js](../static/js/editor-validation-impact.js) | computeValidityPerRange, canClergyValidlyOrdain/Consecrate, buildSyntheticBishopSummaryFromForm                                                 |
| [routes/editor.py](../routes/editor.py)                                           | Backend: _get_effective_status, _get_bishop_summary, _get_worst_status, bulk validity update                                                    |
| [models.py](../models.py)                                                         | was_bishop_on(date), get_primary_ordination/consecration                                                                                        |


---

## System tags vs lineage cascade

**Lineage cascade** (Rules 1–8, Tables B–C) asks whether a bishop can give orders *at a date*, using any prior valid-like ordination/consecration.

**System tags** (`invalid_priest`, `invalid_bishop`, `doubtful_*`, `valid`) summarize a clergy member’s *current* standing for the tag picker. They use **latest-wins**:

| Tag driver | Rule |
| ---------- | ---- |
| Priest tags | Chronologically **last ordination** only |
| Bishop tags | Chronologically **last consecration** only; **also** when latest ord is invalid/doubtful and a consecration follows it (Rule 3 — invalid/doubtful priesthood → matching bishop tag). If both `invalid_bishop` and `doubtful_bishop` would apply, keep **invalid_bishop** only (worst case) |
| Valid-like consecration for tags | Counts only if a valid-like ordination exists **strictly before** that consecration (Rule 3 gate). Raw invalid/doubtful on the latest consecration still apply as bishop tags |
| Overall `valid` | Latest ord valid-like **and** (no consecrations **or** gated latest cons valid-like) |

Implementation: `services/validation_cascade.compute_system_tag_names_for_clergy` and `editor_v2/static/v2-scripts/auto-tags-from-validity.js`.


