# Clergy form save flow (Editor v2)

Confirmed mapping from template → JS interceptor → routes → services.

## 1. Template

**File:** `editor_v2/templates/editor_v2/snippets/clergy_form_fields.html`

- Form: `id="clergyForm"`, `method="POST"`, `enctype="multipart/form-data"`, `data-editor-v2-clergy-form="true"`.
- **Action (line 1):**
  - Edit: `url_for('editor_v2_bp.clergy_edit_v2', clergy_id=clergy.id)` → `POST /editor-v2/clergy/<id>/edit`
  - Add: `url_for('editor_v2_bp.clergy_add_v2')` → `POST /editor-v2/clergy/add`
- Fields: identity (name, papal_name, organization), rank, photo (clergy_image), dates, notes, ordinations`[i][...]`, consecrations`[i][...]`, status_ids[], mark_deleted, is_lineage_root (see plan for full list).
- Inline script: `initClergyFormV2()` for rank visibility, date-unknown toggles, ordination/consecration add/remove, bishop autocomplete.

Included by: `editor_v2/templates/editor_v2/snippets/panel_center.html`.

## 2. JS interceptor

**File:** `editor_v2/static/v2-scripts/app.js`

- **`initClergyFormInterceptor()`** (called on DOMContentLoaded): document.body `submit` listener.
- **Match:** `form.matches('#clergyForm[data-editor-v2-clergy-form="true"]')` → `event.preventDefault()`.
- **Request:** `FormData(form)`, `fetch(form.action, { method: 'POST', body: formData, headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' } })`.
- **Response:** Expects JSON; on success shows status, updates `currentSelectedClergyId`, optionally `htmx.ajax('GET', /editor-v2/panel/center?clergy_id=…)` to refresh center panel, dispatches `editor:validityChanged`.

## 3. Routes

**File:** `routes/editor_v2.py`

| Method + path                    | Handler            | Service call                          |
|----------------------------------|--------------------|----------------------------------------|
| `POST /editor-v2/clergy/add`     | `clergy_add_v2()`  | `clergy_service.add_clergy_handler()`  |
| `POST /editor-v2/clergy/<id>/edit` | `clergy_edit_v2(clergy_id)` | `clergy_service.edit_clergy_handler(clergy_id)` |

Return: `_normalize_clergy_save_result(clergy, response, status_code)` → JSON `{ success, message, clergy_id? }`.

## 4. Services

**File:** `services/clergy.py`

- **Add:** `add_clergy_handler()` (POST): builds `form_data = request.form.copy(); form_data.update(request.files)`; calls `create_clergy_from_form(form_data)`. That uses `create_ordinations_from_form(clergy, form)`, `create_consecrations_from_form(clergy, form)`, status_ids, is_lineage_root; commits. Returns `(clergy, jsonify(...))` for AJAX (X-Requested-With / multipart).
- **Edit:** `edit_clergy_handler(clergy_id)` (POST): if AJAX, updates clergy from `request.form` (name, rank, papal_name, organization, dates, notes, image_removed / image upload), then `update_ordinations_from_form(clergy, request.form)`, `update_consecrations_from_form(clergy, request.form)`, statuses, mark_deleted, is_lineage_root; commit. Returns `jsonify({ success, message, clergy_id })`.
- **Ordinations/consecrations:** `create_ordinations_from_form` / `create_consecrations_from_form` parse `ordinations[i][...]` / `consecrations[i][...]`; rows with neither date nor date_unknown are skipped. Edit path uses `update_ordinations_from_form` / `update_consecrations_from_form` (delete existing, then create from form).

Flow is consistent end-to-end: template action → interceptor POST with FormData → editor_v2 routes → clergy service add/edit handlers → JSON response → interceptor handles success/error and panel refresh.
