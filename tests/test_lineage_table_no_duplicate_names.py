#!/usr/bin/env python3
"""
Temporary test: lineage table must not show consecutive duplicate names (same person at same depth).

Run from project root: python -m tests.test_lineage_table_no_duplicate_names
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def main():
    from app import app
    from routes.main import _lineage_nodes_links, _flat_hierarchy_rows

    failures = []
    with app.app_context(), app.test_request_context():
        nodes, links, user = _lineage_nodes_links()
        rows = _flat_hierarchy_rows(nodes, links)

        # No two consecutive rows should be the same (id, depth) and (name, depth)
        for i in range(1, len(rows)):
            prev, curr = rows[i - 1], rows[i]
            same_person_same_depth = (
                curr["depth"] == prev["depth"]
                and curr.get("id") == prev.get("id")
                and curr.get("name") == prev.get("name")
            )
            if same_person_same_depth:
                failures.append(
                    f"Consecutive duplicate at index {i}: id={curr.get('id')} name={curr.get('name')!r} depth={curr['depth']}"
                )

    if failures:
        for f in failures:
            print("FAIL:", f)
        return 1
    print("OK: No consecutive duplicate names in lineage table rows.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
