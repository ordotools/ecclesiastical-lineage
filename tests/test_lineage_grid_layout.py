#!/usr/bin/env python3
"""
Tests for timeline-packing grid layout (pixel positions).

Run from project root:

    python3 -m tests.test_lineage_grid_layout
"""

import os
import sys


sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


from services.lineage_grid_layout import (
    CARD_H,
    CARD_W,
    DATE_SCALE,
    GAP_X,
    GAP_Y,
    MIN_CHILD_GAP,
    PAD,
    compute_lineage_grid_layout,
)


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
        int(node_id): (round(float(pos['x']), 1), round(float(pos['y']), 1))
        for node_id, pos in sorted(layout['positions'].items(), key=lambda item: item[0])
    }


def test_fixture_primary_edges_and_metrics():
    layout = compute_lineage_grid_layout(FIXTURE_NODES, FIXTURE_LINKS, show_priests=False)

    assert 6 not in layout['positions'], 'priests excluded by default'
    assert layout['metrics'][1]['total_descendants'] == 3
    assert layout['metrics'][2]['total_descendants'] == 0
    assert layout['primary_edges'] == [
        {'source': 1, 'target': 3},
        {'source': 1, 'target': 4},
        {'source': 3, 'target': 5},
    ]


def test_largest_descendant_tree_first():
    layout = compute_lineage_grid_layout(FIXTURE_NODES, FIXTURE_LINKS, show_priests=False)
    pos = layout['positions']

    assert pos[1]['y'] < pos[2]['y'], 'larger tree (node 1) should sit above smaller root (node 2)'


def test_show_priests_includes_non_consecrated():
    layout = compute_lineage_grid_layout(FIXTURE_NODES, FIXTURE_LINKS, show_priests=True)
    assert 6 in layout['positions']


def test_deterministic_repeat():
    first = positions_snapshot(compute_lineage_grid_layout(FIXTURE_NODES, FIXTURE_LINKS))
    second = positions_snapshot(compute_lineage_grid_layout(FIXTURE_NODES, FIXTURE_LINKS))
    assert first == second


def test_cycle_breaking_is_stable():
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
    assert positions_snapshot(layout) == positions_snapshot(
        compute_lineage_grid_layout(cyclic_nodes, cyclic_links),
    )


def test_children_alternate_above_and_below():
    layout = compute_lineage_grid_layout(FIXTURE_NODES, FIXTURE_LINKS, show_priests=False)
    pos = layout['positions']

    assert pos[3]['side'] == 'above'
    assert pos[4]['side'] == 'below'
    assert pos[3]['y'] < pos[1]['y']
    assert pos[4]['y'] > pos[1]['y']


def test_date_order_left_to_right():
    layout = compute_lineage_grid_layout(FIXTURE_NODES, FIXTURE_LINKS, show_priests=False)
    pos = layout['positions']

    assert pos[3]['x'] < pos[4]['x'], '1970 child should be left of 1971 child'


def test_larger_year_gap_wider_x():
    nodes = [
        {'id': 1, 'name': 'Hub', 'is_lineage_root': True},
        {'id': 2, 'name': 'Early', 'consecration_date': '1980-01-01'},
        {'id': 3, 'name': 'Late', 'consecration_date': '2000-01-01'},
    ]
    links = [
        {'source': 1, 'target': 2, 'type': 'consecration', 'event_sort_key': 19800101},
        {'source': 1, 'target': 3, 'type': 'consecration', 'event_sort_key': 20000101},
    ]
    layout = compute_lineage_grid_layout(nodes, links, rank_links=links)
    pos = layout['positions']
    gap = pos[3]['x'] - pos[2]['x']
    assert gap >= max(MIN_CHILD_GAP, DATE_SCALE * 20)


def test_nested_child_hub_vertical_offset():
    hub_id = 10
    child_hub_id = 20
    nodes = [
        {'id': hub_id, 'name': 'Parent Hub', 'is_lineage_root': True},
        {'id': child_hub_id, 'name': 'Child Hub'},
    ]
    links = []
    for i in range(5):
        leaf_id = 100 + i
        nodes.append({'id': leaf_id, 'name': f'Leaf {i}'})
        links.append({
            'source': child_hub_id,
            'target': leaf_id,
            'type': 'consecration',
            'event_sort_key': 20000101 + i,
        })
    links.append({
        'source': hub_id,
        'target': child_hub_id,
        'type': 'consecration',
        'event_sort_key': 19900101,
    })

    layout = compute_lineage_grid_layout(nodes, links, rank_links=links)
    pos = layout['positions']
    timeline = pos[hub_id]['y'] + CARD_H / 2
    child = pos[child_hub_id]

    if child.get('side') == 'above':
        gap = timeline - (child['y'] + CARD_H)
    else:
        gap = child['y'] - timeline
    assert gap >= GAP_Y - 1, 'child hub should clear parent timeline by at least GAP_Y'

    child_hub_bus = next(b for b in layout['buses'] if b['source'] == child_hub_id)
    assert len(child_hub_bus['targets']) == 5


