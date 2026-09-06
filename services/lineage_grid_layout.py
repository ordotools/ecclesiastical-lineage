"""Deterministic timeline packing for consecration lineage grid."""
from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path
from typing import Any

_CONFIG_PATH = Path(__file__).resolve().parent.parent / 'static' / 'config' / 'grid-metrics.json'
with _CONFIG_PATH.open(encoding='utf-8') as _config_file:
    _GRID_METRICS: dict[str, int] = json.load(_config_file)

CARD_W = _GRID_METRICS['CARD_W']
CARD_H = _GRID_METRICS['CARD_H']
GAP_X = _GRID_METRICS['GAP_X']
GAP_Y = _GRID_METRICS['GAP_Y']
PAD = _GRID_METRICS['PAD']
DATE_SCALE = _GRID_METRICS['DATE_SCALE']
MIN_CHILD_GAP = CARD_W + GAP_X
CLUSTER_GAP = GAP_Y


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


def _link_year(link: dict, node: dict) -> int | None:
    key = link.get('event_sort_key')
    if key is not None:
        return int(key) // 10000
    date = node.get('consecration_date') or node.get('ordination_date') or ''
    if len(date) >= 4:
        try:
            return int(date[:4])
        except ValueError:
            pass
    return None


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


def _build_primary_children(
    edges: list[tuple[int, int]],
    links_by_pair: dict[tuple[int, int], dict],
    layout_node_ids: set[int],
) -> dict[int, list[tuple[int, dict]]]:
    children: dict[int, list[tuple[int, dict]]] = defaultdict(list)
    for source, target in edges:
        if source not in layout_node_ids or target not in layout_node_ids:
            continue
        meta = links_by_pair.get((source, target), {})
        children[source].append((target, {'source': source, 'target': target, **meta}))
    for source in children:
        children[source].sort(key=lambda item: (_event_sort_key(item[1]), item[0]))
    return children


def _compute_descendant_metrics(
    children: dict[int, list[tuple[int, dict]]],
    node_ids: set[int],
) -> tuple[dict[int, int], dict[int, int]]:
    direct_count = {nid: len(children.get(nid, [])) for nid in node_ids}
    total_descendants: dict[int, int] = {}

    for nid in sorted(node_ids):
        seen: set[int] = set()
        stack = [child_id for child_id, _link in children.get(nid, [])]
        while stack:
            child_id = stack.pop()
            if child_id in seen:
                continue
            seen.add(child_id)
            stack.extend(c for c, _l in children.get(child_id, []))
        total_descendants[nid] = len(seen)

    return direct_count, total_descendants


def _child_side(index: int) -> str:
    return 'above' if index % 2 == 0 else 'below'


def _compute_extents(
    node_id: int,
    children: dict[int, list[tuple[int, dict]]],
    cache: dict[int, dict[str, int]],
) -> dict[str, int]:
    if node_id in cache:
        return cache[node_id]

    child_list = list(children.get(node_id, []))
    if not child_list:
        cache[node_id] = {'above': 0, 'below': 0}
        return cache[node_id]

    extent_above = 0
    extent_below = 0
    for idx, (child_id, _link) in enumerate(child_list):
        child_ext = _compute_extents(child_id, children, cache)
        side = _child_side(idx)
        toward_parent = child_ext['below'] if side == 'above' else child_ext['above']
        slot = CARD_H + GAP_Y + toward_parent
        if side == 'above':
            extent_above = max(extent_above, slot)
        else:
            extent_below = max(extent_below, slot)

    cache[node_id] = {'above': extent_above, 'below': extent_below}
    return cache[node_id]


def _compute_subtree_width(
    node_id: int,
    children: dict[int, list[tuple[int, dict]]],
    node_by_id: dict[int, dict],
    width_cache: dict[int, int],
    x_cache: dict[int, list[tuple[int, float]]],
) -> int:
    if node_id in width_cache:
        return width_cache[node_id]

    child_list = list(children.get(node_id, []))
    if not child_list:
        width_cache[node_id] = CARD_W
        x_cache[node_id] = []
        return CARD_W

    child_xs = _compute_child_x_positions(node_id, child_list, node_by_id, children, width_cache, x_cache)
    x_cache[node_id] = list(zip([c for c, _ in child_list], child_xs))

    max_right = CARD_W
    for (child_id, _link), rel_x in zip(child_list, child_xs):
        child_width = _compute_subtree_width(child_id, children, node_by_id, width_cache, x_cache)
        max_right = max(max_right, rel_x + child_width)

    width_cache[node_id] = max_right
    return max_right


