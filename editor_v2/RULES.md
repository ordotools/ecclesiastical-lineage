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

- **Black and white**, minimal. Colors, spacing and radius come from the `:root` tokens in `editor.css`; do not hard-code new ones.
- **Sans-serif**, **13px**, **system font** (no Google Fonts).
- **No animations**, no hover events, no transitions.
- **Keyboard first**: every control is reachable with Tab in visual order, and focus is always visible (`:focus-visible` ring). Never set `outline: none` without a replacement.
- **Shortcuts** (listed in the statusbar): ⌘K search/commands, ⌘S or ⌘Enter save, ⌘E wiki overlay, ⌘⇧E evidence for the focused field, ⌥↑/⌥↓ previous/next clergy, Esc closes the innermost open thing. Shortcuts do nothing while a dialog is open.
- **Evidence** (`services/evidence.py`, `evidence-overlay.js`): sources for dates of birth/death and each event field, saved per item through `/editor/api/evidence`, never with the clergy form. Only saved records and saved event rows get Evidence buttons, because evidence is keyed to the event's DB ID. Saving the form upserts events by their hidden `[id]`.

## Layout

- Narrow clergy list on the left (`--left-w`), two equal work panels (form, lineage); one small statusbar at bottom.
- All panels and statusbar are **HTMX-reloadable** (snippet endpoints).

## Directory layout

- `editor_v2/RULES.md` — this file.
- `editor_v2/templates/editor_v2/` — `base.html`, `shell.html`, `embed.html`, `snippets/*.html`.
- `editor_v2/static/v2-scripts/` — one file per feature; `app.js` is the HTMX glue.
- `editor_v2/static/v2-styles/` — `editor.css` (tokens + layout) and per-feature sheets.
