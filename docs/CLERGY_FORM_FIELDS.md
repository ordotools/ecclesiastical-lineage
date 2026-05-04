# Clergy form fields: required vs optional

Reference for all clergy, ordination, consecration, status, and admin fields used by the Editor v2 clergy form. “Required” and “optional” are defined by **backend logic** (`services/clergy.py`) and **HTML attributes** (`editor_v2/templates/editor_v2/snippets/clergy_form_fields.html`).

---

## 1. Core clergy fields (single record)

| Field (name) | HTML | Backend | Notes |
|--------------|------|---------|--------|
| **name** | `required` | Used as-is via `form.get('name')`; no server-side validation. | **Required in UI.** Backend assumes present. |
| **rank** | `required` | Used as-is via `form.get('rank')`. | **Required in UI.** Drives bishop-related UI (e.g. consecrations section). |
| **papal_name** | — | Optional; `form.get('papal_name')`. | Optional. Shown only when rank is Pope. |
| **organization** | — | Optional; `form.get('organization')`. | Optional. Stored as string. |
| **date_of_birth** | — | Optional; parsed as `%Y-%m-%d` if present, else `None`. | Optional. |
| **date_of_death** | — | Optional; parsed as `%Y-%m-%d` if present, else `None`. | Optional. |
| **notes** | — | Optional; `form.get('notes')`. | Optional. |
| **clergy_image** | — | Optional; file upload. Only used if `image_data_json` and `processed_image_data` are not used. | Optional (add). |
| **image_data_json** | — | Optional; JSON with image URLs. Used when client sends cropped/processed image data. | Optional (add/edit). |
| **processed_image_data** | — | Optional; base64 image. Fallback when no file or image_data_json. | Optional (add/edit). |
| **image_removed** | — | Edit only. If `'true'`, clears `image_url` and `image_data`. | Optional (edit). |

---

## 2. Ordinations (repeating: `ordinations[i][...]`)

Backend: rows are **created when** `date` is non-empty, `date_unknown` is truthy, **or** `details_unknown` is truthy; otherwise the row is skipped. There is **no** server requirement that any ordination row exist.

| Field | HTML | Backend | Notes |
|-------|------|---------|--------|
| **ordinations[i][date]** | No `required` in template. Inline JS may set `required` when “specify date” is active (`toggleDateUnknown(..., false)`). | Row included only if `date` or `date_unknown` present. | If row is to be saved: either **date** or **date_unknown** (+ optional year) required. Per-row, not globally. |
| **ordinations[i][date_unknown]** | Hidden; value `'1'` or `''`. | Truthy value means “year-only / unknown date” path. | Optional per row; affects whether row is created. |
| **ordinations[i][details_unknown]** | Checkbox; value `'on'` when checked. | Truthy value means “ordination event exists but detailed date/bishop information is unknown”; row is still created even if date and bishop fields are empty. | Optional per row; does **not** change default validity (still defaults to `'valid'`). |
| **ordinations[i][year]** | — | Optional; used when `date_unknown` and no `date`. Parsed as int. | Optional. |
| **ordinations[i][validity]** | — | Optional; defaults to `'valid'`. Sets `is_doubtfully_valid` / `is_invalid`. | Optional. |
| **ordinations[i][is_sub_conditione]** | Checkbox | Optional; `'on'` → true. | Optional. |
| **ordinations[i][is_doubtful_event]** | Checkbox | Optional; `'on'` → true. | Optional. |
| **ordinations[i][is_inherited]** | Checkbox | Optional; `'on'` → true. | Optional. |
| **ordinations[i][is_other]** | Checkbox | Optional; `'on'` → true. | Optional. |
| **ordinations[i][optional_notes]** | — | Optional; trimmed string or `None`. | Optional. |
| **ordinations[i][notes]** | — | Optional; `data.get('notes', '')`. | Optional. |
| **ordinations[i][ordaining_bishop_id]** | Hidden | Optional; if present and not `'None'`, used as FK. | Optional. |
| **ordinations[i][ordaining_bishop_input]** | Text | Optional; used if no ID; lookup or auto-create Bishop by name. | Optional. |

