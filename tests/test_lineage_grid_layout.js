#!/usr/bin/env node
/**
 * Layout tests for timeline-packing grid (client-side).
 *
 * Run from project root:
 *   node tests/test_lineage_grid_layout.js
 */

import assert from 'node:assert/strict';
import {
  computeLineageGridLayout,
  routeAllEdges,
  parseTrunkPath,
  GRID_METRICS,
} from '../static/js/lineage-grid.js';

const {
  CARD_H,
  CARD_W,
  CARD_ROWS,
  ROW_H,
  GAP_X,
  GAP_Y,
  MULTI_STUB_GAP,
  PAD,
} = GRID_METRICS;
const COL_PITCH = CARD_W + GAP_X;

const FIXTURE_NODES = [
  { id: 1, name: 'Root Alpha', consecration_date: '1950-01-01', is_lineage_root: true, is_bishop: true },
  { id: 2, name: 'Root Beta', consecration_date: '1952-01-01', is_lineage_root: true, is_bishop: true },
  { id: 3, name: 'Child One', consecration_date: '1970-06-01', is_bishop: true },
  { id: 4, name: 'Child Two', consecration_date: '1971-03-15', is_bishop: true },
  { id: 5, name: 'Grandchild', consecration_date: '1990-09-20', is_bishop: true },
  { id: 6, name: 'Priest Only', rank: 'Priest', ordination_date: '1985-01-01' },
];

const FIXTURE_LINKS = [
  {
    source: 1, target: 3, type: 'consecration',
    event_sort_key: 19700601, is_sub_conditione: false, is_invalid: false,
  },
  {
    source: 1, target: 4, type: 'consecration',
    event_sort_key: 19710315, is_sub_conditione: false, is_invalid: false,
  },
  {
    source: 2, target: 4, type: 'consecration',
    event_sort_key: 19710315, is_sub_conditione: true, is_invalid: false,
  },
  {
    source: 3, target: 5, type: 'consecration',
    event_sort_key: 19900920, is_sub_conditione: false, is_invalid: false,
  },
  {
    source: 1, target: 6, type: 'ordination',
    event_sort_key: 19850101, is_sub_conditione: false, is_invalid: false,
  },
];

function positionsSnapshot(layout) {
  const snap = {};
  Object.entries(layout.positions).forEach(([nodeId, pos]) => {
    snap[Number(nodeId)] = [Math.round(pos.x * 10) / 10, Math.round(pos.y * 10) / 10];
  });
  return snap;
}

function cardRect(pos) {
  return {
    left: pos.x,
    top: pos.y,
    right: pos.x + CARD_W,
    bottom: pos.y + CARD_H,
  };
}

