#!/usr/bin/env python3
"""
Regression checks: soft-deleted clergy hidden from frontend list/lineage queries.

Run from project root:

    python -m tests.test_soft_deleted_clergy_filter
"""

import os
import sys


sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def main():
    from app import app
    from models import Clergy
    from routes.main import _lineage_nodes_links
    from routes.editor_v2 import _all_clergy_list

    failures = []

    with app.app_context(), app.test_request_context():
        deleted = Clergy.query.filter(Clergy.is_deleted == True).first()  # noqa: E712
        if not deleted:
            print("SKIP: no soft-deleted clergy in DB")
            return 0

        nodes, links, _user = _lineage_nodes_links()
        node_ids = {n.get("id") for n in nodes if n.get("id") is not None}
        list_ids = {row["id"] for row in _all_clergy_list()}

        if deleted.id in node_ids:
            failures.append(
                f"soft-deleted clergy id={deleted.id} present in lineage nodes"
            )
        if deleted.id in list_ids:
            failures.append(
                f"soft-deleted clergy id={deleted.id} present in editor clergy list"
            )

        for link in links:
            source = link.get("source")
            target = link.get("target")
            if source not in node_ids:
                failures.append(
                    f"link source {source} not in active node set (type={link.get('type')})"
                )
            if target not in node_ids:
                failures.append(
                    f"link target {target} not in active node set (type={link.get('type')})"
                )

        with app.test_client() as client:
            resp = client.get(f"/clergy/{deleted.id}/json")
            if resp.status_code != 404:
                failures.append(
                    f"/clergy/{deleted.id}/json expected 404, got {resp.status_code}"
                )

            resp = client.get(f"/clergy/relationships/{deleted.id}")
            if resp.status_code != 404:
                failures.append(
                    f"/clergy/relationships/{deleted.id} expected 404, got {resp.status_code}"
                )

    if failures:
        for msg in failures:
            print(f"FAIL: {msg}")
        return 1

    print("OK: soft-deleted clergy filtered from list/lineage and public by-id endpoints")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
