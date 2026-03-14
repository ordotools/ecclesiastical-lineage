#!/usr/bin/env python3
"""
Tests for editor v2 left panel flat list: one row per clergy, sorted by earliest
consecration (then ordination, then name), with filtering by rank, tag_ids, and year range.

Run from project root:

    python -m tests.test_editor_v2_rows_tree
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def main():
    from flask import request
    from app import app
    from routes.main import _lineage_nodes_links
    from routes.editor_v2 import _flat_clergy_list_for_panel_left

    with app.app_context(), app.test_request_context():
        nodes, _, _ = _lineage_nodes_links()
        if not nodes:
            print("SKIP: no lineage nodes (empty DB or no clergy)")
            return 0

        # Build clergy_id -> [tag_id] for tests (same as panel_left)
        from models import Clergy
        from sqlalchemy.orm import joinedload

        node_ids = [n["id"] for n in nodes]
        clergy_tag_ids = {}
        clergy_with_tags = (
            Clergy.query.options(joinedload(Clergy.tags))
            .filter(Clergy.id.in_(node_ids))
            .all()
        )
        for c in clergy_with_tags:
            clergy_tag_ids[c.id] = [t.id for t in (c.tags or [])]
        for nid in node_ids:
            if nid not in clergy_tag_ids:
                clergy_tag_ids[nid] = []

        # 1. Flat list has one row per clergy (one row per node)
        with app.test_request_context():
            list_no_filter = _flat_clergy_list_for_panel_left(nodes, request.args, clergy_tag_ids)
        if len(list_no_filter) != len(nodes):
            print(
                f"FAIL: flat list length {len(list_no_filter)} != node count {len(nodes)}"
            )
            return 1
        ids_in_list = {r["id"] for r in list_no_filter}
        ids_in_nodes = {n["id"] for n in nodes}
        if ids_in_list != ids_in_nodes:
            print(
                f"FAIL: flat list ids differ from nodes: missing {ids_in_nodes - ids_in_list}, extra {ids_in_list - ids_in_nodes}"
            )
            return 1

        # 2. Sort order: earliest consecration, then ordination, then name (nulls last)
        with app.test_request_context():
            ordered = _flat_clergy_list_for_panel_left(nodes, request.args, clergy_tag_ids)
        for i in range(len(ordered) - 1):
            a, b = ordered[i], ordered[i + 1]
            a_cons = a.get("consecration_date")
            b_cons = b.get("consecration_date")
            a_ord = a.get("ordination_date")
            b_ord = b.get("ordination_date")

            def sort_key_from_date(d):
                if not d or d == "Date unknown":
                    return 99999999
                s = str(d).strip()
                if len(s) >= 10 and s[4] == "-" and s[7] == "-":
                    return int(s[:4]) * 10000 + int(s[5:7]) * 100 + int(s[8:10])
                if len(s) >= 4 and s[:4].isdigit():
                    return int(s[:4]) * 10000
                return 99999999

            a_cons_k = sort_key_from_date(a_cons)
            b_cons_k = sort_key_from_date(b_cons)
            a_ord_k = sort_key_from_date(a_ord)
            b_ord_k = sort_key_from_date(b_ord)
            if a_cons_k > b_cons_k:
                print(
                    f"FAIL: sort order: consecration {a_cons} (id={a['id']}) > {b_cons} (id={b['id']})"
                )
                return 1
            if a_cons_k == b_cons_k and a_ord_k > b_ord_k:
                print(
                    f"FAIL: sort order: ordination {a_ord} (id={a['id']}) > {b_ord} (id={b['id']})"
                )
                return 1
            if a_cons_k == b_cons_k and a_ord_k == b_ord_k and (a.get("name") or "") > (b.get("name") or ""):
                print(
                    f"FAIL: sort order: name {a.get('name')!r} > {b.get('name')!r} at same dates"
                )
                return 1

        # 3. Filter by rank reduces list
        ranks_in_data = {n.get("rank") for n in nodes if n.get("rank")}
        if ranks_in_data:
            one_rank = next(iter(ranks_in_data))
            with app.test_request_context(f"/?rank={one_rank}"):
                filtered = _flat_clergy_list_for_panel_left(nodes, request.args, clergy_tag_ids)
            if not all(r.get("rank") == one_rank for r in filtered):
                print("FAIL: filter by rank: some rows have different rank")
                return 1
            expected_count = sum(1 for n in nodes if n.get("rank") == one_rank)
            if len(filtered) != expected_count:
                print(
                    f"FAIL: filter by rank: got {len(filtered)} rows, expected {expected_count}"
                )
                return 1

        # 4. Filter by tag_ids reduces list to clergy that have at least one of those tags
        all_tag_ids = set()
        for ids in clergy_tag_ids.values():
            all_tag_ids.update(ids)
        if all_tag_ids:
            one_tag = next(iter(all_tag_ids))
            with app.test_request_context(f"/?tag_ids={one_tag}"):
                filtered = _flat_clergy_list_for_panel_left(nodes, request.args, clergy_tag_ids)
            expected_ids = {cid for cid, tids in clergy_tag_ids.items() if one_tag in tids}
            got_ids = {r["id"] for r in filtered}
            if got_ids != expected_ids:
                print(
                    f"FAIL: filter by tag_ids: got {got_ids}, expected {expected_ids}"
                )
                return 1

        # 5. Filter by year_min/year_max restricts to clergy whose earliest_year is in range
        with app.test_request_context():
            full = _flat_clergy_list_for_panel_left(nodes, request.args, clergy_tag_ids)
        years = [r.get("earliest_year") for r in full if r.get("earliest_year") is not None]
        if years:
            y_min, y_max = min(years), max(years)
            if y_min < y_max:
                with app.test_request_context(f"/?year_min={y_min}&year_max={y_max}"):
                    filtered = _flat_clergy_list_for_panel_left(nodes, request.args, clergy_tag_ids)
                for r in filtered:
                    ey = r.get("earliest_year")
                    if ey is not None and (ey < y_min or ey > y_max):
                        print(
                            f"FAIL: filter by year range: row id={r['id']} has earliest_year={ey} outside [{y_min},{y_max}]"
                        )
                        return 1
            with app.test_request_context(f"/?year_min={y_max + 1}"):
                filtered = _flat_clergy_list_for_panel_left(nodes, request.args, clergy_tag_ids)
            if any(r.get("earliest_year") is not None for r in filtered):
                print("FAIL: filter year_min above max: should return no rows with a year")
                return 1

    print("OK: editor v2 flat list and filters behave as expected.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