def _compute_child_x_positions(
    parent_id: int,
    child_list: list[tuple[int, dict]],
    node_by_id: dict[int, dict],
    children: dict[int, list[tuple[int, dict]]],
    width_cache: dict[int, int],
    x_cache: dict[int, list[tuple[int, float]]],
) -> list[float]:
    """Relative X offsets from parent card left edge."""
    if not child_list:
        return []

    base_x = float(CARD_W + GAP_X)
    positions: list[float] = []
    prev_end = base_x - GAP_X
    prev_year: int | None = None

    for child_id, link in child_list:
        node = node_by_id.get(child_id, {'id': child_id})
        year = _link_year(link, node)
        child_width = _compute_subtree_width(child_id, children, node_by_id, width_cache, x_cache)

        if year is not None and prev_year is not None:
            gap = max(MIN_CHILD_GAP, DATE_SCALE * (year - prev_year))
        elif not positions:
            gap = GAP_X
        else:
            gap = MIN_CHILD_GAP

        x = prev_end + gap
        positions.append(x)
        prev_end = x + child_width
        if year is not None:
            prev_year = year

    return positions


def _seed_rank_key(
    node_id: int,
    total_descendants: dict[int, int],
    node_by_id: dict[int, dict],
) -> tuple:
    return (
        -total_descendants.get(node_id, 0),
        *_node_sort_key(node_by_id.get(node_id, {'id': node_id})),
    )


def _select_cluster_seeds(
    layout_node_ids: set[int],
    children: dict[int, list[tuple[int, dict]]],
    parents: dict[int, list[int]],
    total_descendants: dict[int, int],
    node_by_id: dict[int, dict],
) -> list[int]:
    placed: set[int] = set()
    seeds: list[int] = []

    while len(placed) < len(layout_node_ids):
        candidates = [
            nid for nid in layout_node_ids
            if nid not in placed
            and all(p not in layout_node_ids or p in placed for p in parents.get(nid, []))
        ]
        if not candidates:
            candidates = [nid for nid in layout_node_ids if nid not in placed]

        seed = min(candidates, key=lambda nid: _seed_rank_key(nid, total_descendants, node_by_id))
        seeds.append(seed)

        stack = [seed]
        while stack:
            node_id = stack.pop()
            if node_id in placed or node_id not in layout_node_ids:
                continue
            placed.add(node_id)
            stack.extend(child_id for child_id, _link in children.get(node_id, []))

    return seeds


def _place_subtree(
    node_id: int,
    x: float,
    y: float,
    children: dict[int, list[tuple[int, dict]]],
    node_by_id: dict[int, dict],
    extents: dict[int, dict[str, int]],
    width_cache: dict[int, int],
    x_cache: dict[int, list[tuple[int, float]]],
    positions: dict[int, dict[str, float | str]],
    buses: list[dict],
    placed: set[int],
    side: str | None = None,
) -> None:
    if node_id in placed:
        return

    pos: dict[str, float | str] = {'x': x, 'y': y}
    if side:
        pos['side'] = side
    positions[node_id] = pos
    placed.add(node_id)

    child_list = list(children.get(node_id, []))
    if not child_list:
        return

    timeline_y = y + CARD_H / 2.0
    rel_xs = [rel_x for _cid, rel_x in x_cache.get(node_id, [])]
    if len(rel_xs) != len(child_list):
        rel_xs = _compute_child_x_positions(
            node_id, child_list, node_by_id, children, width_cache, x_cache,
        )
        x_cache[node_id] = list(zip([c for c, _ in child_list], rel_xs))

    bus_targets: list[dict] = []

    for idx, ((child_id, _link), rel_x) in enumerate(zip(child_list, rel_xs)):
        if child_id in placed:
            continue
        child_side = _child_side(idx)
        child_ext = extents[child_id]
        child_x = x + rel_x

        if child_side == 'above':
            child_y = timeline_y - (GAP_Y + child_ext['below'] + CARD_H)
        else:
            child_y = timeline_y + GAP_Y + child_ext['above']

        bus_targets.append({'target': child_id, 'side': child_side})
        _place_subtree(
            child_id, child_x, child_y,
            children, node_by_id, extents, width_cache, x_cache,
            positions, buses, placed, side=child_side,
        )

    if bus_targets:
        timeline_start_x = x + CARD_W
        timeline_end_x = x + max(
            rel_x + width_cache.get(child_id, CARD_W)
            for (child_id, _link), rel_x in zip(child_list, rel_xs)
        )
        buses.append({
            'source': node_id,
            'timeline_y': timeline_y,
            'timeline_start_x': timeline_start_x,
            'timeline_end_x': timeline_end_x,
            'targets': bus_targets,
        })