def test_unknown_dates_after_known():
    nodes = [
        {'id': 1, 'name': 'Root', 'is_lineage_root': True},
        {'id': 2, 'name': 'Dated', 'consecration_date': '1985-01-01'},
        {'id': 3, 'name': 'Unknown'},
    ]
    links = [
        {'source': 1, 'target': 2, 'type': 'consecration', 'event_sort_key': 19850101},
        {'source': 1, 'target': 3, 'type': 'consecration'},
    ]
    layout = compute_lineage_grid_layout(nodes, links, rank_links=links)
    pos = layout['positions']
    assert pos[2]['x'] < pos[3]['x'], 'unknown-date child should sit right of dated child'


def test_unique_positions():
    layout = compute_lineage_grid_layout(FIXTURE_NODES, FIXTURE_LINKS, show_priests=False)
    coords = [(round(pos['x'], 1), round(pos['y'], 1)) for pos in layout['positions'].values()]
    assert len(coords) == len(set(coords)), 'each card must occupy a unique position'


def test_grid_metrics_match_frontend():
    layout = compute_lineage_grid_layout(FIXTURE_NODES, FIXTURE_LINKS)
    gm = layout['grid_metrics']
    assert gm['CARD_W'] == 168
    assert gm['CARD_H'] == 136
    assert gm['GAP_X'] == 52
    assert gm['GAP_Y'] == 64
    assert gm['PAD'] == 48
    assert gm['CARD_INSET'] == 4
    assert gm['LANE_PITCH'] == 9
    assert gm['DATE_SCALE'] == 8


def test_bus_timeline_bounds():
    hub_id = 100
    nodes = [{'id': hub_id, 'name': 'Hub Bishop', 'is_lineage_root': True}]
    links = []
    for i in range(3):
        child_id = 200 + i
        nodes.append({'id': child_id, 'name': f'Child {i}'})
        links.append({
            'source': hub_id,
            'target': child_id,
            'type': 'consecration',
            'event_sort_key': 19800101 + i * 10000,
        })

    layout = compute_lineage_grid_layout(nodes, links, rank_links=links)
    bus = layout['buses'][0]
    hub_x = layout['positions'][hub_id]['x']

    assert bus['timeline_start_x'] == hub_x + CARD_W
    assert bus['timeline_end_x'] >= bus['timeline_start_x']
    assert abs(bus['timeline_y'] - (layout['positions'][hub_id]['y'] + CARD_H / 2)) < 0.01


def test_children_strictly_ltr_within_bus():
    layout = compute_lineage_grid_layout(FIXTURE_NODES, FIXTURE_LINKS, show_priests=False)
    pos = layout['positions']
    bus = next(b for b in layout['buses'] if b['source'] == 1)
    timeline_start = bus['timeline_start_x']

    child_ids = [entry['target'] for entry in bus['targets']]
    child_xs = [pos[cid]['x'] for cid in child_ids]
    assert child_xs == sorted(child_xs), 'children must be ordered left-to-right'

    for child_id in child_ids:
        assert pos[child_id]['x'] >= timeline_start + GAP_X - 0.01, (
            f'child {child_id} must sit right of parent timeline start'
        )

    for left_id, right_id in zip(child_ids, child_ids[1:]):
        assert pos[right_id]['x'] > pos[left_id]['x'], 'each child must be strictly right of prior sibling'


def test_hub_emits_bus_with_timeline_y():
    hub_id = 100
    nodes = [{'id': hub_id, 'name': 'Hub Bishop', 'is_lineage_root': True}]
    links = []
    for i in range(4):
        child_id = 200 + i
        nodes.append({'id': child_id, 'name': f'Child {i}'})
        links.append({
            'source': hub_id,
            'target': child_id,
            'type': 'consecration',
            'event_sort_key': 19800101 + i * 10000,
        })

    layout = compute_lineage_grid_layout(nodes, links, rank_links=links)
    assert len(layout['buses']) == 1
    bus = layout['buses'][0]
    assert bus['source'] == hub_id
    assert 'timeline_y' in bus
    assert len(bus['targets']) == 4
    expected_timeline = layout['positions'][hub_id]['y'] + CARD_H / 2
    assert abs(bus['timeline_y'] - expected_timeline) < 0.01


def test_bounds_present():
    layout = compute_lineage_grid_layout(FIXTURE_NODES, FIXTURE_LINKS)
    assert layout['bounds']['width'] >= PAD + CARD_W
    assert layout['bounds']['height'] >= PAD + CARD_H


def main():
    tests = [
        test_fixture_primary_edges_and_metrics,
        test_largest_descendant_tree_first,
        test_show_priests_includes_non_consecrated,
        test_deterministic_repeat,
        test_cycle_breaking_is_stable,
        test_children_alternate_above_and_below,
        test_date_order_left_to_right,
        test_larger_year_gap_wider_x,
        test_nested_child_hub_vertical_offset,
        test_unknown_dates_after_known,
        test_unique_positions,
        test_grid_metrics_match_frontend,
        test_bus_timeline_bounds,
        test_children_strictly_ltr_within_bus,
        test_hub_emits_bus_with_timeline_y,
        test_bounds_present,
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