function rectsOverlap(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function assertNoCardOverlap(layout) {
  const rects = Object.values(layout.positions).map(cardRect);
  for (let i = 0; i < rects.length; i += 1) {
    for (let j = i + 1; j < rects.length; j += 1) {
      assert.ok(!rectsOverlap(rects[i], rects[j]), `cards ${i} and ${j} overlap`);
    }
  }
}

// Grid-cell invariants: one card per cell, and no trunk or stub passes through another card.
function assertGridClear(layout) {
  const cell = new Map();
  Object.entries(layout.positions).forEach(([id, p]) => {
    for (let r = p.row; r < p.row + CARD_ROWS; r += 1) {
      const key = `${r},${p.col}`;
      assert.ok(!cell.has(key), `cards ${cell.get(key)} and ${id} share cell ${key}`);
      cell.set(key, id);
    }
  });
  layout.buses.forEach((bus) => {
    const src = layout.positions[bus.source];
    const trunkRow = (bus.timeline_y - PAD - ROW_H / 2) / (ROW_H + GAP_Y);
    assert.ok(Number.isInteger(trunkRow), 'trunk sits on a grid row');
    const lastCol = Math.max(...bus.targets.map((t) => layout.positions[t.target].col));
    for (let c = src.col + 1; c <= lastCol; c += 1) {
      assert.ok(!cell.has(`${trunkRow},${c}`), `trunk of ${bus.source} crosses card ${cell.get(`${trunkRow},${c}`)}`);
    }
    bus.targets.forEach(({ target, side }) => {
      const p = layout.positions[target];
      assert.equal(p.side, side);
      const [from, to] = side === 'below' ? [trunkRow + 1, p.row - 1] : [p.row + CARD_ROWS, trunkRow - 1];
      for (let r = from; r <= to; r += 1) {
        assert.ok(!cell.has(`${r},${p.col}`), `stub to ${target} crosses card ${cell.get(`${r},${p.col}`)}`);
      }
    });
  });
}

function testFixturePrimaryEdgesAndMetrics() {
  const layout = computeLineageGridLayout(FIXTURE_NODES, FIXTURE_LINKS, { showPriests: false });

  assert.ok(!(6 in layout.positions), 'priests excluded by default');
  assert.equal(layout.metrics[1].total_descendants, 3);
  assert.equal(layout.metrics[2].total_descendants, 0);
  assert.deepEqual(layout.primary_edges, [
    { source: 1, target: 3 },
    { source: 1, target: 4 },
    { source: 3, target: 5 },
  ]);
}

function testLargestDescendantTreeFirst() {
  const layout = computeLineageGridLayout(FIXTURE_NODES, FIXTURE_LINKS, { showPriests: false });
  const pos = layout.positions;

  assert.ok(pos[1].y < pos[2].y, 'larger tree (node 1) should sit above smaller root (node 2)');
}

function testShowPriestsIncludesNonConsecrated() {
  const layout = computeLineageGridLayout(FIXTURE_NODES, FIXTURE_LINKS, { showPriests: true });
  assert.ok(6 in layout.positions);
}

function testDeterministicRepeat() {
  const first = positionsSnapshot(computeLineageGridLayout(FIXTURE_NODES, FIXTURE_LINKS));
  const second = positionsSnapshot(computeLineageGridLayout(FIXTURE_NODES, FIXTURE_LINKS));
  assert.deepEqual(first, second);
}

function testCycleBreakingIsStable() {
  const cyclicNodes = [
    { id: 10, name: 'A' },
    { id: 11, name: 'B' },
    { id: 12, name: 'C' },
  ];
  const cyclicLinks = [
    { source: 10, target: 11, type: 'consecration', event_sort_key: 20000101 },
    { source: 11, target: 12, type: 'consecration', event_sort_key: 20010101 },
    { source: 12, target: 10, type: 'consecration', event_sort_key: 20020101 },
  ];
  const layout = computeLineageGridLayout(cyclicNodes, cyclicLinks);
  assert.equal(Object.keys(layout.positions).length, 3);
  assert.deepEqual(
    positionsSnapshot(layout),
    positionsSnapshot(computeLineageGridLayout(cyclicNodes, cyclicLinks)),
  );
}

function testChildrenAlternateAboveAndBelow() {
  const layout = computeLineageGridLayout(FIXTURE_NODES, FIXTURE_LINKS, { showPriests: false });
  const pos = layout.positions;

  assert.equal(pos[3].side, 'above');
  assert.equal(pos[4].side, 'below');
  assert.ok(pos[3].y < pos[1].y);
  assert.ok(pos[4].y > pos[1].y);
}

function testDateOrderLeftToRight() {
  const layout = computeLineageGridLayout(FIXTURE_NODES, FIXTURE_LINKS, { showPriests: false });
  const pos = layout.positions;

  assert.ok(pos[3].x < pos[5].x, '1970 child should be left of 1990 grandchild on same rail');
}

function testLargerYearGapWiderX() {
  const nodes = [
    { id: 1, name: 'Hub', is_lineage_root: true, is_bishop: true },
    { id: 2, name: 'Early', consecration_date: '1980-01-01', is_bishop: true },
    { id: 3, name: 'LateBelow', consecration_date: '2000-01-01', is_bishop: true },
    { id: 4, name: 'LateAbove', consecration_date: '2005-01-01', is_bishop: true },
  ];
  const links = [
    { source: 1, target: 2, type: 'consecration', event_sort_key: 19800101 },
    { source: 1, target: 3, type: 'consecration', event_sort_key: 20000101 },
    { source: 1, target: 4, type: 'consecration', event_sort_key: 20050101 },
  ];
  const layout = computeLineageGridLayout(nodes, links);
  const pos = layout.positions;
  const originEarly = pos[2].x + CARD_W / 2;
  const originLate = pos[4].x + CARD_W / 2;
  assert.ok(originLate > originEarly, 'later child origin should sit right of earlier');
  assert.equal(originLate - originEarly, 2 * COL_PITCH, 'siblings take consecutive grid columns');
}

function testNestedChildHubVerticalOffset() {
  const hubId = 10;
  const childHubId = 20;
  const nodes = [
    { id: hubId, name: 'Parent Hub', is_lineage_root: true, is_bishop: true },
    { id: childHubId, name: 'Child Hub', is_bishop: true },
  ];
  const links = [];
  for (let i = 0; i < 5; i += 1) {
    const leafId = 100 + i;
    nodes.push({ id: leafId, name: `Leaf ${i}`, is_bishop: true });
    links.push({
      source: childHubId,
      target: leafId,
      type: 'consecration',
      event_sort_key: 20000101 + i,
    });
  }
  links.push({
    source: hubId,
    target: childHubId,
    type: 'consecration',
    event_sort_key: 19900101,
  });

  const layout = computeLineageGridLayout(nodes, links);
  const pos = layout.positions;
  const timeline = pos[hubId].y + CARD_H / 2;
  const child = pos[childHubId];

  let gap;
  if (child.side === 'above') {
    gap = timeline - (child.y + CARD_H);
  } else {
    gap = child.y - timeline;
  }
  assert.ok(gap >= GAP_Y, 'child hub should clear parent timeline by at least one row gap');

  const childHubBus = layout.buses.find((b) => b.source === childHubId);
  assert.equal(childHubBus.targets.length, 5);
  assertNoCardOverlap(layout);
}

function testUnknownDatesAfterKnown() {
  const nodes = [
    { id: 1, name: 'Root', is_lineage_root: true, is_bishop: true },
    { id: 2, name: 'Dated', consecration_date: '1985-01-01', is_bishop: true },
    { id: 3, name: 'Spacer', is_bishop: true },
    { id: 4, name: 'Unknown', is_bishop: true },
  ];
  const links = [
    { source: 1, target: 2, type: 'consecration', event_sort_key: 19850101 },
    { source: 1, target: 3, type: 'consecration', event_sort_key: 19900101 },
    { source: 1, target: 4, type: 'consecration' },
  ];
  const layout = computeLineageGridLayout(nodes, links);
  const pos = layout.positions;
  assert.ok(pos[2].x < pos[4].x, 'unknown-date child should sit right of dated child on same rail');
}

function testUniquePositions() {
  const layout = computeLineageGridLayout(FIXTURE_NODES, FIXTURE_LINKS, { showPriests: false });
  const coords = Object.values(layout.positions).map((pos) => [
    Math.round(pos.x * 10) / 10,
    Math.round(pos.y * 10) / 10,
  ]);
  assert.equal(new Set(coords.map(JSON.stringify)).size, coords.length);
}

function testGridMetricsMatchFrontend() {
  const layout = computeLineageGridLayout(FIXTURE_NODES, FIXTURE_LINKS);
  const gm = layout.grid_metrics;
  assert.equal(gm.CARD_W, 170);
  assert.equal(gm.ROW_H, 20);
  assert.equal(gm.CARD_ROWS, 3);
  assert.equal(gm.BUS_OFFSET_ROWS, 1);
  assert.equal(gm.CARD_H, 104, 'CARD_H derives from rows: 3 * 20 + 2 * 22');
  assert.equal(gm.GAP_X, 22);
  assert.equal(gm.GAP_Y, 22);
  assert.equal(gm.PAD, 48);
  assert.equal(gm.MULTI_STUB_GAP, 14);
  assert.equal(gm.LINEAGE_GAP, 1);
  assert.equal(gm.PACK_ASPECT, 1.6);
}

function testBusEndAtDirectChildCardsNotNested() {
  const hubId = 100;
  const childHubId = 200;
  const nodes = [
    { id: hubId, name: 'Parent Hub', is_lineage_root: true, is_bishop: true },
    { id: childHubId, name: 'Child Hub', is_bishop: true },
  ];
  const links = [];
  for (let i = 0; i < 5; i += 1) {
    const leafId = 300 + i;
    nodes.push({ id: leafId, name: `Leaf ${i}`, is_bishop: true });
    links.push({
      source: childHubId,
      target: leafId,
      type: 'consecration',
      event_sort_key: 20000101 + i,
    });
  }
  links.push({
    source: hubId,
    target: childHubId,
    type: 'consecration',
    event_sort_key: 19900101,
  });

  const layout = computeLineageGridLayout(nodes, links);
  const bus = layout.buses.find((b) => b.source === hubId);
  const pos = layout.positions;
  const hubX = pos[hubId].x;
  const childHubRight = pos[childHubId].x + CARD_W;
  const nestedLeafRight = Math.max(...[300, 301, 302, 303, 304].map((id) => pos[id].x + CARD_W));
  const trunk = parseTrunkPath(routeAllEdges(links, pos, layout).get(`bus-trunk:${hubId}`));

  assert.ok(bus, 'parent hub should emit a bus');
  assert.equal(bus.timeline_start_x, hubX + CARD_W);
  assert.ok(trunk.xMax <= childHubRight, 'bus end should stop at direct child card, not nested descendants');
  assert.ok(nestedLeafRight > trunk.xMax, 'nested descendants should extend past parent bus trunk');
}

function testChronologicalOriginsWithMinGap() {
  const hubId = 10;
  const nodes = [
    { id: hubId, name: 'Hub', is_lineage_root: true, is_bishop: true },
    { id: 11, name: 'Above', is_bishop: true },
    { id: 12, name: 'Below', is_bishop: true },
    { id: 13, name: 'Later', is_bishop: true },
  ];
  const links = [
    { source: hubId, target: 11, type: 'consecration', event_sort_key: 19800101 },
    { source: hubId, target: 12, type: 'consecration', event_sort_key: 19810101 },
    { source: hubId, target: 13, type: 'consecration', event_sort_key: 19820101 },
  ];
  const layout = computeLineageGridLayout(nodes, links);
  const pos = layout.positions;

  assert.equal(pos[11].side, 'above');
  assert.equal(pos[12].side, 'below');
  assert.ok(pos[12].x > pos[11].x, 'later event should sit right of earlier event');
  assert.ok(pos[13].x > pos[12].x, 'third event should continue LTR');

  assert.deepEqual([11, 12, 13].map((id) => pos[id].col - pos[hubId].col), [1, 2, 3],
    'children take consecutive columns after the hub');
}

function testLeafBranchUsesMinimalEvenPitch() {
  const hubId = 20;
  const nodes = [
    { id: hubId, name: 'Hub', is_lineage_root: true, is_bishop: true },
    { id: 21, name: 'A', is_bishop: true },
    { id: 22, name: 'B', is_bishop: true },
  ];
  const links = [
    { source: hubId, target: 21, type: 'consecration', event_sort_key: 19800101 },
    { source: hubId, target: 22, type: 'consecration', event_sort_key: 19810101 },
  ];
  const layout = computeLineageGridLayout(nodes, links);
  const origins = [21, 22].map((id) => layout.positions[id].x + CARD_W / 2);
  assert.equal(origins[1] - origins[0], COL_PITCH);
}

function testHubChildKeepsColumnAndMovesOutward() {
  const hubId = 30;
  const childHubId = 40;
  const nodes = [
    { id: hubId, name: 'Parent Hub', is_lineage_root: true, is_bishop: true },
    { id: 31, name: 'Leaf A', is_bishop: true },
    { id: 32, name: 'Leaf B', is_bishop: true },
    { id: childHubId, name: 'Child Hub', is_bishop: true },
  ];
  const links = [
    { source: hubId, target: 31, type: 'consecration', event_sort_key: 19800101 },
    { source: hubId, target: 32, type: 'consecration', event_sort_key: 19810101 },
    { source: hubId, target: childHubId, type: 'consecration', event_sort_key: 19820101 },
  ];
  for (let i = 0; i < 5; i += 1) {
    const leafId = 500 + i;
    nodes.push({ id: leafId, name: `Nested ${i}`, is_bishop: true });
    links.push({
      source: childHubId,
      target: leafId,
      type: 'consecration',
      event_sort_key: 20000101 + i,
    });
  }

  const layout = computeLineageGridLayout(nodes, links);
  const pos = layout.positions;
  assert.deepEqual([31, 32, childHubId].map((id) => pos[id].col - pos[hubId].col), [1, 2, 3],
    'a child hub keeps its column; its subtree moves outward vertically instead');
  assert.equal(pos[childHubId].side, 'above', 'third child (index 2) hangs above the trunk');
  assert.ok(pos[childHubId].y + CARD_H < layout.buses[0].timeline_y, 'child hub sits fully above the parent trunk');
  assertGridClear(layout);
}

function testMultiRelationWidensOriginGroup() {
  const nodes = [
    { id: 1, name: 'Hub', is_bishop: true, is_lineage_root: true },
    { id: 2, name: 'Target', is_bishop: true, consecrations_count: 1 },
    { id: 3, name: 'Single', is_bishop: true },
  ];
  const links = [
    { source: 1, target: 2, type: 'ordination', event_sort_key: 19700101 },
    { source: 1, target: 2, type: 'consecration', event_sort_key: 19800101 },
    { source: 1, target: 3, type: 'consecration', event_sort_key: 19900101 },
  ];
  const layout = computeLineageGridLayout(nodes, links);
  const pos = layout.positions;

  assert.ok(pos[2], 'multi-relation target gets one card');
  assert.ok(pos[3], 'third child gets one card');
  assert.equal(pos[3].col - pos[2].col, 1, 'multi-relation child still takes one column');
  const paths = routeAllEdges(links, pos, layout);
  const stubXs = [...paths.entries()]
    .filter(([key]) => key.startsWith('1->2:'))
    .map(([, d]) => parseTrunkPath(d).xMin);
  assert.equal(stubXs.length, 2, 'ordination and consecration each get a stub');
  stubXs.forEach((x) => assert.ok(x > pos[2].x && x < pos[2].x + CARD_W, 'offset stubs land on the card'));
}

function testBishopIgnoresOrdinationIncoming() {
  const nodes = [
    { id: 1, name: 'Ordainer', is_bishop: true, is_lineage_root: true },
    { id: 2, name: 'Consecrator', is_bishop: true, is_lineage_root: true },
    { id: 3, name: 'Bishop Target', is_bishop: true, consecrations_count: 1 },
  ];
  const links = [
    { source: 1, target: 3, type: 'ordination', event_sort_key: 19700101 },
    {
      source: 2, target: 3, type: 'consecration',
      event_sort_key: 19800101, is_sub_conditione: false, is_invalid: false,
    },
  ];
  const layout = computeLineageGridLayout(nodes, links);
  assert.deepEqual(layout.primary_edges, [{ source: 2, target: 3 }]);
}

function testPrimarySuccessionPicksMostValidThenLatest() {
  const nodes = [
    { id: 1, name: 'A', is_bishop: true, is_lineage_root: true },
    { id: 2, name: 'B', is_bishop: true, is_lineage_root: true },
    { id: 3, name: 'C', is_bishop: true },
  ];
  const links = [
    {
      source: 1, target: 3, type: 'consecration',
      event_sort_key: 19700101, is_invalid: true,
    },
    {
      source: 2, target: 3, type: 'consecration',
      event_sort_key: 19800101, is_doubtfully_valid: true,
    },
  ];
  const layout = computeLineageGridLayout(nodes, links);
  assert.deepEqual(layout.primary_edges, [{ source: 2, target: 3 }]);
}

function testInvalidOnlySuccessionStillCreatesBus() {
  const nodes = [
    { id: 1, name: 'Hub', is_bishop: true, is_lineage_root: true },
    { id: 2, name: 'Child', is_bishop: true },
  ];
  const links = [
    {
      source: 1, target: 2, type: 'consecration',
      event_sort_key: 19800101, is_invalid: true,
    },
  ];
  const layout = computeLineageGridLayout(nodes, links);
  assert.equal(layout.buses.length, 1);
  assert.deepEqual(layout.primary_edges, [{ source: 1, target: 2 }]);
}

function testOrdinationChildUsesBusWhenShowPriests() {
  const layout = computeLineageGridLayout(FIXTURE_NODES, FIXTURE_LINKS, { showPriests: true });
  const bus = layout.buses.find((b) => b.source === 1);
  assert.ok(bus, 'hub with priest child should emit bus');
  assert.ok(bus.targets.some((t) => t.target === 6), 'priest ordination child should be on bus');
  assert.ok(layout.primary_edges.some((e) => e.source === 1 && e.target === 6));
}

function testCoConsecrationNotLayoutParent() {
  const nodes = [
    { id: 2, name: 'Visible Co', consecration_date: '1952-01-01', is_bishop: true },
    { id: 3, name: 'Successor', consecration_date: '1970-06-01', is_bishop: true, consecrations_count: 1 },
  ];
  const links = [
    {
      source: 2, target: 3, type: 'co-consecration',
      event_sort_key: 19700601, is_sub_conditione: false, is_invalid: false,
    },
    {
      source: 2, target: 3, type: 'consecration',
      event_sort_key: 19700601, is_sub_conditione: false, is_invalid: false,
    },
  ];
  const layout = computeLineageGridLayout(nodes, links);
  assert.deepEqual(layout.primary_edges, [{ source: 2, target: 3 }]);
}

function testBusTimelineBounds() {
  const hubId = 100;
  const nodes = [{ id: hubId, name: 'Hub Bishop', is_lineage_root: true, is_bishop: true }];
  const links = [];
  for (let i = 0; i < 3; i += 1) {
    const childId = 200 + i;
    nodes.push({ id: childId, name: `Child ${i}`, is_bishop: true });
    links.push({
      source: hubId,
      target: childId,
      type: 'consecration',
      event_sort_key: 19800101 + i * 10000,
    });
  }

  const layout = computeLineageGridLayout(nodes, links);
  const bus = layout.buses[0];
  const hubX = layout.positions[hubId].x;

  assert.equal(bus.timeline_start_x, hubX + CARD_W);
  assert.ok(Math.abs(bus.timeline_y - (layout.positions[hubId].y + CARD_H / 2)) < 0.01);
}

function testChildrenStrictlyLtrWithinBus() {
  const layout = computeLineageGridLayout(FIXTURE_NODES, FIXTURE_LINKS, { showPriests: false });
  const pos = layout.positions;
  const bus = layout.buses.find((b) => b.source === 1);
  const timelineStart = bus.timeline_start_x;

  const childIds = bus.targets.map((entry) => entry.target);
  childIds.forEach((childId) => {
    assert.ok(pos[childId].x >= timelineStart + GAP_X - 0.01);
  });

  for (let i = 0; i < childIds.length - 1; i += 1) {
    const left = childIds[i];
    const right = childIds[i + 1];
    assert.ok(
      pos[right].x + CARD_W / 2 > pos[left].x + CARD_W / 2,
      'bus children should advance chronologically left-to-right by origin',
    );
  }
}

function testHubEmitsBusWithTimelineY() {
  const hubId = 100;
  const nodes = [{ id: hubId, name: 'Hub Bishop', is_lineage_root: true, is_bishop: true }];
  const links = [];
  for (let i = 0; i < 4; i += 1) {
    const childId = 200 + i;
    nodes.push({ id: childId, name: `Child ${i}`, is_bishop: true });
    links.push({
      source: hubId,
      target: childId,
      type: 'consecration',
      event_sort_key: 19800101 + i * 10000,
    });
  }

  const layout = computeLineageGridLayout(nodes, links);
  assert.equal(layout.buses.length, 1);
  const bus = layout.buses[0];
  assert.equal(bus.source, hubId);
  assert.ok('timeline_y' in bus);
  assert.equal(bus.targets.length, 4);
  const expectedTimeline = layout.positions[hubId].y + CARD_H / 2;
  assert.ok(Math.abs(bus.timeline_y - expectedTimeline) < 0.01);
}

function testBoundsPresent() {
  const layout = computeLineageGridLayout(FIXTURE_NODES, FIXTURE_LINKS);
  assert.ok(layout.bounds.width >= PAD + CARD_W);
  assert.ok(layout.bounds.height >= PAD + CARD_H);
}

function testHiddenParentMakesChildFirstClergy() {
  // Hidden primary consecrator omitted from payload; visible co-consecration only.
  const nodes = [
    { id: 2, name: 'Visible Co', consecration_date: '1952-01-01', is_bishop: true },
    { id: 3, name: 'Successor', consecration_date: '1970-06-01', is_bishop: true, consecrations_count: 1 },
  ];
  const links = [
    {
      source: 2, target: 3, type: 'co-consecration',
      event_sort_key: 19700601, is_sub_conditione: false, is_invalid: false,
    },
  ];

  const layout = computeLineageGridLayout(nodes, links);
  const pos = layout.positions;

  assert.ok(3 in pos);
  assert.ok(2 in pos);
  assert.equal(pos[3].x, PAD, 'successor with no visible consecration parent sits at left edge');
  assert.ok(
    pos[3].x <= pos[2].x + 1,
    'successor should not hang off visible co-consecrator as layout parent',
  );
  assert.deepEqual(layout.first_clergy_ids, [2, 3]);
  assert.deepEqual(layout.primary_edges, []);
}

function testSharedHiddenAncestorCreatesSeparateSeeds() {
  const nodes = [
    { id: 10, name: 'Visible A', is_bishop: true, consecrations_count: 1 },
    { id: 11, name: 'Orphan C', is_bishop: true, consecrations_count: 1 },
    { id: 12, name: 'Orphan D', is_bishop: true, consecrations_count: 1 },
  ];
  const links = [];

  const layout = computeLineageGridLayout(nodes, links);
  const pos = layout.positions;

  assert.ok(11 in pos);
  assert.ok(12 in pos);
  assert.deepEqual(layout.first_clergy_ids, [10, 11, 12]);
  assert.equal(pos[10].x, PAD, 'first-ranked lineage at the left edge');
  assertGridClear(layout);
}

function testOrphanBishopWithConsecrationsStillAppears() {
  const nodes = [
    {
      id: 20,
      name: 'Orphan Bishop',
      is_bishop: true,
      consecrations_count: 1,
      consecration_date: '1980-01-01',
    },
  ];
  const links = [];

  const layout = computeLineageGridLayout(nodes, links);
  assert.ok(20 in layout.positions);
  assert.deepEqual(layout.first_clergy_ids, [20]);
  assert.equal(layout.positions[20].x, PAD);
}

function testNoCardOverlapOnFixture() {
  const layout = computeLineageGridLayout(FIXTURE_NODES, FIXTURE_LINKS, { showPriests: false });
  assertNoCardOverlap(layout);
}

function testTwoTrueRootsStackVertically() {
  const nodes = [
    { id: 1, name: 'Root A', consecration_date: '1950-01-01', is_bishop: true },
    { id: 2, name: 'Root B', consecration_date: '1952-01-01', is_bishop: true },
  ];
  const links = [];
  const layout = computeLineageGridLayout(nodes, links);
  assert.equal(layout.positions[1].x, PAD);
  assert.equal(layout.positions[2].x, PAD);
  assert.ok(layout.positions[1].y !== layout.positions[2].y, 'disjoint roots should stack');
  assert.deepEqual(layout.first_clergy_ids, [1, 2]);
  assertNoCardOverlap(layout);
}


function randomForest(n, maxKids, roots, seed) {
  let state = seed;
  const rnd = () => (state = (state * 16807) % 2147483647) / 2147483647;
  const nodes = [];
  const links = [];
  const kids = new Map();
  for (let i = 0; i < n; i += 1) {
    nodes.push({ id: i + 1, name: `Bishop ${i + 1}`, is_bishop: true });
    kids.set(i + 1, 0);
    if (i < roots) continue;
    let parent;
    do { parent = 1 + Math.floor(rnd() * i); } while (kids.get(parent) >= maxKids);
    kids.set(parent, kids.get(parent) + 1);
    links.push({ source: parent, target: i + 1, type: 'consecration', event_sort_key: 19000101 + i });
  }
  return { nodes, links };
}

function testGridInvariantsOnFixtures() {
  assertGridClear(computeLineageGridLayout(FIXTURE_NODES, FIXTURE_LINKS, { showPriests: true }));
  assertGridClear(computeLineageGridLayout(FIXTURE_NODES, FIXTURE_LINKS, { showPriests: false }));
}

function testRandomForestsPlaceEveryNodeWithoutCollisions() {
  [[300, 4, 5, 7], [2000, 8, 20, 42]].forEach(([n, maxKids, roots, seed]) => {
    const { nodes, links } = randomForest(n, maxKids, roots, seed);
    const layout = computeLineageGridLayout(nodes, links);
    assert.equal(Object.keys(layout.positions).length, n, 'every bishop placed');
    assertGridClear(layout);
  });
}

function testSmallLineagesPackBesideLargest() {
  const { nodes, links } = randomForest(120, 4, 1, 3);
  for (let i = 0; i < 30; i += 1) nodes.push({ id: 1000 + i, name: `Lone ${i}`, is_bishop: true });
  const layout = computeLineageGridLayout(nodes, links);
  const pos = layout.positions;
  assert.equal(pos[1].x, PAD, 'largest lineage stays at the left edge');
  const lineageOf = new Map();
  const kids = new Map();
  links.forEach((l) => { if (!kids.has(l.source)) kids.set(l.source, []); kids.get(l.source).push(l.target); });
  layout.first_clergy_ids.forEach((root) => {
    (function walk(id) { lineageOf.set(id, root); (kids.get(id) || []).forEach(walk); })(root);
  });
  const largest = Object.entries(pos).filter(([id]) => lineageOf.get(Number(id)) === 1).map(([, p]) => p);
  assert.equal(Math.min(...largest.map((p) => p.row)), 0, 'largest lineage is packed first, at the top');
  const largestBottom = Math.max(...largest.map((p) => p.row));
  assert.ok(Object.entries(pos).some(([id, p]) => lineageOf.get(Number(id)) !== 1 && p.row < largestBottom),
    'some small lineages sit beside the largest one, not only below it');
  const cell = new Map();
  Object.entries(pos).forEach(([id, p]) => {
    for (let r = p.row; r < p.row + CARD_ROWS; r += 1) cell.set(`${r},${p.col}`, Number(id));
  });
  cell.forEach((id, key) => {
    const [r, c] = key.split(',').map(Number);
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        const other = cell.get(`${r + dr},${c + dc}`);
        if (other !== undefined) {
          assert.equal(lineageOf.get(other), lineageOf.get(id), `lineages of ${id} and ${other} touch`);
        }
      }
    }
  });
  assertGridClear(layout);
}