def _compute_bounds(positions: dict[int, dict[str, float | str]]) -> dict[str, float]:
    if not positions:
        return {'width': PAD * 2, 'height': PAD * 2, 'min_y': PAD}

    max_x = max(float(pos['x']) for pos in positions.values()) + CARD_W
    min_y = min(float(pos['y']) for pos in positions.values())
    max_y = max(float(pos['y']) for pos in positions.values()) + CARD_H

    return {
        'width': max_x + PAD,
        'height': max_y + PAD,
        'min_y': min_y,
    }


def compute_lineage_grid_layout(
    nodes: list[dict],
    links: list[dict],
    *,
    rank_links: list[dict] | None = None,
    lineage_root_ids: list[int] | None = None,
    show_priests: bool = False,
) -> dict[str, Any]:
    """
    Compute deterministic pixel positions for clergy cards.

    Largest descendant trees placed first; children on date-scaled timelines
    alternating above/below parent with nested subtree extent offsets.
    """
    node_by_id = {n['id']: n for n in nodes if n.get('id') is not None}
    visible_ids = set(node_by_id.keys())

    consecration_participants: set[int] = set()
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

    full_edges = _break_cycles(list(links_by_pair.keys()), links_by_pair)
    visible_primary_edges = [
        (s, t) for s, t in full_edges
        if s in layout_node_ids and t in layout_node_ids
    ]

    primary_children = _build_primary_children(full_edges, links_by_pair, layout_node_ids)

    parents: dict[int, list[int]] = defaultdict(list)
    for source, target in visible_primary_edges:
        parents[target].append(source)

    direct_count, total_descendants = _compute_descendant_metrics(primary_children, layout_node_ids)

    extent_cache: dict[int, dict[str, int]] = {}
    for nid in layout_node_ids:
        _compute_extents(nid, primary_children, extent_cache)

    width_cache: dict[int, int] = {}
    x_cache: dict[int, list[tuple[int, float]]] = {}
    for nid in layout_node_ids:
        _compute_subtree_width(nid, primary_children, node_by_id, width_cache, x_cache)

    seeds = _select_cluster_seeds(
        layout_node_ids, primary_children, parents, total_descendants, node_by_id,
    )

    positions: dict[int, dict[str, float | str]] = {}
    buses: list[dict] = []
    placed: set[int] = set()
    cluster_y = float(PAD)

    for seed in seeds:
        if seed in placed:
            continue
        ext = extent_cache.get(seed, {'above': 0, 'below': 0})
        seed_y = cluster_y + ext['above']
        _place_subtree(
            seed, float(PAD), seed_y,
            primary_children, node_by_id, extent_cache, width_cache, x_cache,
            positions, buses, placed,
        )
        cluster_y = seed_y + CARD_H + ext['below'] + CLUSTER_GAP

    # Normalize Y so minimum card top is at PAD
    if positions:
        min_y = min(float(pos['y']) for pos in positions.values())
        y_shift = PAD - min_y if min_y < PAD else 0
        if y_shift:
            for pos in positions.values():
                pos['y'] = float(pos['y']) + y_shift
            for bus in buses:
                bus['timeline_y'] = float(bus['timeline_y']) + y_shift

    bounds = _compute_bounds(positions)

    primary_edge_keys = [
        {'source': s, 'target': t}
        for s, t in sorted(visible_primary_edges)
    ]

    metrics = {
        nid: {
            'direct_count': direct_count.get(nid, 0),
            'total_descendants': total_descendants.get(nid, 0),
        }
        for nid in layout_node_ids
    }

    return {
        'positions': {nid: positions[nid] for nid in layout_node_ids if nid in positions},
        'primary_edges': primary_edge_keys,
        'buses': buses,
        'layout_node_ids': sorted(layout_node_ids),
        'bounds': bounds,
        'metrics': metrics,
        'grid_metrics': dict(_GRID_METRICS),
    }
