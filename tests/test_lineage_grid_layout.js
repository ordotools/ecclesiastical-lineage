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
  GRID_METRICS,
  __lineageGridTestHooks,
} from '../static/js/lineage-grid.js';

const {
  CARD_H,
  CARD_W,
  DATE_SCALE,
  GAP_X,
  GAP_Y,
  MIN_CHILD_GAP,
  MIN_BRANCH_GAP,
  MULTI_STUB_GAP,
  PAD,
} = {
  ...GRID_METRICS,
  MIN_CHILD_GAP: GRID_METRICS.CARD_W + GRID_METRICS.GAP_X,
};

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

function assertNoInkOverlap(layout) {
  assertNoCardOverlap(layout);
  const { layoutHasInkOverlap, assertLayoutInkClear } = __lineageGridTestHooks;
  assert.equal(layoutHasInkOverlap(layout.positions, layout.buses), false, 'ink overlap');
  assertLayoutInkClear(layout.positions, layout.buses);
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
  assert.ok(originLate - originEarly >= MIN_BRANCH_GAP - 0.01,
    'leaf branch origins should respect minimal even pitch');
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
  assert.ok(gap >= GAP_Y - 1, 'child hub should clear parent timeline by at least GAP_Y');

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
  assert.equal(gm.CARD_W, 168);
  assert.equal(gm.CARD_H, 136);
  assert.equal(gm.GAP_X, 52);
  assert.equal(gm.GAP_Y, 64);
  assert.equal(gm.PAD, 48);
  assert.equal(gm.DATE_SCALE, 8);
  assert.equal(gm.MIN_BRANCH_GAP, CARD_W + GAP_X / 2);
  assert.equal(gm.MULTI_STUB_GAP, 14);
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

  assert.ok(bus, 'parent hub should emit a bus');
  assert.equal(bus.timeline_start_x, hubX + CARD_W);
  assert.ok(Math.abs(bus.timeline_end_x - childHubRight) < 0.01,
    'bus end should stop at direct child card, not nested descendants');
  assert.ok(nestedLeafRight > bus.timeline_end_x,
    'nested descendants should extend past parent bus trunk');
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

  const origins = [11, 12, 13].map((id) => pos[id].x + CARD_W / 2);
  const pitch1 = origins[1] - origins[0];
  assert.ok(Math.abs(pitch1 - MIN_BRANCH_GAP) < 0.01,
    `first two leaf origins should use minimal pitch, got ${pitch1}`);
  assert.ok(origins[2] > origins[1], 'third event should continue LTR');
  assert.ok(origins[2] > origins[0], 'third above-rail origin clears first after same-rail bump');
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
  assert.ok(Math.abs(origins[1] - origins[0] - MIN_BRANCH_GAP) < 0.01);
}

