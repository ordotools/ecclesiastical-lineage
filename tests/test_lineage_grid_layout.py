#!/usr/bin/env python3
"""
Snapshot-style tests for deterministic grid layout positions.

Run from project root:

    python -m tests.test_lineage_grid_layout
"""

import os
import sys


sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


FIXTURE_NODES = [
    {'id': 1, 'name': 'Root Alpha', 'consecration_date': '1950-01-01', 'is_lineage_root': True},
    {'id': 2, 'name': 'Root Beta', 'consecration_date': '1952-01-01', 'is_lineage_root': True},
    {'id': 3, 'name': 'Child One', 'consecration_date': '1970-06-01'},
    {'id': 4, 'name': 'Child Two', 'consecration_date': '1971-03-15'},
    {'id': 5, 'name': 'Grandchild', 'consecration_date': '1990-09-20'},
    {'id': 6, 'name': 'Priest Only', 'rank': 'Priest', 'ordination_date': '1985-01-01'},
]

FIXTURE_LINKS = [
    {
        'source': 1, 'target': 3, 'type': 'consecration',
        'event_sort_key': 19700601, 'is_sub_conditione': False, 'is_invalid': False,
    },
    {
        'source': 1, 'target': 4, 'type': 'consecration',
        'event_sort_key': 19710315, 'is_sub_conditione': False, 'is_invalid': False,
    },
    {
        'source': 2, 'target': 4, 'type': 'consecration',
        'event_sort_key': 19710315, 'is_sub_conditione': True, 'is_invalid': False,
    },
    {
        'source': 3, 'target': 5, 'type': 'consecration',
        'event_sort_key': 19900920, 'is_sub_conditione': False, 'is_invalid': False,
    },
    {
        'source': 1, 'target': 6, 'type': 'ordination',
        'event_sort_key': 19850101, 'is_sub_conditione': False, 'is_invalid': False,
    },
]


def positions_snapshot(layout):
    return {
        int(node_id): (pos['row'], pos['col'])
        for node_id, pos in sorted(layout['positions'].items(), key=lambda item: item[0])
    }


def test_fixture_snapshot():
    from services.lineage_grid_layout import compute_lineage_grid_layout

    layout = compute_lineage_grid_layout(FIXTURE_NODES, FIXTURE_LINKS, show_priests=False)
    snapshot = positions_snapshot(layout)

    assert 6 not in snapshot, 'priests excluded by default'
    assert snapshot[1] == (0, 0)
    assert snapshot[2] == (0, 1)
    assert snapshot[5][0] == 2
    assert snapshot[3][0] == 1
    assert snapshot[4][0] == 1
    assert layout['primary_edges'] == [{'source': 1, 'target': 3}, {'source': 1, 'target': 4}, {'source': 3, 'target': 5}]


def test_show_priests_includes_non_consecrated():
    from services.lineage_grid_layout import compute_lineage_grid_layout

    layout = compute_lineage_grid_layout(FIXTURE_NODES, FIXTURE_LINKS, show_priests=True)
    assert 6 in layout['positions']


def test_deterministic_repeat():
    from services.lineage_grid_layout import compute_lineage_grid_layout

    first = positions_snapshot(compute_lineage_grid_layout(FIXTURE_NODES, FIXTURE_LINKS))
    second = positions_snapshot(compute_lineage_grid_layout(FIXTURE_NODES, FIXTURE_LINKS))
    assert first == second


def test_cycle_breaking_is_stable():
    from services.lineage_grid_layout import compute_lineage_grid_layout

    cyclic_nodes = [
        {'id': 10, 'name': 'A'},
        {'id': 11, 'name': 'B'},
        {'id': 12, 'name': 'C'},
    ]
    cyclic_links = [
        {'source': 10, 'target': 11, 'type': 'consecration', 'event_sort_key': 20000101},
        {'source': 11, 'target': 12, 'type': 'consecration', 'event_sort_key': 20010101},
        {'source': 12, 'target': 10, 'type': 'consecration', 'event_sort_key': 20020101},
    ]
    layout = compute_lineage_grid_layout(cyclic_nodes, cyclic_links)
    assert len(layout['positions']) == 3
    assert positions_snapshot(layout) == positions_snapshot(compute_lineage_grid_layout(cyclic_nodes, cyclic_links))


