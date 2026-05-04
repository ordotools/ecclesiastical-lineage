# Editor v2 build rules

Do not use existing editor JavaScript or templates. Editor v2 is self-contained.

## Stack

- **Alpine.js**, **HTMX**, **Jinja** snippets only.
- **No Bootstrap.**

## Assets

- All CSS in separate files — **no inline CSS**.
- All JS in separate files — **no inline JS**.
- Directories:
  - `editor_v2/static/v2-scripts/` — JavaScript (e.g. `app.js`).
  - `editor_v2/static/v2-styles/` — CSS (e.g. `editor.css`).

## Styling

- **Black and white**, minimal.
- **Sans-serif**, **10px**, **system font** (no Google Fonts).
- **No animations**, no hover events, no transitions.

## Layout

- Three equal panels across; one small statusbar at bottom.
- All panels and statusbar are **HTMX-reloadable** (snippet endpoints).

## Directory layout

- `editor_v2/RULES.md` — this file.
- `editor_v2/templates/` — `base.html`, `editor.html`, `snippets/*.html`.
- `editor_v2/static/v2-scripts/` — `app.js`.
- `editor_v2/static/v2-styles/` — `editor.css`.
