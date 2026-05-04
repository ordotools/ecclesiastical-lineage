#!/usr/bin/env python3
"""
Regression guardrails for lineage tree building.

These checks focus on the invariants that previously regressed:

- Every clergy node emitted by ``_lineage_nodes_links`` must appear at least
  once in the flat hierarchy rows.
- For each ordination / consecration link, there must be at least one row
  where the child appears as a descendant of the parent (``parent_id ==
  source``).
- Under a given parent, a clergy may not appear more than once in a single
  generation (no duplicate rows per ``(parent_id, child_id)`` pair), which
  would manifest as "duplicate within generation" issues in the UI.

Run from project root:

    python -m tests.test_lineage_tree_invariants
"""

import os
import sys


sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def main():
    from app import app
    from routes.main import _lineage_nodes_links, _flat_hierarchy_rows

    failures = []

    with app.app_context(), app.test_request_context():
        nodes, links, _user = _lineage_nodes_links()
        rows = _flat_hierarchy_rows(nodes, links)

        node_by_id = {n.get("id"): n for n in nodes if n.get("id") is not None}

        # --- Invariant 1: every node id appears in at least one row -----------
        node_ids = {nid for nid in node_by_id.keys() if nid is not None}
        row_ids = {r.get("id") for r in rows if r.get("id") is not None}

        missing_from_rows = sorted(node_ids - row_ids)
        if missing_from_rows:
            failures.append(
                f"{len(missing_from_rows)} clergy present in nodes but missing from flat rows: "
                f"sample={missing_from_rows[:10]}"
            )

        # --- Invariant 2: each ordination/consecration link has a parent-child
        # row somewhere in the flat hierarchy ---------------------------------
        event_links = [
            l
            for l in links
            if l.get("type") in ("ordination", "consecration")
            and l.get("source") is not None
            and l.get("target") is not None
        ]

        # Pre-index rows by (parent_id, id) to speed up lookups.
        rows_by_parent_child = {}
        for r in rows:
            pid = r.get("parent_id")
            cid = r.get("id")
            if cid is None:
                continue
            key = (pid, cid)
            rows_by_parent_child.setdefault(key, []).append(r)

        missing_parent_child_rows = []
        for link in event_links:
            key = (link["source"], link["target"])
            if key not in rows_by_parent_child:
                missing_parent_child_rows.append(key)

        if missing_parent_child_rows:
            sample = missing_parent_child_rows[:10]
            failures.append(
                "Some ordination/consecration links have no corresponding "
                "parent-child row (parent_id=source, id=target). "
                f"Sample missing pairs: {sample}"
            )

        # --- Invariant 3: under a given parent, a child appears at most once --
        duplicates_within_parent = []
        counts = {}
        for r in rows:
            pid = r.get("parent_id")
            cid = r.get("id")
            if cid is None or pid is None:
                continue
            key = (pid, cid)
            counts[key] = counts.get(key, 0) + 1

        for (pid, cid), count in counts.items():
            if count > 1:
                duplicates_within_parent.append((pid, cid, count))

        if duplicates_within_parent:
            sample = duplicates_within_parent[:10]
            failures.append(
                "Duplicate child entries under the same parent detected "
                "(violates 'no duplicate within generation' invariant). "
                f"Sample duplicates: {sample}"
            )

    if failures:
        for f in failures:
            print("FAIL:", f)
        return 1

    print(
        "OK: Lineage tree invariants hold: full node coverage, "
        "parent-child consistency, and no duplicate children per parent."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())