def test_hidden_parent_preserves_child_depth():
    """Excluded consecrator still anchors row rank for visible consecrand."""
    from services.lineage_grid_layout import compute_lineage_grid_layout

    # Visible nodes: B and C. Hidden anchor A is excluded from nodes list.
    visible_nodes = [
        {'id': 2, 'name': 'Bishop B', 'consecration_date': '1970-01-01'},
        {'id': 3, 'name': 'Bishop C', 'consecration_date': '1990-01-01'},
    ]
    visible_links = [
        {
            'source': 2, 'target': 3, 'type': 'consecration',
            'event_sort_key': 19900101, 'is_sub_conditione': False, 'is_invalid': False,
        },
    ]
    rank_links = [
        {
            'source': 1, 'target': 2, 'type': 'consecration',
            'event_sort_key': 19700101, 'is_sub_conditione': False, 'is_invalid': False,
        },
        {
            'source': 2, 'target': 3, 'type': 'consecration',
            'event_sort_key': 19900101, 'is_sub_conditione': False, 'is_invalid': False,
        },
    ]
    layout = compute_lineage_grid_layout(
        visible_nodes,
        visible_links,
        rank_links=rank_links,
    )
    snapshot = positions_snapshot(layout)

    assert 2 in snapshot and 3 in snapshot
    assert snapshot[2][0] == 1, 'B should be one generation below hidden parent A'
    assert snapshot[3][0] == 2, 'C should be two generations below hidden parent A'
    assert snapshot[2][0] != 0, 'B must not flatten to row 0 when parent exists in rank graph'


def test_shared_hidden_consecrator_not_all_row_zero():
    """Multiple bishops sharing a hidden consecrator must not all sit on row 0."""
    from services.lineage_grid_layout import compute_lineage_grid_layout

    visible_nodes = [
        {'id': 10, 'name': 'Bishop X'},
        {'id': 11, 'name': 'Bishop Y'},
        {'id': 12, 'name': 'Bishop Z'},
    ]
    visible_links = []
    rank_links = [
        {'source': 1, 'target': 10, 'type': 'consecration', 'event_sort_key': 19700101},
        {'source': 1, 'target': 11, 'type': 'consecration', 'event_sort_key': 19710101},
        {'source': 1, 'target': 12, 'type': 'consecration', 'event_sort_key': 19720101},
    ]
    layout = compute_lineage_grid_layout(
        visible_nodes,
        visible_links,
        rank_links=rank_links,
    )
    snapshot = positions_snapshot(layout)
    rows = {snapshot[nid][0] for nid in (10, 11, 12)}
    assert rows == {1}, 'all visible consecrands share row 1 under hidden consecrator'
    assert 0 not in rows


def test_lineage_root_at_row_zero_consecrands_below():
    from services.lineage_grid_layout import compute_lineage_grid_layout

    nodes = [
        {'id': 100, 'name': 'Apostolic Root', 'is_lineage_root': True},
        {'id': 101, 'name': 'Successor'},
    ]
    links = [
        {
            'source': 100, 'target': 101, 'type': 'consecration',
            'event_sort_key': 19800101, 'is_sub_conditione': False, 'is_invalid': False,
        },
    ]
    layout = compute_lineage_grid_layout(nodes, links, rank_links=links, lineage_root_ids=[100])
    snapshot = positions_snapshot(layout)
    assert snapshot[100][0] == 0
    assert snapshot[101][0] == 1


def test_unattached_orphan_not_mixed_into_row_zero():
    """Bishop with no consecrator data goes to unattached band, not generation 0."""
    from services.lineage_grid_layout import compute_lineage_grid_layout

    nodes = [
        {'id': 1, 'name': 'Root', 'is_lineage_root': True},
        {'id': 2, 'name': 'Orphan'},
    ]
    links = [
        {
            'source': 1, 'target': 50, 'type': 'consecration',
            'event_sort_key': 19500101, 'is_sub_conditione': False, 'is_invalid': False,
        },
    ]
    rank_links = links + [
        # Orphan consecrated a hidden successor; no incoming consecration for orphan.
        {'source': 2, 'target': 99, 'type': 'consecration', 'event_sort_key': 19700101},
    ]
    layout = compute_lineage_grid_layout(nodes, links, rank_links=rank_links)
    snapshot = positions_snapshot(layout)
    assert snapshot[1][0] == 0
    assert snapshot[2][0] > snapshot[1][0], 'orphan without lineage root mark should not share row 0'


def main():
    tests = [
        test_fixture_snapshot,
        test_show_priests_includes_non_consecrated,
        test_deterministic_repeat,
        test_cycle_breaking_is_stable,
        test_hidden_parent_preserves_child_depth,
        test_shared_hidden_consecrator_not_all_row_zero,
        test_lineage_root_at_row_zero_consecrands_below,
        test_unattached_orphan_not_mixed_into_row_zero,
    ]
    failures = []
    for test in tests:
        try:
            test()
            print(f'OK  {test.__name__}')
        except Exception as exc:
            failures.append(f'{test.__name__}: {exc}')
            print(f'FAIL {test.__name__}: {exc}')

    if failures:
        print('\n'.join(failures))
        sys.exit(1)
    print('All lineage grid layout tests passed.')


if __name__ == '__main__':
    main()
