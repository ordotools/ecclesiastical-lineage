"""Deterministic grid layout for consecration lineage (Sugiyama-lite)."""
from __future__ import annotations

from collections import defaultdict
from typing import Any

UNATTACHED_ROW_OFFSET = 2


def _link_endpoint(value: Any) -> int | None:
    if isinstance(value, dict):
        raw = value.get('id')
    else:
        raw = value
    if raw is None:
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None


def _event_sort_key(link: dict) -> tuple:
    key = link.get('event_sort_key')
    return (key is None, key if key is not None else 0)


def _node_sort_key(node: dict) -> tuple:
    date = node.get('consecration_date') or node.get('ordination_date') or ''
    return (date, (node.get('name') or '').lower(), node.get('id') or 0)


def _select_primary_consecration_links(links: list[dict]) -> list[dict]:
    """One primary consecration parent edge per target (matches get_primary_consecration)."""
    by_target: dict[int, list[dict]] = defaultdict(list)
    for link in links:
        if link.get('type') != 'consecration':
            continue
        target = _link_endpoint(link.get('target'))
        source = _link_endpoint(link.get('source'))
        if target is None or source is None:
            continue
        by_target[target].append(link)

    primary_links: list[dict] = []
    for _target, target_links in by_target.items():
        ordered = sorted(target_links, key=_event_sort_key)
        chosen = None
        for link in ordered:
            if not link.get('is_sub_conditione') and not link.get('is_invalid'):
                chosen = link
                break
        if chosen is None and ordered:
            chosen = ordered[0]
        if chosen:
            primary_links.append(chosen)
    return primary_links


def _break_cycles(edges: list[tuple[int, int]], links_by_pair: dict[tuple[int, int], dict]) -> list[tuple[int, int]]:
    """Remove newest back-edges until the graph is acyclic."""
    remaining = list(edges)

    def removal_key(edge: tuple[int, int]) -> tuple:
        meta = links_by_pair.get(edge, {})
        return (
            meta.get('event_sort_key') is None,
            meta.get('event_sort_key') or 0,
            edge[1],
            edge[0],
        )

    while _find_cycle_edge(remaining) is not None:
        candidates = [
            edge for edge in remaining
            if _find_cycle_edge([e for e in remaining if e != edge]) is None
        ]
        if candidates:
            to_remove = max(candidates, key=removal_key)
        else:
            to_remove = _find_cycle_edge(remaining)
        remaining = [edge for edge in remaining if edge != to_remove]
    return remaining


def _find_cycle_edge(edges: list[tuple[int, int]]) -> tuple[int, int] | None:
    graph: dict[int, list[int]] = defaultdict(list)
    nodes: set[int] = set()
    for source, target in edges:
        graph[source].append(target)
        nodes.add(source)
        nodes.add(target)

    visiting: set[int] = set()
    visited: set[int] = set()

    def dfs(node: int) -> tuple[int, int] | None:
        visiting.add(node)
        for child in sorted(graph.get(node, [])):
            if child in visiting:
                return (node, child)
            if child not in visited:
                found = dfs(child)
                if found:
                    return found
        visiting.remove(node)
        visited.add(node)
        return None

    for node in sorted(nodes):
        if node not in visited:
            found = dfs(node)
            if found:
                return found
    return None


def _assign_rows(
    edges: list[tuple[int, int]],
    rank_node_ids: set[int],
    lineage_root_ids: set[int],
    visible_node_ids: set[int],
) -> dict[int, int]:
    """
    Assign rows on the full ranking graph (visible nodes + hidden anchor parents).

    Structural sources start at row 0 for propagation. Visible nodes that are
    structural sources but not marked lineage roots are moved to an unattached band.
    """
    parents: dict[int, list[int]] = defaultdict(list)
    for source, target in edges:
        parents[target].append(source)

    incoming = {target for _source, target in edges}
    structural_roots = {nid for nid in rank_node_ids if nid not in incoming}

    rows: dict[int, int] = {}
    for root in structural_roots:
        rows[root] = 0

    changed = True
    while changed:
        changed = False
        for node_id in sorted(rank_node_ids):
            if node_id in structural_roots:
                continue
            parent_list = parents.get(node_id, [])
            if not parent_list:
                continue
            parent_rows = [rows[p] for p in parent_list if p in rows]
            if len(parent_rows) != len(parent_list):
                continue
            next_row = 1 + max(parent_rows)
            if rows.get(node_id) != next_row:
                rows[node_id] = next_row
                changed = True

    max_spine_row = max(rows.values()) if rows else 0
    unattached_row = max_spine_row + UNATTACHED_ROW_OFFSET

    for node_id in sorted(visible_node_ids):
        if node_id not in rows:
            rows[node_id] = unattached_row
            continue
        if node_id in structural_roots and node_id not in lineage_root_ids:
            rows[node_id] = unattached_row

    return rows, unattached_row, max_spine_row