---

## 3. Consecrations (repeating: `consecrations[i][...]`)

Backend: same as ordinations — rows are **created when** `date` is non-empty, `date_unknown` is truthy, **or** `details_unknown` is truthy. No server requirement for any consecration row.

| Field | HTML | Backend | Notes |
|-------|------|---------|--------|
| **consecrations[i][date]** | No `required` in template. Inline JS may set `required` when “specify date” is active. | Row included only if `date` or `date_unknown` present. | If row is to be saved: either **date** or **date_unknown** (+ optional year) required. Per-row. |
| **consecrations[i][date_unknown]** | Hidden; value `'1'` or `''`. | Truthy value means “year-only / unknown date” path. | Optional per row. |
| **consecrations[i][details_unknown]** | Checkbox; value `'on'` when checked. | Truthy value means “consecration event exists but detailed date/bishop information is unknown”; row is still created even if date and consecrator/co-consecrator fields are empty. | Optional per row; does **not** change default validity (still defaults to `'valid'`). |
| **consecrations[i][year]** | — | Optional; used when `date_unknown` and no `date`. | Optional. |
| **consecrations[i][validity]** | — | Optional; defaults to `'valid'`. | Optional. |
| **consecrations[i][is_sub_conditione]** | Checkbox | Optional. | Optional. |
| **consecrations[i][is_doubtful_event]** | Checkbox | Optional. | Optional. |
| **consecrations[i][is_inherited]** | Checkbox | Optional. | Optional. |
| **consecrations[i][is_other]** | Checkbox | Optional. | Optional. |
| **consecrations[i][optional_notes]** | — | Optional; trimmed or `None`. | Optional. |
| **consecrations[i][notes]** | — | Optional. | Optional. |
| **consecrations[i][consecrator_id]** | Hidden | Optional; if present and not `'None'`, used as FK. | Optional. |
| **consecrations[i][consecrator_input]** | Text | Optional; lookup or auto-create Bishop by name. | Optional. |
| **consecrations[i][co_consecrators][j][id]** | — | Optional; many-to-many co-consecrator by ID. | Optional. |
| **consecrations[i][co_consecrators][j][input]** | — | Optional; lookup or auto-create by name. | Optional. |

---

## 4. Status indicators

| Field | HTML | Backend | Notes |
|-------|------|---------|--------|
| **status_ids[]** / **status_ids** | Checkboxes; `name="status_ids[]"` with `value="{{ status.id }}"`. | Optional list; `form.getlist('status_ids[]')` or `form.getlist('status_ids')`. Each valid ID adds a Status relation. | Optional. Empty = no statuses. |

---

## 5. Administrative (edit only)

| Field | HTML | Backend | Notes |
|-------|------|---------|--------|
| **mark_deleted** | Checkbox `value="1"`. | Optional; only when present and `'1'`: sets `is_deleted = True`, `deleted_at = now`. Uncheck clears. | Optional. |
| **exclude_from_visualization** | Checkbox `value="1"`. | Optional; truthy value sets `clergy.exclude_from_visualization = True` (hides the clergy from lineage visualizations and related trees); falsy/absent value leaves it `False`. | Optional. |

---

## Summary

- **Required in UI (HTML):** `name`, `rank`.
- **Required by backend for a saved ordination/consecration row:** that row must have either non-empty `date`, truthy `date_unknown` (with optional `year`), or truthy `details_unknown`. No row is required to exist.
- **Everything else** (papal_name, organization, dates, notes, image fields, ordination/consecration sub-fields, validity, flags including `details_unknown`, ordaining bishop/consecrator, status_ids, `mark_deleted`, `exclude_from_visualization`) is **optional** per backend and/or HTML.
- **Cascade/validity:** For how `details_unknown` events are ordered and treated in validation (e.g. as “before” child events when date is missing), see [VALIDITY_RULES.md](VALIDITY_RULES.md).