function testBusHubDisplacesOnlyWhenNeeded() {
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
  const hubX = pos[hubId].x;
  const originA = pos[31].x + CARD_W / 2 - hubX;
  const originB = pos[32].x + CARD_W / 2 - hubX;
  const originHub = pos[childHubId].x + CARD_W / 2 - hubX;

  assert.ok(Math.abs(originB - originA - MIN_BRANCH_GAP) < 0.01,
    'first two leaf origins should stay at minimal pitch');
  assert.ok(originHub > originB + MIN_BRANCH_GAP - 0.01,
    'child hub origin should be pushed right by subtree interference');
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
  const gap12 = (pos[3].x + CARD_W / 2) - (pos[2].x + CARD_W / 2);
  const minPitch = (2 - 1) * MULTI_STUB_GAP + MIN_BRANCH_GAP;
  assert.ok(gap12 >= minPitch - 0.01,
    `gap after multi-relation child should respect multi-relation min pitch, got ${gap12}`);
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
  assert.ok(bus.timeline_end_x >= bus.timeline_start_x);
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

function testSharedHiddenAncestorCreatesSeparateLeftSeeds() {
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
  assert.equal(pos[11].x, PAD);
  assert.equal(pos[12].x, PAD);
  assert.deepEqual(layout.first_clergy_ids, [10, 11, 12]);
  assert.ok(pos[11].y !== pos[12].y, 'separate first-clergy clusters stack vertically');
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

function stretchSqueezeFixture() {
  const hubId = 1;
  const childHubId = 10;
  const nodes = [
    { id: hubId, name: 'Hub', is_lineage_root: true, is_bishop: true },
    { id: childHubId, name: 'Child Hub', is_bishop: true },
    { id: 20, name: 'Leaf Below', is_bishop: true },
    { id: 30, name: 'Leaf Above', is_bishop: true },
  ];
  const links = [
    { source: hubId, target: childHubId, type: 'consecration', event_sort_key: 19800101 },
    { source: hubId, target: 20, type: 'consecration', event_sort_key: 19810101 },
    { source: hubId, target: 30, type: 'consecration', event_sort_key: 19820101 },
  ];
  for (let i = 0; i < 5; i += 1) {
    nodes.push({ id: 100 + i, name: `Nested ${i}`, is_bishop: true });
    links.push({
      source: childHubId,
      target: 100 + i,
      type: 'consecration',
      event_sort_key: 20000101 + i,
    });
  }
  return { nodes, links, hubId, childHubId };
}

function testStretchSqueezeSlidesSiblingLeft() {
  const { nodes, links } = stretchSqueezeFixture();
  const packed = computeLineageGridLayout(nodes, links, { stretchSqueeze: false });
  const squeezed = computeLineageGridLayout(nodes, links);

  assert.ok(
    squeezed.positions[30].x <= packed.positions[30].x + 0.01,
    'later above-rail sibling should not move right of packed origin',
  );
  assert.ok(
    squeezed.bounds.width <= packed.bounds.width + 1,
    'squeeze should not widen overall footprint',
  );
  assert.ok(
    squeezed.positions[30].x > squeezed.positions[10].x,
    'bus children should stay strictly LTR after squeeze',
  );
  assertNoCardOverlap(squeezed);
}

function stubGapAboveParent(parentPos, childPos) {
  const timelineY = parentPos.y + CARD_H / 2;
  return timelineY - (childPos.y + CARD_H);
}

function testStretchSqueezeStretchesBlockerVertically() {
  const { nodes, links, hubId, childHubId } = stretchSqueezeFixture();
  const packed = computeLineageGridLayout(nodes, links, { stretchSqueeze: false });
  const squeezed = computeLineageGridLayout(nodes, links);

  const packedGap = stubGapAboveParent(packed.positions[hubId], packed.positions[childHubId]);
  const squeezedGap = stubGapAboveParent(squeezed.positions[hubId], squeezed.positions[childHubId]);

  assert.ok(
    squeezedGap > packedGap + 50,
    'stretch should lengthen vertical stub from parent bus to blocking child hub',
  );
  assertNoCardOverlap(squeezed);
}

function testStretchSqueezePureSlideOnNestedBus() {
  const hubId = 50;
  const childHubId = 60;
  const nodes = [
    { id: hubId, name: 'Hub', is_lineage_root: true, is_bishop: true },
    { id: childHubId, name: 'Child Hub', is_bishop: true },
  ];
  const links = [{
    source: hubId, target: childHubId, type: 'consecration', event_sort_key: 19800101,
  }];
  for (let i = 0; i < 4; i += 1) {
    nodes.push({ id: 200 + i, name: `Leaf ${i}`, is_bishop: true });
    links.push({
      source: childHubId,
      target: 200 + i,
      type: 'consecration',
      event_sort_key: 19900101 + i * 10000,
    });
  }

  const packed = computeLineageGridLayout(nodes, links, { stretchSqueeze: false });
  const squeezed = computeLineageGridLayout(nodes, links);
  const lastLeaf = 203;

  assert.ok(
    squeezed.positions[lastLeaf].x <= packed.positions[lastLeaf].x + 0.01,
    'nested bus leaves should not move right',
  );
  assertNoCardOverlap(squeezed);
}

function testSmallGroupAllowsStretchBeyondAspectCap() {
  const { nodes, links, hubId, childHubId } = stretchSqueezeFixture();
  const packed = computeLineageGridLayout(nodes, links, { stretchSqueeze: false });
  const squeezed = computeLineageGridLayout(nodes, links);

  assert.ok(squeezed.buses.length < MIN_BUSSES_FOR_ASPECT, 'fixture should skip aspect cap');
  const packedGap = stubGapAboveParent(packed.positions[hubId], packed.positions[childHubId]);
  const squeezedGap = stubGapAboveParent(squeezed.positions[hubId], squeezed.positions[childHubId]);
  assert.ok(
    squeezedGap > packedGap,
    'small groups should still allow vertical stretch for squeeze',
  );
}

function testAspectCapRejectsExcessiveStretch() {
  const rootId = 1;
  const nodes = [{ id: rootId, name: 'Root', is_lineage_root: true, is_bishop: true }];
  const links = [];
  let nextId = 10;
  let parentId = rootId;

  for (let depth = 0; depth < 3; depth += 1) {
    const hubId = nextId;
    nextId += 1;
    nodes.push({ id: hubId, name: `Hub ${depth}`, is_bishop: true });
    links.push({
      source: parentId,
      target: hubId,
      type: 'consecration',
      event_sort_key: 19800101 + depth * 10000,
    });
    for (let i = 0; i < 6; i += 1) {
      const leafId = nextId;
      nextId += 1;
      nodes.push({ id: leafId, name: `Leaf ${depth}-${i}`, is_bishop: true });
      links.push({
        source: hubId,
        target: leafId,
        type: 'consecration',
        event_sort_key: 19900101 + depth * 100000 + i,
      });
    }
    parentId = hubId;
  }

  const trailingId = nextId;
  nodes.push({ id: trailingId, name: 'Trailing', is_bishop: true });
  links.push({
    source: rootId,
    target: trailingId,
    type: 'consecration',
    event_sort_key: 20200101,
  });

  const packed = computeLineageGridLayout(nodes, links, { stretchSqueeze: false });
  const squeezed = computeLineageGridLayout(nodes, links);

  assert.ok(squeezed.buses.length >= MIN_BUSSES_FOR_ASPECT,
    'fixture should contain enough buses to apply aspect cap');
  assert.ok(
    Math.abs(squeezed.positions[trailingId].x - packed.positions[trailingId].x) < 500
      || squeezed.bounds.width <= packed.bounds.width,
    'aspect cap or overlap limits should prevent unbounded stretch+s squeeze expansion',
  );
  assertNoCardOverlap(squeezed);
}

function stubGapBelowParent(parentPos, childPos) {
  return childPos.y - (parentPos.y + CARD_H);
}

function testChainedMinLeftFromPriorSibling() {
  const { nodes, links, hubId } = stretchSqueezeFixture();
  const squeezed = computeLineageGridLayout(nodes, links);
  const hubX = squeezed.positions[hubId].x;
  const prevOrigin = squeezed.positions[20].x + CARD_W / 2 - hubX;
  const minLeftRel = prevOrigin + MIN_BRANCH_GAP - CARD_W / 2;
  const leaf30Rel = squeezed.positions[30].x - hubX;

  assert.ok(
    Math.abs(leaf30Rel - minLeftRel) < 2,
    'trailing sibling should sit at chained min-left from prior direct sibling origin',
  );
  assertNoCardOverlap(squeezed);
}

function testVerticalCompactPullsWhenOverReserved() {
  const hubId = 1;
  const childHubId = 10;
  const nodes = [
    { id: hubId, name: 'Hub', is_lineage_root: true, is_bishop: true },
    { id: 2, name: 'Spacer', is_bishop: true },
    { id: childHubId, name: 'Child Hub', is_bishop: true },
    { id: 201, name: 'Nested', is_bishop: true },
  ];
  const links = [
    { source: hubId, target: 2, type: 'consecration', event_sort_key: 19800101 },
    { source: hubId, target: childHubId, type: 'consecration', event_sort_key: 19810101 },
    { source: childHubId, target: 201, type: 'consecration', event_sort_key: 19900101 },
  ];

  const packed = computeLineageGridLayout(nodes, links, { stretchSqueeze: false });
  const squeezed = computeLineageGridLayout(nodes, links);
  const side = squeezed.positions[childHubId].side || packed.positions[childHubId].side;
  const packedGap = side === 'above'
    ? stubGapAboveParent(packed.positions[hubId], packed.positions[childHubId])
    : stubGapBelowParent(packed.positions[hubId], packed.positions[childHubId]);
  const squeezedGap = side === 'above'
    ? stubGapAboveParent(squeezed.positions[hubId], squeezed.positions[childHubId])
    : stubGapBelowParent(squeezed.positions[hubId], squeezed.positions[childHubId]);
  assert.ok(
    squeezedGap <= packedGap + 1,
    'vertical compact should not lengthen stub versus packed layout',
  );
  assertNoCardOverlap(squeezed);
}

function testStretchUsesGridAlignedDy() {
  const { nodes, links, hubId, childHubId } = stretchSqueezeFixture();
  const layout = computeLineageGridLayout(nodes, links);
  const parent = layout.positions[hubId];
  const child = layout.positions[childHubId];
  const gap = child.side === 'above'
    ? parent.y - (child.y + CARD_H)
    : child.y - (parent.y + CARD_H);
  assert.ok(gap >= GAP_Y - 1, `stub must keep at least default GAP_Y, got ${gap}`);
}

function testMultiPassSqueezeReachesMinLeft() {
  const { nodes, links } = stretchSqueezeFixture();
  const packed = computeLineageGridLayout(nodes, links, { stretchSqueeze: false });
  const squeezed = computeLineageGridLayout(nodes, links);

  assert.ok(
    squeezed.positions[30].x <= packed.positions[30].x + 0.01,
    'multi-pass squeeze should not push trailing sibling right',
  );
  assert.ok(
    squeezed.bounds.width <= packed.bounds.width + 1,
    'multi-pass squeeze should not widen footprint',
  );
  assertNoCardOverlap(squeezed);
}

function gapFlipFixture() {
  const hubId = 1;
  const deepHubId = 3;
  const nodes = [
    { id: hubId, name: 'Hub', is_lineage_root: true, is_bishop: true },
    { id: 2, name: 'Short Above', is_bishop: true },
    { id: deepHubId, name: 'Deep Below Hub', is_bishop: true },
  ];
  const links = [
    { source: hubId, target: 2, type: 'consecration', event_sort_key: 19800101 },
    { source: hubId, target: deepHubId, type: 'consecration', event_sort_key: 19850101 },
  ];
  for (let i = 0; i < 4; i += 1) {
    nodes.push({ id: 50 + i, name: `Nested ${i}`, is_bishop: true });
    links.push({
      source: deepHubId,
      target: 50 + i,
      type: 'consecration',
      event_sort_key: 20000101 + i * 10000,
    });
  }
  return { nodes, links, hubId, deepHubId };
}

function testSuffixFlipFillsOppositeRailGap() {
  const { nodes, links, hubId, deepHubId } = gapFlipFixture();
  const packed = computeLineageGridLayout(nodes, links, { stretchSqueeze: false });
  const squeezed = computeLineageGridLayout(nodes, links);

  assert.equal(
    packed.positions[deepHubId].side,
    'above',
    'side pass should flip deep hub before pack when opposite gap exists',
  );
  assert.equal(
    squeezed.positions[deepHubId].side,
    'above',
    'deep hub stays on above rail after squeeze',
  );
  assert.ok(
    squeezed.bounds.width <= packed.bounds.width + 1,
    'flip should not widen footprint',
  );
  assertNoCardOverlap(squeezed);

  const hubY = squeezed.positions[hubId].y + CARD_H / 2;
  assert.ok(
    squeezed.positions[deepHubId].y + CARD_H < hubY,
    'flipped deep hub should sit above parent bus',
  );
}

function testSuffixInvertSideMap() {
  const { invertSuffixSides, getChildSide } = __lineageGridTestHooks;
  const sideMap = new Map();
  const childList = [[10, {}], [11, {}], [12, {}]];

  invertSuffixSides(1, 1, childList, sideMap, {});

  assert.equal(getChildSide(1, 10, 0, sideMap, null), 'above', 'prefix child untouched');
  assert.equal(getChildSide(1, 11, 1, sideMap, null), 'above', 'suffix child 1 inverts below to above');
  assert.equal(getChildSide(1, 12, 2, sideMap, null), 'below', 'suffix child 2 inverts above to below');
}

function testNoGapKeepsStrictAlternate() {
  const nodes = [
    { id: 1, name: 'Hub', is_lineage_root: true, is_bishop: true },
    { id: 2, name: 'Child A', is_bishop: true },
    { id: 3, name: 'Child B', is_bishop: true },
  ];
  const links = [
    { source: 1, target: 2, type: 'consecration', event_sort_key: 19800101 },
    { source: 1, target: 3, type: 'consecration', event_sort_key: 19900101 },
  ];
  const layout = computeLineageGridLayout(nodes, links);
  assert.equal(layout.positions[2].side, 'above');
  assert.equal(layout.positions[3].side, 'below');
  assertNoCardOverlap(layout);
}

function aspectRejectFlipFixture() {
  const hubId = 1;
  const nodes = [{ id: hubId, name: 'Root Hub', is_lineage_root: true, is_bishop: true }];
  const links = [];

  for (let c = 0; c < 4; c += 1) {
    const childId = 10 + c;
    nodes.push({ id: childId, name: `Child ${c}`, is_bishop: true });
    links.push({
      source: hubId,
      target: childId,
      type: 'consecration',
      event_sort_key: 19800101 + c * 50000,
    });
    if (c >= 2) {
      for (let n = 0; n < 8; n += 1) {
        const nestedId = 100 + c * 10 + n;
        nodes.push({ id: nestedId, name: `Nested ${nestedId}`, is_bishop: true });
        links.push({
          source: childId,
          target: nestedId,
          type: 'consecration',
          event_sort_key: 20000101 + nestedId,
        });
      }
    }
  }
  return { nodes, links, hubId, trailingHubId: 13 };
}

function testAspectCapRejectsSuffixFlip() {
  const { nodes, links, trailingHubId } = aspectRejectFlipFixture();
  const layout = computeLineageGridLayout(nodes, links);
  assert.ok(layout.positions[trailingHubId], 'trailing hub is placed');
  assertNoCardOverlap(layout);
  if (layout.buses.length >= MIN_BUSSES_FOR_ASPECT) {
    const xs = Object.values(layout.positions).map((p) => p.x);
    const ys = Object.values(layout.positions).map((p) => p.y);
    const w = Math.max(...xs) + CARD_W - Math.min(...xs);
    const h = Math.max(...ys) + CARD_H - Math.min(...ys);
    assert.ok(h / w <= 5 / 3 + 0.05, '4+ bus group should stay within 5:3 aspect cap');
  }
}

function denseNestedHubFixture() {
  const rootId = 1;
  const nodes = [{ id: rootId, name: 'Root', is_lineage_root: true, is_bishop: true }];
  const links = [];
  let nextId = 10;
  let parentId = rootId;

  for (let depth = 0; depth < 4; depth += 1) {
    const hubId = nextId;
    nextId += 1;
    nodes.push({ id: hubId, name: `Hub ${depth}`, is_bishop: true });
    links.push({
      source: parentId,
      target: hubId,
      type: 'consecration',
      event_sort_key: 19800101 + depth * 10000,
    });
    for (let i = 0; i < 5; i += 1) {
      const leafId = nextId;
      nextId += 1;
      nodes.push({ id: leafId, name: `Leaf ${depth}-${i}`, is_bishop: true });
      links.push({
        source: hubId,
        target: leafId,
        type: 'consecration',
        event_sort_key: 19900101 + depth * 100000 + i,
      });
    }
    parentId = hubId;
  }
  return { nodes, links };
}

function testDenseNestedHubNoOverlap() {
  const { nodes, links } = denseNestedHubFixture();
  const layout = computeLineageGridLayout(nodes, links);
  assert.ok(layout.buses.length >= 4, 'fixture should contain multiple buses');
  assertNoCardOverlap(layout);
}

function testSidePassBeforePack() {
  const { nodes, links, deepHubId } = gapFlipFixture();
  const packed = computeLineageGridLayout(nodes, links, { stretchSqueeze: false });
  assert.equal(
    packed.positions[deepHubId].side,
    'above',
    'packed layout should reflect side pass flip before squeeze',
  );
}

function testStretchLastResortSkipsWhenSlideWorks() {
  const { nodes, links, hubId, childHubId } = stretchSqueezeFixture();
  const packed = computeLineageGridLayout(nodes, links, { stretchSqueeze: false });
  const full = computeLineageGridLayout(nodes, links);

  const packedGap = stubGapAboveParent(packed.positions[hubId], packed.positions[childHubId]);
  const fullGap = stubGapAboveParent(full.positions[hubId], full.positions[childHubId]);

  assert.ok(
    full.positions[30].x < packed.positions[30].x,
    'slide pass should move trailing sibling left',
  );
  assert.ok(
    fullGap > packedGap + 50,
    'stretch last resort should lengthen stub when slide alone is insufficient',
  );
  assertNoCardOverlap(full);
}

function packingDensity(layout) {
  const count = Object.keys(layout.positions).length;
  const cardArea = count * CARD_W * CARD_H;
  const width = layout.bounds.width - PAD;
  const height = layout.bounds.height - (Number.isFinite(layout.bounds.min_y) ? layout.bounds.min_y : PAD);
  return cardArea / Math.max(1, width * height);
}

function testOccupancyCollideAndTranslate() {
  const { occupancyFromRects, occupanciesCollide, translateOccupancy } = __lineageGridTestHooks;
  const a = occupancyFromRects([{ left: 0, top: 0, right: 100, bottom: 100 }]);
  const b = occupancyFromRects([{ left: 200, top: 0, right: 300, bottom: 100 }]);
  const c = occupancyFromRects([{ left: 50, top: 50, right: 150, bottom: 150 }]);
  assert.ok(!occupanciesCollide(a, b), 'disjoint rects should not collide');
  assert.ok(occupanciesCollide(a, c), 'overlapping rects should collide');
  assert.ok(!occupanciesCollide(a, translateOccupancy(c, 200, 0)), 'translated rect should clear');
}

function testInterlockingShapesShareX() {
  const parentId = 1;
  const hubA = 10;
  const leafB = 20;
  const leafD = 30;
  const nodes = [
    { id: parentId, name: 'Parent', is_lineage_root: true, is_bishop: true },
    { id: hubA, name: 'Hub A', is_bishop: true },
    { id: leafB, name: 'Leaf B', is_bishop: true },
    { id: leafD, name: 'Leaf D', is_bishop: true },
  ];
  const links = [
    { source: parentId, target: hubA, type: 'consecration', event_sort_key: 19800101 },
    { source: parentId, target: leafB, type: 'consecration', event_sort_key: 19810101 },
    { source: parentId, target: leafD, type: 'consecration', event_sort_key: 19820101 },
  ];
  for (let i = 0; i < 5; i += 1) {
    const nestedId = 100 + i;
    nodes.push({ id: nestedId, name: `Nested ${i}`, is_bishop: true });
    links.push({
      source: hubA,
      target: nestedId,
      type: 'consecration',
      event_sort_key: 20000101 + i,
    });
  }

  const layout = computeLineageGridLayout(nodes, links);
  const pos = layout.positions;
  const nestedRight = Math.max(...[100, 101, 102, 103, 104].map((id) => pos[id].x + CARD_W));
  assert.ok(pos[leafD].x < nestedRight, 'later same-rail leaf should sit inside hub descendant X-range');
  const originA = pos[hubA].x + CARD_W / 2;
  const originD = pos[leafD].x + CARD_W / 2;
  assert.ok(
    Math.abs(originD - originA - 2 * MIN_BRANCH_GAP) < GAP_X + 0.01,
    'same-rail leaf after opposite-rail sibling should stay near two min pitches, not hub subtree width',
  );
  assertNoCardOverlap(layout);
}

function testBusGapForceKeepsMinPitch() {
  const parentId = 1;
  const hubA = 10;
  const leafB = 20;
  const nodes = [
    { id: parentId, name: 'Parent', is_lineage_root: true, is_bishop: true },
    { id: hubA, name: 'Wide Hub', is_bishop: true },
    { id: leafB, name: 'Leaf', is_bishop: true },
  ];
  const links = [
    { source: parentId, target: hubA, type: 'consecration', event_sort_key: 19800101 },
    { source: parentId, target: leafB, type: 'consecration', event_sort_key: 19810101 },
  ];
  for (let i = 0; i < 6; i += 1) {
    const nestedId = 200 + i;
    nodes.push({ id: nestedId, name: `Nested ${i}`, is_bishop: true });
    links.push({
      source: hubA,
      target: nestedId,
      type: 'consecration',
      event_sort_key: 20000101 + i,
    });
  }

  const layout = computeLineageGridLayout(nodes, links);
  const originA = layout.positions[hubA].x + CARD_W / 2;
  const originB = layout.positions[leafB].x + CARD_W / 2;
  assert.ok(
    Math.abs(originB - originA - MIN_BRANCH_GAP) < 0.01,
    `leaf after wide hub should sit at min bus gap, got ${originB - originA}`,
  );
  const extra = (layout.positions[hubA].side === 'above'
    ? layout.positions[parentId].y - (layout.positions[hubA].y + CARD_H)
    : layout.positions[hubA].y - (layout.positions[parentId].y + CARD_H)) - GAP_Y;
  assert.ok(extra >= -0.01, 'wide hub may stretch stub to keep min origin gap');
  assertNoCardOverlap(layout);
}

function testPackingDensityDoesNotRegress() {
  const { nodes, links } = stretchSqueezeFixture();
  const layout = computeLineageGridLayout(nodes, links);
  const density = packingDensity(layout);
  assert.ok(
    density > 0.12,
    `card/canvas density should stay compact, got ${density}`,
  );
  assertNoCardOverlap(layout);
}

function testOccupancyLayoutIsDeterministic() {
  const { nodes, links } = stretchSqueezeFixture();
  const first = positionsSnapshot(computeLineageGridLayout(nodes, links));
  const second = positionsSnapshot(computeLineageGridLayout(nodes, links));
  assert.deepEqual(first, second);
}

function testMinStubChildMissesParentTrunk() {
  const { occupancyFromRects, occupanciesCollide, cardOccupancyRect, parentTrunkRect } = __lineageGridTestHooks;
  const parent = { x: PAD, y: 280 };
  const child = { x: PAD + CARD_W + GAP_X, y: 280 - GAP_Y - CARD_H };
  const parentInk = occupancyFromRects([
    cardOccupancyRect(parent),
    parentTrunkRect(parent, child.x + CARD_W),
  ]);
  const childInk = occupancyFromRects([cardOccupancyRect(child)]);
  assert.ok(
    !occupanciesCollide(parentInk, childInk),
    'parent trunk at midline must not collide with a child card at default GAP_Y',
  );
}

function testOppositeRailMinPitchNoStubExtra() {
  const nodes = [
    { id: 1, name: 'Hub', is_lineage_root: true, is_bishop: true },
    { id: 2, name: 'Above', is_bishop: true },
    { id: 3, name: 'Below', is_bishop: true },
  ];
  const links = [
    { source: 1, target: 2, type: 'consecration', event_sort_key: 19800101 },
    { source: 1, target: 3, type: 'consecration', event_sort_key: 19810101 },
  ];
  const layout = computeLineageGridLayout(nodes, links);
  const parent = layout.positions[1];
  [2, 3].forEach((id) => {
    const child = layout.positions[id];
    const gap = child.side === 'above'
      ? parent.y - (child.y + CARD_H)
      : child.y - (parent.y + CARD_H);
    assert.ok(
      Math.abs(gap - GAP_Y) < 0.01,
      `opposite-rail child ${id} should keep default stub, got ${gap}`,
    );
  });
  const originGap = (layout.positions[3].x + CARD_W / 2) - (layout.positions[2].x + CARD_W / 2);
  assert.ok(Math.abs(originGap - MIN_BRANCH_GAP) < 0.01);
  assertNoCardOverlap(layout);
}

function nestedHubChainFixture() {
  const nodes = [{ id: 1, name: 'Root', is_lineage_root: true, is_bishop: true }];
  const links = [];
  let parentId = 1;
  let nextId = 10;
  for (let depth = 0; depth < 4; depth += 1) {
    const hubId = nextId;
    nextId += 1;
    nodes.push({ id: hubId, name: `Hub ${depth}`, is_bishop: true });
    links.push({
      source: parentId,
      target: hubId,
      type: 'consecration',
      event_sort_key: 19800101 + depth * 10000,
    });
    for (let i = 0; i < 3; i += 1) {
      const leafId = nextId;
      nextId += 1;
      nodes.push({ id: leafId, name: `Leaf ${depth}-${i}`, is_bishop: true });
      links.push({
        source: hubId,
        target: leafId,
        type: 'consecration',
        event_sort_key: 19900101 + depth * 100000 + i,
      });
    }
    parentId = hubId;
  }
  return { nodes, links };
}

function testHubChainStaysCompact() {
  const { nodes, links } = nestedHubChainFixture();
  const layout = computeLineageGridLayout(nodes, links);
  const n = Object.keys(layout.positions).length;
  assert.ok(
    layout.bounds.width < n * (CARD_W + GAP_X) * 1.5,
    `hub chain width exploded: ${layout.bounds.width} for ${n} nodes`,
  );
  assert.ok(
    layout.bounds.height < n * (CARD_H + GAP_Y) * 1.5,
    `hub chain height exploded: ${layout.bounds.height} for ${n} nodes`,
  );
  assertNoInkOverlap(layout);
}

/** Nested hub whose opposite-rail kids would sit on ancestor trunk Y. */
function ancestorTrunkNestedFixture() {
  const rootId = 1;
  const hubId = 10;
  const nodes = [
    { id: rootId, name: 'Root', is_lineage_root: true, is_bishop: true },
    { id: hubId, name: 'Child Hub', is_bishop: true },
  ];
  const links = [
    { source: rootId, target: hubId, type: 'consecration', event_sort_key: 19800101 },
  ];
  for (let i = 0; i < 6; i += 1) {
    const id = 100 + i;
    nodes.push({ id, name: `Nested ${i}`, is_bishop: true });
    links.push({
      source: hubId,
      target: id,
      type: 'consecration',
      event_sort_key: 20000101 + i,
    });
  }
  // Later sibling forces parent trunk through hub descendant X-range.
  nodes.push({ id: 20, name: 'Later Leaf', is_bishop: true });
  links.push({ source: rootId, target: 20, type: 'consecration', event_sort_key: 19810101 });
  return { nodes, links, rootId, hubId };
}

function testNestedHubClearsAncestorTrunk() {
  const { nodes, links, rootId, hubId } = ancestorTrunkNestedFixture();
  const layout = computeLineageGridLayout(nodes, links);
  const root = layout.positions[rootId];
  const hub = layout.positions[hubId];
  const stubGap = hub.side === 'above'
    ? root.y - (hub.y + CARD_H)
    : hub.y - (root.y + CARD_H);
  assert.ok(
    stubGap > GAP_Y + 0.01,
    `hub must stub-stretch past default to clear ancestor trunk, got ${stubGap}`,
  );
  assertNoInkOverlap(layout);
}

function testSiblingStubMissesPriorCard() {
  const parentId = 1;
  const first = 10;
  const second = 20;
  const nodes = [
    { id: parentId, name: 'Parent', is_lineage_root: true, is_bishop: true },
    { id: first, name: 'Wide Hub', is_bishop: true },
    { id: second, name: 'Same Rail Leaf', is_bishop: true },
  ];
  const links = [
    { source: parentId, target: first, type: 'consecration', event_sort_key: 19800101 },
    { source: parentId, target: second, type: 'consecration', event_sort_key: 19820101 },
  ];
  for (let i = 0; i < 4; i += 1) {
    const id = 100 + i;
    nodes.push({ id, name: `N${i}`, is_bishop: true });
    links.push({
      source: first,
      target: id,
      type: 'consecration',
      event_sort_key: 20000101 + i,
    });
  }
  // Opposite-rail filler so second can share rail with first after one skip.
  nodes.push({ id: 15, name: 'Opp', is_bishop: true });
  links.push({ source: parentId, target: 15, type: 'consecration', event_sort_key: 19810101 });

  const layout = computeLineageGridLayout(nodes, links);
  assertNoInkOverlap(layout);
  const { connectingStubRect, cardOccupancyRect, occupanciesCollide, occupancyFromRects } = __lineageGridTestHooks;
  const parent = layout.positions[parentId];
  const leaf = layout.positions[second];
  const stub = connectingStubRect(parent, leaf, leaf.side);
  const priorCards = [first, 100, 101, 102, 103].map((id) => cardOccupancyRect(layout.positions[id]));
  assert.ok(
    !occupanciesCollide(occupancyFromRects([stub]), occupancyFromRects(priorCards)),
    'sibling stub must not pierce prior sibling / nested cards',
  );
}

function testFixtureAndDenseHaveNoInkOverlap() {
  assertNoInkOverlap(computeLineageGridLayout(FIXTURE_NODES, FIXTURE_LINKS));
  const squeezed = stretchSqueezeFixture();
  assertNoInkOverlap(computeLineageGridLayout(squeezed.nodes, squeezed.links));
  const chain = nestedHubChainFixture();
  assertNoInkOverlap(computeLineageGridLayout(chain.nodes, chain.links));
  const dense = denseNestedHubFixture();
  assertNoInkOverlap(computeLineageGridLayout(dense.nodes, dense.links));
}

const MIN_BUSSES_FOR_ASPECT = 4;

const tests = [
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
  ['testBusHubDisplacesOnlyWhenNeeded', testBusHubDisplacesOnlyWhenNeeded],
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
  ['testSharedHiddenAncestorCreatesSeparateLeftSeeds', testSharedHiddenAncestorCreatesSeparateLeftSeeds],
  ['testOrphanBishopWithConsecrationsStillAppears', testOrphanBishopWithConsecrationsStillAppears],
  ['testNoCardOverlapOnFixture', testNoCardOverlapOnFixture],
  ['testTwoTrueRootsStackVertically', testTwoTrueRootsStackVertically],
  ['testStretchSqueezeSlidesSiblingLeft', testStretchSqueezeSlidesSiblingLeft],
  ['testStretchSqueezeStretchesBlockerVertically', testStretchSqueezeStretchesBlockerVertically],
  ['testStretchSqueezePureSlideOnNestedBus', testStretchSqueezePureSlideOnNestedBus],
  ['testSmallGroupAllowsStretchBeyondAspectCap', testSmallGroupAllowsStretchBeyondAspectCap],
  ['testAspectCapRejectsExcessiveStretch', testAspectCapRejectsExcessiveStretch],
  ['testChainedMinLeftFromPriorSibling', testChainedMinLeftFromPriorSibling],
  ['testVerticalCompactPullsWhenOverReserved', testVerticalCompactPullsWhenOverReserved],
  ['testStretchUsesGridAlignedDy', testStretchUsesGridAlignedDy],
  ['testMultiPassSqueezeReachesMinLeft', testMultiPassSqueezeReachesMinLeft],
  ['testSuffixFlipFillsOppositeRailGap', testSuffixFlipFillsOppositeRailGap],
  ['testSuffixInvertSideMap', testSuffixInvertSideMap],
  ['testNoGapKeepsStrictAlternate', testNoGapKeepsStrictAlternate],
  ['testAspectCapRejectsSuffixFlip', testAspectCapRejectsSuffixFlip],
  ['testDenseNestedHubNoOverlap', testDenseNestedHubNoOverlap],
  ['testSidePassBeforePack', testSidePassBeforePack],
  ['testStretchLastResortSkipsWhenSlideWorks', testStretchLastResortSkipsWhenSlideWorks],
  ['testOccupancyCollideAndTranslate', testOccupancyCollideAndTranslate],
  ['testInterlockingShapesShareX', testInterlockingShapesShareX],
  ['testBusGapForceKeepsMinPitch', testBusGapForceKeepsMinPitch],
  ['testPackingDensityDoesNotRegress', testPackingDensityDoesNotRegress],
  ['testOccupancyLayoutIsDeterministic', testOccupancyLayoutIsDeterministic],
  ['testMinStubChildMissesParentTrunk', testMinStubChildMissesParentTrunk],
  ['testOppositeRailMinPitchNoStubExtra', testOppositeRailMinPitchNoStubExtra],
  ['testHubChainStaysCompact', testHubChainStaysCompact],
  ['testNestedHubClearsAncestorTrunk', testNestedHubClearsAncestorTrunk],
  ['testSiblingStubMissesPriorCard', testSiblingStubMissesPriorCard],
  ['testFixtureAndDenseHaveNoInkOverlap', testFixtureAndDenseHaveNoInkOverlap],
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