def _assign_columns(
    rows: dict[int, int],
    edges: list[tuple[int, int]],
    lineage_root_ids: set[int],
    node_by_id: dict[int, dict],
    layout_node_ids: set[int],
    rank_node_ids: set[int],
    passes: int = 3,
) -> dict[int, int]:
    parents: dict[int, list[int]] = defaultdict(list)
    for source, target in edges:
        parents[target].append(source)

    max_row = max(rows.values()) if rows else 0
    by_row: dict[int, list[int]] = defaultdict(list)
    for node_id in rank_node_ids:
        if node_id in rows:
            by_row[rows[node_id]].append(node_id)

    cols: dict[int, int] = {}
    root_nodes = sorted(
        (nid for nid in lineage_root_ids if nid in rank_node_ids),
        key=lambda nid: _node_sort_key(node_by_id.get(nid, {'id': nid})),
    )
    if not root_nodes:
        root_nodes = sorted(
            (nid for nid in rank_node_ids if rows.get(nid) == 0),
            key=lambda nid: _node_sort_key(node_by_id.get(nid, {'id': nid})),
        )
    for idx, root_id in enumerate(root_nodes):
        cols[root_id] = idx

    for node_id in sorted(rank_node_ids):
        if node_id not in cols:
            cols[node_id] = 0

    def barycenter(node_id: int) -> float:
        parent_cols = [cols[p] for p in parents.get(node_id, []) if p in cols]
        if parent_cols:
            parent_cols.sort()
            mid = len(parent_cols) // 2
            if len(parent_cols) % 2:
                return float(parent_cols[mid])
            return (parent_cols[mid - 1] + parent_cols[mid]) / 2.0
        return float(cols.get(node_id, 0))

    for _ in range(passes):
        for row_idx in range(max_row + 1):
            row_nodes = [n for n in by_row.get(row_idx, []) if n in cols]
            if row_idx == 0:
                row_nodes.sort(key=lambda nid: _node_sort_key(node_by_id.get(nid, {'id': nid})))
            else:
                row_nodes.sort(
                    key=lambda nid: (
                        barycenter(nid),
                        *_node_sort_key(node_by_id.get(nid, {'id': nid})),
                    )
                )
            for idx, node_id in enumerate(row_nodes):
                cols[node_id] = idx

    _compact_columns(cols, rows, parents, rank_node_ids)
    return {nid: cols[nid] for nid in layout_node_ids if nid in cols}


def _compact_columns(
    cols: dict[int, int],
    rows: dict[int, int],
    parents: dict[int, list[int]],
    node_ids: set[int],
) -> None:
    """Shift columns left globally while preserving within-row order."""
    by_row: dict[int, list[int]] = defaultdict(list)
    for node_id in node_ids:
        if node_id in rows:
            by_row[rows[node_id]].append(node_id)

    used: dict[int, set[int]] = defaultdict(set)
    for row_idx in sorted(by_row.keys()):
        ordered = sorted(by_row[row_idx], key=lambda nid: cols.get(nid, 0))
        for node_id in ordered:
            preferred = None
            parent_list = parents.get(node_id, [])
            if parent_list:
                parent_cols = [cols[p] for p in parent_list if p in cols]
                if parent_cols:
                    preferred = min(parent_cols)
            start = preferred if preferred is not None else 0
            col = start
            while col in used[row_idx]:
                col += 1
            cols[node_id] = col
            used[row_idx].add(col)


def compute_lineage_grid_layout(
    nodes: list[dict],
    links: list[dict],
    *,
    rank_links: list[dict] | None = None,
    lineage_root_ids: list[int] | None = None,
    show_priests: bool = False,
) -> dict[str, Any]:
    """
    Compute deterministic (row, col) positions for clergy cards.

    Primary spine uses principal consecration edges from rank_links (full DAG,
    including hidden/excluded consecrators as row anchors). Priests without
    consecration are excluded unless show_priests=True.
    """
    node_by_id = {n['id']: n for n in nodes if n.get('id') is not None}
    visible_ids = set(node_by_id.keys())

    consecration_participants = set()
    participant_links = list(links)
    if rank_links is not None:
        participant_links = participant_links + list(rank_links)
    for link in participant_links:
        if link.get('type') != 'consecration':
            continue
        source = _link_endpoint(link.get('source'))
        target = _link_endpoint(link.get('target'))
        if source is not None:
            consecration_participants.add(source)
        if target is not None:
            consecration_participants.add(target)

    if show_priests:
        layout_node_ids = set(visible_ids)
    else:
        layout_node_ids = {nid for nid in visible_ids if nid in consecration_participants}

    ranking_source_links = rank_links if rank_links is not None else links
    primary_links = _select_primary_consecration_links(ranking_source_links)
    links_by_pair = {
        (_link_endpoint(l.get('source')), _link_endpoint(l.get('target'))): l
        for l in primary_links
        if _link_endpoint(l.get('source')) is not None and _link_endpoint(l.get('target')) is not None
    }

    full_edges = list(links_by_pair.keys())
    full_edges = _break_cycles(full_edges, links_by_pair)
    rank_node_ids = set()
    for source, target in full_edges:
        rank_node_ids.add(source)
        rank_node_ids.add(target)
    rank_node_ids.update(layout_node_ids)

    lineage_roots = set(lineage_root_ids or [])
    for node in nodes:
        if node.get('is_lineage_root') and node.get('id') in layout_node_ids:
            lineage_roots.add(node['id'])

    rows, unattached_row, max_spine_row = _assign_rows(
        full_edges, rank_node_ids, lineage_roots, layout_node_ids,
    )
    all_cols = _assign_columns(
        rows,
        full_edges,
        lineage_roots,
        node_by_id,
        layout_node_ids,
        rank_node_ids,
    )

    visible_edges = [
        (s, t) for s, t in full_edges
        if s in layout_node_ids and t in layout_node_ids
    ]

    positions = {
        nid: {'row': rows[nid], 'col': all_cols[nid]}
        for nid in layout_node_ids
        if nid in rows and nid in all_cols
    }

    primary_edge_keys = [
        {'source': s, 'target': t}
        for s, t in sorted(visible_edges)
    ]

    return {
        'positions': positions,
        'primary_edges': primary_edge_keys,
        'layout_node_ids': sorted(layout_node_ids),
        'max_spine_row': max_spine_row,
        'unattached_row': unattached_row,
    }
