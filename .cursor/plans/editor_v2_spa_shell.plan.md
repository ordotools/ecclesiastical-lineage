---
name: Editor v2 SPA shell
overview: Add a self-contained editor v2 under editor_v2/ with rules, three-panel + statusbar SPA shell, HTMX-loaded panels, Alpine.js, no Bootstrap; route /editor-v2.
todos:
  - id: editor-v2-dir-rules
    content: Create editor_v2/ directory and RULES.md with all v2 build rules (no prior JS/templates, stack, dirs, styling)
    status: completed
  - id: editor-v2-blueprint
    content: Create routes/editor_v2.py with blueprint (template_folder, static_folder), GET /editor-v2, and four panel routes
    status: completed
  - id: editor-v2-app-register
    content: Register editor_v2_bp in app.py
    status: completed
  - id: editor-v2-base-template
    content: Create editor_v2/templates/base.html (meta, one CSS link, HTMX + Alpine + app.js, no Bootstrap)
    status: completed
  - id: editor-v2-shell
    content: Create editor_v2/templates/editor.html with three equal panels + statusbar, each with hx-get/hx-trigger/hx-swap
    status: completed
  - id: editor-v2-snippet-left
    content: Create editor_v2/templates/snippets/panel_left.html placeholder fragment
    status: completed
  - id: editor-v2-snippet-center
    content: Create editor_v2/templates/snippets/panel_center.html placeholder fragment
    status: completed
  - id: editor-v2-snippet-right
    content: Create editor_v2/templates/snippets/panel_right.html placeholder fragment
    status: completed
  - id: editor-v2-snippet-statusbar
    content: Create editor_v2/templates/snippets/statusbar.html placeholder fragment
    status: completed
  - id: editor-v2-css
    content: Create editor_v2/static/v2-styles/editor.css (3 columns + statusbar, 10px sans-serif, black/white, no animation)
    status: completed
  - id: editor-v2-js
    content: Create editor_v2/static/v2-scripts/app.js (minimal or empty)
    status: completed
  - id: todo-left-panel
    content: (Later) Build left panel content and behavior
    status: pending
  - id: todo-center-panel
    content: (Later) Build center panel content and behavior
    status: pending
  - id: todo-right-panel
    content: (Later) Build right panel content and behavior
    status: pending
  - id: todo-statusbar
    content: (Later) Build statusbar content (e.g. connection status, counts)
    status: pending
isProject: false
---

# Editor v2: New directory, rules, and SPA shell

## Constraints (captured in RULES.md)

- **No** use of existing editor JavaScript or templates.
- **Stack:** Alpine.js, HTMX, Jinja snippets only. No Bootstrap.
- **Assets:** All CSS in separate files (no inline CSS). All JS in separate files. Directories: `v2-scripts/`, `v2-styles/`.
- **Styling:** Black and white, minimal. Sans-serif, 10px, system font (no Google Fonts). No animations, no hover events, no transitions.
- **Layout:** Three equal panels across; one small statusbar at bottom. All HTMX-reloadable.

## Directory layout

- `editor_v2/RULES.md`
- `editor_v2/templates/` — base.html, editor.html, snippets/*.html
- `editor_v2/static/v2-scripts/` — app.js
- `editor_v2/static/v2-styles/` — editor.css

## Route and blueprint

- New blueprint `editor_v2_bp` with `template_folder` and `static_folder` pointing at `editor_v2/`.
- **GET /editor-v2** → full-page shell.
- **GET /editor-v2/panel/left|center|right|statusbar** → Jinja snippet only (for HTMX swap).

## To-dos (subagent division)

- **editor-v2-dir-rules** — Create `editor_v2/` and `RULES.md`
- **editor-v2-blueprint** — Create `routes/editor_v2.py` (blueprint + 5 routes)
- **editor-v2-app-register** — Register blueprint in `app.py`
- **editor-v2-base-template** — Create `base.html`
- **editor-v2-shell** — Create `editor.html` (3 panels + statusbar, HTMX)
- **editor-v2-snippet-left** — Create `snippets/panel_left.html`
- **editor-v2-snippet-center** — Create `snippets/panel_center.html`
- **editor-v2-snippet-right** — Create `snippets/panel_right.html`
- **editor-v2-snippet-statusbar** — Create `snippets/statusbar.html`
- **editor-v2-css** — Create `v2-styles/editor.css`
- **editor-v2-js** — Create `v2-scripts/app.js`
- **todo-left-panel** — (Later) Left panel content
- **todo-center-panel** — (Later) Center panel content
- **todo-right-panel** — (Later) Right panel content
- **todo-statusbar** — (Later) Statusbar content