function testLargeForestLaysOutQuickly() {
  const { nodes, links } = randomForest(5000, 6, 40, 99);
  const t0 = performance.now();
  computeLineageGridLayout(nodes, links);
  const ms = performance.now() - t0;
  assert.ok(ms < 500, `5,000-bishop layout took ${ms.toFixed(0)} ms`);
}


const tests = [
  ['testGridInvariantsOnFixtures', testGridInvariantsOnFixtures],
  ['testRandomForestsPlaceEveryNodeWithoutCollisions', testRandomForestsPlaceEveryNodeWithoutCollisions],
  ['testSmallLineagesPackBesideLargest', testSmallLineagesPackBesideLargest],
  ['testLargeForestLaysOutQuickly', testLargeForestLaysOutQuickly],
  ['testFixturePrimaryEdgesAndMetrics', testFixturePrimaryEdgesAndMetrics],
  ['testLargestDescendantTreeFirst', testLargestDescendantTreeFirst],
  ['testShowPriestsIncludesNonConsecrated', testShowPriestsIncludesNonConsecrated],
  ['testDeterministicRepeat', testDeterministicRepeat],
  ['testCycleBreakingIsStable', testCycleBreakingIsStable],
  ['testChildrenAlternateAboveAndBelow', testChildrenAlternateAboveAndBelow],
  ['testDateOrderLeftToRight', testDateOrderLeftToRight],
  ['testLargerYearGapWiderX', testLargerYearGapWiderX],
  ['testNestedChildHubVerticalOffset', testNestedChildHubVerticalOffset],
  ['testUnknownDatesAfterKnown', testUnknownDatesAfterKnown],
  ['testUniquePositions', testUniquePositions],
  ['testGridMetricsMatchFrontend', testGridMetricsMatchFrontend],
  ['testBusEndAtDirectChildCardsNotNested', testBusEndAtDirectChildCardsNotNested],
  ['testChronologicalOriginsWithMinGap', testChronologicalOriginsWithMinGap],
  ['testLeafBranchUsesMinimalEvenPitch', testLeafBranchUsesMinimalEvenPitch],
  ['testHubChildKeepsColumnAndMovesOutward', testHubChildKeepsColumnAndMovesOutward],
  ['testMultiRelationWidensOriginGroup', testMultiRelationWidensOriginGroup],
  ['testBishopIgnoresOrdinationIncoming', testBishopIgnoresOrdinationIncoming],
  ['testPrimarySuccessionPicksMostValidThenLatest', testPrimarySuccessionPicksMostValidThenLatest],
  ['testInvalidOnlySuccessionStillCreatesBus', testInvalidOnlySuccessionStillCreatesBus],
  ['testOrdinationChildUsesBusWhenShowPriests', testOrdinationChildUsesBusWhenShowPriests],
  ['testCoConsecrationNotLayoutParent', testCoConsecrationNotLayoutParent],
  ['testBusTimelineBounds', testBusTimelineBounds],
  ['testChildrenStrictlyLtrWithinBus', testChildrenStrictlyLtrWithinBus],
  ['testHubEmitsBusWithTimelineY', testHubEmitsBusWithTimelineY],
  ['testBoundsPresent', testBoundsPresent],
  ['testHiddenParentMakesChildFirstClergy', testHiddenParentMakesChildFirstClergy],
  ['testSharedHiddenAncestorCreatesSeparateSeeds', testSharedHiddenAncestorCreatesSeparateSeeds],
  ['testOrphanBishopWithConsecrationsStillAppears', testOrphanBishopWithConsecrationsStillAppears],
  ['testNoCardOverlapOnFixture', testNoCardOverlapOnFixture],
  ['testTwoTrueRootsStackVertically', testTwoTrueRootsStackVertically],
];

let failures = 0;
tests.forEach(([name, fn]) => {
  try {
    fn();
    console.log(`OK  ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`FAIL ${name}:`, err.message);
  }
});

if (failures) {
  process.exit(1);
}
console.log('All lineage grid layout tests passed.');
