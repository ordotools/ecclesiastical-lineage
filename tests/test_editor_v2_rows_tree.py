#!/usr/bin/env python3
"""
Sanity check: editor v2 `_rows_to_tree` must faithfully reflect the flat
hierarchy rows produced by `_flat_hierarchy_rows`:

- Tree traversal should yield rows in the same order as the flat list.
- The number of emitted tree nodes must equal the number of flat rows.
- The number of top-level tree nodes must equal the number of depth-0 rows
  (i.e. structural roots).

Run from project root:

    python -m tests.test_editor_v2_rows_tree
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _flatten_tree(nodes):
    """Depth-first flatten of the `rows_tree` structure used by panel_left."""
    flat = []
    for node in nodes:
        flat.append(node["row"])
        children = node.get("children") or []
        flat.extend(_flatten_tree(children))
    return flat


def main():
    from app import app
    from routes.main import _lineage_nodes_links, _flat_hierarchy_rows
    from routes.editor_v2 import _rows_to_tree

    with app.app_context(), app.test_request_context():
        nodes, links, _user = _lineage_nodes_links()
        rows = _flat_hierarchy_rows(nodes, links)

        # Match the ID normalization used by editor_v2.panel_left so we are
        # asserting against the exact same contract the template consumes.
        normalized_rows = []
        for row in rows:
            raw_id = row.get("id")
            coerced_id = None
            if raw_id is not None:
                try:
                    coerced_id = int(raw_id)
                except (TypeError, ValueError):
                    coerced_id = None
            if coerced_id is None:
                continue
            normalized_row = dict(row)
            normalized_row["id"] = coerced_id
            normalized_rows.append(normalized_row)

        rows = normalized_rows

        rows_tree = _rows_to_tree(rows)
        flattened = _flatten_tree(rows_tree)

        # 1. Tree traversal must yield exactly one node per input row.
        if len(flattened) != len(rows):
            print(
                "FAIL: rows_tree flatten length mismatch: "
                f"{len(flattened)} nodes vs {len(rows)} flat rows"
            )
            return 1

        # 2. DFS order of the tree must match the input flat ordering for
        #    (id, depth), guaranteeing no reordering or omission.
        for idx, (row_flat, row_tree) in enumerate(zip(rows, flattened)):
            if row_flat.get("id") != row_tree.get("id") or row_flat.get("depth") != row_tree.get(
                "depth"
            ):
                print(
                    "FAIL: mismatch at index "
                    f"{idx}: flat (id={row_flat.get('id')}, depth={row_flat.get('depth')}) "
                    f"!= tree (id={row_tree.get('id')}, depth={row_tree.get('depth')})"
                )
                return 1

        # 3. Number of structural roots (depth 0) must equal the number of
        #    top-level nodes in the tree for usability with many roots.
        flat_root_count = sum(1 for r in rows if r.get("depth") == 0)
        tree_root_count = len(rows_tree)
        if flat_root_count != tree_root_count:
            print(
                "FAIL: root count mismatch: "
                f"{tree_root_count} tree roots vs {flat_root_count} depth-0 rows"
            )
            return 1

    print("OK: editor v2 rows_tree faithfully reflects flat hierarchy rows.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

