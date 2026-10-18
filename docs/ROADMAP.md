# Roadmap

Features aimed at the main public question: **"Is this clergyman's lineage valid, and how do we know?"**

## Done (2026-10-17)

- **Sources on the public grid.** Click a clergy card; if evidence is attached, a *Sources (n)* button opens a dialog
  grouped by date of birth, date of death and each ordination/consecration (photos, PDFs, links, notes).
  Public endpoint: `GET /clergy/<id>/evidence.json` (read-only, editor names omitted).
- **Shareable link per clergy.** The focused card is mirrored in the URL (`/?clergy=<id>`); opening that link pans to it.
- **Support badge.** Set `SUPPORT_URL` to a donation page (one-time and recurring are handled by the provider);
  the badge shows in the bottom-right of the grid. Hidden while the admin editor panel is open.

## Next: quick wins

- **"Copy link" button** next to *Sources* (the address bar already holds the link; a button makes it obvious on mobile).
- **Sourced / unsourced marker** on cards and order mini-cards, using the per-order evidence counts already loaded,
  so researchers can see at a glance which claims are documented.
- **Plain-language validity summary** in the focus overlay, e.g. "Valid: ordained 1975 by X (valid),
  consecrated 1980 by Y (valid)". Reuse the rule names from `VALIDITY_RULES.md`.
- **Why doubtful/invalid?** Show which rule caused a downgrade (inherited from the bishop under Rule 6/8,
  or set explicitly) and link to the source on that field.

## Medium

- **Trace to the root.** Highlight the full chain of consecrators from the selected clergy back to the earliest
  recorded bishop, with the weakest link called out (the lineage is only as valid as that link).
- **Printable lineage report** (one clergy, its chain and its sources) as a page people can save to PDF
  with the browser's print dialog.
- **Suggest a correction / submit a source.** Public form that creates a comment for editors to review
  (the comments model and resolve flow already exist).
- **"Last updated" and change history** per clergy, from the existing audit log, so readers can judge freshness.
- **Search by organization, chapel or city**, linking chapel locations to the clergy who serve them.

## Later

- **Data export** (JSON/CSV) of clergy, orders and validity for researchers.
- **Embeddable widget**: a single clergy's lineage for a chapel website.
- **Mobile pass** on the grid: larger tap targets and a bottom sheet for the focus overlay.
- **Evidence storage sweep** for files orphaned by cascade deletes (see `ponytail:` notes in `services/evidence.py`).
